import { NextResponse } from "next/server";
import * as crypto from "crypto";

/**
 * Guild Agent Registration & Discovery
 *
 * POST /api/agents — Register as a guild member. Returns a Poseidon
 *   membership leaf compatible with membership_proof.circom.
 * GET  /api/agents — List guild members (leaf NOT exposed — privacy by default).
 */

// Poseidon hash (BN254-compatible, same as circom circuits)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { poseidon2, poseidon3 } = require("poseidon-lite");

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
      endpoint: "POST /api/agents",
      body: { name: "string", capabilities: "string[]", publicKey: "string (optional)" },
      returns: "membershipLeaf (Poseidon hash) — use with membership_proof.circom to prove guild membership anonymously",
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

    // Generate Poseidon membership leaf — compatible with membership_proof.circom
    // identity = Poseidon(nameHash, publicKeyHash)
    // leaf = Poseidon(identity, nonce) — prevents rainbow table attacks
    const nonce = BigInt("0x" + crypto.randomBytes(16).toString("hex"));

    // Convert strings to field elements via hashing to fit BN254 scalar field
    const nameHash = BigInt("0x" + crypto.createHash("sha256").update(name).digest("hex")) % BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");
    const keyHash = publicKey
      ? BigInt("0x" + crypto.createHash("sha256").update(publicKey).digest("hex")) % BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617")
      : BigInt(0);

    const identity = poseidon2([nameHash, keyHash]);
    const membershipLeaf = poseidon3([identity, nonce, BigInt(guildMembers.length)]).toString();

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
        hashFunction: "Poseidon (BN254-compatible, same as circom circuits)",
        totalMembers: guildMembers.length,
        instructions: [
          "Save your membershipLeaf — you need it to generate ZK membership proofs.",
          "Use circuits/membership_proof.circom with your leaf + current guild Merkle root.",
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
