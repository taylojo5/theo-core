// ═══════════════════════════════════════════════════════════════════════════
// Calendar Metadata Sync
// Syncs only calendar list (no events) for initial setup
// ═══════════════════════════════════════════════════════════════════════════

import { createCalendarClient } from "../client";
import { calendarRepository, calendarSyncStateRepository } from "../repository";
import { mapGoogleCalendarToDb } from "../mappers";
import { syncLogger } from "../logger";
import { logAuditEntry } from "@/services/audit";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of a calendar metadata sync
 */
export interface CalendarMetadataSyncResult {
  /** Number of calendars synced */
  calendarsProcessed: number;
  /** Calendars that can sync events (reader/owner access) */
  syncableCalendars: number;
  /** Calendars with limited access (freeBusyReader/writer without read) */
  limitedCalendars: number;
  /** Sync duration in milliseconds */
  durationMs: number;
  /** Any errors encountered */
  errors: string[];
}

/**
 * Calendar info returned from metadata sync
 */
export interface CalendarMetadataInfo {
  id: string;
  googleCalendarId: string;
  name: string;
  description: string | null;
  isPrimary: boolean;
  isOwner: boolean;
  accessRole: string;
  backgroundColor: string | null;
  foregroundColor: string | null;
  isSelected: boolean;
  isHidden: boolean;
  /** Whether this calendar can be enabled for event sync */
  canSyncEvents: boolean;
}

// ─────────────────────────────────────────────────────────────
// Access Role Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Access roles that allow reading event details (title, description, etc.)
 * These are the only roles where event sync provides semantic value.
 *
 * - owner: Full access, can read all event details
 * - reader: Can read event details but not modify
 *
 * NOT included:
 * - writer: Can create/edit events but access to event details varies
 * - freeBusyReader: Only sees free/busy status, no event details
 */
export const SYNCABLE_ACCESS_ROLES = ["owner", "reader"] as const;

/**
 * Check if a calendar's access role allows syncing event details
 */
export function canSyncEventDetails(accessRole: string): boolean {
  return SYNCABLE_ACCESS_ROLES.includes(
    accessRole as (typeof SYNCABLE_ACCESS_ROLES)[number]
  );
}

// ─────────────────────────────────────────────────────────────
// Metadata Sync Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Sync only calendar metadata (calendar list, no events)
 *
 * This is used for initial setup after connecting Google Calendar.
 * It fetches the user's calendar list and stores it in the database,
 * but does NOT sync any events. Events are synced only after the user
 * explicitly enables sync for specific calendars.
 *
 * @param userId - User ID to sync for
 * @param accessToken - OAuth access token
 * @returns Sync result with calendar information
 */
