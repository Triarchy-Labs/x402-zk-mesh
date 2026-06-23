import { NextResponse } from "next/server";
import { buildDemoArtifactPack } from "@/lib/demo-artifact-pack";
import { readDemoTraces } from "@/lib/demo-trace";
import { isGuildRelayerConfigured } from "@/lib/stellar-guild-relayer";
import { getContractAddresses } from "@/lib/zk-verifier";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const generatedAt = new Date().toISOString();
  const traces = await readDemoTraces(25);
  const contracts = getContractAddresses();
  const pack = buildDemoArtifactPack({
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
    relayers: {
      guildRegistry: isGuildRelayerConfigured(),
      zkVerifier:
        !!process.env.ZK_VERIFIER_RELAYER_SECRET ||
        !!process.env.ZK_GUILD_REGISTRY_RELAYER_SECRET ||
        !!process.env.ZK_GUILD_REGISTRY_RELAYER?.startsWith("S"),
    },
  });

  return NextResponse.json(pack);
}
