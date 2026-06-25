# x402 ZK Mesh

Paid AI-agent execution mesh on Stellar Testnet with a load-bearing ZK membership gate.

## Three-Sentence Pitch

X402 ZK Mesh turns paid AI-agent execution into a verifiable Stellar workflow: a client pays through a 402-style Stellar gate, then the gateway routes work to external agent workers only after a private membership proof passes. ZK is load-bearing: invalid proofs and valid proofs from unapproved guild roots are blocked before worker execution. The judge suite records the happy path and both negative paths with Stellar Testnet payment transactions, Soroban verifier simulation evidence, settlement links, and hash-bound receipts.

## Why This Fits Stellar Hacks: Real-World ZK

- ZK is not decorative: worker delegation is impossible unless the membership proof verifies and the Merkle root is approved.
- Stellar is part of the execution path: payments are validated through Stellar Horizon, verifier contracts are deployed on Stellar Testnet, and successful runs settle receipts through the guild registry contract.
- The project includes negative tests: tampered proof and unapproved root both block before execution.
- The demo exposes machine-readable evidence for judges instead of requiring trust in the UI.

## What Judges Should Open

Start the full local judge stack:

```bash
npm install
npm run demo:judge:stack
```

Open:

```text
http://localhost:3010/demo
```

Expected first viewport:

- `STATUS: COMPLETE`
- `CURRENT TRACE PATH 6/6`
- `SCENARIO EVIDENCE 3/3`
- `Submission Pack: READY`

Then run:

```bash
npm run demo:judge:suite
npm run demo:submission:pack
```

`demo:submission:pack` writes `.tmp/submission-pack.md` from live local evidence.

## Evidence Endpoints

```text
http://localhost:3010/api/demo/preflight
http://localhost:3010/api/demo/artifact-pack
http://localhost:3010/api/demo/submission-pack
http://localhost:3010/api/demo/trace
```

What they show:

- `preflight`: unpaid HTTP 402 challenge, worker readiness, relayer readiness, and honest claim boundaries.
- `artifact-pack`: scenario coverage, Stellar payment tx hashes, proof evidence, settlement tx, receipt hashes.
- `submission-pack`: copy-ready submission summary, proof-of-work, judge steps, and video outline.
- `trace`: selected full happy-path trace plus recent audit traces.

## Judge Suite Scenarios

| Scenario | Result | Why it matters |
| --- | --- | --- |
| Fresh trace | Payment accepted, proof verified, worker delegated, settlement confirmed | Shows the full paid agent workflow |
| Invalid proof | Tampered proof rejected before delegation | Shows ZK verification is load-bearing |
| Unapproved root | Valid proof rejected by guild-root policy | Shows proof validity is not enough without approved membership state |

## Current Live Evidence Shape

The latest local run should show:

- Hard path: `complete 6/6`
- Scenario coverage: `3/3`
- Payment asset: `6 XLM` on Stellar Testnet by default
- ZK evidence: `sim-ledger-*` from Soroban verifier simulation
- Settlement: real Stellar Testnet transaction on the fresh path when relayer secrets are configured

Contract IDs used by the current demo:

| Role | Contract |
| --- | --- |
| Membership verifier | `CBX3GKLGB73LKYGWDWNIIJO7MDIZHE73KS2SRZWBC3TBVYKYT6ANCE5Y` |
| Guild registry | `CDJKNLOK5U4N7IPLDDX2Y3FPMSS6ERREGU7VXCXDVANC7YUAB56ZD7ZB` |
| Deposit verifier | `CAEWGDTGCIDBFKLSYW5EYANR227JXO7G4WGGHYD5WTGZMYL7YNPP44UE` |
| Execution verifier | `CCJRM2X4Y7RPUHL5GE6LXSPWQH2LLBV6LGHB4CXPJ4SCWXL5PP6JIQKQ` |

## Architecture

```text
Client
  -> Stellar 402-style payment gate
  -> Gateway preflight / replay guard / spending policy
  -> Worker membership proof request
  -> Soroban verifier simulation
  -> Guild root approval check
  -> Mesh worker delegation
  -> Worker result hash
  -> Guild registry settlement receipt
  -> Hash-bound task receipt
```

## ZK Implementation

- Circuits live in `circuits/`.
- Membership proof is the load-bearing judge path.
- Worker agents generate Groth16 membership proofs from gateway-issued membership data.
- Gateway verifies via Soroban verifier simulation first; local snarkjs fallback is used only if RPC fails.
- Gateway separately checks that the proof root is approved in the guild registry state.

The important distinction:

```text
valid proof + approved root     -> delegate + settle
invalid proof                   -> block before worker execution
valid proof + unapproved root   -> block by policy before worker execution
```

## Honest Scope

- The demo uses a Stellar Testnet transaction-hash-backed 402 gate through `x-l402-txhash` or `Authorization: L402`.
- It does not claim a Coinbase facilitator integration.
- The live judge demo uses native XLM unless `STELLAR_PAYMENT_ASSET_CODE`, issuer, balances, and trustlines are configured for USDC.
- `sim-ledger-*` is Soroban RPC simulation evidence, not a transaction hash.
- Settlement links are real Stellar Testnet transactions when relayer secrets are configured.
- The WASM quarantine path reports its active engine; the fallback heuristic ruleset is explicit, not hidden.

## Useful Commands

```bash
npm run test
npm run lint
npm run build
npm run demo:judge:preflight
npm run demo:judge:suite
npm run demo:submission:pack
node scripts/smoke-soroban-verifier.mjs
node scripts/smoke-soroban-verifier.mjs --unapproved-root
```

## Demo Video

Use `docs/DEMO_VIDEO_SCRIPT.md`.

The video should show:

1. `/demo` first viewport with `COMPLETE 6/6`.
2. `RUN JUDGE SUITE`.
3. Fresh trace passing.
4. Invalid proof blocking.
5. Unapproved root blocking.
6. `/api/demo/submission-pack` and Stellar explorer links.

## Repo Map

```text
src/app/demo/                    Judge dashboard UI
src/app/api/demo/run/            Live scenario runner
src/app/api/demo/preflight/      Judge readiness report
src/app/api/demo/artifact-pack/  Machine-readable scenario evidence
src/app/api/demo/submission-pack Copy-ready submission package
src/lib/zk-verifier.ts           Soroban-first Groth16 verifier path
src/lib/demo-trace.ts            Trace construction and receipt evidence
src/lib/demo-submission-pack.ts  Submission summary builder
guild_agent_bot.js               Separate mesh worker process
circuits/                        Circom Groth16 circuits and keys
contracts/                       Soroban verifier and registry contracts
docs/JUDGE_GUIDE.md              Judge workflow
docs/DEMO_VIDEO_SCRIPT.md        2-3 minute video script
```
