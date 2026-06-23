import fs from "node:fs";
import path from "node:path";
import * as StellarSDK from "@stellar/stellar-sdk";

const DEFAULT_RPC_URL = "https://soroban-testnet.stellar.org:443";
const DEFAULT_WASM =
  "contracts/target/wasm32v1-none/release/guild_registry.wasm";
const ZERO_ROOT = `0x${"0".repeat(64)}`;

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

function requireSecret() {
  const secret =
    process.env.ZK_GUILD_REGISTRY_RELAYER_SECRET ||
    (process.env.ZK_GUILD_REGISTRY_RELAYER?.startsWith("S")
      ? process.env.ZK_GUILD_REGISTRY_RELAYER
      : "");
  if (!secret) {
    throw new Error("Set ZK_GUILD_REGISTRY_RELAYER_SECRET in the environment or .env.local.");
  }
  return secret;
}

function bytes32ScVal(value) {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error(`Expected 32-byte hex value, got ${value}`);
  }
  return StellarSDK.nativeToScVal(Buffer.from(normalized, "hex"), { type: "bytes" });
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForTransaction(server, hash) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const response = await server.getTransaction(hash);
    if (response.status !== "NOT_FOUND") {
      return response;
    }
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for ${hash}`);
}

async function getFundedAccount(server, keypair) {
  try {
    return await server.getAccount(keypair.publicKey());
  } catch (error) {
    if (process.argv.includes("--no-fund")) {
      throw error;
    }
    console.log(`Funding ${keypair.publicKey()} through Friendbot...`);
    await server.requestAirdrop(keypair.publicKey());
    await sleep(3000);
    return await server.getAccount(keypair.publicKey());
  }
}

async function buildAndSend(server, keypair, operation) {
  const account = await getFundedAccount(server, keypair);
  const tx = new StellarSDK.TransactionBuilder(account, {
    fee: process.env.STELLAR_BASE_FEE || StellarSDK.BASE_FEE,
    networkPassphrase: StellarSDK.Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  const prepared = await server.prepareTransaction(tx);
  prepared.sign(keypair);

  const sent = await server.sendTransaction(prepared);
  if (!sent.hash || sent.status !== "PENDING") {
    throw new Error(`sendTransaction failed: ${JSON.stringify(sent)}`);
  }

  const confirmed = await waitForTransaction(server, sent.hash);
  if (confirmed.status !== "SUCCESS") {
    throw new Error(`Transaction ${sent.hash} finished with ${confirmed.status}`);
  }

  return { hash: sent.hash, response: confirmed };
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const rpcUrl = process.env.STELLAR_RPC_URL || process.env.SOROBAN_RPC_URL || DEFAULT_RPC_URL;
const wasmPath = path.resolve(argValue("--wasm", DEFAULT_WASM));
const initialRoot = argValue("--initial-root", process.env.ZK_GUILD_REGISTRY_INITIAL_ROOT || ZERO_ROOT);
const initialCount = Number.parseInt(argValue("--member-count", process.env.ZK_GUILD_REGISTRY_INITIAL_MEMBER_COUNT || "0"), 10);

if (!fs.existsSync(wasmPath)) {
  throw new Error(`Missing guild-registry wasm at ${wasmPath}. Run npm run contracts:build first.`);
}
if (!Number.isInteger(initialCount) || initialCount < 0 || initialCount > 0xffffffff) {
  throw new Error(`Invalid member count: ${initialCount}`);
}

const sourceKeypair = StellarSDK.Keypair.fromSecret(requireSecret());
const server = new StellarSDK.rpc.Server(rpcUrl);
const bytecode = fs.readFileSync(wasmPath);

console.log(`Relayer: ${sourceKeypair.publicKey()}`);
console.log(`RPC: ${rpcUrl}`);
console.log(`Wasm: ${wasmPath}`);

const upload = await buildAndSend(
  server,
  sourceKeypair,
  StellarSDK.Operation.uploadContractWasm({ wasm: bytecode }),
);
const wasmHash = upload.response.returnValue.bytes();
console.log(`Uploaded wasm tx: ${upload.hash}`);
console.log(`Wasm hash: ${Buffer.from(wasmHash).toString("hex")}`);

const deploy = await buildAndSend(
  server,
  sourceKeypair,
  StellarSDK.Operation.createCustomContract({
    address: StellarSDK.Address.fromString(sourceKeypair.publicKey()),
    wasmHash,
    salt: Buffer.from(upload.hash, "hex"),
  }),
);
const contractId = StellarSDK.Address.fromScVal(deploy.response.returnValue).toString();
console.log(`Deployed contract tx: ${deploy.hash}`);
console.log(`Contract id: ${contractId}`);

const contract = new StellarSDK.Contract(contractId);
const init = await buildAndSend(
  server,
  sourceKeypair,
  contract.call(
    "init",
    StellarSDK.Address.fromString(sourceKeypair.publicKey()).toScVal(),
    bytes32ScVal(initialRoot),
    StellarSDK.nativeToScVal(initialCount, { type: "u32" }),
  ),
);

const summary = {
  network: "testnet",
  relayerPublicKey: sourceKeypair.publicKey(),
  contractId,
  wasmHash: Buffer.from(wasmHash).toString("hex"),
  uploadTx: upload.hash,
  deployTx: deploy.hash,
  initTx: init.hash,
  explorer: `https://stellar.expert/explorer/testnet/contract/${contractId}`,
};

console.log(JSON.stringify(summary, null, 2));
console.log("\n.env.local update:");
console.log(`ZK_GUILD_REGISTRY_CONTRACT_ID=${contractId}`);
console.log("ZK_GUILD_REGISTRY_RELAYER_SECRET=<keep-your-existing-secret>");
