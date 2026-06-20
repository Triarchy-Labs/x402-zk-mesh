/**
 * Rank Engine — XP calculation, rank promotion, streak management
 *
 * XP Formula (Layer3 + BDO):
 *   base_xp = difficulty multiplier (D:10, C:25, B:50, A:100, S:250)
 *   review_mult = avg_review_score / 10
 *   streak_bonus = min(1 + streak * 0.1, 2.0)
 *   speed_bonus = if deadline: (time_remaining / total_time) * 0.5 + 1.0, else 1.0
 *   xp_earned = base_xp * review_mult * streak_bonus * speed_bonus
 *
 * Anti-Leech (Monster Hunter + BDO + Destiny 2):
 *   - SOS helper bonus: +20% XP
 *   - Late claim penalty: -30% XP if task >50% complete
 *   - Abandon penalty: streak reset + -5 signal
 *   - Inactivity decay: -2% XP per week (called externally)
 */

import type { Agent, Task, Review, Rank, Difficulty } from "./types";
import { RANK_CONFIG, DIFFICULTY_XP } from "./types";

export interface XPResult {
	xp_earned: number;
	new_total_xp: number;
	new_rank: Rank;
	ranked_up: boolean;
	streak: number;
	specializations: string[];
}

/**
 * Calculate XP earned from completing a task
 */
export function calculateXP(
	agent: Agent,
	task: Task,
	review: Review,
	opts?: { is_sos_helper?: boolean; late_join?: boolean }
): number {
	const baseXP = DIFFICULTY_XP[task.difficulty];
	const avgScore = (review.scores.quality + review.scores.communication + review.scores.speed) / 3;
	const reviewMult = avgScore / 10;
	const streakBonus = Math.min(1 + agent.streak * 0.1, 2.0);

	let speedBonus = 1.0;
	if (task.deadline) {
		const created = new Date(task.created_at).getTime();
		const deadline = new Date(task.deadline).getTime();
		const now = Date.now();
		const totalTime = deadline - created;
		const timeLeft = Math.max(deadline - now, 0);
		speedBonus = (timeLeft / totalTime) * 0.5 + 1.0;
	}

	let xp = Math.round(baseXP * reviewMult * streakBonus * speedBonus);

	// SOS helper bonus (+20%)
	if (opts?.is_sos_helper) {
		xp = Math.round(xp * 1.2);
	}

	// Late join penalty (-30%)
	if (opts?.late_join) {
		xp = Math.round(xp * 0.7);
	}

	return Math.max(xp, 1); // minimum 1 XP
}

/**
 * Process task completion — update agent stats, check rank promotion
 */
export function processCompletion(agent: Agent, task: Task, review: Review, opts?: { is_sos_helper?: boolean }): XPResult {
	const xpEarned = calculateXP(agent, task, review, opts);
	const newTotalXP = agent.xp + xpEarned;
	const newStreak = agent.streak + 1;
	const bestStreak = Math.max(agent.best_streak, newStreak);

	// Update stats
	const avgScore = (review.scores.quality + review.scores.communication + review.scores.speed) / 3;
	const totalReviewed = agent.tasks_completed + 1;
	const newAvgScore = ((agent.avg_review_score * agent.tasks_completed) + avgScore) / totalReviewed;

	// Signal update (reliability = avg reputation per submission)
	const newSignal = ((agent.signal * agent.tasks_completed) + avgScore) / totalReviewed;

	// Impact update (quality = avg score for approved tasks)
	const newImpact = ((agent.impact * agent.tasks_completed) + review.scores.quality) / totalReviewed;

	// Specialization detection — top 3 skills by frequency
	const skillFrequency: Record<string, number> = {};
	for (const spec of agent.specializations) {
		skillFrequency[spec] = (skillFrequency[spec] || 0) + 1;
	}
	for (const skill of task.skills) {
		skillFrequency[skill] = (skillFrequency[skill] || 0) + 1;
	}
	const specializations = Object.entries(skillFrequency)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([skill]) => skill);

	// Rank check
	const currentRank = agent.rank;
	const newRank = determineRank(newTotalXP, totalReviewed, newSignal, agent.commendations);
	const rankedUp = RANK_CONFIG[newRank].order > RANK_CONFIG[currentRank].order;

	// Apply mutations
	agent.xp = newTotalXP;
	agent.rank = newRank;
	agent.streak = newStreak;
	agent.best_streak = bestStreak;
	agent.tasks_completed = totalReviewed;
	agent.avg_review_score = Math.round(newAvgScore * 100) / 100;
	agent.signal = Math.round(newSignal * 100) / 100;
	agent.impact = Math.round(newImpact * 100) / 100;
	agent.total_earned_usdc += task.reward_usdc * (1 - task.network_fee_pct / 100);
	agent.specializations = specializations;
	agent.last_active = new Date().toISOString();

	return {
		xp_earned: xpEarned,
		new_total_xp: newTotalXP,
		new_rank: newRank,
		ranked_up: rankedUp,
		streak: newStreak,
		specializations,
	};
}

