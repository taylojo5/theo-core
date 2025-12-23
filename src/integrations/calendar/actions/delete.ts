// ═══════════════════════════════════════════════════════════════════════════
// Calendar Event Deletion Actions
// Request and execute event deletion with approval workflow
// ═══════════════════════════════════════════════════════════════════════════

import { createCalendarClient } from "../client";
import { calendarApprovalRepository, calendarEventRepository } from "../repository";
import { calendarLogger } from "../logger";
import { logAuditEntry } from "@/services/audit";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import { APPROVAL_DEFAULT_EXPIRATION_MS } from "../constants";
import { Prisma } from "@prisma/client";
import type {
  DeleteEventRequest,
  ActionRequestResult,
  ActionExecuteResult,
  EventSnapshot,
  ApprovalOptions,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Request Event Deletion
// ─────────────────────────────────────────────────────────────

/**
 * Request deletion of an existing event
 * 
 * Creates an approval record that must be approved before execution.
 * 
 * @param request - Event deletion request
 * @param options - Approval options
 * @returns Result with approval record
 */
export async function requestEventDeletion(
  request: DeleteEventRequest,
  options: ApprovalOptions = {}
): Promise<ActionRequestResult> {
  const {
    userId,
    calendarId,
    eventId,
    googleEventId,
    sendUpdates = "none",
    requestedBy,
    notes,
  } = request;
  
  const logger = calendarLogger.child("requestEventDeletion");

  try {
    // Find the existing event
    const existingEvent = await calendarEventRepository.findById(eventId);
    
    if (!existingEvent) {
      return {
        success: false,
        error: "Event not found",
        message: "The event to delete does not exist",
      };
    }

    // Verify ownership
    if (existingEvent.userId !== userId) {
      return {
        success: false,
        error: "Permission denied",
        message: "You do not have permission to delete this event",
      };
    }

    // Verify it's a Google Calendar event
    if (!existingEvent.googleEventId) {
      return {
        success: false,
        error: "Not a Google event",
        message: "This event is not synced with Google Calendar",
      };
    }

    // Build event snapshot
    const eventSnapshot: EventSnapshot = {
      actionType: "delete",
      originalEvent: {
        id: existingEvent.id,
        googleEventId: existingEvent.googleEventId,
        title: existingEvent.title || undefined,
        startsAt: existingEvent.startsAt,
        endsAt: existingEvent.endsAt || undefined,
        calendarId: existingEvent.googleCalendarId || undefined,
      },
      sendUpdates,
    };

    // Calculate expiration
    const expiresAt = options.expiresAt || 
      new Date(Date.now() + APPROVAL_DEFAULT_EXPIRATION_MS);

    // Create approval record
    const approval = await calendarApprovalRepository.create({
      userId,
      actionType: "delete",
      calendarId,
      eventId,
      eventSnapshot: eventSnapshot as unknown as Prisma.InputJsonValue,
      requestedBy: requestedBy || "agent",
      expiresAt,
      metadata: {
        ...options.metadata,
        reason: notes,
      } as Prisma.InputJsonValue,
    });

    // Log audit entry
    await logAuditEntry({
      userId,
      actionType: "calendar_delete_requested",
      actionCategory: "calendar",
      entityType: "calendar_approval",
      entityId: approval.id,
      metadata: {
        eventId,
        eventSummary: existingEvent.title,
        calendarId,
        reason: notes,
      },
    });

    logger.info("Event deletion request created", {
      approvalId: approval.id,
      eventSummary: existingEvent.title,
    });

    return {
      success: true,
      approval,
      approvalId: approval.id,
      message: `Deletion request for "${existingEvent.title}" submitted for approval.`,
    };
  } catch (error) {
    logger.error("Error requesting event deletion", { error });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to create deletion request",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Execute Event Deletion
// ─────────────────────────────────────────────────────────────

/**
 * Execute an approved event deletion
 * 
 * Actually deletes the event from Google Calendar and marks as deleted locally.
 * Should only be called after approval.
 * 
 * @param approvalId - ID of the approved request
 * @returns Result of deletion
 */
export async function executeEventDeletion(
  approvalId: string
): Promise<ActionExecuteResult> {
  const logger = calendarLogger.child("executeEventDeletion");

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
    if (approval.actionType !== "delete") {
      return {
        success: false,
        error: "Wrong action type",
        message: "This approval is not for event deletion",
        approval,
      };
    }

    // Get the event to delete
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
      // Event already deleted - mark approval as executed
      await calendarApprovalRepository.markExecuted(approvalId);
      return {
        success: true,
        message: "Event was already deleted",
        approval: await calendarApprovalRepository.findById(approvalId) || approval,
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

    // Extract send updates preference from snapshot
    const snapshot = approval.eventSnapshot as unknown as EventSnapshot;
    const sendUpdates = snapshot.sendUpdates || "none";

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

    // Delete event from Google Calendar
    await client.deleteEvent(approval.calendarId, googleEventId, { sendUpdates });

    // Soft delete from local database
    await calendarEventRepository.softDelete(existingEvent.id);

    // Mark approval as executed
    await calendarApprovalRepository.markExecuted(approvalId);

    // Log audit entry
    await logAuditEntry({
      userId: approval.userId,
      actionType: "calendar_delete_executed",
      actionCategory: "calendar",
      entityType: "event",
      entityId: existingEvent.id,
      metadata: {
        approvalId,
        googleEventId,
        eventSummary: existingEvent.title,
        calendarId: approval.calendarId,
      },
    });

    logger.info("Event deleted successfully", {
      eventId: existingEvent.id,
      googleEventId,
    });

    return {
      success: true,
      approval: await calendarApprovalRepository.findById(approvalId) || approval,
      message: `Event "${existingEvent.title}" deleted successfully`,
    };
  } catch (error) {
    logger.error("Error executing event deletion", { error });

    // Mark approval as failed
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await calendarApprovalRepository.markFailed(approvalId, errorMessage);

    return {
      success: false,
      error: errorMessage,
      message: "Failed to delete event from Google Calendar",
    };
  }
}

