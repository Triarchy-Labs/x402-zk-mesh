import type { DemoArtifactPack, DemoArtifactScenario } from "./demo-artifact-pack";
import type { DemoPreflightReport } from "./demo-preflight";

export interface DemoSubmissionPack {
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
  honestScope: Array<{
    claim: string;
    status: DemoPreflightReport["claimBoundaries"][number]["status"];
    evidence: string;
  }>;
  copyMarkdown: string;
}

export function buildDemoSubmissionPack(input: {
  artifactPack: DemoArtifactPack;
  preflight: DemoPreflightReport;
  generatedAt?: string;
}): DemoSubmissionPack {
  const generatedAt = input.generatedAt || new Date().toISOString();
  const proofOfWork = buildProofOfWork(input.artifactPack, input.preflight);
  const readinessScore = scoreSubmission(input.artifactPack, input.preflight, proofOfWork);
  const status = readinessScore >= 80 ? "ready" : "needs-work";
  const packWithoutMarkdown: Omit<DemoSubmissionPack, "copyMarkdown"> = {
    status,
    generatedAt,
    readinessScore,
    headline: "x402 ZK Mesh turns paid AI-agent execution into a verifiable Stellar Testnet workflow.",
    pitch: [
      "A client pays through a 402-style Stellar payment gate, then the gateway routes work to separate agent workers only after a private membership proof passes.",
      "The ZK gate is load-bearing: invalid proofs and valid proofs from unapproved guild roots are blocked before worker execution.",
      "The judge suite records all three outcomes with Stellar Testnet payment transactions, Soroban verifier simulation evidence, settlement links, and hash-bound receipts.",
    ],
    judgeSteps: buildJudgeSteps(input.preflight.gatewayUrl),
    proofOfWork,
    demoVideoOutline: buildDemoVideoOutline(input.artifactPack),
    honestScope: input.preflight.claimBoundaries,
  };

  return {
    ...packWithoutMarkdown,
    copyMarkdown: buildCopyMarkdown(packWithoutMarkdown, input.artifactPack),
  };
}

function buildJudgeSteps(gatewayUrl: string): DemoSubmissionPack["judgeSteps"] {
  const base = gatewayUrl.replace(/\/$/, "");
  return [
    {
      label: "Open the live judge dashboard",
      action: `${base}/demo`,
      expected: "First viewport shows COMPLETE, 6/6 current trace path, and Scenario Evidence 3/3.",
    },
    {
      label: "Run the one-click suite",
      action: "Click RUN JUDGE SUITE",
      expected: "Fresh trace delegates and settles; tampered proof blocks; unapproved root blocks by policy.",
    },
    {
      label: "Verify machine-readable evidence",
      action: `${base}/api/demo/artifact-pack`,
      expected: "JSON verdict is PASS with coverage 3/3 and Stellar Testnet tx hashes.",
    },
    {
      label: "Verify submission summary",
      action: `${base}/api/demo/submission-pack`,
      expected: "JSON includes readiness score, pitch, judge steps, honest scope, and copy-ready markdown.",
    },
  ];
}

function buildProofOfWork(
  artifactPack: DemoArtifactPack,
  preflight: DemoPreflightReport,
): DemoSubmissionPack["proofOfWork"] {
  const fresh = scenario(artifactPack, "fresh");
  const invalid = scenario(artifactPack, "invalid-proof");
  const unapproved = scenario(artifactPack, "unapproved-root");

  return [
    {
      label: "Hard path",
      status: artifactPack.currentTrace.hardPathPassed === artifactPack.currentTrace.hardPathTotal ? "pass" : "warn",
      evidence: `${artifactPack.currentTrace.status} ${artifactPack.currentTrace.hardPathPassed}/${artifactPack.currentTrace.hardPathTotal}`,
    },
    {
      label: "Scenario coverage",
      status: artifactPack.coverage.recorded === artifactPack.coverage.total ? "pass" : "fail",
      evidence: `${artifactPack.coverage.recorded}/${artifactPack.coverage.total}: ${artifactPack.verdict}`,
    },
    {
      label: "Fresh path",
      status: fresh?.traceStatus === "complete" && fresh.settlementTx ? "pass" : "fail",
      evidence: scenarioEvidence(fresh),
      href: fresh?.settlementExplorer || fresh?.paymentExplorer || null,
    },
    {
      label: "Invalid proof block",
      status: invalid?.proofValid === false && invalid.settlementTx === null ? "pass" : "fail",
      evidence: scenarioEvidence(invalid),
      href: invalid?.paymentExplorer || null,
    },
    {
      label: "Unapproved root block",
      status: unapproved?.proofValid === true && unapproved.approvedRoot === false && unapproved.settlementTx === null ? "pass" : "fail",
      evidence: scenarioEvidence(unapproved),
      href: unapproved?.paymentExplorer || null,
    },
    {
      label: "HTTP 402 challenge",
      status: preflight.challenge.ok ? "pass" : "fail",
      evidence: preflight.challenge.wwwAuthenticate || preflight.challenge.error || "none",
    },
    {
      label: "Mesh workers",
      status: preflight.workers.filter((worker) => worker.alive).length >= 2 ? "pass" : "warn",
      evidence: `${preflight.workers.filter((worker) => worker.alive).length}/${preflight.workers.length} workers alive`,
    },
    {
      label: "Soroban contracts",
      status: artifactPack.relayers.guildRegistry && artifactPack.relayers.zkVerifier ? "pass" : "warn",
      evidence: `membership=${shortValue(artifactPack.contracts.membershipVerifier.id)}, registry=${shortValue(artifactPack.contracts.guildRegistry.id)}`,
    },
  ];
}

