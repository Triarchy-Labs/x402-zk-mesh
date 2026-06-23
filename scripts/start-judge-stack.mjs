import { spawn } from "node:child_process";

const gatewayPort = process.env.GATEWAY_PORT || "3010";
const gatewayUrl = process.env.GATEWAY_URL || `http://localhost:${gatewayPort}`;
const workerAUrl = process.env.JUDGE_WORKER_A_URL || "http://127.0.0.1:3011/api/hire";
const workerBUrl = process.env.JUDGE_WORKER_B_URL || "http://127.0.0.1:3012/api/hire";
const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";

const baseEnv = {
  ...process.env,
  GATEWAY_URL: gatewayUrl,
  P2P_WORKER_URL: workerAUrl,
  P2P_WORKER_URLS: process.env.P2P_WORKER_URLS || `${workerAUrl},${workerBUrl}`,
};

const processes = [
  {
    name: "gateway",
    command: npxBin,
    args: ["next", "dev", "-p", gatewayPort],
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

const children = processes.map((item) => {
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
  return child;
});

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
