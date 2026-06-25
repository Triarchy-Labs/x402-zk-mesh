/* eslint-disable */

import * as fs from "node:fs";
import { NextResponse } from "next/server";
import { AgentRegistry } from "@/lib/agent_registry";
import {
	buildTaskReceipt,
	type DelegationReceipt,
	type MeshRouteCandidate,
	type PaymentReceipt,
	type ZkReceipt,
} from "@/lib/agent-receipt";
import { recordDemoTraceFromHireResponse, type HireTraceResponse } from "@/lib/demo-trace";
import { isApprovedGuildRoot } from "@/lib/guild-registry";
import { buildSettlementArtifact } from "@/lib/soroban-guild-registry";
import { submitGuildSettlement } from "@/lib/stellar-guild-relayer";
import { StellarTransactor, TransactorContext } from "@/lib/stellar-transactor";
import { replayGuard } from "@/lib/replay-guard";
import { spendingPolicy } from "@/lib/spending-policy";
import { isAllowedUrl } from "@/lib/security";

// Configuration: Environment-driven routing parameters
const LOCAL_EXECUTION_HOOK = process.env.LOCAL_EXECUTION_HOOK;
const ARBITRAGE_FEE_PCT = parseFloat(process.env.DYNAMIC_ROUTING_FEE || "0.00");
const ENTERPRISE_THRESHOLD = parseFloat(
	process.env.ENTERPRISE_THRESHOLD || "5.00",
);
const DEFAULT_P2P_WORKER_URL = "http://127.0.0.1:3001/api/hire";
const P2P_WORKER_URL = process.env.P2P_WORKER_URL || DEFAULT_P2P_WORKER_URL;

export const runtime = "nodejs";

function isWorkerUrlAllowed(url: string): boolean {
	try {
		const parsed = new URL(url);
		if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
			return true;
		}
		return isAllowedUrl(url);
	} catch {
		return false;
	}
}

function getWorkerMembershipProofUrl(workerUrl: string): string {
	const parsed = new URL(workerUrl);
	parsed.pathname = "/api/membership-proof";
	parsed.search = "";
	return parsed.toString();
}

function getWorkerHealthUrl(workerUrl: string): string {
	const parsed = new URL(workerUrl);
	if (parsed.pathname.endsWith("/api/hire")) {
		parsed.pathname = parsed.pathname.slice(0, -"/api/hire".length) + "/health";
	} else {
		parsed.pathname = "/health";
	}
	parsed.search = "";
	return parsed.toString();
}

function getP2PWorkerUrls(): string[] {
	const configured = process.env.P2P_WORKER_URLS || P2P_WORKER_URL;
	const urls = configured
		.split(/[,\s]+/)
		.map((url) => url.trim())
		.filter(Boolean);
	return Array.from(new Set(urls.length > 0 ? urls : [DEFAULT_P2P_WORKER_URL]));
}

function requiredCapabilityForTask(description: string): string | null {
	const text = description.toLowerCase();
	if (text.includes("soroban") || text.includes("stellar")) {
		return "soroban-review";
	}
	if (text.includes("security") || text.includes("audit") || text.includes("vulnerab")) {
		return "security-scan";
	}
	if (text.includes("code") || text.includes("review") || text.includes("refactor")) {
		return "code-audit";
	}
	if (text.includes("llm") || text.includes("summary")) {
		return "llm-execution";
	}
	return null;
}

function tamperFieldSignal(value: unknown): string {
	try {
		const bn254Prime = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
		return ((BigInt(String(value || "0")) + BigInt(1)) % bn254Prime).toString();
	} catch {
		return "1";
	}
}

async function persistDemoTrace(payload: HireTraceResponse) {
	try {
		await recordDemoTraceFromHireResponse(payload);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.warn(`[DEMO_TRACE] Failed to persist hire trace: ${message}`);
	}
}

