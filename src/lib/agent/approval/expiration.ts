// ═══════════════════════════════════════════════════════════════════════════
// Agent Approval Expiration
// Background job and utilities for handling expired approvals
// ═══════════════════════════════════════════════════════════════════════════

import { agentLogger } from "../logger";
import { logAgentAction } from "../audit/service";
import { approvalRepository } from "./repository";
import type {
  ExpirationResult,
  ExpirationOptions,
  DEFAULT_EXPIRATION_MS,
} from "./types";
import type { RiskLevel } from "../constants";

const logger = agentLogger.child("approval-expiration");

// ─────────────────────────────────────────────────────────────
// Default Expiration Configuration
// ─────────────────────────────────────────────────────────────

/**
 * Get default expiration time for a risk level (in milliseconds)
 */
export function getDefaultExpirationMs(riskLevel: RiskLevel): number {
  const expirationMs: Record<RiskLevel, number> = {
    low: 24 * 60 * 60 * 1000, // 24 hours
    medium: 12 * 60 * 60 * 1000, // 12 hours
    high: 4 * 60 * 60 * 1000, // 4 hours
    critical: 1 * 60 * 60 * 1000, // 1 hour
  };

  return expirationMs[riskLevel];
}

/**
 * Check if an expiration time is approaching (warning threshold)
 */
export function isExpirationWarning(expiresAt: Date): boolean {
  const now = new Date();
  const warningThresholdMs = 30 * 60 * 1000; // 30 minutes
  const remainingMs = expiresAt.getTime() - now.getTime();

  return remainingMs > 0 && remainingMs < warningThresholdMs;
}

/**
 * Calculate remaining time until expiration
 */
export function getTimeUntilExpiration(
  expiresAt: Date
): { hours: number; minutes: number; isExpired: boolean } {
  const now = new Date();
  const remainingMs = expiresAt.getTime() - now.getTime();

  if (remainingMs <= 0) {
    return { hours: 0, minutes: 0, isExpired: true };
  }

  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  return { hours, minutes, isExpired: false };
}

// ─────────────────────────────────────────────────────────────
// Expiration Job
// ─────────────────────────────────────────────────────────────

/**
 * Expire all stale approvals
 *
 * This function should be called periodically (e.g., every minute by a cron job
 * or queue worker) to mark expired approvals.
 *
 * @param options - Expiration options
 * @returns Result including expired count and affected plans
 */
export async function expireStaleApprovals(
  options?: ExpirationOptions
): Promise<ExpirationResult> {
  const startTime = Date.now();

  logger.debug("Starting expiration check");

  try {
    // Expire stale approvals in the database
    const { count, planIds } = await approvalRepository.expireStale();

    if (count === 0) {
      return {
        expiredCount: 0,
        expiredIds: [],
        affectedPlanIds: [],
      };
    }

    logger.info("Expired stale approvals", {
      count,
      affectedPlans: planIds.length,
      durationMs: Date.now() - startTime,
    });

    // Optionally handle affected plans
    if (options?.cancelAffectedPlans && planIds.length > 0) {
      for (const planId of planIds) {
        await handleExpiredPlanApproval(planId);
      }
    }

    return {
      expiredCount: count,
      expiredIds: [], // We don't track individual IDs for performance
      affectedPlanIds: planIds,
    };
  } catch (error) {
    logger.error("Error during expiration check", {
      error: error instanceof Error ? error.message : String(error),
    });

    throw error;
  }
}

/**
 * Handle a plan that has an expired approval
 *
 * This can either:
 * - Pause the plan and notify the user
 * - Cancel the plan entirely
 * - Skip the expired step and continue
 *
 * The default behavior is to mark the plan as paused.
 */
