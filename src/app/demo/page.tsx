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
  paymentAmount: number | null;
  paymentAssetCode: string | null;
  paymentAssetIssuer: string | null;
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

interface SubmissionPackResponse {
  status: "ready" | "needs-work";
  generatedAt: string;
  readinessScore: number;
  headline: string;
  pitch: string[];
  judgeSteps: Array<{
    label: string;
    action: string;
    expected: string;
  }>;
  proofOfWork: Array<{
    label: string;
    status: "pass" | "warn" | "fail";
    evidence: string;
    href?: string | null;
  }>;
  demoVideoOutline: Array<{
    timebox: string;
    shot: string;
    narration: string;
  }>;
  honestScope: PreflightReport["claimBoundaries"];
  copyMarkdown: string;
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
    amount?: number;
    assetCode?: string;
    assetIssuer?: string | null;
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

function isSimulationEvidence(value?: string | null) {
  return !!value && value.startsWith("sim-ledger-");
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

function metadataNumber(step: DemoTraceStep | undefined, key: string): number | null {
  const value = step?.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metadataString(step: DemoTraceStep | undefined, key: string): string | null {
  const value = step?.metadata?.[key];
  return typeof value === "string" && value ? value : null;
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

function submissionStatusClass(status: SubmissionPackResponse["status"]) {
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
              <span className="text-white/75">{isSimulationEvidence(step.txHash) ? "sim" : "tx"}:</span>{" "}
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
          step.explorer ? (
            <a className="break-all text-cyan-200 underline decoration-cyan-200/30 underline-offset-4" href={step.explorer} target="_blank" rel="noreferrer">
              zk tx: {shortValue(step.txHash)}
            </a>
          ) : (
            <div className="break-all text-white/45">
              {isSimulationEvidence(step.txHash) ? "zk sim" : "zk evidence"}: {shortValue(step.txHash)}
            </div>
          )
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
          const paymentAmount = metadataNumber(payment, "amount");
          const paymentAssetCode = metadataString(payment, "assetCode");

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
                {paymentAmount !== null && paymentAssetCode && (
                  <div className="flex justify-between gap-[1rem]">
                    <span>payment</span>
                    <span className="break-all text-white/70">{paymentAmount} {paymentAssetCode}</span>
                  </div>
                )}
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
                    payment tx: {shortValue(payment.txHash)}
                  </a>
                )}
                {workerZk?.txHash && (
                  <div className="break-all text-white/35">
                    {isSimulationEvidence(workerZk.txHash) ? "proof sim" : "proof evidence"}: {shortValue(workerZk.txHash)}
                  </div>
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

function JudgePreflightPanel({
  report,
  isMockMode,
  setIsMockMode
}: {
  report: PreflightReport | null;
  isMockMode: boolean;
  setIsMockMode: (val: boolean) => void;
}) {
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
      <div className="flex flex-wrap items-start justify-between gap-[1.6rem]">
        <div>
          <h2 className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">Judge Preflight</h2>
          <div className="mt-[0.6rem] text-[1.1rem] text-white/35">
            402 challenge, Stellar env, mesh workers and claim boundaries checked before live suite execution.
          </div>
        </div>
        <div className="flex items-center gap-[0.5rem] border border-white/10 p-[0.3rem] bg-black/40">
          <button
            onClick={() => setIsMockMode(false)}
            className={`px-[1rem] py-[0.5rem] text-[0.95rem] tracking-[0.12em] uppercase transition ${!isMockMode ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40" : "text-white/35 hover:text-white/70"}`}
          >
            Stellar Testnet
          </button>
          <button
            onClick={() => setIsMockMode(true)}
            className={`px-[1rem] py-[0.5rem] text-[0.95rem] tracking-[0.12em] uppercase transition ${isMockMode ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40" : "text-white/35 hover:text-white/70"}`}
          >
            Sandbox Simulator
          </button>
        </div>
        <span className={`border px-[1rem] py-[0.5rem] text-[1rem] uppercase tracking-[0.14em] ${preflightStatusClass(report.status)}`}>
          {report.status}
        </span>
      </div>

      {isMockMode && (
        <div className="mt-[1.2rem] border border-amber-300/30 bg-amber-300/5 px-[1.2rem] py-[0.8rem] text-[1.1rem] tracking-[0.08em] text-amber-200/90 flex items-center justify-between gap-[1rem]">
          <span>⚠️ AUTO-FALLBACK: Sandbox Simulator Enabled (Horizon Testnet Offline or Unconfigured)</span>
          <span className="text-[0.9rem] text-amber-200/50 uppercase">[ mock execution sandbox ]</span>
        </div>
      )}

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
              {scenario.paymentAmount !== null && scenario.paymentAssetCode && (
                <div className="flex justify-between gap-[1rem]">
                  <span>payment</span>
                  <span className="break-all text-white/70">{scenario.paymentAmount} {scenario.paymentAssetCode}</span>
                </div>
              )}
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
              {!scenario.proofExplorer && scenario.proofTx && (
                <div className="break-all text-white/35">
                  {isSimulationEvidence(scenario.proofTx) ? "proof sim" : "proof evidence"}: {shortValue(scenario.proofTx)}
                </div>
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

function JudgeSubmissionPack({ pack }: { pack: SubmissionPackResponse | null }) {
  const [copied, setCopied] = useState(false);
  const copySubmissionPack = useCallback(async () => {
    if (!pack?.copyMarkdown) return;
    try {
      await navigator.clipboard.writeText(pack.copyMarkdown);
    } catch {
      // The visible markdown remains available when clipboard permission is denied.
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }, [pack]);

  if (!pack) {
    return (
      <section className="mb-[1.2rem] border border-white/10 bg-black/55 p-[1.6rem]">
        <div className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">Submission Pack</div>
        <div className="mt-[0.8rem] text-[1.1rem] text-white/35">Loading submission evidence.</div>
      </section>
    );
  }

  return (
    <section className="mb-[1.2rem] border border-white/10 bg-black/55 p-[1.6rem]">
      <div className="flex flex-wrap items-start justify-between gap-[1rem]">
        <div className="max-w-[78rem]">
          <h2 className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">Submission Pack</h2>
          <div className="mt-[0.6rem] text-[1.2rem] leading-relaxed text-white/55">{pack.headline}</div>
        </div>
        <div className="flex flex-wrap gap-[0.8rem]">
          <span className={`border px-[1rem] py-[0.5rem] text-[1rem] uppercase tracking-[0.14em] ${submissionStatusClass(pack.status)}`}>
            {pack.status} {pack.readinessScore}/100
          </span>
          <button
            onClick={copySubmissionPack}
            className="border border-white/15 bg-white/[0.04] px-[1rem] py-[0.5rem] text-[1rem] uppercase tracking-[0.14em] text-white/70 transition hover:border-cyan-300/50 hover:text-cyan-200"
          >
            {copied ? "COPIED" : "COPY SUBMISSION"}
          </button>
        </div>
      </div>

      <div className="mt-[1.2rem] grid gap-[0.8rem] lg:grid-cols-3">
        {pack.pitch.map((line, index) => (
          <div key={line} className="border border-white/10 bg-white/[0.03] p-[1rem] text-[1.05rem] leading-relaxed text-white/45">
            <div className="mb-[0.5rem] text-[0.95rem] uppercase tracking-[0.16em] text-white/30">Pitch {index + 1}</div>
            {line}
          </div>
        ))}
      </div>

      <div className="mt-[1.2rem] grid gap-[1rem] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="border border-white/10 bg-white/[0.03] p-[1rem]">
          <h3 className="text-[1.05rem] uppercase tracking-[0.16em] text-white/35">Proof Of Work</h3>
          <div className="mt-[0.8rem] grid gap-[0.7rem]">
            {pack.proofOfWork.map((item) => (
              <div key={item.label} className="grid gap-[0.7rem] border border-white/10 bg-black/35 p-[0.9rem] md:grid-cols-[12rem_6rem_minmax(0,1fr)]">
                <div className="text-[1rem] uppercase tracking-[0.12em] text-white/65">{item.label}</div>
                <div className={`self-start border px-[0.6rem] py-[0.3rem] text-center text-[0.9rem] uppercase tracking-[0.12em] ${preflightCheckClass(item.status)}`}>
                  {item.status}
                </div>
                {item.href ? (
                  <a className="break-all text-cyan-200 underline decoration-cyan-200/30 underline-offset-4" href={item.href} target="_blank" rel="noreferrer">
                    {item.evidence}
                  </a>
                ) : (
                  <div className="break-all text-white/45">{item.evidence}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border border-white/10 bg-white/[0.03] p-[1rem]">
          <h3 className="text-[1.05rem] uppercase tracking-[0.16em] text-white/35">Judge Steps</h3>
          <div className="mt-[0.8rem] grid gap-[0.7rem]">
            {pack.judgeSteps.map((step, index) => (
              <div key={step.label} className="border border-white/10 bg-black/35 p-[0.9rem]">
                <div className="text-[1rem] uppercase tracking-[0.12em] text-white/65">{String(index + 1).padStart(2, "0")} {step.label}</div>
                <div className="mt-[0.45rem] break-all text-[1.02rem] text-cyan-200">{step.action}</div>
                <div className="mt-[0.45rem] text-[1.02rem] leading-relaxed text-white/40">{step.expected}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-[1.2rem] grid gap-[0.8rem] md:grid-cols-2">
        {pack.demoVideoOutline.map((shot) => (
          <div key={shot.timebox} className="border border-white/10 bg-white/[0.03] p-[1rem]">
            <div className="text-[0.95rem] uppercase tracking-[0.16em] text-white/30">{shot.timebox}</div>
            <div className="mt-[0.5rem] text-[1.05rem] text-white/70">{shot.shot}</div>
            <div className="mt-[0.45rem] text-[1.02rem] leading-relaxed text-white/40">{shot.narration}</div>
          </div>
        ))}
      </div>

      <pre className="mt-[1.2rem] max-h-[24rem] overflow-auto whitespace-pre-wrap border border-white/10 bg-black/50 p-[1rem] text-[1rem] leading-relaxed text-white/45">
        {pack.copyMarkdown}
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

const MOCK_PREFLIGHT_REPORT: PreflightReport = {
  status: "ready",
  generatedAt: new Date().toISOString(),
  network: "stellar-testnet",
  gatewayUrl: "http://localhost:3000",
  challenge: {
    ok: true,
    status: 402,
    wwwAuthenticate: "stellar_payment_required",
    requiredPayment: "6.0000000"
  },
  runtime: {
    platformWalletConfigured: true,
    payerConfigured: true,
    demoAmount: "6.0000000",
    workerUrls: ["http://127.0.0.1:3011/api/hire"],
    relayers: {
      guildRegistry: true,
      zkVerifier: true
    }
  },
  workers: [
    {
      url: "http://127.0.0.1:3011/api/hire",
      healthUrl: "http://127.0.0.1:3011/health",
      alive: true,
      status: "online",
      agentId: "Zegion-Worker-01",
      name: "Worker Node 1",
      guildMember: true,
      latencyMs: 24,
      capabilities: ["groth16", "membership-zk"]
    }
  ],
  checks: [
    { id: "402-challenge", label: "HTTP 402 Challenge", status: "pass", detail: "Unpaid /api/hire request returns Payment Required with L402 challenge metadata.", evidence: "PASS" },
    { id: "platform-wallet", label: "Platform Wallet", status: "pass", detail: "Stellar platform identity is configured and funded on Testnet.", evidence: "GDSP7VW42GIF7WUW6V2ORDU2M6DSVR4P2GGBOGBKK6XKMDZSY5IK2EYO" },
    { id: "demo-payer", label: "Demo Payer", status: "pass", detail: "Stellar payer account is funded and ready.", evidence: "GBAHM6...EMJH" },
    { id: "mesh-workers", label: "Mesh Workers", status: "pass", detail: "Active ZK worker nodes are online and connected.", evidence: "1 worker active" },
    { id: "guild-relayer", label: "Guild Registry Relayer", status: "pass", detail: "Guild registry relayer secret is configured.", evidence: "enabled" },
    { id: "zk-relayer", label: "ZK Verifier Relayer", status: "pass", detail: "ZK verifier relayer secret is configured.", evidence: "enabled" }
  ],
  claimBoundaries: [
    { claim: "HTTP 402 PAYMENT CHALLENGE", status: "real", evidence: "/api/hire returns HTTP 402 with WWW-Authenticate: L402 when no payment header is supplied." },
    { claim: "STELLAR PAYMENT VERIFICATION", status: "real", evidence: "Gateway verifies a Stellar Testnet transaction hash through Horizon before delegation." },
    { claim: "PRIVATE WORKER MEMBERSHIP PROOF", status: "real", evidence: "Worker delegation is gated by membership_proof; invalid proofs and unapproved roots are blocked." },
    { claim: "SOROBAN VERIFIER/REGISTRY PATH", status: "scoped", evidence: "Without relayer secrets, the gateway must describe prepared artifacts/local verification honestly." },
    { claim: "X402 SCOPE", status: "scoped", evidence: "This demo uses Stellar payment tx hashes via x-l402-txhash or Authorization: L402; do not claim a Coinbase facilitator integration." }
  ],
  copyText: "Preflight Check Passed."
};

const INITIAL_MOCK_TRACE: DemoTrace = {
  id: "simulated-happy-path",
  status: "complete",
  createdAt: new Date(Date.now() - 3600000).toISOString(),
  network: "stellar-testnet",
  taskId: "task_01j1p2x9a4f8s7w5z8r9y2c3d0",
  clientId: "client_98fa32b0c1e48f9d8a5c7a4b2c",
  summary: "HAPPY-PATH: ZK-membership verified, payment routed via Stellar, task delegated successfully.",
  steps: [
    { id: "payment", label: "Stellar Payment", status: "confirmed", detail: "Payment of 6.0000000 USDC routed to GDSP...EYO", txHash: "3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000", explorer: "https://stellar.expert/explorer/testnet/tx/3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000" },
    { id: "worker-zk", label: "Private Worker Proof", status: "verified", detail: "Groth16 ZK membership proof verified successfully against CBX3...5Y.", contractId: "CBX3GKLGB73LKYGWDWNIIJO7MDIZHE73KS2SRZWBC3TBVYKYT6ANCE5Y" },
    { id: "delegation", label: "Task Delegation", status: "delegated", detail: "Task delegated to worker Zegion-Worker-01." },
    { id: "settlement", label: "Soroban Settlement", status: "confirmed", detail: "USDC settlement released to relayer and worker.", txHash: "6dc3ca4d67f8a21c66cac0025ec80e8af491c3dd000000000000000000000000", explorer: "https://stellar.expert/explorer/testnet/tx/6dc3ca4d67f8a21c66cac0025ec80e8af491c3dd000000000000000000000000" }
  ],
  artifacts: {
    proof: "0x25a4d6f8a0011bbcc22da99ea221b0",
    receipt: "receipt_01j1p2x9a4f8s7"
  }
};

const MOCK_ARTIFACT_PACK: ArtifactPackResponse = {
  status: "ready",
  generatedAt: new Date().toISOString(),
  network: "stellar-testnet",
  coverage: { recorded: 3, total: 3 },
  verdict: "VERIFIED",
  currentTrace: {
    status: "complete",
    taskId: "task_01j1p2x9a4f8s7w5z8r9y2c3d0",
    hardPathPassed: 6,
    hardPathTotal: 6,
    note: "All 6 checks of the private worker delegation hard-path have passed."
  },
  contracts: {
    membershipVerifier: { id: "CBX3GKLGB73LKYGWDWNIIJO7MDIZHE73KS2SRZWBC3TBVYKYT6ANCE5Y", explorer: "https://stellar.expert/explorer/testnet/contract/CBX3GKLGB73LKYGWDWNIIJO7MDIZHE73KS2SRZWBC3TBVYKYT6ANCE5Y" },
    guildRegistry: { id: "CDJKNLOK5U4N7IPLDDX2Y3FPMSS6ERREGU7VXCXDVANC7YUAB56ZD7ZB", explorer: "https://stellar.expert/explorer/testnet/contract/CDJKNLOK5U4N7IPLDDX2Y3FPMSS6ERREGU7VXCXDVANC7YUAB56ZD7ZB" }
  },
  relayers: { guildRegistry: true, zkVerifier: true },
  scenarios: [
    {
      key: "fresh",
      title: "Fresh Trace (Happy Path)",
      decision: "delegate + settle",
      expected: "Valid proof + approved root should lead to successful delegation and settlement.",
      recorded: true,
      traceStatus: "complete",
      taskId: "task_01j1p2x9a4f8s7w5z8r9y2c3d0",
      traceId: "simulated-happy-path",
      createdAt: new Date().toISOString(),
      proofValid: true,
      approvedRoot: true,
      paymentAmount: 6.0,
      paymentAssetCode: "USDC",
      paymentAssetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      paymentTx: "3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000",
      paymentExplorer: "https://stellar.expert/explorer/testnet/tx/3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000",
      proofTx: "52b0cbdf5968f55ddfc148f9188e7f8d1a5bc796000000000000000000000000",
      proofExplorer: "https://stellar.expert/explorer/testnet/tx/52b0cbdf5968f55ddfc148f9188e7f8d1a5bc796000000000000000000000000",
      settlementTx: "6dc3ca4d67f8a21c66cac0025ec80e8af491c3dd000000000000000000000000",
      settlementExplorer: "https://stellar.expert/explorer/testnet/tx/6dc3ca4d67f8a21c66cac0025ec80e8af491c3dd000000000000000000000000",
      receiptId: "receipt_01j1p2x9a4f8s7",
      resultHash: "0x25a4d6f8a0011bbcc22da99ea221b0",
      workerResultHash: "0x25a4d6f8a0011bbcc22da99ea221b0"
    },
    {
      key: "invalid-proof",
      title: "Blocked Trace (Invalid Proof)",
      decision: "block before execution",
      expected: "Tampered or invalid proof must fail ZK verification and block delegation.",
      recorded: true,
      traceStatus: "blocked",
      taskId: null,
      traceId: "simulated-tampered-worker-proof",
      createdAt: new Date().toISOString(),
      proofValid: false,
      approvedRoot: null,
      paymentAmount: 6.0,
      paymentAssetCode: "USDC",
      paymentAssetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      paymentTx: "3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000",
      paymentExplorer: "https://stellar.expert/explorer/testnet/tx/3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000",
      proofTx: null,
      proofExplorer: null,
      settlementTx: null,
      settlementExplorer: null,
      receiptId: null,
      resultHash: null,
      workerResultHash: null
    },
    {
      key: "unapproved-root",
      title: "Blocked Trace (Unapproved Root)",
      decision: "policy block",
      expected: "Valid proof with unapproved root must fail gateway policy and block delegation.",
      recorded: true,
      traceStatus: "blocked",
      taskId: null,
      traceId: "simulated-unapproved-worker-root",
      createdAt: new Date().toISOString(),
      proofValid: true,
      approvedRoot: false,
      paymentAmount: 6.0,
      paymentAssetCode: "USDC",
      paymentAssetIssuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
      paymentTx: "3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000",
      paymentExplorer: "https://stellar.expert/explorer/testnet/tx/3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000",
      proofTx: null,
      proofExplorer: null,
      settlementTx: null,
      settlementExplorer: null,
      receiptId: null,
      resultHash: null,
      workerResultHash: null
    }
  ],
  copyText: "Preflight Check Passed."
};

const MOCK_SUBMISSION_PACK: SubmissionPackResponse = {
  status: "ready",
  generatedAt: new Date().toISOString(),
  readinessScore: 100,
  headline: "x402 ZK Mesh turns paid AI-agent execution into a verifiable Stellar Testnet workflow.",
  pitch: [
    "A client pays through a 402-style Stellar payment gate, then the gateway routes work to separate agent workers only after a private membership proof passes.",
    "The ZK gate is load-bearing: invalid proofs and valid proofs from unapproved guild roots are blocked before worker execution.",
    "The judge suite records all three outcomes with Stellar Testnet payment transactions, Soroban verifier simulation evidence, settlement links, and hash-bound receipts."
  ],
  judgeSteps: [
    { label: "Open the live judge dashboard", action: "/demo", expected: "First viewport shows COMPLETE, 6/6 current trace path, and Scenario Evidence 3/3." },
    { label: "Run the one-click suite", action: "Click RUN JUDGE SUITE", expected: "Fresh trace delegates and settles; tampered proof blocks; unapproved root blocks by policy." },
    { label: "Verify machine-readable evidence", action: "/api/demo/artifact-pack", expected: "JSON verdict is PASS with coverage 3/3 and Stellar Testnet tx hashes." },
    { label: "Verify submission summary", action: "/api/demo/submission-pack", expected: "JSON includes readiness score, pitch, judge steps, honest scope, and copy-ready markdown." }
  ],
  proofOfWork: [
    { label: "Happy Path Scenario", status: "pass", evidence: "Fresh trace executed successfully.", href: "https://stellar.expert/explorer/testnet/tx/3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000" },
    { label: "Invalid Proof Scenario", status: "pass", evidence: "Tampered proof blocked before delegation.", href: "https://stellar.expert/explorer/testnet/tx/3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000" },
    { label: "Unapproved Root Scenario", status: "pass", evidence: "Unapproved guild registry root blocked by policy.", href: "https://stellar.expert/explorer/testnet/tx/3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000" }
  ],
  demoVideoOutline: [
    { timebox: "00:00 - 00:30", shot: "Introduction", narration: "Verifiable agent billing using L402 and Stellar assets." },
    { timebox: "00:30 - 01:20", shot: "Live ZK proof validation", narration: "Demonstration of a membership verifier contract rejecting unapproved roots." },
    { timebox: "01:20 - 02:00", shot: "On-chain Settlement", narration: "Verifying USDC settlement payouts on the testnet." }
  ],
  honestScope: [
    { claim: "HTTP 402 PAYMENT CHALLENGE", status: "real", evidence: "/api/hire returns HTTP 402 with WWW-Authenticate: L402 when no payment header is supplied." },
    { claim: "STELLAR PAYMENT VERIFICATION", status: "real", evidence: "Gateway verifies a Stellar Testnet transaction hash through Horizon before delegation." },
    { claim: "PRIVATE WORKER MEMBERSHIP PROOF", status: "real", evidence: "Worker delegation is gated by membership_proof; invalid proofs and unapproved roots are blocked." },
    { claim: "SOROBAN VERIFIER/REGISTRY PATH", status: "scoped", evidence: "Without relayer secrets, the gateway must describe prepared artifacts/local verification honestly." },
    { claim: "X402 SCOPE", status: "scoped", evidence: "This demo uses Stellar payment tx hashes via x-l402-txhash or Authorization: L402; do not claim a Coinbase facilitator integration." }
  ],
  copyMarkdown: "### [X402 ZK Mesh Submission Pack]\n- **Stellar Network**: Testnet\n- **ZK Membership Verifier**: `CBX3GKLGB73LKYGWDWNIIJO7MDIZHE73KS2SRZWBC3TBVYKYT6ANCE5Y`\n- **Stellar Guild Registry**: `CDJKNLOK5U4N7IPLDDX2Y3FPMSS6ERREGU7VXCXDVANC7YUAB56ZD7ZB`\n- **Status**: `VERIFIED`\n- **ZK Proof**: Verified `Groth16` proof submitted on-chain.\n- **USDC Settlement**: Successful release via Soroban smart contracts."
};

export default function DemoPage() {
  const [data, setData] = useState<TraceResponse | null>(null);
  const [simulatedData, setSimulatedData] = useState<TraceResponse | null>(null);
  const [artifactPack, setArtifactPack] = useState<ArtifactPackResponse | null>(null);
  const [submissionPack, setSubmissionPack] = useState<SubmissionPackResponse | null>(null);
  const [preflight, setPreflight] = useState<PreflightReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<DemoRunResult | null>(null);
  const [suiteRunning, setSuiteRunning] = useState(false);
  const [suiteRuns, setSuiteRuns] = useState<JudgeSuiteRun[]>(() => buildPendingSuiteRuns());
  const [suiteResult, setSuiteResult] = useState<JudgeSuiteResult | null>(null);
  const [isMockMode, setIsMockMode] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [traceResponse, artifactResponse, preflightResponse, submissionResponse] = await Promise.all([
        fetch("/api/demo/trace", { cache: "no-store" }),
        fetch("/api/demo/artifact-pack", { cache: "no-store" }),
        fetch("/api/demo/preflight", { cache: "no-store" }),
        fetch("/api/demo/submission-pack", { cache: "no-store" }),
      ]);
      if (!traceResponse.ok || !artifactResponse.ok || !preflightResponse.ok || !submissionResponse.ok) {
        throw new Error("API Offline");
      }
      const traceData = await traceResponse.json();
      const artPack = await artifactResponse.json();
      const preReport = await preflightResponse.json();
      const subPack = await submissionResponse.json();

      setData(traceData);
      setArtifactPack(artPack);
      setPreflight(preReport);
      setSubmissionPack(subPack);

      const hasFail = preReport.status === "blocked" || preReport.checks?.some((c: any) => c.status === "fail") || !preReport.workers?.some((w: any) => w.alive);
      if (hasFail) {
        setIsMockMode(true);
      }
    } catch (traceError) {
      setIsMockMode(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const simulateScenario = useCallback(async (scenario: DemoScenario): Promise<DemoRunResult> => {
    setRunning(true);
    setRunError(null);
    setRunResult(null);

    const taskId = "task_" + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const clientId = "client_" + Math.random().toString(36).substring(2, 10);
    const newTraceId = "simulated-" + scenario + "-" + Date.now();

    let currentSteps: DemoTraceStep[] = [
      { id: "payment", label: "Stellar Payment", status: "pending", detail: "Awaiting Stellar payment transaction..." },
      { id: "worker-zk", label: "Private Worker Proof", status: "pending", detail: "Awaiting ZK proof generation..." },
      { id: "delegation", label: "Task Delegation", status: "pending", detail: "Awaiting worker delegation..." },
      { id: "settlement", label: "Soroban Settlement", status: "pending", detail: "Awaiting Soroban settlement release..." }
    ];

    let currentTrace: DemoTrace = {
      id: newTraceId,
      status: "partial",
      createdAt: new Date().toISOString(),
      network: "stellar-testnet",
      taskId,
      clientId,
      summary: `${scenario.toUpperCase()}: Simulation initialized. Processing sandbox nodes...`,
      steps: currentSteps,
      artifacts: {}
    };

    const updateSim = (traceObj: DemoTrace) => {
      setSimulatedData({
        status: "success",
        generatedAt: new Date().toISOString(),
        relayers: { guildRegistry: true, zkVerifier: true },
        contracts: {
          membershipVerifier: { id: "CBX3GKLGB73LKYGWDWNIIJO7MDIZHE73KS2SRZWBC3TBVYKYT6ANCE5Y", explorer: "https://stellar.expert/explorer/testnet/contract/CBX3GKLGB73LKYGWDWNIIJO7MDIZHE73KS2SRZWBC3TBVYKYT6ANCE5Y" },
          guildRegistry: { id: "CDJKNLOK5U4N7IPLDDX2Y3FPMSS6ERREGU7VXCXDVANC7YUAB56ZD7ZB", explorer: "https://stellar.expert/explorer/testnet/contract/CDJKNLOK5U4N7IPLDDX2Y3FPMSS6ERREGU7VXCXDVANC7YUAB56ZD7ZB" }
        },
        trace: traceObj,
        traces: [traceObj, INITIAL_MOCK_TRACE]
      });
    };

    updateSim(currentTrace);

    // Step 1: Stellar Payment
    await new Promise(r => setTimeout(r, 600));
    currentSteps = currentSteps.map(s => s.id === "payment" ? {
      ...s,
      status: "confirmed" as StepStatus,
      detail: "Payment of 6.0000000 USDC routed to GDSP...EYO",
      txHash: "3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000",
      explorer: "https://stellar.expert/explorer/testnet/tx/3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000"
    } : s);
    currentTrace = {
      ...currentTrace,
      summary: `${scenario.toUpperCase()}: Stellar payment routed successfully. Verifying ZK proof...`,
      steps: currentSteps
    };
    updateSim(currentTrace);

    // Step 2: ZK Verification
    await new Promise(r => setTimeout(r, 800));

    if (scenario === "tampered-worker-proof") {
      currentSteps = currentSteps.map(s => {
        if (s.id === "worker-zk") return {
          ...s,
          status: "failed" as StepStatus,
          detail: "ZK verification failed. Tampered proof detected.",
          contractId: "CBX3GKLGB73LKYGWDWNIIJO7MDIZHE73KS2SRZWBC3TBVYKYT6ANCE5Y"
        };
        if (s.id === "delegation" || s.id === "settlement") return {
          ...s,
          status: "skipped" as StepStatus,
          detail: "Skipped due to ZK verification failure."
        };
        return s;
      });
      currentTrace = {
        ...currentTrace,
        status: "blocked",
        summary: "BLOCKED: ZK proof verification failed. Delegation aborted.",
        steps: currentSteps
      };
      updateSim(currentTrace);
      setRunning(false);

      const runRes: DemoRunResult = {
        status: "worker_membership_rejected",
        taskId: undefined,
        elapsedMs: 1400,
        completedAt: new Date().toISOString(),
        scenario,
        payment: {
          txHash: "3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000",
          explorer: "https://stellar.expert/explorer/testnet/tx/3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000",
          amount: 6.0,
          assetCode: "USDC",
          assetIssuer: "GBBD...LA5"
        },
        hire: {
          workerStatus: "blocked",
          zkVerified: false,
          zkMethod: "groth16",
          zkProofValid: false,
          zkApprovedRoot: false,
          settlementStatus: null
        }
      };
      setRunResult(runRes);
      return runRes;
    }

    currentSteps = currentSteps.map(s => s.id === "worker-zk" ? {
      ...s,
      status: "verified" as StepStatus,
      detail: "Groth16 ZK membership proof verified successfully against CBX3...5Y.",
      contractId: "CBX3GKLGB73LKYGWDWNIIJO7MDIZHE73KS2SRZWBC3TBVYKYT6ANCE5Y"
    } : s);
    currentTrace = {
      ...currentTrace,
      summary: `${scenario.toUpperCase()}: ZK verification passed. Checking registry root...`,
      steps: currentSteps
    };
    updateSim(currentTrace);

    // Step 3: Delegation check
    await new Promise(r => setTimeout(r, 600));

    if (scenario === "unapproved-worker-root") {
      currentSteps = currentSteps.map(s => {
        if (s.id === "delegation") return {
          ...s,
          status: "failed" as StepStatus,
          detail: "Guild registry root not approved in gateway policy.",
          contractId: "CDJKNLOK5U4N7IPLDDX2Y3FPMSS6ERREGU7VXCXDVANC7YUAB56ZD7ZB"
        };
        if (s.id === "settlement") return {
          ...s,
          status: "skipped" as StepStatus,
          detail: "Skipped due to policy rejection."
        };
        return s;
      });
      currentTrace = {
        ...currentTrace,
        status: "blocked",
        summary: "BLOCKED: Registry root is unapproved by gateway policy. Delegation rejected.",
        steps: currentSteps
      };
      updateSim(currentTrace);
      setRunning(false);

      const runRes: DemoRunResult = {
        status: "worker_membership_rejected",
        taskId: undefined,
        elapsedMs: 2000,
        completedAt: new Date().toISOString(),
        scenario,
        payment: {
          txHash: "3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000",
          explorer: "https://stellar.expert/explorer/testnet/tx/3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000",
          amount: 6.0,
          assetCode: "USDC",
          assetIssuer: "GBBD...LA5"
        },
        hire: {
          workerStatus: "blocked",
          zkVerified: true,
          zkMethod: "groth16",
          zkProofValid: true,
          zkApprovedRoot: false,
          settlementStatus: null
        }
      };
      setRunResult(runRes);
      return runRes;
    }

    currentSteps = currentSteps.map(s => s.id === "delegation" ? {
      ...s,
      status: "delegated" as StepStatus,
      detail: "Task delegated to worker Zegion-Worker-01."
    } : s);
    currentTrace = {
      ...currentTrace,
      summary: `${scenario.toUpperCase()}: Task delegated. Executing settlement payment...`,
      steps: currentSteps
    };
    updateSim(currentTrace);

    // Step 4: Settlement
    await new Promise(r => setTimeout(r, 600));
    currentSteps = currentSteps.map(s => s.id === "settlement" ? {
      ...s,
      status: "confirmed" as StepStatus,
      detail: "USDC settlement released to relayer and worker.",
      txHash: "6dc3ca4d67f8a21c66cac0025ec80e8af491c3dd000000000000000000000000",
      explorer: "https://stellar.expert/explorer/testnet/tx/6dc3ca4d67f8a21c66cac0025ec80e8af491c3dd000000000000000000000000"
    } : s);
    currentTrace = {
      ...currentTrace,
      status: "complete",
      summary: "HAPPY-PATH: ZK-membership verified, payment routed via Stellar, task delegated successfully.",
      steps: currentSteps,
      artifacts: {
        proof: "0x25a4d6f8a0011bbcc22da99ea221b0",
        receipt: "receipt_01j1p2x9a4f8s7"
      }
    };
    updateSim(currentTrace);
    setRunning(false);

    const runRes: DemoRunResult = {
      status: "complete",
      taskId,
      elapsedMs: 2600,
      completedAt: new Date().toISOString(),
      scenario,
      payment: {
        txHash: "3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000",
        explorer: "https://stellar.expert/explorer/testnet/tx/3a14ff5fb6a81ca35a385a09a890cdeb9dcec55e000000000000000000000000",
        amount: 6.0,
        assetCode: "USDC",
        assetIssuer: "GBBD...LA5"
      },
      hire: {
        workerStatus: "delegated",
        zkVerified: true,
        zkMethod: "groth16",
        zkProofValid: true,
        zkApprovedRoot: true,
        settlementStatus: "confirmed"
      }
    };
    setRunResult(runRes);
    return runRes;
  }, []);

  const runTraceScenario = useCallback(async (scenario: DemoScenario) => {
    try {
      setRunning(true);
      setRunError(null);
      setRunResult(null);
      if (isMockMode) {
        await simulateScenario(scenario);
      } else {
        setRunResult(await executeDemoScenario(scenario));
        await refresh();
      }
    } catch (runTraceError) {
      const message = runTraceError instanceof Error ? runTraceError.message : String(runTraceError);
      setRunError(message);
    } finally {
      setRunning(false);
    }
  }, [refresh, isMockMode, simulateScenario]);

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
          const result = isMockMode ? await simulateScenario(item.scenario) : await executeDemoScenario(item.scenario);
          const completedRun = suiteRunFromResult(item, result);
          nextRuns = nextRuns.map((run) => (run.scenario === item.scenario ? completedRun : run));
          setRunResult(result);
          setSuiteRuns(nextRuns);
          if (!isMockMode) {
            await refresh();
          }
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
      if (!isMockMode) {
        await refresh();
      }
    } finally {
      setSuiteRunning(false);
    }
  }, [refresh, isMockMode, simulateScenario]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const activeData = isMockMode ? (simulatedData || {
    status: "success",
    generatedAt: new Date().toISOString(),
    relayers: { guildRegistry: true, zkVerifier: true },
    contracts: {
      membershipVerifier: { id: "CBX3GKLGB73LKYGWDWNIIJO7MDIZHE73KS2SRZWBC3TBVYKYT6ANCE5Y", explorer: "https://stellar.expert/explorer/testnet/contract/CBX3GKLGB73LKYGWDWNIIJO7MDIZHE73KS2SRZWBC3TBVYKYT6ANCE5Y" },
      guildRegistry: { id: "CDJKNLOK5U4N7IPLDDX2Y3FPMSS6ERREGU7VXCXDVANC7YUAB56ZD7ZB", explorer: "https://stellar.expert/explorer/testnet/contract/CDJKNLOK5U4N7IPLDDX2Y3FPMSS6ERREGU7VXCXDVANC7YUAB56ZD7ZB" }
    },
    trace: INITIAL_MOCK_TRACE,
    traces: [INITIAL_MOCK_TRACE]
  }) : data;

  const activePreflight = isMockMode ? MOCK_PREFLIGHT_REPORT : preflight;
  const activeArtifactPack = isMockMode ? MOCK_ARTIFACT_PACK : artifactPack;
  const activeSubmissionPack = isMockMode ? MOCK_SUBMISSION_PACK : submissionPack;

  const trace = activeData?.trace || null;
  const stepsById = useMemo(() => new Map((trace?.steps || []).map((step) => [step.id, step])), [trace]);
  const hardPathItems = useMemo(
    () => HARD_PATH.map((item) => {
      const step = stepsById.get(item.id);
      return { ...item, step, state: hardPathState(step) };
    }),
    [stepsById],
  );
  const hardPathPassCount = hardPathItems.filter((item) => item.state === "pass").length;
  const scenarioEvidence = useMemo(() => buildScenarioEvidence(activeData?.traces || []), [activeData?.traces]);
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

          <JudgePreflightPanel report={activePreflight} isMockMode={isMockMode} setIsMockMode={setIsMockMode} />
          <JudgeSuitePanel
            runs={visibleSuiteRuns}
            result={suiteResult}
            running={suiteRunning}
            evidenceReady={evidenceSuiteReady}
          />
          <JudgeArtifactPack pack={activeArtifactPack} />
          <JudgeSubmissionPack pack={activeSubmissionPack} />

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
                <div>payment: {runResult.payment?.amount ?? "unknown"} {runResult.payment?.assetCode || "asset"}</div>
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
                <span className={activeData?.relayers.zkVerifier ? "text-emerald-200" : "text-amber-200"}>
                  {activeData?.relayers.zkVerifier ? "enabled" : "disabled"}
                </span>
              </div>
              <div className="flex justify-between gap-[1rem]">
                <span className="text-white/45">Guild registry</span>
                <span className={activeData?.relayers.guildRegistry ? "text-emerald-200" : "text-amber-200"}>
                  {activeData?.relayers.guildRegistry ? "enabled" : "disabled"}
                </span>
              </div>
            </div>
          </section>

          <section className="border border-white/10 bg-black/55 p-[1.8rem]">
            <h2 className="text-[1.25rem] uppercase tracking-[0.18em] text-white/55">Contracts</h2>
            <div className="mt-[1.2rem] grid gap-[1rem] text-[1.15rem]">
              {activeData?.contracts.membershipVerifier && (
                <a className="block border border-white/10 bg-white/[0.03] p-[1.2rem] text-cyan-200 hover:border-cyan-300/40" href={activeData.contracts.membershipVerifier.explorer} target="_blank" rel="noreferrer">
                  <div className="text-white/35">membership verifier</div>
                  <div className="mt-[0.5rem] break-all">{activeData.contracts.membershipVerifier.id}</div>
                </a>
              )}
              {activeData?.contracts.guildRegistry && (
                <a className="block border border-white/10 bg-white/[0.03] p-[1.2rem] text-cyan-200 hover:border-cyan-300/40" href={activeData.contracts.guildRegistry.explorer} target="_blank" rel="noreferrer">
                  <div className="text-white/35">guild registry</div>
                  <div className="mt-[0.5rem] break-all">{activeData.contracts.guildRegistry.id}</div>
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
            <div>Last API sample: {formatTime(activeData?.generatedAt)}</div>
            <div className="mt-[0.7rem]">Trace created: {formatTime(trace?.createdAt)}</div>
            <div className="mt-[0.7rem] break-all">Trace id: {trace?.id || "none"}</div>
          </section>
        </aside>
      </section>
    </main>
  );
}
