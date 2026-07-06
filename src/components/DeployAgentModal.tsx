"use client";
import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWallet } from "@/context/WalletContext";

const FONT_HEADING = "'Helvetica Now Display', 'Inter', sans-serif";
const FONT_MONO = "'SF Mono', 'Fira Code', monospace";
const TRANSITION = "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)";

// Palette aligned with page.tsx Lusion design system
const P = {
  accent: "#ffaa00",
  accentDim: "rgba(255,170,0,0.5)",
  accentBorder: "rgba(255,170,0,0.3)",
  accentBg: "rgba(255,170,0,0.05)",
  accentBgHover: "rgba(255,170,0,0.12)",
  border: "rgba(255,255,255,0.12)",
  borderHover: "rgba(255,170,0,0.4)",
  glassBg: "rgba(12,12,18,0.95)",
  text: "#fff",
  textMuted: "rgba(255,255,255,0.45)",
  textDim: "rgba(255,255,255,0.25)",
  inputBg: "rgba(255,255,255,0.04)",
  error: "#ff5555",
  errorBorder: "rgba(255,50,50,0.3)",
  errorBg: "rgba(255,50,50,0.05)",
};

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
}

const phaseLabel: Record<RegistrationPhase, string> = {
  idle: "",
  submitting: "SUBMITTING REGISTRATION",
  hashing: "GENERATING POSEIDON MEMBERSHIP HASH",
  relaying: "RELAYING ROOT UPDATE TO SOROBAN",
  done: "AGENT DEPLOYED SUCCESSFULLY",
  error: "REGISTRATION FAILED",
};

