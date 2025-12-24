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
 * This INCREMENTS the counter by 1 on every call (check-and-consume pattern)
 */
export async function checkRateLimitAsync(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return checkRateLimitAsyncWithUnits(key, config, 1);
}

/**
 * Check rate limit and consume a specific number of units
 * Use this for operations with variable costs (e.g., API calls with different quota costs)
 * 
 * This function checks BEFORE consuming to avoid wasting quota on rejected requests.
 * Uses a Lua script for atomic check-and-increment in Redis.
 * 
 * @param key - The rate limit key (e.g., user ID)
 * @param config - Rate limit configuration
 * @param units - Number of quota units to consume (default: 1)
 */
export async function checkRateLimitAsyncWithUnits(
  key: string,
  config: RateLimitConfig,
  units: number = 1
): Promise<RateLimitResult> {
  const now = Date.now();
  const fullKey = `ratelimit:${config.keyPrefix || "default"}:${key}`;
  const safeUnits = Math.max(1, Math.floor(units));

  // Try Redis first
  if (isRedisConnected()) {
    try {
      await ensureRedisConnection();

      // Lua script for atomic check-then-increment
      // Only increments if the new count would be <= maxRequests
      // Returns: [allowed (0/1), count after operation, ttl]
      const luaScript = `
        local key = KEYS[1]
        local units = tonumber(ARGV[1])
        local maxRequests = tonumber(ARGV[2])
        local windowMs = tonumber(ARGV[3])
        
        local current = tonumber(redis.call('GET', key) or '0')
        local newCount = current + units
        local allowed = 0
        
        if newCount <= maxRequests then
          -- Allowed: increment the counter
          redis.call('INCRBY', key, units)
          allowed = 1
        else
          -- Rejected: ensure key exists with current value to track the window
          -- This prevents subsequent requests from seeing an empty counter
          if current == 0 then
            -- Key doesn't exist, create it with value 0 to mark window start
            redis.call('SET', key, '0')
          end
        end
        
        -- Always set expiry if not already set (for both allowed and rejected)
        local ttl = redis.call('PTTL', key)
        if ttl == -1 or ttl == -2 then
          redis.call('PEXPIRE', key, windowMs)
          ttl = windowMs
        end
        
        -- Return the count AFTER the operation (if allowed) or current (if not)
        local finalCount = allowed == 1 and newCount or current
        return {allowed, finalCount, ttl}
      `;

      const result = await redis.eval(
        luaScript,
        1,
        fullKey,
        safeUnits.toString(),
        config.maxRequests.toString(),
        config.windowMs.toString()
      ) as [number, number, number];

      const [allowed, count, ttl] = result;
      // count is the current counter value:
      // - If allowed: count is AFTER increment (newCount)
      // - If rejected: count is the unchanged current value
      // In both cases, remaining = maxRequests - count gives the correct available slots
      const remaining = Math.max(0, config.maxRequests - count);
      const resetAt = new Date(now + ttl);

      return {
        allowed: allowed === 1,
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
  return checkRateLimitMemoryWithUnits(key, config, safeUnits);
}

/**
 * Unconditionally consume quota units (always increments, ignores limit)
 * Use this to track actual API usage that has already occurred.
 * 
 * Unlike checkRateLimitAsyncWithUnits (which only increments when allowed),
 * this function ALWAYS increments the counter regardless of whether the
 * limit would be exceeded. This is appropriate for:
 * - Tracking API calls that have already happened
 * - Accounting for nested/prefetch operations
 * 
 * @param key - The rate limit key (e.g., user ID)
 * @param config - Rate limit configuration  
 * @param units - Number of quota units to consume (default: 1)
 */
export async function consumeRateLimitAsync(
  key: string,
  config: RateLimitConfig,
  units: number = 1
): Promise<RateLimitResult> {
  const now = Date.now();
  const fullKey = `ratelimit:${config.keyPrefix || "default"}:${key}`;
  const safeUnits = Math.max(1, Math.floor(units));

  // Try Redis first
  if (isRedisConnected()) {
    try {
      await ensureRedisConnection();

      // Unconditionally increment by units using INCRBY
      const multi = redis.multi();
      multi.incrby(fullKey, safeUnits);
      multi.pttl(fullKey);

      const results = await multi.exec();

      if (!results) throw new Error("Redis transaction failed");

      const count = results[0][1] as number;
      let ttl = results[1][1] as number;

      // Set expiry on first request in window
      // ttl === -1: key exists but has no TTL
      // ttl === -2: key does not exist (race condition edge case)
      if (ttl === -1 || ttl === -2) {
        await redis.pexpire(fullKey, config.windowMs);
        ttl = config.windowMs;
      }

      const remaining = Math.max(0, config.maxRequests - count);
      // allowed indicates if we're still within limits after consumption
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
  return consumeRateLimitMemory(key, config, safeUnits);
}

/**
 * Peek at rate limit status without incrementing the counter
 * Use this for polling/waiting loops where you don't want to consume quota
 */
export async function peekRateLimitAsync(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  return peekRateLimitAsyncWithUnits(key, config, 1);
}

/**
 * Peek at rate limit status for a specific number of units without incrementing
 * Use this to check if a multi-unit operation would be allowed
 * 
 * @param key - The rate limit key (e.g., user ID)
 * @param config - Rate limit configuration
 * @param units - Number of quota units to check for (default: 1)
 */
export async function peekRateLimitAsyncWithUnits(
  key: string,
  config: RateLimitConfig,
  units: number = 1
): Promise<RateLimitResult> {
  const now = Date.now();
  const fullKey = `ratelimit:${config.keyPrefix || "default"}:${key}`;
  const safeUnits = Math.max(1, Math.floor(units));

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

      // Check if adding these units would exceed the limit
      const allowed = count + safeUnits <= config.maxRequests;
      // Current available quota (not after hypothetical consumption)
      const remaining = Math.max(0, config.maxRequests - count);
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
  return peekRateLimitMemoryWithUnits(key, config, safeUnits);
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
 * Memory-based rate limiting (increments counter by 1)
 */
function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  return checkRateLimitMemoryWithUnits(key, config, 1);
}

/**
 * Memory-based rate limiting with unit support (increments counter by units)
 * 
 * Unlike Redis (which requires atomic increment-then-check), the memory version
 * checks BEFORE incrementing to avoid wasting quota on rejected requests.
 */
function checkRateLimitMemoryWithUnits(
  key: string,
  config: RateLimitConfig,
  units: number
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
    memoryStore.set(fullKey, entry);
  }

  // Check if adding these units would exceed the limit BEFORE incrementing
  // This prevents wasting quota on rejected requests
  const wouldBeAllowed = entry.count + units <= config.maxRequests;

  if (wouldBeAllowed) {
    // Only increment if allowed
    entry.count += units;
    memoryStore.set(fullKey, entry);
  }

  // entry.count is the current counter value:
  // - If allowed: count is AFTER increment
  // - If rejected: count is unchanged
  // In both cases, remaining = maxRequests - count gives the correct available slots
  const remaining = Math.max(0, config.maxRequests - entry.count);
  
  return {
    allowed: wouldBeAllowed,
    remaining,
    resetAt: new Date(entry.resetAt),
    retryAfterMs: wouldBeAllowed ? undefined : entry.resetAt - now,
  };
}

/**
 * Memory-based unconditional consumption (always increments, ignores limit)
 * Use for tracking API usage that has already occurred.
 */
function consumeRateLimitMemory(
  key: string,
  config: RateLimitConfig,
  units: number
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
    memoryStore.set(fullKey, entry);
  }

  // Always increment - this is unconditional consumption
  entry.count += units;
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
 * Memory-based rate limit peek with unit support (read-only, no increment)
 * 
 * Note: `remaining` represents the current available quota (not after hypothetical consumption).
 * The `allowed` field indicates whether the specified units would fit within limits.
 */
function peekRateLimitMemoryWithUnits(
  key: string,
  config: RateLimitConfig,
  units: number
): RateLimitResult {
  const now = Date.now();
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;

  const entry = memoryStore.get(fullKey);

  // If no entry or window expired, quota is fully available
  if (!entry || entry.resetAt < now) {
    return {
      allowed: true,
      // Current available quota (full capacity since window is fresh/expired)
      remaining: config.maxRequests,
      resetAt: new Date(now + config.windowMs),
      retryAfterMs: undefined,
    };
  }

  // Check if adding these units would exceed the limit
  const allowed = entry.count + units <= config.maxRequests;
  // Current available quota (not after hypothetical consumption)
  const remaining = Math.max(0, config.maxRequests - entry.count);

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

  // ─────────────────────────────────────────────────────────────
  // Calendar Integration Rate Limits
  // ─────────────────────────────────────────────────────────────

  /** Calendar sync operations: 10 per minute (expensive operations) */
  calendarSync: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: "calendar-sync",
  } as RateLimitConfig,

  /** Calendar events list/read: 60 per minute */
  calendarEvents: {
    windowMs: 60 * 1000,
    maxRequests: 60,
    keyPrefix: "calendar-events",
  } as RateLimitConfig,

  /** Calendar event actions (create/update/delete): 30 per minute */
  calendarActions: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: "calendar-actions",
  } as RateLimitConfig,

  /** Calendar approval actions: 30 per minute */
  calendarApprovals: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: "calendar-approvals",
  } as RateLimitConfig,

  /** Calendar list/settings: 30 per minute */
  calendarCalendars: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: "calendar-calendars",
  } as RateLimitConfig,

  /** Calendar webhooks: 100 per minute (Google push notifications) */
  calendarWebhook: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: "calendar-webhook",
  } as RateLimitConfig,

  /** Calendar connection/disconnection: 5 per minute */
  calendarConnect: {
    windowMs: 60 * 1000,
    maxRequests: 5,
    keyPrefix: "calendar-connect",
  } as RateLimitConfig,
} as const;
