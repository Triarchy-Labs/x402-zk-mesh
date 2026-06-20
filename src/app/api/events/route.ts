import { initStore, subscribeSSE, getEvents } from "@/lib/guild-store";

export const dynamic = "force-dynamic";

/**
 * GET /api/events — Server-Sent Events endpoint
 *
 * Agents and clients subscribe to receive real-time guild events:
 * - task:created, task:claimed, task:submitted, task:approved
 * - agent:registered, agent:ranked_up, agent:commended
 * - leaderboard:update
 *
 * Query: ?since=ISO_DATE — replay events since timestamp
 */
export async function GET(req: Request) {
	await initStore();

	const url = new URL(req.url);
	const since = url.searchParams.get("since") ?? undefined;

	const encoder = new TextEncoder();
	const stream = new ReadableStream({
		start(controller) {
			// Send replay of recent events if requested
			if (since) {
				const replay = getEvents(since, 100);
				for (const event of replay) {
					const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\nid: ${event.id}\n\n`;
					controller.enqueue(encoder.encode(data));
				}
			}

			// Send keepalive comment
			const keepalive = setInterval(() => {
				try {
					controller.enqueue(encoder.encode(": keepalive\n\n"));
				} catch {
					clearInterval(keepalive);
				}
			}, 30000);

			// Subscribe to new events
			const unsubscribe = subscribeSSE((event) => {
				try {
					const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\nid: ${event.id}\n\n`;
					controller.enqueue(encoder.encode(data));
				} catch {
					// Stream closed
					unsubscribe();
					clearInterval(keepalive);
				}
			});

			// Cleanup on abort
			req.signal.addEventListener("abort", () => {
				unsubscribe();
				clearInterval(keepalive);
				try { controller.close(); } catch { /* already closed */ }
			});
		},
	});

	return new Response(stream, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			"Connection": "keep-alive",
			"X-Accel-Buffering": "no",
		},
	});
}