/**
 * Process task abandonment — penalty
 */
export function processAbandonment(agent: Agent): void {
	agent.streak = 0;
	agent.signal = Math.max(0, agent.signal - 0.5);
	agent.tasks_abandoned++;
	agent.last_active = new Date().toISOString();
}

/**
 * Process task failure (rejection beyond max_revisions)
 */
export function processFailure(agent: Agent): void {
	agent.streak = 0;
	agent.signal = Math.max(0, agent.signal - 0.3);
	agent.tasks_failed++;
	agent.last_active = new Date().toISOString();
}

/**
 * Process malicious submission penalty
 */
export function penalizeMaliciousBehavior(agent: Agent): void {
	agent.streak = 0;
	// Massive penalty for trying to hack the guild
	agent.signal = Math.max(0, agent.signal - 3.0);
	agent.tasks_failed++;
	agent.last_active = new Date().toISOString();
}

/**
 * Apply weekly inactivity decay (-2% XP)
 */
export function applyDecay(agent: Agent, weeksInactive: number): void {
	if (weeksInactive <= 0) return;
	const decayFactor = Math.pow(0.98, weeksInactive);
	agent.xp = Math.round(agent.xp * decayFactor);

	// Re-check rank after decay
	agent.rank = determineRank(agent.xp, agent.tasks_completed, agent.signal, agent.commendations);
}

/**
 * Determine rank from XP + qualification checks
 */
function determineRank(xp: number, tasksCompleted: number, signal: number, commendations: number): Rank {
	// GRANDMASTER: 50000 XP + 250 tasks + 50 commendations
	if (xp >= 50000 && tasksCompleted >= 250 && commendations >= 50) return "GRANDMASTER";
	// MASTER: 10000 XP + 100 tasks + impact ≥ 7.0
	if (xp >= 10000 && tasksCompleted >= 100 && signal >= 7.0) return "MASTER";
	// ADEPT: 2000 XP + 30 tasks
	if (xp >= 2000 && tasksCompleted >= 30) return "ADEPT";
	// JOURNEYMAN: 500 XP + 10 tasks + signal ≥ 5.0
	if (xp >= 500 && tasksCompleted >= 10 && signal >= 5.0) return "JOURNEYMAN";
	// APPRENTICE: 100 XP + 3 tasks
	if (xp >= 100 && tasksCompleted >= 3) return "APPRENTICE";
	// INITIATE: default
	return "INITIATE";
}

/**
 * Check if an agent can access a task based on rank
 */
export function canAccessTask(agent: Agent, taskDifficulty: Difficulty): boolean {
	return RANK_CONFIG[agent.rank].taskAccess.includes(taskDifficulty);
}

/**
 * Check if an agent can review a task based on rank
 */
export function canReviewDifficulty(agent: Agent, difficulty: Difficulty): boolean {
	const reviewMap: Record<Rank, Difficulty[]> = {
		INITIATE: [],
		APPRENTICE: [],
		JOURNEYMAN: ["D", "C"],
		ADEPT: ["D", "C", "B"],
		MASTER: ["D", "C", "B", "A"],
		GRANDMASTER: ["D", "C", "B", "A", "S"],
	};
	return reviewMap[agent.rank].includes(difficulty);
}
