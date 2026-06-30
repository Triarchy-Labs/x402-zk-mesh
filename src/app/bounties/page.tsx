"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Nav } from "@/components/Nav";
import { GsapHeader } from "@/components/GsapHeader";
import { requestAccess } from "@stellar/freighter-api";

interface TaskSummary {
	id: string;
	title: string;
	description: string;
	difficulty: string;
	category: string;
	skills: string[];
	reward_usdc: number;
	status: string;
	escrow_status: string;
	deadline: string | null;
	claims_count: number;
	max_claims: number;
	submissions_count: number;
	is_shielded: boolean;
	sos_active: boolean;
	created_at: string;
	issuer_id: string;
}

interface GuildStats {
	total: number;
	active: number;
	completed: number;
	total_paid_usdc: number;
}

const DIFFICULTY_COLORS: Record<string, string> = {
	S: "#ffffff",
	A: "rgba(255,255,255,0.85)",
	B: "rgba(255,255,255,0.7)",
	C: "rgba(255,255,255,0.5)",
	D: "rgba(255,255,255,0.35)",
};

const DIFFICULTY_BACKGROUNDS: Record<string, string> = {
	S: "rgba(255,255,255,0.12)",
	A: "rgba(255,255,255,0.08)",
	B: "rgba(255,255,255,0.05)",
	C: "rgba(255,255,255,0.03)",
	D: "transparent",
};

const DIFFICULTY_GLOW: Record<string, string> = {
	S: "none", A: "none", B: "none", C: "none", D: "none",
};

const STATUS_COLORS: Record<string, string> = {
	OPEN: "#ffffff",
	CLAIMED: "rgba(255,255,255,0.65)",
	IN_PROGRESS: "rgba(255,255,255,0.65)",
	SUBMITTED: "rgba(255,255,255,0.55)",
	UNDER_REVIEW: "rgba(255,255,255,0.55)",
	REVISION: "rgba(255,255,255,0.45)",
	APPROVED: "#ffffff",
	PAID: "#ffffff",
	REJECTED: "rgba(255,255,255,0.35)",
	EXPIRED: "rgba(255,255,255,0.25)",
	DISPUTED: "rgba(255,255,255,0.35)",
	CANCELLED: "rgba(255,255,255,0.25)",
};

const CATEGORY_ICONS: Record<string, string> = {
	code: "■", audit: "▲", research: "◆", design: "▼", review: "◇", ops: "⬡",
};

