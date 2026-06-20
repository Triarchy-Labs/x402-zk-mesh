/**
 * X402 ZK Mesh — Guild Platform Type Definitions
 *
 * Data model synthesized from:
 * - Bounty platforms: HackerOne (Signal+Impact), Immunefi (severity tiers), Layer3 (XP/CUBEs)
 * - MMO guilds: BDO (contracts), EVE (corp projects), Monster Hunter (SOS), FFXIV (mentors)
 * - Agent networks: Moltbook (karma), Google A2A (Agent Cards), MCP
 */

// ═══════════ RANK ═══════════

export type Rank = "INITIATE" | "APPRENTICE" | "JOURNEYMAN" | "ADEPT" | "MASTER" | "GRANDMASTER";

export const RANK_CONFIG: Record<Rank, { xpRequired: number; taskAccess: Difficulty[]; order: number }> = {
	INITIATE:     { xpRequired: 0,     taskAccess: ["D"],                     order: 0 },
	APPRENTICE:   { xpRequired: 100,   taskAccess: ["D", "C"],                order: 1 },
	JOURNEYMAN:   { xpRequired: 500,   taskAccess: ["D", "C", "B"],           order: 2 },
	ADEPT:        { xpRequired: 2000,  taskAccess: ["D", "C", "B", "A"],      order: 3 },
	MASTER:       { xpRequired: 10000, taskAccess: ["D", "C", "B", "A", "S"], order: 4 },
	GRANDMASTER:  { xpRequired: 50000, taskAccess: ["D", "C", "B", "A", "S"], order: 5 },
};

export const DIFFICULTY_XP: Record<Difficulty, number> = {
	D: 10, C: 25, B: 50, A: 100, S: 250,
};

// ═══════════ AGENT ═══════════

export type AgentType = "bot" | "human";
export type AgentStatus = "active" | "idle" | "busy" | "offline" | "vacation";

export interface Agent {
	id: string;
	name: string;
	type: AgentType;

	// Identity
	public_key: string | null;
	membership_leaf: string;
	capabilities: string[];
	bio: string;

	// Reputation (HackerOne dual-axis)
	rank: Rank;
	xp: number;
	signal: number;       // reliability: avg reputation per submission
	impact: number;       // quality: avg score per approved task

	// Stats
	tasks_completed: number;
	tasks_failed: number;
	tasks_abandoned: number;
	total_earned_usdc: number;
	avg_review_score: number;
	streak: number;
	best_streak: number;
	specializations: string[];

	// FFXIV Commendation
	commendations: number;

	// Balance
	balance_usdc: number;

	// Activity
	registered_at: string;
	last_active: string;
	status: AgentStatus;
	current_claims: string[];
}

// ═══════════ TASK ═══════════

export type Difficulty = "S" | "A" | "B" | "C" | "D";
export type TaskCategory = "code" | "audit" | "research" | "design" | "review" | "ops";

export type TaskStatus =
	| "OPEN"
	| "CLAIMED"
	| "IN_PROGRESS"
	| "SUBMITTED"
	| "UNDER_REVIEW"
	| "REVISION"
	| "APPROVED"
	| "PAID"
	| "REJECTED"
	| "EXPIRED"
	| "DISPUTED"
	| "CANCELLED";

export interface Task {
	id: string;
	title: string;
	description: string;

	// Requirements
	requirements: string[];
	acceptance_criteria: string[];
	hints: string[];

	// Classification
	skills: string[];
	difficulty: Difficulty;
	category: TaskCategory;
	tags: string[];

	// Economics
	reward_usdc: number;
	escrow_status: "unfunded" | "funded" | "released" | "refunded";
	network_fee_pct: number;

	// Lifecycle
	status: TaskStatus;
	created_at: string;
	deadline: string | null;
	claim_timeout_min: number;
	max_claims: number;
	max_revisions: number;

	// People
	issuer_id: string;
	claims: Claim[];
	submissions: Submission[];

	// ZK
	is_shielded: boolean;

	// Monster Hunter SOS
	sos_active: boolean;
	sos_message: string | null;

	// Meta
	views: number;
	applications: number;
}

// ═══════════ CLAIM (BDO Contract) ═══════════

export interface Claim {
	agent_id: string;
	claimed_at: string;
	started_at: string | null;
	progress_pct: number;
	last_heartbeat: string;
	status: "active" | "abandoned" | "completed" | "timeout";
}

// ═══════════ SUBMISSION ═══════════

export interface Submission {
	id: string;
	task_id: string;
	agent_id: string;
	submitted_at: string;

	result: string;
	artifacts: string[];
	proof_hash: string | null;

	status: "PENDING" | "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
	review: Review | null;
	revision_count: number;
}

// ═══════════ REVIEW ═══════════

export interface Review {
	reviewer_id: string;
	verdict: "APPROVED" | "REJECTED" | "REVISION_REQUESTED";
	scores: {
		quality: number;
		communication: number;
		speed: number;
	};
	feedback: string;
	reviewed_at: string;
}

// ═══════════ GUILD EVENT (SSE) ═══════════

export interface GuildEvent {
	id: string;
	type: string;
	timestamp: string;
	data: Record<string, unknown>;
}

// ═══════════ COMMENDATION ═══════════

export interface Commendation {
	id: string;
	from_id: string;
	to_id: string;
	task_id: string;
	message: string;
	created_at: string;
}

// ═══════════ GUILD STATS ═══════════

export interface GuildStats {
	total_agents: number;
	total_humans: number;
	total_bots: number;
	total_tasks_created: number;
	total_tasks_completed: number;
	total_usdc_paid: number;
	avg_review_score: number;
	active_tasks: number;
}
