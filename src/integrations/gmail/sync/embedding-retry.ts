// ═══════════════════════════════════════════════════════════════════════════
// Email Embedding Retry Mechanism
// Handles retrying failed email embeddings with exponential backoff
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { generateEmailEmbedding } from "../embeddings";
import { syncLogger } from "../logger";
import {
  MAX_EMBEDDING_RETRY_ATTEMPTS,
  EMBEDDING_RETRY_BATCH_SIZE,
  EMBEDDING_RETRY_DELAY_MS,
} from "../constants";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type EmbeddingStatus = "pending" | "processing" | "completed" | "failed";

export interface EmbeddingRetryResult {
  /** Total emails processed */
  processed: number;
  /** Successfully embedded */
  succeeded: number;
  /** Failed (will retry) */
  failed: number;
  /** Permanently failed (max retries reached) */
  permanentlyFailed: number;
  /** Duration in milliseconds */
  durationMs: number;
}

export interface EmbeddingStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}

// ─────────────────────────────────────────────────────────────
// Embedding Status Management
// ─────────────────────────────────────────────────────────────

/**
 * Mark email embedding as started (processing)
 */
export async function markEmbeddingProcessing(emailId: string): Promise<void> {
  await db.email.update({
    where: { id: emailId },
    data: {
      embeddingStatus: "processing",
      embeddingAttempts: { increment: 1 },
    },
  });
}

/**
 * Mark email embedding as completed
 */
export async function markEmbeddingCompleted(emailId: string): Promise<void> {
  await db.email.update({
    where: { id: emailId },
    data: {
      embeddingStatus: "completed",
      embeddingError: null,
      embeddedAt: new Date(),
    },
  });
}

/**
 * Mark email embedding as failed
 */
export async function markEmbeddingFailed(
  emailId: string,
  error: string
): Promise<void> {
  const email = await db.email.findUnique({
    where: { id: emailId },
    select: { embeddingAttempts: true },
  });

  const attempts = (email?.embeddingAttempts ?? 0) + 1;
  const isPermanentlyFailed = attempts >= MAX_EMBEDDING_RETRY_ATTEMPTS;

  await db.email.update({
    where: { id: emailId },
    data: {
      embeddingStatus: isPermanentlyFailed ? "failed" : "pending",
      embeddingError: error,
      embeddingAttempts: attempts,
    },
  });
}

/**
 * Reset failed embeddings to pending for retry
 */
export async function resetFailedEmbeddings(
  userId: string,
  limit?: number
): Promise<number> {
  // If limit is provided, first get the IDs to update
  if (limit) {
    const emailsToReset = await db.email.findMany({
      where: {
        userId,
        embeddingStatus: "failed",
        embeddingAttempts: { lt: MAX_EMBEDDING_RETRY_ATTEMPTS },
      },
      select: { id: true },
      take: limit,
    });

    if (emailsToReset.length === 0) {
      return 0;
    }

    const result = await db.email.updateMany({
      where: {
        id: { in: emailsToReset.map((e) => e.id) },
      },
      data: {
        embeddingStatus: "pending",
        embeddingError: null,
      },
    });

    return result.count;
  }

  // No limit - update all matching records
  const result = await db.email.updateMany({
    where: {
      userId,
      embeddingStatus: "failed",
      embeddingAttempts: { lt: MAX_EMBEDDING_RETRY_ATTEMPTS },
    },
    data: {
      embeddingStatus: "pending",
      embeddingError: null,
    },
  });

  return result.count;
}

// ─────────────────────────────────────────────────────────────
// Embedding Statistics
// ─────────────────────────────────────────────────────────────

/**
 * Get embedding statistics for a user
 */
export async function getEmbeddingStats(
  userId: string
): Promise<EmbeddingStats> {
  const [pending, processing, completed, failed] = await Promise.all([
    db.email.count({ where: { userId, embeddingStatus: "pending" } }),
    db.email.count({ where: { userId, embeddingStatus: "processing" } }),
    db.email.count({ where: { userId, embeddingStatus: "completed" } }),
    db.email.count({ where: { userId, embeddingStatus: "failed" } }),
  ]);

  return {
    pending,
    processing,
    completed,
    failed,
    total: pending + processing + completed + failed,
  };
}

/**
 * Update sync state with embedding statistics
 */
