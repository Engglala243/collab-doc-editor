/**
 * In-memory sliding-window rate limiter.
 *
 * For production scale, replace the `store` Map with a Redis client
 * using ZADD/ZREMRANGEBYSCORE commands — the algorithm is identical.
 *
 * Usage:
 *   const limiter = createRateLimiter({ windowMs: 60_000, max: 30 });
 *   const result = limiter.check(key);
 *   if (!result.allowed) return errors.tooManyRequests(result.retryAfter);
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number; // seconds until the window resets
}

export interface RateLimiterOptions {
  windowMs: number; // e.g. 60_000 for 1 minute
  max: number;      // max requests in that window
}

interface WindowEntry {
  timestamps: number[];
}

export function createRateLimiter({ windowMs, max }: RateLimiterOptions) {
  // Map<key → WindowEntry>
  // Key is typically userId or IP address
  const store = new Map<string, WindowEntry>();

  // Periodically prune stale entries to prevent unbounded memory growth
  const pruneInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
      if (entry.timestamps.length === 0) store.delete(key);
    }
  }, Math.max(windowMs, 30_000));

  // Allow GC in test / edge environments
  if (pruneInterval.unref) pruneInterval.unref();

  function check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = store.get(key) ?? { timestamps: [] };

    // Drop timestamps outside the current window
    entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

    if (entry.timestamps.length >= max) {
      const oldest = entry.timestamps[0]!;
      const retryAfter = Math.ceil((oldest + windowMs - now) / 1000);
      store.set(key, entry);
      return { allowed: false, remaining: 0, retryAfter };
    }

    entry.timestamps.push(now);
    store.set(key, entry);

    return {
      allowed: true,
      remaining: max - entry.timestamps.length,
      retryAfter: 0,
    };
  }

  return { check };
}

// ─── Singleton rate limiters ──────────────────────────────────────────────────

/** General API: 120 requests per minute per user */
export const apiLimiter = createRateLimiter({ windowMs: 60_000, max: 120 });

/** Sync endpoint: 60 pushes per minute per user */
export const syncLimiter = createRateLimiter({ windowMs: 60_000, max: 60 });

/** AI endpoints: 5 requests per minute per user */
export const aiLimiter = createRateLimiter({ windowMs: 60_000, max: 5 });

/** Version snapshot: 10 saves per minute per user */
export const versionLimiter = createRateLimiter({ windowMs: 60_000, max: 10 });
