// ═══════════════════════════════════════════════════════════════════════════
// Calendar Rate Limiter
// Per-user rate limiting to respect Google Calendar API quotas
// ═══════════════════════════════════════════════════════════════════════════

import { checkRateLimitAsync, peekRateLimitAsync, type RateLimitConfig } from "@/lib/rate-limit";
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
   */
  async checkUnits(units: number): Promise<RateLimitCheckResult> {
    // Check both per-second and per-minute limits (this CONSUMES quota)
    const [secResult, minResult] = await Promise.all([
      checkRateLimitAsync(this.userId, {
        ...CALENDAR_RATE_LIMITS.perSecond,
        maxRequests: Math.floor(
          CALENDAR_RATE_LIMITS.perSecond.maxRequests / units
        ),
      }),
      checkRateLimitAsync(this.userId, {
        ...CALENDAR_RATE_LIMITS.perMinute,
        maxRequests: Math.floor(
          CALENDAR_RATE_LIMITS.perMinute.maxRequests / units
        ),
      }),
    ]);

    const allowed = secResult.allowed && minResult.allowed;
    const waitMs = allowed
      ? undefined
      : Math.max(secResult.retryAfterMs || 0, minResult.retryAfterMs || 0);

    return {
      allowed,
      waitMs,
      quotaRemaining: {
        perSecond: secResult.remaining * units,
        perMinute: minResult.remaining * units,
      },
    };
  }

  /**
   * Peek at quota status without consuming any units
   * Use this for polling/waiting loops to avoid exhausting quota
   */
  async peekUnits(units: number): Promise<RateLimitCheckResult> {
    // Peek both per-second and per-minute limits (read-only, NO consumption)
    const [secResult, minResult] = await Promise.all([
      peekRateLimitAsync(this.userId, {
        ...CALENDAR_RATE_LIMITS.perSecond,
        maxRequests: Math.floor(
          CALENDAR_RATE_LIMITS.perSecond.maxRequests / units
        ),
      }),
      peekRateLimitAsync(this.userId, {
        ...CALENDAR_RATE_LIMITS.perMinute,
        maxRequests: Math.floor(
          CALENDAR_RATE_LIMITS.perMinute.maxRequests / units
        ),
      }),
    ]);

    const allowed = secResult.allowed && minResult.allowed;
    const waitMs = allowed
      ? undefined
      : Math.max(secResult.retryAfterMs || 0, minResult.retryAfterMs || 0);

    return {
      allowed,
      waitMs,
      quotaRemaining: {
        perSecond: secResult.remaining * units,
        perMinute: minResult.remaining * units,
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
    const startTime = Date.now();
    const units = CALENDAR_QUOTA_UNITS[operation];

    while (Date.now() - startTime < timeoutMs) {
      // Use peekUnits to check WITHOUT consuming quota
      const peekResult = await this.peekUnits(units);

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

    throw new CalendarError(
      CalendarErrorCode.RATE_LIMITED,
      `Rate limit timeout after ${timeoutMs}ms for operation ${operation}`,
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
   * Consume a specific number of quota units
   * Uses the same scaling logic as checkUnits for consistency
   */
  async consumeUnits(units: number): Promise<void> {
    // Scale maxRequests by units to properly account for operation cost
    // This is consistent with how checkUnits handles different cost operations
    await Promise.all([
      checkRateLimitAsync(this.userId, {
        ...CALENDAR_RATE_LIMITS.perSecond,
        maxRequests: Math.floor(
          CALENDAR_RATE_LIMITS.perSecond.maxRequests / units
        ),
      }),
      checkRateLimitAsync(this.userId, {
        ...CALENDAR_RATE_LIMITS.perMinute,
        maxRequests: Math.floor(
          CALENDAR_RATE_LIMITS.perMinute.maxRequests / units
        ),
      }),
    ]);
  }

  /**
   * Get current quota status
   */
  async getStatus(): Promise<{
    perSecond: { remaining: number; resetAt: Date };
    perMinute: { remaining: number; resetAt: Date };
  }> {
    const [secResult, minResult] = await Promise.all([
      checkRateLimitAsync(this.userId, CALENDAR_RATE_LIMITS.perSecond),
      checkRateLimitAsync(this.userId, CALENDAR_RATE_LIMITS.perMinute),
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

