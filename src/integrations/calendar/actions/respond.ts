// ═══════════════════════════════════════════════════════════════════════════
// Calendar Event Response Actions
// Request and execute RSVP responses with approval workflow
// ═══════════════════════════════════════════════════════════════════════════

import { createCalendarClient } from "../client";
import { calendarApprovalRepository, calendarEventRepository } from "../repository";
import { calendarLogger } from "../logger";
import { mapGoogleEventToDb } from "../mappers";
import { logAuditEntry } from "@/services/audit";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import { APPROVAL_DEFAULT_EXPIRATION_MS } from "../constants";
import { Prisma } from "@prisma/client";
import type {
  RespondEventRequest,
  ActionRequestResult,
  ActionExecuteResult,
  EventSnapshot,
  ApprovalOptions,
} from "./types";
import type { AttendeeResponseStatus } from "../types";

// ─────────────────────────────────────────────────────────────
// Request Event Response
// ─────────────────────────────────────────────────────────────

/**
 * Request to respond to an event invitation (RSVP)
 * 
 * Creates an approval record that must be approved before execution.
 * 
 * @param request - Event response request
 * @param options - Approval options
 * @returns Result with approval record
 */
export async function requestEventResponse(
  request: RespondEventRequest,
  options: ApprovalOptions = {}
): Promise<ActionRequestResult> {
  const {
    userId,
    calendarId,
    eventId,
    googleEventId,
    response,
    comment,
    sendUpdates = "all",
    requestedBy,
    notes,
  } = request;
  
  const logger = calendarLogger.child("requestEventResponse");

  try {
    // Validate response value
    if (!isValidResponse(response)) {
      return {
        success: false,
        error: "Invalid response",
        message: `Response must be one of: accepted, declined, tentative`,
      };
    }

    // Find the existing event
    const existingEvent = await calendarEventRepository.findById(eventId);
    
    if (!existingEvent) {
      return {
        success: false,
        error: "Event not found",
        message: "The event to respond to does not exist",
      };
    }

    // Verify ownership
    if (existingEvent.userId !== userId) {
      return {
        success: false,
        error: "Permission denied",
        message: "You do not have permission to respond to this event",
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
      actionType: "respond",
      responseData: {
        response,
        comment,
      },
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
      actionType: "respond",
      calendarId,
      eventId,
      eventSnapshot: eventSnapshot as unknown as Prisma.InputJsonValue,
      requestedBy: requestedBy || "agent",
      expiresAt,
      metadata: {
        ...options.metadata,
        notes,
      } as Prisma.InputJsonValue,
    });

    // Log audit entry
    await logAuditEntry({
      userId,
      actionType: "calendar_respond_requested",
      actionCategory: "calendar",
      entityType: "calendar_approval",
      entityId: approval.id,
      metadata: {
        eventId,
        eventSummary: existingEvent.title,
        calendarId,
        response,
        comment,
      },
    });

    const responseLabel = getResponseLabel(response);
    logger.info("Event response request created", {
      approvalId: approval.id,
      response: responseLabel,
    });

    return {
      success: true,
      approval,
      approvalId: approval.id,
      message: `Request to respond "${responseLabel}" to "${existingEvent.title}" submitted for approval.`,
    };
  } catch (error) {
    logger.error("Error requesting event response", { error });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to create response request",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Execute Event Response
// ─────────────────────────────────────────────────────────────

/**
 * Execute an approved event response (RSVP)
 * 
 * Actually updates the response in Google Calendar and syncs to local DB.
 * Should only be called after approval.
 * 
 * @param approvalId - ID of the approved request
 * @returns Result with updated event
 */
export async function executeEventResponse(
  approvalId: string
): Promise<ActionExecuteResult> {
  const logger = calendarLogger.child("executeEventResponse");

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
    if (approval.actionType !== "respond") {
      return {
        success: false,
        error: "Wrong action type",
        message: "This approval is not for event response",
        approval,
      };
    }

    // Get the event
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
        message: "The event to respond to no longer exists",
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

    // Extract response data from snapshot
    const snapshot = approval.eventSnapshot as unknown as EventSnapshot;
    const responseData = snapshot.responseData;
    const sendUpdates = snapshot.sendUpdates || "all";

    if (!responseData) {
      return {
        success: false,
        error: "No response data in approval",
        message: "Response data is missing from approval",
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

    // Send response to Google Calendar
    const googleEvent = await client.respondToEvent(
      approval.calendarId,
      googleEventId,
      responseData.response,
      {
        comment: responseData.comment,
        sendUpdates,
      }
    );

    // Sync updated event to local database
    const dbEventInput = mapGoogleEventToDb(googleEvent, approval.userId, approval.calendarId);
    const dbEvent = await calendarEventRepository.upsert(dbEventInput);

    // Mark approval as executed
    await calendarApprovalRepository.markExecuted(approvalId, dbEvent.id);

    // Log audit entry
    const responseLabel = getResponseLabel(responseData.response);
    await logAuditEntry({
      userId: approval.userId,
      actionType: "calendar_respond_executed",
      actionCategory: "calendar",
      entityType: "event",
      entityId: dbEvent.id,
      metadata: {
        approvalId,
        googleEventId: googleEvent.id,
        eventSummary: googleEvent.summary,
        calendarId: approval.calendarId,
        response: responseLabel,
      },
    });

    logger.info("Event response sent successfully", {
      eventId: dbEvent.id,
      googleEventId: googleEvent.id,
      response: responseLabel,
    });

    return {
      success: true,
      event: dbEvent,
      approval: await calendarApprovalRepository.findById(approvalId) || approval,
      message: `Responded "${responseLabel}" to "${googleEvent.summary}"`,
    };
  } catch (error) {
    logger.error("Error executing event response", { error });

    // Mark approval as failed
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await calendarApprovalRepository.markFailed(approvalId, errorMessage);

    return {
      success: false,
      error: errorMessage,
      message: "Failed to send response to Google Calendar",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Validate response value
 */
function isValidResponse(response: string): response is AttendeeResponseStatus {
  return ["accepted", "declined", "tentative", "needsAction"].includes(response);
}

/**
 * Get human-readable label for response
 */
function getResponseLabel(response: AttendeeResponseStatus): string {
  const labels: Record<AttendeeResponseStatus, string> = {
    accepted: "Yes",
    declined: "No",
    tentative: "Maybe",
    needsAction: "Pending",
  };
  return labels[response] || response;
}

