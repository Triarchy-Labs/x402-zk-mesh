/**
 * zk-prover.ts — Browser-side ZK proof generation for X402 ZK Mesh
 *
 * Uses snarkjs to generate Groth16 proofs entirely client-side (WASM).
 * Secrets never leave the user's device.
 */

// @ts-expect-error snarkjs doesn't have proper TS types
import * as snarkjs from "snarkjs";

export type CircuitName =
  | "deposit_commitment"
  | "membership_proof"
  | "execution_proof";

export interface ZKProof {
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  };
  publicSignals: string[];
}

export interface DepositInputs {
  secret: string;
  nullifier: string;
  amount: string;
}

export interface MembershipInputs {
  leaf: string;
  pathElements: string[];
  pathIndices: number[];
}

export interface ExecutionInputs {
  taskHash: string;
  resultHash: string;
  agentSecret: string;
}

type CircuitInputs = DepositInputs | MembershipInputs | ExecutionInputs;

/**
 * Generate a Groth16 ZK proof for a given circuit.
 *
 * The proof is generated entirely client-side using snarkjs WASM.
 * The proving key (.zkey) and circuit WASM are loaded from public assets.
 *
 * @param circuit - Which circuit to generate a proof for
 * @param inputs - Private + public inputs for the circuit
 * @returns The proof and public signals
 */
export async function generateProof(
  circuit: CircuitName,
  inputs: CircuitInputs
): Promise<ZKProof> {
  const wasmPath = `/circuits/${circuit}.wasm`;
  const zkeyPath = `/circuits/${circuit}_final.zkey`;

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    inputs,
    wasmPath,
    zkeyPath
  );

  return { proof, publicSignals };
}

/**
 * Verify a Groth16 proof locally (client-side).
 * This is for UX feedback — the real verification happens on-chain.
 */
export async function verifyProofLocally(
  circuit: CircuitName,
  proof: ZKProof["proof"],
  publicSignals: string[]
): Promise<boolean> {
  const vkPath = `/circuits/${circuit}_vk.json`;
  const vkResponse = await fetch(vkPath);
  const vk = await vkResponse.json();

  return snarkjs.groth16.verify(vk, publicSignals, proof);
}

/**
 * Format proof for Soroban contract call.
 * Converts snarkjs proof format to the byte format expected by
 * the on-chain Groth16 verifier.
 */
export function formatProofForSoroban(proof: ZKProof["proof"]): {
  proofBytes: string;
  publicInputBytes: string;
} {
  // Soroban verifier expects proof as concatenated G1/G2 points
  // pi_a (G1): 2 * 32 bytes = 64 bytes
  // pi_b (G2): 2 * 2 * 32 bytes = 128 bytes
  // pi_c (G1): 2 * 32 bytes = 64 bytes
  // Total: 256 bytes

  const pi_a = proof.pi_a.slice(0, 2).map(bigIntToHex32);
  const pi_b = proof.pi_b
    .slice(0, 2)
    .map((pair) => pair.map(bigIntToHex32))
    .flat();
  const pi_c = proof.pi_c.slice(0, 2).map(bigIntToHex32);

  const proofBytes = [...pi_a, ...pi_b, ...pi_c].join("");
  return { proofBytes, publicInputBytes: "" };
}

/**
 * Generate a random secret and nullifier for a deposit.
 * Uses crypto.getRandomValues for secure randomness.
 */
export function generateDepositSecrets(): {
  secret: string;
  nullifier: string;
} {
  const randomBigInt = () => {
    const bytes = new Uint8Array(31); // 248 bits, fits in BN254 field
    crypto.getRandomValues(bytes);
    return BigInt(
      "0x" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
    ).toString();
  };

  return {
    secret: randomBigInt(),
    nullifier: randomBigInt(),
  };
}

function bigIntToHex32(value: string): string {
  return BigInt(value).toString(16).padStart(64, "0");
}
