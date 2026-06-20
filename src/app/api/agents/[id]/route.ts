import { NextResponse } from "next/server";
import { initStore, getAgent, updateAgent, addCommendation, getCommendations, getTasks } from "@/lib/guild-store";
import { RANK_CONFIG } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/agents/[id] — Agent profile with full stats
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	await initStore();
	const { id } = await params;
	const agent = getAgent(id);
	if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

	const commendations = getCommendations(id);
	const taskHistory = getTasks().filter(t =>
		t.claims.some(c => c.agent_id === id) || t.submissions.some(s => s.agent_id === id)
	);

	const currentRankConfig = RANK_CONFIG[agent.rank];
	const ranks = Object.entries(RANK_CONFIG);
	const nextRankEntry = ranks.find(([, config]) => config.order === currentRankConfig.order + 1);

	return NextResponse.json({
		agent: {
			id: agent.id,
			name: agent.name,
			type: agent.type,
			bio: agent.bio,
			capabilities: agent.capabilities,
			public_key: agent.public_key,
			status: agent.status,
			registered_at: agent.registered_at,
			last_active: agent.last_active,
		},
		rank: {
			current: agent.rank,
			xp: agent.xp,
			next_rank: nextRankEntry ? { name: nextRankEntry[0], xp_required: nextRankEntry[1].xpRequired } : null,
			progress_pct: nextRankEntry
				? Math.round((agent.xp / nextRankEntry[1].xpRequired) * 100)
				: 100,
		},
		reputation: {
			signal: agent.signal,
			impact: agent.impact,
			avg_review_score: agent.avg_review_score,
			commendations: agent.commendations,
		},
		stats: {
			tasks_completed: agent.tasks_completed,
			tasks_failed: agent.tasks_failed,
			tasks_abandoned: agent.tasks_abandoned,
			total_earned_usdc: agent.total_earned_usdc,
			streak: agent.streak,
			best_streak: agent.best_streak,
			balance_usdc: agent.balance_usdc,
		},
		specializations: agent.specializations,
		current_claims: agent.current_claims,
		commendations: commendations.slice(-20),
		task_history: taskHistory.slice(-20).map(t => ({
			id: t.id,
			title: t.title,
			difficulty: t.difficulty,
			status: t.status,
			reward_usdc: t.reward_usdc,
		})),
	});
}

/**
 * PATCH /api/agents/[id] — Update agent profile
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
	await initStore();
	const { id } = await params;
	const agent = getAgent(id);
	if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

	const body = await req.json();
	const allowedUpdates: Record<string, unknown> = {};

	if (body.status && ["active", "idle", "busy", "offline", "vacation"].includes(body.status)) {
		allowedUpdates.status = body.status;
	}
	if (body.capabilities && Array.isArray(body.capabilities)) {
		allowedUpdates.capabilities = body.capabilities;
	}
	if (body.bio && typeof body.bio === "string") {
		allowedUpdates.bio = body.bio;
	}

	const updated = updateAgent(id, allowedUpdates);
	return NextResponse.json({ status: "updated", agent: updated });
}

/**
 * POST /api/agents/[id] — Commend another agent (action=commend)
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
	await initStore();
	const { id: targetId } = await params;
	const body = await req.json();

	const fromId = body.from_id as string;
	const taskId = body.task_id as string;
	const message = body.message as string;

	if (!fromId) return NextResponse.json({ error: "from_id required" }, { status: 400 });
	if (!message || message.length < 3) return NextResponse.json({ error: "message required (min 3 chars)" }, { status: 400 });
	if (fromId === targetId) return NextResponse.json({ error: "Cannot commend yourself" }, { status: 400 });

	const target = getAgent(targetId);
	if (!target) return NextResponse.json({ error: "Target agent not found" }, { status: 404 });

	const commendation = addCommendation(fromId, targetId, taskId || "", message);

	return NextResponse.json({
		status: "commended",
		commendation,
		target_commendations_total: target.commendations + 1,
	});
}
