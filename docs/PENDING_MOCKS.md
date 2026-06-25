# Pending Prototype Gaps

This file tracks places that are intentionally still prototype-only. Do not present these paths as production-complete in the README, DoraHacks submission, or demo narration until the matching item is removed.

## x402 payment envelope

- Current state: `/api/hire` accepts a Stellar Testnet transaction hash through `x-l402-txhash` or `Authorization: L402 ...`, then validates the transaction through Horizon.
- Missing: official Stellar x402 facilitator/client envelope using `@x402/*` packages.
- Demo wording: "Stellar transaction-hash backed x402-compatible payment gate", not "full facilitator-integrated x402".

## Soroban ZK invocation

- Current state: verifier contracts exist and local Groth16 verification works. The server attempts Soroban RPC simulation, but falls back to local verification unless the RPC returns a real contract result XDR.
- Missing: SDK-built Soroban transaction XDR for `verify_proof`.
- Demo wording: "local snarkjs proof verification with deployed Soroban verifier prototypes", unless `method: "soroban"` is physically returned.

## Guild root persistence

- Current state: `guild_agent_bot.js` registers as a separate worker process, receives a field-compatible membership leaf/root, generates a real `membership_proof` Groth16 proof, and the gateway blocks P2P delegation unless the proof verifies and the root is approved by the registry. The `guild-registry` Soroban contract stores approved roots, proof nullifiers, settlement receipts, and emits root/proof events.
- Current live path: when `ZK_GUILD_REGISTRY_RELAYER_SECRET` is configured, the gateway submits `settle_proof` to Stellar Testnet via RPC and returns a confirmed transaction hash.
- Missing: production peer registry and persistent remote worker reputation. Local judge mode still uses explicitly configured worker URLs.
- Demo wording: "worker proves membership against a gateway-issued ZK root, then the gateway writes a settlement receipt to the guild-registry contract on Stellar Testnet."

## Worker discovery

- Current state: local demo routes to `http://127.0.0.1:3001/api/hire` or `P2P_WORKER_URL`.
- Missing: persistent peer registry, allowlisted remote worker URLs, health scoring, and Soroban-backed worker state.
- Demo wording: "separate local worker process", not "open dynamic agent network".

## WASM quarantine

- Current state: `plugins/quarantine.wasm` is committed as the default Extism plugin artifact, and payload audit uses it when available. The heuristic fallback remains as a resilience path when the plugin cannot be loaded.
- Missing: deeper policy coverage and malicious-payload corpus beyond the current plugin heuristics.
- Demo wording: "Extism WASM quarantine with heuristic fallback", not "formally verified sandbox policy."
