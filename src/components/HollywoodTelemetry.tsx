"use client";
import React, { useEffect, useState } from "react";

const lusionTransition = "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)";

export default function HollywoodTelemetry({ theme = "dark" }: { theme?: "dark" | "light" }) {
	const [logs, setLogs] = useState<{ id: string | number; text: string }[]>([]);
	const [hovered, setHovered] = useState(false);

	useEffect(() => {
		const bootLogs = [
			"INIT_SEQUENCE_START",
			"MOUNTING_LOCAL_FILESYSTEM...",
			"ESTABLISHING_SECURE_TUNNEL_TO_L402...",
			"WASM_SANDBOX_ALLOCATION: 1024MB",
			"BYPASSING_EXTERNAL_FIREWALLS",
			"AUTH_PROTOCOL: EXTEMPORANEOUS",
			"SYSTEM_READY",
		];
		
		const liveTelemetryNodes = [
			"PING_EXTERNAL_NODE_: ",
			"L402_MEMPOOL_SYNC: ",
			"PACKET_INSPECTED_OK: 0x",
			"QUARANTINE_THREAD_SLEEP: ",
			"WASI_0.2_HEARTBEAT: OK",
			"P2P_NODE_DISCOVERY: SCANNING",
			"SOROBAN_RPC_LATENCY: ",
			"EXTISM_PLUGIN_LIFECYCLE: ",
			"SOVEREIGN_ROUTING_HOP: "
		];

		let i = 0;
		let timeoutId: NodeJS.Timeout;

		const streamLogs = () => {
			if (i < bootLogs.length) {
				setLogs((prev) => [
					...prev.slice(-6),
					{ id: Date.now() + i, text: bootLogs[i] },
				]);
				i++;
				timeoutId = setTimeout(streamLogs, 300);
			} else {
				const randomLog = liveTelemetryNodes[Math.floor(Math.random() * liveTelemetryNodes.length)];
				const suffix = randomLog.endsWith(": ") ? Math.floor(Math.random() * 9999).toString(16).toUpperCase() + "ms" : "";
				
				setLogs((prev) => {
					const newArray = [...prev, { id: `${Date.now()}_${Math.random()}`, text: randomLog + suffix }];
					return newArray.length > 7 ? newArray.slice(newArray.length - 7) : newArray;
				});
				timeoutId = setTimeout(streamLogs, 800 + Math.random() * 2000);
			}
		};

		timeoutId = setTimeout(streamLogs, 300);
		return () => clearTimeout(timeoutId);
	}, []);

	// Lusion palette — always dark (only canvas inverts)
	const borderColor = hovered 
		? "rgba(255, 170, 0,0.4)"
		: "rgba(255,255,255,0.1)";
	// bgColor removed — Peachworlds glass uses inline values
	const textColor = hovered
		? "#ffaa00"
		: "rgba(255,255,255,0.6)";
	const headerColor = hovered
		? "#ffaa00"
		: "rgba(255,255,255,0.8)";
	const glowShadow = hovered
		? "0 0 25px rgba(255, 170, 0,0.2)"
		: "none";

	return (
		<div
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
			style={{
				position: "absolute",
				bottom: "clamp(1.5rem, 3vw, 3rem)",
				left: "clamp(1.5rem, 3vw, 3rem)",
				width: "clamp(20rem, 28vw, 32rem)",
				minHeight: "clamp(12rem, 16vw, 18rem)",
				background: hovered 
					? (theme === "dark" ? "rgba(0,15,0,0.4)" : "rgba(5,15,5,0.95)")
					: (theme === "dark" ? "rgba(255,255,255,0.06)" : "rgba(8,8,8,0.95)"),
				border: `1px solid ${borderColor}`,
				borderRadius: "0.75rem",
				padding: "clamp(1rem, 1.2vw, 1.5rem)",
				fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace",
				color: textColor,
				fontSize: "clamp(0.85rem, 0.9vw, 1.05rem)",
				overflow: "hidden",
				boxShadow: glowShadow,
				backdropFilter: hovered ? "blur(24px) saturate(1.4)" : "blur(24px) saturate(1.2)",
				WebkitBackdropFilter: hovered ? "blur(24px) saturate(1.4)" : "blur(24px) saturate(1.2)",
				zIndex: 20,
				transition: lusionTransition,
			}}
		>
			<div
				style={{
					borderBottom: `1px solid ${borderColor}`,
					paddingBottom: "0.5rem",
					marginBottom: "0.8rem",
					fontSize: "clamp(0.9rem, 1vw, 1.15rem)",
					fontWeight: 500,
					color: headerColor,
					transition: lusionTransition,
					letterSpacing: "0.05em",
				}}
			>
				&gt; SYS_TELEMETRY // [root@triarchy-gateway]
			</div>
			<div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
				{logs.map((logObj, i) => (
					<div
						key={logObj.id}
						style={{ 
							opacity: i === logs.length - 1 ? 0.9 : 0.4,
							transition: "opacity 0.3s",
						}}
					>
						{logObj.text}
					</div>
				))}
			</div>
		</div>
	);
}
