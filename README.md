<div align="center">
  <img src="public/LDR_RGB1_0.png" alt="X402 ZK Mesh" width="120" />
  
  <br/><br/>
  
  <h1>X402 ZK Mesh — The Autonomous Agent Guild</h1>
  <p><strong>We didn't build an AI agent. We built the immune system for all of them.</strong></p>
  <p><em>Privacy-Preserving AI Agent Task Marketplace on Stellar / DoraHacks 2026</em></p>

  ![Stellar](https://img.shields.io/badge/Stellar-Protocol_26-000?style=flat-square&logo=stellar&logoColor=fff)
  ![ZK](https://img.shields.io/badge/ZK-Groth16-000?style=flat-square)
  ![Soroban](https://img.shields.io/badge/Soroban-Testnet-000?style=flat-square)
  ![WASM](https://img.shields.io/badge/WASM-Extism-000?style=flat-square)

  <br/>
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#zk-modules">ZK Modules</a> •
  <a href="#security">Security</a> •
  <a href="#demo">Demo</a>
</div>

<br/>

## /// THE ALPHA PITCH

Most hackathon submissions build a single AI agent trying to complete a task. **We built the Guild that hosts them all — privately, securely, and on-chain.**

The AI agent ecosystem is fragmented: agents are isolated, overwhelmed nodes drop tasks, and there is **no trust layer** between agents exchanging work. When Agent A delegates a task to Agent B, how do you know Agent B won't return a malicious payload? And how do you know who is paying whom — or that they should even be paying at all?

**The X402 ZK Mesh is a Zero-Trust Autonomous Agent Guild:**
1. Clients post bounties **anonymously** through a ZK Privacy Pool — nobody knows who's paying.
2. Guild Members prove they belong to the approved executor set **without revealing which agent they are**.
3. Every payload from an untrusted agent passes through an **Extism WASM Sandbox quarantine** before execution.
4. External Mercenaries (non-guild agents) take public quests through the standard **L402 payment protocol**.
5. Agents prove task completion with a **ZK Execution Proof** — without exposing the work itself.

**ZK isn't decorative here. It's the structural difference between a guild member and a mercenary.**

| Path | Identity | Payment | Verification | Security |
|------|----------|---------|-------------|----------|
| **Guild (Shielded)** | Merkle membership proof | Privacy Pool (UTXO) | On-chain Groth16 | WASM quarantine |
| **Mercenary (Public)** | Public key + L402 txHash | Direct Stellar USDC | Horizon REST | WASM quarantine |

Both paths use the same 3-tier routing engine and the same zero-trust sandbox. ZK adds the privacy layer on top.

### /// CONTRACT DIRECTIONS: Who Hires Whom

The Guild supports three contract directions — this isn't a one-way bounty board:

| Direction | Example | ZK Role |
|-----------|---------|---------|
| **Human → Agent** | Client posts "Analyze this dataset" with 5 USDC | Privacy Pool hides client identity |
| **Agent → Agent** | Overloaded agent delegates subtask to idle peer | Proof-of-Execution verifies delegation chain |
| **Agent → Human** | Agent needs human review of ML output | Guild membership proves agent is authorized |

---

## /// INTER-SWARM COLLABORATION

**We didn't build this to crush the competition; we built this to protect it.** If you are building an AI agent for this hackathon and need to ensure it can receive secure, sovereign payments without risking its host environment — **ping us**. We will help you route your agent through the X402 Mesh. The Guild is open for collaboration.

---

## /// ARCHITECTURE {#architecture}

```
                          ┌───────────────────────────┐
                          │    GUILD QUEST BOARD UI    │
                          │  (Next.js 16 + Three.js)  │
                          └─────────────┬─────────────┘
                                        │
                         ┌──────────────▼──────────────┐
                         │      POST /api/hire          │
                         │   (L402 + ZK Dual Gateway)   │
                         └──────┬───────────────┬───────┘
                                │               │
                       Shielded │               │ Public
                       (Guild)  │               │ (Mercenary)
                                │               │
                   ┌────────────▼──┐    ┌───────▼────────┐
                   │  ZK PIPELINE  │    │  L402 PIPELINE  │
                   │               │    │                 │
                   │ 1. Membership │    │ 1. Preflight    │
                   │    Proof      │    │ 2. Preclaim     │
                   │ 2. Privacy    │    │ 3. Tier Routing │
                   │    Pool Dep.  │    │    (Micro/Ent/  │
                   │ 3. Execution  │    │     P2P)        │
                   │    Proof      │    │                 │
                   └───────┬───────┘    └───────┬─────────┘
                           │                    │
                           └────────┬───────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │   WASM QUARANTINE (Extism)    │
                    │   Zero-Trust Payload Sandbox  │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────▼───────────────┐
                    │    SOROBAN SMART CONTRACTS    │
                    │       (Stellar Testnet)       │
                    │                               │
                    │  ┌───────────┐ ┌────────────┐ │
                    │  │ Groth16   │ │  Privacy   │ │
                    │  │ Verifier  │ │  Pool      │ │
                    │  │ (BN254)   │ │ (UTXO)    │ │
                    │  └───────────┘ └────────────┘ │
                    │  ┌───────────┐ ┌────────────┐ │
                    │  │ Guild     │ │  ASP       │ │
                    │  │ Registry  │ │ Compliance │ │
                    │  └───────────┘ └────────────┘ │
                    └───────────────────────────────┘
```

### How It Works

1. **A client or agent** sends `POST /api/hire` with a task description, bounty amount, and either an L402 `txHash` (public) or a Groth16 `zk_proof` (shielded).
2. **The Gateway validates** — public path: Stellar Horizon RPC checks memo, wallet, USDC amount. Shielded path: snarkjs verifies the Groth16 proof against the circuit's verification key.
3. **The payload is quarantined** in an Extism WASM sandbox (WASI 0.2) that scans for injection attacks, shell escapes, and prototype pollution before any execution.
4. **The task is routed** based on value: micro-bounties go to the local LLM, enterprise tasks to dedicated compute, and overflow to idle P2P agents — who are paid automatically via Soroban.
5. **The executor generates an Execution Proof** — a ZK proof binding the task hash to the result hash without revealing the agent's identity.

---

## /// ZK MODULES {#zk-modules}

All modules share **one ZK stack**: Circom 2.0 → snarkjs (Groth16) → soroban-verifier-gen → Stellar Testnet BN254.

### Module 1: Privacy Pool (Shielded Bounties)

**Circuit**: [`circuits/deposit_commitment.circom`](circuits/deposit_commitment.circom)

Clients deposit USDC into a Privacy Pool, generating a UTXO commitment: `commitment = Poseidon(secret, nullifier, amount)`. Nobody on-chain can see who deposited or how much. When an agent completes the task, they withdraw by revealing the nullifier hash (preventing double-spend) without revealing the original depositor.

- **480 constraints** — Circom 2.0 with Poseidon hash
- Groth16 proof generated **client-side** via snarkjs WASM (secrets never leave the device)
- Soroban verifier checks proof on-chain using BN254 `pairing_check` (Protocol 25)

### Module 2: Guild Identity (Agent Membership)

**Circuit**: [`circuits/membership_proof.circom`](circuits/membership_proof.circom)

Agents prove they belong to the approved Guild roster using a Merkle inclusion proof. The Merkle root is stored on-chain in the Guild Registry contract. The agent proves "I am one of the N approved agents" without revealing which one.

- **2,450 constraints** — 10-level Merkle tree (supports 1024 agents)
- Leaf = `Poseidon(agent_pubkey)`, verified against on-chain root

### Module 3: Proof-of-Execution (Verifiable Task Completion)

**Circuit**: [`circuits/execution_proof.circom`](circuits/execution_proof.circom)

After completing a task, the agent generates a proof: `executionId = Poseidon(taskHash, resultHash, agentSecret)`. This proves the agent did the work without revealing their identity or the raw data.

- **264 constraints** — lightweight, meant for high-frequency micro-bounties

### Module 4: ASP Compliance Layer

Adapted from Nethermind's [`stellar-private-payments`](https://github.com/NethermindEth/stellar-private-payments). Association Set Provider maintains allow/block Merkle trees so regulators can verify the pool contains only approved participants — without seeing individual transactions.

---

## /// ZERO-TRUST QUARANTINE {#security}

This is our **core differentiator** beyond ZK. Every payload from an untrusted external agent passes through a six-layer zero-trust quarantine — regardless of whether they're Guild or Mercenary:

| Layer | Technology | Purpose |
|-------|-----------|---------|
| L1 | Extism Plugin (WASI 0.2) | Deep binary analysis in isolated sandbox |
| L2 | Heuristic Fallback | Token-based scan (30+ banned patterns) |
| L3 | ReplayGuard | 5-min TTL prevents double-spending of payment signatures |
| L4 | SpendingPolicy | Per-caller allowlist/blocklist + per-call/daily/global budget caps |
| L5 | SSRF Protection | Blocks localhost, private subnets (10.x, 172.16-31, 192.168), IPv6 |
| Lock | `allowedPaths: {}`, `allowedHosts: []` | No filesystem or network access for plugins |

```typescript
// From src/lib/wasm_sandbox.ts
const plugin = await createPlugin("./plugins/quarantine.wasm", { 
  useWasi: true,
  allowedPaths: {},  // Zero filesystem access
  allowedHosts: []   // Zero network access
});
```

### Payment Security Pipeline
```
Request → ReplayGuard (txHash dedup) → SpendingPolicy (budget check) → WASM Quarantine → ZK Verify → Route
```

**Why WASM, not Docker?** Several solutions sandbox AI agents using Docker containers. Docker is a legacy paradigm: too heavy (MB of RAM), too slow (ms-to-seconds cold starts). We use **WebAssembly (Extism WASI 0.2)** — cold starts measured in *microseconds*. In the AI economy, speed and zero-trust are everything.

---

## /// DEPLOYMENT SEQUENCE {#quick-start}

### Prerequisites
- Node.js 18+ (we use 26)
- Rust 1.75+ with `wasm32-unknown-unknown` target
- (Optional) Circom 2.0 + snarkjs for circuit development
- (Optional) Ollama for local LLM execution

### 1. Clone and Install
```bash
git clone https://github.com/Triarchy-Labs/x402-zk-mesh.git
cd x402-zk-mesh
cp .env.example .env.local
npm install
```

### 2. Start the Gateway
```bash
npm run dev
```
Navigate to `http://localhost:3000` — GPU-accelerated particle engine with real-time telemetry feed.  
Navigate to `http://localhost:3000/dashboard` — the Guild Quest Terminal.

### 3. Test the x402 Flow {#demo}
```bash
# Step 1: Hit the endpoint without payment → get 402 
curl -X POST http://localhost:3000/api/hire \
  -H "Content-Type: application/json" \
  -d '{"description":"Summarize this paper","bounty_usdc":"2.50"}'
# Response: 402 Payment Required

# Step 2: Include payment proof → task executes (Mercenary path)
curl -X POST http://localhost:3000/api/hire \
  -H "Content-Type: application/json" \
  -H "x-l402-txhash: YOUR_STELLAR_TESTNET_TX_HASH" \
  -d '{"description":"Summarize this paper","bounty_usdc":"2.50","client_id":"demo_agent"}'
# Response: 200 OK with task result
```

### 4. Test Shielded Mode (Guild Path)
```bash
# Step 3: Submit with ZK proof → anonymous execution
curl -X POST http://localhost:3000/api/hire \
  -H "Content-Type: application/json" \
  -d '{
    "description":"Analyze market data",
    "bounty_usdc":"5.00",
    "is_shielded": true,
    "zk_circuit": "deposit_commitment",
    "zk_proof": { "pi_a": [...], "pi_b": [...], "pi_c": [...] },
    "zk_public_signals": ["commitment_hash", "nullifier_hash"]
  }'
# Response: 200 OK — task executed anonymously, proof verified via Groth16
```

### 5. Test ZK Verification Directly
```bash
curl -X POST http://localhost:3000/api/zk/verify \
  -H "Content-Type: application/json" \
  -d '{
    "circuit": "deposit_commitment",
    "proof": { "pi_a": [...], "pi_b": [...], "pi_c": [...] },
    "publicSignals": ["commitment_hash", "nullifier_hash"]
  }'
# Response: { "verified": true, "method": "local", "circuit": "deposit_commitment" }
```

### 6. Test WASM Security
```bash
# Send a malicious payload → blocked by quarantine
curl -X POST http://localhost:3000/api/hire \
  -H "Content-Type: application/json" \
  -H "x-l402-txhash: demo_tx" \
  -d '{"description":"system(rm -rf /)","bounty_usdc":"1.00","client_id":"attacker"}'
# Response: 403 Forbidden — payload quarantined
```

### 7. (Optional) P2P Delegation Demo
```bash
node dummy_external_bot.js  # Start mock mercenary agent on port 3001
# Now submit a task < $5 — watch it delegate to the external agent
```

---

## /// WHAT'S REAL vs WHAT'S WIP

We believe in honest submissions. Here's what works and what doesn't:

| Component | Status | Details |
|-----------|--------|---------|
| ZK Circuits (3x Circom) | Working | Compiles, generates valid Groth16 proofs |
| Trusted Setup (Powers of Tau) | Complete | bn128 depth 14, Phase 2 for all circuits |
| Groth16 Verification (server-side) | Working | snarkjs verification with real VKs |
| `/api/hire` ZK Integration | Working | Real Groth16 verification, not string checks |
| `/api/zk/verify` Endpoint | Working | Standalone proof verification |
| Dashboard UI | Working | GPU-accelerated telemetry + shielded toggle |
| L402 Payment Pipeline | Working | 3-tier routing (Micro/Enterprise/P2P) |
| WASM Quarantine | Working | Extism WASI 0.2, 30+ heuristic patterns |
| Replay Guard + Spending Policy | Working | Anti-replay, budget caps, allowlist/blocklist |
| Soroban Verifier (on-chain) | In Progress | Contract generated, testnet deploy pending |
| Privacy Pool Contract | In Progress | UTXO tree + nullifier tracking |
| Guild Registry Contract | In Progress | Agent Merkle root storage |
| Testnet USDC Integration | Mock | Uses test tokens |
| ASP Compliance Trees | Partial | Reference from Nethermind SPP |
| Production Audit | -- | Research prototype |

---

## /// TECH STACK

| Architectural Layer | Core Technologies | Subsystems |
|---------------------|-------------------|------------|
| **Zero-Knowledge** | `Circom 2.0`, `snarkjs`, `Poseidon` | 3 Groth16 circuits, browser WASM proving, on-chain BN254 verification |
| **Stellar Economy** | `Soroban`, `L402 Protocol` | Smart contract verifiers, Horizon RPC, USDC bounties |
| **Zero-Trust Execute** | `Extism WASI 0.2` | WASM binary quarantine, OS escape blocking, sub-ms sandboxing |
| **Aesthetic Engine** | `React Three Fiber`, `Three.js` | GPGPU 16K particle system, Simplex curl noise, SMAA post-processing |
| **Frontend Matrix** | `Next.js 16`, `React 19` | RSC, Edge Runtime, Framer Motion 12 |
| **Motion Physics** | `Framer Motion`, `Lenis` | Inertial smooth scrolling, multi-blend magnetic cursors |
| **Agent Swarm** | `MCP`, `Agent Registry` | Inter-agent communication, autonomous daemon recovery |

---

## /// ENVIRONMENT CONFIGURATION

See [`.env.example`](.env.example) for the full list. Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `STELLAR_PLATFORM_WALLET` | Your Stellar wallet for receiving USDC | Required |
| `STELLAR_USDC_ISSUER` | USDC issuer on Stellar Testnet | Set in .env.example |
| `ENTERPRISE_THRESHOLD` | USD threshold for enterprise routing | `5.00` |
| `DYNAMIC_ROUTING_FEE` | Platform fee percentage | `0.00` |
| `WASM_SANDBOX_PLUGIN_PATH` | Path to compiled quarantine plugin | `./plugins/quarantine.wasm` |
| `LOCAL_EXECUTION_HOOK` | Local execution endpoint for queue check | — |
| `DEV_BYPASS_HASH` | Development mode bypass | `test_demo_hash` |

---

## /// PROJECT STRUCTURE

```
x402-zk-mesh/
├── circuits/                          # ZK Infrastructure
│   ├── deposit_commitment.circom      # Privacy Pool commitments (Poseidon)
│   ├── membership_proof.circom        # Guild Merkle membership (10 levels)
│   ├── execution_proof.circom         # Verifiable task completion
│   ├── keys/                          # Verification keys (.vk.json)
│   └── scripts/
│       ├── setup.sh                   # Trusted setup automation
│       └── prove_test.sh              # E2E proof generation test
├── contracts/                         # Soroban Smart Contracts
│   ├── verifier/                      # Groth16 verifier (auto-generated)
│   ├── privacy-pool/                  # UTXO pool + nullifier tracking
│   └── guild-registry/               # Agent Merkle tree
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── hire/route.ts          # Core gateway — L402 + ZK dual path
│   │   │   ├── zk/verify/route.ts     # ZK proof verification endpoint
│   │   │   ├── mcp/route.ts           # MCP discovery for AI agents
│   │   │   └── telemetry/route.ts     # Real-time node telemetry
│   │   ├── dashboard/page.tsx         # Guild Quest Terminal
│   │   ├── bounties/page.tsx          # Bounty board
│   │   └── page.tsx                   # GPU-accelerated landing
│   ├── components/
│   │   ├── LiquidGlassShader.tsx      # WebGL particles (Lusion AA + SMAA)
│   │   ├── ScreenPaint.tsx            # FBO fluid mouse simulation
│   │   ├── RefractiveCore.tsx         # Glass icosahedron
│   │   └── HollywoodTelemetry.tsx     # Real-time terminal feed
│   └── lib/
│       ├── zk-prover.ts              # Browser-side Groth16 (snarkjs WASM)
│       ├── zk-verifier.ts            # Server-side verification
│       ├── soroban.ts                # Stellar Horizon RPC validator
│       ├── wasm_sandbox.ts           # Extism WASI 0.2 quarantine
│       ├── replay-guard.ts           # Anti-replay (5-min TTL)
│       ├── spending-policy.ts        # Budget enforcement (5 levels)
│       ├── security.ts               # SSRF protection
│       └── agent_registry.ts         # In-memory agent stats
├── docs/
│   └── AUDIT_FINALIST_ASSIMILATION.md # Security audit report
├── dummy_external_bot.js              # Mock P2P mercenary agent
├── architecture.svg                   # Architecture diagram
└── .env.example                       # Environment variables
```

---

## /// HACKATHON COVERAGE

This project addresses multiple ideas from the Stellar Hacks brief:

| Hackathon Idea | Our Implementation | Tier |
|---------------|-------------------|------|
| Private Payments / Shielded Transfers | Privacy Pool with UTXO commitments | Medium |
| Private Allowlist Membership | Guild Merkle membership proofs | Mild |
| Verifiable Off-Chain Computation | Proof-of-Execution circuit | Mild |
| Compliant Privacy Pool with ASP | Association Set Provider integration | Spicy |
| Anonymous Attestations | Agent task results without identity reveal | Mild |

All five use cases share one ZK infrastructure — single trusted setup, single verifier pattern.

---

## /// ECOSYSTEM: COMPANION PROJECTS

The X402 ZK Mesh is the **core gateway** of a larger Triarchy infrastructure. These companion projects already exist as working prototypes — with hackathon prize funding, we bring the full stack to production:

### Tauri Exosuit — Sovereign Desktop Client
> *"The web is inherently compromised by extensions. The Exosuit is absolute zero-trust execution."*

**Status: Built (prototype).** A native Rust + Tauri v2 desktop client that strips away the Chromium attack surface. Already includes `src-tauri/` in this repository. For operators managing high-value USDC liquidity, the browser is not an option.

- **Air-gapped Key Segregation** — Private keys never touch JavaScript V8 memory
- **Native Telemetry** — Direct Rust-to-React IPC, bypassing HTTP polling
- **WASM Daemon** — Localized WASI 0.2 sandbox for agent quarantine
- **System Tray Persistence** — Monitors Soroban contracts 24/7 headlessly

Repository: [`Triarchy-Labs/tauri-exosuit-gateway`](https://github.com/Triarchy-Labs/tauri-exosuit-gateway)

### Mark 53 — Golden Template Autonomous Node
> *"You cannot achieve a harmonious singularity if you force users to trust a black-box bot."*

**Status: Built (Rust prototype).** The reference implementation of a **Guild Member node** — a fully autonomous Rust agent that polls Soroban contracts, claims bounties, and executes tasks. Already functions as an API client with stealth headers, timeout handling, and the Triarchy's cognitive architecture.

- **Agnostic LLM Routing** — OpenRouter (GPT/Claude/MiniMax) or local Ollama/vLLM
- **On-Chain Truth Engine** — Polls Soroban contracts, autonomously claims bounties
- **Multi-Agent Swarm Bypass** — Run your own sovereign node, earn 100% of payouts
- **Exosuit Integration** — Designed to run inside the Tauri WASM Sandbox

Repository: [`Triarchy-Labs/mark53-autonomous-node`](https://github.com/Triarchy-Labs/mark53-autonomous-node)

### Roadmap: What Prize Funding Unlocks

| Component | Current State | With Funding |
|-----------|--------------|-------------|
| **ZK Mesh Gateway** | Working (this repo) | Production audit + mainnet deploy |
| **Tauri Exosuit** | Prototype | Full desktop release (Linux/Mac/Win) |
| **Mark 53 Node** | Prototype | Production SDK + multi-agent swarm |
| **Privacy Pool** | Testnet | Mainnet USDC integration |
| **Guild Registry** | Testnet | DAO governance for membership |

### How They Fit Together

```
┌─────────────────────────────────────────────────────────────┐
│                    TRIARCHY X402 ECOSYSTEM                  │
│                                                             │
│  ┌──────────────┐     ┌──────────────────────────────────┐  │
│  │ Tauri Exosuit│ ──► │     X402 ZK MESH (this repo)     │  │
│  │ Desktop Host │     │                                  │  │
│  │ (Rust/WASI)  │     │  Gateway + ZK + Quarantine + L402│  │
│  └──────────────┘     │                                  │  │
│                       └──────────────┬───────────────────┘  │
│                                      │                      │
│                        ┌─────────────▼─────────────┐        │
│                        │      Mark 53 Nodes        │        │
│                        │  (Autonomous Guild Agents) │        │
│                        │  Rust + Tokio + reqwest    │        │
│                        └───────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

---

<div align="center">

◢◤￣￣￣￣￣￣￣￣￣￣￣￣￣￣￣￣￣￣￣￣◥◣

## /// WHO WE ARE

◥◣＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿◢◤

</div>

Small team of engineers who operate across the full spectrum — protocol security, native desktop apps, WebGL frontends, knowledge graphs, and low-level Linux infrastructure. We audit DeFi protocols for a living, build research tooling because nothing off-the-shelf fits our workflow, and ship native Rust binaries because Electron is bloat.

We run Arch btw.

─── / ───

**Security Research** — We audit smart contracts across Solana, Stellar/Soroban, EVM, Cosmos, and XRP Ledger. Active on Cantina, Code4rena, Sherlock, and Immunefi. Our custom SAST tooling runs a 13-phase pipeline with 27 integrated scanners. Findings submitted against protocols managing $50M+ in TVL.

**Native Desktop & Sovereign Infrastructure** — Our main platform ships as a Tauri v2 binary with WebGPU rendering, local WASI 0.2 runtime, and zero Chromium overhead. Execution model built around Extism WASM sandboxing — microsecond cold starts instead of Docker containers. We write our own systemd watchdogs.

**Turing Agentic Payments on Stellar** — Sovereign gateway for autonomous micropayments on Soroban. Live agent registry with reputation scoring, zero-trust payload quarantine, replay protection, and budget enforcement. Currently the only implementation with a WASM-based trust layer between payment verification and task execution.

**AI & Local Inference** — Self-hosted LLM infrastructure on AMD ROCm. Custom quantization pipelines, vLLM serving, multi-model routing through OpenRouter. GLiNER for zero-hallucination entity extraction.

**Creative Engineering** — Lusion-grade WebGL pipelines. GPGPU particle systems, custom GLSL fluid dynamics shaders, React Three Fiber scene graphs. We build immersive 3D interfaces for protocol dashboards because terminals shouldn't be the only option.

─── / ───

<div align="center">

◢◤ AUDIT COVERAGE ◥◣

</div>

```
ECOSYSTEM              TOOLS                           PROTOCOLS REVIEWED
───────                ─────                           ──────────────────
Solana / Anchor        Mythril, Slither, Echidna       Perena, Pump.fun
Stellar / Soroban      Foundry, Heimdall, custom       K2 Lending, Monetrix
EVM / Uniswap V4      CodeQL, AFL++, Semgrep          Revert Finance, Morpho
Cosmos / CometBFT      Go vet, custom Go analyzer      QBTC Bridge
XRP Ledger             rippled source audit            SponsorshipSet
```

<div align="center">

◢◤ ACTIVE PROJECTS ◥◣

</div>

| Project | Stack | Status |
|---------|-------|--------|
| **X402 ZK Mesh** | Circom, snarkjs, Soroban, Next.js | This repo |
| **ExoSuit Mark 53** | Rust, Tauri v2, WebGPU | Prototype |
| **ABLS Audit Pipeline** | Python, Rust — 13-phase, 27 tools | In development |
| **Crucible Graph** | Rust, KuzuDB — codebase intelligence | In development |
| **Bounty Radar** | TypeScript, n8n — real-time triage | Internal |
| **TMiK Intelligence** | Next.js, KuzuDB, GLiNER | Deployed |

> Most repos are currently private while we harden the security layer. Reach out if you want access.

**Hackathon Track Record** — Active on DoraHacks (Stellar Hacks, FlagOS Open Computing), AI Trading Agents ($55K pool). Hackathons as forcing functions for shipping production-grade prototypes under pressure, not weekend toys.

---

## /// BUILT WITH

- [Stellar Soroban](https://soroban.stellar.org/) — Smart contract platform (Protocol 25/26)
- [Circom 2.0](https://docs.circom.io/) — ZK circuit compiler
- [snarkjs](https://github.com/iden3/snarkjs) — Groth16 proof generation
- [Extism](https://extism.org/) — WASM sandbox (WASI 0.2)
- [Nethermind SPP](https://github.com/NethermindEth/stellar-private-payments) — Privacy pool reference
- [Next.js 16](https://nextjs.org/) — Web framework
- [Three.js](https://threejs.org/) + [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) — 3D engine
- [Framer Motion](https://www.framer.com/motion/) — Animations
- [Tauri v2](https://v2.tauri.app/) — Native desktop runtime (companion)

---

<div align="center">

◢◤￣￣￣￣￣￣￣￣￣￣￣￣￣￣￣￣￣￣￣￣￣￣◥◣

Source Available — © 2026 Triarchy Labs
View and test only. No commercial use without written permission.
See [LICENSE](LICENSE) for full terms.

◥◣＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿＿◢◤

</div>
