import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, ".tmp", "zk");
const snarkjsCli = path.join(root, "node_modules", "snarkjs", "build", "cli.cjs");

const inputPath = path.join(outDir, "deposit_input.json");
const proofPath = path.join(outDir, "deposit_proof.json");
const publicPath = path.join(outDir, "deposit_public.json");
const wasmPath = path.join(root, "public", "circuits", "deposit_commitment.wasm");
const zkeyPath = path.join(root, "public", "circuits", "deposit_commitment_final.zkey");
const vkPath = path.join(root, "public", "circuits", "deposit_commitment_vk.json");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  inputPath,
  JSON.stringify(
    {
      secret: "12345",
      nullifier: "67890",
      amount: "100",
    },
    null,
    2
  )
);

runSnarkjs([
  "groth16",
  "fullprove",
  inputPath,
  wasmPath,
  zkeyPath,
  proofPath,
  publicPath,
]);
runSnarkjs(["groth16", "verify", vkPath, publicPath, proofPath]);

const publicSignals = JSON.parse(fs.readFileSync(publicPath, "utf-8"));
const proofBytes = fs.statSync(proofPath).size;

console.log(`Proof: ${path.relative(root, proofPath)}`);
console.log(`Public signals: ${JSON.stringify(publicSignals)}`);
console.log(`Proof size: ${proofBytes} bytes`);

function runSnarkjs(args) {
  const result = spawnSync(process.execPath, [snarkjsCli, ...args], {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
