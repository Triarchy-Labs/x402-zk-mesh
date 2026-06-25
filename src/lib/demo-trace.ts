import { promises as fs } from "node:fs";
import path from "node:path";
import type { AgentTaskReceipt, DelegationReceipt, PaymentReceipt, ZkReceipt } from "./agent-receipt";
import { hashJson } from "./agent-receipt";

const TRACE_DIR = path.join(process.cwd(), ".tmp");
const TRACE_FILE = path.join(TRACE_DIR, "demo-traces.json");
const TESTNET_TX_EXPLORER = "https://stellar.expert/explorer/testnet/tx";
const TESTNET_CONTRACT_EXPLORER = "https://stellar.expert/explorer/testnet/contract";
const MAX_TRACES = 25;

export type DemoTraceStatus = "complete" | "partial" | "blocked" | "empty";
export type DemoTraceStepStatus =
  | "confirmed"
  | "verified"
  | "delegated"
  | "prepared"
  | "skipped"
  | "failed"
  | "pending"
  | "blocked"
  | "missing";

export interface DemoTraceStep {
  id: string;
  label: string;
  status: DemoTraceStepStatus;
  detail: string;
  txHash?: string | null;
  explorer?: string | null;
  contractId?: string | null;
  hash?: string | null;
  metadata?: Record<string, unknown>;
}

export interface DemoTrace {
  id: string;
  status: DemoTraceStatus;
  createdAt: string;
  network: "stellar-testnet";
  taskId: string | null;
  clientId: string | null;
  summary: string;
  steps: DemoTraceStep[];
  artifacts: {
    receiptId?: string | null;
    taskHash?: string | null;
    paymentHash?: string | null;
    zkHash?: string | null;
    delegationHash?: string | null;
    resultHash?: string | null;
    workerResultHash?: string | null;
  };
}

export interface HireTraceResponse {
  status?: string;
  message?: string;
  payment?: PaymentReceipt;
  client_zk?: ZkReceipt | null;
  zk?: ZkReceipt | null;
  delegation?: DelegationReceipt;
  receipt?: AgentTaskReceipt;
  soroban_settlement?: {
    contractId?: string;
    function?: string;
    args?: Record<string, unknown>;
    submission?: {
      mode?: string;
      status?: string;
      txHash?: string;
      explorer?: string;
      error?: string;
    } | null;
  } | null;
  external_agent_receipt?: {
    task_id?: string;
    result_hash?: string;
    proof_status?: string;
    membership?: string;
  } | null;
  external_agent_result?: string;
}

