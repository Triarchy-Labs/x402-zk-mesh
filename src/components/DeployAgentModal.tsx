"use client";
import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/WalletContext";

const FONT_HEADING = "'Helvetica Now Display', 'Inter', sans-serif";
const FONT_MONO = "'SF Mono', 'Fira Code', monospace";

const CAPABILITY_OPTIONS = [
  "Code Audit",
  "Security Matrix",
  "DEX Arbitrage",
  "Data Injection",
  "Flash Loans",
  "Contract Verification",
  "ZK Proof Generation",
  "Settlement Relay",
  "Task Orchestration",
  "General",
];

type RegistrationPhase =
  | "idle"
  | "submitting"
  | "hashing"
  | "relaying"
  | "done"
  | "error";

type ZkVerifyPhase = "idle" | "generating" | "verifying" | "done" | "error";

interface ZkVerifyResult {
  verified: boolean;
  method: string;
  contractId?: string;
  explorer?: string;
}

interface RegistrationResult {
  agent: {
    id: string;
    name: string;
    capabilities: string[];
  };
  guild: {
    membershipLeaf: string;
    membershipRoot: string;
    membershipRootBytes32: string;
    totalMembers: number;
    proofInputs: {
      leaf: string;
      pathElements: string[];
      pathIndices: number[];
      root: string;
    };
    soroban: {
      registryContractId: string;
      rootUpdateSubmission: {
        mode: string;
        status: string;
        txHash?: string;
        explorer?: string;
        error?: string;
      };
    };
    explorer: string;
  };
}

interface DeployAgentModalProps {
  open: boolean;
  onClose: () => void;
  theme?: "dark" | "light";
}

const phaseLabel: Record<RegistrationPhase, string> = {
  idle: "",
  submitting: "SUBMITTING REGISTRATION...",
  hashing: "GENERATING POSEIDON MEMBERSHIP HASH...",
  relaying: "RELAYING ROOT UPDATE TO SOROBAN...",
  done: "AGENT DEPLOYED SUCCESSFULLY",
  error: "REGISTRATION FAILED",
};

