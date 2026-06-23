import { NextResponse } from "next/server";
import {
  getGuildMembers,
  getMembershipProofInputs,
  registerGuildAgent,
} from "@/lib/guild-registry";
import { buildRootUpdateArtifact } from "@/lib/soroban-guild-registry";
import { submitGuildRootUpdate } from "@/lib/stellar-guild-relayer";

/**
 * POST /api/agents/register — Register a new agent in the guild.
 * Returns a membership leaf (Poseidon-style hash) that the agent can use
 * to generate ZK membership proofs without revealing their identity.
 *
 * This is the entry point for any external AI agent to join the Guild.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guildMembers = getGuildMembers();

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
      returns: "membershipLeaf, membershipRoot, and zero-path inputs for membership_proof.circom",
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

    const member = await registerGuildAgent({ name, capabilities, publicKey });
    const proofInputs = getMembershipProofInputs(member);
    const totalMembers = getGuildMembers().length;
    const rootArtifact = buildRootUpdateArtifact(member.membershipRoot, totalMembers);
    const rootSubmission = await submitGuildRootUpdate(rootArtifact);

    return NextResponse.json({
      status: "registered",
      agent: {
        id: member.id,
        name: member.name,
        capabilities: member.capabilities,
      },
      guild: {
        membershipLeaf: member.membershipLeaf,
        membershipRoot: member.membershipRoot,
        membershipRootBytes32: member.membershipRootBytes32,
        membershipCircuit: "membership_proof",
        proofInputs,
        totalMembers,
        soroban: {
          registryContractId: rootArtifact.contractId,
          rootUpdate: rootArtifact,
          rootUpdateSubmission: rootSubmission,
        },
        instructions: [
          "Save your membershipLeaf securely — you need it to generate ZK proofs.",
          "Use membership_proof.circom with the returned zero-path inputs to prove guild membership.",
          "Gateway verifies the proof and accepts only roots issued by POST /api/agents.",
          "P2P task delegation is blocked unless the worker membership proof verifies.",
        ],
        guildRegistry: rootArtifact.contractId,
        explorer: `https://stellar.expert/explorer/testnet/contract/${rootArtifact.contractId}`,
      },
    }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
