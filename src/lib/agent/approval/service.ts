// ═══════════════════════════════════════════════════════════════════════════
// Agent Approval Service
// Business logic for the action approval system
// ═══════════════════════════════════════════════════════════════════════════

import { DateTime } from "luxon";
import { agentLogger } from "../logger";
import { logAgentAction } from "../audit/service";
import { approvalRepository } from "./repository";
import type {
  AgentActionApproval,
  ApprovalCreateInput,
  ApprovalQueryOptions,
  ApprovalQueryResult,
  ApprovalDecision,
  ApproveOptions,
  RejectOptions,
  ApprovalDecisionResult,
  ApprovalDisplayData,
  ApprovalAssumptionDisplay,
  DEFAULT_EXPIRATION_MS,
  getEffectiveParameters,
} from "./types";
import type { RiskLevel, AssumptionCategory } from "../constants";

const logger = agentLogger.child("approval-service");

// ─────────────────────────────────────────────────────────────
// Approval Creation
// ─────────────────────────────────────────────────────────────

/**
 * Create a new approval with full LLM context
 *
 * This is the main entry point for creating approvals. It:
 * 1. Creates the approval record with LLM reasoning
 * 2. Logs to the audit trail
 * 3. Returns the approval with calculated expiration
 *
 * @param input - Approval creation input with LLM context
 * @returns Created approval record and audit log ID
 */
export async function createApproval(
  input: ApprovalCreateInput
): Promise<{ approval: AgentActionApproval; auditLogId: string }> {
  logger.info("Creating approval", {
    userId: input.userId,
    toolName: input.toolName,
    riskLevel: input.riskLevel,
    confidence: input.confidence,
  });

  // Create the approval record
  const approval = await approvalRepository.create(input);

  // Log to audit trail
  const auditEntry = await logAgentAction({
    userId: input.userId,
    conversationId: input.conversationId,
    actionType: "create",
    actionCategory: "agent",
    entityType: "action_approval",
    entityId: approval.id,
    intent: `Request approval for ${input.toolName}`,
    reasoning: input.reasoning,
    confidence: input.confidence,
    inputSummary: JSON.stringify({
      toolName: input.toolName,
      parameters: input.parameters,
      riskLevel: input.riskLevel,
    }),
    outputSummary: JSON.stringify({
      approvalId: approval.id,
      expiresAt: approval.expiresAt,
    }),
    status: "completed",
  });

  // Link audit log to approval
  await approvalRepository.setAuditLogId(approval.id, auditEntry.id);

  logger.info("Approval created", {
    approvalId: approval.id,
    expiresAt: approval.expiresAt,
    auditLogId: auditEntry.id,
  });

  return {
    approval: { ...approval, auditLogId: auditEntry.id },
    auditLogId: auditEntry.id,
  };
}

// ─────────────────────────────────────────────────────────────
// Approval Queries
// ─────────────────────────────────────────────────────────────

/**
 * Get a single approval with full context for display
 */
export async function getApproval(
  userId: string,
  approvalId: string
): Promise<AgentActionApproval | null> {
  return approvalRepository.getByIdForUser(userId, approvalId);
}

/**
 * Get pending approvals for a user
 */
export async function getPendingApprovals(
  userId: string,
  options?: ApprovalQueryOptions
): Promise<AgentActionApproval[]> {
  return approvalRepository.getPending(userId, options);
}

/**
 * Query approvals with filters
 */
export async function queryApprovals(
  userId: string,
  options?: ApprovalQueryOptions
): Promise<ApprovalQueryResult> {
  return approvalRepository.query(userId, options);
}

/**
 * Get pending approval count for a user (for badge display)
 */
export async function getPendingCount(userId: string): Promise<number> {
  const counts = await approvalRepository.getCountByStatus(userId);
  return counts.pending ?? 0;
}

