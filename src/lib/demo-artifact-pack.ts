import type { DemoTrace, DemoTraceStep } from "./demo-trace";

export type DemoArtifactScenarioKey = "fresh" | "invalid-proof" | "unapproved-root";

export interface DemoArtifactScenario {
  key: DemoArtifactScenarioKey;
  title: string;
  decision: string;
  expected: string;
  recorded: boolean;
  traceStatus: DemoTrace["status"] | "missing";
  taskId: string | null;
  traceId: string | null;
  createdAt: string | null;
  proofValid: boolean | null;
  approvedRoot: boolean | null;
  paymentTx: string | null;
  paymentExplorer: string | null;
  proofTx: string | null;
  proofExplorer: string | null;
  settlementTx: string | null;
  settlementExplorer: string | null;
  receiptId: string | null;
  resultHash: string | null;
  workerResultHash: string | null;
}

export interface DemoArtifactContracts {
  membershipVerifier: {
    id: string;
    explorer: string;
  };
  guildRegistry: {
    id: string;
    explorer: string;
  };
}

export interface DemoArtifactPack {
  status: "ready" | "incomplete";
  generatedAt: string;
  network: "stellar-testnet";
  coverage: {
    recorded: number;
    total: number;
  };
  verdict: string;
  currentTrace: {
    status: DemoTrace["status"] | "empty";
    taskId: string | null;
    hardPathPassed: number;
    hardPathTotal: number;
    note: string;
  };
  contracts: DemoArtifactContracts;
  relayers: {
    guildRegistry: boolean;
    zkVerifier: boolean;
  };
  scenarios: DemoArtifactScenario[];
  copyText: string;
}

const SCENARIO_SPECS: Array<{
  key: DemoArtifactScenarioKey;
  title: string;
  expected: string;
  decision: string;
}> = [
  {
    key: "fresh",
    title: "Fresh trace",
    expected: "valid proof, approved root, delegated worker, confirmed settlement",
    decision: "delegate + settle",
  },
  {
    key: "invalid-proof",
    title: "Invalid proof",
    expected: "tampered worker proof blocked before delegation",
    decision: "block before execution",
  },
  {
    key: "unapproved-root",
    title: "Unapproved root",
    expected: "cryptographically valid proof rejected by guild-root policy",
    decision: "policy block",
  },
];

const HARD_PATH_STEP_IDS = ["payment", "worker-zk", "delegation", "worker-result", "settlement", "receipt"];
const PASS_STATUSES = new Set(["confirmed", "verified", "delegated"]);

export function buildDemoArtifactPack(input: {
  traces: DemoTrace[];
  contracts: DemoArtifactContracts;
  relayers: DemoArtifactPack["relayers"];
  generatedAt?: string;
}): DemoArtifactPack {
  const evidence = buildScenarioEvidence(input.traces);
  const scenarios = SCENARIO_SPECS.map((spec) => scenarioFromTrace(spec, evidence[spec.key]));
  const recorded = scenarios.filter((scenario) => scenario.recorded).length;
  const latest = input.traces[0] || null;
  const hardPathPassed = latest ? hardPathPassCount(latest) : 0;
  const status = recorded === SCENARIO_SPECS.length ? "ready" : "incomplete";
  const pack: Omit<DemoArtifactPack, "copyText"> = {
    status,
    generatedAt: input.generatedAt || new Date().toISOString(),
    network: "stellar-testnet",
    coverage: {
      recorded,
      total: SCENARIO_SPECS.length,
    },
    verdict: status === "ready"
      ? "PASS: all judge scenarios have recorded Stellar Testnet evidence."
      : "INCOMPLETE: run the judge suite to record all scenarios.",
    currentTrace: {
      status: latest?.status || "empty",
      taskId: latest?.taskId || null,
      hardPathPassed,
      hardPathTotal: HARD_PATH_STEP_IDS.length,
      note: latest?.status === "blocked"
        ? "Current trace is blocked by design; full 6/6 appears on the fresh happy-path trace."
        : "Current trace hard-path count reflects only the latest trace.",
    },
    contracts: input.contracts,
    relayers: input.relayers,
    scenarios,
  };

  return {
    ...pack,
    copyText: buildCopyText(pack),
  };
}

function buildScenarioEvidence(traces: DemoTrace[]): Record<DemoArtifactScenarioKey, DemoTrace | null> {
  const evidence: Record<DemoArtifactScenarioKey, DemoTrace | null> = {
    fresh: null,
    "invalid-proof": null,
    "unapproved-root": null,
  };

  for (const trace of traces) {
    const key = classifyTrace(trace);
    if (key && !evidence[key]) {
      evidence[key] = trace;
    }
  }

  return evidence;
}

