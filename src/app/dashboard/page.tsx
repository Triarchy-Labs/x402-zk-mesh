"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Nav } from "@/components/Nav";
import { requestAccess, isConnected as checkFreighterConnected } from "@stellar/freighter-api";
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
    const [openMessageIndex, setOpenMessageIndex] = useState<number>(-1);
    const [archivedSessions, setArchivedSessions] = useState<{id: string, date: string, preview: string, messages: {role: string; content: string}[]}[]>([]);
    const [showArchives, setShowArchives] = useState(false);
    const [walletId, setWalletId] = useState<string>("guest");
    
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

    // Wallet Initialization
    useEffect(() => {
        const fetchWallet = async () => {
            try {
                const { isConnected } = await checkFreighterConnected();
                if (isConnected) {
                    const access = await requestAccess();
                    if (access.address) setWalletId(access.address);
                }
            } catch {}
        };
        fetchWallet();
    }, []);

    // LocalStorage Session Management
    const currentChatKey = `x402_current_chat_${walletId}`;
    const archivesKey = `x402_archived_chats_${walletId}`;

    useEffect(() => {
        const savedChat = localStorage.getItem(currentChatKey);
        if (savedChat) {
            const parsed = JSON.parse(savedChat);
            setChatHistory(parsed);
            setOpenMessageIndex(parsed.length - 1);
        } else {
            setChatHistory([]);
            setOpenMessageIndex(-1);
        }
        
        const savedArchives = localStorage.getItem(archivesKey);
        if (savedArchives) {
            setArchivedSessions(JSON.parse(savedArchives));
        } else {
            setArchivedSessions([]);
        }
    }, [walletId]);

    useEffect(() => {
        if (chatHistory.length > 0) {
            localStorage.setItem(currentChatKey, JSON.stringify(chatHistory));
        } else {
            localStorage.removeItem(currentChatKey);
        }
    }, [chatHistory, currentChatKey]);

    const startNewSession = () => {
        if (chatHistory.length === 0) return;
        const preview = chatHistory.find(m => m.role === "user")?.content || "System interaction";
        const newSession = {
            id: Date.now().toString(),
            date: new Date().toLocaleString(),
            preview: preview.length > 40 ? preview.slice(0, 40) + "..." : preview,
            messages: chatHistory
        };
        const updatedArchives = [newSession, ...archivedSessions];
        setArchivedSessions(updatedArchives);
        localStorage.setItem(archivesKey, JSON.stringify(updatedArchives));
        
        setChatHistory([]);
        setOpenMessageIndex(-1);
    };

    const loadSession = (id: string) => {
        const session = archivedSessions.find(s => s.id === id);
        if (session) {
            setChatHistory(session.messages);
            setOpenMessageIndex(session.messages.length - 1);
            setShowArchives(false);
        }
    };

    const purgeAllLogs = () => {
        setChatHistory([]);
        setArchivedSessions([]);
        setOpenMessageIndex(-1);
        localStorage.removeItem(currentChatKey);
        localStorage.removeItem(archivesKey);
        setShowArchives(false);
    };

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
                setChatHistory(prev => {
                    const newHist = [...prev, { role: "assistant", content: data.response }];
                    setOpenMessageIndex(newHist.length - 1);
                    return newHist;
                });
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
		<main className={`min-h-screen font-mono selection:bg-[#00ff41] selection:text-black flex flex-col pt-[12rem] pb-[4rem] overflow-hidden transition-colors duration-500 ${agentState === "danger" ? "bg-[#1a0000]" : "bg-transparent text-[#ededed]"}`}>
			<Nav />
			
			{/* Glitch Overlay on Danger */}
			<AnimatePresence>
				{agentState === "danger" && (
					<motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.1 }} exit={{ opacity: 0 }} className="fixed inset-0 pointer-events-none z-50 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-color-dodge" style={{ filter: 'contrast(200%) brightness(150%)' }} />
				)}
			</AnimatePresence>

			<div className="w-full flex-1 flex flex-col mx-auto px-[5vw] mt-[2rem] gap-[4rem]">
				
				{/* HEADER */}
				<motion.div initial="hidden" animate="visible" variants={{ hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.1 } } }} className="relative flex justify-between items-end">
					<div>
                        <motion.h1 variants={{ hidden: { opacity: 0, x: -20 }, visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: "easeOut" } } }} className="text-[4rem] md:text-[5rem] font-light mb-[2rem] tracking-tight text-gray-300">
                            <span className="text-gray-500 mr-[2rem]"><motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 2 }}>_</motion.span></span>
                            Sovereign <span className="text-[#00ff41] font-bold tracking-tight shadow-[#00ff41]/20 drop-shadow-[0_0_15px_rgba(0,255,65,0.4)]">Dashboard</span>
                        </motion.h1>
                        <p className="text-gray-400 max-w-2xl text-[1.4rem] leading-relaxed tracking-wide mt-[1rem]">
                            The Sovereign Command Matrix. Triarchy ZK Mesh routing with L1 WASM Quarantine and L2 Nemotron 550B Semantic Firewall.
                        </p>
                    </div>
                    {/* SIMULATE ATTACK BUTTON */}
                    <button onClick={simulateAttack} disabled={isAnalyzing} className="px-[2rem] py-[1rem] border border-[#ff003c] text-[#ff003c] rounded hover:bg-[#ff003c]/20 transition-all font-bold tracking-widest text-[1.2rem] flex items-center gap-[1rem] shadow-[0_0_15px_rgba(255,0,60,0.2)]">
                        <svg className="w-[1.6rem] h-[1.6rem] animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
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
                <section className="w-full flex flex-col lg:flex-row gap-6 z-20 mt-4 px-2 xl:px-0">
                    
                    {/* Left Column (70%): Chat Log & Input */}
                    <div className="flex-[7] flex flex-col gap-4 w-full lg:h-[60rem]">
                        {/* Chat Log */}
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex-1 bg-black/80 border border-white/10 rounded-xl backdrop-blur-md p-[2rem] flex flex-col shadow-[0_0_30px_rgba(0,0,0,0.8)] font-mono min-h-[30rem]">
                            <div className="flex justify-between items-center text-[1.2rem] text-white/30 tracking-widest mb-[1.5rem] border-b border-white/5 pb-[1rem]">
                                <span>SYS_LOG /// NEMOTRON 30B (ORB) {walletId !== "guest" && <span className="text-[#00ff41] ml-2">[{walletId.substring(0,6)}...{walletId.substring(walletId.length-4)}]</span>}</span>
                                <div className="flex gap-4">
                                    <button onClick={() => setShowArchives(!showArchives)} className="hover:text-[#00ff41] transition-colors font-bold">
                                        {showArchives ? "[CLOSE ARCHIVE]" : "[ARCHIVE]"}
                                    </button>
                                    <button onClick={startNewSession} className="hover:text-[#00bfff] transition-colors font-bold" disabled={chatHistory.length === 0} style={{ opacity: chatHistory.length === 0 ? 0.3 : 1 }}>
                                        [NEW SESSION]
                                    </button>
                                    <button onClick={purgeAllLogs} className="hover:text-[#ff003c] transition-colors font-bold">
                                        [PURGE ALL]
                                    </button>
                                </div>
                            </div>
                            
                            {showArchives ? (
                                <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-2">
                                    {archivedSessions.length === 0 ? (
                                        <div className="text-white/30 text-[1.2rem] italic">No archived sessions.</div>
                                    ) : (
                                        archivedSessions.map(session => (
                                            <div key={session.id} className="p-[1rem] border border-white/10 rounded-lg hover:border-[#00ff41]/50 cursor-pointer transition-colors bg-black/50" onClick={() => loadSession(session.id)}>
                                                <div className="text-[#00ff41] text-[1.2rem] font-bold">{session.date}</div>
                                                <div className="text-white/60 text-[1.3rem] mt-1 line-clamp-2">{session.preview}</div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            ) : (
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 flex flex-col gap-3 text-[1.3rem]" data-lenis-prevent>
                                <span className="text-[#00ff41]">{">"} SOVEREIGN ORB ONLINE. HOW CAN I ASSIST?</span>
                                {chatHistory.map((msg, i) => (
                                    <div key={i} className={msg.role === "user" ? "text-white/60" : "text-[#00ff41]"}>
                                        {msg.role === "assistant" ? (
                                            <details className="group" open={openMessageIndex === i}>
                                                <summary 
                                                    className="cursor-pointer list-none text-[#00ff41] font-bold focus:outline-none hover:text-[#b3ffc4] transition-colors flex items-center gap-2"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setOpenMessageIndex(openMessageIndex === i ? -1 : i);
                                                    }}
                                                >
                                                    <span className="text-[1rem] opacity-50 group-open:rotate-90 transition-transform">▶</span>
                                                    [ORB]:
                                                </summary>
                                                <div className="mt-2 space-y-1 prose-lg prose-invert prose-p:leading-tight prose-a:text-[#00ff41] prose-strong:text-white prose-table:border-collapse prose-td:border prose-td:border-white/10 prose-td:px-2 prose-th:border prose-th:border-white/10 prose-th:px-2 prose-th:text-left pl-3 border-l border-white/10 ml-[4px]">
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                </div>
                                            </details>
                                        ) : (
                                            <>
                                                <span className="font-bold">[USER]: </span>
                                                <span>{msg.content}</span>
                                            </>
                                        )}
                                    </div>
                                ))}
                                {agentState === "thinking" && !isAnalyzing && <span className="text-[#00ff41] animate-pulse">...</span>}
                            </div>
                            )}
                        </motion.div>

                        {/* Input Box */}
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="relative group w-full flex-none">
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-[#00ff41]/20 to-transparent rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-1000"></div>
                            <div className="relative bg-black/80 rounded-2xl border border-white/10 p-4 shadow-2xl backdrop-blur-xl">
                                <textarea 
                                    className="w-full h-[12rem] bg-transparent resize-none outline-none text-[1.5rem] font-mono text-[#00ff41] placeholder:text-white/20 custom-scrollbar"
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
                                    <span className="text-[1.2rem] text-white/30">PRESS ENTER TO CHAT. OR USE THE BUTTON TO DEPLOY A BOUNTY.</span>
                                    <button onClick={handleExecute} disabled={!inputValue.trim() || agentState === "working"} className="bg-white text-black px-[3rem] py-[1.5rem] rounded-lg text-[1.3rem] font-bold tracking-[0.2em] hover:bg-[#00ff41] transition-all disabled:opacity-40">
                                        DEPLOY BOUNTY TASK
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right Column (30%): WASI Nodes & Quarantine Feed */}
                    <div className="flex-[3] flex flex-col gap-4 w-full lg:max-w-[42rem] lg:h-[60rem]">
                        {/* WASI Nodes */}
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 bg-black/80 border border-white/10 rounded-xl backdrop-blur-md p-[2rem] flex flex-col shadow-[0_0_30px_rgba(0,0,0,0.8)] font-mono min-h-[20rem]">
                            <div className="text-[1.2rem] text-white/30 tracking-widest mb-3 border-b border-white/5 pb-2 text-right">WASI_NODES /// L1 DEFENDER</div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-2">
                                {wasiNodes.slice(0,4).map((node, i) => (
                                    <div key={node.id} className={`w-full h-[4rem] min-h-[4rem] border rounded-md flex items-center px-[2rem] justify-between transition-colors ${isAnalyzing ? "border-[#ffd700]/30 bg-[#ffd700]/5" : agentState === "danger" && i === 0 ? "border-[#ff003c]/50 bg-[#ff003c]/10" : "border-white/5 bg-white/[0.02]"}`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`w-[1rem] h-[1rem] rounded-full ${isAnalyzing ? "bg-[#ffd700] animate-pulse" : agentState === "danger" && i === 0 ? "bg-[#ff003c] animate-pulse" : "bg-white/20"}`} />
                                            <span className="text-[1.3rem] text-white/50">{node.cluster}</span>
                                        </div>
                                        <span className={`text-[1.2rem] ${isAnalyzing ? "text-[#ffd700]" : agentState === "danger" && i === 0 ? "text-[#ff003c]" : "text-white/20"}`}>
                                            {isAnalyzing ? "SCANNING_L1_L2..." : agentState === "danger" && i === 0 ? "BREACH_BLOCKED" : node.status}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>

                        {/* Quarantine Threat Feed */}
                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-[1.5] bg-[#1a0000]/80 border border-[#ff003c]/20 rounded-xl backdrop-blur-md p-[2rem] flex flex-col shadow-[0_0_30px_rgba(255,0,60,0.1)] overflow-hidden font-mono min-h-[25rem]">
                            <div className="text-[1.2rem] text-[#ff003c]/70 tracking-widest mb-2 border-b border-[#ff003c]/10 pb-2 flex justify-between">
                                <span>LIVE_THREAT_FEED /// QUARANTINE</span>
                                <span className="animate-pulse">● REC</span>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-2 pr-1">
                                {quarantineEvents.length === 0 && <span className="text-[1.3rem] text-[#ff003c]/30 mt-2">AWAITING INCIDENTS...</span>}
                                <AnimatePresence>
                                    {quarantineEvents.map((evt, i) => (
                                        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} key={i} className="text-[1.2rem] border-l-2 border-[#ff003c] pl-[1rem] py-[0.5rem]">
                                            <div className="text-white/50">[{new Date(evt.timestamp).toLocaleTimeString()}] <span className="text-[#ff003c]">BLOCKED</span></div>
                                            <div className="text-[#00bfff]/70">L: {evt.data.layer} / A: {evt.data.agentId.substring(0,8)}</div>
                                            <div className="text-[#ffd700]/70 truncate">{evt.data.details}</div>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    </div>
                </section>
			</div>
		</main>
	);
}
