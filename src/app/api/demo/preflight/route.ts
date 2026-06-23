import { NextResponse } from "next/server";
import {
  buildDemoPreflightReport,
  getDemoPlatformWallet,
  getDemoWorkerUrls,
  hasDemoPayer,
} from "@/lib/demo-preflight";
import { isGuildRelayerConfigured } from "@/lib/stellar-guild-relayer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const gatewayUrl = new URL(req.url).origin;
  const report = await buildDemoPreflightReport({
    gatewayUrl,
    platformWallet: getDemoPlatformWallet(),
    payerConfigured: hasDemoPayer(),
    demoAmount: process.env.STELLAR_DEMO_AMOUNT || "6.0000000",
    workerUrls: getDemoWorkerUrls(),
    relayers: {
      guildRegistry: isGuildRelayerConfigured(),
      zkVerifier:
        !!process.env.ZK_VERIFIER_RELAYER_SECRET ||
        !!process.env.ZK_GUILD_REGISTRY_RELAYER_SECRET ||
        !!process.env.ZK_GUILD_REGISTRY_RELAYER?.startsWith("S"),
    },
  });

  return NextResponse.json(report);
}
