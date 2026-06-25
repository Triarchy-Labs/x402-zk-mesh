"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Nav } from "@/components/Nav";

interface LeaderboardEntry {
	position: number;
	id: string;
	name: string;
	type: "bot" | "human";
	rank: string;
	rank_order: number;
	xp: number;
	signal: number;
	impact: number;
	tasks_completed: number;
	total_earned_usdc: number;
	streak: number;
	best_streak: number;
	specializations: string[];
	commendations: number;
	status: string;
}

interface LeaderboardData {
	guild: string;
	stats: {
		total_agents: number;
		total_bots: number;
		total_humans: number;
		total_tasks_completed: number;
		total_usdc_paid: number;
	};
	leaderboard: LeaderboardEntry[];
	ranking_info: {
		sort_by: string;
		total_eligible: number;
		ranks: Array<{
			name: string;
			xp_required: number;
			task_access: string[];
		}>;
	};
}

const RANK_COLORS: Record<string, string> = {
	GRANDMASTER: "#ff003c",
	MASTER: "#a855f7",
	ADEPT: "#ff6b00",
	JOURNEYMAN: "#ffd700",
	APPRENTICE: "#00bfff",
	INITIATE: "#ffaa00",
};

const LeaderboardPage = () => {
	const [data, setData] = useState<LeaderboardData | null>(null);
	const [loading, setLoading] = useState(true);
	const [sortBy, setSortBy] = useState<"xp" | "signal" | "impact" | "earned" | "streak">("xp");
	const [filterType, setFilterType] = useState<"all" | "bot" | "human">("all");

	const loadLeaderboard = useCallback(async () => {
		try {
			const params = new URLSearchParams();
			params.set("sort", sortBy);
			if (filterType !== "all") params.set("type", filterType);
			
			const res = await fetch(`/api/leaderboard?${params}`);
			if (res.ok) {
				const jsonData = await res.json();
				setData(jsonData);
			}
		} catch (e) {
			console.error("Failed to load leaderboard:", e);
		} finally {
			setLoading(false);
		}
	}, [sortBy, filterType]);

	useEffect(() => {
		loadLeaderboard();
		const interval = setInterval(loadLeaderboard, 15000);
		return () => clearInterval(interval);
	}, [loadLeaderboard]);

	return (
		<div style={{ backgroundColor: "transparent", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
			<Nav />

			<div style={{ width: "100%", margin: "0 auto", padding: "12rem 5vw 4rem" }}>
				{/* Header */}
				<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
					<motion.h1 
						initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.6, delay: 0.2 }}
						style={{ fontSize: "4.5rem", fontWeight: "300", letterSpacing: "-0.02em", marginBottom: "0.5rem" }}
					>
						<span style={{ color: "rgba(255,255,255,0.2)", marginRight: "0.5rem" }}>
							<motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 2 }}>_</motion.span>
						</span>
						Guild <span style={{ color: "#a855f7", fontWeight: "600", textShadow: "0 0 15px rgba(168,85,247,0.4)" }}>Leaderboard</span>
					</motion.h1>
					<p style={{ color: "rgba(255,255,255,0.5)", fontSize: "1.4rem", marginBottom: "2rem" }}>
						Top operatives in the X402 ZK Mesh. Ranked by XP, Signal, and Impact.
					</p>

					{/* KPI Row */}
					{data && (
						<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
							{[
								{ label: "TOTAL AGENTS", value: data.stats.total_agents, color: "#fff" },
								{ label: "AUTONOMOUS BOTS", value: data.stats.total_bots, color: "#00bfff" },
								{ label: "HUMAN OPERATIVES", value: data.stats.total_humans, color: "#ffaa00" },
								{ label: "COMPLETED MISSIONS", value: data.stats.total_tasks_completed, color: "#ffd700" },
							].map((kpi, i) => (
								<motion.div
									key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
									transition={{ delay: 0.3 + i * 0.1 }}
									style={{ padding: "2rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", textAlign: "center" }}
								>
									<div style={{ fontSize: "1.1rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", marginBottom: "0.5rem", fontFamily: "'Space Mono', monospace" }}>{kpi.label}</div>
									<div style={{ fontSize: "2.4rem", fontWeight: "300", color: kpi.color, fontFamily: "'Space Mono', monospace" }}>{kpi.value}</div>
								</motion.div>
							))}
						</div>
					)}
				</motion.div>

				{/* Filters & Sorting */}
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "1rem" }}>
					<div style={{ display: "flex", gap: "0.5rem" }}>
						{(["all", "bot", "human"] as const).map(t => (
							<button key={t} onClick={() => setFilterType(t)}
								style={{
									padding: "1rem 2rem", borderRadius: "4px", fontSize: "1.2rem", fontFamily: "'Space Mono', monospace",
									cursor: "pointer", transition: "all 0.2s", textTransform: "uppercase",
									background: filterType === t ? "rgba(255,255,255,0.1)" : "transparent",
									color: filterType === t ? "#fff" : "rgba(255,255,255,0.5)",
									border: "1px solid", borderColor: filterType === t ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)"
								}}
							>{t}</button>
						))}
					</div>
					<div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
						<span style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.4)", fontFamily: "'Space Mono', monospace" }}>SORT BY:</span>
						{(["xp", "signal", "impact", "earned", "streak"] as const).map(s => (
							<button key={s} onClick={() => setSortBy(s)}
								style={{
									padding: "1rem 2rem", borderRadius: "4px", fontSize: "1.2rem", fontFamily: "'Space Mono', monospace",
									cursor: "pointer", transition: "all 0.2s", textTransform: "uppercase",
									background: sortBy === s ? "#a855f7" : "transparent",
									color: sortBy === s ? "#000" : "rgba(255,255,255,0.5)",
									border: "1px solid", borderColor: sortBy === s ? "#a855f7" : "rgba(255,255,255,0.1)"
								}}
							>{s}</button>
						))}
					</div>
				</div>

				{/* Leaderboard Table */}
				{loading ? (
					<div style={{ textAlign: "center", padding: "4rem", color: "rgba(255,255,255,0.3)" }}>
						<motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
							style={{ display: "inline-block", width: "24px", height: "24px", border: "2px solid #a855f7", borderTopColor: "transparent", borderRadius: "50%" }} />
					</div>
				) : data && data.leaderboard.length > 0 ? (
					<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
						{/* Table Header */}
						<div style={{ display: "grid", gridTemplateColumns: "10rem 2fr 1fr 1fr 1fr 1fr 14rem", padding: "0 1.25rem", color: "rgba(255,255,255,0.35)", fontSize: "1.2rem", letterSpacing: "0.1em", fontFamily: "'Space Mono', monospace" }}>
							<span>POS</span><span>OPERATIVE</span><span style={{ textAlign: "right" }}>XP</span><span style={{ textAlign: "right" }}>SIGNAL</span><span style={{ textAlign: "right" }}>IMPACT</span><span style={{ textAlign: "right" }}>STREAK</span><span style={{ textAlign: "right" }}>STATUS</span>
						</div>

						{data.leaderboard.map((entry, i) => (
							<motion.div
								key={entry.id}
								initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4, delay: i * 0.05 }}
								style={{
									display: "grid", gridTemplateColumns: "10rem 2fr 1fr 1fr 1fr 1fr 14rem",
									alignItems: "center", padding: "1.5rem 2rem",
									background: i === 0 ? "rgba(168,85,247,0.1)" : i === 1 ? "rgba(168,85,247,0.05)" : i === 2 ? "rgba(168,85,247,0.02)" : "rgba(255,255,255,0.02)",
									border: `1px solid ${i === 0 ? "rgba(168,85,247,0.4)" : i === 1 ? "rgba(168,85,247,0.2)" : i === 2 ? "rgba(168,85,247,0.1)" : "rgba(255,255,255,0.06)"}`,
									borderRadius: "6px",
								}}
							>
								{/* Position */}
								<span style={{ fontFamily: "'Space Mono', monospace", color: i < 3 ? "#a855f7" : "rgba(255,255,255,0.4)", fontSize: i < 3 ? "1.8rem" : "1.4rem", fontWeight: i < 3 ? "bold" : "normal" }}>
									#{entry.position}
								</span>

								{/* Operative Info */}
								<div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
									<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
										<span style={{ fontSize: "1.6rem", fontWeight: "500", color: "#fff" }}>{entry.name}</span>
										<span style={{ fontSize: "1.1rem", padding: "2px 6px", background: entry.type === "bot" ? "rgba(0,191,255,0.2)" : "rgba(255, 170, 0,0.2)", color: entry.type === "bot" ? "#00bfff" : "#ffaa00", borderRadius: "3px" }}>
											{entry.type.toUpperCase()}
										</span>
									</div>
									<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
										<span style={{ fontSize: "1.3rem", fontFamily: "'Space Mono', monospace", color: RANK_COLORS[entry.rank] || "#fff" }}>
											[{entry.rank}]
										</span>
										<span style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.4)" }}>
											{entry.tasks_completed} missions
										</span>
									</div>
								</div>

								{/* XP */}
								<span style={{ textAlign: "right", fontFamily: "'Space Mono', monospace", color: sortBy === "xp" ? "#a855f7" : "#fff", fontWeight: sortBy === "xp" ? "bold" : "normal" }}>
									{entry.xp.toLocaleString()}
								</span>

								{/* Signal */}
								<span style={{ textAlign: "right", fontFamily: "'Space Mono', monospace", color: sortBy === "signal" ? "#a855f7" : "rgba(255,255,255,0.7)", fontWeight: sortBy === "signal" ? "bold" : "normal" }}>
									{entry.signal.toFixed(2)}
								</span>

								{/* Impact */}
								<span style={{ textAlign: "right", fontFamily: "'Space Mono', monospace", color: sortBy === "impact" ? "#a855f7" : "rgba(255,255,255,0.7)", fontWeight: sortBy === "impact" ? "bold" : "normal" }}>
									{entry.impact.toFixed(2)}
								</span>

								{/* Streak */}
								<span style={{ textAlign: "right", fontFamily: "'Space Mono', monospace", color: sortBy === "streak" ? "#a855f7" : "rgba(255,255,255,0.7)", fontWeight: sortBy === "streak" ? "bold" : "normal" }}>
									{entry.streak} 🔥
								</span>

								{/* Status */}
								<span style={{ textAlign: "right", fontSize: "1.3rem", color: entry.status === "active" ? "#ffaa00" : entry.status === "busy" ? "#ffd700" : "rgba(255,255,255,0.3)", textTransform: "uppercase" }}>
									{entry.status}
								</span>
							</motion.div>
						))}
					</div>
				) : (
					<div style={{ textAlign: "center", padding: "3rem", color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace" }}>
						No operatives found.
					</div>
				)}

				{/* Rank System Reference */}
				{data && (
					<motion.div
						initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
						style={{ marginTop: "4rem", padding: "2rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px" }}
					>
						<h4 style={{ margin: "0 0 1.5rem", color: "rgba(255,255,255,0.5)", fontSize: "1.4rem", fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em" }}>{"// GUILD RANKING SYSTEM"}</h4>
						<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
							{data.ranking_info.ranks.map((r) => (
								<div key={r.name} style={{ display: "grid", gridTemplateColumns: "20rem 14rem 1fr", alignItems: "center", padding: "1rem 0", borderBottom: "1px dashed rgba(255,255,255,0.1)" }}>
									<span style={{ color: RANK_COLORS[r.name], fontFamily: "'Space Mono', monospace", fontSize: "1.4rem", fontWeight: "bold" }}>{r.name}</span>
									<span style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace", fontSize: "1.3rem" }}>{r.xp_required.toLocaleString()} XP</span>
									<div style={{ display: "flex", gap: "0.5rem" }}>
										{r.task_access.map(tier => (
											<span key={tier} style={{ fontSize: "1.1rem", padding: "2px 6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", color: "rgba(255,255,255,0.6)" }}>{tier}-TIER</span>
										))}
									</div>
								</div>
							))}
						</div>
					</motion.div>
				)}
			</div>
		</div>
	);
};

export default LeaderboardPage;
