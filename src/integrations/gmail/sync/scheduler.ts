// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync Scheduler
// Schedule and manage recurring email sync jobs
// ═══════════════════════════════════════════════════════════════════════════

import { addJob, getQueue, QUEUE_NAMES } from "@/lib/queue";
import { syncStateRepository } from "../repository";
import { schedulerLogger } from "../logger";
import {
  GMAIL_JOB_NAMES,
  GMAIL_JOB_OPTIONS,
  INCREMENTAL_SYNC_REPEAT,
  EXPIRE_APPROVALS_REPEAT,
  type FullSyncJobData,
  type IncrementalSyncJobData,
  type LabelSyncJobData,
  type ExpireApprovalsJobData,
  type ContactSyncJobData,
  type MetadataSyncJobData,
} from "./jobs";

// ─────────────────────────────────────────────────────────────
// Schedule Full Sync
// ─────────────────────────────────────────────────────────────

/**
 * Schedule a full email sync for a user
 *
 * @param userId - The user ID to sync
 * @param options - Job options
 * @returns The created job
 */
export async function scheduleFullSync(
  userId: string,
  options?: {
    delay?: number;
    priority?: number;
  }
) {
  const jobData: FullSyncJobData = { userId };

  return addJob(QUEUE_NAMES.EMAIL_SYNC, GMAIL_JOB_NAMES.FULL_SYNC, jobData, {
    delay: options?.delay,
    priority: options?.priority,
    ...GMAIL_JOB_OPTIONS.FULL_SYNC,
  });
}

/**
 * Schedule a full sync immediately (high priority)
 */
export async function triggerFullSync(userId: string) {
  return scheduleFullSync(userId, { priority: 1 });
}

// ─────────────────────────────────────────────────────────────
// Schedule Incremental Sync
// ─────────────────────────────────────────────────────────────

/**
 * Schedule an incremental email sync for a user
 *
 * @param userId - The user ID to sync
 * @param options - Job options
 * @returns The created job
 */
export async function scheduleIncrementalSync(
  userId: string,
  options?: {
    delay?: number;
    priority?: number;
    startHistoryId?: string;
  }
) {
  const jobData: IncrementalSyncJobData = {
    userId,
    startHistoryId: options?.startHistoryId,
  };

  return addJob(
    QUEUE_NAMES.EMAIL_SYNC,
    GMAIL_JOB_NAMES.INCREMENTAL_SYNC,
    jobData,
    {
      delay: options?.delay,
      priority: options?.priority,
      ...GMAIL_JOB_OPTIONS.INCREMENTAL_SYNC,
    }
  );
}

/**
 * Schedule an incremental sync immediately (high priority)
 */
export async function triggerIncrementalSync(userId: string) {
  return scheduleIncrementalSync(userId, { priority: 1 });
}

// ─────────────────────────────────────────────────────────────
// Schedule Repeating Sync
// ─────────────────────────────────────────────────────────────

/**
 * Start recurring incremental sync for a user
 *
 * This creates a repeatable job that runs every 5 minutes
 * to keep the email database in sync with Gmail.
 *
 * @param userId - The user ID to sync
 */
