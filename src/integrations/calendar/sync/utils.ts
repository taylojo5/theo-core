// ═══════════════════════════════════════════════════════════════════════════
// Calendar Sync Utilities
// Shared utility functions for calendar sync operations
// ═══════════════════════════════════════════════════════════════════════════

import { addJob, QUEUE_NAMES } from "@/lib/queue";
import { syncLogger } from "../logger";
import { CALENDAR_JOB_NAMES } from "./jobs";
import {
  FULL_SYNC_EMBEDDING_BATCH_SIZE,
  INCREMENTAL_SYNC_EMBEDDING_BATCH_SIZE,
} from "../constants";
import type { FullSyncCheckpoint } from "./types";
import { calendarSyncStateRepository } from "../repository";

// ─────────────────────────────────────────────────────────────
// Embedding Queue Utilities
// ─────────────────────────────────────────────────────────────

export interface QueueEmbeddingsOptions {
  /** Batch size for grouping events (default: 20) */
  batchSize?: number;
  /** Job priority (lower = higher priority, default: 10) */
  priority?: number;
}

/**
 * Queue embedding generation jobs for a list of events
 *
 * Splits event IDs into batches and creates individual jobs for each batch.
 * This allows for better parallelization and fault isolation - if one batch
 * fails, others can still succeed.
 *
 * @param userId - The user ID owning the events
 * @param eventIds - Array of internal event IDs to generate embeddings for
 * @param options - Queue options (batch size, priority)
 * @returns Promise that resolves when all jobs are queued
 *
 * @example
 * ```typescript
 * // Queue with full sync defaults (larger batches, lower priority)
 * await queueEventEmbeddings(userId, eventIds, {
 *   batchSize: FULL_SYNC_EMBEDDING_BATCH_SIZE,
 *   priority: 10,
 * });
 *
 * // Queue with incremental sync defaults (smaller batches, higher priority)
 * await queueEventEmbeddings(userId, eventIds, {
 *   batchSize: INCREMENTAL_SYNC_EMBEDDING_BATCH_SIZE,
 *   priority: 5,
 * });
 * ```
 */
export async function queueEventEmbeddings(
  userId: string,
  eventIds: string[],
  options: QueueEmbeddingsOptions = {}
): Promise<void> {
  const { batchSize = FULL_SYNC_EMBEDDING_BATCH_SIZE, priority = 10 } = options;

  if (eventIds.length === 0) {
    return;
  }

  syncLogger.debug("Queueing event embeddings", {
    userId,
    eventCount: eventIds.length,
    batchSize,
    batchCount: Math.ceil(eventIds.length / batchSize),
    priority,
  });

  for (let i = 0; i < eventIds.length; i += batchSize) {
    const batch = eventIds.slice(i, i + batchSize);

    await addJob(
      QUEUE_NAMES.EMBEDDINGS,
      CALENDAR_JOB_NAMES.BULK_EVENT_EMBED,
      { userId, eventIds: batch },
      { priority }
    );
  }
}

/**
 * Queue event embeddings for full sync (larger batches, lower priority)
 *
 * Optimized for bulk operations where throughput is more important
 * than latency. Uses larger batches and lower priority.
 *
 * @param userId - The user ID owning the events
 * @param eventIds - Array of internal event IDs
 */
export async function queueFullSyncEmbeddings(
  userId: string,
  eventIds: string[]
): Promise<void> {
  return queueEventEmbeddings(userId, eventIds, {
    batchSize: FULL_SYNC_EMBEDDING_BATCH_SIZE,
    priority: 10,
  });
}

/**
 * Queue event embeddings for incremental sync (smaller batches, higher priority)
 *
 * Optimized for real-time updates where latency matters more than
 * throughput. Uses smaller batches and higher priority.
 *
 * @param userId - The user ID owning the events
 * @param eventIds - Array of internal event IDs
 */
export async function queueIncrementalSyncEmbeddings(
  userId: string,
  eventIds: string[]
): Promise<void> {
  return queueEventEmbeddings(userId, eventIds, {
    batchSize: INCREMENTAL_SYNC_EMBEDDING_BATCH_SIZE,
    priority: 5,
  });
}

