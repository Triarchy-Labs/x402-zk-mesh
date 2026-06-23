import { NextResponse } from "next/server";
import * as StellarSDK from "@stellar/stellar-sdk";
import { execFileSync } from "node:child_process";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_AMOUNT = "6.0000000";
const DEFAULT_TASK = "Run a live Stellar Soroban security scan and return a concise risk summary.";
const BLOCKED_TASK = "Attempt delegation with a tampered worker membership proof.";
const UNAPPROVED_ROOT_TASK = "Attempt delegation with a valid worker proof from an unapproved guild root.";
const TESTNET_TX_EXPLORER = "https://stellar.expert/explorer/testnet/tx";

type DemoScenario = "happy-path" | "tampered-worker-proof" | "unapproved-worker-root";

interface RunRequestBody {
  amount?: string | number;
  task?: string;
  scenario?: DemoScenario;
}

interface HireRunResponse {
  status?: string;
  delegation?: {
    workerStatus?: string | null;
  };
  zk?: {
    verified?: boolean | null;
    proofValid?: boolean | null;
    method?: string | null;
    approvedRoot?: boolean | null;
  };
  soroban_settlement?: {
    submission?: {
      status?: string | null;
    } | null;
  } | null;
}

export async function POST(req: Request) {
  const readiness = await demoReadiness();
  if (!readiness.ready) {
    return NextResponse.json(
      {
        status: "not_ready",
        error: readiness.error,
        missing: readiness.missing,
      },
      { status: 409 },
    );
  }

  let body: RunRequestBody = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const amount = normalizeAmount(body.amount);
  if (!amount) {
    return NextResponse.json(
      { status: "invalid_request", error: "amount must be a positive number." },
      { status: 400 },
    );
  }

  const scenario = normalizeScenario(body.scenario);
  if (!scenario) {
    return NextResponse.json(
      { status: "invalid_request", error: "scenario must be happy-path, tampered-worker-proof, or unapproved-worker-root." },
      { status: 400 },
    );
  }

  const task = typeof body.task === "string" && body.task.trim()
    ? body.task.trim()
    : scenario === "tampered-worker-proof"
      ? BLOCKED_TASK
      : scenario === "unapproved-worker-root"
        ? UNAPPROVED_ROOT_TASK
      : DEFAULT_TASK;
  const stamp = Math.floor(Date.now() / 1000);
  const clientPrefix = scenario === "happy-path" ? "judge-demo" : scenario === "tampered-worker-proof" ? "blocked-demo" : "root-demo";
  const clientId = `${clientPrefix}-${stamp}`;
  const taskId = `${clientPrefix}-task-${stamp}`;

  try {
    await assertAnyWorkerReady(readiness.workerUrls);

    const paymentTx = await submitPayment({
      secret: readiness.payerSecret,
      destination: readiness.platformWallet,
      amount,
      memo: clientId,
    });

    const hireHeaders: Record<string, string> = {
      "x-l402-txhash": paymentTx,
    };
    if (scenario === "tampered-worker-proof") {
      hireHeaders["x-zk-mesh-demo-scenario"] = "tampered-worker-proof";
    } else if (scenario === "unapproved-worker-root") {
      hireHeaders["x-zk-mesh-demo-scenario"] = "unapproved-worker-root";
    }

    const hireResponse = await postJson(new URL("/api/hire", req.url).toString(), {
      description: task,
      bounty_usdc: Number.parseFloat(amount),
      client_id: clientId,
      task_id: taskId,
      is_shielded: false,
    }, hireHeaders);

    return NextResponse.json({
      status: hireResponse.status || "submitted",
      scenario,
      clientId,
      taskId,
      payment: {
        txHash: paymentTx,
        explorer: `${TESTNET_TX_EXPLORER}/${paymentTx}`,
      },
      hire: {
        status: hireResponse.status || null,
        workerStatus: hireResponse.delegation?.workerStatus || null,
        zkVerified: hireResponse.zk?.verified ?? null,
        zkProofValid: hireResponse.zk?.proofValid ?? null,
        zkMethod: hireResponse.zk?.method || null,
        zkApprovedRoot: hireResponse.zk?.approvedRoot ?? null,
        settlementStatus: hireResponse.soroban_settlement?.submission?.status || null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        status: "failed",
        error: message,
        clientId,
        taskId,
      },
      { status: 502 },
    );
  }
}

function normalizeAmount(value: RunRequestBody["amount"]): string | null {
  const raw = value === undefined || value === null ? process.env.STELLAR_DEMO_AMOUNT || DEFAULT_AMOUNT : String(value);
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }
  return parsed.toFixed(7);
}

