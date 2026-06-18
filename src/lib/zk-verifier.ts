/**
 * zk-verifier.ts — Server-side ZK proof verification for X402 ZK Mesh
 *
 * Verifies Groth16 proofs locally using snarkjs verification keys.
 * For production: calls the on-chain Soroban verifier contract.
 */

import * as fs from "fs";
import * as path from "path";
// @ts-expect-error snarkjs doesn't ship proper TS types
import * as snarkjs from "snarkjs";
import type { CircuitName, ZKProof } from "./zk-prover";

const VK_DIR = path.join(process.cwd(), "circuits", "keys");

/**
 * Load a verification key from the filesystem.
 */
function loadVerificationKey(circuit: CircuitName): object {
  const vkPath = path.join(VK_DIR, `${circuit}_vk.json`);
  const raw = fs.readFileSync(vkPath, "utf-8");
  return JSON.parse(raw);
}

/**
 * Verify a Groth16 proof server-side using snarkjs.
 *
 * This is the local fallback. In production, this should be replaced
 * with a call to the Soroban verifier contract on Stellar Testnet.
 *
 * @returns true if proof is valid, false otherwise
 */
export async function verifyProof(
  circuit: CircuitName,
  proof: ZKProof["proof"],
  publicSignals: string[]
): Promise<{
  valid: boolean;
  method: "local" | "soroban";
  contractId?: string;
  txHash?: string;
}> {
  const vk = loadVerificationKey(circuit);

  // TODO: When Soroban verifier is deployed, call it here instead
  // return verifySoroban(circuit, proof, publicSignals);

  const valid = await snarkjs.groth16.verify(vk, publicSignals, proof);

  return {
    valid,
    method: "local",
  };
}

/**
 * Verify proof on-chain via Soroban contract.
 * STUB: Will be implemented when contracts are deployed to testnet.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _verifySoroban(
  _circuit: CircuitName,
  _proof: ZKProof["proof"],
  _publicSignals: string[]
): Promise<{
  valid: boolean;
  method: "soroban";
  contractId: string;
  txHash: string;
}> {
  // STUB: Soroban contract invocation
  // const contractId = CONTRACT_IDS[circuit];
  // const result = await sorobanClient.invoke(contractId, "verify", { proof, publicSignals });
  throw new Error(
    "Soroban verifier not yet deployed. Use local verification."
  );
}

/**
 * Extract the commitment and nullifier hash from deposit proof public signals.
 */
export function parseDepositSignals(publicSignals: string[]): {
  commitment: string;
  nullifierHash: string;
} {
  return {
    commitment: publicSignals[0],
    nullifierHash: publicSignals[1],
  };
}

/**
 * Extract the Merkle root from membership proof public signals.
 */
export function parseMembershipSignals(publicSignals: string[]): {
  root: string;
} {
  return {
    root: publicSignals[0],
  };
}

/**
 * Extract the execution ID from execution proof public signals.
 */
export function parseExecutionSignals(publicSignals: string[]): {
  executionId: string;
} {
  return {
    executionId: publicSignals[0],
  };
}
