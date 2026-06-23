import { execFileSync } from "node:child_process";

export type DemoPreflightStatus = "ready" | "warning" | "blocked";
export type DemoPreflightCheckStatus = "pass" | "warn" | "fail";
export type DemoClaimStatus = "real" | "scoped" | "prototype";

export interface DemoPreflightCheck {
  id: string;
  label: string;
  status: DemoPreflightCheckStatus;
  detail: string;
  evidence?: string | null;
}

export interface DemoPreflightWorker {
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

export interface DemoPreflightReport {
  status: DemoPreflightStatus;
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
    relayers: {
      guildRegistry: boolean;
      zkVerifier: boolean;
    };
  };
  workers: DemoPreflightWorker[];
  checks: DemoPreflightCheck[];
  claimBoundaries: Array<{
    claim: string;
    status: DemoClaimStatus;
    evidence: string;
  }>;
  copyText: string;
}

const DEFAULT_AMOUNT = "6.0000000";
const DEFAULT_WORKER_URL = "http://127.0.0.1:3001/api/hire";

export async function buildDemoPreflightReport(input: {
  gatewayUrl: string;
  platformWallet: string;
  payerConfigured: boolean;
  demoAmount?: string;
  workerUrls: string[];
  relayers: DemoPreflightReport["runtime"]["relayers"];
}): Promise<DemoPreflightReport> {
  const generatedAt = new Date().toISOString();
  const challenge = await runPaymentChallenge(input.gatewayUrl, input.demoAmount || DEFAULT_AMOUNT);
  const workers = await Promise.all(input.workerUrls.map(probeWorker));
  const aliveWorkers = workers.filter((worker) => worker.alive);
  const platformWalletConfigured = isConfiguredPublicKey(input.platformWallet);

  const checks: DemoPreflightCheck[] = [
    {
      id: "payment-challenge",
      label: "HTTP 402 challenge",
      status: challenge.ok ? "pass" : "fail",
      detail: challenge.ok
        ? "Unpaid /api/hire request returns Payment Required with L402 challenge metadata."
        : "Unpaid /api/hire request did not return the expected Payment Required challenge.",
      evidence: challenge.wwwAuthenticate,
    },
    {
      id: "platform-wallet",
      label: "Platform wallet",
      status: platformWalletConfigured ? "pass" : "fail",
      detail: platformWalletConfigured
        ? "Stellar Testnet payment destination is configured."
        : "Set STELLAR_PLATFORM_WALLET or STELLAR_DEMO_PLATFORM_IDENTITY before running live judge suite.",
      evidence: platformWalletConfigured ? shortValue(input.platformWallet) : null,
    },
    {
      id: "payer",
      label: "Demo payer",
      status: input.payerConfigured ? "pass" : "fail",
      detail: input.payerConfigured
        ? "A funded Stellar Testnet payer secret or CLI identity is available to the gateway."
        : "Set STELLAR_DEMO_PAYER_SECRET or create a funded x402-payer Stellar CLI identity.",
      evidence: input.payerConfigured ? "configured" : null,
    },
    {
      id: "mesh-workers",
      label: "Mesh workers",
      status: aliveWorkers.length >= 2 ? "pass" : aliveWorkers.length === 1 ? "warn" : "fail",
      detail: aliveWorkers.length >= 2
        ? "Two or more separate worker processes are alive for mesh routing."
        : aliveWorkers.length === 1
          ? "One worker is alive; routing works, but mesh evidence is stronger with two workers."
          : "No worker process is alive.",
      evidence: `${aliveWorkers.length}/${input.workerUrls.length}`,
    },
    {
      id: "guild-registry-relayer",
      label: "Guild registry relayer",
      status: input.relayers.guildRegistry ? "pass" : "warn",
      detail: input.relayers.guildRegistry
        ? "Guild registry relayer is configured for live root/settlement submissions."
        : "Guild registry route will expose prepared artifacts unless a relayer secret is configured.",
      evidence: input.relayers.guildRegistry ? "enabled" : "disabled",
    },
    {
      id: "zk-verifier-relayer",
      label: "ZK verifier relayer",
      status: input.relayers.zkVerifier ? "pass" : "warn",
      detail: input.relayers.zkVerifier
        ? "ZK verifier relayer is configured for Soroban verifier calls."
        : "ZK verification may fall back to local verification depending on runtime configuration.",
      evidence: input.relayers.zkVerifier ? "enabled" : "disabled",
    },
  ];

  const hasFailure = checks.some((check) => check.status === "fail");
  const hasWarning = checks.some((check) => check.status === "warn");
  const status: DemoPreflightStatus = hasFailure ? "blocked" : hasWarning ? "warning" : "ready";
  const reportWithoutCopy: Omit<DemoPreflightReport, "copyText"> = {
    status,
    generatedAt,
    network: "stellar-testnet",
    gatewayUrl: input.gatewayUrl,
    challenge,
    runtime: {
      platformWalletConfigured,
      payerConfigured: input.payerConfigured,
      demoAmount: input.demoAmount || DEFAULT_AMOUNT,
      workerUrls: input.workerUrls,
      relayers: input.relayers,
    },
    workers,
    checks,
    claimBoundaries: buildClaimBoundaries(challenge.ok, input.relayers),
  };

  return {
    ...reportWithoutCopy,
    copyText: buildCopyText(reportWithoutCopy),
  };
}

