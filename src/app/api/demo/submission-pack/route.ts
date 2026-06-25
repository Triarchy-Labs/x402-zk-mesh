import { NextResponse } from "next/server";
import { buildDemoArtifactPack } from "@/lib/demo-artifact-pack";
import {
  buildDemoPreflightReport,
  getDemoPlatformWallet,
  getDemoWorkerUrls,
  hasDemoPayer,
} from "@/lib/demo-preflight";
import { buildDemoSubmissionPack } from "@/lib/demo-submission-pack";
import { readDemoTraces } from "@/lib/demo-trace";
import { isGuildRelayerConfigured } from "@/lib/stellar-guild-relayer";
import { getContractAddresses } from "@/lib/zk-verifier";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const generatedAt = new Date().toISOString();
  const gatewayUrl = new URL(req.url).origin;
  const relayers = {
    guildRegistry: isGuildRelayerConfigured(),
    zkVerifier:
      !!process.env.ZK_VERIFIER_RELAYER_SECRET ||
      !!process.env.ZK_GUILD_REGISTRY_RELAYER_SECRET ||
      !!process.env.ZK_GUILD_REGISTRY_RELAYER?.startsWith("S"),
  };
  const contracts = getContractAddresses();
  const traces = await readDemoTraces(25);
  const artifactPack = buildDemoArtifactPack({
    traces,
    generatedAt,
    contracts: {
      membershipVerifier: {
        id: contracts.verifier.membership_proof,
        explorer: `https://stellar.expert/explorer/testnet/contract/${contracts.verifier.membership_proof}`,
      },
      guildRegistry: {
        id: contracts.guildRegistry,
        explorer: `https://stellar.expert/explorer/testnet/contract/${contracts.guildRegistry}`,
      },
    },
    relayers,
  });
  const preflight = await buildDemoPreflightReport({
    gatewayUrl,
    platformWallet: getDemoPlatformWallet(),
    payerConfigured: hasDemoPayer(),
    demoAmount: process.env.STELLAR_DEMO_AMOUNT || "6.0000000",
    workerUrls: getDemoWorkerUrls(),
    relayers,
  });

  return NextResponse.json(buildDemoSubmissionPack({
    artifactPack,
    preflight,
    generatedAt,
  }));
}
