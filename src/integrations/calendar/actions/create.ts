// ═══════════════════════════════════════════════════════════════════════════
// Calendar Event Creation Actions
// Request and execute event creation with approval workflow
// ═══════════════════════════════════════════════════════════════════════════

import { createCalendarClient } from "../client";
import {
  calendarApprovalRepository,
  calendarEventRepository,
} from "../repository";
import { calendarLogger } from "../logger";
import { mapGoogleEventToDb } from "../mappers";
import { logAuditEntry } from "@/services/audit";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import { APPROVAL_DEFAULT_EXPIRATION_MS } from "../constants";
import { detectConflicts, summarizeConflicts } from "./conflicts";
import { Prisma } from "@prisma/client";
import type {
  CreateEventRequest,
  ActionRequestResult,
  ActionExecuteResult,
  EventSnapshot,
  ApprovalOptions,
} from "./types";
import type { CalendarApproval, Event } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Request Event Creation
// ─────────────────────────────────────────────────────────────

/**
 * Request creation of a new event
 *
 * Creates an approval record that must be approved before execution.
 * Optionally checks for scheduling conflicts.
 *
 * @param request - Event creation request
 * @param options - Approval options
 * @returns Result with approval record
 */
export async function requestEventCreation(
  request: CreateEventRequest,
  options: ApprovalOptions = {}
): Promise<ActionRequestResult> {
  const {
    userId,
    calendarId,
    event,
    checkConflicts = true,
    requestedBy,
    notes,
  } = request;

  const logger = calendarLogger.child("requestEventCreation");

  try {
    // Validate required fields
    if (!event.summary) {
      return {
        success: false,
        error: "Event summary is required",
        message: "Cannot create event without a title",
      };
    }

    if (!event.start || !event.end) {
      return {
        success: false,
        error: "Event start and end times are required",
        message: "Cannot create event without start and end times",
      };
    }

    // Parse start/end times
    const startTime = parseEventDateTime(event.start);
    const endTime = parseEventDateTime(event.end);

    if (!startTime || !endTime) {
      return {
        success: false,
        error: "Invalid event times",
        message: "Could not parse event start or end time",
      };
    }

    // Check for conflicts
    let conflicts: Awaited<ReturnType<typeof detectConflicts>> = [];
    if (checkConflicts) {
      conflicts = await detectConflicts(userId, startTime, endTime, {
        calendarIds: [calendarId],
      });
    }

    // Build event snapshot
    const eventSnapshot: EventSnapshot = {
      actionType: "create",
      createData: event,
      conflicts,
    };

    // Calculate expiration
    const expiresAt =
      options.expiresAt ||
      new Date(Date.now() + APPROVAL_DEFAULT_EXPIRATION_MS);

    // Create approval record
    const approval = await calendarApprovalRepository.create({
      userId,
      actionType: "create",
      calendarId,
      eventSnapshot: eventSnapshot as unknown as Prisma.InputJsonValue,
      requestedBy: requestedBy || "agent",
      expiresAt,
      metadata: options.metadata as Prisma.InputJsonValue | undefined,
    });

    // Log audit entry
    await logAuditEntry({
      userId,
      actionType: "calendar_create_requested",
      actionCategory: "calendar",
      entityType: "calendar_approval",
      entityId: approval.id,
      metadata: {
        eventSummary: event.summary,
        calendarId,
        hasConflicts: (conflicts?.length ?? 0) > 0,
      },
    });

    logger.info("Event creation request created", {
      approvalId: approval.id,
      conflictCount: conflicts?.length ?? 0,
    });

    // Build response message
    let message = `Event creation request submitted for approval.`;
    if (conflicts && conflicts.length > 0) {
      message += ` Warning: ${summarizeConflicts(conflicts)}`;
    }

    return {
      success: true,
      approval,
      approvalId: approval.id,
      conflicts,
      message,
    };
  } catch (error) {
    logger.error("Error requesting event creation", { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to create event request",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Execute Event Creation
// ─────────────────────────────────────────────────────────────

/**
 * Execute an approved event creation
 *
 * Actually creates the event in Google Calendar and syncs to local DB.
 * Should only be called after approval.
 *
 * @param approvalId - ID of the approved request
 * @returns Result with created event
 */
export async function executeEventCreation(
  approvalId: string
): Promise<ActionExecuteResult> {
  const logger = calendarLogger.child("executeEventCreation");

  try {
    // Get approval record
    const approval = await calendarApprovalRepository.findById(approvalId);

    if (!approval) {
      return {
        success: false,
        error: "Approval not found",
        message: "The approval request does not exist",
      };
    }

    // Validate approval status
    if (approval.status !== "approved") {
      return {
        success: false,
        error: `Invalid approval status: ${approval.status}`,
        message: `Cannot execute action with status "${approval.status}"`,
        approval,
      };
    }

    // Validate action type
    if (approval.actionType !== "create") {
      return {
        success: false,
        error: "Wrong action type",
        message: "This approval is not for event creation",
        approval,
      };
    }

    // Extract event data from snapshot
    const snapshot = approval.eventSnapshot as unknown as EventSnapshot;
    const createData = snapshot.createData;

    if (!createData) {
      return {
        success: false,
        error: "No event data in approval",
        message: "Event creation data is missing from approval",
        approval,
      };
    }

    // Get access token
    const accessToken = await getValidAccessToken(approval.userId);
    if (!accessToken) {
      await calendarApprovalRepository.markFailed(
        approvalId,
        "No valid access token"
      );
      return {
        success: false,
        error: "Authentication failed",
        message: "Could not get valid access token for user",
        approval,
      };
    }

    // Create Calendar client
    const client = createCalendarClient(accessToken, approval.userId);

    // Create event in Google Calendar
    const googleEvent = await client.createEvent(
      approval.calendarId,
      createData
    );

    // Sync event to local database
    const dbEventInput = mapGoogleEventToDb(
      googleEvent,
      approval.userId,
      approval.calendarId
    );
    const dbEvent = await calendarEventRepository.upsert(dbEventInput);

    // Mark approval as executed
    await calendarApprovalRepository.markExecuted(approvalId, dbEvent.id);

    // Log audit entry
    await logAuditEntry({
      userId: approval.userId,
      actionType: "calendar_create_executed",
      actionCategory: "calendar",
      entityType: "event",
      entityId: dbEvent.id,
      metadata: {
        approvalId,
        googleEventId: googleEvent.id,
        eventSummary: googleEvent.summary,
        calendarId: approval.calendarId,
      },
    });

    logger.info("Event created successfully", {
      eventId: dbEvent.id,
      googleEventId: googleEvent.id,
    });

    return {
      success: true,
      event: dbEvent,
      approval:
        (await calendarApprovalRepository.findById(approvalId)) || approval,
      message: `Event "${googleEvent.summary}" created successfully`,
    };
  } catch (error) {
    logger.error("Error executing event creation", { error });

    // Mark approval as failed
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await calendarApprovalRepository.markFailed(approvalId, errorMessage);

    return {
      success: false,
      error: errorMessage,
      message: "Failed to create event in Google Calendar",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Parse EventDateTime to Date object
 */
function parseEventDateTime(eventDateTime: {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}): Date | null {
  if (eventDateTime.dateTime) {
    return new Date(eventDateTime.dateTime);
  }
  if (eventDateTime.date) {
    // All-day event - return start of day
    return new Date(`${eventDateTime.date}T00:00:00Z`);
  }
  return null;
}
