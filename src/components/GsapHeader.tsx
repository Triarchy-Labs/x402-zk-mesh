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
			// 1. Animate Title characters (clip slide-up reveal + rotation + x offset)
			const chars = titleRef.current?.querySelectorAll(".char-inner");
			if (chars && chars.length > 0) {
				gsap.fromTo(
					chars,
					{ 
						yPercent: 105, 
						rotate: 8, 
						opacity: 0,
						x: 12,
					},
					{
						yPercent: 0,
						rotate: 0,
						opacity: 1,
						x: 0,
						duration: 1.8,
						stagger: 0.035,
						delay: 0.8, // deliberate premium delay after mount
						ease: "power4.out",
					}
				);
			}

			// 2. Animate Parent Letter Spacing (gradual expanding expansion/settle)
			if (titleRef.current) {
				gsap.fromTo(
					titleRef.current,
					{ letterSpacing: "0.25em" },
					{
						letterSpacing: "-0.02em",
						duration: 2.2,
						delay: 0.8,
						ease: "power4.out",
					}
				);
			}

			// 3. Animate Subtitle (graceful delayed fade and slide-up)
			if (subtitleRef.current) {
				gsap.fromTo(
					subtitleRef.current,
					{ opacity: 0, y: 15 },
					{
						opacity: 1,
						y: 0,
						duration: 1.6,
						delay: 1.4, // reveals after title is well underway
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
							paddingBottom: "0.08em",
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