// ─────────────────────────────────────────────────────────────
// Decision Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process a user's approval decision
 *
 * This handles both approval and rejection:
 * - Approve: Optionally with modified parameters
 * - Reject: Optionally with feedback
 *
 * If the approval is part of a plan, returns info for plan resumption.
 *
 * @param userId - User making the decision
 * @param approvalId - Approval to decide on
 * @param decision - Approve or reject
 * @param options - Approve/reject options
 * @returns Decision result including plan resumption info
 */
export async function processApprovalDecision(
  userId: string,
  approvalId: string,
  decision: ApprovalDecision,
  options?: ApproveOptions & RejectOptions
): Promise<ApprovalDecisionResult | null> {
  logger.info("Processing approval decision", {
    userId,
    approvalId,
    decision,
  });

  // Get current approval state
  const existing = await approvalRepository.getByIdForUser(userId, approvalId);
  if (!existing) {
    logger.warn("Approval not found", { approvalId, userId });
    return null;
  }

  // Check if expired
  if (existing.expiresAt && new Date() > existing.expiresAt) {
    logger.warn("Approval has expired", { approvalId });
    return null;
  }

  // Check if already decided
  if (existing.status !== "pending") {
    logger.warn("Approval already decided", {
      approvalId,
      status: existing.status,
    });
    return null;
  }

  let updatedApproval: AgentActionApproval | null;

  if (decision === "approve") {
    updatedApproval = await approvalRepository.approve(
      userId,
      approvalId,
      options?.modifiedParameters
    );
  } else {
    updatedApproval = await approvalRepository.reject(
      userId,
      approvalId,
      options?.feedback
    );
  }

  if (!updatedApproval) {
    logger.error("Failed to update approval", { approvalId, decision });
    return null;
  }

  // Log decision to audit trail
  await logAgentAction({
    userId,
    conversationId: existing.conversationId,
    actionType: decision === "approve" ? "approve" : "reject",
    actionCategory: "agent",
    entityType: "action_approval",
    entityId: approvalId,
    intent: `User ${decision}d ${existing.toolName} action`,
    reasoning: decision === "reject" ? options?.feedback : undefined,
    inputSummary: JSON.stringify({
      approvalId,
      decision,
      modifiedParameters: options?.modifiedParameters,
      feedback: options?.feedback,
    }),
    status: "completed",
  });

  // Calculate effective parameters (original + modifications)
  const effectiveParameters =
    decision === "approve"
      ? {
          ...existing.parameters,
          ...(options?.modifiedParameters ?? {}),
        }
      : undefined;

  // Check if part of a plan for resumption
  const planResumption =
    existing.planId && existing.stepIndex !== undefined
      ? {
          planId: existing.planId,
          stepIndex: existing.stepIndex,
        }
      : undefined;

  logger.info("Approval decision processed", {
    approvalId,
    decision,
    hasModifications: !!options?.modifiedParameters,
    planResumption,
  });

  return {
    approval: updatedApproval,
    shouldExecute: decision === "approve",
    effectiveParameters,
    planResumption,
  };
}

/**
 * Approve an action (convenience function)
 */
export async function approveAction(
  userId: string,
  approvalId: string,
  options?: ApproveOptions
): Promise<ApprovalDecisionResult | null> {
  return processApprovalDecision(userId, approvalId, "approve", options);
}

/**
 * Reject an action (convenience function)
 */
export async function rejectAction(
  userId: string,
  approvalId: string,
  options?: RejectOptions
): Promise<ApprovalDecisionResult | null> {
  return processApprovalDecision(userId, approvalId, "reject", options);
}

// ─────────────────────────────────────────────────────────────
// Execution Tracking
// ─────────────────────────────────────────────────────────────

/**
 * Mark an approved action as successfully executed
 */
export async function markExecuted(
  approvalId: string,
  result: unknown
): Promise<void> {
  await approvalRepository.markExecuted(approvalId, result);

  logger.info("Approval marked as executed", { approvalId });
}

/**
 * Mark an approved action as failed
 */
