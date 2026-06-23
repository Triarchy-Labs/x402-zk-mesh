import { NextResponse } from "next/server";
import { initStore, getTask, updateTask, deleteTask } from "@/lib/guild-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/tasks/[id] — Task detail with full claims + submissions
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	await initStore();
	const { id } = await params;
	const task = getTask(id);
	if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

	// Increment views
	updateTask(id, { views: task.views + 1 });

	return NextResponse.json({
		task,
		actions: {
			claim: task.status === "OPEN" ? `POST /api/tasks/${id}/claim` : null,
			submit: ["CLAIMED", "IN_PROGRESS", "REVISION"].includes(task.status) ? `POST /api/tasks/${id}/submit` : null,
			review: task.status === "SUBMITTED" ? `POST /api/tasks/${id}/review` : null,
			sos: ["CLAIMED", "IN_PROGRESS"].includes(task.status) ? `POST /api/tasks/${id}/sos` : null,
			release: ["CLAIMED", "IN_PROGRESS"].includes(task.status) ? `POST /api/tasks/${id}/release` : null,
		},
	});
}

/**
 * DELETE /api/tasks/[id] — Cancel task (issuer only, must be OPEN)
 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
	await initStore();
	const { id } = await params;
	const task = getTask(id);
	if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
	if (task.status !== "OPEN") {
		return NextResponse.json({ error: "Can only cancel OPEN tasks" }, { status: 400 });
	}

	deleteTask(id);
	return NextResponse.json({ status: "cancelled", id });
}