export async function startRecurringSync(userId: string): Promise<void> {
  const jobId = getRecurringSyncJobId(userId);
  const queue = getQueue(QUEUE_NAMES.EMAIL_SYNC);

  schedulerLogger.info("Starting recurring sync", { userId, jobId });

  // Remove existing recurring job if any
  const existingJobs = await queue.getRepeatableJobs();
  schedulerLogger.debug("Existing repeatable jobs before add", {
    userId,
    jobs: existingJobs.map((j) => ({ id: j.id, key: j.key, name: j.name })),
  });

  const existing = existingJobs.find((j) => j.id === jobId);
  if (existing) {
    await queue.removeRepeatableByKey(existing.key);
    schedulerLogger.info("Removed existing recurring job", {
      userId,
      key: existing.key,
    });
  }

  // Update database first to track recurring sync is enabled
  // This ensures hasRecurringSync() returns true even if job creation fails
  await syncStateRepository.update(userId, { recurringEnabled: true });

  // Create new repeatable job
  const jobData: IncrementalSyncJobData = { userId };

  try {
    const job = await queue.add(GMAIL_JOB_NAMES.INCREMENTAL_SYNC, jobData, {
      repeat: {
        every: INCREMENTAL_SYNC_REPEAT.every,
        immediately: INCREMENTAL_SYNC_REPEAT.immediately,
      },
      jobId,
      ...GMAIL_JOB_OPTIONS.INCREMENTAL_SYNC,
    });

    schedulerLogger.info("Started recurring sync", {
      userId,
      jobId,
      createdJobId: job.id,
    });
  } catch (error) {
    // Rollback database state if job creation fails
    await syncStateRepository.update(userId, { recurringEnabled: false });
    schedulerLogger.error(
      "Failed to create recurring job, rolled back",
      { userId },
      error
    );
    throw error;
  }
}

/**
 * Stop recurring incremental sync for a user
 *
 * @param userId - The user ID to stop syncing
 */
export async function stopRecurringSync(userId: string): Promise<void> {
  const jobId = getRecurringSyncJobId(userId);
  const queue = getQueue(QUEUE_NAMES.EMAIL_SYNC);

  // Use removeRepeatable with the exact same parameters used to create the job
  // Both `every` and `immediately` must match the creation parameters
  const removed = await queue.removeRepeatable(
    GMAIL_JOB_NAMES.INCREMENTAL_SYNC,
    {
      every: INCREMENTAL_SYNC_REPEAT.every,
      immediately: INCREMENTAL_SYNC_REPEAT.immediately,
    },
    jobId
  );

  if (removed) {
    schedulerLogger.info("Removed repeatable job", { userId, jobId });
  } else {
    schedulerLogger.warn("No repeatable job found to remove", {
      userId,
      jobId,
    });
  }

  // Update database to track recurring sync is disabled
  // We update even if no job was found (job may have been removed manually or never existed)
  await syncStateRepository.update(userId, { recurringEnabled: false });

  schedulerLogger.info("Stopped recurring sync", { userId });
}

/**
 * Check if a user has recurring sync enabled
 *
 * Uses the database field for reliability since BullMQ's getRepeatableJobs()
 * doesn't reliably return the jobId we passed.
 */
export async function hasRecurringSync(userId: string): Promise<boolean> {
  const syncState = await syncStateRepository.get(userId);
  return syncState.recurringEnabled;
}

/**
 * Get the job ID for a user's recurring sync
 */
function getRecurringSyncJobId(userId: string): string {
  return `gmail-sync-${userId}`;
}

// ─────────────────────────────────────────────────────────────
// Schedule Metadata Sync (Labels + Contacts)
// ─────────────────────────────────────────────────────────────

/**
 * Schedule a metadata sync for a user (labels + contacts only)
 *
 * This is used during initial connection to sync metadata
 * before the user configures their email sync preferences.
 *
 * @param userId - The user ID to sync
 * @param options - Job options
 * @returns The created job
 */
export async function scheduleMetadataSync(
  userId: string,
  options?: {
    delay?: number;
    priority?: number;
  }
) {
  const jobData: MetadataSyncJobData = { userId };

  return addJob(
    QUEUE_NAMES.EMAIL_SYNC,
    GMAIL_JOB_NAMES.SYNC_METADATA,
    jobData,
    {
      delay: options?.delay,
      priority: options?.priority,
      ...GMAIL_JOB_OPTIONS.METADATA_SYNC,
    }
  );
}

/**
 * Trigger metadata sync immediately (high priority)
 */
export async function triggerMetadataSync(userId: string) {
  return scheduleMetadataSync(userId, { priority: 1 });
}

// ─────────────────────────────────────────────────────────────
// Smart Sync (Auto-detect sync type)
// ─────────────────────────────────────────────────────────────

