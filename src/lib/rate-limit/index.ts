// ═══════════════════════════════════════════════════════════════════════════
// Rate Limiting
// Redis-backed rate limiter with in-memory fallback
// ═══════════════════════════════════════════════════════════════════════════

import { redis, ensureRedisConnection, isRedisConnected } from "@/lib/redis";

export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests per window */
  maxRequests: number;
  /** Prefix for rate limit keys */
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

// In-memory fallback store
const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Cleanup memory store periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of memoryStore.entries()) {
      if (value.resetAt < now) {
        memoryStore.delete(key);
      }
    }
  }, 60000);
}

/**
 * Check rate limit using Redis, with memory fallback
 * This INCREMENTS the counter on every call (check-and-consume pattern)
 */
export async function checkRateLimitAsync(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const fullKey = `ratelimit:${config.keyPrefix || "default"}:${key}`;

  // Try Redis first
  if (isRedisConnected()) {
    try {
      await ensureRedisConnection();

      // Use Redis INCR + PTTL
      const multi = redis.multi();
      multi.incr(fullKey);
      multi.pttl(fullKey);

      const results = await multi.exec();

      if (!results) throw new Error("Redis transaction failed");

      const count = results[0][1] as number;
      let ttl = results[1][1] as number;

      // Set expiry on first request in window
      if (ttl === -1) {
        await redis.pexpire(fullKey, config.windowMs);
        ttl = config.windowMs;
      }

      const remaining = Math.max(0, config.maxRequests - count);
      const allowed = count <= config.maxRequests;
      const resetAt = new Date(now + ttl);

      return {
        allowed,
        remaining,
        resetAt,
        retryAfterMs: allowed ? undefined : ttl,
      };
    } catch (error) {
      console.warn(
        "[RateLimit] Redis unavailable, using memory fallback:",
        error
      );
    }
  }

  // Fallback to memory
  return checkRateLimitMemory(key, config);
}

/**
 * Peek at rate limit status without incrementing the counter
 * Use this for polling/waiting loops where you don't want to consume quota
 */
export async function peekRateLimitAsync(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const fullKey = `ratelimit:${config.keyPrefix || "default"}:${key}`;

  // Try Redis first
  if (isRedisConnected()) {
    try {
      await ensureRedisConnection();

      // Use Redis GET + PTTL (read-only, no increment)
      const multi = redis.multi();
      multi.get(fullKey);
      multi.pttl(fullKey);

      const results = await multi.exec();

      if (!results) throw new Error("Redis transaction failed");

      const countStr = results[0][1] as string | null;
      const count = countStr ? parseInt(countStr, 10) : 0;
      let ttl = results[1][1] as number;

      // If key doesn't exist or has no TTL, window hasn't started
      if (ttl === -2 || ttl === -1) {
        ttl = config.windowMs;
      }

      // Use same operator as check (<=) for consistency
      // This checks: "if we add one more request, would it still be within limits?"
      const allowed = count + 1 <= config.maxRequests;
      // Calculate remaining AFTER a hypothetical request (consistent with check's post-increment remaining)
      // This predicts what check would report after actually making the request
      const remaining = Math.max(0, config.maxRequests - count - 1);
      const resetAt = new Date(now + ttl);

      return {
        allowed,
        remaining,
        resetAt,
        retryAfterMs: allowed ? undefined : ttl,
      };
    } catch (error) {
      console.warn(
        "[RateLimit] Redis unavailable, using memory fallback:",
        error
      );
    }
  }

  // Fallback to memory (peek-only version)
  return peekRateLimitMemory(key, config);
}

/**
 * Synchronous rate limit check (memory only)
 * Use this when you can't await
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  return checkRateLimitMemory(key, config);
}

/**
 * Memory-based rate limiting (increments counter)
 */
function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;

  let entry = memoryStore.get(fullKey);

  // Reset if window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
  }

  entry.count++;
  memoryStore.set(fullKey, entry);

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count <= config.maxRequests;

  return {
    allowed,
    remaining,
    resetAt: new Date(entry.resetAt),
    retryAfterMs: allowed ? undefined : entry.resetAt - now,
  };
}

/**
 * Memory-based rate limit peek (read-only, no increment)
 */
function peekRateLimitMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;

  const entry = memoryStore.get(fullKey);

  // If no entry or window expired, quota is fully available
  if (!entry || entry.resetAt < now) {
    return {
      allowed: true,
      // Predict remaining AFTER a hypothetical request (count would be 1)
      remaining: config.maxRequests - 1,
      resetAt: new Date(now + config.windowMs),
      retryAfterMs: undefined,
    };
  }

  // Use same operator as check (<=) for consistency
  // This checks: "if we add one more request, would it still be within limits?"
  const allowed = entry.count + 1 <= config.maxRequests;
  // Calculate remaining AFTER a hypothetical request (consistent with check's post-increment remaining)
  const remaining = Math.max(0, config.maxRequests - entry.count - 1);

  return {
    allowed,
    remaining,
    resetAt: new Date(entry.resetAt),
    retryAfterMs: allowed ? undefined : entry.resetAt - now,
  };
}

/**
 * Reset rate limit for a specific key (for testing)
 */
export async function resetRateLimit(
  key: string,
  keyPrefix?: string
): Promise<void> {
  const memKey = keyPrefix ? `${keyPrefix}:${key}` : key;
  memoryStore.delete(memKey);

  if (isRedisConnected()) {
    try {
      const redisKey = `ratelimit:${keyPrefix || "default"}:${key}`;
      await redis.del(redisKey);
    } catch {
      // Ignore Redis errors
    }
  }
}

/**
 * Clear all rate limits (for testing)
 */
export function clearAllRateLimits(): void {
  memoryStore.clear();
}

// ─────────────────────────────────────────────────────────────
// Common Rate Limit Configs
// ─────────────────────────────────────────────────────────────

export const RATE_LIMITS = {
  /** Standard API routes: 100 requests per minute */
  api: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: "api",
  } as RateLimitConfig,

  /** Search/embedding routes: 30 requests per minute (OpenAI cost) */
  search: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: "search",
  } as RateLimitConfig,

  /** Auth routes: 10 requests per minute (prevent brute force) */
  auth: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: "auth",
  } as RateLimitConfig,

  /** Create operations: 50 per minute */
  create: {
    windowMs: 60 * 1000,
    maxRequests: 50,
    keyPrefix: "create",
  } as RateLimitConfig,

  /** Chat/AI operations: 20 per minute (LLM cost control) */
  chat: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: "chat",
  } as RateLimitConfig,

  // ─────────────────────────────────────────────────────────────
  // Gmail Integration Rate Limits
  // ─────────────────────────────────────────────────────────────

  /** Gmail sync operations: 10 per minute (expensive operations) */
  gmailSync: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: "gmail-sync",
  } as RateLimitConfig,

  /** Gmail send/compose: 20 per minute (prevent spam) */
  gmailSend: {
    windowMs: 60 * 1000,
    maxRequests: 20,
    keyPrefix: "gmail-send",
  } as RateLimitConfig,

  /** Gmail connection/disconnection: 5 per minute */
  gmailConnect: {
    windowMs: 60 * 1000,
    maxRequests: 5,
    keyPrefix: "gmail-connect",
  } as RateLimitConfig,

  /** Gmail approval actions: 30 per minute */
  gmailApprovals: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: "gmail-approvals",
  } as RateLimitConfig,

  /** Gmail drafts: 30 per minute */
  gmailDrafts: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: "gmail-drafts",
  } as RateLimitConfig,
} as const;
