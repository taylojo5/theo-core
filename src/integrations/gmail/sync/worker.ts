// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync Worker
// BullMQ worker for processing email sync jobs
// ═══════════════════════════════════════════════════════════════════════════

import { Job } from "bullmq";
import { registerWorker } from "@/lib/queue/workers";
import { QUEUE_NAMES } from "@/lib/queue";
import { db } from "@/lib/db";
import { fullSync, type FullSyncProgress } from "./full-sync";
import {
  incrementalSync,
  type IncrementalSyncProgress,
} from "./incremental-sync";
import { labelRepository, syncStateRepository } from "../repository";
import { createGmailClient } from "../client";
import { mapGmailLabelsToEmailLabels } from "../mappers";
import { GmailError, GmailErrorCode } from "../errors";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import type { GmailLabel } from "../types";
import {
  GMAIL_JOB_NAMES,
  type FullSyncJobData,
  type IncrementalSyncJobData,
  type LabelSyncJobData,
} from "./jobs";

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
  job: Job<FullSyncJobData | IncrementalSyncJobData | LabelSyncJobData>
): Promise<void> {
  const jobName = job.name;
  const startTime = Date.now();

  console.log(`[GmailWorker] Processing job ${job.id}: ${jobName}`);

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

      default:
        console.warn(`[GmailWorker] Unknown job type: ${jobName}`);
    }

    const duration = Date.now() - startTime;
    console.log(`[GmailWorker] Job ${job.id} completed in ${duration}ms`);
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[GmailWorker] Job ${job.id} failed after ${duration}ms:`,
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
  console.log(
    `[GmailWorker] Full sync completed for user ${userId}: ` +
      `${result.added} added, ${result.updated} updated, ${result.total} total`
  );
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
    console.log(
      `[GmailWorker] Incremental sync completed for user ${userId}: ` +
        `+${result.added} -${result.deleted} ~${result.updated}`
    );
  } catch (error) {
    // If history expired, we need a full sync
    if (error instanceof GmailError && error.message.includes("full sync")) {
      console.log(
        `[GmailWorker] History expired for user ${userId}, scheduling full sync`
      );

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

  console.log(`[GmailWorker] Synced ${count} labels for user ${userId}`);
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
    console.error(`[GmailWorker] No valid access token for user ${userId}`);
    return null;
  }

  return accessToken;
}