/**
 * Schedule the appropriate sync type for a user
 *
 * - If sync not configured, schedules metadata sync only
 * - If user has never synced emails, schedules a full sync
 * - Otherwise, schedules an incremental sync
 *
 * @param userId - The user ID to sync
 * @returns The created job
 */
export async function scheduleSyncAuto(userId: string) {
  const syncState = await syncStateRepository.get(userId);

  // If sync not configured (no labels selected), sync metadata only
  if (!syncState.syncConfigured || syncState.syncLabels.length === 0) {
    schedulerLogger.info("Sync not configured, scheduling metadata sync", {
      userId,
    });
    return scheduleMetadataSync(userId);
  }

  // If user has synced emails before, do incremental; otherwise full
  const hasEverSynced = await syncStateRepository.hasEverSynced(userId);

  if (hasEverSynced) {
    return scheduleIncrementalSync(userId);
  } else {
    return scheduleFullSync(userId);
  }
}

/**
 * Trigger immediate sync (auto-detect type)
 *
 * - If sync not configured, triggers metadata sync only
 * - If user has never synced emails, triggers full sync
 * - Otherwise, triggers incremental sync
 */
export async function triggerSync(userId: string) {
  const syncState = await syncStateRepository.get(userId);

  // If sync not configured (no labels selected), sync metadata only
  if (!syncState.syncConfigured || syncState.syncLabels.length === 0) {
    schedulerLogger.info("Sync not configured, triggering metadata sync", {
      userId,
    });
    return triggerMetadataSync(userId);
  }

  // If user has synced emails before, do incremental; otherwise full
  const hasEverSynced = await syncStateRepository.hasEverSynced(userId);

  if (hasEverSynced) {
    return triggerIncrementalSync(userId);
  } else {
    return triggerFullSync(userId);
  }
}

// ─────────────────────────────────────────────────────────────
// Label Sync
// ─────────────────────────────────────────────────────────────

/**
 * Schedule a label sync for a user
 */
export async function scheduleLabelSync(userId: string) {
  const jobData: LabelSyncJobData = { userId };

  return addJob(QUEUE_NAMES.EMAIL_SYNC, GMAIL_JOB_NAMES.SYNC_LABELS, jobData);
}

// ─────────────────────────────────────────────────────────────
// Batch Operations
// ─────────────────────────────────────────────────────────────

/**
 * Schedule syncs for multiple users
 * Useful for batch operations or when server restarts
 */
export async function scheduleMultipleUserSyncs(
  userIds: string[],
  options?: {
    staggerDelayMs?: number;
  }
): Promise<number> {
  const staggerDelay = options?.staggerDelayMs || 1000;
  let scheduled = 0;

  for (let i = 0; i < userIds.length; i++) {
    const userId = userIds[i];

    // Stagger jobs to avoid overwhelming the API
    // Wait BEFORE scheduling (except for first job)
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, staggerDelay));
    }

    try {
      await scheduleSyncAuto(userId);
      scheduled++;
    } catch (error) {
      schedulerLogger.error(
        "Failed to schedule sync",
        {
          userId,
        },
        error
      );
    }
  }

  return scheduled;
}

// ─────────────────────────────────────────────────────────────
// Sync Status
// ─────────────────────────────────────────────────────────────

/**
 * Get pending sync jobs for a user
 */
export async function getPendingSyncJobs(userId: string) {
  const queue = getQueue(QUEUE_NAMES.EMAIL_SYNC);

  // Get all waiting and active jobs
  const [waiting, active, delayed] = await Promise.all([
    queue.getWaiting(),
    queue.getActive(),
    queue.getDelayed(),
  ]);

  const allJobs = [...waiting, ...active, ...delayed];

  // Filter jobs for this user
  return allJobs.filter((job) => {
    const data = job.data as FullSyncJobData | IncrementalSyncJobData;
    return data.userId === userId;
  });
}