export async function syncCalendarMetadata(
  userId: string,
  accessToken: string
): Promise<CalendarMetadataSyncResult> {
  const startTime = Date.now();

  const result: CalendarMetadataSyncResult = {
    calendarsProcessed: 0,
    syncableCalendars: 0,
    limitedCalendars: 0,
    durationMs: 0,
    errors: [],
  };

  try {
    // Create Calendar client
    const client = createCalendarClient(accessToken, userId);

    // Fetch calendar list from Google
    const response = await client.listCalendars();
    const googleCalendars = response.items || [];

    syncLogger.info("Fetched calendar list from Google", {
      userId,
      calendarCount: googleCalendars.length,
    });

    // Process each calendar
    for (const googleCal of googleCalendars) {
      // Skip deleted/hidden calendars from Google
      if (googleCal.deleted) {
        continue;
      }

      try {
        // Map to database format (isSelected defaults to false)
        const input = mapGoogleCalendarToDb(googleCal, userId);

        // Upsert calendar to database
        await calendarRepository.upsert(input);

        result.calendarsProcessed++;

        // Track syncable vs limited access calendars
        if (canSyncEventDetails(googleCal.accessRole)) {
          result.syncableCalendars++;
        } else {
          result.limitedCalendars++;
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        result.errors.push(
          `Failed to sync calendar ${googleCal.summary}: ${errorMessage}`
        );

        syncLogger.warn("Failed to sync calendar", {
          userId,
          calendarId: googleCal.id,
          error: errorMessage,
        });
      }
    }

    // Update sync state with calendar count
    await calendarSyncStateRepository.update(userId, {
      calendarCount: result.calendarsProcessed,
      syncStatus: "idle",
    });

    result.durationMs = Date.now() - startTime;

    // Audit log
    await logAuditEntry({
      userId,
      actionType: "query",
      actionCategory: "integration",
      entityType: "calendar",
      outputSummary: `Calendar metadata sync: ${result.calendarsProcessed} calendars synced (${result.syncableCalendars} syncable, ${result.limitedCalendars} limited access)`,
      metadata: {
        syncType: "calendar_metadata",
        calendarsProcessed: result.calendarsProcessed,
        syncableCalendars: result.syncableCalendars,
        limitedCalendars: result.limitedCalendars,
        durationMs: result.durationMs,
        errorCount: result.errors.length,
      },
    });

    syncLogger.info("Calendar metadata sync complete", {
      userId,
      calendarsProcessed: result.calendarsProcessed,
      syncableCalendars: result.syncableCalendars,
      limitedCalendars: result.limitedCalendars,
      durationMs: result.durationMs,
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update sync state with error
    await calendarSyncStateRepository.setError(userId, errorMessage);

    // Audit log for failure
    await logAuditEntry({
      userId,
      actionType: "query",
      actionCategory: "integration",
      entityType: "calendar",
      status: "failed",
      errorMessage,
      metadata: {
        syncType: "calendar_metadata",
        durationMs: Date.now() - startTime,
      },
    });

    syncLogger.error("Calendar metadata sync failed", {
      userId,
      error: errorMessage,
    });

    throw error;
  }
}

/**
 * Get calendar list with sync eligibility information
 *
 * @param userId - User ID
 * @returns List of calendars with canSyncEvents flag
 */
export async function getCalendarsWithSyncEligibility(
  userId: string
): Promise<CalendarMetadataInfo[]> {
  const calendars = await calendarRepository.findByUser(userId);

  return calendars.map((cal) => ({
    id: cal.id,
    googleCalendarId: cal.googleCalendarId,
    name: cal.name,
    description: cal.description,
    isPrimary: cal.isPrimary,
    isOwner: cal.isOwner,
    accessRole: cal.accessRole,
    backgroundColor: cal.backgroundColor,
    foregroundColor: cal.foregroundColor,
    isSelected: cal.isSelected,
    isHidden: cal.isHidden,
    canSyncEvents: canSyncEventDetails(cal.accessRole),
  }));
}

/**
 * Enable event sync for a calendar
 *
 * @param userId - User ID
 * @param calendarId - Calendar database ID
 * @returns Updated calendar or null if not found/not allowed
 */
export async function enableCalendarSync(
  userId: string,
  calendarId: string
): Promise<CalendarMetadataInfo | null> {
  const calendar = await calendarRepository.findById(calendarId);

  if (!calendar || calendar.userId !== userId) {
    return null;
  }

  // Check if calendar can sync events
  if (!canSyncEventDetails(calendar.accessRole)) {
    syncLogger.warn("Cannot enable sync for calendar with limited access", {
      userId,
      calendarId,
      accessRole: calendar.accessRole,
    });
    return null;
  }

  // Update isSelected to true
  const result = await calendarRepository.updateWithResult(calendarId, {
    isSelected: true,
  });

  if (!result.success) {
    return null;
  }

  return {
    id: result.data.id,
    googleCalendarId: result.data.googleCalendarId,
    name: result.data.name,
    description: result.data.description,
    isPrimary: result.data.isPrimary,
    isOwner: result.data.isOwner,
    accessRole: result.data.accessRole,
    backgroundColor: result.data.backgroundColor,
    foregroundColor: result.data.foregroundColor,
    isSelected: result.data.isSelected,
    isHidden: result.data.isHidden,
    canSyncEvents: canSyncEventDetails(result.data.accessRole),
  };
}

/**
 * Disable event sync for a calendar
 *
 * @param userId - User ID
 * @param calendarId - Calendar database ID
 * @returns Updated calendar or null if not found
 */
export async function disableCalendarSync(
  userId: string,
  calendarId: string
): Promise<CalendarMetadataInfo | null> {
  const calendar = await calendarRepository.findById(calendarId);

  if (!calendar || calendar.userId !== userId) {
    return null;
  }

  // Update isSelected to false
  const result = await calendarRepository.updateWithResult(calendarId, {
    isSelected: false,
  });

  if (!result.success) {
    return null;
  }

  return {
    id: result.data.id,
    googleCalendarId: result.data.googleCalendarId,
    name: result.data.name,
    description: result.data.description,
    isPrimary: result.data.isPrimary,
    isOwner: result.data.isOwner,
    accessRole: result.data.accessRole,
    backgroundColor: result.data.backgroundColor,
    foregroundColor: result.data.foregroundColor,
    isSelected: result.data.isSelected,
    isHidden: result.data.isHidden,
    canSyncEvents: canSyncEventDetails(result.data.accessRole),
  };
}

/**
 * Count calendars with event sync enabled
 */
export async function countEnabledCalendars(userId: string): Promise<number> {
  const calendars = await calendarRepository.findSelected(userId);
  return calendars.length;
}