// ─────────────────────────────────────────────────────────────
// Checkpoint Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Save a sync checkpoint for resumable full sync
 *
 * Stores progress in the CalendarSyncState for the user so that
 * if the sync is interrupted, it can resume from this point.
 *
 * @param userId - The user ID
 * @param checkpoint - Checkpoint data to save
 */
export async function saveCheckpoint(
  userId: string,
  checkpoint: FullSyncCheckpoint
): Promise<void> {
  await calendarSyncStateRepository.update(userId, {
    fullSyncPageToken: checkpoint.pageToken,
    fullSyncProgress: checkpoint.eventsProcessed,
    fullSyncStartedAt: checkpoint.startedAt,
  });

  syncLogger.debug("Saved sync checkpoint", {
    userId,
    calendarId: checkpoint.currentCalendarId,
    progress: checkpoint.eventsProcessed,
    calendarsCompleted: checkpoint.calendarsCompleted,
  });
}

/**
 * Get the current sync checkpoint for a user
 *
 * Returns the saved checkpoint if one exists, allowing sync to resume
 * from where it left off.
 *
 * @param userId - The user ID
 * @returns Checkpoint data or null if no checkpoint exists
 */
export async function getCheckpoint(
  userId: string
): Promise<FullSyncCheckpoint | null> {
  const syncState = await calendarSyncStateRepository.get(userId);

  if (!syncState || !syncState.fullSyncStartedAt) {
    return null;
  }

  // If no page token and no progress, there's no valid checkpoint
  if (!syncState.fullSyncPageToken && syncState.fullSyncProgress === 0) {
    return null;
  }

  return {
    pageToken: syncState.fullSyncPageToken ?? undefined,
    eventsProcessed: syncState.fullSyncProgress,
    calendarsCompleted: 0, // We don't track this separately
    calendarsTotal: syncState.calendarCount || 0,
    startedAt: syncState.fullSyncStartedAt,
  };
}

/**
 * Clear the sync checkpoint after successful completion
 *
 * @param userId - The user ID
 */
export async function clearCheckpoint(userId: string): Promise<void> {
  await calendarSyncStateRepository.clearFullSyncCheckpoint(userId);
  syncLogger.debug("Cleared sync checkpoint", { userId });
}

// ─────────────────────────────────────────────────────────────
// Time Range Utilities
// ─────────────────────────────────────────────────────────────

import {
  FULL_SYNC_LOOKBACK_DAYS,
  FULL_SYNC_LOOKAHEAD_DAYS,
} from "../constants";

/**
 * Get the default time range for calendar sync
 *
 * @returns Object with timeMin and timeMax dates
 */
export function getDefaultSyncTimeRange(): { timeMin: Date; timeMax: Date } {
  const now = new Date();

  // Look back N days
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - FULL_SYNC_LOOKBACK_DAYS);

  // Look ahead N days
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + FULL_SYNC_LOOKAHEAD_DAYS);

  return { timeMin, timeMax };
}

/**
 * Format a Date for the Google Calendar API
 *
 * @param date - JavaScript Date object
 * @returns RFC3339 formatted date string
 */
export function formatDateForApi(date: Date): string {
  return date.toISOString();
}

// ─────────────────────────────────────────────────────────────
// Error Utilities
// ─────────────────────────────────────────────────────────────

import type { SyncOperationError } from "./types";

/**
 * Create a sync error object from an exception
 *
 * @param error - The caught error
 * @param resourceId - ID of the resource that failed
 * @param resourceType - Type of resource
 * @returns SyncOperationError object
 */
export function createSyncError(
  error: unknown,
  resourceId: string,
  resourceType: "calendar" | "event"
): SyncOperationError {
  const message = error instanceof Error ? error.message : String(error);
  const code = error instanceof Error && "code" in error ? String((error as { code?: unknown }).code) : undefined;

  // Determine if error is retryable
  const retryable =
    message.includes("rate limit") ||
    message.includes("timeout") ||
    message.includes("503") ||
    message.includes("429");

  return {
    resourceId,
    resourceType,
    message,
    code,
    retryable,
  };
}

// ─────────────────────────────────────────────────────────────
// Statistics Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Update embedding statistics after sync
 *
 * @param userId - The user ID
 * @param pending - Number of pending embeddings
 */
export async function updateEmbeddingStats(
  userId: string,
  pending: number
): Promise<void> {
  await calendarSyncStateRepository.incrementEmbeddingStats(userId, {
    pending,
  });
}