/**
 * Cancel all pending sync jobs for a user
 */
export async function cancelPendingSyncs(userId: string): Promise<number> {
  const jobs = await getPendingSyncJobs(userId);
  let cancelled = 0;

  for (const job of jobs) {
    try {
      await job.remove();
      cancelled++;
    } catch {
      // Job may have been processed already
    }
  }

  return cancelled;
}

// ─────────────────────────────────────────────────────────────
// Approval Expiration Scheduler
// ─────────────────────────────────────────────────────────────

const EXPIRE_APPROVALS_JOB_ID = "gmail-expire-approvals-recurring";

/**
 * Start the recurring approval expiration job
 *
 * This job runs hourly to check for and expire overdue pending approvals.
 * It should be started once on application startup.
 */
export async function startApprovalExpirationScheduler(): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.EMAIL_SYNC);

  // Remove existing recurring job if any
  const existingJobs = await queue.getRepeatableJobs();
  const existing = existingJobs.find((j) => j.id === EXPIRE_APPROVALS_JOB_ID);
  if (existing) {
    await queue.removeRepeatableByKey(existing.key);
  }

  // Create new repeatable job
  const jobData: ExpireApprovalsJobData = {};

  await queue.add(GMAIL_JOB_NAMES.EXPIRE_APPROVALS, jobData, {
    repeat: {
      every: EXPIRE_APPROVALS_REPEAT.every,
      immediately: EXPIRE_APPROVALS_REPEAT.immediately,
    },
    jobId: EXPIRE_APPROVALS_JOB_ID,
    ...GMAIL_JOB_OPTIONS.EXPIRE_APPROVALS,
  });

  schedulerLogger.info("Started approval expiration scheduler", {
    intervalMs: EXPIRE_APPROVALS_REPEAT.every,
  });
}

/**
 * Stop the recurring approval expiration job
 */
export async function stopApprovalExpirationScheduler(): Promise<void> {
  const queue = getQueue(QUEUE_NAMES.EMAIL_SYNC);

  const repeatableJobs = await queue.getRepeatableJobs();
  const job = repeatableJobs.find((j) => j.id === EXPIRE_APPROVALS_JOB_ID);

  if (job) {
    await queue.removeRepeatableByKey(job.key);
    schedulerLogger.info("Stopped approval expiration scheduler");
  }
}

/**
 * Check if the approval expiration scheduler is running
 */
export async function isApprovalExpirationSchedulerRunning(): Promise<boolean> {
  const queue = getQueue(QUEUE_NAMES.EMAIL_SYNC);
  const repeatableJobs = await queue.getRepeatableJobs();
  return repeatableJobs.some((j) => j.id === EXPIRE_APPROVALS_JOB_ID);
}

/**
 * Trigger approval expiration check immediately
 */
export async function triggerApprovalExpiration(): Promise<void> {
  const jobData: ExpireApprovalsJobData = {};

  await addJob(
    QUEUE_NAMES.EMAIL_SYNC,
    GMAIL_JOB_NAMES.EXPIRE_APPROVALS,
    jobData,
    { priority: 1 }
  );
}

// ─────────────────────────────────────────────────────────────
// Contact Sync Scheduler
// ─────────────────────────────────────────────────────────────

/**
 * Schedule a contact sync for a user
 */
export async function scheduleContactSync(
  userId: string,
  options?: {
    delay?: number;
    priority?: number;
  }
) {
  const jobData: ContactSyncJobData = { userId };

  return addJob(
    QUEUE_NAMES.EMAIL_SYNC,
    GMAIL_JOB_NAMES.SYNC_CONTACTS,
    jobData,
    {
      delay: options?.delay,
      priority: options?.priority,
      ...GMAIL_JOB_OPTIONS.CONTACT_SYNC,
    }
  );
}

/**
 * Trigger contact sync immediately (high priority)
 */
export async function triggerContactSync(userId: string) {
  return scheduleContactSync(userId, { priority: 1 });
}
