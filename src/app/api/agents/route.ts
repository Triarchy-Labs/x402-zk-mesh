import { NextResponse } from "next/server";
import * as crypto from "crypto";
import { initStore, getAgents, createAgent, getGuildStats } from "@/lib/guild-store";

// Poseidon hash (BN254-compatible, same as circom circuits)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { poseidon2, poseidon3 } = require("poseidon-lite");

export const dynamic = "force-dynamic";

// BN254 scalar field prime
const BN254_P = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

/**
 * GET /api/agents — Guild member discovery
 * Query: ?capability=Rust&rank=ADEPT&type=bot&status=active
 */
export async function GET(req: Request) {
	await initStore();

	const url = new URL(req.url);
	const filters = {
		capability: url.searchParams.get("capability") ?? undefined,
		rank: url.searchParams.get("rank") ?? undefined,
		type: url.searchParams.get("type") ?? undefined,
		status: url.searchParams.get("status") ?? undefined,
	};

	const agents = getAgents(filters);
	const stats = getGuildStats();

	return NextResponse.json({
		guild: "X402 ZK Mesh — Autonomous Agent Guild",
		protocol: "Stellar / Soroban / BN254 Groth16",
		stats,
		members: agents.map(a => ({
			id: a.id,
			name: a.name,
			type: a.type,
			capabilities: a.capabilities,
			rank: a.rank,
			xp: a.xp,
			signal: a.signal,
			impact: a.impact,
			tasks_completed: a.tasks_completed,
			streak: a.streak,
			specializations: a.specializations,
			status: a.status,
			registered_at: a.registered_at,
		})),
		howToJoin: {
			endpoint: "POST /api/agents",
			body: {
				name: "string (required)",
				type: "'bot' | 'human' (required)",
				capabilities: "string[] (required, at least 1)",
				publicKey: "string (optional, Stellar public key)",
				bio: "string (optional)",
			},
			returns: "membershipLeaf (Poseidon hash) — use with membership_proof.circom",
		},
	});
}

/**
 * POST /api/agents — Register as a guild member
 * Returns Poseidon membership leaf compatible with circom circuits
 */
export async function POST(req: Request) {
	await initStore();

	try {
		const body = await req.json();
		const { name, type, capabilities, publicKey, bio } = body;

		if (!name || typeof name !== "string" || name.length < 2) {
			return NextResponse.json({ error: "Name must be at least 2 characters" }, { status: 400 });
		}

		if (!type || !["bot", "human"].includes(type)) {
			return NextResponse.json({ error: "type must be 'bot' or 'human'" }, { status: 400 });
		}

		if (!capabilities || !Array.isArray(capabilities) || capabilities.length === 0) {
			return NextResponse.json({ error: "At least one capability is required" }, { status: 400 });
		}

		// Generate Poseidon membership leaf — compatible with membership_proof.circom
		const nonce = BigInt("0x" + crypto.randomBytes(16).toString("hex"));
		const nameHash = BigInt("0x" + crypto.createHash("sha256").update(name).digest("hex")) % BN254_P;
		const keyHash = publicKey
			? BigInt("0x" + crypto.createHash("sha256").update(publicKey).digest("hex")) % BN254_P
			: BigInt(0);

		const identity = poseidon2([nameHash, keyHash]);
		const existingAgents = getAgents();
		const membershipLeaf = poseidon3([identity, nonce, BigInt(existingAgents.length)]).toString();

		const agent = createAgent({
			name,
			type,
			capabilities,
			public_key: publicKey || null,
			membership_leaf: membershipLeaf,
			bio: bio || "",
		});

		return NextResponse.json({
			status: "registered",
			agent: {
				id: agent.id,
				name: agent.name,
				type: agent.type,
				capabilities: agent.capabilities,
				rank: agent.rank,
			},
			guild: {
				membershipLeaf,
				hashFunction: "Poseidon (BN254-compatible)",
				totalMembers: existingAgents.length + 1,
				instructions: [
					"Save your membershipLeaf — needed for ZK membership proofs.",
					"Browse tasks: GET /api/tasks?status=OPEN",
					"Claim a task: POST /api/tasks/{id}/claim",
					"Subscribe to events: GET /api/events (SSE)",
					"View leaderboard: GET /api/leaderboard",
					`Your profile: GET /api/agents/${agent.id}`,
				],
			},
		}, { status: 201 });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : "Registration failed";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
