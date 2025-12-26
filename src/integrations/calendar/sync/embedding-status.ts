// ═══════════════════════════════════════════════════════════════════════════
// Calendar Event Embedding Status Management
// Handles tracking and updating embedding status for calendar events
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { syncLogger } from "../logger";
import { calendarSyncStateRepository } from "../repository";
import { MAX_EMBEDDING_RETRY_ATTEMPTS } from "../constants";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type EmbeddingStatus = "pending" | "processing" | "completed" | "failed";

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
 * Mark event embedding as started (processing)
 * Returns false if the event no longer exists
 * 
 * Note: Does NOT increment embeddingAttempts here - that happens in
 * markEventEmbeddingFailed() to avoid double-counting attempts.
 */
export async function markEventEmbeddingProcessing(
  eventId: string
): Promise<boolean> {
  try {
    await db.event.update({
      where: { id: eventId },
      data: {
        embeddingStatus: "processing",
      },
    });
    return true;
  } catch (error) {
    // Check if this is a "record not found" error
    if (isRecordNotFoundError(error)) {
      syncLogger.debug("Event not found when marking as processing, skipping", {
        eventId,
      });
      return false;
    }
    throw error;
  }
}

/**
 * Mark event embedding as completed
 * Returns false if the event no longer exists
 */
export async function markEventEmbeddingCompleted(
  eventId: string
): Promise<boolean> {
  try {
    await db.event.update({
      where: { id: eventId },
      data: {
        embeddingStatus: "completed",
        embeddingError: null,
        embeddedAt: new Date(),
      },
    });
    return true;
  } catch (error) {
    // Check if this is a "record not found" error
    if (isRecordNotFoundError(error)) {
      syncLogger.debug("Event not found when marking as completed, skipping", {
        eventId,
      });
      return false;
    }
    throw error;
  }
}

/**
 * Mark event embedding as failed
 * Returns false if the event no longer exists
 */
export async function markEventEmbeddingFailed(
  eventId: string,
  error: string
): Promise<boolean> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { embeddingAttempts: true },
  });

  // If event doesn't exist, nothing to mark as failed
  if (!event) {
    syncLogger.debug("Event not found when marking as failed, skipping", {
      eventId,
      error,
    });
    return false;
  }

  const attempts = event.embeddingAttempts + 1;
  const isPermanentlyFailed = attempts >= MAX_EMBEDDING_RETRY_ATTEMPTS;

  try {
    await db.event.update({
      where: { id: eventId },
      data: {
        embeddingStatus: isPermanentlyFailed ? "failed" : "pending",
        embeddingError: error,
        embeddingAttempts: attempts,
      },
    });
    return true;
  } catch (updateError) {
    // Handle race condition where event was deleted between findUnique and update
    if (isRecordNotFoundError(updateError)) {
      syncLogger.debug("Event deleted during failure marking, skipping", {
        eventId,
      });
      return false;
    }
    throw updateError;
  }
}

/**
 * Check if an error is a Prisma "record not found" error
 */
function isRecordNotFoundError(error: unknown): boolean {
  if (error && typeof error === "object" && "code" in error) {
    // Prisma P2025: "An operation failed because it depends on one or more records that were required but not found."
    return (error as { code: string }).code === "P2025";
  }
  return false;
}

/**
 * Get embedding statistics for a user's calendar events
 */
export async function getEventEmbeddingStats(
  userId: string
): Promise<EmbeddingStats> {
  // Use raw query for efficient aggregation
  const counts = await db.event.groupBy({
    by: ["embeddingStatus"],
    where: { userId, deletedAt: null },
    _count: true,
  });

  const stats: EmbeddingStats = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    total: 0,
  };

  for (const count of counts) {
    const status = count.embeddingStatus as EmbeddingStatus;
    // Prisma groupBy with _count: true returns { _count: { _all: number } }
    const value = typeof count._count === "number" 
      ? count._count 
      : (count._count as { _all?: number })._all ?? 0;
    
    if (status in stats) {
      stats[status] = value;
    }
    stats.total += value;
  }

  return stats;
}

/**
 * Update CalendarSyncState with embedding statistics
 * Call this after embedding jobs complete to update the sync state
 */
export async function updateCalendarEmbeddingStatsInSyncState(
  userId: string
): Promise<void> {
  const stats = await getEventEmbeddingStats(userId);

  syncLogger.debug("Updating calendar embedding stats in sync state", {
    userId,
    ...stats,
  });

  await calendarSyncStateRepository.updateEmbeddingStats(userId, {
    pending: stats.pending,
    completed: stats.completed,
    failed: stats.failed,
  });
}

/**
 * Reset failed embeddings to pending for retry.
 * Resets both the status and the attempt counter so they can be retried.
 */
export async function resetFailedEventEmbeddings(
  userId: string,
  limit?: number
): Promise<number> {
  // If limit is provided, first get the IDs to update
  if (limit) {
    const eventsToReset = await db.event.findMany({
      where: {
        userId,
        embeddingStatus: "failed",
        deletedAt: null,
      },
      select: { id: true },
      take: limit,
    });

    if (eventsToReset.length === 0) {
      return 0;
    }

    const result = await db.event.updateMany({
      where: {
        id: { in: eventsToReset.map((e) => e.id) },
      },
      data: {
        embeddingStatus: "pending",
        embeddingError: null,
        embeddingAttempts: 0,
      },
    });

    return result.count;
  }

  // Otherwise update all failed events
  const result = await db.event.updateMany({
    where: {
      userId,
      embeddingStatus: "failed",
      deletedAt: null,
    },
    data: {
      embeddingStatus: "pending",
      embeddingError: null,
      embeddingAttempts: 0,
    },
  });

  return result.count;
}

/**
 * Get events that need embedding (pending status)
 * Only includes events with attempts less than MAX_EMBEDDING_RETRY_ATTEMPTS.
 * Events with attempts >= MAX are in "failed" status, not "pending".
 */
export async function getEventsNeedingEmbedding(
  userId: string,
  limit: number = 50
): Promise<string[]> {
  const events = await db.event.findMany({
    where: {
      userId,
      embeddingStatus: "pending",
      embeddingAttempts: { lt: MAX_EMBEDDING_RETRY_ATTEMPTS },
      deletedAt: null,
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return events.map((e) => e.id);
}

