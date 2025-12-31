// ═══════════════════════════════════════════════════════════════════════════
// Calendar Sync Module
// Full and incremental sync for Google Calendar integration
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Sync result types
  CalendarSyncType,
  CalendarSyncResult,
  SyncOperationError,

  // Full sync types
  FullCalendarSyncOptions,
  FullSyncCheckpoint,
  FullSyncProgress,

  // Incremental sync types
  IncrementalCalendarSyncOptions,
  IncrementalSyncProgress,
  EventChange,

  // Status types
  SyncStatus,
  SyncState,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Job Definitions
// ─────────────────────────────────────────────────────────────

export { CALENDAR_JOB_NAMES } from "./jobs";

export type {
  // Job name type
  CalendarJobName,

  // Job data types (canonical definitions)
  FullSyncJobData,
  IncrementalSyncJobData,
  ProcessWebhookJobData,
  RenewWebhookJobData,
  ExpireApprovalsJobData,
  BulkEventEmbedJobData,

  // Job result types
  SyncJobResult,
  WebhookJobResult,
  EmbeddingJobResult,
} from "./jobs";

// ─────────────────────────────────────────────────────────────
// Metadata Sync (calendars only, no events)
// ─────────────────────────────────────────────────────────────

export {
  syncCalendarMetadata,
  getCalendarsWithSyncEligibility,
  enableCalendarSync,
  disableCalendarSync,
  countEnabledCalendars,
  canSyncEventDetails,
  SYNCABLE_ACCESS_ROLES,
} from "./metadata-sync";

export type {
  CalendarMetadataSyncResult,
  CalendarMetadataInfo,
} from "./metadata-sync";

// ─────────────────────────────────────────────────────────────
// Full Sync
// ─────────────────────────────────────────────────────────────

export { fullCalendarSync, resumeFullSync } from "./full-sync";

// ─────────────────────────────────────────────────────────────
// Incremental Sync
// ─────────────────────────────────────────────────────────────

export {
  incrementalCalendarSync,
  triggerIncrementalSync,
} from "./incremental-sync";

// ─────────────────────────────────────────────────────────────
// Webhooks
// ─────────────────────────────────────────────────────────────

export {
  registerWebhook,
  stopWebhook,
  processWebhookNotification,
  parseWebhookHeaders,
  renewExpiringWebhooks,
  needsRenewal,
} from "./webhook";

export type {
  WebhookRegistration,
  WebhookNotification,
  WebhookProcessResult,
} from "./webhook";

// ─────────────────────────────────────────────────────────────
// Scheduler
// ─────────────────────────────────────────────────────────────

export {
  // One-time job scheduling
  scheduleFullSync,
  scheduleIncrementalSync,
  scheduleWebhookProcessing,
  scheduleWebhookRenewal,

  // Recurring job management
  startRecurringSync,
  stopRecurringSync,
  startWebhookRenewalScheduler,
  stopWebhookRenewalScheduler,
  startApprovalExpirationScheduler,
  stopApprovalExpirationScheduler,

  // Scheduler initialization
  initializeSchedulers,
  shutdownSchedulers,

  // Utilities
  hasRecurringSyncActive,
} from "./scheduler";

export type { CalendarJobQueue, SchedulerConfig } from "./scheduler";

// ─────────────────────────────────────────────────────────────
// Worker
// ─────────────────────────────────────────────────────────────

export { registerCalendarSyncWorker } from "./worker";

// ─────────────────────────────────────────────────────────────
// Initialization
// ─────────────────────────────────────────────────────────────

import { getQueue, QUEUE_NAMES } from "@/lib/queue";
import { initializeSchedulers, type CalendarJobQueue } from "./scheduler";
import { registerCalendarSyncWorker } from "./worker";
import { schedulerLogger } from "../logger";

/**
 * Create a queue adapter that wraps the BullMQ queue to match CalendarJobQueue interface.
 *
 * This adapter is exported for use by API routes and other code that needs to
 * schedule calendar jobs (e.g., webhook handlers, connect endpoints).
 *
 * @example
 * ```ts
 * import { getCalendarQueue, scheduleIncrementalSync } from '@/integrations/calendar';
 *
 * const queue = getCalendarQueue();
 * await scheduleIncrementalSync(queue, userId);
 * ```
 */
export function getCalendarQueue(): CalendarJobQueue {
  const queue = getQueue(QUEUE_NAMES.CALENDAR_SYNC);

  return {
    async add(name, data, options) {
      const job = await queue.add(name, data, {
        delay: options?.delay,
        attempts: options?.attempts,
        backoff: options?.backoff,
        removeOnComplete: options?.removeOnComplete,
        removeOnFail: options?.removeOnFail,
        jobId: options?.jobId,
        repeat: options?.repeat,
      });
      return { id: job.id ?? "", name: job.name };
    },

    async removeRepeatable(name, repeatOpts) {
      const repeatableJobs = await queue.getRepeatableJobs();
      const job = repeatableJobs.find(
        (j) =>
          j.name === name &&
          j.every !== null &&
          String(j.every) === String(repeatOpts.every)
      );
      if (job) {
        await queue.removeRepeatableByKey(job.key);
        return true;
      }
      return false;
    },

    async getRepeatableJobs() {
      const jobs = await queue.getRepeatableJobs();
      return jobs.map((j) => ({ name: j.name, id: j.id ?? undefined }));
    },
  };
}

/**
 * Initialize the Calendar sync system
 *
 * This should be called once on application startup.
 * It registers the BullMQ worker and starts the webhook renewal
 * and approval expiration schedulers.
 *
 * @example
 * ```ts
 * // In your server initialization file
 * import { initializeCalendarSync } from '@/integrations/calendar';
 *
 * await initializeCalendarSync();
 * ```
 */
export async function initializeCalendarSync(): Promise<void> {
  try {
    // Register the worker to process sync jobs
    registerCalendarSyncWorker();
    schedulerLogger.info("Calendar sync worker registered");

    const queue = getCalendarQueue();

    // Initialize schedulers (webhook renewal + approval expiration)
    await initializeSchedulers({
      queue,
      enableRecurringSync: false, // Per-user sync is enabled when user connects calendar
      enableWebhookRenewal: true,
      enableApprovalExpiration: true,
    });

    schedulerLogger.info("Calendar sync system initialized");
  } catch (error) {
    schedulerLogger.error("Failed to initialize Calendar sync system", {
      error,
    });
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Embedding Status Tracking
// ─────────────────────────────────────────────────────────────

export {
  // Status management
  markEventEmbeddingProcessing,
  markEventEmbeddingCompleted,
  markEventEmbeddingFailed,

  // Stats retrieval
  getEventEmbeddingStats,
  updateCalendarEmbeddingStatsInSyncState,

  // Retry utilities
  resetFailedEventEmbeddings,
  getEventsNeedingEmbedding,
} from "./embedding-status";

export type { EmbeddingStatus, EmbeddingStats } from "./embedding-status";

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

export {
  // Embedding utilities
  queueEventEmbeddings,
  queueFullSyncEmbeddings,
  queueIncrementalSyncEmbeddings,

  // Checkpoint utilities
  saveCheckpoint,
  getCheckpoint,
  clearCheckpoint,

  // Time range utilities
  getDefaultSyncTimeRange,
  formatDateForApi,

  // Error utilities
  createSyncError,

  // Statistics utilities
  updateEmbeddingStats,
} from "./utils";

export type { QueueEmbeddingsOptions } from "./utils";
