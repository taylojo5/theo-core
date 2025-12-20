// ═══════════════════════════════════════════════════════════════════════════
// Gmail Rate Limiter
// Per-user rate limiting to respect Gmail API quotas
// ═══════════════════════════════════════════════════════════════════════════

import { checkRateLimitAsync, type RateLimitConfig } from "@/lib/rate-limit";
import { GmailError, GmailErrorCode } from "./errors";
import { GMAIL_QUOTA_UNITS, type GmailOperation } from "./types";

// ─────────────────────────────────────────────────────────────
// Rate Limit Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Gmail API rate limits per user
 *
 * Gmail API has two types of limits:
 * 1. Per-user rate limit: 250 quota units per second per user
 * 2. Daily quota: Depends on Google Workspace tier
 *
 * We implement conservative limits to prevent quota exhaustion:
 * - Max 100 units per second (leaving headroom)
 * - Max 15,000 units per minute
 */
export const GMAIL_RATE_LIMITS = {
  /** Per-second limit (in quota units) */
  perSecond: {
    windowMs: 1000,
    maxRequests: 100, // Quota units, not requests
    keyPrefix: "gmail:sec",
  } as RateLimitConfig,

  /** Per-minute limit (in quota units) */
  perMinute: {
    windowMs: 60 * 1000,
    maxRequests: 15000,
    keyPrefix: "gmail:min",
  } as RateLimitConfig,

  /** Batch operation limit (concurrent batch requests) */
  batch: {
    windowMs: 1000,
    maxRequests: 10,
    keyPrefix: "gmail:batch",
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
 * Gmail-specific rate limiter that tracks quota units
 */
export class GmailRateLimiter {
  constructor(private userId: string) {}

  /**
   * Check if an operation is allowed under rate limits
   */
  async check(operation: GmailOperation): Promise<RateLimitCheckResult> {
    const units = GMAIL_QUOTA_UNITS[operation];
    return this.checkUnits(units);
  }

  /**
   * Check if a given number of quota units is allowed
   */
  async checkUnits(units: number): Promise<RateLimitCheckResult> {
    // Check both per-second and per-minute limits
    const [secResult, minResult] = await Promise.all([
      checkRateLimitAsync(this.userId, {
        ...GMAIL_RATE_LIMITS.perSecond,
        maxRequests: Math.floor(
          GMAIL_RATE_LIMITS.perSecond.maxRequests / units
        ),
      }),
      checkRateLimitAsync(this.userId, {
        ...GMAIL_RATE_LIMITS.perMinute,
        maxRequests: Math.floor(
          GMAIL_RATE_LIMITS.perMinute.maxRequests / units
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
   */
  async waitForQuota(
    operation: GmailOperation,
    timeoutMs: number = 30000
  ): Promise<void> {
    const startTime = Date.now();
    const units = GMAIL_QUOTA_UNITS[operation];

    while (Date.now() - startTime < timeoutMs) {
      const result = await this.checkUnits(units);

      if (result.allowed) {
        return;
      }

      // Wait the suggested time or 100ms minimum
      const waitTime = Math.min(
        result.waitMs || 100,
        timeoutMs - (Date.now() - startTime)
      );
      if (waitTime <= 0) break;

      await sleep(waitTime);
    }

    throw new GmailError(
      GmailErrorCode.RATE_LIMITED,
      `Rate limit timeout after ${timeoutMs}ms for operation ${operation}`,
      true,
      1000
    );
  }

  /**
   * Consume quota units after a successful operation
   * This is for tracking purposes - the actual check happens before
   */
  async consume(operation: GmailOperation): Promise<void> {
    const units = GMAIL_QUOTA_UNITS[operation];
    await this.consumeUnits(units);
  }

  /**
   * Consume a specific number of quota units
   */
  async consumeUnits(units: number): Promise<void> {
    // The checkRateLimitAsync already increments the counter
    // This method is here for explicit quota tracking if needed
    await Promise.all([
      checkRateLimitAsync(this.userId, GMAIL_RATE_LIMITS.perSecond),
      checkRateLimitAsync(this.userId, GMAIL_RATE_LIMITS.perMinute),
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
      checkRateLimitAsync(this.userId, GMAIL_RATE_LIMITS.perSecond),
      checkRateLimitAsync(this.userId, GMAIL_RATE_LIMITS.perMinute),
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
export function createRateLimiter(userId: string): GmailRateLimiter {
  return new GmailRateLimiter(userId);
}

/**
 * Calculate total quota units for a batch of operations
 */
export function calculateBatchQuota(operations: GmailOperation[]): number {
  return operations.reduce((total, op) => total + GMAIL_QUOTA_UNITS[op], 0);
}

/**
 * Estimate remaining operations based on current quota
 */
export function estimateRemainingOperations(
  quotaRemaining: number,
  operation: GmailOperation
): number {
  const units = GMAIL_QUOTA_UNITS[operation];
  return Math.floor(quotaRemaining / units);
}
