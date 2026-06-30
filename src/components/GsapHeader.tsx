"use client";

import React, { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

interface GsapHeaderProps {
	title: string;
	accentTitle?: string;
	subtitle: string;
	accentColor?: string;
}

export const GsapHeader: React.FC<GsapHeaderProps> = ({
	title,
	accentTitle,
	subtitle,
	accentColor = "#e0a922",
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const titleRef = useRef<HTMLHeadingElement>(null);
	const subtitleRef = useRef<HTMLParagraphElement>(null);

	useGSAP(() => {
		const ctx = gsap.context(() => {
			// 1. Animate Title characters (clip slide-up reveal)
			const chars = titleRef.current?.querySelectorAll(".char-inner");
			if (chars && chars.length > 0) {
				gsap.fromTo(
					chars,
					{ yPercent: 100, rotate: 3, opacity: 0 },
					{
						yPercent: 0,
						rotate: 0,
						opacity: 1,
						duration: 1.2,
						stagger: 0.02,
						ease: "expo.out",
					}
				);
			}

			// 2. Animate Subtitle (fade and soft slide-up)
			if (subtitleRef.current) {
				gsap.fromTo(
					subtitleRef.current,
					{ opacity: 0, y: 15 },
					{
						opacity: 1,
						y: 0,
						duration: 1.4,
						delay: 0.4,
						ease: "power3.out",
					}
				);
			}
		}, containerRef);

		return () => ctx.revert();
	}, { scope: containerRef });

	// Helper to split text into words and chars
	const renderSplitText = (text: string, isAccent = false) => {
		return text.split(" ").map((word, wordIdx) => (
			<span
				key={wordIdx}
				style={{
					display: "inline-block",
					whiteSpace: "nowrap",
					marginRight: "0.25em",
				}}
			>
				{word.split("").map((char, charIdx) => (
					<span
						key={charIdx}
						style={{
							display: "inline-block",
							overflow: "hidden",
							verticalAlign: "bottom",
							paddingBottom: "0.05em",
						}}
					>
						<span
							className="char-inner"
							style={{
								display: "inline-block",
								transformOrigin: "bottom left",
								color: isAccent ? accentColor : "inherit",
								fontWeight: isAccent ? 600 : 300,
							}}
						>
							{char}
						</span>
					</span>
				))}
			</span>
		));
	};

	return (
		<div ref={containerRef} style={{ marginBottom: "3rem" }}>
			<h1
				ref={titleRef}
				style={{
					fontSize: "5rem",
					lineHeight: "1.1",
					letterSpacing: "-0.02em",
					marginBottom: "1rem",
					display: "flex",
					flexWrap: "wrap",
					alignItems: "baseline",
				}}
			>
				<span style={{ color: "rgba(255,255,255,0.2)", marginRight: "0.5rem", fontWeight: 300 }}>_</span>
				{renderSplitText(title, false)}
				{accentTitle && renderSplitText(accentTitle, true)}
			</h1>
			<p
				ref={subtitleRef}
				style={{
					color: "rgba(255,255,255,0.5)",
					fontSize: "1.6rem",
					lineHeight: "1.5",
					maxWidth: "86rem",
				}}
			>
				{subtitle}
			</p>
		</div>
	);
};