export async function markFailed(
  approvalId: string,
  errorMessage: string
): Promise<void> {
  await approvalRepository.markFailed(approvalId, errorMessage);

  logger.warn("Approval marked as failed", { approvalId, errorMessage });
}

// ─────────────────────────────────────────────────────────────
// Display Formatting
// ─────────────────────────────────────────────────────────────

/**
 * Format approval for UI display
 *
 * Converts the full approval record into a display-friendly format
 * with formatted dates, percentages, and summaries.
 */
export async function getApprovalForDisplay(
  userId: string,
  approvalId: string
): Promise<ApprovalDisplayData | null> {
  const approval = await approvalRepository.getByIdForUser(userId, approvalId);
  if (!approval) {
    return null;
  }

  return formatApprovalForDisplay(approval);
}

/**
 * Format an approval record for display
 */
export function formatApprovalForDisplay(
  approval: AgentActionApproval
): ApprovalDisplayData {
  // Format assumptions for display
  const assumptionDisplays: ApprovalAssumptionDisplay[] = approval.assumptions.map(
    (a) => ({
      statement: a.statement,
      category: a.category as AssumptionCategory,
      confidencePercent: Math.round(a.confidence * 100),
      evidenceSummary:
        a.evidence.length > 0
          ? a.evidence.slice(0, 2).join("; ")
          : "No specific evidence",
    })
  );

  // Calculate time until expiration
  let expiresIn: string | undefined;
  let isUrgent = false;

  if (approval.expiresAt) {
    const now = DateTime.now();
    const expires = DateTime.fromJSDate(approval.expiresAt);
    const diff = expires.diff(now, ["hours", "minutes"]);

    if (diff.hours > 0) {
      expiresIn = `${Math.floor(diff.hours)} hours`;
    } else if (diff.minutes > 0) {
      expiresIn = `${Math.floor(diff.minutes)} minutes`;
      isUrgent = diff.minutes < 30;
    } else {
      expiresIn = "soon";
      isUrgent = true;
    }
  }

  return {
    id: approval.id,
    toolName: approval.toolName,
    summary: approval.summary,
    reasoning: approval.reasoning,
    confidencePercent: Math.round(approval.confidence * 100),
    riskLevel: approval.riskLevel,
    assumptions: assumptionDisplays,
    parameters: sanitizeParametersForDisplay(approval.parameters),
    expiresIn,
    isUrgent,
    // Plan context would be loaded separately if needed
    planContext: undefined,
  };
}

/**
 * Sanitize parameters for display (remove sensitive data)
 */
function sanitizeParametersForDisplay(
  params: Record<string, unknown>
): Record<string, unknown> {
  const sensitiveKeys = ["password", "token", "secret", "key", "apiKey"];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k))) {
      sanitized[key] = "***";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeParametersForDisplay(
        value as Record<string, unknown>
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ─────────────────────────────────────────────────────────────
// Plan Integration
// ─────────────────────────────────────────────────────────────

/**
 * Get pending approvals for a plan
 */
export async function getPendingApprovalsForPlan(
  planId: string
): Promise<AgentActionApproval[]> {
  return approvalRepository.getPendingForPlan(planId);
}

/**
 * Cancel all pending approvals for a cancelled plan
 */
export async function cancelApprovalsForPlan(planId: string): Promise<number> {
  const count = await approvalRepository.cancelForPlan(planId);

  if (count > 0) {
    logger.info("Cancelled approvals for plan", { planId, count });
  }

  return count;
}

// ─────────────────────────────────────────────────────────────
// Export Service Object
// ─────────────────────────────────────────────────────────────

export const approvalService = {
  // Creation
  createApproval,

  // Queries
  getApproval,
  getPendingApprovals,
  queryApprovals,
  getPendingCount,

  // Decisions
  processApprovalDecision,
  approveAction,
  rejectAction,

  // Execution tracking
  markExecuted,
  markFailed,

  // Display
  getApprovalForDisplay,
  formatApprovalForDisplay,

  // Plan integration
  getPendingApprovalsForPlan,
  cancelApprovalsForPlan,
};