export function buildDemoTraceFromHireResponse(response: HireTraceResponse): DemoTrace {
  const receipt = response.receipt;
  const payment = response.payment || receipt?.payment || null;
  const clientZk = response.client_zk || null;
  const workerZk = response.zk || receipt?.zk || null;
  const delegation = response.delegation || receipt?.delegation || null;
  const settlement = response.soroban_settlement || null;
  const settlementSubmission = settlement?.submission || null;
  const workerReceipt = response.external_agent_receipt || null;
  const delegationStepStatus = delegationStatus(delegation?.workerStatus, response.status);
  const delegated = delegationStepStatus === "delegated";
  const workerResultHash = workerReceipt?.result_hash || (delegated ? receipt?.resultHash : null) || null;
  const routing = delegation?.routing || null;
  const steps: DemoTraceStep[] = [];

  steps.push({
    id: "payment",
    label: "x402 Stellar payment",
    status: payment?.txHash ? "confirmed" : "missing",
    detail: payment?.txHash
      ? `${paymentAmountLabel(payment)} accepted for ${payment.taskId}`
      : "No payment receipt was returned by the gateway.",
    txHash: payment?.txHash || null,
    explorer: payment?.txHash ? `${TESTNET_TX_EXPLORER}/${payment.txHash}` : null,
    hash: receipt?.paymentHash || null,
    metadata: payment
      ? {
          scheme: payment.scheme,
          clientId: payment.clientId,
          amount: payment.amount ?? payment.amountUsdc,
          assetCode: payment.assetCode || "USDC",
          assetIssuer: payment.assetIssuer || null,
        }
      : undefined,
  });

  if (clientZk?.required) {
    steps.push(zkStep("client-zk", "Client shielded proof", clientZk));
  }

  if (routing) {
    const selectedCandidate = routing.candidates.find((candidate) => candidate.selected);
    steps.push({
      id: "mesh-routing",
      label: "Mesh worker selection",
      status: selectedCandidate ? "confirmed" : "failed",
      detail: selectedCandidate
        ? `${routing.candidates.length} candidate(s), selected ${shortWorkerUrl(selectedCandidate.url)} by ${routing.strategy}.`
        : `${routing.candidates.length} candidate(s), no eligible worker selected.`,
      metadata: {
        strategy: routing.strategy,
        requestedCapability: routing.requestedCapability || null,
        candidateCount: routing.candidates.length,
        selectedWorkerUrl: routing.selectedWorkerUrl || null,
        selectedAgentId: selectedCandidate?.agentId || null,
        candidates: routing.candidates.map(candidateLabel).join(" | "),
      },
    });
  }

  steps.push(
    workerZk?.required
      ? zkStep("worker-zk", "Private worker membership proof", workerZk)
      : {
          id: "worker-zk",
          label: "Private worker membership proof",
          status: "missing",
          detail: "No worker membership proof was attached to this hire response.",
          hash: receipt?.zkHash || null,
        },
  );

  steps.push({
    id: "delegation",
    label: "Agent task delegation",
    status: delegationStepStatus,
    detail: delegation
      ? `${delegation.executor} / ${delegation.workerStatus || "unknown"}`
      : "No delegation receipt was returned by the gateway.",
    hash: receipt?.delegationHash || null,
    metadata: delegation
      ? {
          mode: delegation.mode,
          workerUrl: delegation.workerUrl || null,
          workerAgentId: delegation.workerAgentId || null,
          workerPaidUsdc: delegation.workerPaidUsdc ?? null,
          feeUsdc: delegation.feeUsdc ?? null,
          routingStrategy: delegation.routing?.strategy || null,
          candidateCount: delegation.routing?.candidates.length ?? null,
        }
      : undefined,
  });

  steps.push({
    id: "worker-result",
    label: "Worker result receipt",
    status: workerResultHash ? "confirmed" : "missing",
    detail: workerReceipt?.result_hash
      ? `Worker returned result hash ${shortHash(workerReceipt.result_hash)}`
      : delegated && receipt?.resultHash
        ? `Gateway receipt result hash ${shortHash(receipt.resultHash)}`
        : "No worker result hash was recorded.",
    hash: workerResultHash,
    metadata: workerReceipt
      ? {
          taskId: workerReceipt.task_id || null,
          proofStatus: workerReceipt.proof_status || null,
          membership: workerReceipt.membership || null,
        }
      : undefined,
  });

  steps.push({
    id: "settlement",
    label: "Soroban settlement",
    status: settlementStatus(settlementSubmission?.status, settlement),
    detail: settlementDetail(settlementSubmission?.status, settlementSubmission?.mode, settlementSubmission?.error),
    txHash: settlementSubmission?.txHash || null,
    explorer: settlementSubmission?.explorer || null,
    contractId: settlement?.contractId || null,
    metadata: settlement
      ? {
          function: settlement.function || null,
          contractExplorer: settlement.contractId
            ? `${TESTNET_CONTRACT_EXPLORER}/${settlement.contractId}`
            : null,
        }
      : undefined,
  });

  steps.push({
    id: "receipt",
    label: "Bound task receipt",
    status: receipt?.receiptId ? "confirmed" : "missing",
    detail: receipt?.receiptId
      ? `Receipt binds payment, ZK proof, delegation and result hashes.`
      : "No gateway receipt was returned.",
    hash: receipt?.receiptId || null,
  });

  const status = traceStatus(steps);
  const trace: DemoTrace = {
    id: hashJson({
      receiptId: receipt?.receiptId || null,
      paymentTx: payment?.txHash || null,
      zkTx: workerZk?.txHash || null,
      settlementTx: settlementSubmission?.txHash || null,
      createdAt: receipt?.createdAt || new Date().toISOString(),
    }),
    status,
    createdAt: receipt?.createdAt || new Date().toISOString(),
    network: "stellar-testnet",
    taskId: payment?.taskId || workerReceipt?.task_id || null,
    clientId: payment?.clientId || null,
    summary: summaryFor(status, response.status),
    steps,
    artifacts: {
      receiptId: receipt?.receiptId || null,
      taskHash: receipt?.taskHash || null,
      paymentHash: receipt?.paymentHash || null,
      zkHash: receipt?.zkHash || null,
      delegationHash: receipt?.delegationHash || null,
      resultHash: receipt?.resultHash || null,
      workerResultHash: workerReceipt?.result_hash || null,
    },
  };

  return trace;
}

export async function recordDemoTraceFromHireResponse(response: HireTraceResponse): Promise<DemoTrace> {
  const trace = buildDemoTraceFromHireResponse(response);
  const traces = await readDemoTraces();
  const deduped = [trace, ...traces.filter((item) => item.id !== trace.id)].slice(0, MAX_TRACES);

  await fs.mkdir(TRACE_DIR, { recursive: true });
  await fs.writeFile(TRACE_FILE, JSON.stringify(deduped, null, 2));

  return trace;
}

