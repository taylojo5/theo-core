// ═══════════════════════════════════════════════════════════════════════════
// Calendar Sync Scheduler
// Scheduled jobs for calendar sync and webhook management
// ═══════════════════════════════════════════════════════════════════════════

import { schedulerLogger } from "../logger";
import {
  INCREMENTAL_SYNC_INTERVAL_MS,
  WEBHOOK_EXPIRATION_CHECK_INTERVAL_MS,
  APPROVAL_EXPIRATION_CHECK_INTERVAL_MS,
  FULL_SYNC_JOB_ATTEMPTS,
  INCREMENTAL_SYNC_JOB_ATTEMPTS,
  FULL_SYNC_BACKOFF_DELAY_MS,
  INCREMENTAL_SYNC_BACKOFF_DELAY_MS,
  FULL_SYNC_JOBS_RETAIN_COMPLETED,
  FULL_SYNC_JOBS_RETAIN_FAILED,
  INCREMENTAL_SYNC_JOBS_RETAIN_COMPLETED,
  INCREMENTAL_SYNC_JOBS_RETAIN_FAILED,
} from "../constants";
import { CALENDAR_JOB_NAMES } from "./jobs";
import type {
  FullSyncJobData,
  IncrementalSyncJobData,
  ProcessWebhookJobData,
  RenewWebhookJobData,
  ExpireApprovalsJobData,
} from "./jobs";
import type { FullCalendarSyncOptions, IncrementalCalendarSyncOptions } from "./types";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Queue interface for scheduling jobs
 * This allows decoupling from the specific queue implementation
 */
export interface CalendarJobQueue {
  add<T>(
    name: string,
    data: T,
    options?: {
      delay?: number;
      attempts?: number;
      backoff?: { type: "exponential"; delay: number };
      removeOnComplete?: number | boolean;
      removeOnFail?: number | boolean;
      jobId?: string;
      repeat?: {
        every: number;
        limit?: number;
      };
    }
  ): Promise<{ id: string; name: string }>;

  removeRepeatable(name: string, repeatOpts: { every: number }): Promise<boolean>;

  getRepeatableJobs(): Promise<Array<{ name: string; id?: string }>>;
}

/**
 * Scheduler configuration
 */
export interface SchedulerConfig {
  /** Queue for adding jobs */
  queue: CalendarJobQueue;
  /** Whether to enable recurring sync jobs */
  enableRecurringSync?: boolean;
  /** Whether to enable webhook renewal */
  enableWebhookRenewal?: boolean;
  /** Whether to enable approval expiration checks */
  enableApprovalExpiration?: boolean;
}

// ─────────────────────────────────────────────────────────────
// One-Time Job Scheduling
// ─────────────────────────────────────────────────────────────

/**
 * Schedule a full calendar sync job
 *
 * @param queue - Job queue to add to
 * @param userId - User ID to sync
 * @param options - Full sync options
 * @returns Job info
 */
export async function scheduleFullSync(
  queue: CalendarJobQueue,
  userId: string,
  options?: FullCalendarSyncOptions
): Promise<{ jobId: string }> {
  const jobData: FullSyncJobData = {
    userId,
    options,
  };

  const job = await queue.add(CALENDAR_JOB_NAMES.FULL_SYNC, jobData, {
    attempts: FULL_SYNC_JOB_ATTEMPTS,
    backoff: { type: "exponential", delay: FULL_SYNC_BACKOFF_DELAY_MS },
    removeOnComplete: FULL_SYNC_JOBS_RETAIN_COMPLETED,
    removeOnFail: FULL_SYNC_JOBS_RETAIN_FAILED,
    jobId: `full-sync-${userId}`,
  });

  schedulerLogger.info("Scheduled full sync job", {
    userId,
    jobId: job.id,
  });

  return { jobId: job.id };
}

/**
 * Schedule an incremental calendar sync job
 *
 * @param queue - Job queue to add to
 * @param userId - User ID to sync
 * @param options - Incremental sync options
 * @param delayMs - Optional delay before running
 * @returns Job info
 */
