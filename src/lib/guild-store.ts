/**
 * Guild Store — Persistent JSON-file backed data store
 *
 * Architecture:
 * - In-memory cache for fast reads
 * - Debounced write-through to JSON files on disk
 * - Auto-creates guild-data/ directory and seed data on first run
 * - Thread-safe via single-process model (Next.js serverless)
 *
 * Files:
 *   guild-data/agents.json   — guild members
 *   guild-data/tasks.json    — bounties/quests
 *   guild-data/events.json   — audit log (append-only)
 *   guild-data/commendations.json — peer kudos
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Agent, Task, GuildEvent, Commendation, GuildStats } from "./types";

const DATA_DIR = path.join(process.cwd(), "guild-data");

// ═══════════ IN-MEMORY CACHE ═══════════

let agents: Agent[] = [];
let tasks: Task[] = [];
let events: GuildEvent[] = [];
let commendations: Commendation[] = [];
let initialized = false;

// ═══════════ DEBOUNCED PERSIST ═══════════

const dirty = new Set<string>();
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function markDirty(collection: string) {
	dirty.add(collection);
	if (!saveTimer) {
		saveTimer = setTimeout(flushAll, 100);
	}
}

async function flushAll() {
	saveTimer = null;
	const toFlush = [...dirty];
	dirty.clear();

	await fs.mkdir(DATA_DIR, { recursive: true });

	for (const col of toFlush) {
		const filePath = path.join(DATA_DIR, `${col}.json`);
		const data = col === "agents" ? agents
			: col === "tasks" ? tasks
			: col === "events" ? events
			: col === "commendations" ? commendations
			: null;
		if (data) {
			await fs.writeFile(filePath, JSON.stringify(data, null, 2));
		}
	}
}

// ═══════════ INITIALIZATION ═══════════

async function loadCollection<T>(name: string, defaults: T[]): Promise<T[]> {
	try {
		const filePath = path.join(DATA_DIR, `${name}.json`);
		const raw = await fs.readFile(filePath, "utf-8");
		return JSON.parse(raw);
	} catch {
		return defaults;
	}
}

const SEED_TASKS: Task[] = [
	{
		id: "Q-1049",
		title: "Delta Neutral Arbitrage Audit",
		description: "Full security audit of the delta-neutral arbitrage strategy. Review smart contract logic, edge cases, and MEV attack vectors. Provide a written report with severity classifications.",
		requirements: ["Written audit report (PDF or MD)", "Severity classifications per finding", "Proof-of-concept for critical issues"],
		acceptance_criteria: ["All critical paths reviewed", "No false positives", "Actionable remediation steps"],
		hints: ["Focus on reentrancy in the swap callback", "Check oracle manipulation vectors"],
		skills: ["Rust", "Soroban", "DeFi", "Security"],
		difficulty: "S",
		category: "audit",
		tags: ["defi", "security", "soroban"],
		reward_usdc: 5000,
		escrow_status: "funded",
		network_fee_pct: 5,
		status: "OPEN",
		created_at: new Date().toISOString(),
		deadline: null,
		claim_timeout_min: 120,
		max_claims: 2,
		max_revisions: 3,
		issuer_id: "triarchy-labs",
		claims: [],
		submissions: [],
		is_shielded: false,
		sos_active: false,
		sos_message: null,
		views: 0,
		applications: 0,
	},
	{
		id: "Q-1021",
		title: "WASM Payload Refactoring",
		description: "Refactor the WASM payload module to reduce binary size by 40%. Current payload is 2.1MB, target is 1.2MB. Must maintain all existing functionality and pass the test suite.",
		requirements: ["Refactored WASM module", "Size reduction proof (before/after)", "All tests passing"],
		acceptance_criteria: ["Binary ≤ 1.2MB", "Zero test regressions", "No new unsafe blocks"],
		hints: ["Try wasm-opt with -Oz", "Check for dead code in the crypto module"],
		skills: ["WebAssembly", "Rust", "Performance"],
		difficulty: "A",
		category: "code",
		tags: ["wasm", "performance", "optimization"],
		reward_usdc: 850,
		escrow_status: "funded",
		network_fee_pct: 5,
		status: "OPEN",
		created_at: new Date(Date.now() - 86400000).toISOString(),
		deadline: new Date(Date.now() + 604800000).toISOString(),
		claim_timeout_min: 60,
		max_claims: 1,
		max_revisions: 2,
		issuer_id: "anonymous",
		claims: [],
		submissions: [],
		is_shielded: false,
		sos_active: false,
		sos_message: null,
		views: 0,
		applications: 0,
	},
	{
		id: "Q-0992",
		title: "Frontend Telemetry Dashboard Component",
		description: "Build a real-time telemetry dashboard component that visualizes WASI node health, system load, and task throughput. Must use SSE for live updates.",
		requirements: ["React component", "SSE integration", "Responsive design"],
		acceptance_criteria: ["Live data updates", "Mobile-friendly", "< 50ms render time"],
		hints: ["Use the /api/telemetry endpoint", "Consider react-spring for animations"],
		skills: ["Next.js", "React", "TypeScript", "CSS"],
		difficulty: "B",
		category: "code",
		tags: ["frontend", "dashboard", "sse"],
		reward_usdc: 200,
		escrow_status: "funded",
		network_fee_pct: 5,
		status: "OPEN",
		created_at: new Date(Date.now() - 172800000).toISOString(),
		deadline: null,
		claim_timeout_min: 60,
		max_claims: 3,
		max_revisions: 3,
		issuer_id: "stellar-horizon",
		claims: [],
		submissions: [],
		is_shielded: false,
		sos_active: false,
		sos_message: null,
		views: 0,
		applications: 0,
	},
	{
		id: "Q-0988",
		title: "ZK Circuit Review: Membership Proof",
		description: "Review the membership_proof.circom circuit for correctness and security. Verify Poseidon hash constraints, Merkle tree inclusion proof, and nullifier generation. Flag any under-constrained signals.",
		requirements: ["Review document", "Constraint analysis", "Test vectors"],
		acceptance_criteria: ["All signals checked for constraints", "Poseidon hash verified against reference impl", "No under-constrained signals"],
		hints: ["Check if nullifier can be reused across different Merkle roots"],
		skills: ["Circom", "ZK-SNARKs", "Cryptography"],
		difficulty: "A",
		category: "review",
		tags: ["zk", "circom", "security"],
		reward_usdc: 1200,
		escrow_status: "funded",
		network_fee_pct: 5,
		status: "OPEN",
		created_at: new Date(Date.now() - 43200000).toISOString(),
		deadline: new Date(Date.now() + 1209600000).toISOString(),
		claim_timeout_min: 90,
		max_claims: 1,
		max_revisions: 2,
		issuer_id: "triarchy-labs",
		claims: [],
		submissions: [],
		is_shielded: true,
		sos_active: false,
		sos_message: null,
		views: 0,
		applications: 0,
	},
];

export async function initStore(): Promise<void> {
	if (initialized) return;

	await fs.mkdir(DATA_DIR, { recursive: true });

	agents = await loadCollection<Agent>("agents", []);
	tasks = await loadCollection<Task>("tasks", SEED_TASKS);
	events = await loadCollection<GuildEvent>("events", []);
	commendations = await loadCollection<Commendation>("commendations", []);

	// Persist seed data if fresh
	if (tasks.length > 0) {
		markDirty("tasks");
	}

	initialized = true;
}

// ═══════════ AGENT CRUD ═══════════

export function getAgents(filters?: {
	capability?: string;
	rank?: string;
	type?: string;
	status?: string;
}): Agent[] {
	let result = [...agents];
	if (filters?.capability) {
		result = result.filter(a => a.capabilities.some(c => c.toLowerCase().includes(filters.capability!.toLowerCase())));
	}
	if (filters?.rank) {
		result = result.filter(a => a.rank === filters.rank);
	}
	if (filters?.type) {
		result = result.filter(a => a.type === filters.type);
	}
	if (filters?.status) {
		result = result.filter(a => a.status === filters.status);
	}
	return result;
}

export function getAgent(id: string): Agent | undefined {
	return agents.find(a => a.id === id);
}

export function createAgent(data: Partial<Agent> & { name: string; type: Agent["type"]; capabilities: string[] }): Agent {
	const agent: Agent = {
		id: crypto.randomUUID(),
		name: data.name,
		type: data.type,
		public_key: data.public_key ?? null,
		membership_leaf: data.membership_leaf ?? "",
		capabilities: data.capabilities,
		bio: data.bio ?? "",
		rank: "INITIATE",
		xp: 0,
		signal: 0,
		impact: 0,
		tasks_completed: 0,
		tasks_failed: 0,
		tasks_abandoned: 0,
		total_earned_usdc: 0,
		avg_review_score: 0,
		streak: 0,
		best_streak: 0,
		specializations: [],
		commendations: 0,
		balance_usdc: 0,
		registered_at: new Date().toISOString(),
		last_active: new Date().toISOString(),
		status: "active",
		current_claims: [],
	};
	agents.push(agent);
	markDirty("agents");
	emitEvent("agent:registered", { agentId: agent.id, name: agent.name, type: agent.type });
	return agent;
}

export function updateAgent(id: string, updates: Partial<Agent>): Agent | null {
	const idx = agents.findIndex(a => a.id === id);
	if (idx === -1) return null;
	agents[idx] = { ...agents[idx], ...updates, last_active: new Date().toISOString() };
	markDirty("agents");
	return agents[idx];
}

// ═══════════ TASK CRUD ═══════════

export function getTasks(filters?: {
	status?: string;
	skill?: string;
	difficulty?: string;
	category?: string;
	issuer_id?: string;
	sos?: boolean;
}): Task[] {
	let result = [...tasks];
	if (filters?.status) {
		result = result.filter(t => t.status === filters.status);
	}
	if (filters?.skill) {
		result = result.filter(t => t.skills.some(s => s.toLowerCase().includes(filters.skill!.toLowerCase())));
	}
	if (filters?.difficulty) {
		result = result.filter(t => t.difficulty === filters.difficulty);
	}
	if (filters?.category) {
		result = result.filter(t => t.category === filters.category);
	}
	if (filters?.issuer_id) {
		result = result.filter(t => t.issuer_id === filters.issuer_id);
	}
	if (filters?.sos) {
		result = result.filter(t => t.sos_active);
	}
	return result;
}

export function getTask(id: string): Task | undefined {
	return tasks.find(t => t.id === id);
}

export function createTask(data: Partial<Task> & { title: string; description: string; issuer_id: string }): Task {
	const task: Task = {
		id: `Q-${Math.floor(Math.random() * 9000) + 1000}`,
		title: data.title,
		description: data.description,
		requirements: data.requirements ?? [],
		acceptance_criteria: data.acceptance_criteria ?? [],
		hints: data.hints ?? [],
		skills: data.skills ?? [],
		difficulty: data.difficulty ?? "C",
		category: data.category ?? "code",
		tags: data.tags ?? [],
		reward_usdc: data.reward_usdc ?? 0,
		escrow_status: data.reward_usdc ? "funded" : "unfunded",
		network_fee_pct: data.network_fee_pct ?? 5,
		status: "OPEN",
		created_at: new Date().toISOString(),
		deadline: data.deadline ?? null,
		claim_timeout_min: data.claim_timeout_min ?? 60,
		max_claims: data.max_claims ?? 1,
		max_revisions: data.max_revisions ?? 3,
		issuer_id: data.issuer_id,
		claims: [],
		submissions: [],
		is_shielded: data.is_shielded ?? false,
		sos_active: false,
		sos_message: null,
		views: 0,
		applications: 0,
	};
	tasks.unshift(task);
	markDirty("tasks");
	emitEvent("task:created", { taskId: task.id, title: task.title, reward: task.reward_usdc, difficulty: task.difficulty });
	return task;
}

export function updateTask(id: string, updates: Partial<Task>): Task | null {
	const idx = tasks.findIndex(t => t.id === id);
	if (idx === -1) return null;
	tasks[idx] = { ...tasks[idx], ...updates };
	markDirty("tasks");
	return tasks[idx];
}

export function deleteTask(id: string): boolean {
	const idx = tasks.findIndex(t => t.id === id);
	if (idx === -1) return false;
	tasks.splice(idx, 1);
	markDirty("tasks");
	return true;
}

// ═══════════ COMMENDATION ═══════════

export function addCommendation(fromId: string, toId: string, taskId: string, message: string): Commendation {
	const c: Commendation = {
		id: crypto.randomUUID(),
		from_id: fromId,
		to_id: toId,
		task_id: taskId,
		message,
		created_at: new Date().toISOString(),
	};
	commendations.push(c);
	markDirty("commendations");

	// Update target agent's commendation count
	const target = agents.find(a => a.id === toId);
	if (target) {
		target.commendations++;
		markDirty("agents");
	}

	emitEvent("agent:commended", { fromId, toId, taskId, message });
	return c;
}

export function getCommendations(agentId: string): Commendation[] {
	return commendations.filter(c => c.to_id === agentId);
}

// ═══════════ EVENTS (Audit Log) ═══════════

// SSE subscribers
type SSECallback = (event: GuildEvent) => void;
const sseSubscribers: Set<SSECallback> = new Set();

export function subscribeSSE(callback: SSECallback): () => void {
	sseSubscribers.add(callback);
	return () => sseSubscribers.delete(callback);
}

function emitEvent(type: string, data: Record<string, unknown>) {
	const event: GuildEvent = {
		id: crypto.randomUUID(),
		type,
		timestamp: new Date().toISOString(),
		data,
	};
	events.push(event);

	// Keep last 1000 events
	if (events.length > 1000) {
		events = events.slice(-1000);
	}
	markDirty("events");

	// Broadcast to SSE subscribers
	for (const cb of sseSubscribers) {
		try { cb(event); } catch { /* subscriber error */ }
	}
}