async function handleExpiredPlanApproval(planId: string): Promise<void> {
  logger.info("Handling expired approval for plan", { planId });

  // Log the expiration event
  await logAgentAction({
    userId: "system",
    actionType: "expire",
    actionCategory: "agent",
    entityType: "plan",
    entityId: planId,
    intent: "Plan approval expired without user decision",
    status: "completed",
  });

  // Note: Actual plan handling is done by the planning layer
  // This service just marks the approval as expired
}

// ─────────────────────────────────────────────────────────────
// Batch Expiration Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process expirations in batches for large datasets
 *
 * This is useful when there are many approvals to process and
 * we want to avoid overwhelming the database.
 */
export async function processExpirationsInBatches(
  options?: ExpirationOptions
): Promise<ExpirationResult> {
  const batchSize = options?.batchSize ?? 100;
  let totalExpired = 0;
  const allPlanIds = new Set<string>();

  let hasMore = true;
  while (hasMore) {
    const { count, planIds } = await approvalRepository.expireStale();

    totalExpired += count;
    planIds.forEach((id) => allPlanIds.add(id));

    // If we expired less than batch size, we're done
    hasMore = count >= batchSize;

    if (hasMore) {
      // Small delay to prevent database overload
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return {
    expiredCount: totalExpired,
    expiredIds: [],
    affectedPlanIds: Array.from(allPlanIds),
  };
}

// ─────────────────────────────────────────────────────────────
// Expiration Warning Notifications
// ─────────────────────────────────────────────────────────────

/**
 * Get approvals that are about to expire
 *
 * This can be used to send warning notifications to users.
 *
 * @param userId - User to check
 * @param warningMinutes - Minutes before expiration to warn (default: 30)
 */
export async function getApproachingExpirations(
  userId: string,
  warningMinutes: number = 30
): Promise<string[]> {
  const now = new Date();
  const warningThreshold = new Date(now.getTime() + warningMinutes * 60 * 1000);

  // Get pending approvals that will expire within the warning window
  const approvals = await approvalRepository.getPending(userId, {
    includeExpired: false,
    limit: 100,
  });

  return approvals
    .filter(
      (a) =>
        a.expiresAt &&
        a.expiresAt > now &&
        a.expiresAt <= warningThreshold
    )
    .map((a) => a.id);
}

// ─────────────────────────────────────────────────────────────
// Scheduled Job Support
// ─────────────────────────────────────────────────────────────

/**
 * Run the expiration job with configurable interval
 *
 * This creates a recurring job that expires stale approvals.
 * In production, you might want to use a proper job scheduler
 * like BullMQ or a cron-based system.
 *
 * @param intervalMs - Interval between checks (default: 60000ms = 1 minute)
 * @returns Function to stop the job
 */
export function startExpirationJob(intervalMs: number = 60000): () => void {
  let isRunning = true;
  let timeoutId: ReturnType<typeof setTimeout>;

  const runJob = async () => {
    if (!isRunning) return;

    try {
      await expireStaleApprovals();
    } catch (error) {
      logger.error("Expiration job failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (isRunning) {
      timeoutId = setTimeout(runJob, intervalMs);
    }
  };

  // Start the first run
  timeoutId = setTimeout(runJob, intervalMs);

  logger.info("Started expiration job", { intervalMs });

  // Return stop function
  return () => {
    isRunning = false;
    clearTimeout(timeoutId);
    logger.info("Stopped expiration job");
  };
}

/**
 * Run expiration check once (for use with external schedulers)
 *
 * This is the function to call from an external cron job or
 * queue worker.
 */
export async function runExpirationCheck(): Promise<ExpirationResult> {
  return expireStaleApprovals();
}

// ─────────────────────────────────────────────────────────────
// Export Functions
// ─────────────────────────────────────────────────────────────

export const expirationService = {
  // Configuration
  getDefaultExpirationMs,
  isExpirationWarning,
  getTimeUntilExpiration,

  // Expiration processing
  expireStaleApprovals,
  processExpirationsInBatches,

  // Warning notifications
  getApproachingExpirations,

  // Job management
  startExpirationJob,
  runExpirationCheck,
};

