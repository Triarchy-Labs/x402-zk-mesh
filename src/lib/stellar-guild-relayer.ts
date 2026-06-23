import * as StellarSDK from "@stellar/stellar-sdk";
import type {
  GuildRootArtifact,
  GuildSettlementArtifact,
} from "./soroban-guild-registry";

export type GuildRelayerFunction = "update_root" | "settle_proof" | "init";

export interface GuildRelayerSubmission {
  mode: "live" | "disabled" | "failed";
  status: "skipped" | "submitted" | "confirmed" | "failed";
  network: "testnet";
  contractId: string;
  function: GuildRelayerFunction;
  relayerPublicKey?: string;
  txHash?: string;
  explorer?: string;
  rpcUrl?: string;
  returnValue?: unknown;
  returnValueXdr?: string;
  error?: string;
  elapsedMs?: number;
}

const DEFAULT_TESTNET_RPC_URL = "https://soroban-testnet.stellar.org:443";
const TESTNET_EXPLORER_TX = "https://stellar.expert/explorer/testnet/tx";

function getRpcUrl(): string {
  return process.env.STELLAR_RPC_URL || process.env.SOROBAN_RPC_URL || DEFAULT_TESTNET_RPC_URL;
}

function getRelayerSecret(): string | null {
  const explicit = process.env.ZK_GUILD_REGISTRY_RELAYER_SECRET?.trim();
  if (explicit) {
    return explicit;
  }

  const legacy = process.env.ZK_GUILD_REGISTRY_RELAYER?.trim();
  if (legacy?.startsWith("S")) {
    return legacy;
  }

  return null;
}

export function isGuildRelayerConfigured(): boolean {
  return !!getRelayerSecret();
}

function disabledSubmission(
  artifact: GuildRootArtifact | GuildSettlementArtifact,
): GuildRelayerSubmission {
  return {
    mode: "disabled",
    status: "skipped",
    network: "testnet",
    contractId: artifact.contractId,
    function: artifact.function,
    rpcUrl: getRpcUrl(),
    error: "ZK_GUILD_REGISTRY_RELAYER_SECRET is not configured; returning prepared Soroban artifact only.",
  };
}

function failedSubmission(
  artifact: GuildRootArtifact | GuildSettlementArtifact,
  error: unknown,
  startedAt: number,
): GuildRelayerSubmission {
  return {
    mode: "failed",
    status: "failed",
    network: "testnet",
    contractId: artifact.contractId,
    function: artifact.function,
    rpcUrl: getRpcUrl(),
    error: error instanceof Error ? error.message : String(error),
    elapsedMs: Date.now() - startedAt,
  };
}

function hexBytesScVal(value: string): StellarSDK.xdr.ScVal {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (!/^[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error(`Expected 32-byte hex argument, got ${value}`);
  }

  return StellarSDK.nativeToScVal(Buffer.from(normalized, "hex"), { type: "bytes" });
}

function u32ScVal(value: number): StellarSDK.xdr.ScVal {
  if (!Number.isInteger(value) || value < 0 || value > 0xffffffff) {
    throw new Error(`Expected u32 member count, got ${value}`);
  }

  return StellarSDK.nativeToScVal(value, { type: "u32" });
}

function normalizeReturnValue(value: unknown): unknown {
  if (Buffer.isBuffer(value)) {
    return `0x${value.toString("hex")}`;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeReturnValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeReturnValue(item)]),
    );
  }

  return value;
}

async function waitForTransaction(
  server: StellarSDK.rpc.Server,
  txHash: string,
): Promise<StellarSDK.rpc.Api.GetTransactionResponse> {
  const attempts = Number.parseInt(process.env.STELLAR_TX_POLL_ATTEMPTS || "30", 10);
  const delayMs = Number.parseInt(process.env.STELLAR_TX_POLL_DELAY_MS || "1000", 10);

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await server.getTransaction(txHash);
    if (response.status !== "NOT_FOUND") {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`Timed out waiting for Stellar transaction ${txHash}`);
}

