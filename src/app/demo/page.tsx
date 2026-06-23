"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Nav } from "@/components/Nav";

type StepStatus =
  | "confirmed"
  | "verified"
  | "delegated"
  | "prepared"
  | "skipped"
  | "failed"
  | "pending"
  | "blocked"
  | "missing";

interface DemoTraceStep {
  id: string;
  label: string;
  status: StepStatus;
  detail: string;
  txHash?: string | null;
  explorer?: string | null;
  contractId?: string | null;
  hash?: string | null;
  metadata?: Record<string, unknown>;
}

interface DemoTrace {
  id: string;
  status: "complete" | "partial" | "blocked" | "empty";
  createdAt: string;
  network: "stellar-testnet";
  taskId: string | null;
  clientId: string | null;
  summary: string;
  steps: DemoTraceStep[];
  artifacts: Record<string, string | null | undefined>;
}

interface TraceResponse {
  status: string;
  generatedAt: string;
  relayers: {
    guildRegistry: boolean;
    zkVerifier: boolean;
  };
  contracts: {
    membershipVerifier: {
      id: string;
      explorer: string;
    };
    guildRegistry: {
      id: string;
      explorer: string;
    };
  };
  trace: DemoTrace | null;
  traces: DemoTrace[];
}

interface ArtifactScenario {
  key: EvidenceKey;
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

interface ArtifactPackResponse {
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
  contracts: TraceResponse["contracts"];
  relayers: TraceResponse["relayers"];
  scenarios: ArtifactScenario[];
  copyText: string;
}

interface PreflightCheck {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  evidence?: string | null;
}

interface PreflightWorker {
  url: string;
  healthUrl: string;
  alive: boolean;
  status: string;
  agentId: string | null;
  name: string | null;
  guildMember: boolean | null;
  capabilities: string[];
  latencyMs: number | null;
  error?: string;
}

interface PreflightReport {
  status: "ready" | "warning" | "blocked";
  generatedAt: string;
  network: "stellar-testnet";
  gatewayUrl: string;
  challenge: {
    ok: boolean;
    status: number | null;
    wwwAuthenticate: string | null;
    requiredPayment: string | null;
    error?: string;
  };
  runtime: {
    platformWalletConfigured: boolean;
    payerConfigured: boolean;
    demoAmount: string;
    workerUrls: string[];
    relayers: TraceResponse["relayers"];
  };
  workers: PreflightWorker[];
  checks: PreflightCheck[];
  claimBoundaries: Array<{
    claim: string;
    status: "real" | "scoped" | "prototype";
    evidence: string;
  }>;
  copyText: string;
}

interface DemoRunResponse {
  status?: string;
  error?: string;
  missing?: string[];
  scenario?: string;
  clientId?: string;
  taskId?: string;
  payment?: {
    txHash?: string;
    explorer?: string;
  };
  hire?: {
    status?: string | null;
    workerStatus?: string | null;
    zkVerified?: boolean | null;
    zkProofValid?: boolean | null;
    zkMethod?: string | null;
    zkApprovedRoot?: boolean | null;
    settlementStatus?: string | null;
  };
}

type DemoScenario = "happy-path" | "tampered-worker-proof" | "unapproved-worker-root";
type HardPathState = "pass" | "wait" | "fail";
type EvidenceKey = "fresh" | "invalid-proof" | "unapproved-root";
type JudgeSuiteRunStatus = "pending" | "running" | "passed" | "failed";

interface DemoRunResult extends DemoRunResponse {
  elapsedMs: number;
  completedAt: string;
}

type ScenarioEvidenceMap = Record<EvidenceKey, DemoTrace | null>;

interface JudgeSuiteCase {
  scenario: DemoScenario;
  title: string;
  expected: string;
}

interface JudgeSuiteRun extends JudgeSuiteCase {
  status: JudgeSuiteRunStatus;
  elapsedMs?: number;
  taskId?: string | null;
  txHash?: string | null;
  txExplorer?: string | null;
  responseStatus?: string | null;
  proof?: string;
  root?: string;
  settlement?: string | null;
  error?: string;
}

interface JudgeSuiteResult {
  status: "passed" | "failed";
  elapsedMs: number;
}

const statusCopy: Record<StepStatus, string> = {
  confirmed: "CONFIRMED",
  verified: "VERIFIED",
  delegated: "DELEGATED",
  prepared: "PREPARED",
  skipped: "SKIPPED",
  failed: "FAILED",
  pending: "PENDING",
  blocked: "BLOCKED",
  missing: "MISSING",
};

const statusClasses: Record<StepStatus, string> = {
  confirmed: "border-emerald-300/50 bg-emerald-300/10 text-emerald-200",
  verified: "border-cyan-300/50 bg-cyan-300/10 text-cyan-200",
  delegated: "border-violet-300/50 bg-violet-300/10 text-violet-200",
  prepared: "border-amber-300/50 bg-amber-300/10 text-amber-200",
  skipped: "border-zinc-300/40 bg-zinc-300/10 text-zinc-200",
  failed: "border-red-400/50 bg-red-400/10 text-red-200",
  pending: "border-blue-300/50 bg-blue-300/10 text-blue-200",
  blocked: "border-red-400/50 bg-red-400/10 text-red-200",
  missing: "border-zinc-500/50 bg-zinc-500/10 text-zinc-300",
};

const HARD_PATH: Array<{ id: string; label: string; evidence: string }> = [
  { id: "payment", label: "Stellar payment", evidence: "tx hash + memo" },
  { id: "worker-zk", label: "Private worker proof", evidence: "Groth16 + approved root" },
  { id: "delegation", label: "Task delegation", evidence: "separate worker process" },
  { id: "worker-result", label: "Worker result", evidence: "result hash" },
  { id: "settlement", label: "Soroban settlement", evidence: "contract tx" },
  { id: "receipt", label: "Bound receipt", evidence: "hash binding" },
];

const DECISION_MATRIX = [
  {
    scenario: "Fresh trace",
    proof: "valid",
    root: "approved",
    decision: "delegate + settle",
    tone: "pass",
  },
  {
    scenario: "Blocked trace",
    proof: "invalid",
    root: "not evaluated",
    decision: "block before execution",
    tone: "fail",
  },
  {
    scenario: "Unapproved root",
    proof: "valid",
    root: "unapproved",
    decision: "policy block",
    tone: "warn",
  },
];

const EVIDENCE_CASES: Array<{
  key: EvidenceKey;
  title: string;
  expected: string;
  tone: "pass" | "fail" | "warn";
}> = [
  {
    key: "fresh",
    title: "Fresh trace",
    expected: "valid proof + approved root",
    tone: "pass",
  },
  {
    key: "invalid-proof",
    title: "Invalid proof",
    expected: "tampered proof blocked",
    tone: "fail",
  },
  {
    key: "unapproved-root",
    title: "Unapproved root",
    expected: "valid proof + policy block",
    tone: "warn",
  },
];

const JUDGE_SUITE_CASES: JudgeSuiteCase[] = [
  {
    scenario: "happy-path",
    title: "Fresh trace",
    expected: "valid proof, approved root, confirmed settlement",
  },
  {
    scenario: "tampered-worker-proof",
    title: "Invalid proof",
    expected: "tampered worker proof blocked before delegation",
  },
  {
    scenario: "unapproved-worker-root",
    title: "Unapproved root",
    expected: "valid proof rejected by gateway root policy",
  },
];

const passStatuses = new Set<StepStatus>(["confirmed", "verified", "delegated"]);
const failStatuses = new Set<StepStatus>(["blocked", "failed"]);

function shortValue(value?: string | null) {
  if (!value) return "none";
  return value.length > 22 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}

function formatTime(value?: string) {
  if (!value) return "none";
  return new Date(value).toLocaleString();
}

function formatDuration(ms?: number) {
  if (!ms) return "0.0s";
  return `${(ms / 1000).toFixed(1)}s`;
}

function hardPathState(step?: DemoTraceStep): HardPathState {
  if (!step) return "wait";
  if (passStatuses.has(step.status)) return "pass";
  if (failStatuses.has(step.status)) return "fail";
  return "wait";
}

function hardPathClass(state: HardPathState) {
  if (state === "pass") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  if (state === "fail") return "border-red-400/45 bg-red-400/10 text-red-100";
  return "border-amber-300/35 bg-amber-300/10 text-amber-100";
}

function hardPathCopy(state: HardPathState) {
  if (state === "pass") return "PASS";
  if (state === "fail") return "FAIL";
  return "WAIT";
}

function evidenceClass(tone: "pass" | "fail" | "warn", recorded: boolean) {
  if (!recorded) return "border-zinc-500/40 bg-zinc-500/10 text-zinc-200";
  if (tone === "pass") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  if (tone === "warn") return "border-amber-300/40 bg-amber-300/10 text-amber-100";
  return "border-red-400/40 bg-red-400/10 text-red-100";
}

function metadataValue(value: unknown, key?: string): string {
  if (value === null || value === undefined || value === "") return "none";
  if (typeof value === "string") return key === "candidates" ? value : shortValue(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function traceStep(trace: DemoTrace, id: string): DemoTraceStep | undefined {
  return trace.steps.find((step) => step.id === id);
}

function metadataBoolean(step: DemoTraceStep | undefined, key: string): boolean | null {
  const value = step?.metadata?.[key];
  return typeof value === "boolean" ? value : null;
}

function classifyEvidence(trace: DemoTrace): EvidenceKey | null {
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

function buildScenarioEvidence(traces: DemoTrace[]): ScenarioEvidenceMap {
  const evidence: ScenarioEvidenceMap = {
    fresh: null,
    "invalid-proof": null,
    "unapproved-root": null,
  };

  for (const trace of traces) {
    const key = classifyEvidence(trace);
    if (key && !evidence[key]) {
      evidence[key] = trace;
    }
  }

  return evidence;
}

function evidenceProofRoot(key: EvidenceKey, proofValid: boolean | null, approvedRoot: boolean | null): string {
  if (key === "invalid-proof") {
    return `${metadataValue(proofValid ?? false)} / not evaluated`;
  }
  return `${metadataValue(proofValid)} / ${metadataValue(approvedRoot)}`;
}

function booleanCopy(value: boolean | null | undefined): string {
  if (value === true) return "true";
  if (value === false) return "false";
  return "unknown";
}

function buildPendingSuiteRuns(): JudgeSuiteRun[] {
  return JUDGE_SUITE_CASES.map((item) => ({
    ...item,
    status: "pending",
  }));
}

function suiteRunClass(status: JudgeSuiteRunStatus) {
  if (status === "passed") return "border-emerald-300/45 bg-emerald-300/10 text-emerald-100";
  if (status === "failed") return "border-red-400/45 bg-red-400/10 text-red-100";
  if (status === "running") return "border-cyan-300/45 bg-cyan-300/10 text-cyan-100";
  return "border-white/10 bg-white/[0.03] text-white/45";
}

function suiteVerdictClass(status: "ready" | "running" | "passed" | "failed") {
  if (status === "passed") return "border-emerald-300/45 bg-emerald-300/10 text-emerald-100";
  if (status === "failed") return "border-red-400/45 bg-red-400/10 text-red-100";
  if (status === "running") return "border-cyan-300/45 bg-cyan-300/10 text-cyan-100";
  return "border-white/10 bg-black text-white/55";
}

function artifactStatusClass(status: ArtifactPackResponse["status"]) {
  if (status === "ready") return "border-emerald-300/45 bg-emerald-300/10 text-emerald-100";
  return "border-amber-300/45 bg-amber-300/10 text-amber-100";
}

function preflightStatusClass(status: PreflightReport["status"]) {
  if (status === "ready") return "border-emerald-300/45 bg-emerald-300/10 text-emerald-100";
  if (status === "warning") return "border-amber-300/45 bg-amber-300/10 text-amber-100";
  return "border-red-400/45 bg-red-400/10 text-red-100";
}

function preflightCheckClass(status: PreflightCheck["status"]) {
  if (status === "pass") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  if (status === "warn") return "border-amber-300/40 bg-amber-300/10 text-amber-100";
  return "border-red-400/40 bg-red-400/10 text-red-100";
}

function claimClass(status: "real" | "scoped" | "prototype") {
  if (status === "real") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  if (status === "scoped") return "border-cyan-300/40 bg-cyan-300/10 text-cyan-100";
  return "border-amber-300/40 bg-amber-300/10 text-amber-100";
}

function artifactScenarioClass(scenario: ArtifactScenario) {
  if (!scenario.recorded) return "border-zinc-500/40 bg-zinc-500/10 text-zinc-200";
  if (scenario.key === "fresh") return "border-emerald-300/40 bg-emerald-300/10 text-emerald-100";
  if (scenario.key === "unapproved-root") return "border-amber-300/40 bg-amber-300/10 text-amber-100";
  return "border-red-400/40 bg-red-400/10 text-red-100";
}

function artifactProofRoot(scenario: ArtifactScenario): string {
  const proof = scenario.proofValid === true ? "true" : scenario.proofValid === false ? "false" : "unknown";
  if (scenario.key === "invalid-proof") {
    return `${proof} / not evaluated`;
  }
  const root = scenario.approvedRoot === true ? "true" : scenario.approvedRoot === false ? "false" : "unknown";
  return `${proof} / ${root}`;
}

function suiteScenarioPassed(scenario: DemoScenario, result: DemoRunResult): boolean {
  if (scenario === "happy-path") {
    return (
      result.hire?.zkVerified === true &&
      result.hire.zkProofValid === true &&
      result.hire.zkApprovedRoot === true &&
      result.hire.settlementStatus === "confirmed"
    );
  }

  if (scenario === "tampered-worker-proof") {
    return (
      result.status === "worker_membership_rejected" &&
      result.hire?.zkProofValid === false &&
      !result.hire.settlementStatus
    );
  }

  return (
    result.status === "worker_membership_rejected" &&
    result.hire?.zkProofValid === true &&
    result.hire.zkApprovedRoot === false &&
    !result.hire.settlementStatus
  );
}

function suiteRunFromResult(item: JudgeSuiteCase, result: DemoRunResult): JudgeSuiteRun {
  return {
    ...item,
    status: suiteScenarioPassed(item.scenario, result) ? "passed" : "failed",
    elapsedMs: result.elapsedMs,
    taskId: result.taskId || null,
    txHash: result.payment?.txHash || null,
    txExplorer: result.payment?.explorer || null,
    responseStatus: result.status || null,
    proof: booleanCopy(result.hire?.zkProofValid),
    root: item.scenario === "tampered-worker-proof" ? "not evaluated" : booleanCopy(result.hire?.zkApprovedRoot),
    settlement: result.hire?.settlementStatus || null,
  };
}

function evidenceKeyForScenario(scenario: DemoScenario): EvidenceKey {
  if (scenario === "happy-path") return "fresh";
  if (scenario === "tampered-worker-proof") return "invalid-proof";
  return "unapproved-root";
}

function suiteRunFromEvidence(item: JudgeSuiteCase, evidence: ScenarioEvidenceMap): JudgeSuiteRun {
  const key = evidenceKeyForScenario(item.scenario);
  const trace = evidence[key];
  if (!trace) {
    return {
      ...item,
      status: "pending",
    };
  }

  const workerZk = traceStep(trace, "worker-zk");
  const payment = traceStep(trace, "payment");
  const settlement = traceStep(trace, "settlement");
  const proofValid = metadataBoolean(workerZk, "proofValid");
  const approvedRoot = metadataBoolean(workerZk, "approvedRoot");

  return {
    ...item,
    status: "passed",
    taskId: trace.taskId,
    txHash: payment?.txHash || null,
    txExplorer: payment?.explorer || null,
    responseStatus: trace.status,
    proof: key === "invalid-proof" ? metadataValue(proofValid ?? false) : metadataValue(proofValid),
    root: key === "invalid-proof" ? "not evaluated" : metadataValue(approvedRoot),
    settlement: settlement ? statusCopy[settlement.status] : null,
  };
}

function suiteRunsFromEvidence(evidence: ScenarioEvidenceMap): JudgeSuiteRun[] {
  return JUDGE_SUITE_CASES.map((item) => suiteRunFromEvidence(item, evidence));
}

function suiteRunFromError(item: JudgeSuiteCase, error: unknown): JudgeSuiteRun {
  const message = error instanceof Error ? error.message : String(error);
  return {
    ...item,
    status: "failed",
    error: message,
  };
}

async function executeDemoScenario(scenario: DemoScenario): Promise<DemoRunResult> {
  const startedAt = Date.now();
  const response = await fetch("/api/demo/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(scenario === "happy-path" ? {} : { scenario }),
  });
  const payload = (await response.json().catch(() => ({}))) as DemoRunResponse;
  if (!response.ok) {
    const missing = payload.missing?.length ? ` Missing: ${payload.missing.join(", ")}.` : "";
    throw new Error(`${payload.error || `HTTP ${response.status}`}${missing}`);
  }
  return {
    ...payload,
    elapsedMs: Date.now() - startedAt,
    completedAt: new Date().toISOString(),
  };
}

function TraceStepRow({ step, index }: { step: DemoTraceStep; index: number }) {
  const metadataEntries = Object.entries(step.metadata || {}).filter(([, value]) => value !== undefined);

  return (
    <article className="grid grid-cols-[4rem_minmax(0,1fr)] gap-[1.6rem] border border-white/10 bg-black/45 p-[1.6rem]">
      <div className="flex h-[4rem] w-[4rem] items-center justify-center border border-white/15 text-[1.2rem] text-white/70">
        {String(index + 1).padStart(2, "0")}
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-[1rem]">
          <h2 className="text-[1.5rem] font-semibold tracking-[0.08em] text-white">
            {step.label}
          </h2>
          <span className={`border px-[1rem] py-[0.5rem] text-[1.1rem] tracking-[0.12em] ${statusClasses[step.status]}`}>
            {statusCopy[step.status]}
          </span>
        </div>
        <p className="mt-[1rem] text-[1.25rem] leading-relaxed text-white/55">
          {step.detail}
        </p>

        <div className="mt-[1.3rem] grid gap-[0.7rem] text-[1.1rem] text-white/45">
          {step.txHash && (
            <div className="min-w-0 break-all">
              <span className="text-white/75">tx:</span>{" "}
              {step.explorer ? (
                <a className="text-cyan-200 underline decoration-cyan-200/30 underline-offset-4" href={step.explorer} target="_blank" rel="noreferrer">
                  {shortValue(step.txHash)}
                </a>
              ) : (
                shortValue(step.txHash)
              )}
            </div>
          )}
          {step.contractId && (
            <div className="min-w-0 break-all">
              <span className="text-white/75">contract:</span> {shortValue(step.contractId)}
            </div>
          )}
          {step.hash && (
            <div className="min-w-0 break-all">
              <span className="text-white/75">hash:</span> {shortValue(step.hash)}
            </div>
          )}
        </div>

        {metadataEntries.length > 0 && (
          <div className="mt-[1.3rem] grid gap-[0.6rem] border-t border-white/10 pt-[1rem] text-[1.05rem] text-white/40 sm:grid-cols-2">
            {metadataEntries.map(([key, value]) => (
              <div key={key} className="min-w-0">
                <span className="uppercase tracking-[0.12em] text-white/25">{key}:</span>{" "}
                <span className="break-all text-white/60">{metadataValue(value, key)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

function HardPathChecklist({
  items,
}: {
  items: Array<{ id: string; label: string; evidence: string; step?: DemoTraceStep; state: HardPathState }>;
}) {
  return (
    <section className="border border-white/10 bg-black/55 p-[1.8rem]">
      <h2 className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">Current Trace Checklist</h2>
      <div className="mt-[1.2rem] grid gap-[0.8rem]">
        {items.map((item, index) => (
          <div key={item.id} className="grid grid-cols-[2.4rem_minmax(0,1fr)_5.8rem] items-center gap-[0.9rem] border border-white/10 bg-white/[0.03] p-[1rem]">
            <div className="text-[1rem] text-white/35">{String(index + 1).padStart(2, "0")}</div>
            <div className="min-w-0">
              <div className="truncate text-[1.1rem] text-white/75">{item.label}</div>
              <div className="truncate text-[0.95rem] text-white/35">{item.evidence}</div>
            </div>
            <div className={`border px-[0.7rem] py-[0.4rem] text-center text-[0.95rem] tracking-[0.12em] ${hardPathClass(item.state)}`}>
              {hardPathCopy(item.state)}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function LoadBearingZkPanel({ step }: { step?: DemoTraceStep }) {
  const state = hardPathState(step);
  const metadata = step?.metadata || {};

  return (
    <section className="border border-white/10 bg-black/55 p-[1.8rem]">
      <div className="flex items-center justify-between gap-[1rem]">
        <h2 className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">Load-Bearing ZK Gate</h2>
        <span className={`border px-[0.8rem] py-[0.4rem] text-[0.95rem] tracking-[0.12em] ${hardPathClass(state)}`}>
          {hardPathCopy(state)}
        </span>
      </div>
      <p className="mt-[1rem] text-[1.15rem] leading-relaxed text-white/45">
        Worker delegation depends on this private membership proof. If proof verification or root approval fails, the task is not delegated.
      </p>
      <div className="mt-[1.2rem] grid gap-[0.8rem] text-[1.1rem]">
        <div className="flex justify-between gap-[1rem]">
          <span className="text-white/35">circuit</span>
          <span className="text-white/70">{metadataValue(step?.metadata?.circuit || "membership_proof")}</span>
        </div>
        <div className="flex justify-between gap-[1rem]">
          <span className="text-white/35">method</span>
          <span className="text-white/70">{metadataValue((metadata as Record<string, unknown>).method || step?.metadata?.context || "unknown")}</span>
        </div>
        <div className="flex justify-between gap-[1rem]">
          <span className="text-white/35">proof valid</span>
          <span className="text-white/70">{metadataValue((metadata as Record<string, unknown>).proofValid)}</span>
        </div>
        <div className="flex justify-between gap-[1rem]">
          <span className="text-white/35">approved root</span>
          <span className="text-white/70">{metadataValue((metadata as Record<string, unknown>).approvedRoot)}</span>
        </div>
        {step?.txHash && (
          <a className="break-all text-cyan-200 underline decoration-cyan-200/30 underline-offset-4" href={step.explorer || undefined} target="_blank" rel="noreferrer">
            zk tx: {shortValue(step.txHash)}
          </a>
        )}
      </div>
    </section>
  );
}

function DecisionMatrix() {
  return (
    <section className="border border-white/10 bg-black/55 p-[1.8rem]">
      <h2 className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">ZK Decision Matrix</h2>
      <div className="mt-[1.2rem] grid gap-[0.8rem]">
        {DECISION_MATRIX.map((item) => (
          <div key={item.scenario} className="border border-white/10 bg-white/[0.03] p-[1rem]">
            <div className="flex flex-wrap items-center justify-between gap-[0.8rem]">
              <div className="text-[1.1rem] uppercase tracking-[0.14em] text-white/75">{item.scenario}</div>
              <div className={`border px-[0.7rem] py-[0.4rem] text-[0.95rem] uppercase tracking-[0.12em] ${
                item.tone === "pass"
                  ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-100"
                  : item.tone === "warn"
                    ? "border-amber-300/40 bg-amber-300/10 text-amber-100"
                    : "border-red-400/40 bg-red-400/10 text-red-100"
              }`}>
                {item.decision}
              </div>
            </div>
            <div className="mt-[0.8rem] grid gap-[0.5rem] text-[1.05rem] text-white/45">
              <div className="flex justify-between gap-[1rem]">
                <span>proof</span>
                <span className="text-white/70">{item.proof}</span>
              </div>
              <div className="flex justify-between gap-[1rem]">
                <span>root</span>
                <span className="text-white/70">{item.root}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ScenarioEvidence({ evidence }: { evidence: ScenarioEvidenceMap }) {
  const recordedCount = EVIDENCE_CASES.filter((item) => evidence[item.key]).length;

  return (
    <section className="border border-white/10 bg-black/55 p-[1.8rem]">
      <div className="flex items-center justify-between gap-[1rem]">
        <h2 className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">Scenario Evidence</h2>
        <span className="border border-white/10 bg-black px-[0.8rem] py-[0.4rem] text-[0.95rem] text-white/55">
          {recordedCount}/{EVIDENCE_CASES.length}
        </span>
      </div>
      <div className="mt-[1.2rem] grid gap-[0.8rem]">
        {EVIDENCE_CASES.map((item) => {
          const trace = evidence[item.key];
          const workerZk = trace ? traceStep(trace, "worker-zk") : undefined;
          const payment = trace ? traceStep(trace, "payment") : undefined;
          const settlement = trace ? traceStep(trace, "settlement") : undefined;
          const proofValid = metadataBoolean(workerZk, "proofValid");
          const approvedRoot = metadataBoolean(workerZk, "approvedRoot");

          return (
            <div key={item.key} className="border border-white/10 bg-white/[0.03] p-[1rem]">
              <div className="flex flex-wrap items-center justify-between gap-[0.8rem]">
                <div className="text-[1.05rem] uppercase tracking-[0.14em] text-white/75">{item.title}</div>
                <div className={`border px-[0.7rem] py-[0.4rem] text-[0.95rem] uppercase tracking-[0.12em] ${evidenceClass(item.tone, !!trace)}`}>
                  {trace ? trace.status : "missing"}
                </div>
              </div>
              <div className="mt-[0.8rem] text-[1.05rem] text-white/35">{item.expected}</div>
              <div className="mt-[0.8rem] grid gap-[0.5rem] text-[1.05rem] text-white/45">
                <div className="flex justify-between gap-[1rem]">
                  <span>task</span>
                  <span className="break-all text-white/70">{shortValue(trace?.taskId)}</span>
                </div>
                <div className="flex justify-between gap-[1rem]">
                  <span>proof/root</span>
                  <span className="text-white/70">{evidenceProofRoot(item.key, proofValid, approvedRoot)}</span>
                </div>
                <div className="flex justify-between gap-[1rem]">
                  <span>settlement</span>
                  <span className="text-white/70">{settlement ? statusCopy[settlement.status] : "none"}</span>
                </div>
                {payment?.txHash && (
                  <a className="break-all text-cyan-200 underline decoration-cyan-200/30 underline-offset-4" href={payment.explorer || undefined} target="_blank" rel="noreferrer">
                    tx: {shortValue(payment.txHash)}
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function JudgeSuitePanel({
  runs,
  result,
  running,
  evidenceReady,
}: {
  runs: JudgeSuiteRun[];
  result: JudgeSuiteResult | null;
  running: boolean;
  evidenceReady: boolean;
}) {
  const completedCount = runs.filter((run) => run.status === "passed" || run.status === "failed").length;
  const verdict = running ? "running" : result?.status || (evidenceReady ? "passed" : "ready");

  return (
    <section className="mb-[1.2rem] border border-white/10 bg-black/55 p-[1.6rem]">
      <div className="flex flex-wrap items-center justify-between gap-[1rem]">
        <div>
          <h2 className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">One-Click Judge Suite</h2>
          <div className="mt-[0.6rem] text-[1.1rem] text-white/35">
            {running
              ? `${completedCount}/${runs.length} scenarios complete`
              : result
                ? `${runs.filter((run) => run.status === "passed").length}/${runs.length} scenarios passed in ${formatDuration(result.elapsedMs)}`
                : evidenceReady
                  ? `${runs.filter((run) => run.status === "passed").length}/${runs.length} scenarios recorded from trace history`
                : "Ready to run the full evidence bundle"}
          </div>
        </div>
        <span className={`border px-[1rem] py-[0.5rem] text-[1rem] uppercase tracking-[0.14em] ${suiteVerdictClass(verdict)}`}>
          {verdict}
        </span>
      </div>
      <div className="mt-[1.2rem] grid gap-[0.8rem]">
        {runs.map((run) => (
          <div key={run.scenario} className="grid gap-[0.9rem] border border-white/10 bg-white/[0.03] p-[1rem] lg:grid-cols-[minmax(0,1.1fr)_8rem_minmax(0,1fr)]">
            <div className="min-w-0">
              <div className="text-[1.1rem] uppercase tracking-[0.14em] text-white/75">{run.title}</div>
              <div className="mt-[0.5rem] text-[1.05rem] leading-relaxed text-white/35">{run.expected}</div>
            </div>
            <div className={`self-start border px-[0.7rem] py-[0.45rem] text-center text-[0.95rem] uppercase tracking-[0.12em] ${suiteRunClass(run.status)}`}>
              {run.status}
            </div>
            <div className="grid gap-[0.45rem] text-[1.05rem] text-white/45">
              {run.error ? (
                <div className="break-all text-red-100">{run.error}</div>
              ) : (
                <>
                  <div className="flex justify-between gap-[1rem]">
                    <span>status</span>
                    <span className="text-white/70">{run.responseStatus || "waiting"}</span>
                  </div>
                  <div className="flex justify-between gap-[1rem]">
                    <span>proof/root</span>
                    <span className="text-white/70">{run.proof || "unknown"} / {run.root || "unknown"}</span>
                  </div>
                  <div className="flex justify-between gap-[1rem]">
                    <span>settlement</span>
                    <span className="text-white/70">{run.settlement || "none"}</span>
                  </div>
                  {run.txHash && (
                    <a className="break-all text-cyan-200 underline decoration-cyan-200/30 underline-offset-4" href={run.txExplorer || undefined} target="_blank" rel="noreferrer">
                      tx: {shortValue(run.txHash)}
                    </a>
                  )}
                  {run.taskId && (
                    <div className="break-all text-white/35">task: {shortValue(run.taskId)}</div>
                  )}
                  {run.elapsedMs && (
                    <div className="text-white/35">duration: {formatDuration(run.elapsedMs)}</div>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function JudgePreflightPanel({ report }: { report: PreflightReport | null }) {
  if (!report) {
    return (
      <section className="mb-[1.2rem] border border-white/10 bg-black/55 p-[1.6rem]">
        <div className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">Judge Preflight</div>
        <div className="mt-[0.8rem] text-[1.1rem] text-white/35">Loading gateway readiness checks.</div>
      </section>
    );
  }

  const aliveWorkers = report.workers.filter((worker) => worker.alive).length;

  return (
    <section className="mb-[1.2rem] border border-white/10 bg-black/55 p-[1.6rem]">
      <div className="flex flex-wrap items-start justify-between gap-[1rem]">
        <div>
          <h2 className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">Judge Preflight</h2>
          <div className="mt-[0.6rem] text-[1.1rem] text-white/35">
            402 challenge, Stellar env, mesh workers and claim boundaries checked before live suite execution.
          </div>
        </div>
        <span className={`border px-[1rem] py-[0.5rem] text-[1rem] uppercase tracking-[0.14em] ${preflightStatusClass(report.status)}`}>
          {report.status}
        </span>
      </div>

      <div className="mt-[1.2rem] grid gap-[1rem] md:grid-cols-4">
        <div className="border border-white/10 bg-white/[0.03] p-[1rem]">
          <div className="text-[0.95rem] uppercase tracking-[0.16em] text-white/30">402 challenge</div>
          <div className="mt-[0.45rem] text-[1.45rem] text-white">{report.challenge.ok ? "PASS" : "FAIL"}</div>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-[1rem]">
          <div className="text-[0.95rem] uppercase tracking-[0.16em] text-white/30">Workers alive</div>
          <div className="mt-[0.45rem] text-[1.45rem] text-white">{aliveWorkers}/{report.workers.length}</div>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-[1rem]">
          <div className="text-[0.95rem] uppercase tracking-[0.16em] text-white/30">Payer</div>
          <div className="mt-[0.45rem] text-[1.45rem] text-white">{report.runtime.payerConfigured ? "READY" : "MISSING"}</div>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-[1rem]">
          <div className="text-[0.95rem] uppercase tracking-[0.16em] text-white/30">Amount</div>
          <div className="mt-[0.45rem] text-[1.45rem] text-white">{report.runtime.demoAmount}</div>
        </div>
      </div>

      <div className="mt-[1.2rem] grid gap-[0.8rem]">
        {report.checks.map((check) => (
          <div key={check.id} className="grid gap-[0.8rem] border border-white/10 bg-white/[0.03] p-[1rem] md:grid-cols-[18rem_minmax(0,1fr)_7rem]">
            <div className="text-[1.05rem] uppercase tracking-[0.14em] text-white/75">{check.label}</div>
            <div className="min-w-0 text-[1.05rem] leading-relaxed text-white/40">
              {check.detail}
              {check.evidence && <div className="mt-[0.35rem] break-all text-white/60">{check.evidence}</div>}
            </div>
            <div className={`self-start border px-[0.7rem] py-[0.4rem] text-center text-[0.95rem] uppercase tracking-[0.12em] ${preflightCheckClass(check.status)}`}>
              {check.status}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-[1.2rem] grid gap-[0.8rem] md:grid-cols-2">
        {report.workers.map((worker) => (
          <div key={worker.url} className="border border-white/10 bg-white/[0.03] p-[1rem]">
            <div className="flex flex-wrap items-center justify-between gap-[0.8rem]">
              <div className="min-w-0 break-all text-[1.05rem] text-white/75">{worker.name || shortValue(worker.url)}</div>
              <span className={`border px-[0.7rem] py-[0.35rem] text-[0.9rem] uppercase tracking-[0.12em] ${preflightCheckClass(worker.alive ? "pass" : "fail")}`}>
                {worker.status}
              </span>
            </div>
            <div className="mt-[0.7rem] grid gap-[0.45rem] text-[1.02rem] text-white/40">
              <div className="break-all">agent: {worker.agentId || "none"}</div>
              <div>guild: {worker.guildMember === true ? "member" : worker.guildMember === false ? "public" : "unknown"}</div>
              <div>latency: {worker.latencyMs === null ? "none" : `${worker.latencyMs}ms`}</div>
              <div className="break-all">capabilities: {worker.capabilities.length ? worker.capabilities.join(", ") : "none"}</div>
            </div>
          </div>
        ))}
      </div>

      <h3 className="mt-[1.2rem] text-[1.05rem] uppercase tracking-[0.16em] text-white/35">Claim Boundaries</h3>
      <div className="mt-[0.8rem] grid gap-[0.8rem]">
        {report.claimBoundaries.map((claim) => (
          <div key={claim.claim} className="grid gap-[0.8rem] border border-white/10 bg-white/[0.03] p-[1rem] md:grid-cols-[18rem_8rem_minmax(0,1fr)]">
            <div className="text-[1.05rem] uppercase tracking-[0.14em] text-white/75">{claim.claim}</div>
            <div className={`self-start border px-[0.7rem] py-[0.35rem] text-center text-[0.9rem] uppercase tracking-[0.12em] ${claimClass(claim.status)}`}>
              {claim.status}
            </div>
            <div className="text-[1.05rem] leading-relaxed text-white/40">{claim.evidence}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function JudgeArtifactPack({ pack }: { pack: ArtifactPackResponse | null }) {
  const [copied, setCopied] = useState(false);
  const copyArtifactPack = useCallback(async () => {
    if (!pack?.copyText) return;
    try {
      await navigator.clipboard.writeText(pack.copyText);
    } catch {
      // The visible preformatted pack remains available when clipboard permission is denied.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [pack]);

  if (!pack) {
    return (
      <section className="mb-[1.2rem] border border-white/10 bg-black/55 p-[1.6rem]">
        <div className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">Judge Artifact Pack</div>
        <div className="mt-[0.8rem] text-[1.1rem] text-white/35">Loading evidence pack.</div>
      </section>
    );
  }

  return (
    <section className="mb-[1.2rem] border border-white/10 bg-black/55 p-[1.6rem]">
      <div className="flex flex-wrap items-start justify-between gap-[1rem]">
        <div>
          <h2 className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">Judge Artifact Pack</h2>
          <div className="mt-[0.6rem] text-[1.1rem] text-white/35">{pack.verdict}</div>
        </div>
        <div className="flex flex-wrap gap-[0.8rem]">
          <span className={`border px-[1rem] py-[0.5rem] text-[1rem] uppercase tracking-[0.14em] ${artifactStatusClass(pack.status)}`}>
            {pack.status}
          </span>
          <button
            onClick={copyArtifactPack}
            className="border border-white/15 bg-white/[0.04] px-[1rem] py-[0.5rem] text-[1rem] uppercase tracking-[0.14em] text-white/70 transition hover:border-cyan-300/50 hover:text-cyan-200"
          >
            {copied ? "COPIED" : "COPY PACK"}
          </button>
        </div>
      </div>

      <div className="mt-[1.2rem] grid gap-[1rem] md:grid-cols-3">
        <div className="border border-white/10 bg-white/[0.03] p-[1rem]">
          <div className="text-[0.95rem] uppercase tracking-[0.16em] text-white/30">Suite coverage</div>
          <div className="mt-[0.45rem] text-[1.5rem] text-white">{pack.coverage.recorded}/{pack.coverage.total}</div>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-[1rem]">
          <div className="text-[0.95rem] uppercase tracking-[0.16em] text-white/30">Current trace path</div>
          <div className="mt-[0.45rem] text-[1.5rem] text-white">{pack.currentTrace.hardPathPassed}/{pack.currentTrace.hardPathTotal}</div>
        </div>
        <div className="border border-white/10 bg-white/[0.03] p-[1rem]">
          <div className="text-[0.95rem] uppercase tracking-[0.16em] text-white/30">Current trace</div>
          <div className="mt-[0.45rem] break-all text-[1.2rem] text-white">{pack.currentTrace.status}</div>
        </div>
      </div>

      <div className="mt-[0.9rem] text-[1.05rem] leading-relaxed text-white/35">{pack.currentTrace.note}</div>

      <div className="mt-[1.2rem] grid gap-[0.8rem]">
        {pack.scenarios.map((scenario) => (
          <div key={scenario.key} className="grid gap-[0.9rem] border border-white/10 bg-white/[0.03] p-[1rem] lg:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)]">
            <div className="min-w-0">
              <div className="text-[1.1rem] uppercase tracking-[0.14em] text-white/75">{scenario.title}</div>
              <div className="mt-[0.5rem] text-[1.05rem] leading-relaxed text-white/35">{scenario.expected}</div>
            </div>
            <div className={`self-start border px-[0.7rem] py-[0.45rem] text-center text-[0.95rem] uppercase tracking-[0.12em] ${artifactScenarioClass(scenario)}`}>
              {scenario.recorded ? scenario.traceStatus : "missing"}
            </div>
            <div className="grid gap-[0.45rem] text-[1.05rem] text-white/45">
              <div className="flex justify-between gap-[1rem]">
                <span>decision</span>
                <span className="text-white/70">{scenario.decision}</span>
              </div>
              <div className="flex justify-between gap-[1rem]">
                <span>proof/root</span>
                <span className="text-white/70">{artifactProofRoot(scenario)}</span>
              </div>
              <div className="flex justify-between gap-[1rem]">
                <span>task</span>
                <span className="break-all text-white/70">{shortValue(scenario.taskId)}</span>
              </div>
              {scenario.paymentExplorer && scenario.paymentTx && (
                <a className="break-all text-cyan-200 underline decoration-cyan-200/30 underline-offset-4" href={scenario.paymentExplorer} target="_blank" rel="noreferrer">
                  payment tx: {shortValue(scenario.paymentTx)}
                </a>
              )}
              {scenario.proofExplorer && scenario.proofTx && (
                <a className="break-all text-cyan-200 underline decoration-cyan-200/30 underline-offset-4" href={scenario.proofExplorer} target="_blank" rel="noreferrer">
                  proof tx: {shortValue(scenario.proofTx)}
                </a>
              )}
              {scenario.settlementExplorer && scenario.settlementTx && (
                <a className="break-all text-cyan-200 underline decoration-cyan-200/30 underline-offset-4" href={scenario.settlementExplorer} target="_blank" rel="noreferrer">
                  settlement tx: {shortValue(scenario.settlementTx)}
                </a>
              )}
              {scenario.receiptId && (
                <div className="break-all text-white/35">receipt: {shortValue(scenario.receiptId)}</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-[1.2rem] grid gap-[1rem] md:grid-cols-2">
        <a className="block border border-white/10 bg-white/[0.03] p-[1rem] text-cyan-200 hover:border-cyan-300/40" href={pack.contracts.membershipVerifier.explorer} target="_blank" rel="noreferrer">
          <div className="text-[0.95rem] uppercase tracking-[0.16em] text-white/30">membership verifier</div>
          <div className="mt-[0.5rem] break-all text-[1.05rem]">{pack.contracts.membershipVerifier.id}</div>
        </a>
        <a className="block border border-white/10 bg-white/[0.03] p-[1rem] text-cyan-200 hover:border-cyan-300/40" href={pack.contracts.guildRegistry.explorer} target="_blank" rel="noreferrer">
          <div className="text-[0.95rem] uppercase tracking-[0.16em] text-white/30">guild registry</div>
          <div className="mt-[0.5rem] break-all text-[1.05rem]">{pack.contracts.guildRegistry.id}</div>
        </a>
      </div>

      <pre className="mt-[1.2rem] max-h-[22rem] overflow-auto whitespace-pre-wrap border border-white/10 bg-black/50 p-[1rem] text-[1rem] leading-relaxed text-white/45">
        {pack.copyText}
      </pre>
    </section>
  );
}

function ArtifactList({ artifacts }: { artifacts: Record<string, string | null | undefined> }) {
  const entries = Object.entries(artifacts).filter(([, value]) => !!value);
  if (entries.length === 0) {
    return <div className="text-[1.2rem] text-white/35">No receipt hashes recorded.</div>;
  }

  return (
    <div className="grid gap-[1rem]">
      {entries.map(([key, value]) => (
        <div key={key} className="border border-white/10 bg-white/[0.03] p-[1.2rem]">
          <div className="text-[1rem] uppercase tracking-[0.16em] text-white/35">{key}</div>
          <div className="mt-[0.5rem] break-all text-[1.15rem] text-white/75">{value}</div>
        </div>
      ))}
    </div>
  );
}

export default function DemoPage() {
  const [data, setData] = useState<TraceResponse | null>(null);
  const [artifactPack, setArtifactPack] = useState<ArtifactPackResponse | null>(null);
  const [preflight, setPreflight] = useState<PreflightReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<DemoRunResult | null>(null);
  const [suiteRunning, setSuiteRunning] = useState(false);
  const [suiteRuns, setSuiteRuns] = useState<JudgeSuiteRun[]>(() => buildPendingSuiteRuns());
  const [suiteResult, setSuiteResult] = useState<JudgeSuiteResult | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [traceResponse, artifactResponse, preflightResponse] = await Promise.all([
        fetch("/api/demo/trace", { cache: "no-store" }),
        fetch("/api/demo/artifact-pack", { cache: "no-store" }),
        fetch("/api/demo/preflight", { cache: "no-store" }),
      ]);
      if (!traceResponse.ok) {
        throw new Error(`Trace HTTP ${traceResponse.status}`);
      }
      if (!artifactResponse.ok) {
        throw new Error(`Artifact Pack HTTP ${artifactResponse.status}`);
      }
      if (!preflightResponse.ok) {
        throw new Error(`Preflight HTTP ${preflightResponse.status}`);
      }
      setData(await traceResponse.json());
      setArtifactPack(await artifactResponse.json());
      setPreflight(await preflightResponse.json());
    } catch (traceError) {
      const message = traceError instanceof Error ? traceError.message : String(traceError);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const runTraceScenario = useCallback(async (scenario: DemoScenario) => {
    try {
      setRunning(true);
      setRunError(null);
      setRunResult(null);
      setRunResult(await executeDemoScenario(scenario));
      await refresh();
    } catch (runTraceError) {
      const message = runTraceError instanceof Error ? runTraceError.message : String(runTraceError);
      setRunError(message);
    } finally {
      setRunning(false);
    }
  }, [refresh]);

  const runJudgeSuite = useCallback(async () => {
    const startedAt = Date.now();
    let nextRuns = buildPendingSuiteRuns();
    setSuiteRunning(true);
    setRunError(null);
    setRunResult(null);
    setSuiteResult(null);
    setSuiteRuns(nextRuns);

    try {
      for (const item of JUDGE_SUITE_CASES) {
        nextRuns = nextRuns.map((run) =>
          run.scenario === item.scenario ? { ...run, status: "running" } : run,
        );
        setSuiteRuns(nextRuns);

        try {
          const result = await executeDemoScenario(item.scenario);
          const completedRun = suiteRunFromResult(item, result);
          nextRuns = nextRuns.map((run) => (run.scenario === item.scenario ? completedRun : run));
          setRunResult(result);
          setSuiteRuns(nextRuns);
          await refresh();
        } catch (suiteError) {
          const failedRun = suiteRunFromError(item, suiteError);
          nextRuns = nextRuns.map((run) => (run.scenario === item.scenario ? failedRun : run));
          setSuiteRuns(nextRuns);
        }
      }

      const suiteStatus = nextRuns.every((run) => run.status === "passed") ? "passed" : "failed";
      setSuiteResult({
        status: suiteStatus,
        elapsedMs: Date.now() - startedAt,
      });
      setRunError(suiteStatus === "passed" ? null : "Judge suite finished with one or more failed scenarios.");
      await refresh();
    } finally {
      setSuiteRunning(false);
    }
  }, [refresh]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const trace = data?.trace || null;
  const stepsById = useMemo(() => new Map((trace?.steps || []).map((step) => [step.id, step])), [trace]);
  const hardPathItems = useMemo(
    () => HARD_PATH.map((item) => {
      const step = stepsById.get(item.id);
      return { ...item, step, state: hardPathState(step) };
    }),
    [stepsById],
  );
  const hardPathPassCount = hardPathItems.filter((item) => item.state === "pass").length;
  const scenarioEvidence = useMemo(() => buildScenarioEvidence(data?.traces || []), [data?.traces]);
  const evidenceSuiteRuns = useMemo(() => suiteRunsFromEvidence(scenarioEvidence), [scenarioEvidence]);
  const visibleSuiteRuns = suiteRunning || suiteResult ? suiteRuns : evidenceSuiteRuns;
  const evidenceSuiteReady = !suiteRunning && !suiteResult && evidenceSuiteRuns.every((run) => run.status === "passed");
  const meshStep = stepsById.get("mesh-routing");
  const meshCandidateCount = typeof meshStep?.metadata?.candidateCount === "number" ? meshStep.metadata.candidateCount : null;
  const workerZkStep = stepsById.get("worker-zk");
  const settlementStep = stepsById.get("settlement");
  const busy = running || suiteRunning;
  const statusLabel = useMemo(() => {
    if (loading) return "LOADING";
    if (error) return "ERROR";
    return trace ? trace.status.toUpperCase() : "EMPTY";
  }, [error, loading, trace]);

  return (
    <main className="min-h-screen bg-[#050608] pt-[12rem] pb-[6rem] font-mono text-white">
      <Nav />
      <section className="mx-auto grid w-full max-w-[150rem] gap-[2.4rem] px-[4vw] lg:grid-cols-[minmax(0,1fr)_42rem]">
        <div className="min-w-0">
          <div className="mb-[2.4rem] border-b border-white/10 pb-[2rem]">
            <div className="flex flex-wrap items-end justify-between gap-[1.6rem]">
              <div>
                <p className="text-[1.1rem] uppercase tracking-[0.24em] text-white/35">
                  Stellar Testnet / Judge Mode
                </p>
                <h1 className="mt-[0.8rem] text-[3.6rem] font-semibold tracking-[0.02em] text-white">
                  x402 ZK Mesh Execution Trace
                </h1>
                <p className="mt-[1rem] max-w-[86rem] text-[1.25rem] leading-relaxed text-white/45">
                  Paid agent mesh with private ZK admission control: workers execute only when the proof is valid and the guild root is approved.
                </p>
              </div>
              <div className="flex flex-wrap gap-[0.8rem]">
                <button
                  onClick={runJudgeSuite}
                  disabled={busy}
                  className="border border-cyan-300/50 bg-cyan-300/10 px-[1.6rem] py-[1rem] text-[1.1rem] tracking-[0.16em] text-cyan-100 transition hover:border-cyan-200 disabled:cursor-wait disabled:opacity-50"
                >
                  {suiteRunning ? "SUITE RUNNING" : "RUN JUDGE SUITE"}
                </button>
                <button
                  onClick={() => runTraceScenario("happy-path")}
                  disabled={busy}
                  className="border border-emerald-300/45 bg-emerald-300/10 px-[1.6rem] py-[1rem] text-[1.1rem] tracking-[0.16em] text-emerald-100 transition hover:border-emerald-200 disabled:cursor-wait disabled:opacity-50"
                >
                  {running ? "RUNNING" : "RUN FRESH TRACE"}
                </button>
                <button
                  onClick={() => runTraceScenario("tampered-worker-proof")}
                  disabled={busy}
                  className="border border-red-300/45 bg-red-300/10 px-[1.6rem] py-[1rem] text-[1.1rem] tracking-[0.16em] text-red-100 transition hover:border-red-200 disabled:cursor-wait disabled:opacity-50"
                >
                  RUN BLOCKED TRACE
                </button>
                <button
                  onClick={() => runTraceScenario("unapproved-worker-root")}
                  disabled={busy}
                  className="border border-amber-300/45 bg-amber-300/10 px-[1.6rem] py-[1rem] text-[1.1rem] tracking-[0.16em] text-amber-100 transition hover:border-amber-200 disabled:cursor-wait disabled:opacity-50"
                >
                  RUN UNAPPROVED ROOT
                </button>
                <button
                  onClick={refresh}
                  className="border border-white/15 bg-white/[0.04] px-[1.6rem] py-[1rem] text-[1.1rem] tracking-[0.16em] text-white/70 transition hover:border-cyan-300/50 hover:text-cyan-200"
                >
                  REFRESH
                </button>
              </div>
            </div>
            <div className="mt-[1.6rem] flex flex-wrap gap-[1rem] text-[1.1rem] uppercase tracking-[0.14em]">
              <span className="border border-white/10 bg-black px-[1rem] py-[0.6rem] text-white/55">
                STATUS: {statusLabel}
              </span>
              <span className="border border-white/10 bg-black px-[1rem] py-[0.6rem] text-white/55">
                NETWORK: STELLAR TESTNET
              </span>
              {trace?.taskId && (
                <span className="border border-white/10 bg-black px-[1rem] py-[0.6rem] text-white/55">
                  TASK: {shortValue(trace.taskId)}
                </span>
              )}
            </div>
            <div className="mt-[1.4rem] grid gap-[1rem] sm:grid-cols-4">
              <div className="border border-white/10 bg-black/50 p-[1.2rem]">
                <div className="text-[0.95rem] uppercase tracking-[0.16em] text-white/30">Current trace path</div>
                <div className="mt-[0.4rem] text-[1.5rem] text-white">{hardPathPassCount}/{HARD_PATH.length}</div>
              </div>
              <div className="border border-white/10 bg-black/50 p-[1.2rem]">
                <div className="text-[0.95rem] uppercase tracking-[0.16em] text-white/30">Mesh route</div>
                <div className="mt-[0.4rem] text-[1.5rem] text-white">
                  {meshStep ? `${statusCopy[meshStep.status]} / ${meshCandidateCount ?? "?"}` : "WAIT"}
                </div>
              </div>
              <div className="border border-white/10 bg-black/50 p-[1.2rem]">
                <div className="text-[0.95rem] uppercase tracking-[0.16em] text-white/30">ZK worker gate</div>
                <div className="mt-[0.4rem] text-[1.5rem] text-white">{hardPathCopy(hardPathState(workerZkStep))}</div>
              </div>
              <div className="border border-white/10 bg-black/50 p-[1.2rem]">
                <div className="text-[0.95rem] uppercase tracking-[0.16em] text-white/30">Settlement</div>
                <div className="mt-[0.4rem] text-[1.5rem] text-white">{settlementStep ? statusCopy[settlementStep.status] : "WAIT"}</div>
              </div>
            </div>
          </div>

          <JudgePreflightPanel report={preflight} />
          <JudgeSuitePanel
            runs={visibleSuiteRuns}
            result={suiteResult}
            running={suiteRunning}
            evidenceReady={evidenceSuiteReady}
          />
          <JudgeArtifactPack pack={artifactPack} />

          {error && (
            <div className="border border-red-400/30 bg-red-400/10 p-[1.6rem] text-[1.3rem] text-red-100">
              Trace API error: {error}
            </div>
          )}

          {runError && (
            <div className="mb-[1.2rem] border border-amber-300/30 bg-amber-300/10 p-[1.6rem] text-[1.25rem] leading-relaxed text-amber-100">
              Fresh trace did not start: {runError}
            </div>
          )}

          {running && (
            <div className="mb-[1.2rem] border border-cyan-300/30 bg-cyan-300/10 p-[1.6rem] text-[1.25rem] leading-relaxed text-cyan-100">
              Live run in progress: payment, ZK gate, delegation and settlement are executing.
            </div>
          )}

          {runResult && !running && (
            <div className="mb-[1.2rem] border border-emerald-300/30 bg-emerald-300/10 p-[1.6rem] text-[1.15rem] text-emerald-50">
              <div className="flex flex-wrap gap-[1rem] uppercase tracking-[0.14em] text-emerald-100">
                <span>LAST RUN: {runResult.status || "submitted"}</span>
                <span>{formatDuration(runResult.elapsedMs)}</span>
                <span>{formatTime(runResult.completedAt)}</span>
              </div>
              <div className="mt-[1rem] grid gap-[0.7rem] text-white/55 sm:grid-cols-2">
                <div className="min-w-0 break-all">task: {runResult.taskId || "none"}</div>
                <div className="min-w-0 break-all">
                  tx:{" "}
                  {runResult.payment?.explorer && runResult.payment.txHash ? (
                    <a className="text-cyan-200 underline decoration-cyan-200/30 underline-offset-4" href={runResult.payment.explorer} target="_blank" rel="noreferrer">
                      {shortValue(runResult.payment.txHash)}
                    </a>
                  ) : (
                    shortValue(runResult.payment?.txHash)
                  )}
                </div>
                <div>worker: {runResult.hire?.workerStatus || "none"}</div>
                <div>zk: {runResult.hire?.zkVerified === true ? "verified" : runResult.hire?.zkVerified === false ? "rejected" : "unknown"} / {runResult.hire?.zkMethod || "unknown"}</div>
                <div>proof: {runResult.hire?.zkProofValid === true ? "valid" : runResult.hire?.zkProofValid === false ? "invalid" : "unknown"}</div>
                <div>root: {runResult.hire?.zkApprovedRoot === true ? "approved" : runResult.hire?.zkApprovedRoot === false ? "unapproved" : "unknown"}</div>
                <div>settlement: {runResult.hire?.settlementStatus || "none"}</div>
                <div>scenario: {runResult.scenario || "happy-path"}</div>
              </div>
            </div>
          )}

          {!trace && !error && (
            <div className="border border-white/10 bg-black/45 p-[2rem] text-[1.4rem] text-white/50">
              Awaiting the first recorded /api/hire response.
            </div>
          )}

          {trace && (
            <div className="grid gap-[1.2rem]">
              <p className="mb-[0.6rem] max-w-[90rem] text-[1.35rem] leading-relaxed text-white/55">
                {trace.summary}
              </p>
              {trace.steps.map((step, index) => (
                <TraceStepRow key={step.id} step={step} index={index} />
              ))}
            </div>
          )}
        </div>

        <aside className="grid content-start gap-[1.6rem]">
          <DecisionMatrix />
          <ScenarioEvidence evidence={scenarioEvidence} />
          <HardPathChecklist items={hardPathItems} />
          <LoadBearingZkPanel step={workerZkStep} />

          <section className="border border-white/10 bg-black/55 p-[1.8rem]">
            <h2 className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">Relayers</h2>
            <div className="mt-[1.2rem] grid gap-[0.9rem] text-[1.2rem]">
              <div className="flex justify-between gap-[1rem]">
                <span className="text-white/45">ZK verifier</span>
                <span className={data?.relayers.zkVerifier ? "text-emerald-200" : "text-amber-200"}>
                  {data?.relayers.zkVerifier ? "enabled" : "disabled"}
                </span>
              </div>
              <div className="flex justify-between gap-[1rem]">
                <span className="text-white/45">Guild registry</span>
                <span className={data?.relayers.guildRegistry ? "text-emerald-200" : "text-amber-200"}>
                  {data?.relayers.guildRegistry ? "enabled" : "disabled"}
                </span>
              </div>
            </div>
          </section>

          <section className="border border-white/10 bg-black/55 p-[1.8rem]">
            <h2 className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">Contracts</h2>
            <div className="mt-[1.2rem] grid gap-[1rem] text-[1.15rem]">
              {data?.contracts.membershipVerifier && (
                <a className="block border border-white/10 bg-white/[0.03] p-[1.2rem] text-cyan-200 hover:border-cyan-300/40" href={data.contracts.membershipVerifier.explorer} target="_blank" rel="noreferrer">
                  <div className="text-white/35">membership verifier</div>
                  <div className="mt-[0.5rem] break-all">{data.contracts.membershipVerifier.id}</div>
                </a>
              )}
              {data?.contracts.guildRegistry && (
                <a className="block border border-white/10 bg-white/[0.03] p-[1.2rem] text-cyan-200 hover:border-cyan-300/40" href={data.contracts.guildRegistry.explorer} target="_blank" rel="noreferrer">
                  <div className="text-white/35">guild registry</div>
                  <div className="mt-[0.5rem] break-all">{data.contracts.guildRegistry.id}</div>
                </a>
              )}
            </div>
          </section>

          <section className="border border-white/10 bg-black/55 p-[1.8rem]">
            <h2 className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">Receipt Hashes</h2>
            <div className="mt-[1.2rem]">
              {trace ? <ArtifactList artifacts={trace.artifacts} /> : <div className="text-[1.2rem] text-white/35">No trace selected.</div>}
            </div>
          </section>

          <section className="border border-white/10 bg-black/55 p-[1.8rem] text-[1.15rem] text-white/45">
            <div>Last API sample: {formatTime(data?.generatedAt)}</div>
            <div className="mt-[0.7rem]">Trace created: {formatTime(trace?.createdAt)}</div>
            <div className="mt-[0.7rem] break-all">Trace id: {trace?.id || "none"}</div>
          </section>
        </aside>
      </section>
    </main>
  );
}
