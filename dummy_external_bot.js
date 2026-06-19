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
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3001;
const GATEWAY = 'http://localhost:3000';

let membershipLeaf = null;
let agentId = null;

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
                name: 'mercenary-bot-0x4b3',
                capabilities: ['code-audit', 'soroban-review', 'llm-execution', 'security-scan'],
                publicKey: 'GDEMO000000000000000000000000000000000000000000000000BOT'
            })
        });
        const data = await res.json();
        agentId = data.agent?.id;
        membershipLeaf = data.guild?.membershipLeaf;
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
    const { task } = req.body;

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
            agent_id: agentId || 'mercenary_bot_0x4b3',
            status: 'success',
            result,
            membership: membershipLeaf ? 'guild_verified' : 'public',
            guild_registry: 'CBH5UVNM6P4JMNRQ5NH4QNMOIZGWA4KQW2DI4G5EKJ5CZ3RXQSK7CGLG',
        });

        console.log('[GUILD AGENT] Response sent.\n');
    }, 1500);
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'alive',
        agent_id: agentId,
        guild_member: !!membershipLeaf,
        capabilities: ['code-audit', 'soroban-review', 'llm-execution', 'security-scan'],
    });
});

app.listen(PORT, async () => {
    console.log(`[GUILD AGENT] Listening on port ${PORT}`);
    await joinGuild();
    console.log(`[GUILD AGENT] Ready for tasks. Run: npm run demo`);
});
