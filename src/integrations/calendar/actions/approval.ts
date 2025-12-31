// ═══════════════════════════════════════════════════════════════════════════
// Calendar Approval Actions
// Approve, reject, and expire calendar action requests
// ═══════════════════════════════════════════════════════════════════════════

import { calendarApprovalRepository } from "../repository";
import { calendarLogger } from "../logger";
import { logAuditEntry } from "@/services/audit";
import { executeEventCreation } from "./create";
import { executeEventUpdate } from "./update";
import { executeEventDeletion } from "./delete";
import { executeEventResponse } from "./respond";
import type {
  ApprovalDecisionResult,
  ActionExecuteResult,
  CalendarActionType,
} from "./types";
import type { CalendarApproval } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Approve Action
// ─────────────────────────────────────────────────────────────

/**
 * Approve a calendar action request
 *
 * Approves the request and optionally auto-executes the action.
 *
 * @param userId - User approving the action
 * @param approvalId - ID of the approval to approve
 * @param options - Additional options
 * @returns Result with approval and optional execution result
 */
export async function approveCalendarAction(
  userId: string,
  approvalId: string,
  options: {
    autoExecute?: boolean;
    decidedBy?: string;
  } = {}
): Promise<ApprovalDecisionResult> {
  const { autoExecute = true, decidedBy = "user" } = options;

  const logger = calendarLogger.child("approveCalendarAction");

  try {
    // Get approval record
    const approval = await calendarApprovalRepository.findByUserAndId(
      userId,
      approvalId
    );

    if (!approval) {
      return {
        success: false,
        error: "Approval not found",
        message:
          "The approval request does not exist or does not belong to you",
      };
    }

    // Validate status
    if (approval.status !== "pending") {
      return {
        success: false,
        error: `Invalid status: ${approval.status}`,
        message: `Cannot approve action with status "${approval.status}"`,
        approval,
      };
    }

    // Check expiration
    if (approval.expiresAt && new Date() > approval.expiresAt) {
      // Mark as expired
      await calendarApprovalRepository.expire(approvalId);
      return {
        success: false,
        error: "Approval expired",
        message: "This approval request has expired",
        approval:
          (await calendarApprovalRepository.findById(approvalId)) || approval,
      };
    }

    // Approve the request
    const approvedApproval = await calendarApprovalRepository.approve(
      approvalId,
      decidedBy
    );

    // Log audit entry
    await logAuditEntry({
      userId,
      actionType: "calendar_action_approved",
      actionCategory: "calendar",
      entityType: "calendar_approval",
      entityId: approvalId,
      metadata: {
        approvedActionType: approval.actionType,
        eventId: approval.eventId,
        decidedBy,
      },
    });

    logger.info("Approval approved", {
      approvalId,
      actionType: approval.actionType,
    });

    // Auto-execute if requested
    if (autoExecute) {
      const executeResult = await executeApprovedAction(
        approvalId,
        approval.actionType
      );

      return {
        success: executeResult.success,
        approval: executeResult.approval || approvedApproval,
        event: executeResult.event,
        error: executeResult.error,
        message: executeResult.message,
      };
    }

    return {
      success: true,
      approval: approvedApproval,
      message: `Action approved. ${autoExecute ? "" : "Ready for execution."}`,
    };
  } catch (error) {
    logger.error("Error approving action", { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to approve action",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Reject Action
// ─────────────────────────────────────────────────────────────

/**
 * Reject a calendar action request
 *
 * @param userId - User rejecting the action
 * @param approvalId - ID of the approval to reject
 * @param options - Additional options
 * @returns Result with updated approval
 */
export async function rejectCalendarAction(
  userId: string,
  approvalId: string,
  options: {
    notes?: string;
    decidedBy?: string;
  } = {}
): Promise<ApprovalDecisionResult> {
  const { notes, decidedBy = "user" } = options;

  const logger = calendarLogger.child("rejectCalendarAction");

  try {
    // Get approval record
    const approval = await calendarApprovalRepository.findByUserAndId(
      userId,
      approvalId
    );

    if (!approval) {
      return {
        success: false,
        error: "Approval not found",
        message:
          "The approval request does not exist or does not belong to you",
      };
    }

    // Validate status
    if (approval.status !== "pending") {
      return {
        success: false,
        error: `Invalid status: ${approval.status}`,
        message: `Cannot reject action with status "${approval.status}"`,
        approval,
      };
    }

    // Reject the request
    const rejectedApproval = await calendarApprovalRepository.reject(
      approvalId,
      notes,
      decidedBy
    );

    // Log audit entry
    await logAuditEntry({
      userId,
      actionType: "calendar_action_rejected",
      actionCategory: "calendar",
      entityType: "calendar_approval",
      entityId: approvalId,
      metadata: {
        rejectedActionType: approval.actionType,
        eventId: approval.eventId,
        decidedBy,
        notes,
      },
    });

    logger.info("Approval rejected", {
      approvalId,
      actionType: approval.actionType,
    });

    return {
      success: true,
      approval: rejectedApproval,
      message: "Action rejected",
    };
  } catch (error) {
    logger.error("Error rejecting action", { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to reject action",
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Expire Old Approvals
// ─────────────────────────────────────────────────────────────

/**
 * Expire all overdue approval requests
 *
 * Should be called periodically (e.g., via scheduler).
 *
 * @returns Number of approvals expired
 */
export async function expireOldApprovals(): Promise<number> {
  const logger = calendarLogger.child("expireOldApprovals");

  try {
    const expiredCount = await calendarApprovalRepository.expireAll();

    if (expiredCount > 0) {
      logger.info("Expired old approvals", { count: expiredCount });

      // Log aggregate audit entry (use system user for auto-expired)
      await logAuditEntry({
        userId: "system",
        actionType: "calendar_approvals_expired",
        actionCategory: "calendar",
        entityType: "calendar_approval",
        metadata: {
          count: expiredCount,
        },
      });
    }

    return expiredCount;
  } catch (error) {
    logger.error("Error expiring approvals", { error });
    return 0;
  }
}

// ─────────────────────────────────────────────────────────────
// Get Pending Approvals
// ─────────────────────────────────────────────────────────────

/**
 * Get all pending approvals for a user
 *
 * @param userId - User to get approvals for
 * @returns Array of pending approvals
 */
export async function getPendingApprovals(
  userId: string
): Promise<CalendarApproval[]> {
  return calendarApprovalRepository.findPending(userId);
}

/**
 * Get a specific approval by ID
 *
 * @param userId - User requesting the approval
 * @param approvalId - ID of the approval
 * @returns The approval or null
 */
export async function getApproval(
  userId: string,
  approvalId: string
): Promise<CalendarApproval | null> {
  return calendarApprovalRepository.findByUserAndId(userId, approvalId);
}

// ─────────────────────────────────────────────────────────────
// Execute Approved Action
// ─────────────────────────────────────────────────────────────

/**
 * Execute an approved action based on its type
 *
 * @param approvalId - ID of the approved request
 * @param actionType - Type of action to execute
 * @returns Result of execution
 */
async function executeApprovedAction(
  approvalId: string,
  actionType: string
): Promise<ActionExecuteResult> {
  switch (actionType as CalendarActionType) {
    case "create":
      return executeEventCreation(approvalId);
    case "update":
      return executeEventUpdate(approvalId);
    case "delete":
      return executeEventDeletion(approvalId);
    case "respond":
      return executeEventResponse(approvalId);
    default:
      return {
        success: false,
        error: `Unknown action type: ${actionType}`,
        message: `Cannot execute action of type "${actionType}"`,
      };
  }
}

// ─────────────────────────────────────────────────────────────
// Cancel Approval
// ─────────────────────────────────────────────────────────────

/**
 * Cancel a pending approval request
 *
 * Allows the requester (agent) to cancel a request before the user decides.
 *
 * @param userId - User who owns the approval
 * @param approvalId - ID of the approval to cancel
 * @returns Result with updated approval
 */
export async function cancelApproval(
  userId: string,
  approvalId: string
): Promise<ApprovalDecisionResult> {
  const logger = calendarLogger.child("cancelApproval");

  try {
    // Get approval record
    const approval = await calendarApprovalRepository.findByUserAndId(
      userId,
      approvalId
    );

    if (!approval) {
      return {
        success: false,
        error: "Approval not found",
        message:
          "The approval request does not exist or does not belong to you",
      };
    }

    // Validate status
    if (approval.status !== "pending") {
      return {
        success: false,
        error: `Invalid status: ${approval.status}`,
        message: `Cannot cancel action with status "${approval.status}"`,
        approval,
      };
    }

    // Reject/cancel the request
    const cancelledApproval = await calendarApprovalRepository.reject(
      approvalId,
      "Cancelled by requester",
      "cancelled"
    );

    // Log audit entry
    await logAuditEntry({
      userId,
      actionType: "calendar_action_cancelled",
      actionCategory: "calendar",
      entityType: "calendar_approval",
      entityId: approvalId,
      metadata: {
        cancelledActionType: approval.actionType,
        eventId: approval.eventId,
      },
    });

    logger.info("Approval cancelled", {
      approvalId,
      actionType: approval.actionType,
    });

    return {
      success: true,
      approval: cancelledApproval,
      message: "Action request cancelled",
    };
  } catch (error) {
    logger.error("Error cancelling action", { error });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to cancel action",
    };
  }
}
