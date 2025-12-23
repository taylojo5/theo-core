// ═══════════════════════════════════════════════════════════════════════════
// Calendar Event Update Actions
// Request and execute event updates with approval workflow
// ═══════════════════════════════════════════════════════════════════════════

import { createCalendarClient } from "../client";
import { calendarApprovalRepository, calendarEventRepository } from "../repository";
import { calendarLogger } from "../logger";
import { mapGoogleEventToDb } from "../mappers";
import { logAuditEntry } from "@/services/audit";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import { APPROVAL_DEFAULT_EXPIRATION_MS } from "../constants";
import { detectConflicts, summarizeConflicts } from "./conflicts";
import { Prisma } from "@prisma/client";
import type {
  UpdateEventRequest,
  ActionRequestResult,
  ActionExecuteResult,
  EventSnapshot,
  ApprovalOptions,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Request Event Update
// ─────────────────────────────────────────────────────────────

/**
 * Request an update to an existing event
 * 
 * Creates an approval record that must be approved before execution.
 * Optionally checks for scheduling conflicts if times are being changed.
 * 
 * @param request - Event update request
 * @param options - Approval options
 * @returns Result with approval record
 */
export async function requestEventUpdate(
  request: UpdateEventRequest,
  options: ApprovalOptions = {}
): Promise<ActionRequestResult> {
  const {
    userId,
    calendarId,
    eventId,
    googleEventId,
    updates,
    checkConflicts = true,
    sendUpdates = "none",
    requestedBy,
    notes,
  } = request;
  
  const logger = calendarLogger.child("requestEventUpdate");

  try {
    // Find the existing event
    const existingEvent = await calendarEventRepository.findById(eventId);
    
    if (!existingEvent) {
      return {
        success: false,
        error: "Event not found",
        message: "The event to update does not exist",
      };
    }

    // Verify ownership
    if (existingEvent.userId !== userId) {
      return {
        success: false,
        error: "Permission denied",
        message: "You do not have permission to update this event",
      };
    }

    // Determine if times are changing
    const timesChanging = updates.start || updates.end;
    
    // Check for conflicts if times are changing
    let conflicts: Awaited<ReturnType<typeof detectConflicts>> = [];
    if (checkConflicts && timesChanging) {
      const newStart = updates.start 
        ? parseEventDateTime(updates.start) 
        : existingEvent.startsAt;
      const newEnd = updates.end 
        ? parseEventDateTime(updates.end) 
        : existingEvent.endsAt || existingEvent.startsAt;
      
      if (newStart && newEnd) {
        conflicts = await detectConflicts(userId, newStart, newEnd, {
          excludeEventId: eventId,
          calendarIds: [calendarId],
        });
      }
    }

    // Build event snapshot
    const eventSnapshot: EventSnapshot = {
      actionType: "update",
      updateData: updates,
      originalEvent: {
        id: existingEvent.id,
        googleEventId: existingEvent.googleEventId || undefined,
        title: existingEvent.title || undefined,
        startsAt: existingEvent.startsAt,
        endsAt: existingEvent.endsAt || undefined,
        calendarId: existingEvent.googleCalendarId || undefined,
      },
      conflicts,
      sendUpdates,
    };

    // Calculate expiration
    const expiresAt = options.expiresAt || 
      new Date(Date.now() + APPROVAL_DEFAULT_EXPIRATION_MS);

    // Create approval record
    const approval = await calendarApprovalRepository.create({
      userId,
      actionType: "update",
      calendarId,
      eventId,
      eventSnapshot: eventSnapshot as unknown as Prisma.InputJsonValue,
      requestedBy: requestedBy || "agent",
      expiresAt,
      metadata: options.metadata as Prisma.InputJsonValue | undefined,
    });

    // Log audit entry
    await logAuditEntry({
      userId,
      actionType: "calendar_update_requested",
      actionCategory: "calendar",
      entityType: "calendar_approval",
      entityId: approval.id,
      metadata: {
        eventId,
        eventSummary: existingEvent.title,
        calendarId,
        updatedFields: Object.keys(updates),
        hasConflicts: (conflicts?.length ?? 0) > 0,
      },
    });

    logger.info("Event update request created", {
      approvalId: approval.id,
      conflictCount: conflicts?.length ?? 0,
    });

    // Build response message
    let message = `Event update request submitted for approval.`;
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
    logger.error("Error requesting event update", { error });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to create update request",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Execute Event Update
// ─────────────────────────────────────────────────────────────

/**
 * Execute an approved event update
 * 
 * Actually updates the event in Google Calendar and syncs to local DB.
 * Should only be called after approval.
 * 
 * @param approvalId - ID of the approved request
 * @returns Result with updated event
 */
export async function executeEventUpdate(
  approvalId: string
): Promise<ActionExecuteResult> {
  const logger = calendarLogger.child("executeEventUpdate");

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
    if (approval.actionType !== "update") {
      return {
        success: false,
        error: "Wrong action type",
        message: "This approval is not for event update",
        approval,
      };
    }

    // Get the event to update
    if (!approval.eventId) {
      return {
        success: false,
        error: "No event ID in approval",
        message: "Event ID is missing from approval",
        approval,
      };
    }

    const existingEvent = await calendarEventRepository.findById(approval.eventId);
    if (!existingEvent) {
      await calendarApprovalRepository.markFailed(approvalId, "Event no longer exists");
      return {
        success: false,
        error: "Event not found",
        message: "The event to update no longer exists",
        approval,
      };
    }

    // Get Google Event ID
    const googleEventId = existingEvent.googleEventId;
    if (!googleEventId) {
      await calendarApprovalRepository.markFailed(approvalId, "No Google Event ID");
      return {
        success: false,
        error: "Not a Google event",
        message: "This event is not synced with Google Calendar",
        approval,
      };
    }

    // Extract update data from snapshot
    const snapshot = approval.eventSnapshot as unknown as EventSnapshot;
    const updateData = snapshot.updateData;
    const sendUpdates = snapshot.sendUpdates || "none";

    if (!updateData) {
      return {
        success: false,
        error: "No update data in approval",
        message: "Update data is missing from approval",
        approval,
      };
    }

    // Get access token
    const accessToken = await getValidAccessToken(approval.userId);
    if (!accessToken) {
      await calendarApprovalRepository.markFailed(approvalId, "No valid access token");
      return {
        success: false,
        error: "Authentication failed",
        message: "Could not get valid access token for user",
        approval,
      };
    }

    // Create Calendar client
    const client = createCalendarClient(accessToken, approval.userId);

    // Update event in Google Calendar
    const googleEvent = await client.updateEvent(
      approval.calendarId,
      googleEventId,
      updateData,
      { sendUpdates }
    );

    // Sync updated event to local database
    const dbEventInput = mapGoogleEventToDb(googleEvent, approval.userId, approval.calendarId);
    const dbEvent = await calendarEventRepository.upsert(dbEventInput);

    // Mark approval as executed
    await calendarApprovalRepository.markExecuted(approvalId, dbEvent.id);

    // Log audit entry
    await logAuditEntry({
      userId: approval.userId,
      actionType: "calendar_update_executed",
      actionCategory: "calendar",
      entityType: "event",
      entityId: dbEvent.id,
      metadata: {
        approvalId,
        googleEventId: googleEvent.id,
        eventSummary: googleEvent.summary,
        calendarId: approval.calendarId,
        updatedFields: Object.keys(updateData),
      },
    });

    logger.info("Event updated successfully", {
      eventId: dbEvent.id,
      googleEventId: googleEvent.id,
    });

    return {
      success: true,
      event: dbEvent,
      approval: await calendarApprovalRepository.findById(approvalId) || approval,
      message: `Event "${googleEvent.summary}" updated successfully`,
    };
  } catch (error) {
    logger.error("Error executing event update", { error });

    // Mark approval as failed
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await calendarApprovalRepository.markFailed(approvalId, errorMessage);

    return {
      success: false,
      error: errorMessage,
      message: "Failed to update event in Google Calendar",
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

