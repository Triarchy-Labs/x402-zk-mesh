"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";

export default function BootSequence({ onComplete }: { onComplete: () => void }) {
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		let current = 0;
		const interval = setInterval(() => {
			// Organic nonlinear progress speed: snap fast, slow down in the middle to read, finish fast
			let step = 0;
			if (current < 30) {
				step = Math.floor(Math.random() * 4) + 2; // Fast start
			} else if (current < 75) {
				step = Math.floor(Math.random() * 2) + 1; // Slow down in the middle to read keywords
			} else {
				step = Math.floor(Math.random() * 5) + 3; // Fast finish
			}
			
			current += step;
			if (current >= 100) {
				current = 100;
				clearInterval(interval);
				setTimeout(() => onComplete(), 500); // Tiny hold at 100% then trigger curtain reveal
			}
			setProgress(current);
		}, 40);

		return () => clearInterval(interval);
	}, [onComplete]);

	return (
		<motion.div
			style={{
				position: "fixed",
				inset: 0,
				zIndex: 99999,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				color: "rgba(255,255,255,0.85)",
				fontFamily: "monospace",
				pointerEvents: "auto",
			}}
			exit={{ pointerEvents: "none" }}
		>
			{/* Top Shutter (Curtain) */}
			<motion.div
				style={{
					position: "absolute",
					top: 0, left: 0, right: 0,
					height: "50vh",
					background: "#010201",
					borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
					zIndex: 1,
				}}
				exit={{ y: "-100%" }}
				transition={{ duration: 1.0, ease: [0.76, 0, 0.24, 1] }} // Snappy Awwwards easing
			/>

			{/* Bottom Shutter (Curtain) */}
			<motion.div
				style={{
					position: "absolute",
					bottom: 0, left: 0, right: 0,
					height: "50vh",
					background: "#010201",
					borderTop: "1px solid rgba(255, 255, 255, 0.05)",
					zIndex: 1,
				}}
				exit={{ y: "100%" }}
				transition={{ duration: 1.0, ease: [0.76, 0, 0.24, 1] }} // Snappy Awwwards easing
			/>

			{/* Loading Content */}
			<motion.div
				style={{
					zIndex: 10,
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
				}}
				exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
				transition={{ duration: 0.4, ease: "easeIn" }}
			>
				<motion.div
					initial={{ opacity: 0, scale: 0.8 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.5 }}
					style={{ 
						fontSize: "8vw", 
						fontWeight: "bold", 
						textShadow: "0 0 40px rgba(255,255,255,0.85)",
						letterSpacing: "-0.05em"
					}}
				>
					{progress}%
				</motion.div>
				
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					style={{
						marginTop: "2rem",
						width: "300px",
						height: "2px",
						background: "rgba(255, 255, 255, 0.2)",
						position: "relative",
						overflow: "hidden"
					}}
				>
					<div style={{
						position: "absolute",
						top: 0, left: 0, bottom: 0,
						width: `${progress}%`,
						background: "rgba(255,255,255,0.85)",
						boxShadow: "0 0 15px rgba(255,255,255,0.85)",
						transition: "width 0.1s linear"
					}} />
				</motion.div>

				<motion.div 
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					style={{ 
						marginTop: "1.5rem", 
						letterSpacing: "0.2em", 
						fontSize: "1.2rem", 
						color: "rgba(255, 255, 255, 0.6)" 
					}}
				>
					{progress > 75
						? "SETTLING STELLAR MESH TRANSACTION..."
						: progress > 50
						? "CONFIGURING X402 GATEWAY..."
						: progress > 25
						? "ESTABLISHING AI SWARM MESH..."
						: "INITIALIZING ZK TRUST SYSTEMS..."}
				</motion.div>
			</motion.div>
		</motion.div>
	);
}
