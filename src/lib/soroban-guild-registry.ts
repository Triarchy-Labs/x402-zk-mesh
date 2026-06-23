import { hashJson } from "./agent-receipt";

export const GUILD_REGISTRY_CONTRACT_ID =
  process.env.ZK_GUILD_REGISTRY_CONTRACT_ID ||
  "CBH5UVNM6P4JMNRQ5NH4QNMOIZGWA4KQW2DI4G5EKJ5CZ3RXQSK7CGLG";

export interface GuildRootArtifact {
  status: "prepared";
  network: "testnet";
  contractId: string;
  function: "update_root";
  args: {
    new_root: string;
    new_member_count: number;
  };
  expectedEvent: ["root", "update"];
}

export interface GuildSettlementArtifact {
  status: "prepared";
  network: "testnet";
  contractId: string;
  function: "settle_proof";
  args: {
    nullifier: string;
    task_hash: string;
    worker_root: string;
    result_hash: string;
    payment_hash: string;
  };
  expectedEvent: ["proof", "settle"];
  note: string;
}

export function buildRootUpdateArtifact(
  membershipRoot: string,
  memberCount: number
): GuildRootArtifact {
  return {
    status: "prepared",
    network: "testnet",
    contractId: GUILD_REGISTRY_CONTRACT_ID,
    function: "update_root",
    args: {
      new_root: fieldDecimalToBytes32Hex(membershipRoot),
      new_member_count: memberCount,
    },
    expectedEvent: ["root", "update"],
  };
}

export function buildSettlementArtifact(input: {
  taskHash: string;
  workerRoot: string;
  resultHash: string;
  paymentHash: string;
  workerAgentId?: string | null;
}): GuildSettlementArtifact {
  const workerRootBytes = fieldDecimalToBytes32Hex(input.workerRoot);
  const nullifier = hashJson({
    taskHash: input.taskHash,
    workerRoot: workerRootBytes,
    paymentHash: input.paymentHash,
    workerAgentId: input.workerAgentId || "anonymous_worker",
  });

  return {
    status: "prepared",
    network: "testnet",
    contractId: GUILD_REGISTRY_CONTRACT_ID,
    function: "settle_proof",
    args: {
      nullifier: hexToBytes32Hex(nullifier),
      task_hash: hexToBytes32Hex(input.taskHash),
      worker_root: workerRootBytes,
      result_hash: hexToBytes32Hex(input.resultHash),
      payment_hash: hexToBytes32Hex(input.paymentHash),
    },
    expectedEvent: ["proof", "settle"],
    note: "Prepared for guild-registry.settle_proof after local Groth16 verification; submit with the gateway relayer key to write Soroban state.",
  };
}

export function fieldDecimalToBytes32Hex(value: string): string {
  const hex = BigInt(value).toString(16).padStart(64, "0");
  return `0x${hex}`;
}

export function hexToBytes32Hex(value: string): string {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error("Expected a 32-byte hex value.");
  }
  return `0x${normalized.toLowerCase()}`;
}
