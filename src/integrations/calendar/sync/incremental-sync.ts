// ═══════════════════════════════════════════════════════════════════════════
// Calendar Incremental Sync
// Delta updates using Google Calendar sync tokens
// ═══════════════════════════════════════════════════════════════════════════

import { createCalendarClient, CalendarClient } from "../client";
import {
  calendarRepository,
  calendarEventRepository,
  calendarSyncStateRepository,
} from "../repository";
import { mapGoogleEventToDb } from "../mappers";
import {
  CalendarError,
  CalendarErrorCode,
  isSyncTokenExpired,
} from "../errors";
import { syncLogger } from "../logger";
import {
  INCREMENTAL_SYNC_MAX_EVENTS,
  DEFAULT_EVENT_PAGE_SIZE,
} from "../constants";
import {
  queueIncrementalSyncEmbeddings,
  createSyncError,
  updateEmbeddingStats,
} from "./utils";
import { logAuditEntry } from "@/services/audit";
import type { GoogleEvent } from "../types";
import type {
  CalendarSyncResult,
  SyncOperationError,
  IncrementalCalendarSyncOptions,
  IncrementalSyncProgress,
  EventChange,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Default Options
// ─────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<
  Omit<IncrementalCalendarSyncOptions, "syncToken" | "calendarIds">
> = {
  maxEvents: INCREMENTAL_SYNC_MAX_EVENTS,
};

// ─────────────────────────────────────────────────────────────
// Incremental Sync Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Perform an incremental sync using Google Calendar sync tokens
 *
 * This function:
 * 1. Gets the stored sync token from sync state
 * 2. Fetches event changes since that token
 * 3. Processes added, updated, and deleted events
 * 4. Updates the database accordingly
 * 5. Stores the new sync token
 *
 * @param userId - The user ID to sync for
 * @param accessToken - OAuth2 access token
 * @param options - Sync options
 * @param onProgress - Optional progress callback
 * @returns Incremental sync result with statistics
 */
export async function incrementalCalendarSync(
  userId: string,
  accessToken: string,
  options: IncrementalCalendarSyncOptions = {},
  onProgress?: (progress: IncrementalSyncProgress) => void
): Promise<CalendarSyncResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const result: CalendarSyncResult = {
    syncType: "incremental",
    calendarsProcessed: 0,
    eventsAdded: 0,
    eventsUpdated: 0,
    eventsDeleted: 0,
    eventsUnchanged: 0,
    eventsTotal: 0,
    hasMore: false,
    durationMs: 0,
    errors: [],
  };

  try {
    // Mark sync as in progress
    await calendarSyncStateRepository.startSync(userId, "incremental_sync");

    // Create Calendar client
    const client = createCalendarClient(accessToken, userId);

    // Get sync state (contains sync token)
    const syncState = await calendarSyncStateRepository.get(userId);
    const syncToken = opts.syncToken || syncState?.syncToken;

    if (!syncToken) {
      // No sync token means we need a full sync first
      throw new CalendarError(
        CalendarErrorCode.SYNC_REQUIRED,
        "No sync token found. A full sync is required first.",
        false
      );
    }

    onProgress?.({
      phase: "fetching",
      eventsProcessed: 0,
      eventsAdded: 0,
      eventsUpdated: 0,
      eventsDeleted: 0,
    });

    // Get calendars to sync
    const calendars = await getCalendarsToSync(userId, opts.calendarIds);
    result.calendarsProcessed = calendars.length;

    const allNewEventIds: string[] = [];
    let newSyncToken: string | undefined;

    // Sync each calendar
    for (const calendar of calendars) {
      try {
        const {
          changes,
          syncToken: calendarSyncToken,
          hasMore,
        } = await fetchEventChanges(
          client,
          calendar.googleCalendarId,
          syncToken,
          opts.maxEvents
        );

        result.hasMore = result.hasMore || hasMore;
        newSyncToken = calendarSyncToken;

        if (changes.length === 0) {
          syncLogger.debug("No changes for calendar", {
            userId,
            calendarId: calendar.googleCalendarId,
          });
          continue;
        }

        onProgress?.({
          phase: "processing",
          eventsProcessed: result.eventsTotal,
          eventsTotal: changes.length,
          eventsAdded: result.eventsAdded,
          eventsUpdated: result.eventsUpdated,
          eventsDeleted: result.eventsDeleted,
        });

        // Process each change
        const { eventIds, stats } = await processEventChanges(
          userId,
          calendar.id,
          calendar.googleCalendarId,
          changes,
          result.errors
        );

        allNewEventIds.push(...eventIds);
        result.eventsAdded += stats.added;
        result.eventsUpdated += stats.updated;
        result.eventsDeleted += stats.deleted;
        result.eventsTotal += stats.added + stats.updated + stats.deleted;

        syncLogger.debug("Processed calendar changes", {
          userId,
          calendarId: calendar.googleCalendarId,
          added: stats.added,
          updated: stats.updated,
          deleted: stats.deleted,
        });
      } catch (error) {
        // Check for sync token expired (410 Gone)
        if (isSyncTokenExpired(error)) {
          syncLogger.info("Sync token expired, full sync required", {
            userId,
            calendarId: calendar.googleCalendarId,
          });

          // Clear the sync token and throw a specific error
          await calendarSyncStateRepository.update(userId, {
            syncToken: null,
            syncTokenSetAt: null,
          });

          throw new CalendarError(
            CalendarErrorCode.SYNC_REQUIRED,
            "Sync token expired. A full sync is required.",
            false
          );
        }

        const syncError = createSyncError(
          error,
          calendar.googleCalendarId,
          "calendar"
        );
        result.errors.push(syncError);

        syncLogger.error("Failed to sync calendar", {
          userId,
          calendarId: calendar.googleCalendarId,
          error: syncError.message,
        });

        // Continue with other calendars
        continue;
      }
    }

    // Queue embeddings for new/updated events
    if (allNewEventIds.length > 0) {
      await queueIncrementalSyncEmbeddings(userId, allNewEventIds);
      await updateEmbeddingStats(userId, allNewEventIds.length);

      syncLogger.info("Queued event embeddings", {
        userId,
        eventCount: allNewEventIds.length,
      });
    }

    // Update sync state with completion
    await calendarSyncStateRepository.completeSync(userId, {
      eventCount: result.eventsTotal,
      syncToken: newSyncToken,
    });

    result.syncToken = newSyncToken;
    result.durationMs = Date.now() - startTime;

    // Notify completion
    onProgress?.({
      phase: "complete",
      eventsProcessed: result.eventsTotal,
      eventsAdded: result.eventsAdded,
      eventsUpdated: result.eventsUpdated,
      eventsDeleted: result.eventsDeleted,
    });

    // Audit log
    await logAuditEntry({
      userId,
      actionType: "update",
      actionCategory: "integration",
      entityType: "event",
      outputSummary: `Calendar incremental sync: +${result.eventsAdded} ~${result.eventsUpdated} -${result.eventsDeleted}`,
      metadata: {
        syncType: "calendar_incremental",
        calendarsProcessed: result.calendarsProcessed,
        eventsAdded: result.eventsAdded,
        eventsUpdated: result.eventsUpdated,
        eventsDeleted: result.eventsDeleted,
        durationMs: result.durationMs,
        errorCount: result.errors.length,
      },
    });

    syncLogger.info("Incremental calendar sync complete", {
      userId,
      calendarsProcessed: result.calendarsProcessed,
      eventsAdded: result.eventsAdded,
      eventsUpdated: result.eventsUpdated,
      eventsDeleted: result.eventsDeleted,
      durationMs: result.durationMs,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Save error state
    await calendarSyncStateRepository.setError(userId, errorMessage);

    // Re-throw sync required errors without additional logging
    if (
      error instanceof CalendarError &&
      error.code === CalendarErrorCode.SYNC_REQUIRED
    ) {
      throw error;
    }

    // Audit log for failure
    await logAuditEntry({
      userId,
      actionType: "update",
      actionCategory: "integration",
      entityType: "event",
      status: "failed",
      errorMessage,
      metadata: {
        syncType: "calendar_incremental",
        eventsProcessed: result.eventsTotal,
        durationMs: Date.now() - startTime,
      },
    });

    syncLogger.error("Incremental calendar sync failed", {
      userId,
      error: errorMessage,
      eventsProcessed: result.eventsTotal,
    });

    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Get calendars to sync for a user
 */
async function getCalendarsToSync(
  userId: string,
  filterCalendarIds?: string[]
): Promise<Array<{ id: string; googleCalendarId: string }>> {
  // Get selected calendars from database
  const calendars = await calendarRepository.findSelected(userId);

  // Filter if specific calendar IDs provided
  if (filterCalendarIds && filterCalendarIds.length > 0) {
    return calendars.filter((cal) =>
      filterCalendarIds.includes(cal.googleCalendarId)
    );
  }

  return calendars;
}

/**
 * Fetch event changes using sync token
 */
async function fetchEventChanges(
  client: CalendarClient,
  googleCalendarId: string,
  syncToken: string,
  maxEvents: number
): Promise<{
  changes: EventChange[];
  syncToken?: string;
  hasMore: boolean;
}> {
  const changes: EventChange[] = [];
  let pageToken: string | undefined;
  let newSyncToken: string | undefined;
  let hasMore = false;

  do {
    const response = await client.listEvents(googleCalendarId, {
      syncToken,
      pageToken,
      maxResults: Math.min(DEFAULT_EVENT_PAGE_SIZE, maxEvents - changes.length),
      showDeleted: true, // Important for incremental sync to get deletions
    });

    const events = response.items || [];
    newSyncToken = response.nextSyncToken;
    pageToken = response.nextPageToken;

    // Process events into changes
    for (const event of events) {
      if (event.status === "cancelled") {
        // Deleted event
        changes.push({
          type: "deleted",
          eventId: event.id,
          calendarId: googleCalendarId,
        });
      } else {
        // Check if it's a new or updated event
        // We'll determine this in processEventChanges by checking DB
        changes.push({
          type: "added", // Will be updated to "updated" if exists
          eventId: event.id,
          calendarId: googleCalendarId,
          event,
        });
      }
    }

    // Check if we've reached max events
    if (changes.length >= maxEvents) {
      hasMore = !!pageToken;
      break;
    }
  } while (pageToken);

  return { changes, syncToken: newSyncToken, hasMore };
}

/**
 * Process event changes from incremental sync
 */
async function processEventChanges(
  userId: string,
  calendarId: string,
  googleCalendarId: string,
  changes: EventChange[],
  errors: SyncOperationError[]
): Promise<{
  eventIds: string[];
  stats: { added: number; updated: number; deleted: number };
}> {
  const eventIds: string[] = [];
  const stats = { added: 0, updated: 0, deleted: 0 };

  for (const change of changes) {
    try {
      if (change.type === "deleted") {
        // Soft delete the event
        await calendarEventRepository.softDeleteByGoogleId(
          userId,
          change.eventId
        );
        stats.deleted++;
      } else if (change.event) {
        // Check if event exists
        const existing = await calendarEventRepository.findByGoogleId(
          userId,
          change.eventId
        );

        // Map and upsert
        const input = mapGoogleEventToDb(
          change.event,
          userId,
          googleCalendarId,
          calendarId
        );
        const event = await calendarEventRepository.upsert(input);

        eventIds.push(event.id);

        if (existing) {
          stats.updated++;
        } else {
          stats.added++;
        }
      }
    } catch (error) {
      const syncError = createSyncError(error, change.eventId, "event");
      errors.push(syncError);

      syncLogger.warn("Failed to process event change", {
        userId,
        eventId: change.eventId,
        changeType: change.type,
        error: syncError.message,
      });
    }
  }

  return { eventIds, stats };
}

/**
 * Trigger an incremental sync for a user
 * Convenience function that fetches the access token and runs sync
 */
export async function triggerIncrementalSync(
  userId: string,
  accessToken: string
): Promise<CalendarSyncResult> {
  return incrementalCalendarSync(userId, accessToken);
}
