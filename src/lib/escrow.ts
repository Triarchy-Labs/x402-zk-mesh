/**
 * Stellar Escrow System — Real escrow for guild bounties
 *
 * Flow:
 * 1. Issuer creates task with reward_usdc
 * 2. Issuer funds escrow: sends USDC to platform wallet with memo = task_id
 * 3. System validates the transaction via Horizon API
 * 4. On task APPROVED: escrow released to agent's Stellar wallet
 * 5. On task CANCELLED: refund back to issuer
 *
 * For ZK-shielded tasks: the proof_hash links the payment to the task
 * without revealing the agent's identity.
 */

import * as StellarSDK from "@stellar/stellar-sdk";
import { validateSorobanPayment } from "./soroban";
import { getTask, updateTask, getAgent, updateAgent } from "./guild-store";

const HORIZON_TESTNET_URL =
	process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
const PLATFORM_WALLET = process.env.STELLAR_PLATFORM_WALLET || "GPLATFORM_WALLET_DEFAULT";
// Secret for the platform escrow wallet. When set, escrow releases settle on-chain.
const PLATFORM_SECRET = process.env.STELLAR_PLATFORM_SECRET || "";

export interface EscrowResult {
	success: boolean;
	escrow_status: "funded" | "released" | "refunded" | "failed";
	tx_hash?: string;
	error?: string;
	amount_usdc?: number;
	/** Set when a payout was credited internally but not settled on-chain (honest degradation). */
	payout_note?: string;
}

/** Resolve the payout asset: configured classic asset (e.g. USDC) or native XLM. */
function payoutAsset(): StellarSDK.Asset {
	const code = (process.env.STELLAR_PAYMENT_ASSET_CODE || "").trim();
	const issuer = (
		process.env.STELLAR_PAYMENT_ASSET_ISSUER ||
		process.env.STELLAR_USDC_ISSUER ||
		""
	).trim();
	if (code && !["XLM", "NATIVE"].includes(code.toUpperCase()) && issuer) {
		return new StellarSDK.Asset(code, issuer);
	}
	return StellarSDK.Asset.native();
}

/**
 * Settle an escrow payout on Stellar Testnet: platform wallet → agent wallet.
 * Returns the real tx hash on success, or an error reason when an on-chain
 * payout is not possible (no secret, agent without a trustline, etc.).
 */
async function submitPayout(
	destination: string,
	amount: number,
): Promise<{ txHash?: string; error?: string }> {
	if (!PLATFORM_SECRET) return { error: "STELLAR_PLATFORM_SECRET not configured" };
	try {
		const server = new StellarSDK.Horizon.Server(HORIZON_TESTNET_URL);
		const kp = StellarSDK.Keypair.fromSecret(PLATFORM_SECRET);
		const account = await server.loadAccount(kp.publicKey());
		const tx = new StellarSDK.TransactionBuilder(account, {
			fee: StellarSDK.BASE_FEE,
			networkPassphrase: StellarSDK.Networks.TESTNET,
		})
			.addOperation(
				StellarSDK.Operation.payment({
					destination,
					asset: payoutAsset(),
					amount: amount.toFixed(7),
				}),
			)
			.setTimeout(60)
			.build();
		tx.sign(kp);
		const res = await server.submitTransaction(tx);
		return { txHash: res.hash };
	} catch (e) {
		return { error: e instanceof Error ? e.message : "payout submission failed" };
	}
}

/**
 * Verify that a task's escrow has been funded.
 * Checks the Stellar transaction that the issuer claims to have sent.
 */
export async function verifyEscrowFunding(
	taskId: string,
	txHash: string,
): Promise<EscrowResult> {
	const task = getTask(taskId);
	if (!task) {
		return { success: false, escrow_status: "failed", error: "Task not found" };
	}

	if (task.escrow_status === "funded") {
		return { success: true, escrow_status: "funded", amount_usdc: task.reward_usdc };
	}

	// Validate the Stellar transaction
	const validation = await validateSorobanPayment(txHash, task.reward_usdc, taskId);

	if (!validation.valid) {
		return {
			success: false,
			escrow_status: "failed",
			error: validation.error || "Transaction validation failed",
		};
	}

	// Mark task as funded
	updateTask(taskId, { escrow_status: "funded" });

	return {
		success: true,
		escrow_status: "funded",
		tx_hash: txHash,
		amount_usdc: validation.amount || task.reward_usdc,
	};
}

/**
 * Release escrow to the winning agent after APPROVED review.
 *
 * In production this would submit a Stellar transaction from
 * the platform wallet to the agent's wallet. For hackathon,
 * we track the balance internally and log the payout intent.
 */