export async function scheduleIncrementalSync(
  queue: CalendarJobQueue,
  userId: string,
  options?: IncrementalCalendarSyncOptions,
  delayMs?: number
): Promise<{ jobId: string }> {
  const jobData: IncrementalSyncJobData = {
    userId,
    options,
  };

  const job = await queue.add(CALENDAR_JOB_NAMES.INCREMENTAL_SYNC, jobData, {
    delay: delayMs,
    attempts: INCREMENTAL_SYNC_JOB_ATTEMPTS,
    backoff: { type: "exponential", delay: INCREMENTAL_SYNC_BACKOFF_DELAY_MS },
    removeOnComplete: INCREMENTAL_SYNC_JOBS_RETAIN_COMPLETED,
    removeOnFail: INCREMENTAL_SYNC_JOBS_RETAIN_FAILED,
    jobId: `incremental-sync-${userId}-${Date.now()}`,
  });

  schedulerLogger.debug("Scheduled incremental sync job", {
    userId,
    jobId: job.id,
    delay: delayMs,
  });

  return { jobId: job.id };
}

/**
 * Schedule a webhook processing job
 *
 * @param queue - Job queue to add to
 * @param data - Webhook notification data
 * @returns Job info
 */
export async function scheduleWebhookProcessing(
  queue: CalendarJobQueue,
  data: ProcessWebhookJobData
): Promise<{ jobId: string }> {
  const job = await queue.add(CALENDAR_JOB_NAMES.PROCESS_WEBHOOK, data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: 100,
    removeOnFail: 200,
    jobId: `webhook-${data.channelId}-${Date.now()}`,
  });

  schedulerLogger.debug("Scheduled webhook processing job", {
    userId: data.userId,
    channelId: data.channelId,
    jobId: job.id,
  });

  return { jobId: job.id };
}

/**
 * Schedule a webhook renewal job
 *
 * @param queue - Job queue to add to
 * @param userId - User ID to renew webhook for
 * @param delayMs - Optional delay before running
 * @returns Job info
 */
export async function scheduleWebhookRenewal(
  queue: CalendarJobQueue,
  userId: string,
  delayMs?: number
): Promise<{ jobId: string }> {
  const jobData: RenewWebhookJobData = { userId };

  const job = await queue.add(CALENDAR_JOB_NAMES.RENEW_WEBHOOK, jobData, {
    delay: delayMs,
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 50,
    removeOnFail: 100,
    jobId: `renew-webhook-${userId}`,
  });

  schedulerLogger.debug("Scheduled webhook renewal job", {
    userId,
    jobId: job.id,
    delay: delayMs,
  });

  return { jobId: job.id };
}

// ─────────────────────────────────────────────────────────────
// Recurring Job Management
// ─────────────────────────────────────────────────────────────

/**
 * Start recurring incremental sync for a user
 *
 * @param queue - Job queue to add to
 * @param userId - User ID to sync
 */
export async function startRecurringSync(
  queue: CalendarJobQueue,
  userId: string
): Promise<void> {
  const jobData: IncrementalSyncJobData = { userId };

  await queue.add(CALENDAR_JOB_NAMES.INCREMENTAL_SYNC, jobData, {
    repeat: {
      every: INCREMENTAL_SYNC_INTERVAL_MS,
    },
    jobId: `recurring-sync-${userId}`,
    attempts: INCREMENTAL_SYNC_JOB_ATTEMPTS,
    backoff: { type: "exponential", delay: INCREMENTAL_SYNC_BACKOFF_DELAY_MS },
    removeOnComplete: INCREMENTAL_SYNC_JOBS_RETAIN_COMPLETED,
    removeOnFail: INCREMENTAL_SYNC_JOBS_RETAIN_FAILED,
  });

  schedulerLogger.info("Started recurring sync", {
    userId,
    intervalMs: INCREMENTAL_SYNC_INTERVAL_MS,
  });
}

/**
 * Stop recurring incremental sync for a user
 *
 * @param queue - Job queue
 * @param userId - User ID to stop sync for
 */
export async function stopRecurringSync(
  queue: CalendarJobQueue,
  userId: string
): Promise<void> {
  await queue.removeRepeatable(CALENDAR_JOB_NAMES.INCREMENTAL_SYNC, {
    every: INCREMENTAL_SYNC_INTERVAL_MS,
  });

  schedulerLogger.info("Stopped recurring sync", { userId });
}

/**
 * Start the global webhook renewal scheduler
 *
 * @param queue - Job queue to add to
 */
