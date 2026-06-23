import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { buildPoseidon } = require("circomlibjs");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, ".tmp", "zk");
const snarkjsCli = path.join(root, "node_modules", "snarkjs", "build", "cli.cjs");
const leaf = "12345";
const pathElements = Array.from({ length: 10 }, () => "0");
const pathIndices = Array.from({ length: 10 }, () => 0);

const inputPath = path.join(outDir, "membership_input.json");
const proofPath = path.join(outDir, "membership_proof.json");
const publicPath = path.join(outDir, "membership_public.json");
const wasmPath = path.join(root, "public", "circuits", "membership_proof.wasm");
const zkeyPath = path.join(root, "public", "circuits", "membership_proof_final.zkey");
const vkPath = path.join(root, "public", "circuits", "membership_proof_vk.json");

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  inputPath,
  JSON.stringify({ leaf, pathElements, pathIndices }, null, 2)
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
const expectedRoot = await computeZeroPathRoot(leaf);

if (publicSignals[0] !== expectedRoot) {
  throw new Error(
    `Membership root mismatch. proof=${publicSignals[0]} expected=${expectedRoot}`
  );
}

console.log(`Proof: ${path.relative(root, proofPath)}`);
console.log(`Membership root: ${publicSignals[0]}`);
console.log(`Approved zero-path root check: OK`);

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

async function computeZeroPathRoot(startLeaf) {
  const poseidon = await buildPoseidon();
  let current = startLeaf;

  for (let i = 0; i < 10; i += 1) {
    current = poseidon.F.toObject(poseidon([current, "0"])).toString();
  }

  return current;
}
