// ═══════════════════════════════════════════════════════════════════════════
// Calendar Rate Limiter
// Per-user rate limiting to respect Google Calendar API quotas
// ═══════════════════════════════════════════════════════════════════════════

import { 
  checkRateLimitAsyncWithUnits, 
  peekRateLimitAsyncWithUnits, 
  peekRateLimitAsync,
  consumeRateLimitAsync,
  type RateLimitConfig 
} from "@/lib/rate-limit";
import { CalendarError, CalendarErrorCode } from "./errors";
import { CALENDAR_QUOTA_UNITS, type CalendarOperation } from "./types";
import {
  CALENDAR_QUOTA_PER_SECOND,
  CALENDAR_QUOTA_PER_MINUTE,
  CALENDAR_MAX_BATCH_REQUESTS,
  RATE_LIMIT_WAIT_TIMEOUT_MS,
} from "./constants";

// ─────────────────────────────────────────────────────────────
// Rate Limit Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Calendar API rate limits per user
 *
 * Google Calendar API has quota limits similar to other Google APIs:
 * 1. Per-user rate limit: quota units per second
 * 2. Daily quota: Depends on Google Cloud project
 *
 * We implement conservative limits to prevent quota exhaustion:
 * - Max 100 units per second (leaving headroom)
 * - Max 15,000 units per minute
 */
export const CALENDAR_RATE_LIMITS = {
  /** Per-second limit (in quota units) */
  perSecond: {
    windowMs: 1000,
    maxRequests: CALENDAR_QUOTA_PER_SECOND,
    keyPrefix: "calendar:sec",
  } as RateLimitConfig,

  /** Per-minute limit (in quota units) */
  perMinute: {
    windowMs: 60 * 1000,
    maxRequests: CALENDAR_QUOTA_PER_MINUTE,
    keyPrefix: "calendar:min",
  } as RateLimitConfig,

  /** Batch operation limit (concurrent batch requests) */
  batch: {
    windowMs: 1000,
    maxRequests: CALENDAR_MAX_BATCH_REQUESTS,
    keyPrefix: "calendar:batch",
  } as RateLimitConfig,
} as const;

// ─────────────────────────────────────────────────────────────
// Rate Limiter Class
// ─────────────────────────────────────────────────────────────

export interface RateLimitCheckResult {
  allowed: boolean;
  waitMs?: number;
  quotaRemaining: {
    perSecond: number;
    perMinute: number;
  };
}

/**
 * Calendar-specific rate limiter that tracks quota units
 */
export class CalendarRateLimiter {
  constructor(private userId: string) {}

  /**
   * Check if an operation is allowed under rate limits AND consume quota
   */
  async check(operation: CalendarOperation): Promise<RateLimitCheckResult> {
    const units = CALENDAR_QUOTA_UNITS[operation];
    return this.checkUnits(units);
  }

  /**
   * Peek at operation quota status without consuming any units
   * Use this for read-only checks before making a consumption decision
   */
  async peek(operation: CalendarOperation): Promise<RateLimitCheckResult> {
    const units = CALENDAR_QUOTA_UNITS[operation];
    return this.peekUnits(units);
  }

  /**
   * Check if a given number of quota units is allowed AND consume them
   * Use this when you're about to perform an operation
   * 
   * This method properly tracks quota UNITS (not call counts) by using
   * INCRBY to increment the counter by the operation's unit cost.
   * This ensures heterogeneous operations correctly share quota limits.
   */
  async checkUnits(units: number): Promise<RateLimitCheckResult> {
    const safeUnits = Math.max(1, Math.floor(units));

    // Check both per-second and per-minute limits (this CONSUMES units)
    // Uses INCRBY to increment counter by units, not just 1
    const [secResult, minResult] = await Promise.all([
      checkRateLimitAsyncWithUnits(this.userId, CALENDAR_RATE_LIMITS.perSecond, safeUnits),
      checkRateLimitAsyncWithUnits(this.userId, CALENDAR_RATE_LIMITS.perMinute, safeUnits),
    ]);

    const allowed = secResult.allowed && minResult.allowed;
    const waitMs = allowed
      ? undefined
      : Math.max(secResult.retryAfterMs || 0, minResult.retryAfterMs || 0);

    return {
      allowed,
      waitMs,
      quotaRemaining: {
        perSecond: secResult.remaining,
        perMinute: minResult.remaining,
      },
    };
  }

  /**
   * Peek at quota status without consuming any units
   * Use this for polling/waiting loops to avoid exhausting quota
   * 
   * Checks if the specified number of units would be allowed without
   * actually consuming them. Uses the unit-aware peek function.
   */
  async peekUnits(units: number): Promise<RateLimitCheckResult> {
    const safeUnits = Math.max(1, Math.floor(units));

    // Peek both per-second and per-minute limits (read-only, NO consumption)
    // Uses unit-aware peek to check if these units would be allowed
    const [secResult, minResult] = await Promise.all([
      peekRateLimitAsyncWithUnits(this.userId, CALENDAR_RATE_LIMITS.perSecond, safeUnits),
      peekRateLimitAsyncWithUnits(this.userId, CALENDAR_RATE_LIMITS.perMinute, safeUnits),
    ]);

    const allowed = secResult.allowed && minResult.allowed;
    const waitMs = allowed
      ? undefined
      : Math.max(secResult.retryAfterMs || 0, minResult.retryAfterMs || 0);

    return {
      allowed,
      waitMs,
      quotaRemaining: {
        perSecond: secResult.remaining,
        perMinute: minResult.remaining,
      },
    };
  }

