// ═══════════════════════════════════════════════════════════════════════════
// Gmail Sync Utilities
// Shared utility functions for email sync operations
// ═══════════════════════════════════════════════════════════════════════════

import { addJob, QUEUE_NAMES } from "@/lib/queue";
import { JOB_NAMES } from "@/lib/queue/jobs";
import { gmailLogger } from "../logger";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Default batch size for full sync embedding queue */
export const FULL_SYNC_EMBEDDING_BATCH_SIZE = 20;

/** Default batch size for incremental sync embedding queue (smaller for quicker processing) */
export const INCREMENTAL_SYNC_EMBEDDING_BATCH_SIZE = 10;

// ─────────────────────────────────────────────────────────────
// Embedding Queue Utilities
// ─────────────────────────────────────────────────────────────

export interface QueueEmbeddingsOptions {
  /** Batch size for grouping emails (default: 20) */
  batchSize?: number;
  /** Job priority (lower = higher priority, default: 10) */
  priority?: number;
}

/**
 * Queue embedding generation jobs for a list of emails
 *
 * Splits email IDs into batches and creates individual jobs for each batch.
 * This allows for better parallelization and fault isolation - if one batch
 * fails, others can still succeed.
 *
 * @param userId - The user ID owning the emails
 * @param emailIds - Array of internal email IDs to generate embeddings for
 * @param options - Queue options (batch size, priority)
 * @returns Promise that resolves when all jobs are queued
 *
 * @example
 * ```typescript
 * // Queue with full sync defaults (larger batches, lower priority)
 * await queueEmailEmbeddings(userId, emailIds, {
 *   batchSize: FULL_SYNC_EMBEDDING_BATCH_SIZE,
 *   priority: 10,
 * });
 *
 * // Queue with incremental sync defaults (smaller batches, higher priority)
 * await queueEmailEmbeddings(userId, emailIds, {
 *   batchSize: INCREMENTAL_SYNC_EMBEDDING_BATCH_SIZE,
 *   priority: 5,
 * });
 * ```
 */
export async function queueEmailEmbeddings(
  userId: string,
  emailIds: string[],
  options: QueueEmbeddingsOptions = {}
): Promise<void> {
  const { batchSize = FULL_SYNC_EMBEDDING_BATCH_SIZE, priority = 10 } = options;

  if (emailIds.length === 0) {
    return;
  }

  gmailLogger.debug("Queueing email embeddings", {
    userId,
    emailCount: emailIds.length,
    batchSize,
    batchCount: Math.ceil(emailIds.length / batchSize),
    priority,
  });

  for (let i = 0; i < emailIds.length; i += batchSize) {
    const batch = emailIds.slice(i, i + batchSize);

    await addJob(
      QUEUE_NAMES.EMBEDDINGS,
      JOB_NAMES.BULK_EMAIL_EMBED,
      { userId, emailIds: batch },
      { priority }
    );
  }
}

/**
 * Queue email embeddings for full sync (larger batches, lower priority)
 *
 * Optimized for bulk operations where throughput is more important
 * than latency. Uses larger batches and lower priority.
 *
 * @param userId - The user ID owning the emails
 * @param emailIds - Array of internal email IDs
 */
export async function queueFullSyncEmbeddings(
  userId: string,
  emailIds: string[]
): Promise<void> {
  return queueEmailEmbeddings(userId, emailIds, {
    batchSize: FULL_SYNC_EMBEDDING_BATCH_SIZE,
    priority: 10,
  });
}

/**
 * Queue email embeddings for incremental sync (smaller batches, higher priority)
 *
 * Optimized for real-time updates where latency matters more than
 * throughput. Uses smaller batches and higher priority.
 *
 * @param userId - The user ID owning the emails
 * @param emailIds - Array of internal email IDs
 */
export async function queueIncrementalSyncEmbeddings(
  userId: string,
  emailIds: string[]
): Promise<void> {
  return queueEmailEmbeddings(userId, emailIds, {
    batchSize: INCREMENTAL_SYNC_EMBEDDING_BATCH_SIZE,
    priority: 5,
  });
}