function buildDemoVideoOutline(artifactPack: DemoArtifactPack): DemoSubmissionPack["demoVideoOutline"] {
  const fresh = scenario(artifactPack, "fresh");
  const unapproved = scenario(artifactPack, "unapproved-root");

  return [
    {
      timebox: "0:00-0:20",
      shot: "Open /demo on the first viewport.",
      narration: "This is a paid agent mesh on Stellar where ZK membership gates decide whether external workers may execute.",
    },
    {
      timebox: "0:20-0:55",
      shot: "Show COMPLETE 6/6 and Scenario Evidence 3/3.",
      narration: `The happy path has payment ${paymentCopy(fresh)}, verifier evidence ${fresh?.proofTx || "none"}, and settlement ${shortValue(fresh?.settlementTx || null)}.`,
    },
    {
      timebox: "0:55-1:30",
      shot: "Click RUN BLOCKED TRACE, then RUN UNAPPROVED ROOT.",
      narration: `Invalid proof is rejected before execution; unapproved root has proof=${proofCopy(unapproved?.proofValid)} but root=${rootCopy(unapproved)}.`,
    },
    {
      timebox: "1:30-2:10",
      shot: "Open artifact-pack and submission-pack JSON.",
      narration: "The submission exposes machine-readable evidence: payment tx hashes, Soroban verifier simulations, contract IDs, and receipt hashes.",
    },
    {
      timebox: "2:10-2:30",
      shot: "Open Stellar explorer links for payment/settlement and contract links.",
      narration: "Judges can verify the Stellar Testnet side directly instead of trusting screenshots.",
    },
  ];
}

function scoreSubmission(
  artifactPack: DemoArtifactPack,
  preflight: DemoPreflightReport,
  proofOfWork: DemoSubmissionPack["proofOfWork"],
): number {
  let score = 0;
  if (artifactPack.status === "ready" && artifactPack.coverage.recorded === artifactPack.coverage.total) score += 25;
  if (artifactPack.currentTrace.hardPathPassed === artifactPack.currentTrace.hardPathTotal) score += 20;
  if (preflight.status === "ready") score += 15;
  if (proofOfWork.filter((item) => item.status === "pass").length >= 7) score += 15;
  if (artifactPack.relayers.guildRegistry) score += 5;
  if (artifactPack.relayers.zkVerifier) score += 5;
  if (artifactPack.scenarios.every((item) => item.paymentAmount !== null && item.paymentAssetCode)) score += 5;
  if (artifactPack.scenarios.some((item) => !!item.settlementTx)) score += 5;
  if (preflight.claimBoundaries.some((item) => item.claim === "x402 scope" && item.status === "scoped")) score += 5;
  return Math.min(score, 100);
}

function buildCopyMarkdown(
  pack: Omit<DemoSubmissionPack, "copyMarkdown">,
  artifactPack: DemoArtifactPack,
): string {
  const lines = [
    "# x402 ZK Mesh - Hackathon Submission Pack",
    "",
    `Readiness: ${pack.status} (${pack.readinessScore}/100)`,
    "",
    "## Three-Sentence Pitch",
    ...pack.pitch.map((line) => `- ${line}`),
    "",
    "## How To Judge",
    ...pack.judgeSteps.map((step, index) => `${index + 1}. ${step.label}: ${step.action} -> ${step.expected}`),
    "",
    "## Live Evidence",
    ...artifactPack.scenarios.map((item) => `- ${item.title}: ${item.traceStatus}; payment=${paymentCopy(item)}; proof=${proofCopy(item.proofValid)}; root=${rootCopy(item)}; payment_tx=${item.paymentTx || "none"}; proof_sim=${item.proofTx || "none"}; settlement_tx=${item.settlementTx || "none"}`),
    "",
    "## Contracts",
    `- Membership verifier: ${artifactPack.contracts.membershipVerifier.id}`,
    `- Guild registry: ${artifactPack.contracts.guildRegistry.id}`,
    "",
    "## Honest Scope",
    ...pack.honestScope.map((claim) => `- ${claim.claim}: ${claim.status}; ${claim.evidence}`),
    "",
    "## Demo Video Outline",
    ...pack.demoVideoOutline.map((shot) => `- ${shot.timebox}: ${shot.shot} ${shot.narration}`),
  ];
  return lines.join("\n");
}

function scenario(
  artifactPack: DemoArtifactPack,
  key: DemoArtifactScenario["key"],
): DemoArtifactScenario | undefined {
  return artifactPack.scenarios.find((item) => item.key === key);
}

function scenarioEvidence(item?: DemoArtifactScenario): string {
  if (!item) return "missing";
  return `${item.traceStatus}; payment=${paymentCopy(item)}; proof=${proofCopy(item.proofValid)}; root=${rootCopy(item)}; proof_evidence=${item.proofTx || "none"}`;
}

function paymentCopy(item?: DemoArtifactScenario): string {
  if (!item || item.paymentAmount === null || !item.paymentAssetCode) return "unknown";
  return `${item.paymentAmount} ${item.paymentAssetCode}`;
}

function proofCopy(value: boolean | null | undefined): string {
  if (value === true) return "valid";
  if (value === false) return "invalid";
  return "unknown";
}

function rootCopy(item?: DemoArtifactScenario): string {
  if (!item || item.key === "invalid-proof") return "not evaluated";
  if (item.approvedRoot === true) return "approved";
  if (item.approvedRoot === false) return "unapproved";
  return "unknown";
}

function shortValue(value?: string | null): string {
  if (!value) return "none";
  return value.length > 22 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}
