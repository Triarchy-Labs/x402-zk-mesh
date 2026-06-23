import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as StellarSDK from "@stellar/stellar-sdk";

const DEFAULT_GATEWAY_URL = "http://localhost:3010";
const DEFAULT_WORKER_URL = "http://127.0.0.1:3011/api/hire";
const DEFAULT_AMOUNT = "6.0000000";
const DEFAULT_TASK =
  "Run a live Stellar Soroban security scan and return a concise risk summary.";
const TESTNET_TX_EXPLORER = "https://stellar.expert/explorer/testnet/tx";

function loadEnvFile(fileName) {
  const filePath = path.resolve(fileName);
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback;
  }
  return process.argv[index + 1];
}

function findStellarCli() {
  if (process.env.STELLAR_CLI_PATH && fs.existsSync(process.env.STELLAR_CLI_PATH)) {
    return process.env.STELLAR_CLI_PATH;
  }

  const windowsPath = "C:\\Program Files (x86)\\Stellar CLI\\stellar.exe";
  if (process.platform === "win32" && fs.existsSync(windowsPath)) {
    return windowsPath;
  }

  return "stellar";
}

function readCliIdentity(command, identity) {
  try {
    return execFileSync(findStellarCli(), ["keys", command, identity], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function payerSecret() {
  const secret = process.env.STELLAR_DEMO_PAYER_SECRET || process.env.STELLAR_PAYER_SECRET || "";
  if (secret) {
    return secret;
  }

  const identity = process.env.STELLAR_DEMO_PAYER_IDENTITY || "x402-payer";
  const cliSecret = readCliIdentity("secret", identity);
  if (cliSecret) {
    return cliSecret;
  }

  throw new Error(
    "Set STELLAR_DEMO_PAYER_SECRET in .env.local or create a funded Stellar CLI identity named x402-payer.",
  );
}

function platformWallet() {
  const configured = process.env.STELLAR_PLATFORM_WALLET || "";
  if (configured && !configured.includes("YOUR_") && configured.startsWith("G")) {
    return configured;
  }

  const identity = process.env.STELLAR_DEMO_PLATFORM_IDENTITY || "x402-platform";
  const cliPublicKey = readCliIdentity("public-key", identity);
  if (cliPublicKey) {
    return cliPublicKey;
  }

  throw new Error(
    "Set STELLAR_PLATFORM_WALLET in .env.local or create a Stellar CLI identity named x402-platform.",
  );
}

async function assertEndpoint(url, label) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label} is not reachable at ${url}: ${message}`);
  }
}

function resolvePaymentAsset() {
  const code = (process.env.STELLAR_PAYMENT_ASSET_CODE || "").trim();
  const issuer = (
    process.env.STELLAR_PAYMENT_ASSET_ISSUER ||
    process.env.STELLAR_USDC_ISSUER ||
    ""
  ).trim();
  // Native XLM unless an explicit classic asset (e.g. USDC) is configured.
  if (code && !["XLM", "NATIVE"].includes(code.toUpperCase()) && issuer) {
    return { asset: new StellarSDK.Asset(code, issuer), label: `${code}:${issuer.slice(0, 4)}…` };
  }
  return { asset: StellarSDK.Asset.native(), label: "native XLM" };
}

async function submitPayment({ secret, destination, amount, memo }) {
  const horizonUrl = process.env.STELLAR_HORIZON_URL || "https://horizon-testnet.stellar.org";
  const server = new StellarSDK.Horizon.Server(horizonUrl);
  const payer = StellarSDK.Keypair.fromSecret(secret);
  const account = await server.loadAccount(payer.publicKey());
  const { asset, label } = resolvePaymentAsset();
  console.error(`[live-trace] paying ${amount} ${label} -> ${destination}`);
  const tx = new StellarSDK.TransactionBuilder(account, {
    fee: StellarSDK.BASE_FEE,
    networkPassphrase: StellarSDK.Networks.TESTNET,
  })
    .addOperation(
      StellarSDK.Operation.payment({
        destination,
        asset,
        amount,
      }),
    )
    .addMemo(StellarSDK.Memo.text(memo))
    .setTimeout(60)
    .build();

  tx.sign(payer);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function assertLiveHire(data) {
  const failures = [];
  if (data.status !== "delegated") failures.push(`status=${data.status}`);
  if (data.zk?.method !== "soroban") failures.push(`zk.method=${data.zk?.method}`);
  if (data.zk?.verified !== true) failures.push(`zk.verified=${data.zk?.verified}`);
  if (data.zk?.approvedRoot !== true) failures.push(`zk.approvedRoot=${data.zk?.approvedRoot}`);
  if (data.delegation?.workerStatus !== "success") failures.push(`workerStatus=${data.delegation?.workerStatus}`);
  if (data.soroban_settlement?.submission?.status !== "confirmed") {
    failures.push(`settlement=${data.soroban_settlement?.submission?.status}`);
  }

  if (failures.length > 0) {
    throw new Error(`Live trace did not complete: ${failures.join(", ")}`);
  }
}

async function fetchTrace(gatewayUrl) {
  const response = await fetch(`${gatewayUrl}/api/demo/trace`);
  if (!response.ok) {
    throw new Error(`/api/demo/trace returned HTTP ${response.status}`);
  }
  return response.json();
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const gatewayUrl = argValue("--gateway-url", process.env.GATEWAY_URL || DEFAULT_GATEWAY_URL).replace(/\/$/, "");
const workerUrl = argValue("--worker-url", process.env.P2P_WORKER_URL || DEFAULT_WORKER_URL);
const amount = argValue("--amount", process.env.STELLAR_DEMO_AMOUNT || DEFAULT_AMOUNT);
const task = argValue("--task", DEFAULT_TASK);
const stamp = Math.floor(Date.now() / 1000);
const clientId = argValue("--client-id", `live-trace-${stamp}`);
const taskId = argValue("--task-id", `live-trace-task-${stamp}`);

await assertEndpoint(`${gatewayUrl}/api/demo/trace`, "Gateway");
await assertEndpoint(workerUrl.replace(/\/api\/hire$/, "/health"), "Worker");

const paymentTx = await submitPayment({
  secret: payerSecret(),
  destination: platformWallet(),
  amount,
  memo: clientId,
});

const hire = await postJson(
  `${gatewayUrl}/api/hire`,
  {
    description: task,
    bounty_usdc: Number.parseFloat(amount),
    client_id: clientId,
    task_id: taskId,
    is_shielded: false,
  },
  { "x-l402-txhash": paymentTx },
);
assertLiveHire(hire);

const traceResponse = await fetchTrace(gatewayUrl);
if (traceResponse.status !== "complete" || traceResponse.trace?.status !== "complete") {
  throw new Error(`/api/demo/trace is not complete: ${JSON.stringify(traceResponse)}`);
}

const summary = {
  status: "complete",
  gateway: gatewayUrl,
  traceUi: `${gatewayUrl}/demo`,
  traceApi: `${gatewayUrl}/api/demo/trace`,
  taskId,
  clientId,
  payment: {
    txHash: paymentTx,
    explorer: `${TESTNET_TX_EXPLORER}/${paymentTx}`,
  },
  zk: {
    method: hire.zk.method,
    verified: hire.zk.verified,
    approvedRoot: hire.zk.approvedRoot,
    txHash: hire.zk.txHash,
    explorer: hire.zk.explorer,
  },
  settlement: {
    status: hire.soroban_settlement.submission.status,
    txHash: hire.soroban_settlement.submission.txHash,
    explorer: hire.soroban_settlement.submission.explorer,
  },
  worker: {
    status: hire.delegation.workerStatus,
    agentId: hire.delegation.workerAgentId,
  },
};

console.log(JSON.stringify(summary, null, 2));
