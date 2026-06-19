import { NextResponse } from "next/server";
import * as crypto from "crypto";

/**
 * POST /api/agents/register — Register a new agent in the guild.
 * Returns a membership leaf (Poseidon-style hash) that the agent can use
 * to generate ZK membership proofs without revealing their identity.
 *
 * This is the entry point for any external AI agent to join the Guild.
 */

// In-memory guild registry (production: Soroban guild-registry contract)
const guildMembers: Array<{
  id: string;
  name: string;
  capabilities: string[];
  membershipLeaf: string;
  registeredAt: string;
  status: string;
}> = [];

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    guild: "X402 ZK Mesh — Autonomous Agent Guild",
    protocol: "Stellar / Soroban / BN254 Groth16",
    totalMembers: guildMembers.length,
    members: guildMembers.map(m => ({
      id: m.id,
      name: m.name,
      capabilities: m.capabilities,
      status: m.status,
      registeredAt: m.registeredAt,
      // membershipLeaf is NOT exposed — privacy by default
    })),
    howToJoin: {
      endpoint: "POST /api/agents/register",
      body: { name: "string", capabilities: "string[]", publicKey: "string (optional)" },
      returns: "membershipLeaf — use with membership_proof.circom to prove guild membership anonymously",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, capabilities, publicKey } = body;

    if (!name || typeof name !== "string") {
      return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
    }

    if (!capabilities || !Array.isArray(capabilities) || capabilities.length === 0) {
      return NextResponse.json({ error: "At least one capability is required" }, { status: 400 });
    }

    // Generate membership leaf — simulates Poseidon(identity || nonce)
    // In production this would use the actual Poseidon hash from circomlib
    const nonce = crypto.randomBytes(16).toString("hex");
    const identity = `${name}:${publicKey || "anon"}:${nonce}`;
    const membershipLeaf = crypto
      .createHash("sha256")
      .update(identity)
      .digest("hex");

    const member = {
      id: crypto.randomUUID(),
      name,
      capabilities,
      membershipLeaf,
      registeredAt: new Date().toISOString(),
      status: "active",
    };

    guildMembers.push(member);

    return NextResponse.json({
      status: "registered",
      agent: {
        id: member.id,
        name: member.name,
        capabilities: member.capabilities,
      },
      guild: {
        membershipLeaf,
        totalMembers: guildMembers.length,
        instructions: [
          "Save your membershipLeaf securely — you need it to generate ZK proofs.",
          "Use circuits/membership_proof.circom with your leaf + the current guild Merkle root.",
          "Submit proof via POST /api/zk/verify to prove membership anonymously.",
          "Include x-zk-proof header when calling /api/hire for shielded task execution.",
        ],
        guildRegistry: "CBH5UVNM6P4JMNRQ5NH4QNMOIZGWA4KQW2DI4G5EKJ5CZ3RXQSK7CGLG",
        explorer: "https://stellar.expert/explorer/testnet/contract/CBH5UVNM6P4JMNRQ5NH4QNMOIZGWA4KQW2DI4G5EKJ5CZ3RXQSK7CGLG",
      },
    }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