export async function updateEmbeddingStatsInSyncState(
  userId: string
): Promise<void> {
  const stats = await getEmbeddingStats(userId);

  await db.gmailSyncState.update({
    where: { userId },
    data: {
      embeddingsPending: stats.pending,
      embeddingsCompleted: stats.completed,
      embeddingsFailed: stats.failed,
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Retry Processing
// ─────────────────────────────────────────────────────────────

/**
 * Get emails that need embedding (pending status)
 */
export async function getEmailsNeedingEmbedding(
  userId: string,
  limit: number = EMBEDDING_RETRY_BATCH_SIZE
): Promise<string[]> {
  const emails = await db.email.findMany({
    where: {
      userId,
      embeddingStatus: "pending",
      embeddingAttempts: { lt: MAX_EMBEDDING_RETRY_ATTEMPTS },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return emails.map((e) => e.id);
}

/**
 * Process a single email for embedding with status tracking
 */
export async function processEmailEmbedding(emailId: string): Promise<boolean> {
  const email = await db.email.findUnique({
    where: { id: emailId },
  });

  if (!email) {
    syncLogger.warn("Email not found for embedding", { emailId });
    return false;
  }

  try {
    await markEmbeddingProcessing(emailId);
    const result = await generateEmailEmbedding(email);

    if (result.success) {
      await markEmbeddingCompleted(emailId);
      return true;
    } else {
      await markEmbeddingFailed(emailId, result.error || "Unknown error");
      return false;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await markEmbeddingFailed(emailId, message);
    return false;
  }
}

/**
 * Retry failed embeddings for a user
 *
 * This function:
 * 1. Finds emails with pending/failed embedding status
 * 2. Processes them in batches
 * 3. Updates embedding status after each attempt
 * 4. Respects max retry limits
 */
export async function retryFailedEmbeddings(
  userId: string,
  options: {
    maxRetries?: number;
    batchSize?: number;
  } = {}
): Promise<EmbeddingRetryResult> {
  const startTime = Date.now();
  const batchSize = options.batchSize ?? EMBEDDING_RETRY_BATCH_SIZE;

  const result: EmbeddingRetryResult = {
    processed: 0,
    succeeded: 0,
    failed: 0,
    permanentlyFailed: 0,
    durationMs: 0,
  };

  syncLogger.info("Starting embedding retry", {
    userId,
    batchSize,
  });

  // Get emails needing embedding
  const emailIds = await getEmailsNeedingEmbedding(userId, batchSize);

  if (emailIds.length === 0) {
    syncLogger.info("No emails need embedding retry", { userId });
    result.durationMs = Date.now() - startTime;
    return result;
  }

  // Process emails in batches (use smaller concurrent batches for API rate limiting)
  const concurrentBatchSize = Math.min(5, batchSize);
  for (let i = 0; i < emailIds.length; i += concurrentBatchSize) {
    const batch = emailIds.slice(i, i + concurrentBatchSize);

    const batchResults = await Promise.all(
      batch.map(async (emailId) => {
        const success = await processEmailEmbedding(emailId);
        return { emailId, success };
      })
    );

    for (const { success } of batchResults) {
      result.processed++;
      if (success) {
        result.succeeded++;
      } else {
        result.failed++;
      }
    }

    // Small delay between batches
    if (i + concurrentBatchSize < emailIds.length) {
      await new Promise((resolve) =>
        setTimeout(resolve, EMBEDDING_RETRY_DELAY_MS)
      );
    }
  }

  // Count permanently failed
  result.permanentlyFailed = await db.email.count({
    where: {
      userId,
      embeddingStatus: "failed",
      embeddingAttempts: { gte: MAX_EMBEDDING_RETRY_ATTEMPTS },
    },
  });

  result.durationMs = Date.now() - startTime;

  // Update sync state stats
  await updateEmbeddingStatsInSyncState(userId);

  syncLogger.info("Embedding retry completed", {
    userId,
    ...result,
  });

  return result;
}

/**
 * Queue embedding retry job for a user
 */
export async function queueEmbeddingRetry(userId: string): Promise<void> {
  const { addJob, QUEUE_NAMES } = await import("@/lib/queue");
  const { JOB_NAMES } = await import("@/lib/queue/jobs");

  await addJob(
    QUEUE_NAMES.EMBEDDINGS,
    JOB_NAMES.RETRY_FAILED_EMBEDDINGS,
    { userId },
    { priority: 15 } // Lower priority than new embeddings
  );
}
