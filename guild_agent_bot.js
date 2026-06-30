/* eslint-disable */
/**
 * External Agent Bot — Guild Membership Demo
 *
 * Demonstrates the full guild onboarding flow:
 * 1. Discovers available tools via MCP manifest
 * 2. Registers as a guild member
 * 3. Receives membershipLeaf for ZK proofs
 * 4. Listens for delegated tasks on port 3001
 * 5. Responds with execution results
 *
 * Usage: node dummy_external_bot.js
 * (Run alongside `npm run dev` on port 3000)
 */

const express = require('express');
const cors = require('cors');
const path = require('node:path');
const snarkjs = require('snarkjs');
const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number.parseInt(process.env.PORT || process.env.AGENT_PORT || '3001', 10);
const GATEWAY = (process.env.GATEWAY_URL || 'http://localhost:3000').replace(/\/$/, '');
const AGENT_NAME = process.env.AGENT_NAME || 'mercenary-bot-0x4b3';
const AGENT_CAPABILITIES = (process.env.AGENT_CAPABILITIES || 'code-audit,soroban-review,llm-execution,security-scan')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
const AGENT_PUBLIC_KEY = process.env.AGENT_PUBLIC_KEY || 'GDEMO000000000000000000000000000000000000000000000000BOT';
const BN254_FIELD = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
const MEMBERSHIP_WASM = path.join(__dirname, 'public', 'circuits', 'membership_proof.wasm');
const MEMBERSHIP_ZKEY = path.join(__dirname, 'public', 'circuits', 'membership_proof_final.zkey');

let membershipLeaf = null;
let membershipProofInputs = null;
let agentId = null;
const proofCache = new Map();

async function joinGuild() {
    console.log('\n--- GUILD ONBOARDING ---');

    // Step 1: Discover tools
    console.log('[1/3] Discovering guild tools...');
    try {
        const manifest = await fetch(`${GATEWAY}/api/mcp`);
        const data = await manifest.json();
        console.log(`      Guild: ${data.name} v${data.version}`);
        console.log(`      Tools: ${Object.keys(data.tools).join(', ')}`);
        console.log(`      Onboarding steps: ${data.onboarding.length}`);
    } catch (e) {
        console.log('      Gateway not reachable yet — will retry on first task.');
    }

    // Step 2: Register as guild member
    console.log('[2/3] Registering as guild member...');
    try {
        const res = await fetch(`${GATEWAY}/api/agents`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: AGENT_NAME,
                capabilities: AGENT_CAPABILITIES,
                publicKey: AGENT_PUBLIC_KEY
            })
        });
        const data = await res.json();
        agentId = data.agent?.id;
        membershipLeaf = data.guild?.membershipLeaf;
        membershipProofInputs = data.guild?.proofInputs;
        console.log(`      Agent ID: ${agentId}`);
        console.log(`      Membership Leaf: ${membershipLeaf?.substring(0, 16)}...`);
        console.log(`      Guild Members: ${data.guild?.totalMembers}`);
        console.log(`      Registry: ${data.guild?.guildRegistry}`);
    } catch (e) {
        console.log('      Registration failed — gateway offline. Will operate as public mercenary.');
    }

    // Step 3: Ready
    console.log('[3/3] Guild membership active.');
    console.log(`      Mode: ${membershipLeaf ? 'SHIELDED (ZK membership)' : 'PUBLIC (mercenary)'}`);
    console.log('--- ONBOARDING COMPLETE ---\n');
}

// Task execution endpoint
app.post('/api/hire', (req, res) => {
    const task = req.body.task || req.body.description || '';

    console.log('\n[GUILD AGENT] Received Task:');
    console.log(`  Task: "${task}"`);
    console.log(`  Mode: ${membershipLeaf ? 'Shielded Guild Member' : 'Public Mercenary'}`);
    console.log(`  Membership: ${membershipLeaf ? membershipLeaf.substring(0, 16) + '...' : 'none'}`);
    console.log('  Verifying Soroban payment... OK');
    console.log('  Executing...');

    setTimeout(() => {
        let result = '';
        if (task.toLowerCase().includes('vulnerabilities') || task.toLowerCase().includes('audit')) {
            result = 'Security scan complete: no re-entrancy, no integer overflow, no unauthorized access detected in Soroban contract.';
        } else if (task.toLowerCase().includes('review')) {
            result = 'Code review complete: 3 suggestions applied, gas optimization +12%, test coverage 94%.';
        } else {
            result = 'Task executed successfully. Ready for next assignment.';
        }

        res.json({
            agent_id: agentId || AGENT_NAME,
            status: 'success',
            result,
            membership: membershipLeaf ? 'guild_verified' : 'public',
            guild_registry: 'CDJKNLOK5U4N7IPLDDX2Y3FPMSS6ERREGU7VXCXDVANC7YUAB56ZD7ZB',
        });

        console.log('[GUILD AGENT] Response sent.\n');
    }, 1500);
});

// ZK membership proof endpoint used by the gateway before delegation.
app.post('/api/membership-proof', async (req, res) => {
    if (!membershipProofInputs || !membershipLeaf) {
        return res.status(409).json({
            error: 'Agent is not registered as a guild member yet.',
            agent_id: agentId,
        });
    }

    const profile = req.body?.proof_profile === 'unapproved-root' ? 'unapproved-root' : 'approved-root';
    try {
        const cacheKey = profile;
        if (!proofCache.has(cacheKey)) {
            const baseProofInput = {
                leaf: membershipProofInputs.leaf,
                pathElements: membershipProofInputs.pathElements,
                pathIndices: membershipProofInputs.pathIndices,
            };
            const proofInput = profile === 'unapproved-root'
                ? {
                    ...baseProofInput,
                    leaf: ((BigInt(baseProofInput.leaf) + 1n) % BN254_FIELD).toString(),
                }
                : baseProofInput;
            const { proof, publicSignals } = await snarkjs.groth16.fullProve(
                proofInput,
                MEMBERSHIP_WASM,
                MEMBERSHIP_ZKEY,
            );
            proofCache.set(cacheKey, { proof, publicSignals });
        }

        const cached = proofCache.get(cacheKey);
        res.json({
            agent_id: agentId || AGENT_NAME,
            circuit: 'membership_proof',
            profile,
            proof: cached.proof,
            publicSignals: cached.publicSignals,
        });
    } catch (error) {
        res.status(500).json({
            error: error instanceof Error ? error.message : String(error),
            agent_id: agentId,
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'alive',
        agent_id: agentId,
        name: AGENT_NAME,
        guild_member: !!membershipLeaf,
        capabilities: AGENT_CAPABILITIES,
    });
});

app.listen(PORT, async () => {
    console.log(`[GUILD AGENT] Listening on port ${PORT}`);
    await joinGuild();
    console.log(`[GUILD AGENT] Ready for tasks. Run: npm run demo`);
});
