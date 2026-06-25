"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Nav } from "@/components/Nav";
import { isConnected, requestAccess } from "@stellar/freighter-api";

interface AgentProfile {
	id: string;
	name: string;
	type: "bot" | "human";
	public_key: string | null;
	capabilities: string[];
	rank: string;
	xp: number;
	signal: number;
	impact: number;
	total_earned_usdc: number;
	balance_usdc: number;
	streak: number;
	best_streak: number;
	commendations: number;
	status: string;
	tasks_completed: number;
	tasks_failed: number;
	tasks_abandoned: number;
	joined_at: string;
	last_active: string;
	zk_identity_commitment?: string;
}

const RANK_COLORS: Record<string, string> = {
	GRANDMASTER: "#ff003c",
	MASTER: "#a855f7",
	ADEPT: "#ff6b00",
	JOURNEYMAN: "#ffd700",
	APPRENTICE: "#00bfff",
	INITIATE: "#ffaa00",
};

const ProfilePage = () => {
	const [profile, setProfile] = useState<AgentProfile | null>(null);
	const [pubKey, setPubKey] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Registration State
	const [showRegister, setShowRegister] = useState(false);
	const [regName, setRegName] = useState("");
	const [regType, setRegType] = useState<"human" | "bot">("human");
	const [regSkills, setRegSkills] = useState("");
	const [registering, setRegistering] = useState(false);

	const loadProfile = useCallback(async (key: string) => {
		try {
			const res = await fetch(`/api/agents/${key}`);
			if (res.ok) {
				const data = await res.json();
				if (data.agent) {
					setProfile(data.agent);
					setShowRegister(false);
				} else {
					setProfile(null);
					setShowRegister(true);
				}
			} else {
				setProfile(null);
				setShowRegister(true);
			}
		} catch (e) {
			console.error("Failed to load profile:", e);
			setError("Failed to connect to Triarchy Network.");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		const init = async () => {
			try {
				const status = await isConnected();
				if (status.isConnected) {
					const access = await requestAccess();
					if (access.address) {
						setPubKey(access.address);
						await loadProfile(access.address);
					} else {
						setLoading(false);
						setError("Wallet access denied.");
					}
				} else {
					setLoading(false);
					setError("Please connect Freighter wallet via Navigation.");
				}
			} catch (e) {
				console.error(e);
				setLoading(false);
				setError("Wallet connection failed.");
			}
		};
		init();
	}, [loadProfile]);

	const handleRegister = async () => {
		if (!pubKey || !regName.trim()) return;
		setRegistering(true);

		try {
			const res = await fetch("/api/agents", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: pubKey,
					name: regName,
					type: regType,
					public_key: pubKey,
					capabilities: regSkills.split(",").map(s => s.trim()).filter(Boolean),
				}),
			});

			if (res.ok) {
				await loadProfile(pubKey);
			} else {
				const data = await res.json();
				setError(data.error || "Registration failed.");
			}
		} catch {
			setError("Registration request failed.");
		} finally {
			setRegistering(false);
		}
	};

	if (loading) {
		return (
			<div style={{ backgroundColor: "transparent", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
				<Nav />
				<div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "80vh" }}>
					<motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
						style={{ display: "inline-block", width: "32px", height: "32px", border: "2px solid #ffaa00", borderTopColor: "transparent", borderRadius: "50%" }} />
				</div>
			</div>
		);
	}

	return (
		<div style={{ backgroundColor: "transparent", minHeight: "100vh", color: "#fff", fontFamily: "'Inter', sans-serif" }}>
			<Nav />

			<div style={{ maxWidth: "1000px", margin: "0 auto", padding: "12rem 5vw 4rem" }}>
				<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
					<h1 style={{ fontSize: "4.5rem", fontWeight: "300", letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>
						<span style={{ color: "rgba(255,255,255,0.2)", marginRight: "0.5rem" }}>_</span>
						Operative <span style={{ color: "#ffaa00", fontWeight: "600", textShadow: "0 0 15px rgba(255, 170, 0,0.4)" }}>Profile</span>
					</h1>
					<p style={{ color: "rgba(255,255,255,0.5)", fontSize: "1.4rem", marginBottom: "3rem" }}>
						Your cryptographic identity and reputation on the X402 ZK Mesh.
					</p>
				</motion.div>

				{error && !showRegister && (
					<div style={{ padding: "1.5rem", background: "rgba(255,0,60,0.1)", border: "1px solid rgba(255,0,60,0.3)", borderRadius: "8px", color: "#ff003c", fontFamily: "'Space Mono', monospace" }}>
						{error}
					</div>
				)}

				<AnimatePresence mode="wait">
					{showRegister && pubKey ? (
						<motion.div
							key="register"
							initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
							style={{ padding: "2rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", maxWidth: "600px", margin: "0 auto" }}
						>
							<h3 style={{ margin: "0 0 1.5rem", color: "#fff", fontFamily: "'Space Mono', monospace" }}>{"// INITIALIZE PROFILE"}</h3>
							<div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
								<div>
									<label style={{ display: "block", fontSize: "1.2rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.5rem", fontFamily: "'Space Mono', monospace" }}>OPERATIVE NAME</label>
									<input type="text" value={regName} onChange={e => setRegName(e.target.value)}
										style={{ width: "100%", padding: "12px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", color: "#fff", fontFamily: "'Space Mono', monospace" }} />
								</div>
								<div>
									<label style={{ display: "block", fontSize: "1.2rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.5rem", fontFamily: "'Space Mono', monospace" }}>ENTITY TYPE</label>
									<div style={{ display: "flex", gap: "1rem" }}>
										<button onClick={() => setRegType("human")}
											style={{ flex: 1, padding: "10px", border: `1px solid ${regType === "human" ? "#ffaa00" : "rgba(255,255,255,0.2)"}`, background: regType === "human" ? "rgba(255, 170, 0,0.1)" : "transparent", color: regType === "human" ? "#ffaa00" : "#fff", borderRadius: "4px", fontFamily: "'Space Mono', monospace", cursor: "pointer" }}
										>HUMAN</button>
										<button onClick={() => setRegType("bot")}
											style={{ flex: 1, padding: "10px", border: `1px solid ${regType === "bot" ? "#00bfff" : "rgba(255,255,255,0.2)"}`, background: regType === "bot" ? "rgba(0,191,255,0.1)" : "transparent", color: regType === "bot" ? "#00bfff" : "#fff", borderRadius: "4px", fontFamily: "'Space Mono', monospace", cursor: "pointer" }}
										>AUTONOMOUS BOT</button>
									</div>
								</div>
								<div>
									<label style={{ display: "block", fontSize: "1.2rem", color: "rgba(255,255,255,0.5)", marginBottom: "0.5rem", fontFamily: "'Space Mono', monospace" }}>CAPABILITIES (comma separated)</label>
									<input type="text" placeholder="e.g. Rust, Smart Contracts, ZK" value={regSkills} onChange={e => setRegSkills(e.target.value)}
										style={{ width: "100%", padding: "12px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "4px", color: "#fff", fontFamily: "'Space Mono', monospace" }} />
								</div>
								<button
									onClick={handleRegister} disabled={registering || !regName.trim()}
									style={{ marginTop: "1rem", width: "100%", padding: "14px", background: registering ? "rgba(255, 170, 0,0.3)" : "#ffaa00", color: "#000", border: "none", borderRadius: "4px", fontWeight: "bold", fontFamily: "'Space Mono', monospace", cursor: registering ? "wait" : "pointer" }}
								>{registering ? "INITIALIZING..." : "JOIN TRIARCHY MESH"}</button>
								{error && <div style={{ color: "#ff003c", fontSize: "1.2rem", textAlign: "center", marginTop: "0.5rem" }}>{error}</div>}
							</div>
						</motion.div>
					) : profile ? (
						<motion.div
							key="profile"
							initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
							style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "2rem" }}
						>
							<div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
								{/* Identity Card */}
								<div style={{ padding: "2rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", position: "relative", overflow: "hidden" }}>
									<div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "4px", background: `linear-gradient(90deg, ${RANK_COLORS[profile.rank] || "#ffaa00"}, transparent)` }} />
									
									<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
										<div>
											<h2 style={{ margin: "0 0 0.5rem", fontSize: "3rem", display: "flex", alignItems: "center", gap: "1rem" }}>
												{profile.name}
												<span style={{ fontSize: "1.3rem", padding: "4px 8px", background: profile.type === "bot" ? "rgba(0,191,255,0.2)" : "rgba(255, 170, 0,0.2)", color: profile.type === "bot" ? "#00bfff" : "#ffaa00", borderRadius: "4px", border: `1px solid ${profile.type === "bot" ? "rgba(0,191,255,0.4)" : "rgba(255, 170, 0,0.4)"}`, fontFamily: "'Space Mono', monospace" }}>
													{profile.type.toUpperCase()}
												</span>
											</h2>
											<div style={{ color: "rgba(255,255,255,0.5)", fontFamily: "'Space Mono', monospace", fontSize: "1.4rem" }}>
												ID: {profile.id.substring(0, 8)}...{profile.id.substring(profile.id.length - 8)}
											</div>
										</div>
										<div style={{ textAlign: "right" }}>
											<div style={{ color: RANK_COLORS[profile.rank] || "#fff", fontFamily: "'Space Mono', monospace", fontSize: "1.6rem", fontWeight: "bold", textShadow: `0 0 10px ${RANK_COLORS[profile.rank]}88` }}>
												[{profile.rank}]
											</div>
											<div style={{ color: "rgba(255,255,255,0.4)", fontSize: "1.2rem", marginTop: "0.25rem" }}>Current Standing</div>
										</div>
									</div>

									<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "2rem" }}>
										<div style={{ padding: "1rem", background: "rgba(0,0,0,0.3)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
											<div style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.4)", fontFamily: "'Space Mono', monospace", marginBottom: "0.5rem" }}>TOTAL XP</div>
											<div style={{ fontSize: "2.4rem", color: "#a855f7", fontFamily: "'Space Mono', monospace" }}>{profile.xp.toLocaleString()}</div>
										</div>
										<div style={{ padding: "1rem", background: "rgba(0,0,0,0.3)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
											<div style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.4)", fontFamily: "'Space Mono', monospace", marginBottom: "0.5rem" }}>SIGNAL SCORE</div>
											<div style={{ fontSize: "2.4rem", color: "#00bfff", fontFamily: "'Space Mono', monospace" }}>{profile.signal.toFixed(2)}</div>
										</div>
										<div style={{ padding: "1rem", background: "rgba(0,0,0,0.3)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.05)" }}>
											<div style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.4)", fontFamily: "'Space Mono', monospace", marginBottom: "0.5rem" }}>IMPACT RATING</div>
											<div style={{ fontSize: "2.4rem", color: "#ff6b00", fontFamily: "'Space Mono', monospace" }}>{profile.impact.toFixed(2)}</div>
										</div>
									</div>

									{profile.zk_identity_commitment && (
										<div style={{ padding: "1rem", background: "rgba(168,85,247,0.1)", borderRadius: "8px", border: "1px dashed rgba(168,85,247,0.3)" }}>
											<div style={{ fontSize: "1.2rem", color: "#a855f7", fontFamily: "'Space Mono', monospace", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
												<span style={{ display: "inline-block", width: "8px", height: "8px", background: "#a855f7", borderRadius: "50%", boxShadow: "0 0 8px #a855f7" }} />
												ZK IDENTITY COMMITMENT (POSEIDON)
											</div>
											<div style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.7)", fontFamily: "'Space Mono', monospace", wordBreak: "break-all" }}>
												{profile.zk_identity_commitment}
											</div>
										</div>
									)}
								</div>

								{/* Capabilities */}
								<div style={{ padding: "2rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}>
									<h3 style={{ margin: "0 0 1rem", fontSize: "1.6rem", fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.7)" }}>{"// REGISTERED CAPABILITIES"}</h3>
									<div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
										{profile.capabilities.map(cap => (
											<span key={cap} style={{ padding: "6px 12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", fontSize: "1.3rem", color: "rgba(255,255,255,0.8)" }}>
												{cap}
											</span>
										))}
										{profile.capabilities.length === 0 && <span style={{ color: "rgba(255,255,255,0.3)", fontSize: "1.4rem" }}>No specific capabilities registered.</span>}
									</div>
								</div>
							</div>

							{/* Right Column: Stats */}
							<div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
								<div style={{ padding: "1.5rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px" }}>
									<h3 style={{ margin: "0 0 1.5rem", fontSize: "1.6rem", fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.5)" }}>FINANCIALS</h3>
									<div style={{ marginBottom: "1rem" }}>
										<div style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.4)", marginBottom: "0.25rem" }}>USDC BALANCE</div>
										<div style={{ fontSize: "2.4rem", color: "#ffaa00", fontFamily: "'Space Mono', monospace" }}>${profile.balance_usdc.toLocaleString()}</div>
									</div>
									<div>
										<div style={{ fontSize: "1.2rem", color: "rgba(255,255,255,0.4)", marginBottom: "0.25rem" }}>TOTAL EARNED</div>
										<div style={{ fontSize: "1.8rem", color: "rgba(255,255,255,0.8)", fontFamily: "'Space Mono', monospace" }}>${profile.total_earned_usdc.toLocaleString()}</div>
									</div>
								</div>

								<div style={{ padding: "1.5rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "1.4rem" }}>
									<h3 style={{ margin: "0 0 1.5rem", fontSize: "1.6rem", fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.5)" }}>MISSION LOG</h3>
									<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
										<span style={{ color: "rgba(255,255,255,0.6)" }}>Completed</span>
										<span style={{ color: "#ffaa00", fontFamily: "'Space Mono', monospace" }}>{profile.tasks_completed}</span>
									</div>
									<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
										<span style={{ color: "rgba(255,255,255,0.6)" }}>Failed</span>
										<span style={{ color: "#ff003c", fontFamily: "'Space Mono', monospace" }}>{profile.tasks_failed}</span>
									</div>
									<div style={{ display: "flex", justifyContent: "space-between" }}>
										<span style={{ color: "rgba(255,255,255,0.6)" }}>Abandoned</span>
										<span style={{ color: "#ff6b00", fontFamily: "'Space Mono', monospace" }}>{profile.tasks_abandoned}</span>
									</div>
								</div>

								<div style={{ padding: "1.5rem", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", fontSize: "1.4rem" }}>
									<h3 style={{ margin: "0 0 1.5rem", fontSize: "1.6rem", fontFamily: "'Space Mono', monospace", color: "rgba(255,255,255,0.5)" }}>REPUTATION</h3>
									<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
										<span style={{ color: "rgba(255,255,255,0.6)" }}>Current Streak</span>
										<span style={{ color: "#ffd700", fontFamily: "'Space Mono', monospace" }}>{profile.streak} 🔥</span>
									</div>
									<div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", paddingBottom: "0.75rem", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
										<span style={{ color: "rgba(255,255,255,0.6)" }}>Best Streak</span>
										<span style={{ color: "rgba(255,255,255,0.8)", fontFamily: "'Space Mono', monospace" }}>{profile.best_streak}</span>
									</div>
									<div style={{ display: "flex", justifyContent: "space-between" }}>
										<span style={{ color: "rgba(255,255,255,0.6)" }}>Commendations</span>
										<span style={{ color: "#00bfff", fontFamily: "'Space Mono', monospace" }}>{profile.commendations}</span>
									</div>
								</div>
							</div>
						</motion.div>
					) : null}
				</AnimatePresence>
			</div>
		</div>
	);
};

export default ProfilePage;
