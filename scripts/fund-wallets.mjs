import fs from "node:fs";
import path from "node:path";
import { Keypair } from "@stellar/stellar-sdk";

async function fundWallet(publicKey, label) {
  console.log(`[fund-wallets] Funding ${label} wallet: ${publicKey}`);
  try {
    const response = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
    if (response.ok) {
      console.log(`[fund-wallets] Successfully funded ${label} wallet.`);
      return true;
    } else {
      const errorText = await response.text();
      console.error(`[fund-wallets] Failed to fund ${label} wallet: ${response.status} ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error(`[fund-wallets] Error funding ${label} wallet:`, error);
    return false;
  }
}

async function run() {
  console.log("[fund-wallets] Generating and funding demo wallets...");
  
  const envPath = path.resolve(".env.local");
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  let changed = false;

  if (!envContent.includes("STELLAR_DEMO_PAYER_SECRET")) {
    const payer = Keypair.random();
    const funded = await fundWallet(payer.publicKey(), "Payer");
    if (funded) {
      envContent += `\nSTELLAR_DEMO_PAYER_SECRET="${payer.secret()}"\n`;
      changed = true;
    } else {
      console.error("[fund-wallets] ABORT: Payer wallet not funded. Secrets will not be saved.");
      process.exit(1);
    }
  }

  if (!envContent.includes("STELLAR_PLATFORM_WALLET")) {
    const platform = Keypair.random();
    const funded = await fundWallet(platform.publicKey(), "Platform");
    if (funded) {
      envContent += `\nSTELLAR_PLATFORM_WALLET="${platform.publicKey()}"\n`;
      envContent += `STELLAR_PLATFORM_SECRET="${platform.secret()}"\n`;
      changed = true;
    } else {
      console.error("[fund-wallets] ABORT: Platform wallet not funded. Secrets will not be saved.");
      process.exit(1);
    }
  }

  if (!envContent.includes("ZK_VERIFIER_RELAYER_SECRET")) {
    const relayer = Keypair.random();
    const funded = await fundWallet(relayer.publicKey(), "Relayer");
    if (funded) {
      envContent += `\nZK_VERIFIER_RELAYER_PUBLIC_KEY="${relayer.publicKey()}"\n`;
      envContent += `ZK_VERIFIER_RELAYER_SECRET="${relayer.secret()}"\n`;
      changed = true;
    } else {
      console.error("[fund-wallets] ABORT: Relayer wallet not funded. Secrets will not be saved.");
      process.exit(1);
    }
  }

  if (changed) {
    fs.writeFileSync(envPath, envContent.trim() + "\n");
    console.log("[fund-wallets] Added wallet secrets to .env.local");
  } else {
    console.log("[fund-wallets] Wallets already exist in .env.local, skipping.");
  }
}

run().catch(console.error);