async function probeWorkerCandidate(
	workerUrl: string,
	requestedCapability: string | null,
): Promise<MeshRouteCandidate> {
	const startedAt = Date.now();
	if (!isWorkerUrlAllowed(workerUrl)) {
		return {
			url: workerUrl,
			status: "blocked_by_url_policy",
			capabilityMatch: false,
			latencyMs: null,
			reason: "Worker URL blocked by gateway URL policy.",
		};
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 1500);
	try {
		const response = await fetch(getWorkerHealthUrl(workerUrl), {
			cache: "no-store",
			signal: controller.signal,
		});
		const data = await response.json().catch(() => ({}));
		const capabilities = Array.isArray(data?.capabilities)
			? data.capabilities.filter((item: unknown) => typeof item === "string")
			: [];
		const alive = response.ok && data?.status === "alive";
		const capabilityMatch = !requestedCapability || capabilities.includes(requestedCapability);

		return {
			url: workerUrl,
			status: alive ? "alive" : `health_http_${response.status}`,
			agentId: data?.agent_id || null,
			guildMember: data?.guild_member ?? null,
			capabilities,
			capabilityMatch,
			latencyMs: Date.now() - startedAt,
			reason: alive
				? capabilityMatch
					? "eligible"
					: `missing capability ${requestedCapability}`
				: "worker health check failed",
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			url: workerUrl,
			status: "offline",
			capabilityMatch: false,
			latencyMs: Date.now() - startedAt,
			reason: message,
		};
	} finally {
		clearTimeout(timeout);
	}
}

function selectWorkerCandidate(candidates: MeshRouteCandidate[]): MeshRouteCandidate | null {
	const eligible = candidates
		.filter((candidate) => candidate.status === "alive" && candidate.capabilityMatch !== false)
		.sort((a, b) => {
			const guildRank = Number(b.guildMember === true) - Number(a.guildMember === true);
			if (guildRank !== 0) {
				return guildRank;
			}
			return (a.latencyMs ?? Number.MAX_SAFE_INTEGER) - (b.latencyMs ?? Number.MAX_SAFE_INTEGER);
		});
	return eligible[0] || null;
}

async function verifyWorkerMembershipGate(
	workerUrl: string,
	ctx: TransactorContext,
	options: { tamperPublicRoot?: boolean; proofProfile?: "unapproved-root" } = {},
): Promise<{
	ok: boolean;
	status: string;
	zk: ZkReceipt;
	agentId?: string | null;
	error?: string;
}> {
	const proofUrl = getWorkerMembershipProofUrl(workerUrl);
	const resp = await fetch(proofUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			task_id: ctx.taskId,
			client_id: ctx.clientId,
			payment_tx_hash: ctx.txHash,
			proof_profile: options.proofProfile || "approved-root",
		}),
	});

	if (!resp.ok) {
		let error = `Worker membership proof endpoint returned HTTP ${resp.status}.`;
		try {
			const data = await resp.json();
			error = data?.error || error;
		} catch (_e) {}

		return {
			ok: false,
			status: `membership_proof_http_${resp.status}`,
			error,
			zk: {
				required: true,
				verified: false,
				proofValid: false,
				context: "worker_membership_gate",
				circuit: "membership_proof",
				approvedRoot: false,
			},
		};
	}

	const data = await resp.json();
	if (!data?.proof || !Array.isArray(data?.publicSignals)) {
		return {
			ok: false,
			status: "membership_proof_malformed",
			agentId: data?.agent_id || null,
			error: "Worker returned a malformed membership proof payload.",
			zk: {
				required: true,
				verified: false,
				proofValid: false,
				context: "worker_membership_gate",
				circuit: "membership_proof",
				approvedRoot: false,
			},
		};
	}

	const publicSignals = data.publicSignals.map((signal: unknown) => String(signal));
	if (options.tamperPublicRoot) {
		publicSignals[0] = tamperFieldSignal(publicSignals[0]);
	}

	const { verifyProof } = await import("@/lib/zk-verifier");
	const result = await verifyProof("membership_proof", data.proof, publicSignals);
	const root = publicSignals[0] || null;
	const approvedRoot = !!root && isApprovedGuildRoot(root);
	const verified = result.valid && approvedRoot;

	return {
		ok: verified,
		status: verified
			? "membership_proof_verified"
			: result.valid
				? "membership_root_not_approved"
				: "membership_proof_invalid",
		agentId: data.agent_id || null,
		error: verified
			? undefined
			: result.valid
				? "Membership proof is valid, but its root was not issued by this gateway registry."
				: "Worker membership proof failed Groth16 verification.",
		zk: {
			required: true,
			verified,
			proofValid: result.valid,
			context: "worker_membership_gate",
			circuit: "membership_proof",
			method: result.method,
			contractId: result.contractId || null,
			txHash: result.txHash || null,
			explorer: (result as any).explorer || null,
			root,
			approvedRoot,
		},
	};
}

