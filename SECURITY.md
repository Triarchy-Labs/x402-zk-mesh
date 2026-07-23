# Security Policy — X402 ZK Mesh

## Scope

This is a **hackathon prototype** built for the Stellar Hacks: Real-World ZK competition. It demonstrates zero-knowledge proof concepts on Stellar Protocol 27 and is deployed on **Stellar Testnet only**.

**This codebase is NOT production-ready.** It is a proof-of-concept for the ZK Autonomous Agent Guild architecture.

## Known Limitations (Phase I → Phase II Roadmap)

### Smart Contracts (Soroban)

| ID | Status | Description |
|----|--------|-------------|
| SC-2 | ✅ Fixed | Privacy Pool `init()` now requires admin auth + prevents re-initialization |
| SC-3 | ✅ Fixed | Privacy Pool `update_root()` now requires admin authorization |
| SC-4 | ✅ Fixed | Privacy Pool `withdraw()` no longer trusts caller-supplied boolean — requires proof bytes |
| SC-1 | ✅ Fixed | Guild Registry `init()` now prevents re-initialization |
| SC-5 | ✅ Fixed | Guild Registry `update_root()` now saves OLD root before overwriting |
| Phase II | 🔲 Planned | Cross-contract ZK verifier call in `withdraw()` (currently validates non-empty proof) |
| Phase II | 🔲 Planned | Token transfer integration (SAC/Soroban Token) for real fund flows |
| Phase II | 🔲 Planned | `extend_ttl` on all persistent storage entries |

### ZK Circuits (Circom)

| ID | Status | Description |
|----|--------|-------------|
| ZK-1 | ✅ Fixed | `execution_proof.circom` now declares `{public [taskHash, resultHash]}` |
| ZK-3 | ✅ Fixed | `membership_proof.circom` root changed from output to public input with equality constraint |
| Phase II | 🔲 Planned | Bind `leaf` to `Poseidon(agentSecret)` for identity-theft resistance |
| Phase II | 🔲 Planned | Add `Num2Bits(64)` range check on `amount` in `deposit_commitment.circom` |
| Phase II | 🔲 Planned | Add recipient binding in withdrawal circuit to prevent front-running |

### API Routes (Next.js)

| ID | Status | Description |
|----|--------|-------------|
| API-1 | ✅ Fixed | Review endpoint now checks `reviewer_id === task.issuer_id` |
| API-2 | ✅ Fixed | Replay guard uses `reserve/confirm/release` — worker failures release txHash for retry |
| DM-4 | ✅ Fixed | Demo scenario header gated behind `NODE_ENV !== 'production'` |
| Phase II | 🔲 Planned | Wallet-based authentication (ED25519 signatures) across all mutating endpoints |
| Phase II | 🔲 Planned | Rate limiting on `/api/orb` and `/api/demo/*` endpoints |
| Phase II | 🔲 Planned | Content-Security-Policy and security headers in `next.config.ts` |

### Dependencies

| Finding | Status | Description |
|---------|--------|-------------|
| DEP-1 | ⚠️ Upstream | `elliptic` 6.6.1 has known CVEs — upstream unmaintained, migration to `@noble/curves` planned |
| DEP-2 | 🔲 Planned | `ws` override update to 8.21.1+ |

## Reporting Vulnerabilities

This is a hackathon project. For security concerns, open an issue on the repository or contact the team directly through the Stellar Community Fund submission page.

## Audit History

| Date | Scope | Method | Findings |
|------|-------|--------|----------|
| 2026-07-23 | Full codebase (64+ files) | 8× Gemini Flash 3.6 agents + Opus 4.6 verification | 106 total (4 CRITICAL, 46 HIGH, 33 MEDIUM, 23 LOW) |
