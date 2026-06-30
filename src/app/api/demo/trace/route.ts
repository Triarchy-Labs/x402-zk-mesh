import { NextResponse } from "next/server";
import { readDemoTraces } from "@/lib/demo-trace";
import { getContractAddresses } from "@/lib/zk-verifier";
import { isGuildRelayerConfigured } from "@/lib/stellar-guild-relayer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limitParam = Number.parseInt(url.searchParams.get("limit") || "5", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 25) : 5;
  const traces = await readDemoTraces(limit);
  const latest = traces.find((trace) => trace.status === "complete") || traces[0] || null;
  const contracts = getContractAddresses();

  return NextResponse.json({
    status: latest ? latest.status : "empty",
    network: "stellar-testnet",
    generatedAt: new Date().toISOString(),
    relayers: {
      guildRegistry: isGuildRelayerConfigured(),
      zkVerifier:
        !!process.env.ZK_VERIFIER_RELAYER_SECRET ||
        !!process.env.ZK_GUILD_REGISTRY_RELAYER_SECRET ||
        !!process.env.ZK_GUILD_REGISTRY_RELAYER?.startsWith("S"),
    },
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
    trace: latest,
    traces,
  });
}
