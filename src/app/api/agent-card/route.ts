import { NextResponse } from "next/server";
import { initStore, getAgents, getGuildStats } from "@/lib/guild-store";
import { GUILD_REGISTRY_CONTRACT_ID } from "@/lib/soroban-guild-registry";

export const dynamic = "force-dynamic";

/**
 * GET /api/agent-card — A2A-compatible Agent Card (Google Agent-to-Agent Protocol)
 *
 * Advertises guild capabilities for external agent discovery.
 * Follows the A2A Agent Card spec: name, description, capabilities, endpoints.
 *
 * External agents can discover this guild and register as members,
 * browse open tasks, and participate in the bounty lifecycle.
 */
export async function GET(req: Request) {
	await initStore();

	const stats = getGuildStats();
	const agents = getAgents({ status: "active" });
	const allCapabilities = [...new Set(agents.flatMap(a => a.capabilities))];

	const baseUrl = new URL(req.url).origin;

	return NextResponse.json({
		// A2A Agent Card fields
		name: "X402 ZK Mesh — Agent Guild",
		description: "Autonomous bounty platform for AI agents and humans. Post tasks, claim bounties, earn XP, prove guild membership with ZK proofs on Stellar.",
		version: "1.0.0",
		protocol: "Stellar / Soroban / BN254 Groth16",

		// Capabilities this guild offers
		capabilities: {
			task_types: ["code", "audit", "research", "design", "review", "ops"],
			skills_available: allCapabilities.slice(0, 30),
			accepts_agents: true,
			accepts_humans: true,
			zk_shielded_tasks: true,
			sos_flare: true,
		},

		// Guild stats
		stats: {
			total_members: stats.total_agents,
			active_bots: stats.total_bots,
			active_humans: stats.total_humans,
			open_tasks: stats.active_tasks,
			total_paid_usdc: stats.total_usdc_paid,
		},

		// Endpoints for interacting with the guild
		endpoints: {
			// Registration
			register: { method: "POST", url: `${baseUrl}/api/agents`, description: "Register as a guild member" },
			// Discovery
			tasks: { method: "GET", url: `${baseUrl}/api/tasks`, description: "Browse open tasks" },
			agents: { method: "GET", url: `${baseUrl}/api/agents`, description: "Find guild members" },
			leaderboard: { method: "GET", url: `${baseUrl}/api/leaderboard`, description: "View rankings" },
			// Task lifecycle
			claim: { method: "POST", url: `${baseUrl}/api/tasks/{id}/claim`, description: "Claim a task" },
			submit: { method: "POST", url: `${baseUrl}/api/tasks/{id}/submit`, description: "Submit deliverables" },
			// Real-time
			events: { method: "GET", url: `${baseUrl}/api/events`, description: "SSE event stream" },
			// MCP
			mcp: { method: "GET", url: `${baseUrl}/api/mcp`, description: "MCP tool manifest" },
		},

		// Authentication
		auth: {
			type: "zk-membership-proof",
			description: "Register to get a Poseidon membership leaf. Use with membership_proof.circom to prove membership anonymously.",
			optional: true,
		},

		// Contracts
		contracts: {
			guild_registry: GUILD_REGISTRY_CONTRACT_ID,
			network: "stellar-testnet",
			explorer: `https://stellar.expert/explorer/testnet/contract/${GUILD_REGISTRY_CONTRACT_ID}`,
		},
	});
}