export async function readDemoTraces(limit = MAX_TRACES): Promise<DemoTrace[]> {
  try {
    const raw = await fs.readFile(TRACE_FILE, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      console.warn(`[DEMO_TRACE] Ignoring malformed trace store at ${TRACE_FILE}.`);
      return [];
    }
    return parsed.slice(0, limit);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[DEMO_TRACE] Failed to read trace store: ${message}`);
    return [];
  }
}

export async function readLatestDemoTrace(): Promise<DemoTrace | null> {
  const traces = await readDemoTraces(1);
  return traces[0] || null;
}

function zkStep(id: string, label: string, zk: ZkReceipt): DemoTraceStep {
  return {
    id,
    label,
    status: zk.verified ? "verified" : "blocked",
    detail: zk.verified
      ? `${zk.circuit || "proof"} verified via ${zk.method || "unknown"}${zk.approvedRoot === false ? "; root not approved" : ""}`
      : zk.proofValid === true && zk.approvedRoot === false
        ? `${zk.circuit || "proof"} is cryptographically valid via ${zk.method || "unknown"}, but root is not approved by the gateway registry.`
      : `${zk.circuit || "proof"} did not pass the gateway gate.`,
    txHash: zk.txHash || null,
    explorer: zk.explorer || (zk.txHash && !zk.txHash.startsWith("sim-ledger-") ? `${TESTNET_TX_EXPLORER}/${zk.txHash}` : null),
    contractId: zk.contractId || null,
    metadata: {
      context: zk.context || null,
      circuit: zk.circuit || null,
      method: zk.method || null,
      proofValid: zk.proofValid ?? null,
      approvedRoot: zk.approvedRoot ?? null,
      root: zk.root || null,
      contractExplorer: zk.contractId ? `${TESTNET_CONTRACT_EXPLORER}/${zk.contractId}` : null,
    },
  };
}

function paymentAmountLabel(payment: PaymentReceipt): string {
  const amount = payment.amount ?? payment.amountUsdc;
  const assetCode = payment.assetCode || "USDC";
  return `${amount} ${assetCode}`;
}

function delegationStatus(workerStatus?: string, responseStatus?: string): DemoTraceStepStatus {
  if (workerStatus === "success" || responseStatus === "delegated") {
    return "delegated";
  }
  if (workerStatus?.startsWith("membership_") || responseStatus === "worker_membership_rejected") {
    return "blocked";
  }
  if (workerStatus === "queued" || responseStatus === "accepted") {
    return "pending";
  }
  if (
    workerStatus === "offline" ||
    workerStatus === "no_eligible_worker" ||
    workerStatus?.startsWith("http_") ||
    workerStatus === "blocked_by_url_policy" ||
    responseStatus === "worker_unavailable"
  ) {
    return "failed";
  }
  return workerStatus ? "pending" : "missing";
}

function settlementStatus(
  submissionStatus?: string,
  settlement?: HireTraceResponse["soroban_settlement"],
): DemoTraceStepStatus {
  if (!settlement) {
    return "missing";
  }
  if (submissionStatus === "confirmed") {
    return "confirmed";
  }
  if (submissionStatus === "skipped") {
    return "skipped";
  }
  if (submissionStatus === "failed") {
    return "failed";
  }
  return "prepared";
}

function settlementDetail(status?: string, mode?: string, error?: string): string {
  if (status === "confirmed") {
    return `settle_proof confirmed on Stellar Testnet${mode ? ` (${mode})` : ""}.`;
  }
  if (status === "skipped") {
    return "settle_proof artifact prepared; relayer submission is disabled.";
  }
  if (status === "failed") {
    return error ? `settle_proof submission failed: ${error}` : "settle_proof submission failed.";
  }
  return "No live settlement submission was attached.";
}

function traceStatus(steps: DemoTraceStep[]): DemoTraceStatus {
  const required = ["payment", "worker-zk", "delegation", "worker-result", "settlement", "receipt"];
  const requiredSteps = steps.filter((step) => required.includes(step.id));
  const blocked = requiredSteps.some((step) => step.status === "blocked" || step.status === "failed");
  if (blocked) {
    return "blocked";
  }

  const complete = requiredSteps.every((step) =>
    ["confirmed", "verified", "delegated"].includes(step.status),
  );
  return complete ? "complete" : "partial";
}

function summaryFor(status: DemoTraceStatus, responseStatus?: string): string {
  if (status === "complete") {
    return "Payment, private membership proof, delegation, worker result and Soroban settlement are all recorded.";
  }
  if (status === "blocked") {
    return `Trace blocked at ${responseStatus || "gateway"} stage.`;
  }
  return "Trace has real gateway artifacts but one or more live proof steps are not complete.";
}

function shortHash(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-8)}` : value;
}

function shortWorkerUrl(value: string): string {
  try {
    const parsed = new URL(value);
    return `${parsed.hostname}:${parsed.port || (parsed.protocol === "https:" ? "443" : "80")}`;
  } catch {
    return shortHash(value);
  }
}

function candidateLabel(candidate: NonNullable<DelegationReceipt["routing"]>["candidates"][number]): string {
  const selected = candidate.selected ? "*" : "";
  const capability = candidate.capabilityMatch === false ? "/cap-miss" : "";
  const latency = typeof candidate.latencyMs === "number" ? `/${candidate.latencyMs}ms` : "";
  return `${selected}${shortWorkerUrl(candidate.url)}:${candidate.status}${capability}${latency}`;
}
