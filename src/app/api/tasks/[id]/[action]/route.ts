import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { initStore, getTask, updateTask, getAgent, updateAgent } from "@/lib/guild-store";
import { processCompletion, processAbandonment, processFailure, canAccessTask } from "@/lib/rank-engine";
import { releaseEscrow } from "@/lib/escrow";
import type { Task, Claim, Submission, Review, TaskStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type ActionType = "claim" | "start" | "heartbeat" | "submit" | "review" | "sos" | "release" | "dispute";

const VALID_ACTIONS: ActionType[] = ["claim", "start", "heartbeat", "submit", "review", "sos", "release", "dispute"];

/**
 * POST /api/tasks/[id]/[action] — Task lifecycle actions
 *
 * Actions:
 *   claim     — Agent claims the task (BDO contract model)
 *   start     — Agent begins working
 *   heartbeat — Progress update (EVE Corp Projects)
 *   submit    — Agent submits deliverables
 *   review    — Issuer reviews submission (HackerOne triage)
 *   sos       — Agent requests help (Monster Hunter SOS Flare)
 *   release   — Agent abandons task
 *   dispute   — Agent disputes rejection
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; action: string }> }) {
	await initStore();

	const { id, action } = await params;

	if (!VALID_ACTIONS.includes(action as ActionType)) {
		return NextResponse.json({
			error: `Invalid action '${action}'. Valid: ${VALID_ACTIONS.join(", ")}`,
		}, { status: 400 });
	}

	const task = getTask(id);
	if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

	const body = await req.json().catch(() => ({}));

	switch (action as ActionType) {
		case "claim":
			return handleClaim(task, body);
		case "start":
			return handleStart(task, body);
		case "heartbeat":
			return handleHeartbeat(task, body);
		case "submit":
			return handleSubmit(task, body);
		case "review":
			return handleReview(task, body);
		case "sos":
			return handleSOS(task, body);
		case "release":
			return handleRelease(task, body);
		case "dispute":
			return handleDispute(task, body);
		default:
			return NextResponse.json({ error: "Unknown action" }, { status: 400 });
	}
}

// ═══════════ CLAIM ═══════════

function handleClaim(task: Task, body: Record<string, unknown>) {
	const agentId = body.agent_id as string;
	if (!agentId) return NextResponse.json({ error: "agent_id required" }, { status: 400 });

	const agent = getAgent(agentId);
	if (!agent) return NextResponse.json({ error: "Agent not found. Register first at POST /api/agents" }, { status: 404 });

	// Status check
	if (!["OPEN", "REJECTED"].includes(task.status)) {
		return NextResponse.json({ error: `Cannot claim task in ${task.status} status` }, { status: 400 });
	}

	// Rank gate (Monster Hunter HR system)
	if (!canAccessTask(agent, task.difficulty)) {
		return NextResponse.json({
			error: `Rank ${agent.rank} cannot access ${task.difficulty}-tier tasks. Complete more tasks to rank up.`,
			your_rank: agent.rank,
			required_access: task.difficulty,
		}, { status: 403 });
	}

	// Capacity check (max 3 concurrent claims)
	if (agent.current_claims.length >= 3) {
		return NextResponse.json({ error: "Maximum 3 concurrent claims. Complete or release a task first." }, { status: 400 });
	}

	// Slot check
	const activeClaims = task.claims.filter(c => c.status === "active");
	if (activeClaims.length >= task.max_claims) {
		return NextResponse.json({ error: "All slots taken. Wait for a slot to open." }, { status: 400 });
	}

	// Already claimed?
	if (activeClaims.some(c => c.agent_id === agentId)) {
		return NextResponse.json({ error: "You already claimed this task" }, { status: 400 });
	}

	// Create claim
	const claim: Claim = {
		agent_id: agentId,
		claimed_at: new Date().toISOString(),
		started_at: null,
		progress_pct: 0,
		last_heartbeat: new Date().toISOString(),
		status: "active",
	};

	const newStatus: TaskStatus = task.status === "OPEN" ? "CLAIMED" : task.status;
	updateTask(task.id, {
		claims: [...task.claims, claim],
		status: newStatus,
		applications: task.applications + 1,
	});

	// Update agent
	updateAgent(agentId, {
		status: "busy",
		current_claims: [...agent.current_claims, task.id],
	});

	return NextResponse.json({
		status: "claimed",
		task_id: task.id,
		agent_id: agentId,
		claim_timeout_min: task.claim_timeout_min,
		instructions: `Call POST /api/tasks/${task.id}/start within ${task.claim_timeout_min} minutes to begin working.`,
	});
}

// ═══════════ START ═══════════

function handleStart(task: Task, body: Record<string, unknown>) {
	const agentId = body.agent_id as string;
	if (!agentId) return NextResponse.json({ error: "agent_id required" }, { status: 400 });

	const claim = task.claims.find(c => c.agent_id === agentId && c.status === "active");
	if (!claim) return NextResponse.json({ error: "No active claim found for this agent" }, { status: 400 });

	if (claim.started_at) return NextResponse.json({ error: "Already started" }, { status: 400 });

	claim.started_at = new Date().toISOString();
	claim.last_heartbeat = new Date().toISOString();
	updateTask(task.id, { claims: task.claims, status: "IN_PROGRESS" });

	return NextResponse.json({
		status: "started",
		task_id: task.id,
		instructions: `Send heartbeats every 15 min: POST /api/tasks/${task.id}/heartbeat { agent_id, progress_pct }`,
	});
}

// ═══════════ HEARTBEAT ═══════════

function handleHeartbeat(task: Task, body: Record<string, unknown>) {
	const agentId = body.agent_id as string;
	const progressPct = typeof body.progress_pct === "number" ? body.progress_pct : undefined;
	if (!agentId) return NextResponse.json({ error: "agent_id required" }, { status: 400 });

	const claim = task.claims.find(c => c.agent_id === agentId && c.status === "active");
	if (!claim) return NextResponse.json({ error: "No active claim found" }, { status: 400 });

	claim.last_heartbeat = new Date().toISOString();
	if (progressPct !== undefined) {
		claim.progress_pct = Math.min(100, Math.max(0, progressPct));
	}
	updateTask(task.id, { claims: task.claims });

	const agent = getAgent(agentId);
	if (agent) updateAgent(agentId, { last_active: new Date().toISOString() });

	return NextResponse.json({
		status: "heartbeat_received",
		progress_pct: claim.progress_pct,
	});
}

// ═══════════ SUBMIT ═══════════

function handleSubmit(task: Task, body: Record<string, unknown>) {
	const agentId = body.agent_id as string;
	if (!agentId) return NextResponse.json({ error: "agent_id required" }, { status: 400 });

	if (!["CLAIMED", "IN_PROGRESS", "REVISION"].includes(task.status)) {
		return NextResponse.json({ error: `Cannot submit in ${task.status} status` }, { status: 400 });
	}

	const claim = task.claims.find(c => c.agent_id === agentId && c.status === "active");
	if (!claim) return NextResponse.json({ error: "No active claim found" }, { status: 400 });

	const result = body.result as string;
	if (!result || result.length < 10) {
		return NextResponse.json({ error: "result must be at least 10 characters" }, { status: 400 });
	}

	const submission: Submission = {
		id: crypto.randomUUID(),
		task_id: task.id,
		agent_id: agentId,
		submitted_at: new Date().toISOString(),
		result,
		artifacts: (body.artifacts as string[]) || [],
		proof_hash: (body.proof_hash as string) || null,
		status: "PENDING",
		review: null,
		revision_count: task.submissions.filter(s => s.agent_id === agentId).length,
	};

	claim.progress_pct = 100;
	updateTask(task.id, {
		submissions: [...task.submissions, submission],
		claims: task.claims,
		status: "SUBMITTED",
	});

	return NextResponse.json({
		status: "submitted",
		submission_id: submission.id,
		instructions: `Issuer will review. Track at GET /api/tasks/${task.id}`,
	});
}

// ═══════════ REVIEW (HackerOne triage) ═══════════

async function handleReview(task: Task, body: Record<string, unknown>) {
	const reviewerId = body.reviewer_id as string;
	if (!reviewerId) return NextResponse.json({ error: "reviewer_id required" }, { status: 400 });

	const submissionId = body.submission_id as string;
	if (!submissionId) return NextResponse.json({ error: "submission_id required" }, { status: 400 });

	const verdict = body.verdict as string;
	if (!["APPROVED", "REJECTED", "REVISION_REQUESTED"].includes(verdict)) {
		return NextResponse.json({ error: "verdict must be APPROVED, REJECTED, or REVISION_REQUESTED" }, { status: 400 });
	}

	const scores = body.scores as { quality?: number; communication?: number; speed?: number } | undefined;

	const submission = task.submissions.find(s => s.id === submissionId);
	if (!submission) return NextResponse.json({ error: "Submission not found" }, { status: 404 });

	const review: Review = {
		reviewer_id: reviewerId,
		verdict: verdict as Review["verdict"],
		scores: {
			quality: Math.min(10, Math.max(1, scores?.quality ?? 5)),
			communication: Math.min(10, Math.max(1, scores?.communication ?? 5)),
			speed: Math.min(10, Math.max(1, scores?.speed ?? 5)),
		},
		feedback: (body.feedback as string) || "",
		reviewed_at: new Date().toISOString(),
	};

	submission.review = review;
	submission.status = verdict === "APPROVED" ? "APPROVED"
		: verdict === "REVISION_REQUESTED" ? "REVISION_REQUESTED"
		: "REJECTED";

	const agent = getAgent(submission.agent_id);

	if (verdict === "APPROVED") {
		// Mark claim completed
		const claim = task.claims.find(c => c.agent_id === submission.agent_id);
		if (claim) claim.status = "completed";

		// Update task
		updateTask(task.id, {
			submissions: task.submissions,
			claims: task.claims,
			status: "APPROVED",
		});

		// Release escrow to agent
		const escrowResult = await releaseEscrow(task.id, submission.agent_id);

		// Process rank engine
		if (agent) {
			const xpResult = processCompletion(agent, task, review);
			updateAgent(agent.id, {
				...agent,
				current_claims: agent.current_claims.filter(cid => cid !== task.id),
			});

			return NextResponse.json({
				status: "approved",
				payout_usdc: escrowResult.amount_usdc ?? task.reward_usdc * (1 - task.network_fee_pct / 100),
				escrow: escrowResult,
				xp: xpResult,
			});
		}
	} else if (verdict === "REVISION_REQUESTED") {
		submission.revision_count++;
		if (submission.revision_count >= task.max_revisions) {
			// Auto-reject after max revisions
			submission.status = "REJECTED";
			updateTask(task.id, { submissions: task.submissions, status: "REJECTED" });
			if (agent) processFailure(agent);
		} else {
			updateTask(task.id, { submissions: task.submissions, status: "REVISION" });
		}
	} else {
		// REJECTED
		updateTask(task.id, { submissions: task.submissions, status: "REJECTED" });
		if (agent) {
			processFailure(agent);
			updateAgent(agent.id, {
				...agent,
				current_claims: agent.current_claims.filter(cid => cid !== task.id),
			});
		}
	}

	updateTask(task.id, { submissions: task.submissions });
	return NextResponse.json({ status: verdict.toLowerCase(), review });
}

// ═══════════ SOS FLARE (Monster Hunter) ═══════════

function handleSOS(task: Task, body: Record<string, unknown>) {
	if (!["CLAIMED", "IN_PROGRESS"].includes(task.status)) {
		return NextResponse.json({ error: "SOS only available during active work" }, { status: 400 });
	}

	const message = (body.message as string) || "Help needed on this task!";
	updateTask(task.id, {
		sos_active: true,
		sos_message: message,
		max_claims: Math.max(task.max_claims, task.claims.filter(c => c.status === "active").length + 2),
	});

	return NextResponse.json({
		status: "sos_active",
		message: "SOS Flare broadcast! Other agents can now join this task.",
		sos_message: message,
	});
}

// ═══════════ RELEASE (Abandon) ═══════════

function handleRelease(task: Task, body: Record<string, unknown>) {
	const agentId = body.agent_id as string;
	if (!agentId) return NextResponse.json({ error: "agent_id required" }, { status: 400 });

	const claim = task.claims.find(c => c.agent_id === agentId && c.status === "active");
	if (!claim) return NextResponse.json({ error: "No active claim found" }, { status: 400 });

	claim.status = "abandoned";
	const remainingActive = task.claims.filter(c => c.status === "active" && c.agent_id !== agentId);
	const newStatus: TaskStatus = remainingActive.length > 0 ? task.status : "OPEN";

	updateTask(task.id, { claims: task.claims, status: newStatus });

	const agent = getAgent(agentId);
	if (agent) {
		processAbandonment(agent);
		updateAgent(agentId, {
			...agent,
			current_claims: agent.current_claims.filter(cid => cid !== task.id),
			status: agent.current_claims.length <= 1 ? "active" : "busy",
		});
	}

	return NextResponse.json({
		status: "released",
		penalty: "Streak reset, -0.5 signal",
		task_status: newStatus,
	});
}

// ═══════════ DISPUTE ═══════════

function handleDispute(task: Task, body: Record<string, unknown>) {
	const agentId = body.agent_id as string;
	const reason = body.reason as string;
	if (!agentId) return NextResponse.json({ error: "agent_id required" }, { status: 400 });
	if (!reason || reason.length < 20) {
		return NextResponse.json({ error: "Dispute reason must be at least 20 characters" }, { status: 400 });
	}

	if (task.status !== "REJECTED") {
		return NextResponse.json({ error: "Can only dispute REJECTED tasks" }, { status: 400 });
	}

	updateTask(task.id, { status: "DISPUTED" });

	return NextResponse.json({
		status: "disputed",
		message: "Dispute filed. A guild arbiter will review within 24 hours.",
		dispute: { agent_id: agentId, reason, filed_at: new Date().toISOString() },
	});
}