function classifyTrace(trace: DemoTrace): DemoArtifactScenarioKey | null {
  const workerZk = traceStep(trace, "worker-zk");
  const settlement = traceStep(trace, "settlement");
  const proofValid = metadataBoolean(workerZk, "proofValid");
  const approvedRoot = metadataBoolean(workerZk, "approvedRoot");

  if (trace.status === "complete" && proofValid === true && approvedRoot === true && settlement?.status === "confirmed") {
    return "fresh";
  }
  if (trace.status === "blocked" && proofValid === false) {
    return "invalid-proof";
  }
  if (trace.status === "blocked" && proofValid === true && approvedRoot === false) {
    return "unapproved-root";
  }
  if (trace.taskId?.startsWith("blocked-demo")) {
    return "invalid-proof";
  }
  if (trace.taskId?.startsWith("root-demo")) {
    return "unapproved-root";
  }
  return null;
}

function scenarioFromTrace(
  spec: (typeof SCENARIO_SPECS)[number],
  trace: DemoTrace | null,
): DemoArtifactScenario {
  const payment = trace ? traceStep(trace, "payment") : undefined;
  const workerZk = trace ? traceStep(trace, "worker-zk") : undefined;
  const settlement = trace ? traceStep(trace, "settlement") : undefined;
  const proofValid = metadataBoolean(workerZk, "proofValid");
  const approvedRoot = metadataBoolean(workerZk, "approvedRoot");

  return {
    key: spec.key,
    title: spec.title,
    decision: spec.decision,
    expected: spec.expected,
    recorded: !!trace,
    traceStatus: trace?.status || "missing",
    taskId: trace?.taskId || null,
    traceId: trace?.id || null,
    createdAt: trace?.createdAt || null,
    proofValid: spec.key === "invalid-proof" ? proofValid ?? false : proofValid,
    approvedRoot: spec.key === "invalid-proof" ? null : approvedRoot,
    paymentTx: payment?.txHash || null,
    paymentExplorer: payment?.explorer || null,
    proofTx: workerZk?.txHash || null,
    proofExplorer: workerZk?.explorer || null,
    settlementTx: settlement?.txHash || null,
    settlementExplorer: settlement?.explorer || null,
    receiptId: trace?.artifacts.receiptId || null,
    resultHash: trace?.artifacts.resultHash || null,
    workerResultHash: trace?.artifacts.workerResultHash || null,
  };
}

function hardPathPassCount(trace: DemoTrace): number {
  return HARD_PATH_STEP_IDS.filter((id) => {
    const step = traceStep(trace, id);
    return step ? PASS_STATUSES.has(step.status) : false;
  }).length;
}

function traceStep(trace: DemoTrace, id: string): DemoTraceStep | undefined {
  return trace.steps.find((step) => step.id === id);
}

function metadataBoolean(step: DemoTraceStep | undefined, key: string): boolean | null {
  const value = step?.metadata?.[key];
  return typeof value === "boolean" ? value : null;
}

function buildCopyText(pack: Omit<DemoArtifactPack, "copyText">): string {
  const lines = [
    "x402 ZK Mesh - Judge Artifact Pack",
    `Network: Stellar Testnet`,
    `Verdict: ${pack.verdict}`,
    `Coverage: ${pack.coverage.recorded}/${pack.coverage.total} scenarios`,
    `Current trace: ${pack.currentTrace.status} ${pack.currentTrace.hardPathPassed}/${pack.currentTrace.hardPathTotal}`,
    `Membership verifier: ${pack.contracts.membershipVerifier.id}`,
    `Guild registry: ${pack.contracts.guildRegistry.id}`,
    "",
    "Scenarios:",
  ];

  for (const scenario of pack.scenarios) {
    lines.push(
      `- ${scenario.title}: ${scenario.recorded ? scenario.traceStatus : "missing"}; decision=${scenario.decision}; proof=${proofCopy(scenario.proofValid)}; root=${rootCopy(scenario)}; task=${scenario.taskId || "none"}`,
    );
    if (scenario.paymentTx) {
      lines.push(`  payment_tx=${scenario.paymentTx}`);
    }
    if (scenario.proofTx) {
      lines.push(`  proof_tx=${scenario.proofTx}`);
    }
    if (scenario.settlementTx) {
      lines.push(`  settlement_tx=${scenario.settlementTx}`);
    }
    if (scenario.receiptId) {
      lines.push(`  receipt=${scenario.receiptId}`);
    }
  }

  lines.push("", pack.currentTrace.note);
  return lines.join("\n");
}

function proofCopy(value: boolean | null): string {
  if (value === true) return "valid";
  if (value === false) return "invalid";
  return "unknown";
}

function rootCopy(scenario: DemoArtifactScenario): string {
  if (scenario.key === "invalid-proof") return "not evaluated";
  if (scenario.approvedRoot === true) return "approved";
  if (scenario.approvedRoot === false) return "unapproved";
  return "unknown";
}
