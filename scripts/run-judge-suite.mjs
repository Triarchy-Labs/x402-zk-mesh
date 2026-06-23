import fs from "node:fs";
import path from "node:path";

const DEFAULT_GATEWAY_URL = "http://localhost:3010";
const DEFAULT_AMOUNT = "6.0000000";

const scenarios = [
  {
    scenario: "happy-path",
    title: "Fresh trace",
    assert(result) {
      const failures = [];
      if (result.status !== "delegated") failures.push(`status=${result.status}`);
      if (result.hire?.zkVerified !== true) failures.push(`zkVerified=${result.hire?.zkVerified}`);
      if (result.hire?.zkProofValid !== true) failures.push(`zkProofValid=${result.hire?.zkProofValid}`);
      if (result.hire?.zkApprovedRoot !== true) failures.push(`zkApprovedRoot=${result.hire?.zkApprovedRoot}`);
      if (result.hire?.settlementStatus !== "confirmed") failures.push(`settlement=${result.hire?.settlementStatus}`);
      return failures;
    },
  },
  {
    scenario: "tampered-worker-proof",
    title: "Invalid proof",
    assert(result) {
      const failures = [];
      if (result.status !== "worker_membership_rejected") failures.push(`status=${result.status}`);
      if (result.hire?.zkProofValid !== false) failures.push(`zkProofValid=${result.hire?.zkProofValid}`);
      if (result.hire?.settlementStatus) failures.push(`settlement=${result.hire?.settlementStatus}`);
      return failures;
    },
  },
  {
    scenario: "unapproved-worker-root",
    title: "Unapproved root",
    assert(result) {
      const failures = [];
      if (result.status !== "worker_membership_rejected") failures.push(`status=${result.status}`);
      if (result.hire?.zkProofValid !== true) failures.push(`zkProofValid=${result.hire?.zkProofValid}`);
      if (result.hire?.zkApprovedRoot !== false) failures.push(`zkApprovedRoot=${result.hire?.zkApprovedRoot}`);
      if (result.hire?.settlementStatus) failures.push(`settlement=${result.hire?.settlementStatus}`);
      return failures;
    },
  },
];

loadEnvFile(".env.local");
loadEnvFile(".env");

const gatewayUrl = argValue("--gateway-url", process.env.GATEWAY_URL || DEFAULT_GATEWAY_URL).replace(/\/$/, "");
const amount = argValue("--amount", process.env.STELLAR_DEMO_AMOUNT || DEFAULT_AMOUNT);
const preflightOnly = process.argv.includes("--preflight-only");

const preflight = await getJson(`${gatewayUrl}/api/demo/preflight`);
if (preflight.status === "blocked") {
  throw new Error(`Judge preflight blocked: ${preflight.checks.map((check) => `${check.label}=${check.status}`).join(", ")}`);
}

if (preflightOnly) {
  console.log(JSON.stringify({
    status: preflight.status,
    challenge: preflight.challenge,
    checks: preflight.checks,
    workers: preflight.workers.map((worker) => ({
      url: worker.url,
      status: worker.status,
      guildMember: worker.guildMember,
      capabilities: worker.capabilities,
    })),
  }, null, 2));
  process.exit(0);
}

const startedAt = Date.now();
const runs = [];
for (const item of scenarios) {
  const result = await postJson(`${gatewayUrl}/api/demo/run`, {
    scenario: item.scenario,
    amount,
  });
  const failures = item.assert(result);
  if (failures.length > 0) {
    throw new Error(`${item.title} failed: ${failures.join(", ")}`);
  }
  runs.push({
    scenario: item.scenario,
    title: item.title,
    status: result.status,
    taskId: result.taskId,
    paymentTx: result.payment?.txHash || null,
    proofValid: result.hire?.zkProofValid ?? null,
    approvedRoot: result.hire?.zkApprovedRoot ?? null,
    settlement: result.hire?.settlementStatus || null,
  });
}

const artifactPack = await getJson(`${gatewayUrl}/api/demo/artifact-pack`);
if (artifactPack.status !== "ready" || artifactPack.coverage?.recorded !== 3) {
  throw new Error(`Artifact pack is not ready: ${JSON.stringify(artifactPack.coverage)}`);
}

console.log(JSON.stringify({
  status: "passed",
  elapsedMs: Date.now() - startedAt,
  gateway: gatewayUrl,
  demo: `${gatewayUrl}/demo`,
  preflight: preflight.status,
  artifactPack: {
    status: artifactPack.status,
    coverage: artifactPack.coverage,
    verdict: artifactPack.verdict,
  },
  runs,
}, null, 2));

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

async function getJson(url) {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}
