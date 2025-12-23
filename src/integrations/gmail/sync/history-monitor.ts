// ═══════════════════════════════════════════════════════════════════════════
// Gmail History ID Expiration Monitor
// Proactively monitors and warns about history ID expiration
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { syncLogger } from "../logger";
import { HISTORY_ID_WARNING_DAYS } from "../constants";
import { addJob, QUEUE_NAMES } from "@/lib/queue";
import { JOB_NAMES } from "@/lib/queue/jobs";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface HistoryIdStatus {
  userId: string;
  historyId: string | null;
  historyIdSetAt: Date | null;
  ageInDays: number | null;
  isExpiringSoon: boolean;
  isExpired: boolean;
  daysUntilExpiration: number | null;
  lastSyncAt: Date | null;
  lastFullSyncAt: Date | null;
  requiresFullSync: boolean;
}

export interface HistoryIdMonitorResult {
  /** Total users checked */
  totalUsers: number;
  /** Users with healthy history IDs */
  healthy: number;
  /** Users with expiring history IDs (warning) */
  expiringSoon: number;
  /** Users with expired history IDs (need full sync) */
  expired: number;
  /** Users requiring full sync */
  fullSyncsScheduled: number;
  /** User details */
  users: HistoryIdStatus[];
  /** Timestamp */
  timestamp: string;
}

// ─────────────────────────────────────────────────────────────
// History ID Age Calculation
// ─────────────────────────────────────────────────────────────

/**
 * Calculate the age of a history ID in days
 */