export function getDemoWorkerUrls(): string[] {
  const configured = process.env.P2P_WORKER_URLS || process.env.P2P_WORKER_URL || DEFAULT_WORKER_URL;
  const urls = configured
    .split(/[,\s]+/)
    .map((url) => url.trim())
    .filter(Boolean);
  return Array.from(new Set(urls.length > 0 ? urls : [DEFAULT_WORKER_URL]));
}

export function getDemoPlatformWallet(): string {
  const configured = process.env.STELLAR_PLATFORM_WALLET || "";
  if (isConfiguredPublicKey(configured)) {
    return configured;
  }
  return readCliIdentity("public-key", process.env.STELLAR_DEMO_PLATFORM_IDENTITY || "x402-platform");
}

export function hasDemoPayer(): boolean {
  const secret = process.env.STELLAR_DEMO_PAYER_SECRET || process.env.STELLAR_PAYER_SECRET || "";
  if (secret.startsWith("S")) {
    return true;
  }
  return readCliIdentity("secret", process.env.STELLAR_DEMO_PAYER_IDENTITY || "x402-payer").startsWith("S");
}

export function isConfiguredPublicKey(value: string): boolean {
  return value.startsWith("G") && !value.includes("YOUR_");
}

async function runPaymentChallenge(gatewayUrl: string, amount: string): Promise<DemoPreflightReport["challenge"]> {
  try {
    const response = await fetch(`${gatewayUrl.replace(/\/$/, "")}/api/hire`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: "Preflight unpaid x402 challenge.",
        bounty_usdc: Number.parseFloat(amount),
        client_id: "preflight-client",
        task_id: "preflight-task",
        is_shielded: false,
      }),
    });
    const data = await response.json().catch(() => ({}));
    const wwwAuthenticate = response.headers.get("www-authenticate");
    const ok = response.status === 402 && !!wwwAuthenticate?.includes("L402");
    return {
      ok,
      status: response.status,
      wwwAuthenticate,
      requiredPayment: typeof data?.required?.payment === "string" ? data.required.payment : null,
      error: ok ? undefined : data?.error || `Unexpected HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      ok: false,
      status: null,
      wwwAuthenticate: null,
      requiredPayment: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function probeWorker(workerUrl: string): Promise<DemoPreflightWorker> {
  const startedAt = Date.now();
  try {
    const healthUrl = workerHealthUrl(workerUrl);
    const response = await fetch(healthUrl, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    const capabilities = Array.isArray(data?.capabilities)
      ? data.capabilities.filter((item: unknown) => typeof item === "string")
      : [];
    const alive = response.ok && data?.status === "alive";
    return {
      url: workerUrl,
      healthUrl,
      alive,
      status: alive ? "alive" : `health_http_${response.status}`,
      agentId: typeof data?.agent_id === "string" ? data.agent_id : null,
      name: typeof data?.name === "string" ? data.name : null,
      guildMember: typeof data?.guild_member === "boolean" ? data.guild_member : null,
      capabilities,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      url: workerUrl,
      healthUrl: workerUrl,
      alive: false,
      status: "offline",
      agentId: null,
      name: null,
      guildMember: null,
      capabilities: [],
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function workerHealthUrl(workerUrl: string): string {
  const parsed = new URL(workerUrl);
  if (parsed.pathname.endsWith("/api/hire")) {
    parsed.pathname = parsed.pathname.slice(0, -"/api/hire".length) + "/health";
  } else {
    parsed.pathname = "/health";
  }
  parsed.search = "";
  return parsed.toString();
}

function buildClaimBoundaries(
  challengeOk: boolean,
  relayers: DemoPreflightReport["runtime"]["relayers"],
): DemoPreflightReport["claimBoundaries"] {
  return [
    {
      claim: "HTTP 402 payment challenge",
      status: challengeOk ? "real" : "prototype",
      evidence: challengeOk
        ? "/api/hire returns HTTP 402 with WWW-Authenticate: L402 when no payment header is supplied."
        : "Challenge endpoint did not pass preflight.",
    },
    {
      claim: "Stellar payment verification",
      status: "real",
      evidence: "Gateway verifies a Stellar Testnet transaction hash through Horizon before delegation.",
    },
    {
      claim: "Private worker membership proof",
      status: "real",
      evidence: "Worker delegation is gated by membership_proof; invalid proofs and unapproved roots are blocked.",
    },
    {
      claim: "Soroban verifier/registry path",
      status: relayers.zkVerifier && relayers.guildRegistry ? "real" : "scoped",
      evidence: relayers.zkVerifier && relayers.guildRegistry
        ? "Relayers are configured; artifact pack includes verifier and settlement transaction links."
        : "Without relayer secrets, the gateway must describe prepared artifacts/local verification honestly.",
    },
    {
      claim: "x402 scope",
      status: "scoped",
      evidence: "This demo uses Stellar payment tx hashes via x-l402-txhash or Authorization: L402; do not claim a Coinbase facilitator integration.",
    },
  ];
}

function buildCopyText(report: Omit<DemoPreflightReport, "copyText">): string {
  const lines = [
    "x402 ZK Mesh - Judge Preflight",
    `Status: ${report.status}`,
    `Gateway: ${report.gatewayUrl}`,
    `Network: ${report.network}`,
    `HTTP 402 challenge: ${report.challenge.ok ? "pass" : "fail"} (${report.challenge.status ?? "none"})`,
    `Workers: ${report.workers.filter((worker) => worker.alive).length}/${report.workers.length}`,
    `Platform wallet: ${report.runtime.platformWalletConfigured ? "configured" : "missing"}`,
    `Demo payer: ${report.runtime.payerConfigured ? "configured" : "missing"}`,
    "",
    "Checks:",
    ...report.checks.map((check) => `- ${check.label}: ${check.status}; ${check.detail}`),
    "",
    "Claim boundaries:",
    ...report.claimBoundaries.map((claim) => `- ${claim.claim}: ${claim.status}; ${claim.evidence}`),
  ];
  return lines.join("\n");
}

function readCliIdentity(command: "secret" | "public-key", identity: string): string {
  try {
    return execFileSync(findStellarCli(), ["keys", command, identity], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function findStellarCli(): string {
  if (process.env.STELLAR_CLI_PATH) {
    return process.env.STELLAR_CLI_PATH;
  }
  if (process.platform === "win32") {
    return "C:\\Program Files (x86)\\Stellar CLI\\stellar.exe";
  }
  return "stellar";
}

function shortValue(value: string): string {
  return value.length > 22 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}
