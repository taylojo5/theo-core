// ═══════════════════════════════════════════════════════════════════════════
// Agent Approval Repository
// Database operations for the action approval system
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { DateTime } from "luxon";
import type { Prisma } from "@prisma/client";
import { agentLogger } from "../logger";
import type {
  AgentActionApproval,
  ApprovalCreateInput,
  ApprovalUpdateInput,
  ApprovalQueryOptions,
  ApprovalQueryResult,
  ApprovalStatus,
  DEFAULT_EXPIRATION_MS,
} from "./types";
import type { RiskLevel } from "../constants";
import type { LLMAssumption } from "../llm/types";

const logger = agentLogger.child("approval-repository");

// ─────────────────────────────────────────────────────────────
// Default Expiration Times (in milliseconds)
// ─────────────────────────────────────────────────────────────

const EXPIRATION_MS: Record<RiskLevel, number> = {
  low: 24 * 60 * 60 * 1000, // 24 hours
  medium: 12 * 60 * 60 * 1000, // 12 hours
  high: 4 * 60 * 60 * 1000, // 4 hours
  critical: 1 * 60 * 60 * 1000, // 1 hour
};

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Convert database model to domain type
 */
function toDomainModel(
  record: Prisma.ActionApprovalGetPayload<object>
): AgentActionApproval {
  // Parse assumptions from JSON
  let assumptions: LLMAssumption[] = [];
  const metadata = record.parameters as Record<string, unknown> | null;
  if (metadata && "_assumptions" in metadata) {
    assumptions = (metadata._assumptions as LLMAssumption[]) ?? [];
  }

  // Parse other metadata
  const modifiedParams =
    metadata && "_modifiedParameters" in metadata
      ? (metadata._modifiedParameters as Record<string, unknown>)
      : undefined;
  const userFeedback =
    metadata && "_userFeedback" in metadata
      ? (metadata._userFeedback as string)
      : undefined;
  const confidence =
    metadata && "_confidence" in metadata
      ? (metadata._confidence as number)
      : 0.5;
  const summary =
    metadata && "_summary" in metadata
      ? (metadata._summary as string)
      : `${record.actionType} via ${record.toolName}`;
  const resolvedBy =
    metadata && "_resolvedBy" in metadata
      ? (metadata._resolvedBy as AgentActionApproval["resolvedBy"])
      : undefined;
  const auditLogId =
    metadata && "_auditLogId" in metadata
      ? (metadata._auditLogId as string)
      : undefined;

  // Extract clean parameters (without our metadata fields)
  const cleanParams = { ...metadata };
  delete cleanParams._assumptions;
  delete cleanParams._modifiedParameters;
  delete cleanParams._userFeedback;
  delete cleanParams._confidence;
  delete cleanParams._summary;
  delete cleanParams._resolvedBy;
  delete cleanParams._auditLogId;

  return {
    id: record.id,
    userId: record.userId,
    planId: record.planId ?? undefined,
    stepIndex: record.stepIndex ?? undefined,
    conversationId: record.conversationId ?? undefined,
    actionType: record.actionType,
    toolName: record.toolName,
    parameters: cleanParams,
    reasoning: record.reasoning,
    confidence,
    assumptions,
    summary,
    riskLevel: record.riskLevel as RiskLevel,
    status: record.status as ApprovalStatus,
    requestedAt: record.requestedAt,
    expiresAt: record.expiresAt ?? undefined,
    decidedAt: record.decidedAt ?? undefined,
    resolvedBy,
    userFeedback,
    modifiedParameters: modifiedParams,
    result: record.result ?? undefined,
    errorMessage: record.errorMessage ?? undefined,
    auditLogId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

/**
 * Convert domain input to database format
 */
function toDbFormat(input: ApprovalCreateInput): Prisma.ActionApprovalCreateInput {
  // Store additional fields in the parameters JSON
  const parametersWithMeta = {
    ...input.parameters,
    _assumptions: input.assumptions ?? [],
    _confidence: input.confidence,
    _summary: input.summary ?? `${input.actionType} via ${input.toolName}`,
  };

  // Calculate expiration
  const expirationMs = input.expiresInMs ?? EXPIRATION_MS[input.riskLevel];
  const expiresAt = DateTime.now()
    .plus({ milliseconds: expirationMs })
    .toJSDate();

  return {
    user: { connect: { id: input.userId } },
    toolName: input.toolName,
    parameters: parametersWithMeta as unknown as Prisma.InputJsonValue,
    actionType: input.actionType,
    riskLevel: input.riskLevel,
    reasoning: input.reasoning,
    status: "pending",
    conversationId: input.conversationId,
    planId: input.planId,
    stepIndex: input.stepIndex,
    expiresAt,
  };
}

// ─────────────────────────────────────────────────────────────
// Repository Functions
// ─────────────────────────────────────────────────────────────

/**
 * Create a new approval record with LLM context
 */
export async function create(
  input: ApprovalCreateInput
): Promise<AgentActionApproval> {
  logger.debug("Creating approval record", {
    userId: input.userId,
    toolName: input.toolName,
    riskLevel: input.riskLevel,
  });

  const record = await db.actionApproval.create({
    data: toDbFormat(input),
  });

  logger.info("Approval record created", {
    approvalId: record.id,
    userId: input.userId,
    toolName: input.toolName,
  });

  return toDomainModel(record);
}

/**
 * Get approval by ID
 */
export async function getById(
  approvalId: string
): Promise<AgentActionApproval | null> {
  const record = await db.actionApproval.findUnique({
    where: { id: approvalId },
  });

  if (!record) {
    return null;
  }

  return toDomainModel(record);
}

/**
 * Get approval by ID with user authorization check
 */
export async function getByIdForUser(
  userId: string,
  approvalId: string
): Promise<AgentActionApproval | null> {
  const record = await db.actionApproval.findFirst({
    where: {
      id: approvalId,
      userId, // Security: ensure user owns this approval
    },
  });

  if (!record) {
    return null;
  }

  return toDomainModel(record);
}

/**
 * Get pending approvals for a user
 */
export async function getPending(
  userId: string,
  options?: ApprovalQueryOptions
): Promise<AgentActionApproval[]> {
  const now = new Date();

  const records = await db.actionApproval.findMany({
    where: {
      userId,
      status: "pending",
      conversationId: options?.conversationId,
      planId: options?.planId,
      ...(options?.includeExpired
        ? {}
        : {
            OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
          }),
    },
    orderBy: {
      requestedAt: options?.orderBy === "asc" ? "asc" : "desc",
    },
    take: options?.limit ?? 20,
    skip: options?.offset ?? 0,
  });

  return records.map(toDomainModel);
}

/**
 * Get pending approvals for a plan
 */
export async function getPendingForPlan(
  planId: string
): Promise<AgentActionApproval[]> {
  const records = await db.actionApproval.findMany({
    where: {
      planId,
      status: "pending",
    },
    orderBy: {
      stepIndex: "asc",
    },
  });

  return records.map(toDomainModel);
}

/**
 * Query approvals with filters and pagination
 */
export async function query(
  userId: string,
  options?: ApprovalQueryOptions
): Promise<ApprovalQueryResult> {
  const now = new Date();

  // Build where clause
  const statusFilter = options?.status
    ? Array.isArray(options.status)
      ? { in: options.status }
      : options.status
    : undefined;

  const whereClause: Prisma.ActionApprovalWhereInput = {
    userId,
    status: statusFilter,
    conversationId: options?.conversationId,
    planId: options?.planId,
    ...(options?.includeExpired
      ? {}
      : statusFilter === "pending" || !statusFilter
        ? {
            OR: [
              { expiresAt: null },
              { expiresAt: { gt: now } },
              { status: { not: "pending" } },
            ],
          }
        : {}),
  };

  // Get total count
  const totalCount = await db.actionApproval.count({
    where: whereClause,
  });

  // Get records
  const records = await db.actionApproval.findMany({
    where: whereClause,
    orderBy: {
      requestedAt: options?.orderBy === "asc" ? "asc" : "desc",
    },
    take: options?.limit ?? 20,
    skip: options?.offset ?? 0,
  });

  const approvals = records.map(toDomainModel);

  return {
    approvals,
    totalCount,
    hasMore: (options?.offset ?? 0) + approvals.length < totalCount,
  };
}

/**
 * Update approval status and related fields
 */
export async function update(
  approvalId: string,
  update: ApprovalUpdateInput
): Promise<AgentActionApproval | null> {
  // First get current record to preserve metadata
  const current = await db.actionApproval.findUnique({
    where: { id: approvalId },
  });

  if (!current) {
    return null;
  }

  const currentMeta = current.parameters as Record<string, unknown> | null;

  // Merge new metadata with existing
  const updatedMeta = {
    ...(currentMeta ?? {}),
    ...(update.modifiedParameters
      ? { _modifiedParameters: update.modifiedParameters }
      : {}),
    ...(update.userFeedback ? { _userFeedback: update.userFeedback } : {}),
    ...(update.resolvedBy ? { _resolvedBy: update.resolvedBy } : {}),
  };

  const record = await db.actionApproval.update({
    where: { id: approvalId },
    data: {
      status: update.status,
      decidedAt: update.decidedAt,
      parameters: updatedMeta as Prisma.InputJsonValue,
      result: update.result as Prisma.InputJsonValue | undefined,
      errorMessage: update.errorMessage,
    },
  });

  logger.debug("Approval updated", {
    approvalId,
    status: update.status,
  });

  return toDomainModel(record);
}

/**
 * Approve an action with optional parameter modifications
 */
export async function approve(
  userId: string,
  approvalId: string,
  modifiedParams?: Record<string, unknown>
): Promise<AgentActionApproval | null> {
  // Verify ownership and check current state
  const existing = await db.actionApproval.findFirst({
    where: {
      id: approvalId,
      userId,
    },
  });

  if (!existing) {
    logger.warn("Approval not found or unauthorized", {
      approvalId,
      userId,
    });
    return null;
  }

  if (existing.status !== "pending") {
    logger.warn("Approval already decided", {
      approvalId,
      currentStatus: existing.status,
    });
    return null;
  }

  // Check expiration
  if (existing.expiresAt && existing.expiresAt < new Date()) {
    logger.warn("Approval has expired", {
      approvalId,
      expiresAt: existing.expiresAt,
    });
    return null;
  }

  return update(approvalId, {
    status: "approved",
    decidedAt: new Date(),
    resolvedBy: "user",
    modifiedParameters: modifiedParams,
  });
}

/**
 * Reject an action with optional feedback
 */
export async function reject(
  userId: string,
  approvalId: string,
  feedback?: string
): Promise<AgentActionApproval | null> {
  // Verify ownership and check current state
  const existing = await db.actionApproval.findFirst({
    where: {
      id: approvalId,
      userId,
    },
  });

  if (!existing) {
    logger.warn("Approval not found or unauthorized", {
      approvalId,
      userId,
    });
    return null;
  }

  if (existing.status !== "pending") {
    logger.warn("Approval already decided", {
      approvalId,
      currentStatus: existing.status,
    });
    return null;
  }

  return update(approvalId, {
    status: "rejected",
    decidedAt: new Date(),
    resolvedBy: "user",
    userFeedback: feedback,
  });
}

/**
 * Mark approval as executed
 */
export async function markExecuted(
  approvalId: string,
  result: unknown
): Promise<AgentActionApproval | null> {
  return update(approvalId, {
    status: "executed",
    result,
  });
}

/**
 * Mark approval as failed
 */
export async function markFailed(
  approvalId: string,
  errorMessage: string
): Promise<AgentActionApproval | null> {
  return update(approvalId, {
    status: "failed",
    errorMessage,
  });
}

/**
 * Expire stale approvals (batch operation)
 * Returns count of expired approvals and affected plan IDs
 */
export async function expireStale(): Promise<{
  count: number;
  planIds: string[];
}> {
  const now = new Date();

  // Find approvals to expire (to get plan IDs)
  const toExpire = await db.actionApproval.findMany({
    where: {
      status: "pending",
      expiresAt: {
        lt: now,
      },
    },
    select: {
      id: true,
      planId: true,
    },
  });

  if (toExpire.length === 0) {
    return { count: 0, planIds: [] };
  }

  // Update all expired approvals
  await db.actionApproval.updateMany({
    where: {
      id: {
        in: toExpire.map((a) => a.id),
      },
    },
    data: {
      status: "expired",
      decidedAt: now,
    },
  });

  // Collect unique plan IDs
  const planIds = [
    ...new Set(toExpire.filter((a) => a.planId).map((a) => a.planId!)),
  ];

  logger.info("Expired stale approvals", {
    count: toExpire.length,
    planIds,
  });

  return {
    count: toExpire.length,
    planIds,
  };
}

/**
 * Cancel all pending approvals for a plan
 */
export async function cancelForPlan(planId: string): Promise<number> {
  const result = await db.actionApproval.updateMany({
    where: {
      planId,
      status: "pending",
    },
    data: {
      status: "rejected",
      decidedAt: new Date(),
    },
  });

  if (result.count > 0) {
    logger.info("Cancelled approvals for plan", {
      planId,
      count: result.count,
    });
  }

  return result.count;
}

/**
 * Get approval count by status for a user
 */
export async function getCountByStatus(
  userId: string
): Promise<Record<string, number>> {
  const counts = await db.actionApproval.groupBy({
    by: ["status"],
    where: { userId },
    _count: true,
  });

  return counts.reduce(
    (acc, item) => {
      acc[item.status] = item._count;
      return acc;
    },
    {} as Record<string, number>
  );
}

/**
 * Set audit log ID for an approval
 */
export async function setAuditLogId(
  approvalId: string,
  auditLogId: string
): Promise<void> {
  const current = await db.actionApproval.findUnique({
    where: { id: approvalId },
  });

  if (!current) return;

  const currentMeta = current.parameters as Record<string, unknown> | null;
  const updatedMeta = {
    ...(currentMeta ?? {}),
    _auditLogId: auditLogId,
  };

  await db.actionApproval.update({
    where: { id: approvalId },
    data: {
      parameters: updatedMeta as Prisma.InputJsonValue,
    },
  });
}

// ─────────────────────────────────────────────────────────────
// Export Repository Object
// ─────────────────────────────────────────────────────────────

export const approvalRepository = {
  create,
  getById,
  getByIdForUser,
  getPending,
  getPendingForPlan,
  query,
  update,
  approve,
  reject,
  markExecuted,
  markFailed,
  expireStale,
  cancelForPlan,
  getCountByStatus,
  setAuditLogId,
};

