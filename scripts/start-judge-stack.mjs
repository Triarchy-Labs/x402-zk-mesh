import { spawn } from "node:child_process";
import path from "node:path";

const gatewayPort = process.env.GATEWAY_PORT || "3010";
const gatewayUrl = process.env.GATEWAY_URL || `http://localhost:${gatewayPort}`;
const workerAUrl = process.env.JUDGE_WORKER_A_URL || "http://127.0.0.1:3011/api/hire";
const workerBUrl = process.env.JUDGE_WORKER_B_URL || "http://127.0.0.1:3012/api/hire";
const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");

const baseEnv = {
  ...process.env,
  GATEWAY_URL: gatewayUrl,
  P2P_WORKER_URL: workerAUrl,
  P2P_WORKER_URLS: process.env.P2P_WORKER_URLS || `${workerAUrl},${workerBUrl}`,
};

const processes = [
  {
    name: "gateway",
    command: process.execPath,
    args: [nextBin, "dev", "-p", gatewayPort],
    env: baseEnv,
  },
  {
    name: "worker-a",
    command: process.execPath,
    args: ["guild_agent_bot.js"],
    env: {
      ...baseEnv,
      PORT: "3011",
      AGENT_NAME: "mesh-audit-worker-3011",
      AGENT_CAPABILITIES: "code-audit,soroban-review,llm-execution,security-scan",
      AGENT_PUBLIC_KEY: "GDEMO-WORKER-3011",
    },
  },
  {
    name: "worker-b",
    command: process.execPath,
    args: ["guild_agent_bot.js"],
    env: {
      ...baseEnv,
      PORT: "3012",
      AGENT_NAME: "mesh-soroban-worker-3012",
      AGENT_CAPABILITIES: "soroban-review,security-scan",
      AGENT_PUBLIC_KEY: "GDEMO-WORKER-3012",
    },
  },
];

let shuttingDown = false;
const children = [];

function launch(item) {
  const child = spawn(item.command, item.args, {
    cwd: process.cwd(),
    env: item.env,
    stdio: "inherit",
    shell: false,
  });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`[${item.name}] exited with ${signal || code}`);
    shutdown(code || 1);
  });
  children.push(child);
  return child;
}

launch(processes[0]);
await waitForJson(`${gatewayUrl}/api/contracts`, (data) => data?.status === "live", "gateway");

launch(processes[1]);
await waitForJson(workerHealthUrl(workerAUrl), (data) => data?.status === "alive" && data?.guild_member === true, "worker-a");

launch(processes[2]);
await waitForJson(workerHealthUrl(workerBUrl), (data) => data?.status === "alive" && data?.guild_member === true, "worker-b");

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

console.log(`[judge-stack] gateway: ${gatewayUrl}`);
console.log(`[judge-stack] workers: ${workerAUrl}, ${workerBUrl}`);
console.log("[judge-stack] open /demo after the gateway reports ready.");
setInterval(() => {}, 2 ** 31 - 1);

async function waitForJson(url, predicate, label) {
  const deadline = Date.now() + 90000;
  let lastError = "";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.ok && predicate(data)) {
        console.log(`[judge-stack] ${label} ready: ${url}`);
        return;
      }
      lastError = `HTTP ${response.status}: ${JSON.stringify(data)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await sleep(1000);
  }

  console.error(`[judge-stack] ${label} not ready: ${lastError}`);
  shutdown(1);
}

function workerHealthUrl(workerUrl) {
  const parsed = new URL(workerUrl);
  if (parsed.pathname.endsWith("/api/hire")) {
    parsed.pathname = parsed.pathname.slice(0, -"/api/hire".length) + "/health";
  } else {
    parsed.pathname = "/health";
  }
  parsed.search = "";
  return parsed.toString();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
