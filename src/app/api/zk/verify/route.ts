/**
 * POST /api/zk/verify — On-chain ZK proof verification endpoint
 *
 * Accepts a Groth16 proof + public signals and verifies them
 * against the circuit's verification key.
 *
 * Currently: local snarkjs verification
 * Target: Soroban contract call on Stellar Testnet
 */

import { NextResponse, type NextRequest } from "next/server";
import { verifyProof, parseDepositSignals, parseMembershipSignals, parseExecutionSignals } from "@/lib/zk-verifier";
import type { CircuitName } from "@/lib/zk-prover";

const VALID_CIRCUITS: CircuitName[] = [
  "deposit_commitment",
  "membership_proof",
  "execution_proof",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { circuit, proof, publicSignals } = body;

    // Validate circuit name
    if (!circuit || !VALID_CIRCUITS.includes(circuit)) {
      return NextResponse.json(
        {
          error: `Invalid circuit. Must be one of: ${VALID_CIRCUITS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate proof structure
    if (!proof || !proof.pi_a || !proof.pi_b || !proof.pi_c) {
      return NextResponse.json(
        { error: "Invalid proof structure. Expected Groth16 proof with pi_a, pi_b, pi_c." },
        { status: 400 }
      );
    }

    if (!publicSignals || !Array.isArray(publicSignals)) {
      return NextResponse.json(
        { error: "Invalid publicSignals. Expected array of strings." },
        { status: 400 }
      );
    }

    // Verify the proof
    const result = await verifyProof(circuit, proof, publicSignals);

    // Parse circuit-specific outputs
    let parsedSignals = {};
    if (circuit === "deposit_commitment") {
      parsedSignals = parseDepositSignals(publicSignals);
    } else if (circuit === "membership_proof") {
      parsedSignals = parseMembershipSignals(publicSignals);
    } else if (circuit === "execution_proof") {
      parsedSignals = parseExecutionSignals(publicSignals);
    }

    return NextResponse.json({
      verified: result.valid,
      circuit,
      method: result.method,
      contractId: result.contractId || null,
      txHash: result.txHash || null,
      explorer: (result as any).explorer || null,
      publicSignals: parsedSignals,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ZK_VERIFY] Error:", error);
    return NextResponse.json(
      {
        error: "Verification failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