  /**
   * Wait until an operation is allowed (with timeout)
   *
   * Uses peek (read-only) to poll for availability without consuming quota.
   * Does NOT consume quota - caller is responsible for quota consumption
   * when performing the actual API operation.
   *
   * This design prevents quota waste from race conditions:
   * - If another request consumes quota between wait and operation, the
   *   operation's rate limit check will fail and can be retried
   * - No quota is wasted during the wait loop itself
   *
   * @param operation - The operation type to check quota for
   * @param timeoutMs - Maximum time to wait for quota availability
   * @throws CalendarError with RATE_LIMITED code if timeout is reached
   */
  async waitForQuota(
    operation: CalendarOperation,
    timeoutMs: number = RATE_LIMIT_WAIT_TIMEOUT_MS
  ): Promise<void> {
    const units = CALENDAR_QUOTA_UNITS[operation];
    return this.waitForQuotaUnits(units, timeoutMs, operation);
  }

  /**
   * Wait until a specific number of quota units is available (with timeout)
   *
   * Uses peek (read-only) to poll for availability without consuming quota.
   * Does NOT consume quota - caller is responsible for quota consumption.
   *
   * @param units - Number of quota units to wait for
   * @param timeoutMs - Maximum time to wait for quota availability
   * @param operationName - Optional operation name for error messages
   * @throws CalendarError with RATE_LIMITED code if timeout is reached
   */
  async waitForQuotaUnits(
    units: number,
    timeoutMs: number = RATE_LIMIT_WAIT_TIMEOUT_MS,
    operationName?: string
  ): Promise<void> {
    const startTime = Date.now();
    const safeUnits = Math.max(1, Math.floor(units));

    while (Date.now() - startTime < timeoutMs) {
      // Use peekUnits to check WITHOUT consuming quota
      const peekResult = await this.peekUnits(safeUnits);

      if (peekResult.allowed) {
        // Quota appears available - return and let caller consume
        // Note: Due to race conditions, actual consumption might still fail,
        // but that's handled by the caller's retry logic, not here
        return;
      }

      // Wait the suggested time or 100ms minimum
      const waitMs = peekResult.waitMs || 100;
      const waitTime = Math.min(
        waitMs,
        timeoutMs - (Date.now() - startTime)
      );
      if (waitTime <= 0) break;

      await sleep(waitTime);
    }

    const opDesc = operationName ? ` for operation ${operationName}` : "";
    throw new CalendarError(
      CalendarErrorCode.RATE_LIMITED,
      `Rate limit timeout after ${timeoutMs}ms${opDesc} (${safeUnits} units)`,
      true,
      1000
    );
  }

  /**
   * Consume quota units after a successful operation
   * This is for tracking purposes - the actual check happens before
   */
  async consume(operation: CalendarOperation): Promise<void> {
    const units = CALENDAR_QUOTA_UNITS[operation];
    await this.consumeUnits(units);
  }

  /**
   * Unconditionally consume a specific number of quota units
   * 
   * Unlike check() which only increments when allowed, this ALWAYS increments
   * the counter regardless of whether limits are exceeded. Use this to track
   * actual API usage that has already occurred (e.g., prefetch operations).
   * 
   * Uses consumeRateLimitAsync which unconditionally increments via INCRBY.
   */
  async consumeUnits(units: number): Promise<void> {
    const safeUnits = Math.max(1, Math.floor(units));

    // Unconditionally consume units - always increments even if over limit
    // This is for tracking actual API usage that has already happened
    await Promise.all([
      consumeRateLimitAsync(this.userId, CALENDAR_RATE_LIMITS.perSecond, safeUnits),
      consumeRateLimitAsync(this.userId, CALENDAR_RATE_LIMITS.perMinute, safeUnits),
    ]);
  }

  /**
   * Get current quota status (read-only, does not consume quota)
   */
  async getStatus(): Promise<{
    perSecond: { remaining: number; resetAt: Date };
    perMinute: { remaining: number; resetAt: Date };
  }> {
    // Use peek (read-only) to check status without consuming quota
    const [secResult, minResult] = await Promise.all([
      peekRateLimitAsync(this.userId, CALENDAR_RATE_LIMITS.perSecond),
      peekRateLimitAsync(this.userId, CALENDAR_RATE_LIMITS.perMinute),
    ]);

    return {
      perSecond: {
        remaining: secResult.remaining,
        resetAt: secResult.resetAt,
      },
      perMinute: {
        remaining: minResult.remaining,
        resetAt: minResult.resetAt,
      },
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a rate limiter for a specific user
 */
export function createCalendarRateLimiter(userId: string): CalendarRateLimiter {
  return new CalendarRateLimiter(userId);
}

/**
 * Calculate total quota units for a batch of operations
 */
export function calculateBatchQuota(operations: CalendarOperation[]): number {
  return operations.reduce((total, op) => total + CALENDAR_QUOTA_UNITS[op], 0);
}

/**
 * Estimate remaining operations based on current quota
 */
export function estimateRemainingOperations(
  quotaRemaining: number,
  operation: CalendarOperation
): number {
  const units = CALENDAR_QUOTA_UNITS[operation];
  return Math.floor(quotaRemaining / units);
}

