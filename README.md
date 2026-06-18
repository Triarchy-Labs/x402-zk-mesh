<div align="center">
  <img src="https://raw.githubusercontent.com/Triarchy-Labs/x402-arbitrage-mesh/main/public/LDR_RGB1_0.png" alt="Triarchy Logo" width="120" />
  
  <h1>X402 ZK Mesh Gateway</h1>
  <p><strong>DoraHacks: Stellar Hacks Real-World ZK Submission</strong></p>
  <p><em>Autonomous Inter-Agent Payment Routing Protocol on Soroban & Extism / DoraHacks 2026</em></p>

</div>

---

## Introduction

The **X402 ZK Mesh** is a privacy-preserving extension to the Triarchy L402 Autonomous Gateway. It acts as an orchestrator and an execution node where AI Agents can accept and execute micro-bounties over a peer-to-peer network.

With this ZK upgrade, we implement the **Zero-Trust Autonomous Execution** paradigm:

1. **Anonymous Bounties**: Clients can post tasks and place USDC into an escrow without revealing their identities or transaction history.
2. **Execution Proofs (ZK Privacy Pool)**: Using Circom Groth16 zk-SNARKs and the `stellar-private-payments` contract architecture, execution nodes claim bounties and the Network Route proves validity anonymously.

## Stellar ZK Privacy Pool (Nethermind SPP)

We have integrated the reference implementation of Privacy Pools for Stellar (`stellar-private-payments`) to act as the anonymous escrow mechanism for our X402 Agents. 

The Soroban contracts for the Privacy Pool and ASP (Association Set Provider) trees are located in `/contracts/stellar-private-payments`.

- **Deposit**: A client submits USDC to the Privacy Pool and generates a UTXO commitment.
- **Proof & Execution**: An agent executes the AI task and produces a proof of work.
- **Withdraw (Delegation)**: The agent withdraws from the Pool by providing a ZK proof linking the deposit to the execution nullifier without revealing the original client.

*Note for Reviewers: While the UI provides a real-time Hollywood-style telemetry dashboard that simulates the full autonomous Swarm lifecycle, the Soroban contracts we use locally leverage the Nethermind Eth WIP implementation. The Dashboard UI uses mocked data to visualize the proof generation to fit the Hackathon demo format.*

## Running Locally

1. `npm install`
2. `npm run build`
3. `npm run dev`

Visit `http://localhost:3000/dashboard` to access the X402 ZK Mesh Swarm Terminal. Toggle the "Shielded Task (ZK)" switch to invoke the Zero-Knowledge Privacy Pool logic.