export async function releaseEscrow(
	taskId: string,
	agentId: string,
): Promise<EscrowResult> {
	const task = getTask(taskId);
	if (!task) {
		return { success: false, escrow_status: "failed", error: "Task not found" };
	}

	if (task.escrow_status !== "funded") {
		return { success: false, escrow_status: "failed", error: `Escrow not funded (status: ${task.escrow_status})` };
	}

	const agent = getAgent(agentId);
	if (!agent) {
		return { success: false, escrow_status: "failed", error: "Agent not found" };
	}

	// Calculate payout after platform fee
	const platformFee = task.reward_usdc * (task.network_fee_pct / 100);
	const agentPayout = task.reward_usdc - platformFee;

	// Settle the payout on-chain (platform wallet -> agent). Falls back to an
	// internal credit with an honest note when on-chain settlement isn't possible.
	let payoutTxHash: string | undefined;
	let payoutNote: string | undefined;

	if (agent.public_key) {
		const payout = await submitPayout(agent.public_key, agentPayout);
		if (payout.txHash) {
			payoutTxHash = payout.txHash;
			console.log(
				"[ESCROW] On-chain payout settled:",
				JSON.stringify({
					task_id: taskId,
					agent_id: agentId,
					agent_wallet: agent.public_key,
					platform_wallet: PLATFORM_WALLET,
					gross_amount: task.reward_usdc,
					platform_fee: platformFee,
					net_payout: agentPayout,
					tx_hash: payoutTxHash,
				}),
			);
		} else {
			payoutNote = `credited internally (no on-chain settlement: ${payout.error})`;
			console.warn("[ESCROW] On-chain payout skipped:", payout.error);
		}
	} else {
		payoutNote = "agent has no Stellar wallet; credited internal balance only";
	}

	// Update agent balance (internal tracking)
	updateAgent(agentId, {
		balance_usdc: agent.balance_usdc + agentPayout,
		total_earned_usdc: agent.total_earned_usdc + agentPayout,
	});

	// Mark escrow as released
	updateTask(taskId, {
		escrow_status: "released",
		status: "PAID",
	});

	return {
		success: true,
		escrow_status: "released",
		amount_usdc: agentPayout,
		tx_hash: payoutTxHash,
		payout_note: payoutNote,
	};
}

/**
 * Refund escrow to issuer (task CANCELLED or EXPIRED).
 *
 * In production: submit refund transaction.
 * For hackathon: update status only.
 */
export async function refundEscrow(taskId: string): Promise<EscrowResult> {
	const task = getTask(taskId);
	if (!task) {
		return { success: false, escrow_status: "failed", error: "Task not found" };
	}

	if (task.escrow_status !== "funded") {
		return { success: false, escrow_status: "failed", error: "Nothing to refund" };
	}

	updateTask(taskId, {
		escrow_status: "refunded",
		status: "CANCELLED",
	});

	return {
		success: true,
		escrow_status: "refunded",
		amount_usdc: task.reward_usdc,
	};
}

/**
 * Get escrow status for a task
 */
export function getEscrowStatus(taskId: string): {
	task_id: string;
	reward_usdc: number;
	escrow_status: string;
	network_fee_pct: number;
	net_payout: number;
} | null {
	const task = getTask(taskId);
	if (!task) return null;

	return {
		task_id: task.id,
		reward_usdc: task.reward_usdc,
		escrow_status: task.escrow_status,
		network_fee_pct: task.network_fee_pct,
		net_payout: task.reward_usdc * (1 - task.network_fee_pct / 100),
	};
}

/**
 * Check platform wallet balance (via Horizon API)
 */
export async function getPlatformBalance(): Promise<{
	xlm: string;
	usdc: string;
	wallet: string;
}> {
	try {
		const resp = await fetch(`${HORIZON_TESTNET_URL}/accounts/${PLATFORM_WALLET}`);
		if (!resp.ok) {
			return { xlm: "0", usdc: "0", wallet: PLATFORM_WALLET };
		}

		interface StellarBalance {
			asset_type: string;
			asset_code?: string;
			balance: string;
		}

		const data = await resp.json();
		const xlm = data.balances?.find((b: StellarBalance) => b.asset_type === "native")?.balance || "0";
		const usdc = data.balances?.find((b: StellarBalance) => b.asset_code === "USDC")?.balance || "0";

		return { xlm, usdc, wallet: PLATFORM_WALLET };
	} catch {
		return { xlm: "0", usdc: "0", wallet: PLATFORM_WALLET };
	}
}