export function calculateHistoryIdAge(setAt: Date | null): number | null {
  if (!setAt) return null;
  const now = new Date();
  const ageMs = now.getTime() - setAt.getTime();
  return Math.floor(ageMs / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days until history ID expiration
 * Gmail history IDs expire after approximately 30 days
 */
export function calculateDaysUntilExpiration(
  setAt: Date | null
): number | null {
  if (!setAt) return null;
  const ageInDays = calculateHistoryIdAge(setAt);
  if (ageInDays === null) return null;
  return Math.max(0, 30 - ageInDays);
}

/**
 * Check if a history ID is expiring soon
 */
export function isHistoryIdExpiringSoon(setAt: Date | null): boolean {
  const daysUntilExpiration = calculateDaysUntilExpiration(setAt);
  if (daysUntilExpiration === null) return false;
  return daysUntilExpiration <= 30 - HISTORY_ID_WARNING_DAYS;
}

/**
 * Check if a history ID is expired (or likely expired)
 */
export function isHistoryIdExpired(setAt: Date | null): boolean {
  const daysUntilExpiration = calculateDaysUntilExpiration(setAt);
  if (daysUntilExpiration === null) return false;
  return daysUntilExpiration <= 0;
}

// ─────────────────────────────────────────────────────────────
// User History Status
// ─────────────────────────────────────────────────────────────

/**
 * Get history ID status for a single user
 */
export async function getHistoryIdStatus(
  userId: string
): Promise<HistoryIdStatus | null> {
  const syncState = await db.gmailSyncState.findUnique({
    where: { userId },
    select: {
      historyId: true,
      historyIdSetAt: true,
      lastSyncAt: true,
      lastFullSyncAt: true,
      syncStatus: true,
    },
  });

  if (!syncState) {
    return null;
  }

  const ageInDays = calculateHistoryIdAge(syncState.historyIdSetAt);
  const daysUntilExpiration = calculateDaysUntilExpiration(
    syncState.historyIdSetAt
  );
  const expiringSoon = isHistoryIdExpiringSoon(syncState.historyIdSetAt);
  const expired = isHistoryIdExpired(syncState.historyIdSetAt);

  return {
    userId,
    historyId: syncState.historyId,
    historyIdSetAt: syncState.historyIdSetAt,
    ageInDays,
    isExpiringSoon: expiringSoon,
    isExpired: expired,
    daysUntilExpiration,
    lastSyncAt: syncState.lastSyncAt,
    lastFullSyncAt: syncState.lastFullSyncAt,
    requiresFullSync: expired || !syncState.historyId,
  };
}

/**
 * Get history ID status for all Gmail users
 */
export async function getAllHistoryIdStatuses(): Promise<HistoryIdStatus[]> {
  const syncStates = await db.gmailSyncState.findMany({
    select: {
      userId: true,
      historyId: true,
      historyIdSetAt: true,
      lastSyncAt: true,
      lastFullSyncAt: true,
    },
  });

  return syncStates.map((state) => {
    const ageInDays = calculateHistoryIdAge(state.historyIdSetAt);
    const daysUntilExpiration = calculateDaysUntilExpiration(
      state.historyIdSetAt
    );
    const expiringSoon = isHistoryIdExpiringSoon(state.historyIdSetAt);
    const expired = isHistoryIdExpired(state.historyIdSetAt);

    return {
      userId: state.userId,
      historyId: state.historyId,
      historyIdSetAt: state.historyIdSetAt,
      ageInDays,
      isExpiringSoon: expiringSoon,
      isExpired: expired,
      daysUntilExpiration,
      lastSyncAt: state.lastSyncAt,
      lastFullSyncAt: state.lastFullSyncAt,
      requiresFullSync: expired || !state.historyId,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Monitor and Auto-Remediation
// ─────────────────────────────────────────────────────────────

/**
 * Run the history ID expiration monitor
 *
 * This function:
 * 1. Checks all Gmail sync states
 * 2. Identifies users with expiring/expired history IDs
 * 3. Optionally schedules full syncs for expired users
 * 4. Logs warnings for expiring users
 */
export async function runHistoryIdMonitor(
  options: {
    autoScheduleFullSync?: boolean;
    userId?: string; // Optional: check only a specific user
  } = {}
): Promise<HistoryIdMonitorResult> {
  const { autoScheduleFullSync = false, userId } = options;

  syncLogger.info("Starting history ID expiration monitor", {
    autoScheduleFullSync,
    targetUserId: userId || "all",
  });

  // Get statuses
  let statuses: HistoryIdStatus[];
  if (userId) {
    const status = await getHistoryIdStatus(userId);
    statuses = status ? [status] : [];
  } else {
    statuses = await getAllHistoryIdStatuses();
  }

  const result: HistoryIdMonitorResult = {
    totalUsers: statuses.length,
    healthy: 0,
    expiringSoon: 0,
    expired: 0,
    fullSyncsScheduled: 0,
    users: statuses,
    timestamp: new Date().toISOString(),
  };

  for (const status of statuses) {
    if (status.isExpired) {
      result.expired++;

      // Log warning
      syncLogger.warn("History ID expired - full sync required", {
        userId: status.userId,
        ageInDays: status.ageInDays,
        lastFullSyncAt: status.lastFullSyncAt?.toISOString(),
      });

      // Schedule full sync if enabled
      if (autoScheduleFullSync) {
        await scheduleFullSyncForExpiredHistory(status.userId);
        result.fullSyncsScheduled++;
      }
    } else if (status.isExpiringSoon) {
      result.expiringSoon++;

      // Log warning
      syncLogger.warn("History ID expiring soon - consider full sync", {
        userId: status.userId,
        daysUntilExpiration: status.daysUntilExpiration,
        ageInDays: status.ageInDays,
      });

      // Proactively schedule full sync if auto-schedule enabled and very close to expiration
      if (autoScheduleFullSync && (status.daysUntilExpiration ?? 30) <= 2) {
        await scheduleFullSyncForExpiredHistory(status.userId);
        result.fullSyncsScheduled++;
      }
    } else {
      result.healthy++;
    }
  }

  syncLogger.info("History ID monitor completed", {
    totalUsers: result.totalUsers,
    healthy: result.healthy,
    expiringSoon: result.expiringSoon,
    expired: result.expired,
    fullSyncsScheduled: result.fullSyncsScheduled,
  });

  return result;
}

/**
 * Schedule a full sync for a user with expired history ID
 */
async function scheduleFullSyncForExpiredHistory(
  userId: string
): Promise<void> {
  syncLogger.info("Scheduling full sync due to expired history ID", { userId });

  await addJob(
    QUEUE_NAMES.EMAIL_SYNC,
    JOB_NAMES.SYNC_GMAIL,
    {
      userId,
      syncType: "full",
      reason: "history_id_expired",
    },
    { priority: 5 } // Higher priority than normal syncs
  );
}

// ─────────────────────────────────────────────────────────────
// Update History ID Tracking
// ─────────────────────────────────────────────────────────────

/**
 * Update the history ID with timestamp for expiration tracking
 * Should be called when a new history ID is obtained from Gmail
 */
export async function updateHistoryIdWithTimestamp(
  userId: string,
  historyId: string
): Promise<void> {
  await db.gmailSyncState.update({
    where: { userId },
    data: {
      historyId,
      historyIdSetAt: new Date(),
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Admin API Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Get a summary of history ID health across all users
 */
export async function getHistoryIdHealthSummary(): Promise<{
  total: number;
  healthy: number;
  warning: number;
  critical: number;
  details: Array<{
    userId: string;
    status: "healthy" | "warning" | "critical";
    daysUntilExpiration: number | null;
  }>;
}> {
  const statuses = await getAllHistoryIdStatuses();

  const summary = {
    total: statuses.length,
    healthy: 0,
    warning: 0,
    critical: 0,
    details: [] as Array<{
      userId: string;
      status: "healthy" | "warning" | "critical";
      daysUntilExpiration: number | null;
    }>,
  };

  for (const status of statuses) {
    let healthStatus: "healthy" | "warning" | "critical";

    if (status.isExpired) {
      healthStatus = "critical";
      summary.critical++;
    } else if (status.isExpiringSoon) {
      healthStatus = "warning";
      summary.warning++;
    } else {
      healthStatus = "healthy";
      summary.healthy++;
    }

    summary.details.push({
      userId: status.userId,
      status: healthStatus,
      daysUntilExpiration: status.daysUntilExpiration,
    });
  }

  return summary;
}