function normalizeScenario(value: RunRequestBody["scenario"]): DemoScenario | null {
  if (value === undefined || value === null || value === "happy-path") {
    return "happy-path";
  }
  if (value === "tampered-worker-proof" || value === "unapproved-worker-root") {
    return value;
  }
  return null;
}

async function demoReadiness(): Promise<
  | {
      ready: true;
      payerSecret: string;
      platformWallet: string;
      workerUrls: string[];
    }
  | {
      ready: false;
      error: string;
      missing: string[];
    }
> {
  const missing: string[] = [];
  const payerSecret =
    process.env.STELLAR_DEMO_PAYER_SECRET ||
    process.env.STELLAR_PAYER_SECRET ||
    readCliIdentity("secret", process.env.STELLAR_DEMO_PAYER_IDENTITY || "x402-payer");
  const platformWallet =
    process.env.STELLAR_PLATFORM_WALLET ||
    readCliIdentity("public-key", process.env.STELLAR_DEMO_PLATFORM_IDENTITY || "x402-platform");
  const workerUrls = getP2PWorkerUrls();

  if (!payerSecret.startsWith("S")) {
    missing.push("STELLAR_DEMO_PAYER_SECRET");
  }
  if (!platformWallet.startsWith("G") || platformWallet.includes("YOUR_")) {
    missing.push("STELLAR_PLATFORM_WALLET");
  }

  if (missing.length > 0) {
    return {
      ready: false,
      error: "Live Judge Mode requires a funded Stellar Testnet payer secret and platform wallet.",
      missing,
    };
  }

  return {
    ready: true,
    payerSecret,
    platformWallet,
    workerUrls,
  };
}

function getP2PWorkerUrls(): string[] {
  const configured = process.env.P2P_WORKER_URLS || process.env.P2P_WORKER_URL || "http://127.0.0.1:3001/api/hire";
  const urls = configured
    .split(/[,\s]+/)
    .map((url) => url.trim())
    .filter(Boolean);
  return Array.from(new Set(urls.length > 0 ? urls : ["http://127.0.0.1:3001/api/hire"]));
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

  const windowsPath = "C:\\Program Files (x86)\\Stellar CLI\\stellar.exe";
  if (process.platform === "win32") {
    return windowsPath;
  }

  return "stellar";
}

async function assertAnyWorkerReady(workerUrls: string[]) {
  const failures: string[] = [];
  for (const workerUrl of workerUrls) {
    const healthUrl = workerHealthUrl(workerUrl);
    try {
      const response = await fetch(healthUrl, { cache: "no-store" });
      if (response.ok) {
        return;
      }
      failures.push(`${healthUrl}: HTTP ${response.status}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${healthUrl}: ${message}`);
    }
  }
  throw new Error(`No mesh worker is ready. Checked: ${failures.join("; ")}`);
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

async function submitPayment(input: {
  secret: string;
  destination: string;
  amount: string;
  memo: string;
}): Promise<string> {
  const horizonUrl = process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
  const server = new StellarSDK.Horizon.Server(horizonUrl);
  const payer = StellarSDK.Keypair.fromSecret(input.secret);
  const account = await server.loadAccount(payer.publicKey());
  const tx = new StellarSDK.TransactionBuilder(account, {
    fee: StellarSDK.BASE_FEE,
    networkPassphrase: StellarSDK.Networks.TESTNET,
  })
    .addOperation(
      StellarSDK.Operation.payment({
        destination: input.destination,
        asset: StellarSDK.Asset.native(),
        amount: input.amount,
      }),
    )
    .addMemo(StellarSDK.Memo.text(input.memo))
    .setTimeout(60)
    .build();

  tx.sign(payer);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

async function postJson(url: string, body: unknown, headers: Record<string, string>): Promise<HireRunResponse> {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    if (response.status === 403 && (data as HireRunResponse).status === "worker_membership_rejected") {
      return data as HireRunResponse;
    }
    throw new Error(`/api/hire returned HTTP ${response.status}: ${JSON.stringify(data)}`);
  }
  return data as HireRunResponse;
}
