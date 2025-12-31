// ═══════════════════════════════════════════════════════════════════════════
// Calendar Sync Worker
// BullMQ worker for processing calendar sync jobs
// ═══════════════════════════════════════════════════════════════════════════

import { Job } from "bullmq";
import { registerWorker } from "@/lib/queue/workers";
import { QUEUE_NAMES } from "@/lib/queue";
import { fullCalendarSync } from "./full-sync";
import { incrementalCalendarSync } from "./incremental-sync";
import { expireOldApprovals } from "../actions/approval";
import {
  CalendarError,
  CalendarErrorCode,
  isSyncTokenExpired,
} from "../errors";
import { workerLogger } from "../logger";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import {
  CALENDAR_JOB_NAMES,
  type FullSyncJobData,
  type IncrementalSyncJobData,
  type ExpireApprovalsJobData,
  type RenewWebhookJobData,
  FullSyncProgress,
  IncrementalSyncProgress,
} from "./jobs";

// ─────────────────────────────────────────────────────────────
// Worker Registration
// ─────────────────────────────────────────────────────────────

/**
 * Register the Calendar sync worker
 *
 * This worker processes:
 * - Full calendar sync jobs
 * - Incremental calendar sync jobs
 * - Webhook renewal jobs
 * - Approval expiration jobs
 *
 * Note: Embedding jobs are processed by the unified embedding worker
 * (see src/lib/queue/embedding-worker.ts)
 */
export function registerCalendarSyncWorker() {
  return registerWorker(
    QUEUE_NAMES.CALENDAR_SYNC,
    processCalendarSyncJob,
    { concurrency: 3 } // Process up to 3 sync jobs at once
  );
}

// ─────────────────────────────────────────────────────────────
// Job Type Union
// ─────────────────────────────────────────────────────────────

type CalendarJobData =
  | FullSyncJobData
  | IncrementalSyncJobData
  | ExpireApprovalsJobData
  | RenewWebhookJobData;

// ─────────────────────────────────────────────────────────────
// Job Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process a Calendar sync job
 */
async function processCalendarSyncJob(
  job: Job<CalendarJobData>
): Promise<void> {
  const jobName = job.name;
  const startTime = Date.now();

  workerLogger.info("Processing job", { jobId: job.id, jobName });

  try {
    switch (jobName) {
      case CALENDAR_JOB_NAMES.FULL_SYNC:
        await processFullSync(job as Job<FullSyncJobData>);
        break;

      case CALENDAR_JOB_NAMES.INCREMENTAL_SYNC:
        await processIncrementalSync(job as Job<IncrementalSyncJobData>);
        break;

      case CALENDAR_JOB_NAMES.EXPIRE_APPROVALS:
        await processExpireApprovals(job as Job<ExpireApprovalsJobData>);
        break;

      default:
        workerLogger.warn("Unknown job type", { jobId: job.id, jobName });
    }

    const duration = Date.now() - startTime;
    workerLogger.info("Job completed", {
      jobId: job.id,
      jobName,
      durationMs: duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    workerLogger.error(
      "Job failed",
      { jobId: job.id, jobName, durationMs: duration },
      error
    );
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Full Sync Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process a full sync job
 */
async function processFullSync(job: Job<FullSyncJobData>): Promise<void> {
  const { userId, options } = job.data;

  // Get access token
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) {
    throw new CalendarError(
      CalendarErrorCode.UNAUTHORIZED,
      "No valid access token found for user",
      false
    );
  }

  // Progress callback to update job progress
  const onProgress = async (progress: FullSyncProgress) => {
    await job.updateProgress({
      phase: progress.phase,
      calendarsProcessed: progress.calendarsProcessed,
      eventsProcessed: progress.eventsProcessed,
      currentCalendar: progress.currentCalendar,
    });
  };

  // Run the full sync
  const result = await fullCalendarSync(
    userId,
    accessToken,
    options,
    onProgress
  );

  // Log the result
  workerLogger.info("Full sync completed", {
    userId,
    calendarsProcessed: result.calendarsProcessed,
    eventsAdded: result.eventsAdded,
    eventsUpdated: result.eventsUpdated,
    eventsDeleted: result.eventsDeleted,
    eventsTotal: result.eventsTotal,
    durationMs: result.durationMs,
  });
}

// ─────────────────────────────────────────────────────────────
// Incremental Sync Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process an incremental sync job
 */
async function processIncrementalSync(
  job: Job<IncrementalSyncJobData>
): Promise<void> {
  const { userId, options } = job.data;

  // Get access token
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) {
    throw new CalendarError(
      CalendarErrorCode.UNAUTHORIZED,
      "No valid access token found for user",
      false
    );
  }

  // Progress callback
  const onProgress = async (progress: IncrementalSyncProgress) => {
    await job.updateProgress({
      phase: progress.phase,
      eventsProcessed: progress.eventsProcessed,
      eventsAdded: progress.eventsAdded,
      eventsUpdated: progress.eventsUpdated,
      eventsDeleted: progress.eventsDeleted,
    });
  };

  try {
    // Run the incremental sync
    const result = await incrementalCalendarSync(
      userId,
      accessToken,
      options,
      onProgress
    );

    // Log the result
    workerLogger.info("Incremental sync completed", {
      userId,
      eventsAdded: result.eventsAdded,
      eventsUpdated: result.eventsUpdated,
      eventsDeleted: result.eventsDeleted,
      durationMs: result.durationMs,
    });
  } catch (error) {
    // If sync token expired, we need a full sync
    if (isSyncTokenExpired(error)) {
      workerLogger.info("Sync token expired, scheduling full sync", { userId });

      // Import here to avoid circular dependency
      const { scheduleFullSync, getCalendarQueue } = await import("./index");
      const queue = getCalendarQueue();
      await scheduleFullSync(queue, userId);

      // Don't throw - we've handled it by scheduling a full sync
      return;
    }

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Approval Expiration Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process an approval expiration job
 * Expires all overdue pending approvals
 */
async function processExpireApprovals(
  job: Job<ExpireApprovalsJobData>
): Promise<void> {
  const { userId } = job.data;

  // If userId is specified, this is for testing/debugging
  if (userId) {
    workerLogger.info("Expiring approvals for specific user", { userId });
  }

  const expiredCount = await expireOldApprovals();

  workerLogger.info("Expired overdue approvals", { expiredCount });

  // Update job progress
  await job.updateProgress({
    expiredCount,
    completedAt: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Get a valid access token for a user
 * Uses the centralized token refresh utility
 */
async function getAccessTokenForUser(userId: string): Promise<string | null> {
  const accessToken = await getValidAccessToken(userId);

  if (!accessToken) {
    workerLogger.error("No valid access token found", { userId });
    return null;
  }

  return accessToken;
}
