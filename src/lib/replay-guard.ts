/**
 * REPLAY GUARD — Anti-Replay Protection for x402 Payment Signatures
 * 
 * Assimilated from: Toll (5th Place Stellar Hacks)
 * Source: toll/packages/gateway/src/middleware.ts:36-55
 * 
 * Prevents double-spending by tracking used payment signatures with TTL.
 * Without this, a single txHash can be reused indefinitely.
 *
 * SECURITY FIX [API-2]: Uses pending/confirmed/release pattern.
 * - reserve(): Marks txHash as PENDING (blocks concurrent duplicates)
 * - confirm(): Marks txHash as CONFIRMED (permanent, cannot be reused)
 * - release(): Removes PENDING mark (allows retry on worker failure)
 */

const REPLAY_TTL_MS = 5 * 60 * 1000; // 5 minutes

type ReplayState = { status: "pending" | "confirmed"; ts: number };

export class ReplayGuard {
    private used = new Map<string, ReplayState>();

    /** Check if signature was already used. Returns true if REPLAY detected. */
    check(signature: string): boolean {
        this.cleanup();
        return this.used.has(signature);
    }

    /**
     * Reserve a txHash for processing. Returns true if REPLAY detected.
     * If the txHash is new, it's marked as PENDING (blocks duplicates).
     * If the worker fails, call release() to allow the client to retry.
     */
    reserve(signature: string): boolean {
        this.cleanup();
        const existing = this.used.get(signature);
        if (existing) {
            return true; // REPLAY: already pending or confirmed
        }
        this.used.set(signature, { status: "pending", ts: Date.now() });
        return false; // Reserved successfully
    }

    /**
     * Confirm a txHash after successful execution.
     * Once confirmed, the txHash can never be reused.
     */
    confirm(signature: string): void {
        this.used.set(signature, { status: "confirmed", ts: Date.now() });
    }

    /**
     * Release a PENDING txHash on worker failure, allowing client retry.
     * Does nothing if the txHash is already CONFIRMED (prevents abuse).
     */
    release(signature: string): void {
        const existing = this.used.get(signature);
        if (existing && existing.status === "pending") {
            this.used.delete(signature);
        }
        // If confirmed, do nothing — cannot un-confirm
    }

    /**
     * Atomic check-and-mark: returns true if REPLAY detected, otherwise marks immediately.
     * @deprecated Use reserve() + confirm()/release() pattern instead.
     */
    checkAndMark(signature: string): boolean {
        return this.reserve(signature);
    }

    /** Mark a signature as used after successful payment verification. */
    mark(signature: string): void {
        this.confirm(signature);
    }

    /** Get current number of tracked signatures (for monitoring). */
    get size(): number {
        return this.used.size;
    }

    /** Remove expired entries to prevent memory leak. */
    private cleanup(): void {
        const cutoff = Date.now() - REPLAY_TTL_MS;
        for (const [sig, state] of this.used) {
            if (state.ts < cutoff) this.used.delete(sig);
        }
    }
}

// Singleton instance for the gateway
export const replayGuard = new ReplayGuard();
