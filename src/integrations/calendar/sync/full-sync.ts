// ═══════════════════════════════════════════════════════════════════════════
// Calendar Full Sync
// Initial import of all calendar events with checkpoint-based resumption
// ═══════════════════════════════════════════════════════════════════════════

import { createCalendarClient, CalendarClient } from "../client";
import {
  calendarRepository,
  calendarEventRepository,
  calendarSyncStateRepository,
} from "../repository";
import {
  mapGoogleCalendarToDb,
  mapGoogleEventToDb,
} from "../mappers";
import { syncLogger } from "../logger";
import {
  FULL_SYNC_MAX_PAGES,
  DEFAULT_EVENT_PAGE_SIZE,
} from "../constants";
import {
  queueFullSyncEmbeddings,
  saveCheckpoint,
  getCheckpoint,
  clearCheckpoint,
  getDefaultSyncTimeRange,
  formatDateForApi,
  createSyncError,
  updateEmbeddingStats,
} from "./utils";
import { logAuditEntry } from "@/services/audit";
import type { GoogleEvent, GoogleCalendar } from "../types";
import type {
  CalendarSyncResult,
  SyncOperationError,
  FullCalendarSyncOptions,
  FullSyncCheckpoint,
  FullSyncProgress,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Default Options
// ─────────────────────────────────────────────────────────────

/**
 * Get default options for full sync
 */
function getDefaultOptions(): Required<Omit<FullCalendarSyncOptions, "calendarIds" | "excludeCalendarIds" | "timeMin" | "timeMax">> & {
  calendarIds?: string[];
  excludeCalendarIds?: string[];
  timeMin?: Date;
  timeMax?: Date;
} {
  return {
    maxEventsPerCalendar: 10000,
    calendarIds: undefined,
    excludeCalendarIds: undefined,
    timeMin: undefined,
    timeMax: undefined,
    singleEvents: true,
    pageSize: DEFAULT_EVENT_PAGE_SIZE,
    resumeFromCheckpoint: false,
  };
}

// ─────────────────────────────────────────────────────────────
// Full Sync Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Perform a full sync of Google Calendar events
 *
 * This function:
 * 1. Syncs all calendars from Google Calendar
 * 2. For each selected calendar, fetches all events (paginated)
 * 3. Stores events in the database
 * 4. Saves checkpoints for resumption
 * 5. Queues embeddings for new events
 * 6. Updates sync state with new sync token
 *
 * @param userId - The user ID to sync for
 * @param accessToken - OAuth2 access token
 * @param options - Sync options
 * @param onProgress - Optional progress callback
 * @returns Full sync result with statistics
 */
export async function fullCalendarSync(
  userId: string,
  accessToken: string,
  options: FullCalendarSyncOptions = {},
  onProgress?: (progress: FullSyncProgress) => void
): Promise<CalendarSyncResult> {
  const startTime = Date.now();
  const opts = { ...getDefaultOptions(), ...options };

  const result: CalendarSyncResult = {
    syncType: "full",
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

  // Check for existing checkpoint if resuming
  let checkpoint: FullSyncCheckpoint | null = null;
  if (opts.resumeFromCheckpoint) {
    checkpoint = await getCheckpoint(userId);
    if (checkpoint) {
      result.eventsTotal = checkpoint.eventsProcessed;
      syncLogger.info("Resuming full sync from checkpoint", {
        userId,
        progress: checkpoint.eventsProcessed,
        startedAt: checkpoint.startedAt,
      });
    }
  }

  try {
    // Mark sync as in progress
    await calendarSyncStateRepository.startSync(userId, "full_sync");

    // Create Calendar client
    const client = createCalendarClient(accessToken, userId);

    // Step 1: Sync calendars
    onProgress?.({
      phase: "calendars",
      calendarsProcessed: 0,
      calendarsTotal: 0,
      eventsProcessed: result.eventsTotal,
    });

    const calendars = await syncCalendars(client, userId, opts);
    result.calendarsProcessed = calendars.length;

    syncLogger.info("Synced calendars", {
      userId,
      calendarCount: calendars.length,
    });

    // Initialize checkpoint if starting fresh
    if (!checkpoint) {
      await saveCheckpoint(userId, {
        eventsProcessed: 0,
        calendarsCompleted: 0,
        calendarsTotal: calendars.length,
        startedAt: new Date(),
      });
    }

    // Step 2: Get time range for events
    const { timeMin, timeMax } = opts.timeMin && opts.timeMax
      ? { timeMin: opts.timeMin, timeMax: opts.timeMax }
      : getDefaultSyncTimeRange();

    // Step 3: Sync events for each calendar
    const allNewEventIds: string[] = [];
    let calendarsCompleted = checkpoint?.calendarsCompleted || 0;
    let lastSyncToken: string | undefined;

    for (let i = 0; i < calendars.length; i++) {
      const calendar = calendars[i];

      // Skip calendars before checkpoint
      if (checkpoint?.currentCalendarId && i < calendars.findIndex(c => c.googleCalendarId === checkpoint.currentCalendarId)) {
        continue;
      }

      onProgress?.({
        phase: "events",
        currentCalendar: calendar.name,
        calendarsProcessed: i,
        calendarsTotal: calendars.length,
        eventsProcessed: result.eventsTotal,
      });

      try {
        const { eventIds, syncToken, stats } = await syncCalendarEvents(
          client,
          userId,
          calendar.googleCalendarId,
          calendar.id,
          {
            timeMin,
            timeMax,
            pageSize: opts.pageSize,
            singleEvents: opts.singleEvents,
            maxEvents: opts.maxEventsPerCalendar,
            resumePageToken: checkpoint?.currentCalendarId === calendar.googleCalendarId
              ? checkpoint.pageToken
              : undefined,
          },
          result.errors,
          (pageProgress) => {
            onProgress?.({
              phase: "events",
              currentCalendar: calendar.name,
              calendarsProcessed: i,
              calendarsTotal: calendars.length,
              eventsProcessed: result.eventsTotal + pageProgress,
              currentPage: pageProgress,
            });
          }
        );

        allNewEventIds.push(...eventIds);
        result.eventsAdded += stats.added;
        result.eventsUpdated += stats.updated;
        result.eventsTotal += stats.added + stats.updated;
        lastSyncToken = syncToken;

        // Save checkpoint after each calendar
        calendarsCompleted++;
        await saveCheckpoint(userId, {
          eventsProcessed: result.eventsTotal,
          calendarsCompleted,
          calendarsTotal: calendars.length,
          startedAt: checkpoint?.startedAt || new Date(),
        });

        syncLogger.debug("Completed calendar sync", {
          userId,
          calendarId: calendar.googleCalendarId,
          calendarName: calendar.name,
          eventsAdded: stats.added,
          eventsUpdated: stats.updated,
        });

      } catch (error) {
        const syncError = createSyncError(error, calendar.googleCalendarId, "calendar");
        result.errors.push(syncError);

        syncLogger.error("Failed to sync calendar events", {
          userId,
          calendarId: calendar.googleCalendarId,
          error: syncError.message,
        });

        // Continue with other calendars
        continue;
      }
    }

    // Step 4: Queue embeddings for new events
    if (allNewEventIds.length > 0) {
      await queueFullSyncEmbeddings(userId, allNewEventIds);
      await updateEmbeddingStats(userId, allNewEventIds.length);

      syncLogger.info("Queued event embeddings", {
        userId,
        eventCount: allNewEventIds.length,
      });
    }

    // Step 5: Update sync state with completion
    await calendarSyncStateRepository.completeSync(userId, {
      eventCount: result.eventsTotal,
      calendarCount: result.calendarsProcessed,
      syncToken: lastSyncToken,
    });

    // Clear checkpoint on successful completion
    await clearCheckpoint(userId);

    result.syncToken = lastSyncToken;
    result.durationMs = Date.now() - startTime;

    // Notify completion
    onProgress?.({
      phase: "complete",
      calendarsProcessed: calendars.length,
      calendarsTotal: calendars.length,
      eventsProcessed: result.eventsTotal,
    });

    // Audit log
    await logAuditEntry({
      userId,
      actionType: "update",
      actionCategory: "integration",
      entityType: "event",
      outputSummary: `Calendar full sync complete: ${result.eventsAdded} added, ${result.eventsUpdated} updated`,
      metadata: {
        syncType: "calendar_full",
        calendarsProcessed: result.calendarsProcessed,
        eventsAdded: result.eventsAdded,
        eventsUpdated: result.eventsUpdated,
        durationMs: result.durationMs,
        errorCount: result.errors.length,
      },
    });

    syncLogger.info("Full calendar sync complete", {
      userId,
      calendarsProcessed: result.calendarsProcessed,
      eventsAdded: result.eventsAdded,
      eventsUpdated: result.eventsUpdated,
      eventsTotal: result.eventsTotal,
      durationMs: result.durationMs,
      errorCount: result.errors.length,
    });

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Save error state
    await calendarSyncStateRepository.setError(userId, errorMessage);

    // Audit log for failure
    await logAuditEntry({
      userId,
      actionType: "update",
      actionCategory: "integration",
      entityType: "event",
      status: "failed",
      errorMessage,
      metadata: {
        syncType: "calendar_full",
        eventsProcessed: result.eventsTotal,
        durationMs: Date.now() - startTime,
      },
    });

    syncLogger.error("Full calendar sync failed", {
      userId,
      error: errorMessage,
      eventsProcessed: result.eventsTotal,
    });

    throw error;
  }
}

/**
 * Resume a previously interrupted full sync
 *
 * @param userId - The user ID
 * @param accessToken - OAuth2 access token
 * @param onProgress - Optional progress callback
 * @returns Full sync result
 */
export async function resumeFullSync(
  userId: string,
  accessToken: string,
  onProgress?: (progress: FullSyncProgress) => void
): Promise<CalendarSyncResult> {
  return fullCalendarSync(userId, accessToken, { resumeFromCheckpoint: true }, onProgress);
}

// ─────────────────────────────────────────────────────────────
// Calendar Sync Helper
// ─────────────────────────────────────────────────────────────

/**
 * Sync all calendars for a user
 * 
 * This syncs the calendar list from Google, then returns only calendars
 * that have isSelected = true (user opted-in to sync events).
 */
async function syncCalendars(
  client: CalendarClient,
  userId: string,
  options: {
    calendarIds?: string[];
    excludeCalendarIds?: string[];
  }
): Promise<Array<{ id: string; googleCalendarId: string; name: string }>> {
  const response = await client.listCalendars();
  const googleCalendars = response.items || [];

  // Filter calendars
  let filteredCalendars = googleCalendars;

  if (options.calendarIds && options.calendarIds.length > 0) {
    filteredCalendars = googleCalendars.filter(cal =>
      options.calendarIds!.includes(cal.id)
    );
  }

  if (options.excludeCalendarIds && options.excludeCalendarIds.length > 0) {
    filteredCalendars = filteredCalendars.filter(cal =>
      !options.excludeCalendarIds!.includes(cal.id)
    );
  }

  // Filter out hidden/deleted calendars
  filteredCalendars = filteredCalendars.filter(cal => !cal.deleted && !cal.hidden);

  // Upsert calendars to database (updates metadata but preserves isSelected)
  const allCalendars: Array<{ id: string; googleCalendarId: string; name: string; isSelected: boolean }> = [];

  for (const googleCal of filteredCalendars) {
    const input = mapGoogleCalendarToDb(googleCal, userId);
    const calendar = await calendarRepository.upsert(input);
    allCalendars.push({
      id: calendar.id,
      googleCalendarId: calendar.googleCalendarId,
      name: calendar.name,
      isSelected: calendar.isSelected,
    });
  }

  // Update calendar count in sync state
  await calendarSyncStateRepository.update(userId, {
    calendarCount: allCalendars.length,
  });

  // Only return calendars that user has opted-in to sync (isSelected = true)
  const selectedCalendars = allCalendars.filter(cal => cal.isSelected);
  
  syncLogger.info("Filtered calendars for event sync", {
    userId,
    totalCalendars: allCalendars.length,
    selectedCalendars: selectedCalendars.length,
  });

  return selectedCalendars.map(cal => ({
    id: cal.id,
    googleCalendarId: cal.googleCalendarId,
    name: cal.name,
  }));
}

// ─────────────────────────────────────────────────────────────
// Event Sync Helper
// ─────────────────────────────────────────────────────────────

interface EventSyncOptions {
  timeMin: Date;
  timeMax: Date;
  pageSize: number;
  singleEvents: boolean;
  maxEvents?: number;
  resumePageToken?: string;
}

interface EventSyncResult {
  eventIds: string[];
  syncToken?: string;
  stats: {
    added: number;
    updated: number;
  };
}

/**
 * Sync events for a single calendar
 */
async function syncCalendarEvents(
  client: CalendarClient,
  userId: string,
  googleCalendarId: string,
  calendarId: string,
  options: EventSyncOptions,
  errors: SyncOperationError[],
  onPageProgress?: (eventsProcessed: number) => void
): Promise<EventSyncResult> {
  const eventIds: string[] = [];
  const stats = { added: 0, updated: 0 };
  let pageToken = options.resumePageToken;
  let syncToken: string | undefined;
  let eventsProcessed = 0;
  let pageCount = 0;

  do {
    // Safety limit on pages
    if (pageCount >= FULL_SYNC_MAX_PAGES) {
      syncLogger.warn("Reached max page limit for calendar", {
        userId,
        googleCalendarId,
        pageCount,
      });
      break;
    }

    // Fetch events page
    const response = await client.listEvents(googleCalendarId, {
      timeMin: formatDateForApi(options.timeMin),
      timeMax: formatDateForApi(options.timeMax),
      maxResults: options.pageSize,
      singleEvents: options.singleEvents,
      orderBy: options.singleEvents ? "startTime" : undefined,
      pageToken,
      showDeleted: false,
    });

    const events = response.items || [];
    pageToken = response.nextPageToken;
    syncToken = response.nextSyncToken;
    pageCount++;

    // Process events
    for (const googleEvent of events) {
      try {
        const result = await processEvent(
          googleEvent,
          userId,
          googleCalendarId,
          calendarId
        );

        if (result.eventId) {
          eventIds.push(result.eventId);
        }

        if (result.isNew) {
          stats.added++;
        } else {
          stats.updated++;
        }

        eventsProcessed++;
        onPageProgress?.(eventsProcessed);

        // Check max events limit
        if (options.maxEvents && eventsProcessed >= options.maxEvents) {
          syncLogger.debug("Reached max events limit", {
            userId,
            googleCalendarId,
            maxEvents: options.maxEvents,
          });
          return { eventIds, syncToken, stats };
        }

      } catch (error) {
        const syncError = createSyncError(error, googleEvent.id, "event");
        errors.push(syncError);

        syncLogger.warn("Failed to process event", {
          userId,
          eventId: googleEvent.id,
          error: syncError.message,
        });
      }
    }

    // Save progress checkpoint after each page
    if (pageToken) {
      await saveCheckpoint(userId, {
        currentCalendarId: googleCalendarId,
        pageToken,
        eventsProcessed,
        calendarsCompleted: 0, // Tracked at higher level
        calendarsTotal: 0,
        startedAt: new Date(),
      });
    }

  } while (pageToken);

  return { eventIds, syncToken, stats };
}

/**
 * Process a single event from Google Calendar
 */
async function processEvent(
  googleEvent: GoogleEvent,
  userId: string,
  googleCalendarId: string,
  calendarId: string
): Promise<{ eventId: string | null; isNew: boolean }> {
  // Skip cancelled events
  if (googleEvent.status === "cancelled") {
    // Soft delete if exists
    await calendarEventRepository.softDeleteByGoogleId(userId, googleEvent.id);
    return { eventId: null, isNew: false };
  }

  // Map to database format
  const input = mapGoogleEventToDb(googleEvent, userId, googleCalendarId, calendarId);

  // Check if event exists
  const existing = await calendarEventRepository.findByGoogleId(userId, googleEvent.id);

  // Upsert event
  const event = await calendarEventRepository.upsert(input);

  return {
    eventId: event.id,
    isNew: !existing,
  };
}

