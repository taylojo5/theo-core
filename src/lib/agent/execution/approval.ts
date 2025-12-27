// ═══════════════════════════════════════════════════════════════════════════
// Approval Record Creation
// Creates pending approval records for high-risk actions
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { DateTime } from "luxon";
import type { Prisma } from "@prisma/client";
import { agentLogger } from "../logger";
import { logAgentAction } from "../audit/service";
import type { ApprovalCreationInput, ApprovalCreationResult } from "./types";
import type { ActionApproval, RiskLevel } from "../types";

const logger = agentLogger.child("approval");

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/**
 * Default expiration times by risk level (in milliseconds)
 */
const DEFAULT_EXPIRATION_MS: Record<RiskLevel, number> = {
  low: 24 * 60 * 60 * 1000, // 24 hours
  medium: 12 * 60 * 60 * 1000, // 12 hours
  high: 4 * 60 * 60 * 1000, // 4 hours
  critical: 1 * 60 * 60 * 1000, // 1 hour
};

// ─────────────────────────────────────────────────────────────
// Approval Creation
// ─────────────────────────────────────────────────────────────

/**
 * Create a pending approval record for a high-risk action
 *
 * This creates a record in the database that the user can later
 * approve or reject. The approval expires after a configurable time.
 *
 * @param input - Approval creation input
 * @returns Created approval record and audit log ID
 */
export async function createPendingApproval(
  input: ApprovalCreationInput
): Promise<ApprovalCreationResult> {
  const {
    userId,
    toolName,
    parameters,
    actionType,
    riskLevel,
    reasoning,
    conversationId,
    planId,
    stepIndex,
    expiresInMs,
  } = input;

  // Calculate expiration time
  const expirationMs = expiresInMs ?? DEFAULT_EXPIRATION_MS[riskLevel];
  const expiresAt = DateTime.now()
    .plus({ milliseconds: expirationMs })
    .toJSDate();

  logger.debug("Creating pending approval", {
    userId,
    toolName,
    riskLevel,
    expiresAt,
  });

  // Create the approval record
  const approval = await db.actionApproval.create({
    data: {
      userId,
      toolName,
      parameters: parameters as Prisma.InputJsonValue,
      actionType,
      riskLevel,
      reasoning,
      status: "pending",
      conversationId,
      planId,
      stepIndex,
      expiresAt,
    },
  });

  // Log to audit trail
  const auditEntry = await logAgentAction({
    userId,
    conversationId,
    actionType: "create",
    actionCategory: "agent",
    entityType: "action_approval",
    entityId: approval.id,
    intent: `Request approval for ${toolName}`,
    reasoning,
    inputSummary: JSON.stringify({
      toolName,
      parameters,
      riskLevel,
    }),
    outputSummary: JSON.stringify({
      approvalId: approval.id,
      expiresAt,
    }),
    status: "completed",
  });

  logger.info("Pending approval created", {
    approvalId: approval.id,
    userId,
    toolName,
    expiresAt,
    auditLogId: auditEntry.id,
  });

  // Convert database model to domain type
  const domainApproval: ActionApproval = {
    id: approval.id,
    userId: approval.userId,
    planId: approval.planId ?? undefined,
    stepIndex: approval.stepIndex ?? undefined,
    conversationId: approval.conversationId ?? undefined,
    actionType: approval.actionType,
    toolName: approval.toolName,
    parameters: approval.parameters as Record<string, unknown>,
    status: approval.status as ActionApproval["status"],
    riskLevel: approval.riskLevel as RiskLevel,
    reasoning: approval.reasoning,
    requestedAt: approval.requestedAt,
    expiresAt: approval.expiresAt ?? undefined,
    decidedAt: approval.decidedAt ?? undefined,
    result: approval.result ?? undefined,
    errorMessage: approval.errorMessage ?? undefined,
  };

  return {
    approval: domainApproval,
    auditLogId: auditEntry.id,
  };
}

// ─────────────────────────────────────────────────────────────
// Approval Query Functions
// ─────────────────────────────────────────────────────────────

/**
 * Get a pending approval by ID
 */
export async function getPendingApproval(
  userId: string,
  approvalId: string
): Promise<ActionApproval | null> {
  const approval = await db.actionApproval.findFirst({
    where: {
      id: approvalId,
      userId, // Security: ensure user owns this approval
    },
  });

  if (!approval) {
    return null;
  }

  return {
    id: approval.id,
    userId: approval.userId,
    planId: approval.planId ?? undefined,
    stepIndex: approval.stepIndex ?? undefined,
    conversationId: approval.conversationId ?? undefined,
    actionType: approval.actionType,
    toolName: approval.toolName,
    parameters: approval.parameters as Record<string, unknown>,
    status: approval.status as ActionApproval["status"],
    riskLevel: approval.riskLevel as RiskLevel,
    reasoning: approval.reasoning,
    requestedAt: approval.requestedAt,
    expiresAt: approval.expiresAt ?? undefined,
    decidedAt: approval.decidedAt ?? undefined,
    result: approval.result ?? undefined,
    errorMessage: approval.errorMessage ?? undefined,
  };
}