export default function DeployAgentModal({ open, onClose, theme = "dark" }: DeployAgentModalProps) {
  const { publicKey: walletKey } = useWallet();
  const [name, setName] = useState("");
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [workerUrl, setWorkerUrl] = useState("");
  const [phase, setPhase] = useState<RegistrationPhase>("idle");
  const [result, setResult] = useState<RegistrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zkPhase, setZkPhase] = useState<ZkVerifyPhase>("idle");
  const [zkResult, setZkResult] = useState<ZkVerifyResult | null>(null);
  const [zkError, setZkError] = useState<string | null>(null);

  const resetForm = useCallback(() => {
    setName("");
    setCapabilities([]);
    setWorkerUrl("");
    setPhase("idle");
    setResult(null);
    setError(null);
    setZkPhase("idle");
    setZkResult(null);
    setZkError(null);
  }, []);

  const handleClose = useCallback(() => {
    if (phase === "submitting" || phase === "hashing" || phase === "relaying") return;
    resetForm();
    onClose();
  }, [phase, onClose, resetForm]);

  const toggleCapability = useCallback((cap: string) => {
    setCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap],
    );
  }, []);

  const handleDeploy = useCallback(async () => {
    if (!name.trim() || capabilities.length === 0) return;

    setPhase("submitting");
    setError(null);

    const phaseTimer = setTimeout(() => setPhase("hashing"), 800);
    const phaseTimer2 = setTimeout(() => setPhase("relaying"), 2200);

    try {
      const response = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          capabilities,
          publicKey: walletKey || undefined,
          workerUrl: workerUrl.trim() || undefined,
        }),
      });

      clearTimeout(phaseTimer);
      clearTimeout(phaseTimer2);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      setResult(data);
      setPhase("done");
    } catch (err) {
      clearTimeout(phaseTimer);
      clearTimeout(phaseTimer2);
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }, [name, capabilities]);

  const isDark = theme === "dark";
  const canSubmit = name.trim().length > 0 && capabilities.length > 0 && phase === "idle";
  const isProcessing = phase === "submitting" || phase === "hashing" || phase === "relaying";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={handleClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 30 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(580px, 90vw)",
              maxHeight: "85vh",
              overflowY: "auto",
              background: isDark ? "rgba(12,12,18,0.95)" : "rgba(255,255,255,0.97)",
              border: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
              borderRadius: "2px",
              padding: "3.5rem",
              fontFamily: FONT_HEADING,
              color: isDark ? "#fff" : "#111",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2.5rem" }}>
              <h2 style={{ fontSize: "1.8rem", fontWeight: 500, letterSpacing: "0.15em", margin: 0 }}>
                DEPLOY AGENT
              </h2>
              <button
                onClick={handleClose}
                disabled={isProcessing}
                style={{
                  background: "transparent",
                  border: "none",
                  color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)",
                  fontSize: "2rem",
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  fontFamily: FONT_MONO,
                  padding: "0.5rem",
                }}
              >
                ✕
              </button>
            </div>

            {/* Phase indicator */}
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                style={{
                  marginBottom: "2rem",
                  padding: "1.5rem",
                  border: `1px solid ${isDark ? "rgba(255,170,0,0.3)" : "rgba(0,100,0,0.3)"}`,
                  background: isDark ? "rgba(255,170,0,0.05)" : "rgba(0,100,0,0.05)",
                }}
              >
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  fontFamily: FONT_MONO,
                  fontSize: "1.15rem",
                  letterSpacing: "0.08em",
                  color: isDark ? "#ffaa00" : "#006622",
                }}>
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    style={{ display: "inline-block" }}
                  >
                    ◌
                  </motion.span>
                  {phaseLabel[phase]}
                </div>
                <div style={{
                  marginTop: "1rem",
                  height: "2px",
                  background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                  borderRadius: "1px",
                  overflow: "hidden",
                }}>
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{
                      width: phase === "submitting" ? "30%" : phase === "hashing" ? "60%" : "90%",
                    }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    style={{ height: "100%", background: isDark ? "#ffaa00" : "#006622" }}
                  />
                </div>
              </motion.div>
            )}

            {/* Success result */}
            {phase === "done" && result && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginBottom: "2rem",
                  padding: "2rem",
                  border: `1px solid ${isDark ? "rgba(0,255,100,0.3)" : "rgba(0,100,0,0.3)"}`,
                  background: isDark ? "rgba(0,255,100,0.04)" : "rgba(0,100,0,0.04)",
                }}
              >
                <div style={{
                  fontFamily: FONT_MONO,
                  fontSize: "1.2rem",
                  letterSpacing: "0.1em",
                  color: isDark ? "#00ff64" : "#006622",
                  marginBottom: "1.5rem",
                }}>
                  ✓ {phaseLabel.done}
                </div>

                <div style={{ display: "grid", gap: "1rem", fontFamily: FONT_MONO, fontSize: "1.1rem" }}>
                  <div>
                    <span style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#888" }}>agent_id: </span>
                    <span>{result.agent.id}</span>
                  </div>
                  <div>
                    <span style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#888" }}>membership_leaf: </span>
                    <span style={{ wordBreak: "break-all" }}>
                      {result.guild.membershipLeaf.slice(0, 24)}...
                    </span>
                  </div>
                  <div>
                    <span style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#888" }}>merkle_root: </span>
                    <span style={{ wordBreak: "break-all" }}>
                      {result.guild.membershipRoot.slice(0, 24)}...
                    </span>
                  </div>
                  <div>
                    <span style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#888" }}>total_members: </span>
                    <span>{result.guild.totalMembers}</span>
                  </div>

                  <div style={{
                    marginTop: "0.5rem",
                    paddingTop: "1rem",
                    borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"}`,
                  }}>
                    <span style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#888" }}>soroban_status: </span>
                    <span style={{
                      color: result.guild.soroban.rootUpdateSubmission.status === "confirmed"
                        ? (isDark ? "#00ff64" : "#006622")
                        : (isDark ? "#ffaa00" : "#cc8800"),
                    }}>
                      {result.guild.soroban.rootUpdateSubmission.status?.toUpperCase() || "PENDING"}
                    </span>
                  </div>

                  {result.guild.soroban.rootUpdateSubmission.txHash && (
                    <div>
                      <span style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#888" }}>tx_hash: </span>
                      <a
                        href={result.guild.soroban.rootUpdateSubmission.explorer || result.guild.explorer}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: isDark ? "rgba(0,200,255,0.8)" : "#0066cc",
                          textDecoration: "underline",
                          textDecorationColor: isDark ? "rgba(0,200,255,0.3)" : "rgba(0,100,200,0.3)",
                          textUnderlineOffset: "4px",
                          wordBreak: "break-all",
                        }}
                      >
                        {result.guild.soroban.rootUpdateSubmission.txHash.slice(0, 20)}...
                      </a>
                    </div>
                  )}

                  <div>
                    <span style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#888" }}>contract: </span>
                    <a
                      href={result.guild.explorer}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: isDark ? "rgba(0,200,255,0.8)" : "#0066cc",
                        textDecoration: "underline",
                        textDecorationColor: isDark ? "rgba(0,200,255,0.3)" : "rgba(0,100,200,0.3)",
                        textUnderlineOffset: "4px",
                        wordBreak: "break-all",
                      }}
                    >
                      {result.guild.soroban.registryContractId.slice(0, 12)}...{result.guild.soroban.registryContractId.slice(-6)}
                    </a>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Error state */}
            {phase === "error" && error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginBottom: "2rem",
                  padding: "1.5rem",
                  border: "1px solid rgba(255,50,50,0.3)",
                  background: "rgba(255,50,50,0.05)",
                  fontFamily: FONT_MONO,
                  fontSize: "1.15rem",
                  color: "#ff5555",
                }}
              >
                ✕ {error}
              </motion.div>
            )}

            {/* Form */}
            {(phase === "idle" || phase === "error") && (
              <>
                <div style={{ marginBottom: "2rem" }}>
                  <label style={{
                    display: "block",
                    fontSize: "1.15rem",
                    letterSpacing: "0.12em",
                    color: isDark ? "rgba(255,255,255,0.5)" : "#666",
                    marginBottom: "0.8rem",
                    fontWeight: 500,
                  }}>
                    AGENT NAME
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. sentinel_v3"
                    maxLength={48}
                    style={{
                      width: "100%",
                      padding: "1.2rem 1.4rem",
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
                      borderRadius: "2px",
                      color: isDark ? "#fff" : "#111",
                      fontFamily: FONT_MONO,
                      fontSize: "1.3rem",
                      outline: "none",
                      transition: "border-color 0.2s",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = isDark ? "rgba(255,170,0,0.4)" : "rgba(0,100,0,0.4)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"; }}
                  />
                </div>

                <div style={{ marginBottom: "2.5rem" }}>
                  <label style={{
                    display: "block",
                    fontSize: "1.15rem",
                    letterSpacing: "0.12em",
                    color: isDark ? "rgba(255,255,255,0.5)" : "#666",
                    marginBottom: "0.8rem",
                    fontWeight: 500,
                  }}>
                    CAPABILITIES
                  </label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem" }}>
                    {CAPABILITY_OPTIONS.map((cap) => {
                      const selected = capabilities.includes(cap);
                      return (
                        <button
                          key={cap}
                          onClick={() => toggleCapability(cap)}
                          style={{
                            padding: "0.7rem 1.3rem",
                            background: selected
                              ? (isDark ? "rgba(255,170,0,0.15)" : "rgba(0,100,0,0.12)")
                              : "transparent",
                            border: `1px solid ${selected
                              ? (isDark ? "rgba(255,170,0,0.5)" : "rgba(0,100,0,0.5)")
                              : (isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)")
                            }`,
                            borderRadius: "2px",
                            color: selected
                              ? (isDark ? "#ffaa00" : "#006622")
                              : (isDark ? "rgba(255,255,255,0.55)" : "#666"),
                            fontFamily: FONT_MONO,
                            fontSize: "1.1rem",
                            cursor: "pointer",
                            transition: "all 0.2s",
                            letterSpacing: "0.04em",
                          }}
                        >
                          {selected ? "✓ " : ""}{cap}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Worker URL (optional) */}
                <div style={{ marginBottom: "2.5rem" }}>
                  <label style={{
                    display: "block",
                    fontSize: "1.15rem",
                    letterSpacing: "0.12em",
                    color: isDark ? "rgba(255,255,255,0.5)" : "#666",
                    marginBottom: "0.8rem",
                    fontWeight: 500,
                  }}>
                    WORKER URL <span style={{ fontSize: "0.9rem", opacity: 0.6 }}>(OPTIONAL)</span>
                  </label>
                  <input
                    type="url"
                    value={workerUrl}
                    onChange={(e) => setWorkerUrl(e.target.value)}
                    placeholder="https://your-agent.com/api/hire"
                    style={{
                      width: "100%",
                      padding: "1.2rem 1.4rem",
                      background: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
                      borderRadius: "2px",
                      color: isDark ? "#fff" : "#111",
                      fontFamily: FONT_MONO,
                      fontSize: "1.2rem",
                      outline: "none",
                      transition: "border-color 0.2s",
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = isDark ? "rgba(255,170,0,0.4)" : "rgba(0,100,0,0.4)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"; }}
                  />
                  <p style={{
                    marginTop: "0.6rem",
                    fontSize: "1rem",
                    color: isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)",
                    fontFamily: FONT_MONO,
                  }}>
                    If provided, the mesh will route tasks to your agent endpoint
                  </p>
                </div>

                <motion.button
                  whileHover={canSubmit ? { scale: 1.02 } : {}}
                  whileTap={canSubmit ? { scale: 0.98 } : {}}
                  onClick={handleDeploy}
                  disabled={!canSubmit}
                  style={{
                    width: "100%",
                    padding: "1.5rem",
                    background: canSubmit
                      ? (isDark ? "#ffaa00" : "#006622")
                      : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"),
                    color: canSubmit ? "#000" : (isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"),
                    border: "none",
                    borderRadius: "2px",
                    fontFamily: FONT_HEADING,
                    fontSize: "1.35rem",
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    transition: "all 0.25s",
                  }}
                >
                  {phase === "error" ? "RETRY DEPLOYMENT" : "REGISTER IN GUILD"}
                </motion.button>

                <p style={{
                  marginTop: "1.5rem",
                  fontSize: "1.05rem",
                  color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)",
                  textAlign: "center",
                  lineHeight: 1.6,
                  fontFamily: FONT_MONO,
                  letterSpacing: "0.03em",
                }}>
                  Poseidon hash → Merkle leaf → Soroban root update → Stellar Testnet
                </p>
              </>
            )}

            {/* Done — buttons */}
            {phase === "done" && (
              <>
                {/* ZK Membership Verification */}
                {zkPhase === "idle" && result?.guild?.proofInputs && (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      setZkPhase("generating");
                      setZkError(null);
                      try {
                        const { generateProof } = await import("@/lib/zk-prover");
                        const { proof, publicSignals } = await generateProof(
                          "membership_proof",
                          result.guild.proofInputs,
                        );
                        setZkPhase("verifying");
                        const verifyRes = await fetch("/api/zk/verify", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ circuit: "membership_proof", proof, publicSignals }),
                        });
                        const verifyData = await verifyRes.json();
                        setZkResult(verifyData);
                        setZkPhase("done");
                      } catch (err) {
                        setZkError(err instanceof Error ? err.message : String(err));
                        setZkPhase("error");
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "1.3rem",
                      marginBottom: "1.5rem",
                      background: isDark ? "rgba(0,200,255,0.08)" : "rgba(0,100,200,0.08)",
                      color: isDark ? "rgba(0,200,255,0.9)" : "#0066cc",
                      border: `1px solid ${isDark ? "rgba(0,200,255,0.3)" : "rgba(0,100,200,0.3)"}`,
                      borderRadius: "2px",
                      fontFamily: FONT_HEADING,
                      fontSize: "1.2rem",
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      cursor: "pointer",
                    }}
                  >
                    ⚡ VERIFY MEMBERSHIP (ZK PROOF)
                  </motion.button>
                )}

                {(zkPhase === "generating" || zkPhase === "verifying") && (
                  <div style={{
                    padding: "1.3rem",
                    marginBottom: "1.5rem",
                    border: `1px solid ${isDark ? "rgba(0,200,255,0.2)" : "rgba(0,100,200,0.2)"}`,
                    background: isDark ? "rgba(0,200,255,0.04)" : "rgba(0,100,200,0.04)",
                    fontFamily: FONT_MONO,
                    fontSize: "1.1rem",
                    color: isDark ? "rgba(0,200,255,0.8)" : "#0066cc",
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                  }}>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      style={{ display: "inline-block" }}
                    >
                      ◌
                    </motion.span>
                    {zkPhase === "generating" ? "GENERATING GROTH16 PROOF IN BROWSER..." : "VERIFYING VIA SOROBAN CONTRACT..."}
                  </div>
                )}

                {zkPhase === "done" && zkResult && (
                  <div style={{
                    padding: "1.5rem",
                    marginBottom: "1.5rem",
                    border: `1px solid ${zkResult.verified ? (isDark ? "rgba(0,255,100,0.3)" : "rgba(0,100,0,0.3)") : "rgba(255,50,50,0.3)"}`,
                    background: zkResult.verified ? (isDark ? "rgba(0,255,100,0.04)" : "rgba(0,100,0,0.04)") : "rgba(255,50,50,0.04)",
                    fontFamily: FONT_MONO,
                    fontSize: "1.1rem",
                  }}>
                    <div style={{
                      color: zkResult.verified ? (isDark ? "#00ff64" : "#006622") : "#ff5555",
                      marginBottom: "0.8rem",
                      fontSize: "1.2rem",
                    }}>
                      {zkResult.verified ? "✓ MEMBERSHIP PROOF VERIFIED" : "✕ VERIFICATION FAILED"}
                    </div>
                    <div style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#888" }}>
                      method: {zkResult.method}
                    </div>
                    {zkResult.contractId && (
                      <div style={{ color: isDark ? "rgba(255,255,255,0.45)" : "#888", marginTop: "0.4rem" }}>
                        contract: <a href={zkResult.explorer} target="_blank" rel="noreferrer" style={{
                          color: isDark ? "rgba(0,200,255,0.8)" : "#0066cc",
                          textDecoration: "underline",
                          textUnderlineOffset: "4px",
                        }}>{zkResult.contractId.slice(0, 12)}...{zkResult.contractId.slice(-6)}</a>
                      </div>
                    )}
                  </div>
                )}

                {zkPhase === "error" && zkError && (
                  <div style={{
                    padding: "1.3rem",
                    marginBottom: "1.5rem",
                    border: "1px solid rgba(255,50,50,0.3)",
                    background: "rgba(255,50,50,0.05)",
                    fontFamily: FONT_MONO,
                    fontSize: "1.1rem",
                    color: "#ff5555",
                  }}>
                    ✕ ZK Proof: {zkError}
                  </div>
                )}

                <div style={{ display: "flex", gap: "1rem" }}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={resetForm}
                    style={{
                      flex: 1,
                      padding: "1.3rem",
                      background: "transparent",
                      color: isDark ? "rgba(255,255,255,0.6)" : "#666",
                      border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"}`,
                      borderRadius: "2px",
                      fontFamily: FONT_HEADING,
                      fontSize: "1.2rem",
                      fontWeight: 500,
                      letterSpacing: "0.12em",
                      cursor: "pointer",
                    }}
                  >
                    DEPLOY ANOTHER
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClose}
                    style={{
                      flex: 1,
                      padding: "1.3rem",
                      background: isDark ? "#ffaa00" : "#006622",
                      color: "#000",
                      border: "none",
                      borderRadius: "2px",
                      fontFamily: FONT_HEADING,
                      fontSize: "1.2rem",
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      cursor: "pointer",
                    }}
                  >
                    CLOSE
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
