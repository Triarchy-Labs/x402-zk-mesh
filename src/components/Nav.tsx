"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { useWallet } from "@/context/WalletContext";
import { AgentOrb } from "@/components/AgentOrb";

const TRANSITION = "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)";
const FONT_MONO = "var(--font-mono, 'SF Mono', monospace)";

// Capsule button base style — single source of truth
const capsuleBase: React.CSSProperties = {
	background: "transparent",
	color: "rgba(255,255,255,0.7)",
	border: "1px solid rgba(255,255,255,0.2)",
	padding: "var(--space-sm, 1.2rem) var(--space-lg, 3rem)",
	borderRadius: "var(--radius-pill, 10rem)",
	cursor: "pointer",
	fontFamily: FONT_MONO,
	fontSize: "var(--text-caption, 1.3rem)",
	fontWeight: "var(--weight-semibold, 600)" as React.CSSProperties["fontWeight"],
	letterSpacing: "0.1em",
	transition: TRANSITION,
	backdropFilter: "blur(1.2rem)",
	whiteSpace: "nowrap" as const,
};

const hoverIn = (e: React.MouseEvent<HTMLButtonElement>) => {
	e.currentTarget.style.backgroundColor = "rgba(255,170,0,0.15)";
	e.currentTarget.style.color = "#ffaa00";
	e.currentTarget.style.borderColor = "rgba(255,170,0,0.4)";
};
const hoverOut = (bg = "transparent") => (e: React.MouseEvent<HTMLButtonElement>) => {
	e.currentTarget.style.backgroundColor = bg;
	e.currentTarget.style.color = "rgba(255,255,255,0.7)";
	e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
};

const NAV_LINKS = [
	{ label: "QUESTS", href: "/bounties" },
	{ label: "LEADERBOARD", href: "/leaderboard" },
	{ label: "DASHBOARD", href: "/dashboard", bg: "rgba(10,10,10,0.7)" },
	{ label: "PROFILE", href: "/profile" },
];

export function Nav() {
	const { connected, displayKey, connecting, freighterMissing, connect, disconnect } = useWallet();
	const [hoverLogo, setHoverLogo] = useState(false);
	const [showDisconnect, setShowDisconnect] = useState(false);

	const handleConnect = async () => {
		if (connected) {
			setShowDisconnect(!showDisconnect);
			return;
		}
		await connect();
	};

	const handleDisconnect = () => {
		disconnect();
		setShowDisconnect(false);
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: -20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100%",
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
				padding: "var(--space-lg, 3rem) 2.5vw 0",
				zIndex: 100,
				background: "transparent",
				pointerEvents: "none",
			}}
		>
			{/* Logo / Return */}
			<div
				style={{
					pointerEvents: "auto",
					display: "flex",
					alignItems: "center",
					gap: "1.2rem",
					cursor: "pointer",
					position: "relative",
				}}
				onClick={() => window.location.href = "/"}
				onMouseEnter={() => setHoverLogo(true)}
				onMouseLeave={() => setHoverLogo(false)}
			>
				<motion.div
					animate={{ scale: hoverLogo ? 1.1 : 1 }}
					transition={{ type: "spring", stiffness: 300, damping: 20 }}
					style={{
						flexShrink: 0,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						width: "var(--orb-nav-size, 4.8rem)",
						height: "var(--orb-nav-size, 4.8rem)",
					}}
				>
					<AgentOrb state={hoverLogo ? "typing" : "idle"} size={88} />
				</motion.div>
				<motion.div
					initial={{ width: 0, opacity: 0 }}
					animate={{ width: hoverLogo ? "auto" : 0, opacity: hoverLogo ? 1 : 0 }}
					style={{ overflow: "hidden", whiteSpace: "nowrap" }}
					transition={{ type: "spring", stiffness: 200, damping: 20 }}
				>
					<span
						className="hidden sm:inline"
						style={{
							fontFamily: FONT_MONO,
							fontSize: "var(--text-caption, 1.3rem)",
							fontWeight: 600,
							letterSpacing: "0.1em",
							textTransform: "uppercase",
							color: "#fff",
							paddingLeft: "0.4rem",
						}}
					>
						[ RETURN TO HQ ]
					</span>
				</motion.div>
			</div>

			{/* Nav Actions */}
			<div
				className="nav-actions"
				style={{
					pointerEvents: "auto",
					display: "flex",
					gap: "var(--space-md, 2.4rem)",
					alignItems: "center",
					position: "relative",
				}}
			>
				{NAV_LINKS.map(({ label, href, bg }) => (
					<button
						key={label}
						onClick={() => window.location.href = href}
						style={{ ...capsuleBase, background: bg || "transparent" }}
						onMouseEnter={hoverIn}
						onMouseLeave={hoverOut(bg || "transparent")}
					>
						[ {label} ]
					</button>
				))}

				{/* Wallet Connect */}
				<div style={{ position: "relative" }}>
					<button
						onClick={handleConnect}
						className={`connect-btn-base ${connected || freighterMissing ? "connect-state-true" : "connect-state-false connect-btn-hover-fx"}`}
						style={{
							transform: "scale(1)",
							...(freighterMissing
								? { backgroundColor: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.1)", color: "#aaa" }
								: {}
							),
						}}
						onMouseDown={(e) => e.currentTarget.style.transform = "scale(0.95)"}
						onMouseUp={(e) => e.currentTarget.style.transform = "scale(1.05)"}
						onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
						onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
					>
						<span>
							{connecting
								? "[ CONNECTING... ]"
								: connected
									? `[ ${displayKey} ]`
									: freighterMissing
										? "[ GET FREIGHTER ]"
										: "[ CONNECT WALLET ]"
							}
						</span>
					</button>

					{/* Disconnect Bubble */}
					<motion.div
						initial={{ opacity: 0, y: "-1rem", pointerEvents: "none" }}
						animate={{
							opacity: showDisconnect ? 1 : 0,
							y: showDisconnect ? "1rem" : "-1rem",
							pointerEvents: showDisconnect ? "auto" : "none",
						}}
						style={{
							position: "absolute",
							top: "100%",
							right: 0,
							background: "rgba(255, 85, 0, 0.1)",
							border: "1px solid rgba(255, 85, 0, 0.5)",
							backdropFilter: "blur(1.2rem)",
							padding: "0.8rem 1.6rem",
							borderRadius: "var(--radius-card, 1.2rem)",
							cursor: "pointer",
							color: "#ff5500",
						}}
						onClick={handleDisconnect}
					>
						<span style={{
							fontFamily: FONT_MONO,
							fontSize: "var(--text-small, 1.1rem)",
							fontWeight: 600,
						}}>
							DISCONNECT
						</span>
					</motion.div>
				</div>
			</div>
		</motion.div>
	);
}
