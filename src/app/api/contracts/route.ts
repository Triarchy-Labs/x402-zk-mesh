import { NextResponse } from "next/server";
import { getContractAddresses } from "@/lib/zk-verifier";

/**
 * GET /api/contracts — Returns deployed Soroban contract addresses.
 * Useful for frontend clients and external integrators.
 */
export async function GET() {
  const contracts = getContractAddresses();

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
      privacyPool: {
        id: contracts.privacyPool,
        explorer: `https://stellar.expert/explorer/testnet/contract/${contracts.privacyPool}`,
      },
      guildRegistry: {
        id: contracts.guildRegistry,
        explorer: `https://stellar.expert/explorer/testnet/contract/${contracts.guildRegistry}`,
      },
    },
  });
}
