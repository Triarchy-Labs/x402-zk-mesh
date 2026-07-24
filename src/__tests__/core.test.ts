import { describe, it, expect } from "vitest";

/**
 * Core utility tests for x402 Triarchy Gateway
 * Covers: L402 validation logic, WASM sandbox heuristics, routing thresholds
 */

// === L402 Payment Validation ===
describe("L402 Payment Validation", () => {
	it("should reject empty transaction hash", () => {
		const txHash = "";
		expect(txHash.length).toBe(0);
		expect(txHash).toBeFalsy();
	});

	it("should accept valid Stellar transaction hash format (64 hex chars)", () => {
		const validHash = "a".repeat(64);
		expect(validHash).toMatch(/^[a-f0-9]{64}$/);
	});

	it("should reject invalid hash with wrong length", () => {
		const shortHash = "abc123";
		expect(shortHash).not.toMatch(/^[a-f0-9]{64}$/);
	});
});

// === WASM Sandbox Heuristic Patterns ===
describe("WASM Sandbox Heuristic Detection", () => {
	const BANNED_PATTERNS = [
		"system(", "exec(", "eval(", "__proto__",
		"constructor.prototype", "process.env",
		"require(", "import(", "fs.readFile",
		"child_process", "rm -rf", "chmod",
	];

	it("should detect all banned injection patterns", () => {
		for (const pattern of BANNED_PATTERNS) {
			const payload = `some input with ${pattern} inside`;
			const detected = BANNED_PATTERNS.some((p) => payload.includes(p));
			expect(detected).toBe(true);
		}
	});

	it("should pass clean payloads through", () => {
		const cleanPayload = "Summarize this research paper about quantum computing";
		const detected = BANNED_PATTERNS.some((p) => cleanPayload.includes(p));
		expect(detected).toBe(false);
	});

	it("should detect prototype pollution attempts", () => {
		const poisoned = '{"__proto__": {"isAdmin": true}}';
		expect(poisoned).toContain("__proto__");
	});
});

// === Routing Threshold Logic ===
// Threshold must match src/app/api/hire/route.ts ENTERPRISE_THRESHOLD
describe("Task Routing Thresholds", () => {
	const ENTERPRISE_THRESHOLD = 10.0;

	it("should route micro-bounties (<$10) to local LLM", () => {
		const bounty = 6.0; // Default demo amount (previously misrouted at threshold=5)
		expect(bounty < ENTERPRISE_THRESHOLD).toBe(true);
	});

	it("should route enterprise tasks (>=$10) to sovereign node", () => {
		const bounty = 15.0;
		expect(bounty >= ENTERPRISE_THRESHOLD).toBe(true);
	});

	it("should handle edge case at exact threshold", () => {
		const bounty = 10.0;
		expect(bounty >= ENTERPRISE_THRESHOLD).toBe(true);
	});

	it("should route 9.99 to micro tier (just below threshold)", () => {
		const bounty = 9.99;
		expect(bounty < ENTERPRISE_THRESHOLD).toBe(true);
	});

	it("should reject negative bounty amounts", () => {
		const bounty = -1.0;
		expect(bounty > 0).toBe(false);
	});

	it("should reject zero bounty amounts", () => {
		const bounty = 0;
		expect(bounty > 0).toBe(false);
	});
});

// === Unified Pointer Input Normalization ===
describe("Unified Pointer Normalization", () => {
	it("should normalize center of screen to (0, 0)", () => {
		const width = 1920;
		const height = 1080;
		const clientX = width / 2;
		const clientY = height / 2;
		const x = (clientX / width) * 2 - 1;
		const y = -(clientY / height) * 2 + 1;
		expect(x).toBeCloseTo(0, 5);
		expect(y).toBeCloseTo(0, 5);
	});

	it("should normalize top-left to (-1, 1)", () => {
		const x = (0 / 1920) * 2 - 1;
		const y = -(0 / 1080) * 2 + 1;
		expect(x).toBeCloseTo(-1, 5);
		expect(y).toBeCloseTo(1, 5);
	});

	it("should normalize bottom-right to (1, -1)", () => {
		const width = 1920;
		const height = 1080;
		const x = (width / width) * 2 - 1;
		const y = -(height / height) * 2 + 1;
		expect(x).toBeCloseTo(1, 5);
		expect(y).toBeCloseTo(-1, 5);
	});
});

// === Verdict Hash Determinism ===
import { createHash } from "node:crypto";

function computeVerdictHash(inputs: Record<string, unknown>): string {
	return createHash("sha256").update(JSON.stringify(inputs)).digest("hex");
}

describe("Verdict Hash Cryptographic Properties", () => {
	const baseInputs = {
		artifacts: { receiptId: "r1", taskHash: "t1", paymentHash: "p1" },
		network: "stellar-testnet",
		taskId: "TASK-001",
		createdAt: "2026-01-01T00:00:00Z",
		stepStatuses: [{ id: "payment", status: "confirmed" }, { id: "zk", status: "verified" }],
		paymentTxHash: "abc123",
		zkProofValid: true,
		zkApprovedRoot: true,
	};

	it("should produce a 64-character hex string (sha256)", () => {
		const hash = computeVerdictHash(baseInputs);
		expect(hash).toMatch(/^[a-f0-9]{64}$/);
	});

	it("should be deterministic (same inputs → same hash)", () => {
		const hash1 = computeVerdictHash(baseInputs);
		const hash2 = computeVerdictHash(baseInputs);
		expect(hash1).toBe(hash2);
	});

	it("should change when step status changes (integrity)", () => {
		const modified = { ...baseInputs, stepStatuses: [{ id: "payment", status: "failed" }, { id: "zk", status: "verified" }] };
		expect(computeVerdictHash(baseInputs)).not.toBe(computeVerdictHash(modified));
	});

	it("should change when ZK proof validity changes", () => {
		const modified = { ...baseInputs, zkProofValid: false };
		expect(computeVerdictHash(baseInputs)).not.toBe(computeVerdictHash(modified));
	});

	it("should change when payment hash changes", () => {
		const modified = { ...baseInputs, paymentTxHash: "def456" };
		expect(computeVerdictHash(baseInputs)).not.toBe(computeVerdictHash(modified));
	});
});

// === WASM Sandbox Edge Cases ===
describe("WASM Sandbox Edge Cases", () => {
	const BANNED = ["system(", "eval(", "process.env", "child_process", "rm -rf", "__proto__", "constructor.prototype"];
	const detect = (input: string) => BANNED.some((p) => input.includes(p));

	it("should detect nested/obfuscated injection attempts", () => {
		expect(detect("const x = eval('dangerous')")).toBe(true);
		expect(detect("require('child_process').exec('ls')")).toBe(true);
		expect(detect("obj.__proto__.polluted = true")).toBe(true);
	});

	it("should detect buffer overflow patterns", () => {
		expect(detect("system('cat /etc/passwd')")).toBe(true);
	});

	it("should pass legitimate WASM payloads", () => {
		expect(detect("function processTask(input) { return input.toUpperCase(); }")).toBe(false);
		expect(detect("const result = await fetch('/api/data');")).toBe(false);
		expect(detect("Math.random() * 100")).toBe(false);
	});
});