export async function startWebhookRenewalScheduler(
  queue: CalendarJobQueue
): Promise<void> {
  const jobData: RenewWebhookJobData = { userId: "" }; // Empty userId = process all

  await queue.add(CALENDAR_JOB_NAMES.RENEW_WEBHOOK, jobData, {
    repeat: {
      every: WEBHOOK_EXPIRATION_CHECK_INTERVAL_MS,
    },
    jobId: "webhook-renewal-scheduler",
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 10,
    removeOnFail: 20,
  });

  schedulerLogger.info("Started webhook renewal scheduler", {
    intervalMs: WEBHOOK_EXPIRATION_CHECK_INTERVAL_MS,
  });
}

/**
 * Stop the global webhook renewal scheduler
 *
 * @param queue - Job queue
 */
export async function stopWebhookRenewalScheduler(
  queue: CalendarJobQueue
): Promise<void> {
  await queue.removeRepeatable(CALENDAR_JOB_NAMES.RENEW_WEBHOOK, {
    every: WEBHOOK_EXPIRATION_CHECK_INTERVAL_MS,
  });

  schedulerLogger.info("Stopped webhook renewal scheduler");
}

/**
 * Start the global approval expiration scheduler
 *
 * @param queue - Job queue to add to
 */
export async function startApprovalExpirationScheduler(
  queue: CalendarJobQueue
): Promise<void> {
  const jobData: ExpireApprovalsJobData = {};

  await queue.add(CALENDAR_JOB_NAMES.EXPIRE_APPROVALS, jobData, {
    repeat: {
      every: APPROVAL_EXPIRATION_CHECK_INTERVAL_MS,
    },
    jobId: "approval-expiration-scheduler",
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 10,
    removeOnFail: 20,
  });

  schedulerLogger.info("Started approval expiration scheduler", {
    intervalMs: APPROVAL_EXPIRATION_CHECK_INTERVAL_MS,
  });
}

/**
 * Stop the global approval expiration scheduler
 *
 * @param queue - Job queue
 */
export async function stopApprovalExpirationScheduler(
  queue: CalendarJobQueue
): Promise<void> {
  await queue.removeRepeatable(CALENDAR_JOB_NAMES.EXPIRE_APPROVALS, {
    every: APPROVAL_EXPIRATION_CHECK_INTERVAL_MS,
  });

  schedulerLogger.info("Stopped approval expiration scheduler");
}

// ─────────────────────────────────────────────────────────────
// Scheduler Initialization
// ─────────────────────────────────────────────────────────────

/**
 * Initialize all calendar schedulers
 *
 * @param config - Scheduler configuration
 */
export async function initializeSchedulers(config: SchedulerConfig): Promise<void> {
  const {
    queue,
    enableRecurringSync = false,
    enableWebhookRenewal = true,
    enableApprovalExpiration = true,
  } = config;

  schedulerLogger.info("Initializing calendar schedulers", {
    enableRecurringSync,
    enableWebhookRenewal,
    enableApprovalExpiration,
  });

  // Note: Per-user recurring sync is started when user enables calendar integration
  // This just logs that we're not auto-starting global recurring sync

  if (enableWebhookRenewal) {
    await startWebhookRenewalScheduler(queue);
  }

  if (enableApprovalExpiration) {
    await startApprovalExpirationScheduler(queue);
  }

  schedulerLogger.info("Calendar schedulers initialized");
}

/**
 * Shutdown all calendar schedulers
 *
 * @param queue - Job queue
 */
export async function shutdownSchedulers(queue: CalendarJobQueue): Promise<void> {
  schedulerLogger.info("Shutting down calendar schedulers");

  await stopWebhookRenewalScheduler(queue);
  await stopApprovalExpirationScheduler(queue);

  schedulerLogger.info("Calendar schedulers shut down");
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Check if a user has recurring sync enabled
 *
 * @param queue - Job queue
 * @param userId - User ID to check
 * @returns Whether recurring sync is active
 */
export async function hasRecurringSyncActive(
  queue: CalendarJobQueue,
  userId: string
): Promise<boolean> {
  const repeatableJobs = await queue.getRepeatableJobs();
  return repeatableJobs.some(
    job => job.name === CALENDAR_JOB_NAMES.INCREMENTAL_SYNC && job.id?.includes(userId)
  );
}