async function invokeGuildRegistry(
  artifact: GuildRootArtifact | GuildSettlementArtifact,
  args: StellarSDK.xdr.ScVal[],
): Promise<GuildRelayerSubmission> {
  const startedAt = Date.now();
  const secret = getRelayerSecret();
  if (!secret) {
    return disabledSubmission(artifact);
  }

  try {
    const sourceKeypair = StellarSDK.Keypair.fromSecret(secret);
    const server = new StellarSDK.rpc.Server(getRpcUrl());
    const contract = new StellarSDK.Contract(artifact.contractId);
    const sourceAccount = await server.getAccount(sourceKeypair.publicKey());
    const tx = new StellarSDK.TransactionBuilder(sourceAccount, {
      fee: process.env.STELLAR_BASE_FEE || StellarSDK.BASE_FEE,
      networkPassphrase: StellarSDK.Networks.TESTNET,
    })
      .addOperation(contract.call(artifact.function, ...args))
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(sourceKeypair);

    const sendResponse = await server.sendTransaction(prepared);
    const txHash = sendResponse.hash;
    if (!txHash) {
      throw new Error(`Stellar RPC did not return a transaction hash: ${JSON.stringify(sendResponse)}`);
    }

    if (sendResponse.status !== "PENDING") {
      return {
        mode: "failed",
        status: "failed",
        network: "testnet",
        contractId: artifact.contractId,
        function: artifact.function,
        relayerPublicKey: sourceKeypair.publicKey(),
        txHash,
        explorer: `${TESTNET_EXPLORER_TX}/${txHash}`,
        rpcUrl: getRpcUrl(),
        error: `Stellar RPC sendTransaction returned ${sendResponse.status}`,
        elapsedMs: Date.now() - startedAt,
      };
    }

    const confirmed = await waitForTransaction(server, txHash);
    const succeeded = confirmed.status === "SUCCESS";
    const confirmedReturnValue = succeeded && "returnValue" in confirmed
      ? confirmed.returnValue
      : undefined;
    const returnValue = confirmedReturnValue
      ? normalizeReturnValue(StellarSDK.scValToNative(confirmedReturnValue))
      : undefined;
    const returnValueXdr = confirmedReturnValue?.toXDR("base64");

    return {
      mode: "live",
      status: succeeded ? "confirmed" : "failed",
      network: "testnet",
      contractId: artifact.contractId,
      function: artifact.function,
      relayerPublicKey: sourceKeypair.publicKey(),
      txHash,
      explorer: `${TESTNET_EXPLORER_TX}/${txHash}`,
      rpcUrl: getRpcUrl(),
      returnValue,
      returnValueXdr,
      error: succeeded ? undefined : `Stellar transaction status: ${confirmed.status}`,
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return failedSubmission(artifact, error, startedAt);
  }
}

export async function submitGuildRootUpdate(
  artifact: GuildRootArtifact,
): Promise<GuildRelayerSubmission> {
  const secret = getRelayerSecret();
  if (!secret) {
    return disabledSubmission(artifact);
  }

  const admin = StellarSDK.Keypair.fromSecret(secret).publicKey();
  return invokeGuildRegistry(artifact, [
    StellarSDK.Address.fromString(admin).toScVal(),
    hexBytesScVal(artifact.args.new_root),
    u32ScVal(artifact.args.new_member_count),
  ]);
}

export async function submitGuildSettlement(
  artifact: GuildSettlementArtifact,
): Promise<GuildRelayerSubmission> {
  const secret = getRelayerSecret();
  if (!secret) {
    return disabledSubmission(artifact);
  }

  const relayer = StellarSDK.Keypair.fromSecret(secret).publicKey();
  return invokeGuildRegistry(artifact, [
    StellarSDK.Address.fromString(relayer).toScVal(),
    hexBytesScVal(artifact.args.nullifier),
    hexBytesScVal(artifact.args.task_hash),
    hexBytesScVal(artifact.args.worker_root),
    hexBytesScVal(artifact.args.result_hash),
    hexBytesScVal(artifact.args.payment_hash),
  ]);
}
