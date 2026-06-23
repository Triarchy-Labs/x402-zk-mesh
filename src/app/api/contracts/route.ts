import { NextResponse } from "next/server";
import { getContractAddresses } from "@/lib/zk-verifier";
import { isGuildRelayerConfigured } from "@/lib/stellar-guild-relayer";

/**
 * GET /api/contracts — Returns deployed Soroban contract addresses.
 * Useful for frontend clients and external integrators.
 */
export async function GET() {
  const contracts = getContractAddresses();
  const guildRelayerConfigured = isGuildRelayerConfigured();

  return NextResponse.json({
    status: "live",
    network: contracts.network,
    protocol: contracts.protocol,
    rpc: contracts.rpc,
    contracts: {
      verifier: {
        id: contracts.verifier.deposit_commitment,
        explorer: `https://stellar.expert/explorer/testnet/contract/${contracts.verifier.deposit_commitment}`,
      },
      verifiers: Object.fromEntries(
        Object.entries(contracts.verifier).map(([name, id]) => [
          name,
          {
            id,
            explorer: `https://stellar.expert/explorer/testnet/contract/${id}`,
          },
        ]),
      ),
      privacyPool: {
        id: contracts.privacyPool,
        explorer: `https://stellar.expert/explorer/testnet/contract/${contracts.privacyPool}`,
      },
      guildRegistry: {
        id: contracts.guildRegistry,
        explorer: `https://stellar.expert/explorer/testnet/contract/${contracts.guildRegistry}`,
        relayer: {
          configured: guildRelayerConfigured,
          submissionMode: guildRelayerConfigured ? "enabled" : "prepared_artifacts_only",
          rpc: contracts.rpc,
          redeployNote: "Use npm run contracts:deploy:guild and set ZK_GUILD_REGISTRY_CONTRACT_ID before claiming live settle_proof support.",
        },
        localAbi: {
          rootFunctions: ["update_root", "is_valid_root", "get_root"],
          settlementFunctions: [
            "settle_proof",
            "is_nullifier_used",
            "has_settlement",
            "get_settlement",
            "settlement_count",
          ],
          events: ["guild:init", "root:update", "proof:settle", "proof:replay", "proof:reject"],
          liveRelayerConfigured: guildRelayerConfigured,
          liveSubmissionMode: guildRelayerConfigured ? "enabled" : "prepared_artifacts_only",
        },
      },
    },
  });
}