export async function POST(req: Request) {
	try {
		// 1. Validate x402 (Payment Required) & L402 Subscription Hooks
		const authHeader = req.headers.get("authorization") || req.headers.get("x-l402-txhash");
		let txHash = req.headers.get("x-l402-txhash") || "";
		const l402Mode = req.headers.get("x-l402-mode");
		const demoScenarioHeader = req.headers.get("x-zk-mesh-demo-scenario");
		if (
			demoScenarioHeader &&
			demoScenarioHeader !== "tampered-worker-proof" &&
			demoScenarioHeader !== "unapproved-worker-root"
		) {
			return NextResponse.json(
				{ error: "Unsupported demo scenario." },
				{ status: 400 },
			);
		}
		const tamperWorkerMembershipProof = demoScenarioHeader === "tampered-worker-proof";
		const requestUnapprovedWorkerRoot = demoScenarioHeader === "unapproved-worker-root";

		if (!txHash && authHeader && authHeader.startsWith("L402 ")) {
			txHash = authHeader.split(" ")[1];
		}

		if (!txHash) {
			if (l402Mode === "subscription") {
				return NextResponse.json(
					{ error: "Subscription Payment Required. Please provide valid recurring txhash via L402." },
					{ status: 402, headers: { "WWW-Authenticate": 'L402 invoice="soroban_subscription_required"' } }
				);
			}
		}

		let body: any = {};
		try { body = await req.json(); } catch(e) {}

		const ctx: TransactorContext = {
			txHash,
			bountyUsdc: body.bounty_usdc !== undefined ? parseFloat(body.bounty_usdc) : -1,
			description: body.description || "",
			clientId: body.client_id || "",
			taskId: body.task_id || ""
		};

		const isShielded = !!body.is_shielded;
		if (!txHash) {
			return NextResponse.json(
				{
					error: "Payment Required. Provide a Stellar Testnet tx hash via x-l402-txhash or Authorization: L402.",
					required: {
						payment: "stellar_testnet_tx_hash",
						zkProof: isShielded,
					},
				},
				{
					status: 402,
					headers: { "WWW-Authenticate": 'L402 invoice="stellar_payment_required"' },
				}
			);
		}

		let zkReceipt: ZkReceipt = {
			required: isShielded,
			verified: false,
		};

		// --- PIPELINE STAGE 1: ZK & PREFLIGHT ---
		if (isShielded) {
			// ZK Shielded Mode: Verify a real Groth16 proof from the client
			const zkProof = body.zk_proof;
			const zkPublicSignals = body.zk_public_signals;
			const zkCircuit = body.zk_circuit || "deposit_commitment";

			if (!zkProof || !zkPublicSignals) {
				return NextResponse.json(
					{ error: "Shielded mode requires zk_proof and zk_public_signals in request body." },
					{
						status: 403,
						headers: { "WWW-Authenticate": 'L402 invoice="soroban_zkp_required"' },
					}
				);
			}

			// Verify the Groth16 proof using snarkjs verification keys
			try {
				const { verifyProof } = await import("@/lib/zk-verifier");
				const result = await verifyProof(zkCircuit, zkProof, zkPublicSignals);

				if (!result.valid) {
					return NextResponse.json(
						{ error: "ZK Proof verification FAILED. Invalid Groth16 proof." },
						{ status: 403 }
					);
				}

				zkReceipt = {
					required: true,
					verified: true,
					context: "client_shielded_request",
					circuit: zkCircuit,
					method: result.method,
					contractId: result.contractId || null,
					txHash: result.txHash || null,
					explorer: (result as any).explorer || null,
				};

				console.log(`[ZK_POOL] ✅ Groth16 proof VERIFIED (${result.method}) for task: ${ctx.taskId} | circuit: ${zkCircuit}`);
			} catch (zkError) {
				console.error("[ZK_POOL] Verification error:", zkError);
				return NextResponse.json(
					{ error: "ZK verification engine error", details: zkError instanceof Error ? zkError.message : "Unknown" },
					{ status: 500 }
				);
			}
		} else {
			// Standard public execution mode
			const preflight = StellarTransactor.preflight(ctx);
			if (!preflight.valid) {
				return NextResponse.json({ error: preflight.error }, { 
					status: 402,
					headers: { "WWW-Authenticate": 'L402 invoice="soroban_payment_required"' }
				});
			}
		}

		// --- PIPELINE STAGE 1.5: REPLAY GUARD ---
		if (replayGuard.check(ctx.txHash)) {
			return NextResponse.json(
				{ error: "Payment signature or ZK Nullifier already used.", detail: "Each txHash/nullifier can only be used once." },
				{ status: 402 }
			);
		}

		// --- PIPELINE STAGE 1.6: SPENDING POLICY (Assimilated from Toll) ---
		const policyViolation = spendingPolicy.check(ctx.clientId || "anonymous", ctx.bountyUsdc);
		if (policyViolation) {
			return NextResponse.json(
				{ error: "Spending policy violation", reason: policyViolation, price: ctx.bountyUsdc },
				{ status: 429 }
			);
		}

		// --- PIPELINE STAGE 2: PRECLAIM ---
		const preclaim = await StellarTransactor.preclaim(ctx);
		if (!preclaim.valid) {
			return NextResponse.json(
				{ 
					status: "rejected", 
					executor: "Security Node",
					message: preclaim.error,
					details: preclaim.details,
					usdc_charged: 0,
					usdc_refunded: preclaim.refundedUsdc || 0
				}, 
				{ status: 403 }
			);
		}

		// Mark txHash as used AFTER successful preclaim
		replayGuard.mark(ctx.txHash);

		const price = ctx.bountyUsdc;
		const description = ctx.description;
		const client_id = ctx.clientId;
		const receiptTaskId = ctx.taskId || `${client_id || "anonymous"}:${ctx.txHash.slice(0, 12)}`;
		const paymentReceipt: PaymentReceipt = {
			scheme: isShielded ? "shielded-zk-stellar" : "stellar-l402-header",
			txHash: ctx.txHash,
			amountUsdc: price,
			amount: preclaim.amount ?? price,
			assetCode: preclaim.assetCode || "UNKNOWN",
			assetIssuer: preclaim.assetIssuer ?? null,
			clientId: client_id || "anonymous",
			taskId: receiptTaskId,
		};
		const makeReceipt = (
			delegation: DelegationReceipt,
			result?: unknown,
			zkForReceipt: ZkReceipt = zkReceipt,
		) =>
			buildTaskReceipt({
				taskId: receiptTaskId,
				description,
				bountyUsdc: price,
				clientId: client_id || "anonymous",
				payment: paymentReceipt,
				zk: zkForReceipt,
				delegation,
				result,
			});

		// --- PIPELINE STAGE 3: QUEUE CHECK ---
		const isQueueFull = StellarTransactor.checkQueueState(LOCAL_EXECUTION_HOOK);

		// 2. TIER 1: MICRO-BOUNTY (Cloud LLM Sync via OpenRouter / Local Ollama fallback)
		if (price > 0 && price < ENTERPRISE_THRESHOLD && !isQueueFull) {
			try {
				const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
				const OLLAMA_URL = process.env.OLLAMA_URL; // Only set for Mark 53 desktop

				let result: string | null = null;

				if (OPENROUTER_KEY) {
					// Production path: OpenRouter cloud API
					const orResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"Authorization": `Bearer ${OPENROUTER_KEY}`,
							"X-Title": "x402 Triarchy Gateway",
						},
						body: JSON.stringify({
							model: "anthropic/claude-3.5-sonnet",
							messages: [{ role: "user", content: `You are an AI agent fulfilling a micro-bounty via x402. Task: ${description}` }],
							max_tokens: 4096,
						}),
					});
					if (orResp.ok) {
						const orData = await orResp.json();
						result = orData.choices?.[0]?.message?.content || "No response";
					}
				} else if (OLLAMA_URL) {
					// Mark 53 desktop fallback: local Ollama
					const ollamaResp = await fetch(`${OLLAMA_URL}/api/generate`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							model: "qwen3.5-9b-claude-os-instruct:latest",
							prompt: `You are an AI agent fulfilling a micro-bounty via x402. Task: ${description}`,
							stream: false,
						}),
					});
					if (ollamaResp.ok) {
						const ollamaData = await ollamaResp.json();
						result = ollamaData.response;
					}
				}

				if (result) {
					spendingPolicy.record(client_id || "micro_node_auto", price);
					AgentRegistry.updateStats(client_id || "micro_node_auto", price);
					const delegation: DelegationReceipt = {
						mode: "sync_llm",
						executor: OPENROUTER_KEY ? "OpenRouter Cloud" : "Local Micro-Node",
						workerStatus: "completed",
					};
					const receipt = makeReceipt(delegation, result);
					const responsePayload: HireTraceResponse = {
						status: "completed",
						message: `Task completed synchronously via ${OPENROUTER_KEY ? "OpenRouter" : "Local LLM"}.`,
						payment: paymentReceipt,
						zk: zkReceipt,
						delegation,
						receipt,
					};
					await persistDemoTrace(responsePayload);
					return NextResponse.json(
						{
							...responsePayload,
							executor: OPENROUTER_KEY ? "OpenRouter Cloud" : "Local Micro-Node",
							usdc_charged: price,
							result,
						},
						{ status: 200 },
					);
				}
			} catch (_e) {
				console.warn(
					"LLM endpoint unavailable, escalating to P2P network.",
				);
			}
		}

		// 3. TIER 2: ENTERPRISE ROUTER (Priority local execution for high-value tasks)
		if (price >= ENTERPRISE_THRESHOLD && LOCAL_EXECUTION_HOOK && !isQueueFull) {
			// Routes to dedicated compute node when LOCAL_EXECUTION_HOOK is configured
			const secretPayload = {
				agent: "ENTERPRISE_NODE",
				command: "x402_intercept",
				bounty_usdc: price,
				origin: client_id || "openclaw_anon",
				instruction: description,
				timestamp: new Date().toISOString(),
			};

			try {
				// Atomic append for JSON payload < PIPE_BUF (uses O_APPEND internally via fs.promises)
				// With explicit file handle and lock behavior if needed, standard push is POSIX atomic.
				const fd = fs.openSync(
					LOCAL_EXECUTION_HOOK,
					fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_APPEND,
				);
				fs.writeSync(fd, `${JSON.stringify(secretPayload)}\n`);
				fs.closeSync(fd);

				spendingPolicy.record(client_id || "enterprise_node_auto", price);
				AgentRegistry.updateStats(client_id || "enterprise_node_auto", price);
				const delegation: DelegationReceipt = {
					mode: "enterprise_local_hook",
					executor: "Enterprise Sovereign Node",
					workerStatus: "queued",
				};
				const receipt = makeReceipt(delegation, {
					queued: true,
					task_id: receiptTaskId,
				});

				const responsePayload: HireTraceResponse = {
					status: "accepted",
					message: "Task accepted for priority local execution.",
					payment: paymentReceipt,
					zk: zkReceipt,
					delegation,
					receipt,
				};
				await persistDemoTrace(responsePayload);
				return NextResponse.json(
					{
						...responsePayload,
						executor: "Enterprise Sovereign Node",
						usdc_charged: price,
						fee: 0, // Zero routing fee for enterprise-tier tasks
					},
					{ status: 202 },
				);
			} catch (_e) {
				console.error("Local hook unavailable, falling back to P2P network.");
			}
		}

		// 4. TIER 3: P2P DELEGATION (Dynamic Load Balancing)
		// Routing fee is configurable via DYNAMIC_ROUTING_FEE env var
		// Under heavy load, dynamic fee adjusts to incentivize network capacity
		const activeFeePct = isQueueFull ? 0.5 : ARBITRAGE_FEE_PCT;
		const networkFee = price * activeFeePct;
		const foreignPrice = price - networkFee;

		// Mesh worker routing: probe all configured workers, then ZK-gate the selected candidate.
		const workerUrls = getP2PWorkerUrls();
		const requestedCapability = requiredCapabilityForTask(description);
		const routingCandidates = await Promise.all(
			workerUrls.map((workerUrl) => probeWorkerCandidate(workerUrl, requestedCapability)),
		);
		const selectedCandidate = selectWorkerCandidate(routingCandidates);
		const selectedWorkerUrl = selectedCandidate?.url || null;
		const routedCandidates = routingCandidates.map((candidate) => ({
			...candidate,
			selected: candidate.url === selectedWorkerUrl,
		}));

		let externalResult = "Awaiting response...";
		let externalAgentResponse: any = null;
		let workerMembershipGate: Awaited<ReturnType<typeof verifyWorkerMembershipGate>> | null = null;
		let workerStatus = "no_eligible_worker";
		if (!selectedWorkerUrl) {
			externalResult = requestedCapability
				? `No healthy mesh worker advertised capability ${requestedCapability}.`
				: "No healthy mesh worker is available.";
			console.warn(`[P2P] No eligible worker. Candidates: ${JSON.stringify(routedCandidates)}`);
		} else {
			try {
				workerMembershipGate = await verifyWorkerMembershipGate(selectedWorkerUrl, ctx, {
					tamperPublicRoot: tamperWorkerMembershipProof,
					proofProfile: requestUnapprovedWorkerRoot ? "unapproved-root" : undefined,
				});
				if (!workerMembershipGate.ok) {
					workerStatus = workerMembershipGate.status;
					externalResult = workerMembershipGate.error || "Worker membership proof rejected.";
					externalAgentResponse = {
						agent_id: workerMembershipGate.agentId || null,
						membership_proof: workerMembershipGate.zk,
					};
				} else {
					const resp = await fetch(selectedWorkerUrl, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							task: description,
							amount: foreignPrice,
							task_id: receiptTaskId,
							client_id,
							payment_tx_hash: ctx.txHash,
							zk: workerMembershipGate.zk,
						}),
					});
					if (resp.ok) {
						const data = await resp.json();
						externalAgentResponse = data;
						externalResult = data.result || "Worker completed without a textual result.";
						workerStatus = data.status || "responded";
					} else {
						workerStatus = `http_${resp.status}`;
						externalResult = `Worker returned HTTP ${resp.status}.`;
					}
				}
			} catch (_e) {
				workerStatus = "offline";
				externalResult = "Selected mesh worker went offline during delegation.";
				console.warn(
					`Guild agent at ${selectedWorkerUrl} is offline. Run 'node guild_agent_bot.js' in a separate terminal, or set P2P_WORKER_URLS to active worker endpoints.`,
				);
			}
		}

		if (workerStatus === "success") {
			AgentRegistry.updateStats(client_id || "remote_mercenary", foreignPrice);
		}
		AgentRegistry.updateStats("gateway_router", networkFee); // The router itself keeps the fee
		const delegation: DelegationReceipt = {
			mode: "p2p_worker",
			executor: "Peer-to-Peer ZK Mesh Worker",
			workerUrl: selectedWorkerUrl || undefined,
			workerAgentId: externalAgentResponse?.agent_id || null,
			workerStatus,
			feeUsdc: networkFee,
			workerPaidUsdc: foreignPrice,
			membershipProof: workerMembershipGate?.zk,
			routing: {
				strategy: "capability_latency",
				requestedCapability,
				selectedWorkerUrl,
				candidates: routedCandidates,
			},
		};
		const p2pZkReceipt = workerMembershipGate?.zk || {
			required: true,
			verified: false,
			proofValid: false,
			context: "worker_membership_gate" as const,
			circuit: "membership_proof",
			approvedRoot: false,
		};
		const receipt = makeReceipt(delegation, {
			external_result: externalResult,
			worker_receipt: externalAgentResponse?.receipt || null,
		}, p2pZkReceipt);
		const membershipRejected = workerStatus.startsWith("membership_");
		const workerResultHash = externalAgentResponse?.receipt?.result_hash || receipt.resultHash;
		const sorobanSettlement = workerStatus === "success" && p2pZkReceipt.root && workerResultHash
			? buildSettlementArtifact({
				taskHash: receipt.taskHash,
				workerRoot: p2pZkReceipt.root,
				resultHash: workerResultHash,
				paymentHash: receipt.paymentHash,
				workerAgentId: externalAgentResponse?.agent_id || null,
			})
			: null;
		const sorobanSettlementSubmission = sorobanSettlement
			? await submitGuildSettlement(sorobanSettlement)
			: null;

		const responsePayload: HireTraceResponse = {
			status: workerStatus === "success"
				? "delegated"
				: membershipRejected
					? "worker_membership_rejected"
					: workerStatus === "no_eligible_worker" || workerStatus === "offline"
						? "worker_unavailable"
						: "queued_for_delegation",
			message: membershipRejected
				? "Task was not delegated because the worker failed the ZK membership gate."
				: workerStatus === "no_eligible_worker" || workerStatus === "offline"
					? externalResult
					: isQueueFull
					? "Network busy, routed via \u00dcber Arbitrage protocol."
					: "Task delegated to idle network nodes.",
			payment: paymentReceipt,
			client_zk: isShielded ? zkReceipt : null,
			zk: p2pZkReceipt,
			delegation,
			receipt,
			soroban_settlement: sorobanSettlement
				? {
					...sorobanSettlement,
					submission: sorobanSettlementSubmission,
				}
				: null,
			external_agent_result: externalResult,
			external_agent_receipt: externalAgentResponse?.receipt || null,
		};
		await persistDemoTrace(responsePayload);
		return NextResponse.json(
			{
				...responsePayload,
				executor: "Peer-to-Peer ZK Mesh Worker",
				usdc_charged: price,
				mercenary_paid: foreignPrice,
				network_fee: networkFee,
			},
			{ status: membershipRejected ? 403 : responsePayload.status === "worker_unavailable" ? 503 : 200 },
		);
	} catch (error: any) {
		return NextResponse.json(
			{ error: "Internal Server Error", details: error.message },
			{ status: 500 },
		);
	}
}