export default function DeployAgentModal({ open, onClose }: DeployAgentModalProps) {
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
  }, [name, capabilities, walletKey, workerUrl]);

  const canSubmit = name.trim().length > 0 && capabilities.length > 0 && phase === "idle";
  const isProcessing = phase === "submitting" || phase === "hashing" || phase === "relaying";

  const displayKey = walletKey
    ? `${walletKey.substring(0, 6)}...${walletKey.substring(walletKey.length - 4)}`
    : null;

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
            backdropFilter: "blur(0.8rem)",
            WebkitBackdropFilter: "blur(0.8rem)",
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: "3rem" }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: "3rem" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "clamp(40rem, 42vw, 64rem)",
              maxHeight: "85vh",
              overflowY: "auto",
              background: P.glassBg,
              border: `1px solid ${P.border}`,
              borderRadius: "0.2rem",
              padding: "clamp(2.5rem, 3vw, 4rem)",
              fontFamily: FONT_HEADING,
              color: P.text,
              boxSizing: "border-box",
            }}
          >
            {/* Header */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "clamp(2rem, 2vw, 3rem)",
            }}>
              <h2 style={{
                fontSize: "var(--text-h2, clamp(1.8rem, 2.5vw, 2.8rem))",
                fontWeight: 500,
                letterSpacing: "0.15em",
                margin: 0,
              }}>
                DEPLOY AGENT
              </h2>
              <button
                onClick={handleClose}
                disabled={isProcessing}
                style={{
                  background: "transparent",
                  border: "none",
                  color: P.textMuted,
                  fontSize: "clamp(1.6rem, 1.8vw, 2.2rem)",
                  cursor: isProcessing ? "not-allowed" : "pointer",
                  fontFamily: FONT_MONO,
                  padding: "0.5rem",
                  lineHeight: 1,
                }}
              >
                X
              </button>
            </div>

            {/* Wallet status */}
            {walletKey && (phase === "idle" || phase === "error") && (
              <div style={{
                marginBottom: "clamp(1.5rem, 1.5vw, 2.5rem)",
                padding: "clamp(0.8rem, 1vw, 1.4rem)",
                background: P.accentBg,
                border: `1px solid ${P.accentBorder}`,
                fontFamily: FONT_MONO,
                fontSize: "var(--text-body, clamp(1rem, 1.2vw, 1.4rem))",
                color: P.accentDim,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "1rem",
              }}>
                <span>WALLET LINKED</span>
                <span style={{ color: P.text }}>{displayKey}</span>
              </div>
            )}

            {/* Phase indicator */}
            {isProcessing && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                style={{
                  marginBottom: "clamp(1.5rem, 1.5vw, 2.5rem)",
                  padding: "clamp(1rem, 1.2vw, 1.8rem)",
                  border: `1px solid ${P.accentBorder}`,
                  background: P.accentBg,
                }}
              >
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  fontFamily: FONT_MONO,
                  fontSize: "var(--text-body, clamp(1rem, 1.2vw, 1.4rem))",
                  letterSpacing: "0.08em",
                  color: P.accent,
                }}>
                  <motion.span
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                  >
                    //
                  </motion.span>
                  {phaseLabel[phase]}
                </div>
                <div style={{
                  marginTop: "1rem",
                  height: "0.2rem",
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: "0.1rem",
                  overflow: "hidden",
                }}>
                  <motion.div
                    initial={{ width: "0%" }}
                    animate={{
                      width: phase === "submitting" ? "30%" : phase === "hashing" ? "60%" : "90%",
                    }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    style={{ height: "100%", background: P.accent }}
                  />
                </div>
              </motion.div>
            )}

            {/* Success result */}
            {phase === "done" && result && (
              <motion.div
                initial={{ opacity: 0, y: "1rem" }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginBottom: "clamp(1.5rem, 1.5vw, 2.5rem)",
                  padding: "clamp(1.5rem, 1.5vw, 2.5rem)",
                  border: `1px solid ${P.accentBorder}`,
                  background: P.accentBg,
                }}
              >
                <div style={{
                  fontFamily: FONT_MONO,
                  fontSize: "var(--text-body, clamp(1.1rem, 1.2vw, 1.5rem))",
                  letterSpacing: "0.1em",
                  color: P.accent,
                  marginBottom: "1.5rem",
                }}>
                  [{phaseLabel.done}]
                </div>

                <div style={{
                  display: "grid",
                  gap: "1rem",
                  fontFamily: FONT_MONO,
                  fontSize: "var(--text-body, clamp(1rem, 1vw, 1.3rem))",
                }}>
                  <div>
                    <span style={{ color: P.textMuted }}>agent_id: </span>
                    <span>{result.agent.id}</span>
                  </div>
                  <div>
                    <span style={{ color: P.textMuted }}>membership_leaf: </span>
                    <span style={{ wordBreak: "break-all" }}>
                      {result.guild.membershipLeaf.slice(0, 24)}...
                    </span>
                  </div>
                  <div>
                    <span style={{ color: P.textMuted }}>merkle_root: </span>
                    <span style={{ wordBreak: "break-all" }}>
                      {result.guild.membershipRoot.slice(0, 24)}...
                    </span>
                  </div>
                  <div>
                    <span style={{ color: P.textMuted }}>total_members: </span>
                    <span>{result.guild.totalMembers}</span>
                  </div>

                  <div style={{
                    marginTop: "0.5rem",
                    paddingTop: "1rem",
                    borderTop: "1px solid rgba(255,255,255,0.08)",
                  }}>
                    <span style={{ color: P.textMuted }}>soroban_status: </span>
                    <span style={{
                      color: result.guild.soroban.rootUpdateSubmission.status === "confirmed"
                        ? P.accent : P.accentDim,
                    }}>
                      {result.guild.soroban.rootUpdateSubmission.status?.toUpperCase() || "PENDING"}
                    </span>
                  </div>

                  {result.guild.soroban.rootUpdateSubmission.txHash && (
                    <div>
                      <span style={{ color: P.textMuted }}>tx_hash: </span>
                      <a
                        href={result.guild.soroban.rootUpdateSubmission.explorer || result.guild.explorer}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: "rgba(255,255,255,0.7)",
                          textDecoration: "underline",
                          textDecorationColor: "rgba(255,255,255,0.2)",
                          textUnderlineOffset: "0.4rem",
                          wordBreak: "break-all",
                        }}
                      >
                        {result.guild.soroban.rootUpdateSubmission.txHash.slice(0, 20)}...
                      </a>
                    </div>
                  )}

                  <div>
                    <span style={{ color: P.textMuted }}>contract: </span>
                    <a
                      href={result.guild.explorer}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        textDecoration: "underline",
                        textDecorationColor: "rgba(255,255,255,0.2)",
                        textUnderlineOffset: "0.4rem",
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
                initial={{ opacity: 0, y: "1rem" }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  marginBottom: "clamp(1.5rem, 1.5vw, 2.5rem)",
                  padding: "clamp(1rem, 1.2vw, 1.8rem)",
                  border: `1px solid ${P.errorBorder}`,
                  background: P.errorBg,
                  fontFamily: FONT_MONO,
                  fontSize: "var(--text-body, clamp(1rem, 1.2vw, 1.4rem))",
                  color: P.error,
                }}
              >
                [ERROR] {error}
              </motion.div>
            )}

            {/* Form */}
            {(phase === "idle" || phase === "error") && (
              <>
                {/* Agent Name */}
                <div style={{ marginBottom: "clamp(1.5rem, 1.5vw, 2.5rem)" }}>
                  <label style={{
                    display: "block",
                    fontSize: "var(--text-caption, clamp(1rem, 1.1vw, 1.3rem))",
                    letterSpacing: "0.12em",
                    color: P.accentDim,
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
                      padding: "clamp(0.8rem, 1vw, 1.4rem) clamp(1rem, 1.2vw, 1.6rem)",
                      background: P.inputBg,
                      border: `1px solid ${P.border}`,
                      borderRadius: "0.2rem",
                      color: P.text,
                      fontFamily: FONT_MONO,
                      fontSize: "var(--text-body, clamp(1.1rem, 1.2vw, 1.5rem))",
                      outline: "none",
                      transition: TRANSITION,
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = P.borderHover; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = P.border; }}
                  />
                </div>

                {/* Capabilities */}
                <div style={{ marginBottom: "clamp(1.5rem, 1.5vw, 2.5rem)" }}>
                  <label style={{
                    display: "block",
                    fontSize: "var(--text-caption, clamp(1rem, 1.1vw, 1.3rem))",
                    letterSpacing: "0.12em",
                    color: P.accentDim,
                    marginBottom: "0.8rem",
                    fontWeight: 500,
                  }}>
                    CAPABILITIES
                  </label>
                  <div style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "clamp(0.4rem, 0.5vw, 0.8rem)",
                  }}>
                    {CAPABILITY_OPTIONS.map((cap) => {
                      const selected = capabilities.includes(cap);
                      return (
                        <button
                          key={cap}
                          onClick={() => toggleCapability(cap)}
                          style={{
                            padding: "clamp(0.5rem, 0.6vw, 0.9rem) clamp(0.8rem, 1vw, 1.5rem)",
                            background: selected ? P.accentBgHover : "transparent",
                            border: `1px solid ${selected ? P.accentBorder : P.border}`,
                            borderRadius: "0.2rem",
                            color: selected ? P.accent : "rgba(255,255,255,0.55)",
                            fontFamily: FONT_MONO,
                            fontSize: "var(--text-caption, clamp(0.9rem, 1vw, 1.2rem))",
                            cursor: "pointer",
                            transition: TRANSITION,
                            letterSpacing: "0.04em",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {cap}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Worker URL */}
                <div style={{ marginBottom: "clamp(1.5rem, 1.5vw, 2.5rem)" }}>
                  <label style={{
                    display: "block",
                    fontSize: "var(--text-caption, clamp(1rem, 1.1vw, 1.3rem))",
                    letterSpacing: "0.12em",
                    color: P.accentDim,
                    marginBottom: "0.8rem",
                    fontWeight: 500,
                  }}>
                    WORKER URL <span style={{ opacity: 0.5 }}>(OPTIONAL)</span>
                  </label>
                  <input
                    type="url"
                    value={workerUrl}
                    onChange={(e) => setWorkerUrl(e.target.value)}
                    placeholder="https://your-agent.com/api/hire"
                    style={{
                      width: "100%",
                      padding: "clamp(0.8rem, 1vw, 1.4rem) clamp(1rem, 1.2vw, 1.6rem)",
                      background: P.inputBg,
                      border: `1px solid ${P.border}`,
                      borderRadius: "0.2rem",
                      color: P.text,
                      fontFamily: FONT_MONO,
                      fontSize: "var(--text-body, clamp(1rem, 1vw, 1.3rem))",
                      outline: "none",
                      transition: TRANSITION,
                      boxSizing: "border-box",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = P.borderHover; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = P.border; }}
                  />
                  <p style={{
                    marginTop: "0.6rem",
                    fontSize: "var(--text-caption, clamp(0.8rem, 0.9vw, 1rem))",
                    color: P.textDim,
                    fontFamily: FONT_MONO,
                  }}>
                    If provided, the mesh will route tasks to your agent endpoint
                  </p>
                </div>

                {/* Submit */}
                <motion.button
                  whileHover={canSubmit ? { scale: 1.02, background: "rgba(255,170,0,0.9)" } : {}}
                  whileTap={canSubmit ? { scale: 0.98 } : {}}
                  onClick={handleDeploy}
                  disabled={!canSubmit}
                  style={{
                    width: "100%",
                    padding: "clamp(1rem, 1.2vw, 1.8rem)",
                    background: canSubmit ? P.accent : "rgba(255,255,255,0.06)",
                    color: canSubmit ? "#0a0a0a" : "rgba(255,255,255,0.25)",
                    border: "none",
                    borderRadius: "0.2rem",
                    fontFamily: FONT_HEADING,
                    fontSize: "var(--text-h3, clamp(1.2rem, 1.3vw, 1.6rem))",
                    fontWeight: 600,
                    letterSpacing: "0.15em",
                    cursor: canSubmit ? "pointer" : "not-allowed",
                    transition: TRANSITION,
                  }}
                >
                  {phase === "error" ? "RETRY DEPLOYMENT" : "REGISTER IN GUILD"}
                </motion.button>

                <p style={{
                  marginTop: "1.5rem",
                  fontSize: "var(--text-caption, clamp(0.8rem, 0.9vw, 1.1rem))",
                  color: P.textDim,
                  textAlign: "center",
                  lineHeight: 1.6,
                  fontFamily: FONT_MONO,
                  letterSpacing: "0.03em",
                }}>
                  Poseidon hash / Merkle leaf / Soroban root update / Stellar Testnet
                </p>
              </>
            )}

            {/* Done — ZK verification + action buttons */}
            {phase === "done" && (
              <>
                {/* ZK Verify button */}
                {zkPhase === "idle" && result?.guild?.proofInputs && (
                  <motion.button
                    whileHover={{ scale: 1.02, borderColor: P.accent }}
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
                      padding: "clamp(1rem, 1.1vw, 1.5rem)",
                      marginBottom: "clamp(1rem, 1.2vw, 1.8rem)",
                      background: P.accentBg,
                      color: P.accent,
                      border: `1px solid ${P.accentBorder}`,
                      borderRadius: "0.2rem",
                      fontFamily: FONT_HEADING,
                      fontSize: "var(--text-body, clamp(1rem, 1.2vw, 1.4rem))",
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      cursor: "pointer",
                      transition: TRANSITION,
                    }}
                  >
                    VERIFY MEMBERSHIP — ZK PROOF
                  </motion.button>
                )}

                {/* ZK progress */}
                {(zkPhase === "generating" || zkPhase === "verifying") && (
                  <div style={{
                    padding: "clamp(1rem, 1.1vw, 1.5rem)",
                    marginBottom: "clamp(1rem, 1.2vw, 1.8rem)",
                    border: `1px solid ${P.accentBorder}`,
                    background: P.accentBg,
                    fontFamily: FONT_MONO,
                    fontSize: "var(--text-body, clamp(1rem, 1vw, 1.3rem))",
                    color: P.accent,
                    display: "flex",
                    alignItems: "center",
                    gap: "1rem",
                  }}>
                    <motion.span
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                    >
                      //
                    </motion.span>
                    {zkPhase === "generating" ? "GENERATING GROTH16 PROOF IN BROWSER" : "VERIFYING VIA SOROBAN CONTRACT"}
                  </div>
                )}

                {/* ZK result */}
                {zkPhase === "done" && zkResult && (
                  <div style={{
                    padding: "clamp(1rem, 1.2vw, 1.8rem)",
                    marginBottom: "clamp(1rem, 1.2vw, 1.8rem)",
                    border: `1px solid ${zkResult.verified ? P.accentBorder : P.errorBorder}`,
                    background: zkResult.verified ? P.accentBg : P.errorBg,
                    fontFamily: FONT_MONO,
                    fontSize: "var(--text-body, clamp(1rem, 1vw, 1.3rem))",
                  }}>
                    <div style={{
                      color: zkResult.verified ? P.accent : P.error,
                      marginBottom: "0.8rem",
                      fontSize: "var(--text-body, clamp(1.1rem, 1.2vw, 1.4rem))",
                    }}>
                      {zkResult.verified ? "[PASS] MEMBERSHIP PROOF VERIFIED" : "[FAIL] VERIFICATION FAILED"}
                    </div>
                    <div style={{ color: P.textMuted }}>
                      method: {zkResult.method}
                    </div>
                    {zkResult.contractId && (
                      <div style={{ color: P.textMuted, marginTop: "0.4rem" }}>
                        contract: <a href={zkResult.explorer} target="_blank" rel="noreferrer" style={{
                          color: "rgba(255,255,255,0.7)",
                          textDecoration: "underline",
                          textUnderlineOffset: "0.4rem",
                        }}>{zkResult.contractId.slice(0, 12)}...{zkResult.contractId.slice(-6)}</a>
                      </div>
                    )}
                  </div>
                )}

                {/* ZK error */}
                {zkPhase === "error" && zkError && (
                  <div style={{
                    padding: "clamp(1rem, 1.1vw, 1.5rem)",
                    marginBottom: "clamp(1rem, 1.2vw, 1.8rem)",
                    border: `1px solid ${P.errorBorder}`,
                    background: P.errorBg,
                    fontFamily: FONT_MONO,
                    fontSize: "var(--text-body, clamp(1rem, 1vw, 1.3rem))",
                    color: P.error,
                  }}>
                    [ERROR] ZK Proof: {zkError}
                  </div>
                )}

                {/* Action buttons */}
                <div style={{ display: "flex", gap: "1rem" }}>
                  <motion.button
                    whileHover={{ scale: 1.02, borderColor: P.accentBorder }}
                    whileTap={{ scale: 0.98 }}
                    onClick={resetForm}
                    style={{
                      flex: 1,
                      padding: "clamp(1rem, 1.1vw, 1.5rem)",
                      background: "transparent",
                      color: "rgba(255,255,255,0.6)",
                      border: `1px solid ${P.border}`,
                      borderRadius: "0.2rem",
                      fontFamily: FONT_HEADING,
                      fontSize: "var(--text-body, clamp(1rem, 1.2vw, 1.4rem))",
                      fontWeight: 500,
                      letterSpacing: "0.12em",
                      cursor: "pointer",
                      transition: TRANSITION,
                    }}
                  >
                    DEPLOY ANOTHER
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02, background: "rgba(255,170,0,0.9)" }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleClose}
                    style={{
                      flex: 1,
                      padding: "clamp(1rem, 1.1vw, 1.5rem)",
                      background: P.accent,
                      color: "#0a0a0a",
                      border: "none",
                      borderRadius: "0.2rem",
                      fontFamily: FONT_HEADING,
                      fontSize: "var(--text-body, clamp(1rem, 1.2vw, 1.4rem))",
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      cursor: "pointer",
                      transition: TRANSITION,
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
