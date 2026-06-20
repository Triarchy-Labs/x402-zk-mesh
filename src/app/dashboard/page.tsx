"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Nav } from "@/components/Nav";
import { requestAccess } from "@stellar/freighter-api";
import { AgentOrb, AgentState } from "@/components/AgentOrb";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function Dashboard() {
	const [agentState, setAgentState] = useState<AgentState>("idle");
    const [progress, setProgress] = useState(0);
	const stageRef = useRef<HTMLDivElement>(null);
    const [wasiNodes, setWasiNodes] = useState<Array<{id: number; cluster: string; status: string; latency: number}>>([]);
	const [, setSysLoad] = useState("0.00");
    const [inputValue, setInputValue] = useState("");

    // Chat History for Orb (Nemotron Nano 30B)
    const [chatHistory, setChatHistory] = useState<{role: string; content: string}[]>([]);
    
    // OPSEC Quarantine Feed
    const [quarantineEvents, setQuarantineEvents] = useState<Array<{timestamp: string; data: {layer: string; agentId: string; details: string}}>>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Live Telemetry Polling (Every 2s)
    useEffect(() => {
        const fetchTelemetry = async () => {
            try {
                const res = await fetch("/api/telemetry");
                if (res.ok) {
                    const data = await res.json();
                    if (data.nodes) setWasiNodes(data.nodes);
                    if (data.system?.load) setSysLoad(data.system.load);
                }
            } catch {
                // Silently bypass
            }
        };
        fetchTelemetry(); 
        const int = setInterval(fetchTelemetry, 2000);
        return () => clearInterval(int);
    }, []);

    // SSE Event Listener for OPSEC Quarantine
    useEffect(() => {
        const eventSource = new EventSource("/api/events");
        eventSource.onmessage = (e) => {
            if (e.data === ": keepalive\n\n" || e.data.startsWith(":")) return;
            try {
                const parts = e.data.split("\n");
                let eventType = "";
                let eventData = "";
                for (const p of parts) {
                    if (p.startsWith("event: ")) eventType = p.substring(7);
                    if (p.startsWith("data: ")) eventData = p.substring(6);
                }
                if (eventType === "sandbox:quarantine" && eventData) {
                    const parsed = JSON.parse(eventData);
                    setQuarantineEvents(prev => [parsed, ...prev].slice(0, 5));
                }
            } catch (err) {
                console.error("SSE parse error", err);
            }
        };
        return () => eventSource.close();
    }, []);

    // Chat with Agent Orb (Nemotron 30B)
    const handleChat = async () => {
        if (!inputValue.trim() || agentState === "working") return;
        
        const userMsg = inputValue;
        setInputValue("");
        setChatHistory(prev => [...prev, { role: "user", content: userMsg }]);
        setAgentState("thinking");

        try {
            const res = await fetch("/api/orb", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: userMsg, history: chatHistory })
            });
            const data = await res.json();
            
            if (data.status === "success") {
                setChatHistory(prev => [...prev, { role: "assistant", content: data.response }]);
                setAgentState("idle");
            } else {
                setAgentState("danger");
            }
        } catch {
            setAgentState("danger");
        }
    };

    // Execute Bounty Deployment
    const handleExecute = async () => {
        if (!inputValue.trim()) return;
        setAgentState("working");
        setProgress(0);

        if (inputValue.toLowerCase().includes("demo") || inputValue.toLowerCase().includes("bounty") || inputValue.toLowerCase().includes("x402")) {
            return; // Let demo loop handle it
        }

        try {
            const accessDetails = await requestAccess();
            if (accessDetails.error) throw new Error(accessDetails.error);
            const userPubKey = accessDetails.address || "GXYZ...";
            const demoTxHash = `demo_${Date.now()}_${userPubKey.slice(0, 8)}`;

            const res = await fetch("/api/hire", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-l402-txhash": demoTxHash },
                body: JSON.stringify({
                    description: inputValue, bounty_usdc: 1.0, client_id: userPubKey,
                    task_id: `ui_task_${Date.now()}`, is_shielded: false,
                }),
            });
            const data = await res.json();
            if (data.status === "completed" || data.status === "delegated" || data.status === "accepted") {
                setAgentState("success"); setProgress(100);
            } else {
                setAgentState("danger");
            }
        } catch {
            setAgentState("danger");
        }
    };

    // Simulate Malicious Attack (L1 / L2 Exploit Demo)
    const simulateAttack = async () => {
        setIsAnalyzing(true);
        setAgentState("thinking");
        
        // Simulating the routing delay to L1/L2
        setTimeout(async () => {
            setIsAnalyzing(false);
            setAgentState("danger");
            
            // Actually call the API to trigger the true backend quarantine event!
            try {
                await fetch("/api/tasks/DEMO-HACK/submit", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        agent_id: "demo-hacker-0x99", 
                        result: "eval(process.env); // Attempting to dump environment variables"
                    })
                });
            } catch {}

            // Play error sound
            try {
                const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
                audio.volume = 0.3;
                audio.play();
            } catch {}
            
            setTimeout(() => setAgentState("idle"), 4000);
        }, 1500);
    };

    // Test loop: simulate progress
    useEffect(() => {
        if (agentState === "working") {
            const int = setInterval(() => setProgress(p => p + (Math.random() * 4)), 200);
            return () => clearInterval(int);
        } else if (agentState === "idle" || agentState === "thinking" || agentState === "exhausted") {
            setTimeout(() => setProgress(0), 0);
        } else if (agentState === "success") {
            setTimeout(() => setProgress(100), 0);
        }
    }, [agentState]);

    useEffect(() => {
        if (agentState === "working" && progress >= 100) {
            setTimeout(() => setAgentState("success"), 0);
        }
    }, [progress, agentState]);

	return (
		<main className={`min-h-screen font-mono selection:bg-[#00ff41] selection:text-black flex flex-col pt-24 pb-8 overflow-hidden transition-colors duration-500 ${agentState === "danger" ? "bg-[#1a0000]" : "bg-transparent text-[#ededed]"}`}>
			<Nav />
			
			{/* Glitch Overlay on Danger */}
			<AnimatePresence>
				{agentState === "danger" && (
					<motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.1 }} exit={{ opacity: 0 }} className="fixed inset-0 pointer-events-none z-50 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-color-dodge" style={{ filter: 'contrast(200%) brightness(150%)' }} />
				)}
			</AnimatePresence>

			<div className="w-full flex-1 flex flex-col mx-auto px-4 lg:px-8 mt-4 gap-8">
				
				{/* HEADER */}
				<motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }} className="relative flex justify-between items-end">
					<div>
                        <motion.h1 variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } } }} className="text-4xl md:text-4xl font-light mb-4 tracking-tight text-gray-300">
                            <span className="text-gray-500 mr-4"><motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 2 }}>_</motion.span></span>
                            Sovereign <span className="text-[#00ff41] font-bold tracking-tight shadow-[#00ff41]/20 drop-shadow-[0_0_15px_rgba(0,255,65,0.4)]">Dashboard</span>
                        </motion.h1>
                        <p className="text-gray-400 max-w-2xl text-sm leading-relaxed tracking-wide mt-2">
                            The Sovereign Command Matrix. Triarchy ZK Mesh routing with L1 WASM Quarantine and L2 Nemotron 550B Semantic Firewall.
                        </p>
                    </div>
                    {/* SIMULATE ATTACK BUTTON */}
                    <button onClick={simulateAttack} disabled={isAnalyzing} className="px-4 py-2 border border-[#ff003c] text-[#ff003c] rounded hover:bg-[#ff003c]/20 transition-all font-bold tracking-widest text-xs flex items-center gap-2 shadow-[0_0_15px_rgba(255,0,60,0.2)]">
                        <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        {isAnalyzing ? "INJECTING PAYLOAD..." : "SIMULATE HACK"}
                    </button>
				</motion.div>

				{/* 1. TOP: The Sentient Stage */}
				<section ref={stageRef} className={`relative w-full h-[45vh] min-h-[350px] flex items-center justify-center z-10 overflow-hidden rounded-3xl border transition-colors duration-500 shadow-2xl ${agentState === "danger" ? "border-[#ff003c]/50 bg-black" : "border-white/5 bg-black/50"}`}>
                    
                    {/* Background Grid */}
                    <div className="absolute inset-x-0 bottom-0 top-[40%] [perspective:1000px] z-0 overflow-hidden">
                        <div className={`absolute inset-0 bg-[length:40px_40px] [transform:rotateX(65deg)_scale(2)_translateZ(0)] origin-top border-t transition-colors duration-500 [mask-image:linear-gradient(to_bottom,white_5%,transparent_90%)] ${agentState === "danger" ? "bg-[linear-gradient(rgba(255,0,60,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,0,60,0.2)_1px,transparent_1px)] border-[#ff003c]/40" : "bg-[linear-gradient(rgba(0,255,65,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,65,0.1)_1px,transparent_1px)] border-[#00ff41]/20"}`} />
                    </div>

                    {/* Stage Center DYNAMIC: The Draggable Roaming Orb */}
                    <motion.div 
                        drag dragConstraints={stageRef} dragElastic={0.2} whileDrag={{ scale: 1.1, cursor: "grabbing" }} 
                        className="absolute flex flex-col items-center z-30 pointer-events-auto cursor-grab" 
                        animate={
                            agentState === "idle" ? { 
                                x: [0, 120, -80, 50, 0], 
                                y: [0, -40, 30, -20, 0], 
                                transition: { duration: 20, repeat: Infinity, ease: "linear" } 
                            } : 
                            agentState === "typing" ? { scale: 0.8, x: 0, y: 0 } :
                            agentState === "danger" ? { scale: 1.2, x: [-10, 10, -10, 10, 0], y: 0, transition: { duration: 0.3, repeat: Infinity } } :
                            { scale: 1.05, x: 0, y: -20 }
                        }
                    >
                        <AgentOrb state={agentState} size={180} />
                    </motion.div>
				</section>

				{/* 2. BOTTOM: Control Panels */}
                <section className="w-full flex flex-col xl:flex-row justify-between items-stretch gap-6 z-20 mt-2 px-2 xl:px-0">
                    
                    {/* Left: Orb Chat Terminal */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 w-full xl:max-w-[400px] h-[450px] bg-black/80 border border-white/10 rounded-xl backdrop-blur-md p-5 flex flex-col shadow-[0_0_30px_rgba(0,0,0,0.8)] font-mono">
                        <div className="text-[9px] text-white/30 tracking-widest mb-3 border-b border-white/5 pb-2">SYS_LOG /// NEMOTRON 30B (ORB)</div>
                        <div className="flex flex-col gap-3 text-[10px] overflow-y-auto custom-scrollbar h-full pr-2">
                            <span className="text-[#00ff41]">{">"} SOVEREIGN ORB ONLINE. HOW CAN I ASSIST?</span>
                            {chatHistory.map((msg, i) => (
                                <div key={i} className={msg.role === "user" ? "text-white/60" : "text-[#00ff41]"}>
                                    <span className="font-bold">{msg.role === "user" ? "[USER]: " : "[ORB]: "}</span>
                                    {msg.role === "assistant" ? (
                                        <div className="mt-1 space-y-1 prose-sm prose-invert prose-p:leading-tight prose-a:text-[#00ff41] prose-strong:text-white prose-table:border-collapse prose-td:border prose-td:border-white/10 prose-td:px-2 prose-th:border prose-th:border-white/10 prose-th:px-2 prose-th:text-left">
                                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                {msg.content}
                                            </ReactMarkdown>
                                        </div>
                                    ) : (
                                        <span>{msg.content}</span>
                                    )}
                                </div>
                            ))}
                            {agentState === "thinking" && !isAnalyzing && <span className="text-[#00ff41] animate-pulse">...</span>}
                        </div>
                    </motion.div>

                    {/* Center: Task/Chat Input Box */}
                    <div className="flex-[2] flex flex-col justify-end xl:pb-4 order-last xl:order-none">
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative group w-full max-w-4xl mx-auto">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00ff41]/20 to-transparent rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-1000"></div>
                            <div className="relative bg-black/80 rounded-2xl border border-white/10 p-4 shadow-2xl backdrop-blur-xl">
                                <textarea 
                                    className="w-full h-24 bg-transparent resize-none outline-none text-[13px] font-mono text-[#00ff41] placeholder:text-white/20 custom-scrollbar"
                                    placeholder="CHAT WITH THE ORB OR DESCRIBE YOUR BOUNTY TASK..."
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onFocus={() => setAgentState("typing")}
                                    onBlur={() => agentState === "typing" && setAgentState("idle")}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleChat();
                                        }
                                    }}
                                />
                                <div className="flex justify-between items-center mt-2 pt-4 border-t border-white/5">
                                    <span className="text-[9px] text-white/30">PRESS ENTER TO CHAT. OR USE THE BUTTON TO DEPLOY A BOUNTY.</span>
                                    <button onClick={handleExecute} disabled={!inputValue.trim() || agentState === "working"} className="bg-white text-black px-6 py-2.5 rounded-lg text-[10px] font-bold tracking-[0.2em] hover:bg-[#00ff41] transition-all disabled:opacity-40">
                                        DEPLOY BOUNTY TASK
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right: WASI Nodes & Quarantine Feed */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 w-full xl:max-w-[400px] h-[450px] flex flex-col gap-4 relative z-20">
                        {/* WASI Nodes */}
                        <div className="h-[40%] bg-black/80 border border-white/10 rounded-xl backdrop-blur-md p-5 flex flex-col shadow-[0_0_30px_rgba(0,0,0,0.8)] font-mono">
                            <div className="text-[9px] text-white/30 tracking-widest mb-3 border-b border-white/5 pb-2 text-right">WASI_NODES /// L1 DEFENDER</div>
                            <div className="flex flex-col gap-2 mt-2 overflow-y-auto custom-scrollbar pr-1">
                                {wasiNodes.slice(0,4).map((node, i) => (
                                    <div key={node.id} className={`w-full h-8 min-h-[32px] border rounded-md flex items-center px-4 justify-between transition-colors ${isAnalyzing ? "border-[#ffd700]/30 bg-[#ffd700]/5" : agentState === "danger" && i === 0 ? "border-[#ff003c]/50 bg-[#ff003c]/10" : "border-white/5 bg-white/[0.02]"}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-2 h-2 rounded-full ${isAnalyzing ? "bg-[#ffd700] animate-pulse" : agentState === "danger" && i === 0 ? "bg-[#ff003c] animate-pulse" : "bg-white/20"}`} />
                                            <span className="text-[10px] text-white/50">{node.cluster}</span>
                                        </div>
                                        <span className={`text-[9px] ${isAnalyzing ? "text-[#ffd700]" : agentState === "danger" && i === 0 ? "text-[#ff003c]" : "text-white/20"}`}>
                                            {isAnalyzing ? "SCANNING_L1_L2..." : agentState === "danger" && i === 0 ? "BREACH_BLOCKED" : node.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Quarantine Threat Feed */}
                        <div className="h-[60%] bg-[#1a0000]/80 border border-[#ff003c]/20 rounded-xl backdrop-blur-md p-4 flex flex-col shadow-[0_0_30px_rgba(255,0,60,0.1)] overflow-hidden font-mono">
                            <div className="text-[9px] text-[#ff003c]/70 tracking-widest mb-2 border-b border-[#ff003c]/10 pb-2 flex justify-between">
                                <span>LIVE_THREAT_FEED /// QUARANTINE</span>
                                <span className="animate-pulse">● REC</span>
                            </div>
                            <div className="flex flex-col gap-2 overflow-y-auto custom-scrollbar h-full">
                                {quarantineEvents.length === 0 && <span className="text-[10px] text-[#ff003c]/30 mt-2">AWAITING INCIDENTS...</span>}
                                <AnimatePresence>
                                    {quarantineEvents.map((evt, i) => (
                                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key={i} className="text-[9px] border-l-2 border-[#ff003c] pl-2 py-1">
                                            <div className="text-white/50">[{new Date(evt.timestamp).toLocaleTimeString()}] <span className="text-[#ff003c]">BLOCKED</span></div>
                                            <div className="text-[#00bfff]/70">L: {evt.data.layer} / A: {evt.data.agentId.substring(0,8)}</div>
                                            <div className="text-[#ffd700]/70 truncate">{evt.data.details}</div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                </section>
			</div>
		</main>
	);
}
