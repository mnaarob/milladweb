/**
 * In-memory sliding-window rate limiter for Supabase Edge Functions.
 *
 * Each Deno Deploy isolate has its own memory, so this provides
 * per-isolate protection — effective against single-source abuse,
 * not a globally consistent counter. For most storefronts this is
 * more than sufficient.
 *
 * Usage:
 *   const limiter = new RateLimiter({ windowMs: 5 * 60_000, max: 10 });
 *   const result = limiter.check(clientIp);
 *   if (!result.allowed) return new Response('Too many requests', { status: 429 });
 */

interface RateLimitEntry {
    timestamps: number[];
}

interface RateLimiterOptions {
    windowMs: number;
    max: number;
    cleanupIntervalMs?: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs: number;
}

export class RateLimiter {
    private windowMs: number;
    private max: number;
    private store = new Map<string, RateLimitEntry>();
    private lastCleanup = Date.now();
    private cleanupIntervalMs: number;

    constructor(opts: RateLimiterOptions) {
        this.windowMs = opts.windowMs;
        this.max = opts.max;
        this.cleanupIntervalMs = opts.cleanupIntervalMs ?? opts.windowMs * 2;
    }

    check(key: string): RateLimitResult {
        const now = Date.now();
        this.maybeCleanup(now);

        let entry = this.store.get(key);
        if (!entry) {
            entry = { timestamps: [] };
            this.store.set(key, entry);
        }

        const windowStart = now - this.windowMs;
        entry.timestamps = entry.timestamps.filter(t => t > windowStart);

        if (entry.timestamps.length >= this.max) {
            const oldestInWindow = entry.timestamps[0];
            const retryAfterMs = oldestInWindow + this.windowMs - now;
            return {
                allowed: false,
                remaining: 0,
                retryAfterMs: Math.max(retryAfterMs, 1000),
            };
        }

        entry.timestamps.push(now);
        return {
            allowed: true,
            remaining: this.max - entry.timestamps.length,
            retryAfterMs: 0,
        };
    }

    private maybeCleanup(now: number): void {
        if (now - this.lastCleanup < this.cleanupIntervalMs) return;
        this.lastCleanup = now;
        const windowStart = now - this.windowMs;
        for (const [key, entry] of this.store) {
            entry.timestamps = entry.timestamps.filter(t => t > windowStart);
            if (entry.timestamps.length === 0) this.store.delete(key);
        }
    }
}

export function getClientIp(req: Request): string {
    return (
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        'unknown'
    );
}