export function getEvents(since?: string, limit = 50): GuildEvent[] {
	let result = [...events];
	if (since) {
		result = result.filter(e => e.timestamp > since);
	}
	return result.slice(-limit);
}

// ═══════════ GUILD STATS ═══════════

export function getGuildStats(): GuildStats {
	const completedTasks = tasks.filter(t => t.status === "PAID");
	return {
		total_agents: agents.length,
		total_humans: agents.filter(a => a.type === "human").length,
		total_bots: agents.filter(a => a.type === "bot").length,
		total_tasks_created: tasks.length,
		total_tasks_completed: completedTasks.length,
		total_usdc_paid: completedTasks.reduce((sum, t) => sum + t.reward_usdc, 0),
		avg_review_score: agents.length > 0
			? agents.reduce((sum, a) => sum + a.avg_review_score, 0) / agents.filter(a => a.avg_review_score > 0).length || 0
			: 0,
		active_tasks: tasks.filter(t => ["OPEN", "CLAIMED", "IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW"].includes(t.status)).length,
	};
}

// ═══════════ FORCE FLUSH (for tests/shutdown) ═══════════

export async function forceFlush(): Promise<void> {
	if (saveTimer) {
		clearTimeout(saveTimer);
		saveTimer = null;
	}
	dirty.add("agents");
	dirty.add("tasks");
	dirty.add("events");
	dirty.add("commendations");
	await flushAll();
}
