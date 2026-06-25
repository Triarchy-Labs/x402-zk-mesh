# Demo Video Script

Target length: 2-3 minutes.

## 0:00-0:20 - What This Is

Show `/demo` first viewport.

Narration:

> This is x402 ZK Mesh: a paid AI-agent execution mesh on Stellar Testnet. A client pays through a 402-style Stellar gate, but work is delegated to external agents only if a private ZK membership proof verifies and the guild root is approved.

Point at:

- `STATUS: COMPLETE`
- `CURRENT TRACE PATH 6/6`
- `SCENARIO EVIDENCE 3/3`

## 0:20-0:50 - Full Happy Path

Click or show `RUN FRESH TRACE`.

Narration:

> The happy path records the complete flow: Stellar payment, private worker proof, mesh delegation, worker result, Soroban settlement, and a hash-bound receipt.

Show:

- Stellar payment tx link
- `method: soroban`
- `proof valid: true`
- `approved root: true`
- settlement tx link
- receipt hashes

## 0:50-1:20 - Invalid Proof Block

Click or show `RUN BLOCKED TRACE`.

Narration:

> This is the first negative path. The worker returns a tampered membership proof. The gateway verifies it, marks proof valid as false, and blocks before worker execution. This is why ZK is load-bearing rather than decorative.

Show:

- `INVALID PROOF`
- `proof/root false / not evaluated`
- no settlement tx
- proof simulation evidence

## 1:20-1:50 - Unapproved Root Block

Click or show `RUN UNAPPROVED ROOT`.

Narration:

> This is the more important negative path. The proof is cryptographically valid, but it was generated from a root that the guild registry has not approved. The gateway rejects it by policy before delegation.

Show:

- `UNAPPROVED ROOT`
- `proof/root true / false`
- no settlement tx
- proof simulation evidence

## 1:50-2:20 - Evidence Pack

Open:

```text
http://localhost:3010/api/demo/submission-pack
```

Narration:

> Judges do not need to trust the UI. The submission pack exposes machine-readable evidence: readiness score, judge steps, proof-of-work, live payment hashes, proof simulation evidence, contract IDs, and honest scope.

Show:

- `status: ready`
- `readinessScore`
- `proofOfWork`
- `copyMarkdown`

## 2:20-2:45 - Stellar Verification

Open one payment tx or settlement tx in Stellar Expert.

Narration:

> The payment and settlement links are real Stellar Testnet artifacts. The ZK verifier path reports Soroban RPC simulation evidence as `sim-ledger-*`, and the verifier and guild registry contract IDs are linked from the demo.

Show:

- payment tx explorer
- settlement tx explorer
- membership verifier contract ID
- guild registry contract ID

## Closing Line

Narration:

> The core idea is not another AI agent. It is an execution layer for many agents: paid, gated by private ZK membership, blocked on invalid or unauthorized proofs, and auditable on Stellar.

## Do Not Say

- Do not say this is a Coinbase facilitator integration.
- Do not say every payment is USDC unless the demo run is configured for USDC trustlines.
- Do not call `sim-ledger-*` a transaction hash.
- Do not say the fallback WASM heuristic is hidden; it is explicit in the trace.