/**
 * List pending approvals for a user
 */
export async function listPendingApprovals(
  userId: string,
  options?: {
    limit?: number;
    conversationId?: string;
    planId?: string;
  }
): Promise<ActionApproval[]> {
  const approvals = await db.actionApproval.findMany({
    where: {
      userId,
      status: "pending",
      conversationId: options?.conversationId,
      planId: options?.planId,
      expiresAt: {
        gt: new Date(), // Not expired
      },
    },
    orderBy: {
      requestedAt: "desc",
    },
    take: options?.limit ?? 20,
  });

  return approvals.map((approval) => ({
    id: approval.id,
    userId: approval.userId,
    planId: approval.planId ?? undefined,
    stepIndex: approval.stepIndex ?? undefined,
    conversationId: approval.conversationId ?? undefined,
    actionType: approval.actionType,
    toolName: approval.toolName,
    parameters: approval.parameters as Record<string, unknown>,
    status: approval.status as ActionApproval["status"],
    riskLevel: approval.riskLevel as RiskLevel,
    reasoning: approval.reasoning,
    requestedAt: approval.requestedAt,
    expiresAt: approval.expiresAt ?? undefined,
    decidedAt: approval.decidedAt ?? undefined,
    result: approval.result ?? undefined,
    errorMessage: approval.errorMessage ?? undefined,
  }));
}

/**
 * Update approval status (approve, reject, etc.)
 */
export async function updateApprovalStatus(
  userId: string,
  approvalId: string,
  status: "approved" | "rejected",
  options?: {
    result?: unknown;
    errorMessage?: string;
  }
): Promise<ActionApproval | null> {
  // First verify ownership
  const existing = await db.actionApproval.findFirst({
    where: {
      id: approvalId,
      userId, // Security: ensure user owns this approval
    },
  });

  if (!existing) {
    logger.warn("Approval not found or unauthorized", {
      approvalId,
      userId,
    });
    return null;
  }

  // Check if already decided
  if (existing.status !== "pending") {
    logger.warn("Approval already decided", {
      approvalId,
      currentStatus: existing.status,
    });
    return null;
  }

  // Check if expired
  if (existing.expiresAt && existing.expiresAt < new Date()) {
    logger.warn("Approval has expired", {
      approvalId,
      expiresAt: existing.expiresAt,
    });
    return null;
  }

  // Update the approval
  const updated = await db.actionApproval.update({
    where: { id: approvalId },
    data: {
      status,
      decidedAt: new Date(),
      result: options?.result as Prisma.InputJsonValue | undefined,
      errorMessage: options?.errorMessage,
    },
  });

  logger.info("Approval status updated", {
    approvalId,
    status,
    userId,
  });

  return {
    id: updated.id,
    userId: updated.userId,
    planId: updated.planId ?? undefined,
    stepIndex: updated.stepIndex ?? undefined,
    conversationId: updated.conversationId ?? undefined,
    actionType: updated.actionType,
    toolName: updated.toolName,
    parameters: updated.parameters as Record<string, unknown>,
    status: updated.status as ActionApproval["status"],
    riskLevel: updated.riskLevel as RiskLevel,
    reasoning: updated.reasoning,
    requestedAt: updated.requestedAt,
    expiresAt: updated.expiresAt ?? undefined,
    decidedAt: updated.decidedAt ?? undefined,
    result: updated.result ?? undefined,
    errorMessage: updated.errorMessage ?? undefined,
  };
}

/**
 * Mark expired approvals as expired
 * This should be called periodically (e.g., by a cron job)
 */
export async function expireApprovals(): Promise<number> {
  const result = await db.actionApproval.updateMany({
    where: {
      status: "pending",
      expiresAt: {
        lt: new Date(),
      },
    },
    data: {
      status: "expired",
      decidedAt: new Date(),
    },
  });

  if (result.count > 0) {
    logger.info("Expired approvals", { count: result.count });
  }

  return result.count;
}

/**
 * Get approval expiration time for a risk level
 */
export function getDefaultExpirationMs(riskLevel: RiskLevel): number {
  return DEFAULT_EXPIRATION_MS[riskLevel];
}

