# x402 ZK Mesh Judge Guide

This project is a paid AI-agent mesh on Stellar Testnet with a load-bearing ZK admission gate.

## What To Verify

1. Open `http://localhost:3010/demo`.
2. Confirm the first viewport shows `STATUS: COMPLETE`, `CURRENT TRACE PATH 6/6`, and `SCENARIO EVIDENCE 3/3`.
3. Click `RUN JUDGE SUITE`.
4. Confirm the suite records:
   - Fresh trace: valid proof, approved root, delegated worker, confirmed settlement.
   - Invalid proof: tampered proof blocked before worker execution.
   - Unapproved root: cryptographically valid proof blocked by guild-root policy.
5. Open `http://localhost:3010/api/demo/submission-pack` for copy-ready submission evidence.

## Local Commands

```bash
npm run demo:judge:stack
npm run demo:judge:suite
npm run demo:submission:pack
```

`demo:submission:pack` writes `.tmp/submission-pack.md` from the live local API.

## Evidence Surfaces

- `/demo` - judge cockpit, preflight, suite controls, trace, contracts, receipt hashes.
- `/api/demo/preflight` - 402 challenge, worker readiness, relayer readiness, honest claim boundaries.
- `/api/demo/artifact-pack` - machine-readable scenario coverage and Stellar evidence.
- `/api/demo/submission-pack` - pitch, judge steps, proof-of-work, video outline, copy-ready markdown.

## Demo Video

Use `docs/DEMO_VIDEO_SCRIPT.md` for the 2-3 minute walkthrough.

## Honest Scope

- The demo uses a Stellar Testnet transaction-hash-backed 402 gate through `x-l402-txhash` or `Authorization: L402`.
- It does not claim a Coinbase facilitator integration.
- Current live demo payments use native XLM unless `STELLAR_PAYMENT_ASSET_CODE`, issuer, balances, and trustlines are configured for USDC.
- The ZK verifier path uses Soroban verifier simulation evidence (`sim-ledger-*`) plus real deployed verifier contract IDs; settlement links are real Stellar Testnet transactions when relayer secrets are configured.
