// ═══════════════════════════════════════════════════════════════════════════
// Calendar Conflict Detection
// Detects scheduling conflicts for event creation and updates
// ═══════════════════════════════════════════════════════════════════════════

import { calendarEventRepository } from "../repository";
import { calendarLogger } from "../logger";
import type {
  ConflictInfo,
  ConflictDetectionOptions,
  ConflictType,
  ConflictSeverity,
} from "./types";
import type { Event } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Default buffer time between events in minutes */
const DEFAULT_BUFFER_MINUTES = 0;

/** Maximum conflicts to return */
const DEFAULT_MAX_CONFLICTS = 10;

/** Threshold for considering events at "same time" (in milliseconds) */
const SAME_TIME_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// ─────────────────────────────────────────────────────────────
// Main Conflict Detection
// ─────────────────────────────────────────────────────────────

/**
 * Detect scheduling conflicts for a proposed event time
 *
 * @param userId - User ID to check conflicts for
 * @param start - Proposed start time
 * @param end - Proposed end time
 * @param options - Detection options
 * @returns Array of conflict information
 */
export async function detectConflicts(
  userId: string,
  start: Date,
  end: Date,
  options: ConflictDetectionOptions = {}
): Promise<ConflictInfo[]> {
  const {
    excludeEventId,
    calendarIds,
    bufferMinutes = DEFAULT_BUFFER_MINUTES,
    maxConflicts = DEFAULT_MAX_CONFLICTS,
  } = options;

  const logger = calendarLogger.child("detectConflicts");

  try {
    // Calculate buffered time range
    const bufferMs = bufferMinutes * 60 * 1000;
    const bufferedStart = new Date(start.getTime() - bufferMs);
    const bufferedEnd = new Date(end.getTime() + bufferMs);

    // Find potentially conflicting events
    const potentialConflicts = await calendarEventRepository.findConflicts(
      userId,
      bufferedStart,
      bufferedEnd
    );

    // Filter and categorize conflicts
    const conflicts: ConflictInfo[] = [];

    for (const event of potentialConflicts) {
      // Skip the event being updated
      if (excludeEventId && event.id === excludeEventId) {
        continue;
      }

      // Skip if calendar filter specified and event not in filter
      if (calendarIds && calendarIds.length > 0) {
        const eventCalendarId = event.googleCalendarId || event.calendarId;
        if (eventCalendarId && !calendarIds.includes(eventCalendarId)) {
          continue;
        }
      }

      // Skip deleted/cancelled events
      if (event.deletedAt || event.status === "cancelled") {
        continue;
      }

      // Determine conflict type and severity
      const conflictInfo = analyzeConflict(event, start, end, bufferMinutes);

      if (conflictInfo) {
        conflicts.push(conflictInfo);
      }

      // Limit results
      if (conflicts.length >= maxConflicts) {
        break;
      }
    }

    // Sort by severity (high first) then by start time
    conflicts.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      const severityDiff =
        severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.startsAt.getTime() - b.startsAt.getTime();
    });

    logger.debug("Conflict detection complete", {
      potentialConflicts: potentialConflicts.length,
      actualConflicts: conflicts.length,
    });

    return conflicts;
  } catch (error) {
    logger.error("Error detecting conflicts", { error });
    // Return empty array on error - don't block the action
    return [];
  }
}

/**
 * Check if there are any high-severity conflicts
 */
export async function hasHighSeverityConflicts(
  userId: string,
  start: Date,
  end: Date,
  options: ConflictDetectionOptions = {}
): Promise<boolean> {
  const conflicts = await detectConflicts(userId, start, end, {
    ...options,
    maxConflicts: 1,
  });
  return conflicts.some((c) => c.severity === "high");
}

/**
 * Get a summary of conflicts for display
 */
export function summarizeConflicts(conflicts: ConflictInfo[]): string {
  if (conflicts.length === 0) {
    return "No conflicts detected.";
  }

  const highCount = conflicts.filter((c) => c.severity === "high").length;
  const mediumCount = conflicts.filter((c) => c.severity === "medium").length;
  const lowCount = conflicts.filter((c) => c.severity === "low").length;

  const parts: string[] = [];

  if (highCount > 0) {
    parts.push(`${highCount} overlapping event${highCount > 1 ? "s" : ""}`);
  }
  if (mediumCount > 0) {
    parts.push(
      `${mediumCount} back-to-back event${mediumCount > 1 ? "s" : ""}`
    );
  }
  if (lowCount > 0) {
    parts.push(`${lowCount} potential conflict${lowCount > 1 ? "s" : ""}`);
  }

  return `Conflicts: ${parts.join(", ")}.`;
}

// ─────────────────────────────────────────────────────────────
// Conflict Analysis
// ─────────────────────────────────────────────────────────────

/**
 * Analyze a single event for conflict with proposed time
 */
function analyzeConflict(
  event: Event,
  proposedStart: Date,
  proposedEnd: Date,
  bufferMinutes: number
): ConflictInfo | null {
  const eventStart = event.startsAt;
  const eventEnd = event.endsAt || event.startsAt;

  // Calculate if there's an actual overlap
  const hasOverlap = eventStart < proposedEnd && eventEnd > proposedStart;

  // Check for same-time start
  const isSameTime =
    Math.abs(eventStart.getTime() - proposedStart.getTime()) <
    SAME_TIME_THRESHOLD_MS;

  // Check for back-to-back (within buffer time)
  const bufferMs = bufferMinutes * 60 * 1000;
  const isBackToBack =
    !hasOverlap &&
    ((eventEnd.getTime() >= proposedStart.getTime() - bufferMs &&
      eventEnd.getTime() <= proposedStart.getTime()) ||
      (proposedEnd.getTime() >= eventStart.getTime() - bufferMs &&
        proposedEnd.getTime() <= eventStart.getTime()));

  // Determine conflict type and severity
  let conflictType: ConflictType;
  let severity: ConflictSeverity;

  if (hasOverlap) {
    if (isSameTime) {
      conflictType = "same_time";
      severity = "high";
    } else {
      conflictType = "overlap";
      severity = "high";
    }
  } else if (isBackToBack) {
    conflictType = "back_to_back";
    severity = "medium";
  } else {
    // No significant conflict
    return null;
  }

  return {
    eventId: event.id,
    googleEventId: event.googleEventId || undefined,
    title: event.title || "Untitled Event",
    startsAt: eventStart,
    endsAt: eventEnd,
    allDay: event.allDay || false,
    calendarId: event.googleCalendarId || event.calendarId || undefined,
    conflictType,
    severity,
  };
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Format conflict info for display
 */
export function formatConflictForDisplay(conflict: ConflictInfo): string {
  const timeFormat: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  };

  const startTime = conflict.allDay
    ? "All day"
    : conflict.startsAt.toLocaleTimeString("en-US", timeFormat);

  const endTime = conflict.allDay
    ? ""
    : ` - ${conflict.endsAt.toLocaleTimeString("en-US", timeFormat)}`;

  const typeLabel = {
    overlap: "Overlaps with",
    same_time: "Same time as",
    back_to_back: "Back-to-back with",
    travel_time: "Insufficient travel time to",
  }[conflict.conflictType];

  return `${typeLabel}: "${conflict.title}" (${startTime}${endTime})`;
}

/**
 * Check if conflicts should block action execution
 * Currently only high-severity conflicts block by default
 */
export function shouldBlockAction(conflicts: ConflictInfo[]): boolean {
  // Only block if there are high-severity conflicts
  // Medium and low severity are warnings only
  return conflicts.some((c) => c.severity === "high");
}
