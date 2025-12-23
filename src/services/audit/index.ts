import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import type { AuditEntry, ActionType, ActionCategory } from "@/types";

// ═══════════════════════════════════════════════════════════════════════════
// Audit Service
// Logs all agent actions and assumptions for full traceability
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateAuditLogParams extends AuditEntry {
  entitySnapshot?: Prisma.InputJsonValue;
  startedAt?: Date;
}

export interface AuditQueryOptions {
  userId: string;
  sessionId?: string;
  actionTypes?: ActionType[];
  actionCategories?: ActionCategory[];
  entityType?: string;
  dateRange?: { start: Date; end: Date };
  limit?: number;
  offset?: number;
}

/**
 * Log an audit entry
 * @param params - Audit entry parameters including optional status (defaults to "completed")
 */
export async function logAuditEntry(params: CreateAuditLogParams) {
  const startedAt = params.startedAt ?? new Date();
  const status = params.status ?? "completed";

  const entry = await db.auditLog.create({
    data: {
      userId: params.userId,
      sessionId: params.sessionId,
      conversationId: params.conversationId,
      actionType: params.actionType,
      actionCategory: params.actionCategory,
      entityType: params.entityType,
      entityId: params.entityId,
      entitySnapshot: params.entitySnapshot,
      intent: params.intent,
      reasoning: params.reasoning,
      confidence: params.confidence,
      inputSummary: params.inputSummary,
      outputSummary: params.outputSummary,
      metadata: (params.metadata as Prisma.InputJsonValue) ?? {},
      status,
      errorMessage: params.errorMessage,
      startedAt,
      completedAt: new Date(),
      durationMs: Date.now() - startedAt.getTime(),
    },
  });

  return entry;
}

/**
 * Log an audit entry with pending status (for long-running operations)
 */
export async function startAuditEntry(params: CreateAuditLogParams) {
  const entry = await db.auditLog.create({
    data: {
      userId: params.userId,
      sessionId: params.sessionId,
      conversationId: params.conversationId,
      actionType: params.actionType,
      actionCategory: params.actionCategory,
      entityType: params.entityType,
      entityId: params.entityId,
      intent: params.intent,
      metadata: (params.metadata as Prisma.InputJsonValue) ?? {},
      status: "pending",
      startedAt: new Date(),
    },
  });

  return entry;
}

/**
 * Complete a pending audit entry
 */
export async function completeAuditEntry(
  id: string,
  params: {
    status?: "completed" | "failed" | "rolled_back";
    reasoning?: string;
    confidence?: number;
    outputSummary?: string;
    errorMessage?: string;
    entitySnapshot?: Prisma.InputJsonValue;
  }
) {
  const entry = await db.auditLog.findUnique({ where: { id } });
  if (!entry) throw new Error(`Audit entry not found: ${id}`);

  return db.auditLog.update({
    where: { id },
    data: {
      status: params.status ?? "completed",
      reasoning: params.reasoning,
      confidence: params.confidence,
      outputSummary: params.outputSummary,
      errorMessage: params.errorMessage,
      entitySnapshot: params.entitySnapshot,
      completedAt: new Date(),
      durationMs: Date.now() - entry.startedAt.getTime(),
    },
  });
}

/**
 * Log an assumption made by the agent
 */
export async function logAssumption(
  auditLogId: string,
  params: {
    assumption: string;
    category: "intent" | "context" | "preference" | "inference";
    evidence: Prisma.InputJsonValue;
    confidence: number;
  }
) {
  return db.agentAssumption.create({
    data: {
      auditLogId,
      assumption: params.assumption,
      category: params.category,
      evidence: params.evidence,
      confidence: params.confidence,
    },
  });
}

/**
 * Verify an assumption (user feedback or system validation)
 */
export async function verifyAssumption(
  id: string,
  params: {
    verified: boolean;
    verifiedBy: "user" | "system" | "feedback";
    correction?: string;
  }
) {
  return db.agentAssumption.update({
    where: { id },
    data: {
      verified: params.verified,
      verifiedAt: new Date(),
      verifiedBy: params.verifiedBy,
      correction: params.correction,
    },
  });
}

/**
 * Query audit log entries
 */
export async function queryAuditLog(options: AuditQueryOptions) {
  const where: Prisma.AuditLogWhereInput = {
    userId: options.userId,
  };

  if (options.sessionId) {
    where.sessionId = options.sessionId;
  }

  if (options.actionTypes?.length) {
    where.actionType = { in: options.actionTypes };
  }

  if (options.actionCategories?.length) {
    where.actionCategory = { in: options.actionCategories };
  }

  if (options.entityType) {
    where.entityType = options.entityType;
  }

  if (options.dateRange) {
    where.createdAt = {
      gte: options.dateRange.start,
      lte: options.dateRange.end,
    };
  }

  return db.auditLog.findMany({
    where,
    include: {
      assumptions: true,
    },
    orderBy: { createdAt: "desc" },
    take: options.limit ?? 50,
    skip: options.offset ?? 0,
  });
}

/**
 * Get audit trail for a specific entity
 */
export async function getEntityAuditTrail(
  userId: string,
  entityType: string,
  entityId: string
) {
  return db.auditLog.findMany({
    where: {
      userId,
      entityType,
      entityId,
    },
    include: {
      assumptions: true,
    },
    orderBy: { createdAt: "desc" },
  });
}
