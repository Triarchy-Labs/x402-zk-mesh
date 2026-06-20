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

import { validateSorobanPayment } from "./soroban";
import { getTask, updateTask, getAgent, updateAgent } from "./guild-store";

const HORIZON_TESTNET_URL = "https://horizon-testnet.stellar.org";
const PLATFORM_WALLET = process.env.STELLAR_PLATFORM_WALLET || "GPLATFORM_WALLET_DEFAULT";

export interface EscrowResult {
	success: boolean;
	escrow_status: "funded" | "released" | "refunded" | "failed";
	tx_hash?: string;
	error?: string;
	amount_usdc?: number;
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

	// If agent has a Stellar public key, attempt real payout
	if (agent.public_key) {
		// In production: build and submit a Stellar transaction
		// For now: log the intent and track internally
		const payoutRecord = {
			type: "escrow_release",
			task_id: taskId,
			agent_id: agentId,
			agent_wallet: agent.public_key,
			platform_wallet: PLATFORM_WALLET,
			gross_amount: task.reward_usdc,
			platform_fee: platformFee,
			net_payout: agentPayout,
			timestamp: new Date().toISOString(),
			// This would be the real tx hash after submitting to Stellar
			payout_tx_hash: `pending_${taskId}_${Date.now()}`,
		};

		console.log("[ESCROW] Release intent:", JSON.stringify(payoutRecord));
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