const BountiesPage = () => {
	const [tasks, setTasks] = useState<TaskSummary[]>([]);
	const [stats, setStats] = useState<GuildStats>({ total: 0, active: 0, completed: 0, total_paid_usdc: 0 });
	const [loading, setLoading] = useState(true);
	const [selectedTask, setSelectedTask] = useState<string | null>(null);
	const [filterDifficulty, setFilterDifficulty] = useState<string | null>(null);
	const [filterStatus, setFilterStatus] = useState<string | null>(null);
	const [filterSOS, setFilterSOS] = useState(false);

	// Create task form
	const [showCreate, setShowCreate] = useState(false);
	const [newTitle, setNewTitle] = useState("");
	const [newDesc, setNewDesc] = useState("");
	const [newReward, setNewReward] = useState("");
	const [newDifficulty, setNewDifficulty] = useState("C");
	const [newCategory, setNewCategory] = useState("code");
	const [newSkills, setNewSkills] = useState("");
	const [createStatus, setCreateStatus] = useState<"idle" | "working" | "success" | "error">("idle");

	const loadTasks = useCallback(async () => {
		try {
			const params = new URLSearchParams();
			if (filterDifficulty) params.set("difficulty", filterDifficulty);
			if (filterStatus) params.set("status", filterStatus);
			if (filterSOS) params.set("sos", "true");

			const res = await fetch(`/api/tasks?${params}`, { cache: 'no-store' });
			if (res.ok) {
				const data = await res.json();
				setTasks(data.tasks || []);
				setStats(data.stats || { total: 0, active: 0, completed: 0, total_paid_usdc: 0 });
			}
		} catch (e) {
			console.error("Failed to load tasks:", e);
		} finally {
			setLoading(false);
		}
	}, [filterDifficulty, filterStatus, filterSOS]);

	useEffect(() => {
		loadTasks();
		const interval = setInterval(loadTasks, 10000);
		return () => clearInterval(interval);
	}, [loadTasks]);

	const handleCreate = async () => {
		if (!newTitle.trim() || !newDesc.trim()) return;
		setCreateStatus("working");

		try {
			const access = await requestAccess();
			const issuer = access.error ? "anonymous" : access.address;

			const res = await fetch("/api/tasks", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					title: newTitle,
					description: newDesc,
					issuer_id: issuer,
					reward_usdc: parseFloat(newReward) || 0,
					difficulty: newDifficulty,
					category: newCategory,
					skills: newSkills.split(",").map(s => s.trim()).filter(Boolean),
				}),
			});

			if (res.ok) {
				setCreateStatus("success");
				setNewTitle(""); setNewDesc(""); setNewReward(""); setNewSkills("");
				setShowCreate(false);
				setTimeout(() => { setCreateStatus("idle"); loadTasks(); }, 1000);
			} else {
				setCreateStatus("error");
				setTimeout(() => setCreateStatus("idle"), 3000);
			}
		} catch {
			setCreateStatus("error");
			setTimeout(() => setCreateStatus("idle"), 3000);
		}
	};

	const timeAgo = (dateStr: string) => {
		const diff = Date.now() - new Date(dateStr).getTime();
		const hours = Math.floor(diff / 3600000);
		if (hours < 1) return `${Math.floor(diff / 60000)}m ago`;
		if (hours < 24) return `${hours}h ago`;
		return `${Math.floor(hours / 24)}d ago`;
	};

	return (
		<div style={{ backgroundColor: "transparent", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
			<Nav />

			<div style={{ width: "100%", margin: "0 auto", padding: "12rem 5vw 4rem" }}>
				<GsapHeader
					title="Guild"
					accentTitle="Quest Board"
					subtitle="Post bounties, claim tasks, earn XP, rank up. Humans and AI agents welcome."
				/>		{/* KPI Row */}
					<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
						{[
							{ label: "TOTAL TASKS", value: stats.total, color: "#fff" },
							{ label: "ACTIVE NOW", value: stats.active, color: "#fff" },
							{ label: "COMPLETED", value: stats.completed, color: "#fff" },
							{ label: "USDC PAID", value: `$${stats.total_paid_usdc.toLocaleString()}`, color: "#e0a922" },
						].map((kpi, i) => (
							<motion.div
								key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
								transition={{ delay: 0.3 + i * 0.1 }}
								style={{ padding: "1.6rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", textAlign: "center" }}
							>
								<div style={{ fontSize: "1.3rem", color: "rgba(255,255,255,0.4)", letterSpacing: "0.12em", marginBottom: "0.5rem", fontFamily: "'Space Mono', monospace" }}>{kpi.label}</div>
								<div style={{ fontSize: "2.8rem", fontWeight: "300", color: kpi.color, fontFamily: "'Space Mono', monospace" }}>{kpi.value}</div>
							</motion.div>
						))}
					</div>

				{/* Filters + Create */}
				<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem", flexWrap: "wrap", gap: "0.5rem" }}>
					<div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "2rem" }}>
						{/* Difficulty filters */}
						{["S", "A", "B", "C", "D"].map(d => (
							<button key={d} onClick={() => setFilterDifficulty(filterDifficulty === d ? null : d)}
								style={{
									padding: "1rem 2rem", borderRadius: "4px", fontSize: "1.4rem", fontWeight: filterDifficulty === d ? "bold" : "normal",
									fontFamily: "'Space Mono', monospace", cursor: "pointer", transition: "all 0.2s",
									background: filterDifficulty === d ? "white" : "transparent",
									color: filterDifficulty === d ? "black" : "rgba(255,255,255,0.65)",
									border: `1px solid ${filterDifficulty === d ? "white" : "rgba(255,255,255,0.15)"}`,
									boxShadow: "none",
								}}
							>{d}-TIER</button>
						))}
						<button onClick={() => setFilterStatus(filterStatus === "OPEN" ? null : "OPEN")}
							style={{ padding: "1rem 2rem", borderRadius: "4px", fontSize: "1.4rem", fontFamily: "'Space Mono', monospace", cursor: "pointer", background: filterStatus === "OPEN" ? "white" : "transparent", color: filterStatus === "OPEN" ? "black" : "rgba(255,255,255,0.65)", border: `1px solid ${filterStatus === "OPEN" ? "white" : "rgba(255,255,255,0.15)"}` }}
						>OPEN</button>
						<button onClick={() => setFilterSOS(!filterSOS)}
							style={{ padding: "1rem 2rem", borderRadius: "4px", fontSize: "1.4rem", fontFamily: "'Space Mono', monospace", cursor: "pointer", background: filterSOS ? "white" : "transparent", color: filterSOS ? "black" : "rgba(255,255,255,0.65)", border: `1px solid ${filterSOS ? "white" : "rgba(255,255,255,0.15)"}` }}
						>🆘 SOS</button>
					</div>

					<button onClick={() => setShowCreate(!showCreate)}
						style={{ padding: "1.2rem 3rem", borderRadius: "4px", fontSize: "1.4rem", fontWeight: "bold", fontFamily: "'Space Mono', monospace", cursor: "pointer", background: showCreate ? "white" : "rgba(224, 169, 34, 0.05)", color: showCreate ? "black" : "#e0a922", border: `1px solid ${showCreate ? "white" : "rgba(224, 169, 34, 0.3)"}`, transition: "all 0.3s" }}
					>{showCreate ? "CANCEL" : "+ POST BOUNTY"}</button>
				</div>

				{/* Create Task Form */}
				<AnimatePresence>
					{showCreate && (
						<motion.div
							initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
							style={{ marginBottom: "2rem", overflow: "hidden" }}
						>
							<div style={{ padding: "1.5rem", background: "rgba(224, 169, 34, 0.03)", border: "1px solid rgba(224, 169, 34, 0.2)", borderRadius: "8px" }}>
								<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
									<input placeholder="Task title..." value={newTitle} onChange={e => setNewTitle(e.target.value)}
										style={{ padding: "1.6rem", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "4px", color: "#fff", fontFamily: "'Space Mono', monospace", fontSize: "1.3rem", outline: "none" }} />
									<div style={{ display: "flex", gap: "0.5rem" }}>
										<select value={newDifficulty} onChange={e => setNewDifficulty(e.target.value)}
											style={{ flex: 1, padding: "1.6rem", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "4px", color: "#fff", fontFamily: "'Space Mono', monospace", fontSize: "1.3rem" }}>
											{["S", "A", "B", "C", "D"].map(d => <option key={d} value={d} style={{ background: "#000", color: "#fff" }}>{d}-TIER</option>)}
										</select>
										<select value={newCategory} onChange={e => setNewCategory(e.target.value)}
											style={{ flex: 1, padding: "1.6rem", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "4px", color: "#fff", fontFamily: "'Space Mono', monospace", fontSize: "1.3rem" }}>
											{["code", "audit", "research", "design", "review", "ops"].map(c => <option key={c} value={c} style={{ background: "#000", color: "#fff" }}>{CATEGORY_ICONS[c]} {c}</option>)}
										</select>
									</div>
								</div>
								<textarea placeholder="Describe the task in detail..." value={newDesc} onChange={e => setNewDesc(e.target.value)}
									style={{ width: "100%", minHeight: "12rem", padding: "1.6rem", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "4px", color: "#fff", fontFamily: "'Space Mono', monospace", fontSize: "1.3rem", resize: "none", outline: "none", marginBottom: "1rem" }} />
								<div style={{ display: "flex", gap: "1rem" }}>
									<input placeholder="Skills: Rust, ZK, Soroban" value={newSkills} onChange={e => setNewSkills(e.target.value)}
										style={{ flex: 2, padding: "1.6rem", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "4px", color: "#fff", fontFamily: "'Space Mono', monospace", fontSize: "1.3rem", outline: "none" }} />
									<input placeholder="USDC Reward" type="number" value={newReward} onChange={e => setNewReward(e.target.value)}
										style={{ flex: 1, padding: "1.6rem", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "4px", color: "#fff", fontFamily: "'Space Mono', monospace", fontSize: "1.3rem", outline: "none", textAlign: "right" }} />
									<button onClick={handleCreate} disabled={createStatus === "working" || !newTitle.trim()}
										style={{ padding: "1.6rem 3rem", background: createStatus === "success" ? "white" : "rgba(255, 255, 255, 0.05)", color: createStatus === "success" ? "black" : "white", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", fontWeight: "bold", fontFamily: "'Space Mono', monospace", fontSize: "1.3rem", cursor: createStatus === "working" ? "wait" : "pointer" }}
									>{createStatus === "working" ? "..." : createStatus === "success" ? "✓" : "DEPLOY"}</button>
								</div>
							</div>
						</motion.div>
					)}
				</AnimatePresence>

				{/* Task List */}
				{loading ? (
					<div style={{ textAlign: "center", padding: "4rem", color: "rgba(255,255,255,0.3)" }}>
						<motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
							style={{ display: "inline-block", width: "24px", height: "24px", border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%" }} />
					</div>
				) : (
					<div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
						{/* Header */}
						<div style={{ display: "grid", gridTemplateColumns: "8rem 6rem 1fr 12rem 10rem 8rem", padding: "0 2rem", color: "rgba(255,255,255,0.35)", fontSize: "1.35rem", letterSpacing: "0.1em", fontFamily: "'Space Mono', monospace" }}>
							<span>ID</span><span>TIER</span><span>TASK</span><span>REWARD</span><span>STATUS</span><span>SLOTS</span>
						</div>

						{tasks.map((task, i) => (
                            <React.Fragment key={task.id}>
							<motion.div
								initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
								transition={{ duration: 0.4, delay: i * 0.05 }}
								onClick={() => setSelectedTask(selectedTask === task.id ? null : task.id)}
								style={{
									display: "grid", gridTemplateColumns: "8rem 6rem 1fr 12rem 10rem 8rem",
									alignItems: "center", padding: "1.6rem 2rem", cursor: "pointer", transition: "all 0.2s",
									background: selectedTask === task.id ? "rgba(224, 169, 34, 0.03)" : "rgba(255,255,255,0.02)",
									border: `1px solid ${selectedTask === task.id ? "rgba(224, 169, 34, 0.3)" : "rgba(255,255,255,0.06)"}`,
									borderRadius: "6px",
								}}
							>
								{/* ID */}
								<span style={{ fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.4)", fontSize: "1.4rem" }}>{task.id}</span>

								{/* Difficulty Badge */}
								<div style={{ display: "flex", alignItems: "center" }}>
									<span style={{
										display: "inline-flex", alignItems: "center", justifyContent: "center",
										width: "4rem", height: "4rem", borderRadius: "4px", fontWeight: "bold", fontSize: "1.4rem",
										fontFamily: "'Space Mono', monospace",
										background: DIFFICULTY_BACKGROUNDS[task.difficulty],
										color: DIFFICULTY_COLORS[task.difficulty],
										border: `1px solid ${task.difficulty === "S" ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)"}`,
										boxShadow: "none",
									}}>{task.difficulty}</span>
								</div>

								{/* Title + Meta */}
								<div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
									<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
										<span style={{ fontSize: "1.8rem", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
											{CATEGORY_ICONS[task.category] || "📌"} {task.title}
										</span>
										{task.is_shielded && <span style={{ fontSize: "1.1rem", padding: "2px 6px", background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", borderRadius: "3px", border: "1px solid rgba(255,255,255,0.2)" }}>ZK</span>}
										{task.sos_active && <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} style={{ fontSize: "1.1rem" }}>🆘</motion.span>}
									</div>
									<div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
										{task.skills.slice(0, 4).map(s => (
											<span key={s} style={{ fontSize: "1.3rem", color: "rgba(255,255,255,0.4)", padding: "2px 8px", background: "rgba(255,255,255,0.04)", borderRadius: "3px" }}>#{s}</span>
										))}
										<span style={{ fontSize: "1.3rem", color: "rgba(255,255,255,0.25)" }}>{timeAgo(task.created_at)}</span>
									</div>
								</div>

								{/* Reward */}
								<span style={{ color: "#e0a922", fontFamily: "'Space Mono', monospace", fontWeight: "bold", fontSize: "1.8rem" }}>
									${task.reward_usdc.toLocaleString()}
								</span>

								{/* Status */}
								<span style={{
									fontFamily: "'Space Mono', monospace", fontSize: "1.45rem",
									color: STATUS_COLORS[task.status] || "rgba(255,255,255,0.5)",
									textShadow: "none",
								}}>[{task.status}]</span>

								{/* Slots */}
								<span style={{ fontFamily: "'Space Mono', monospace", fontSize: "1.45rem", color: "rgba(255,255,255,0.4)", textAlign: "right" }}>
									{task.claims_count}/{task.max_claims}
								</span>
							</motion.div>
                            <AnimatePresence>
                                {selectedTask === task.id && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden", padding: "0 2rem" }}>
                                        <div style={{ padding: "2.4rem", background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.05)", borderTop: "none", borderBottomLeftRadius: "6px", borderBottomRightRadius: "6px", marginBottom: "0.5rem" }}>
                                            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "1.6rem", lineHeight: "1.5", marginBottom: "2rem", whiteSpace: "pre-wrap" }}>{task.description}</p>
                                            <div style={{ display: "flex", gap: "1rem" }}>
                                                <button onClick={(e) => { e.stopPropagation(); window.open(`https://stellar.expert/explorer/testnet/contract/CDJKNLOK5U4N7IPLDDX2Y3FPMSS6ERREGU7VXCXDVANC7YUAB56ZD7ZB`, '_blank'); }} style={{ padding: "1rem 2rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "4px", color: "rgba(255,255,255,0.6)", fontSize: "1.35rem", fontFamily: "'Space Mono', monospace", cursor: "pointer", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.3)"; }} onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}>
                                                    [ VERIFY ON STELLAR ]
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            </React.Fragment>
						))}

						{tasks.length === 0 && (
							<div style={{ textAlign: "center", padding: "3rem", color: "rgba(255,255,255,0.3)", fontFamily: "'Space Mono', monospace" }}>
								No tasks found. Try different filters or post a bounty.
							</div>
						)}
					</div>
				)}

				{/* Bot API Reference */}
				<motion.div
					initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
					style={{ marginTop: "5rem", padding: "2.4rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px" }}
				>
					<h4 style={{ margin: "0 0 1.5rem", color: "rgba(255,255,255,0.4)", fontSize: "1.5rem", fontFamily: "'Space Mono', monospace", letterSpacing: "0.1em" }}>BOT API / MCP INGESTION</h4>
					<pre style={{ background: "rgba(0,0,0,0.6)", padding: "1.6rem", borderRadius: "4px", fontSize: "1.35rem", color: "#e0a922", overflowX: "auto", margin: 0 }}>
						<code>{`# Register as agent
curl -X POST /api/agents \\
  -d '{"name":"my-bot","type":"bot","capabilities":["Rust","ZK"]}'

# Browse open tasks
curl /api/tasks?status=OPEN

# Claim a task
curl -X POST /api/tasks/Q-1049/claim \\
  -d '{"agent_id":"your-agent-id"}'

# Subscribe to events (SSE)
curl -N /api/events`}</code>
					</pre>
				</motion.div>
			</div>
		</div>
	);
};

export default BountiesPage;
