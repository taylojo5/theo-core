// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync Scheduler
// Schedule and manage recurring email sync jobs
// ═══════════════════════════════════════════════════════════════════════════

import { addJob, getQueue, QUEUE_NAMES } from "@/lib/queue";
import { syncStateRepository } from "../repository";
import {
  GMAIL_JOB_NAMES,
  GMAIL_JOB_OPTIONS,
  INCREMENTAL_SYNC_REPEAT,
  type FullSyncJobData,
  type IncrementalSyncJobData,
  type LabelSyncJobData,
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

  // Remove existing recurring job if any
  const existingJob = await queue.getRepeatableJobs();
  const existing = existingJob.find((j) => j.id === jobId);
  if (existing) {
    await queue.removeRepeatableByKey(existing.key);
  }

  // Create new repeatable job
  const jobData: IncrementalSyncJobData = { userId };

  await queue.add(GMAIL_JOB_NAMES.INCREMENTAL_SYNC, jobData, {
    repeat: {
      every: INCREMENTAL_SYNC_REPEAT.every,
      immediately: INCREMENTAL_SYNC_REPEAT.immediately,
    },
    jobId,
    ...GMAIL_JOB_OPTIONS.INCREMENTAL_SYNC,
  });

  console.log(`[Scheduler] Started recurring sync for user ${userId}`);
}

/**
 * Stop recurring incremental sync for a user
 *
 * @param userId - The user ID to stop syncing
 */
export async function stopRecurringSync(userId: string): Promise<void> {
  const jobId = getRecurringSyncJobId(userId);
  const queue = getQueue(QUEUE_NAMES.EMAIL_SYNC);

  // Find and remove the repeatable job
  const repeatableJobs = await queue.getRepeatableJobs();
  const job = repeatableJobs.find((j) => j.id === jobId);

  if (job) {
    await queue.removeRepeatableByKey(job.key);
    console.log(`[Scheduler] Stopped recurring sync for user ${userId}`);
  }
}

/**
 * Check if a user has recurring sync enabled
 */
export async function hasRecurringSync(userId: string): Promise<boolean> {
  const jobId = getRecurringSyncJobId(userId);
  const queue = getQueue(QUEUE_NAMES.EMAIL_SYNC);

  const repeatableJobs = await queue.getRepeatableJobs();
  return repeatableJobs.some((j) => j.id === jobId);
}

/**
 * Get the job ID for a user's recurring sync
 */
function getRecurringSyncJobId(userId: string): string {
  return `gmail-sync-${userId}`;
}

// ─────────────────────────────────────────────────────────────
// Smart Sync (Auto-detect sync type)
// ─────────────────────────────────────────────────────────────

/**
 * Schedule the appropriate sync type for a user
 *
 * If the user has never synced, schedules a full sync.
 * Otherwise, schedules an incremental sync.
 *
 * @param userId - The user ID to sync
 * @returns The created job
 */
export async function scheduleSyncAuto(userId: string) {
  const hasEverSynced = await syncStateRepository.hasEverSynced(userId);

  if (hasEverSynced) {
    return scheduleIncrementalSync(userId);
  } else {
    return scheduleFullSync(userId);
  }
}

/**
 * Trigger immediate sync (auto-detect type)
 */
export async function triggerSync(userId: string) {
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
      console.error(
        `[Scheduler] Failed to schedule sync for ${userId}:`,
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
