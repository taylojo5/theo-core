// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync Worker
// BullMQ worker for processing email sync jobs
// ═══════════════════════════════════════════════════════════════════════════

import { Job } from "bullmq";
import { registerWorker } from "@/lib/queue/workers";
import { QUEUE_NAMES } from "@/lib/queue";
import { fullSync, type FullSyncProgress } from "./full-sync";
import {
  incrementalSync,
  type IncrementalSyncProgress,
} from "./incremental-sync";
import { labelRepository, syncStateRepository } from "../repository";
import { createGmailClient } from "../client";
import { mapGmailLabelsToEmailLabels } from "../mappers";
import { GmailError, GmailErrorCode } from "../errors";
import { workerLogger } from "../logger";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import type { GmailLabel } from "../types";
import { expireOverdueApprovals } from "../actions/approval";
import { syncContactsForUser } from "./contacts";
import {
  GMAIL_JOB_NAMES,
  type FullSyncJobData,
  type IncrementalSyncJobData,
  type LabelSyncJobData,
  type ExpireApprovalsJobData,
  type ContactSyncJobData,
  type MetadataSyncJobData,
} from "./jobs";
import { syncMetadata } from "./metadata-sync";

// ─────────────────────────────────────────────────────────────
// Worker Registration
// ─────────────────────────────────────────────────────────────

/**
 * Register the Gmail sync worker
 *
 * This worker processes:
 * - Full email sync jobs
 * - Incremental email sync jobs
 * - Label sync jobs
 */
export function registerGmailSyncWorker() {
  return registerWorker(
    QUEUE_NAMES.EMAIL_SYNC,
    processGmailSyncJob,
    { concurrency: 3 } // Process up to 3 sync jobs at once
  );
}

// ─────────────────────────────────────────────────────────────
// Job Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process a Gmail sync job
 */
