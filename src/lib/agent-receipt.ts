import { createHash } from "node:crypto";

export interface PaymentReceipt {
  scheme: "stellar-l402-header" | "shielded-zk-stellar";
  txHash: string;
  amountUsdc: number;
  amount?: number;
  assetCode?: string;
  assetIssuer?: string | null;
  clientId: string;
  taskId: string;
}

export interface ZkReceipt {
  required: boolean;
  verified: boolean;
  proofValid?: boolean;
  context?: "client_shielded_request" | "worker_membership_gate";
  circuit?: string;
  method?: "local" | "soroban";
  contractId?: string | null;
  txHash?: string | null;
  explorer?: string | null;
  root?: string | null;
  approvedRoot?: boolean;
}

export interface MeshRouteCandidate {
  url: string;
  status: string;
  agentId?: string | null;
  guildMember?: boolean | null;
  capabilities?: string[];
  capabilityMatch?: boolean;
  latencyMs?: number | null;
  selected?: boolean;
  reason?: string | null;
}

export interface DelegationReceipt {
  mode: "sync_llm" | "enterprise_local_hook" | "p2p_worker";
  executor: string;
  workerUrl?: string;
  workerAgentId?: string | null;
  workerStatus?: string;
  feeUsdc?: number;
  workerPaidUsdc?: number;
  membershipProof?: ZkReceipt;
  routing?: {
    strategy: "capability_latency";
    requestedCapability?: string | null;
    selectedWorkerUrl?: string | null;
    candidates: MeshRouteCandidate[];
  };
}

export interface AgentTaskReceipt {
  receiptId: string;
  taskHash: string;
  paymentHash: string;
  zkHash: string | null;
  delegationHash: string;
  resultHash: string | null;
  createdAt: string;
  payment: PaymentReceipt;
  zk: ZkReceipt;
  delegation: DelegationReceipt;
}

interface BuildTaskReceiptInput {
  taskId: string;
  description: string;
  bountyUsdc: number;
  clientId: string;
  payment: PaymentReceipt;
  zk: ZkReceipt;
  delegation: DelegationReceipt;
  result?: unknown;
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashJson(value: unknown): string {
  return sha256Hex(stableStringify(value));
}

export function buildTaskReceipt(input: BuildTaskReceiptInput): AgentTaskReceipt {
  const taskHash = hashJson({
    taskId: input.taskId,
    description: input.description,
    bountyUsdc: input.bountyUsdc,
    clientId: input.clientId,
  });
  const paymentHash = hashJson(input.payment);
  const zkHash = input.zk.required ? hashJson(input.zk) : null;
  const delegationHash = hashJson(input.delegation);
  const resultHash = input.result === undefined ? null : hashJson(input.result);
  const receiptId = hashJson({
    taskHash,
    paymentHash,
    zkHash,
    delegationHash,
    resultHash,
  });

  return {
    receiptId,
    taskHash,
    paymentHash,
    zkHash,
    delegationHash,
    resultHash,
    createdAt: new Date().toISOString(),
    payment: input.payment,
    zk: input.zk,
    delegation: input.delegation,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
