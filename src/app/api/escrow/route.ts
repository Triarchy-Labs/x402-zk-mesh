import { NextResponse } from "next/server";
import { initStore } from "@/lib/guild-store";
import { verifyEscrowFunding, getEscrowStatus, getPlatformBalance } from "@/lib/escrow";

export const dynamic = "force-dynamic";

/**
 * GET /api/escrow?task_id=Q-1049 — Check escrow status for a task
 * GET /api/escrow?wallet=true — Check platform wallet balance
 */
export async function GET(req: Request) {
	await initStore();

	const url = new URL(req.url);
	const taskId = url.searchParams.get("task_id");
	const wallet = url.searchParams.get("wallet");

	if (wallet === "true") {
		const balance = await getPlatformBalance();
		return NextResponse.json({
			platform_wallet: balance,
			description: "Platform escrow wallet balance on Stellar Testnet",
		});
	}

	if (!taskId) {
		return NextResponse.json({ error: "task_id query parameter required" }, { status: 400 });
	}

	const status = getEscrowStatus(taskId);
	if (!status) {
		return NextResponse.json({ error: "Task not found" }, { status: 404 });
	}

	return NextResponse.json({
		escrow: status,
		instructions: status.escrow_status === "unfunded"
			? `Fund escrow: POST /api/escrow { task_id: "${taskId}", tx_hash: "your_stellar_tx_hash" }`
			: null,
	});
}

/**
 * POST /api/escrow — Fund a task's escrow
 * Body: { task_id: string, tx_hash: string }
 *
 * The tx_hash should be a Stellar transaction that sent USDC to the platform wallet
 * with the task_id as the memo.
 */
export async function POST(req: Request) {
	await initStore();

	try {
		const body = await req.json();
		const { task_id, tx_hash } = body;

		if (!task_id || !tx_hash) {
			return NextResponse.json({ error: "task_id and tx_hash are required" }, { status: 400 });
		}

		const result = await verifyEscrowFunding(task_id, tx_hash);

		if (result.success) {
			return NextResponse.json({
				status: "funded",
				escrow: result,
				message: "Escrow verified and funded. Task is now ready for claims.",
			});
		}

		return NextResponse.json({
			status: "failed",
			error: result.error,
		}, { status: 400 });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : "Escrow funding failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
