import { NextResponse } from "next/server";
import { initStore, getTasks, createTask, getGuildStats } from "@/lib/guild-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/tasks — List tasks with filters
 * Query: ?status=OPEN&skill=Rust&difficulty=A&category=audit&sos=true
 */
export async function GET(req: Request) {
	await initStore();

	const url = new URL(req.url);
	const filters = {
		status: url.searchParams.get("status") ?? undefined,
		skill: url.searchParams.get("skill") ?? undefined,
		difficulty: url.searchParams.get("difficulty") ?? undefined,
		category: url.searchParams.get("category") ?? undefined,
		issuer_id: url.searchParams.get("issuer_id") ?? undefined,
		sos: url.searchParams.get("sos") === "true" ? true : undefined,
	};

	const tasks = getTasks(filters);
	const stats = getGuildStats();

	return NextResponse.json({
		guild: "X402 ZK Mesh — Agent Guild",
		stats: {
			total: stats.total_tasks_created,
			active: stats.active_tasks,
			completed: stats.total_tasks_completed,
			total_paid_usdc: stats.total_usdc_paid,
		},
		tasks: tasks.map(t => ({
			id: t.id,
			title: t.title,
			description: t.description.slice(0, 200) + (t.description.length > 200 ? "..." : ""),
			difficulty: t.difficulty,
			category: t.category,
			skills: t.skills,
			reward_usdc: t.reward_usdc,
			status: t.status,
			escrow_status: t.escrow_status,
			deadline: t.deadline,
			claims_count: t.claims.filter(c => c.status === "active").length,
			max_claims: t.max_claims,
			submissions_count: t.submissions.length,
			is_shielded: t.is_shielded,
			sos_active: t.sos_active,
			created_at: t.created_at,
			issuer_id: t.issuer_id,
		})),
	});
}

/**
 * POST /api/tasks — Create a new task (bounty)
 */
export async function POST(req: Request) {
	await initStore();

	try {
		const body = await req.json();

		if (!body.title || typeof body.title !== "string" || body.title.length < 5) {
			return NextResponse.json({ error: "Title must be at least 5 characters" }, { status: 400 });
		}
		if (!body.description || body.description.length < 20) {
			return NextResponse.json({ error: "Description must be at least 20 characters" }, { status: 400 });
		}
		if (!body.issuer_id) {
			return NextResponse.json({ error: "issuer_id is required" }, { status: 400 });
		}

		const task = createTask({
			title: body.title,
			description: body.description,
			issuer_id: body.issuer_id,
			requirements: body.requirements,
			acceptance_criteria: body.acceptance_criteria,
			hints: body.hints,
			skills: body.skills,
			difficulty: body.difficulty,
			category: body.category,
			tags: body.tags,
			reward_usdc: body.reward_usdc,
			deadline: body.deadline,
			claim_timeout_min: body.claim_timeout_min,
			max_claims: body.max_claims,
			max_revisions: body.max_revisions,
			is_shielded: body.is_shielded,
			network_fee_pct: body.network_fee_pct,
		});

		return NextResponse.json({
			status: "created",
			task,
			instructions: {
				claim: `POST /api/tasks/${task.id}/claim`,
				view: `GET /api/tasks/${task.id}`,
				events: "GET /api/events (SSE)",
			},
		}, { status: 201 });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : "Failed to create task";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