async function processGmailSyncJob(
  job: Job<
    | FullSyncJobData
    | IncrementalSyncJobData
    | LabelSyncJobData
    | ExpireApprovalsJobData
    | ContactSyncJobData
    | MetadataSyncJobData
  >
): Promise<void> {
  const jobName = job.name;
  const startTime = Date.now();

  workerLogger.info("Processing job", { jobId: job.id, jobName });

  try {
    switch (jobName) {
      case GMAIL_JOB_NAMES.FULL_SYNC:
        await processFullSync(job as Job<FullSyncJobData>);
        break;

      case GMAIL_JOB_NAMES.INCREMENTAL_SYNC:
        await processIncrementalSync(job as Job<IncrementalSyncJobData>);
        break;

      case GMAIL_JOB_NAMES.SYNC_LABELS:
        await processLabelSync(job as Job<LabelSyncJobData>);
        break;

      case GMAIL_JOB_NAMES.EXPIRE_APPROVALS:
        await processExpireApprovals(job as Job<ExpireApprovalsJobData>);
        break;

      case GMAIL_JOB_NAMES.SYNC_CONTACTS:
        await processContactSync(job as Job<ContactSyncJobData>);
        break;

      case GMAIL_JOB_NAMES.SYNC_METADATA:
        await processMetadataSync(job as Job<MetadataSyncJobData>);
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
    throw new GmailError(
      GmailErrorCode.UNAUTHORIZED,
      "No valid access token found for user",
      false
    );
  }

  // Progress callback to update job progress
  const onProgress = async (progress: FullSyncProgress) => {
    await job.updateProgress({
      phase: progress.phase,
      messagesProcessed: progress.messagesProcessed,
      currentPage: progress.currentPage,
    });
  };

  // Run the full sync
  const result = await fullSync(userId, accessToken, options, onProgress);

  // Log the result
  workerLogger.info("Full sync completed", {
    userId,
    added: result.added,
    updated: result.updated,
    total: result.total,
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
  const { userId, startHistoryId, options } = job.data;

  // Get access token
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) {
    throw new GmailError(
      GmailErrorCode.UNAUTHORIZED,
      "No valid access token found for user",
      false
    );
  }

  // Progress callback
  const onProgress = async (progress: IncrementalSyncProgress) => {
    await job.updateProgress({
      phase: progress.phase,
      changesProcessed: progress.changesProcessed,
      messagesAdded: progress.messagesAdded,
      messagesDeleted: progress.messagesDeleted,
    });
  };

  try {
    // Run the incremental sync
    const result = await incrementalSync(
      userId,
      accessToken,
      { startHistoryId, ...options },
      onProgress
    );

    // Log the result
    workerLogger.info("Incremental sync completed", {
      userId,
      added: result.added,
      deleted: result.deleted,
      updated: result.updated,
    });
  } catch (error) {
    // If history expired, we need a full sync
    if (error instanceof GmailError && error.message.includes("full sync")) {
      workerLogger.info("History expired, scheduling full sync", { userId });

      // Import here to avoid circular dependency
      const { scheduleFullSync } = await import("./scheduler");
      await scheduleFullSync(userId);

      // Don't throw - we've handled it by scheduling a full sync
      return;
    }

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Label Sync Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process a label sync job
 */
async function processLabelSync(job: Job<LabelSyncJobData>): Promise<void> {
  const { userId } = job.data;

  // Get access token
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) {
    throw new GmailError(
      GmailErrorCode.UNAUTHORIZED,
      "No valid access token found for user",
      false
    );
  }

  // Create client and sync labels
  const client = createGmailClient(accessToken, userId);
  const labels = await client.listLabels();

  // Store labels
  const labelInputs = mapGmailLabelsToEmailLabels(
    labels as GmailLabel[],
    userId
  );
  const count = await labelRepository.upsertMany(labelInputs);

  // Update sync state
  await syncStateRepository.update(userId, {
    labelCount: count,
    lastSyncAt: new Date(),
  });

  workerLogger.info("Synced labels", { userId, labelCount: count });
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

  const expiredCount = await expireOverdueApprovals();

  workerLogger.info("Expired overdue approvals", { expiredCount });

  // Update job progress
  await job.updateProgress({
    expiredCount,
    completedAt: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────────────────────
// Contact Sync Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process a contact sync job
 */
async function processContactSync(job: Job<ContactSyncJobData>): Promise<void> {
  const { userId } = job.data;

  workerLogger.info("Syncing contacts", { userId });

  // Get access token (following the pattern from processIncrementalSync)
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) {
    throw new GmailError(
      GmailErrorCode.UNAUTHORIZED,
      "No valid access token found for user",
      false
    );
  }

  const result = await syncContactsForUser(userId, async () => accessToken);

  // Check for errors (ContactSyncResult has 'errors' array, not 'success' boolean)
  if (result.errors && result.errors.length > 0) {
    workerLogger.warn("Contact sync had errors", {
      userId,
      errorCount: result.errors.length,
      errors: result.errors.slice(0, 5), // Log first 5 errors
    });
    // Only throw if no contacts were synced successfully
    if (result.created === 0 && result.updated === 0) {
      throw new Error(result.errors[0].message);
    }
  }

  workerLogger.info("Contact sync completed", {
    userId,
    created: result.created,
    updated: result.updated,
  });

  await job.updateProgress({
    created: result.created,
    updated: result.updated,
    total: result.total,
  });
}

// ─────────────────────────────────────────────────────────────
// Metadata Sync Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process a metadata sync job
 * Syncs labels and contacts without syncing emails
 */
async function processMetadataSync(
  job: Job<MetadataSyncJobData>
): Promise<void> {
  const { userId } = job.data;

  workerLogger.info("Syncing metadata (labels + contacts)", { userId });

  // Get access token
  const accessToken = await getAccessTokenForUser(userId);
  if (!accessToken) {
    throw new GmailError(
      GmailErrorCode.UNAUTHORIZED,
      "No valid access token found for user",
      false
    );
  }

  // Progress callback
  const onProgress = async (progress: {
    phase: string;
    labelsCount?: number;
    contactsProcessed?: number;
  }) => {
    await job.updateProgress({
      phase: progress.phase,
      labelsCount: progress.labelsCount,
      contactsProcessed: progress.contactsProcessed,
    });
  };

  const result = await syncMetadata(userId, accessToken, onProgress);

  workerLogger.info("Metadata sync completed", {
    userId,
    labels: result.labels.count,
    contacts: result.contacts.total,
    durationMs: result.durationMs,
  });

  await job.updateProgress({
    phase: "complete",
    labels: result.labels.count,
    contactsCreated: result.contacts.created,
    contactsUpdated: result.contacts.updated,
  });
}
