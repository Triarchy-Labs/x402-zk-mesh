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

  return NextResponse.json({
    ...pack,
    verifiabilityEvidence: {
      verdictHashMethod: "sha256(artifacts + stepStatuses + payment + zk + routing + quarantine + settlement)",
      verdictHashCoverage: "12+ decision-critical inputs per trace",
      trustPathAnalysis: {
        paymentValidation: { actor: "Stellar Horizon RPC", aiInvolvement: "NONE" },
        zkVerification: { actor: "Soroban BN254 Groth16 Precompile", aiInvolvement: "NONE" },
        sandboxQuarantine: { actor: "WASM Extism + heuristic engine", aiInvolvement: "NONE" },
        settlementExecution: { actor: "Soroban smart contract", aiInvolvement: "NONE" },
        taskExecution: { actor: "LLM (sandboxed)", aiInvolvement: "SANDBOXED — output only, no security decisions" },
      },
      securityAudit: {
        findingsDocumented: 106,
        documentUrl: "/SECURITY.md",
        criticalResolved: "SC-1 through SC-7",
      },
    },
  });
}
