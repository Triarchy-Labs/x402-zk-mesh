import { NextResponse } from "next/server";
import { initStore, getAgents, getGuildStats } from "@/lib/guild-store";
import { RANK_CONFIG } from "@/lib/types";
import type { Agent } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/leaderboard — Guild leaderboard
 *
 * Query params:
 *   ?type=bot|human — filter by agent type
 *   ?period=week|month|all — time period (all = default)
 *   ?sort=xp|signal|impact|earned|streak — sort field (xp = default)
 *   ?limit=N — max results (default 50)
 */
export async function GET(req: Request) {
	await initStore();

	const url = new URL(req.url);
	const type = url.searchParams.get("type") ?? undefined;
	const sort = url.searchParams.get("sort") ?? "xp";
	const limit = Math.min(100, parseInt(url.searchParams.get("limit") ?? "50", 10));

	const agents = getAgents({ type });
	const stats = getGuildStats();

	// Sort
	const sortFn = (a: Agent, b: Agent): number => {
		switch (sort) {
			case "signal": return b.signal - a.signal;
			case "impact": return b.impact - a.impact;
			case "earned": return b.total_earned_usdc - a.total_earned_usdc;
			case "streak": return b.streak - a.streak;
			case "completed": return b.tasks_completed - a.tasks_completed;
			default: return b.xp - a.xp;
		}
	};

	const sorted = agents
		.filter(a => a.tasks_completed > 0 || a.xp > 0)
		.sort(sortFn)
		.slice(0, limit);

	return NextResponse.json({
		guild: "X402 ZK Mesh — Agent Guild",
		stats,
		leaderboard: sorted.map((a, i) => ({
			position: i + 1,
			id: a.id,
			name: a.name,
			type: a.type,
			rank: a.rank,
			rank_order: RANK_CONFIG[a.rank].order,
			xp: a.xp,
			signal: a.signal,
			impact: a.impact,
			tasks_completed: a.tasks_completed,
			total_earned_usdc: a.total_earned_usdc,
			streak: a.streak,
			best_streak: a.best_streak,
			specializations: a.specializations,
			commendations: a.commendations,
			status: a.status,
		})),
		ranking_info: {
			sort_by: sort,
			total_eligible: sorted.length,
			ranks: Object.entries(RANK_CONFIG).map(([name, config]) => ({
				name,
				xp_required: config.xpRequired,
				task_access: config.taskAccess,
			})),
		},
	});
}
