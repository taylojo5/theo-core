// ═══════════════════════════════════════════════════════════════════════════
// Agent Audit Service
// Business logic for audit trail operations
// ═══════════════════════════════════════════════════════════════════════════

import { auditLogger } from "../logger";
import { auditLogRepository, assumptionRepository } from "./repository";
import type {
  AuditLogCreateInput,
  AuditLogWithAssumptions,
  AssumptionRecord,
  AuditQueryOptions,
  AssumptionQueryOptions,
  AuditQueryResult,
  AssumptionQueryResult,
  AuditActionInput,
  AuditStats,
  AuditedAction,
  AssumptionVerifyInput,
} from "./types";
import type { Evidence } from "../types";
import type { AssumptionCategory, AuditStatus } from "../constants";

const logger = auditLogger.child("service");

// ─────────────────────────────────────────────────────────────
// Audit Logging Service
// ─────────────────────────────────────────────────────────────

/**
 * Log an agent action with optional assumptions
 * This is the primary method for creating audit entries
 */
export async function logAgentAction(
  input: AuditActionInput
): Promise<AuditLogWithAssumptions> {
  // Capture start time once for consistent timestamps
  const startedAt = input.startedAt ?? new Date();
  const startTime = startedAt.getTime();

  logger.debug("Logging agent action", {
    userId: input.userId,
    actionType: input.actionType,
    actionCategory: input.actionCategory,
  });

  // Create the audit log entry
  const entry = await auditLogRepository.createCompleted({
    ...input,
    startedAt,
  });

  // Create assumptions if provided
  const assumptions = input.assumptions ?? [];
  let assumptionRecords: AssumptionRecord[] = [];

  if (assumptions.length > 0) {
    const created = await assumptionRepository.createMany(
      entry.id,
      assumptions.map((a) => ({
        assumption: a.assumption,
        category: a.category,
        evidence: a.evidence,
        confidence: a.confidence,
      }))
    );

    assumptionRecords = created.map((a) => ({
      id: a.id,
      auditLogId: a.auditLogId,
      assumption: a.assumption,
      category: a.category,
      evidence: a.evidence,
      confidence: Number(a.confidence),
      verified: a.verified,
      verifiedAt: a.verifiedAt,
      verifiedBy: a.verifiedBy,
      correction: a.correction,
      createdAt: a.createdAt,
    }));
  }

  const durationMs = Date.now() - startTime;

  // Update the audit log with accurate duration that includes assumption creation
  await auditLogRepository.update(entry.id, { durationMs });

  logger.debug("Agent action logged", {
    id: entry.id,
    durationMs,
    assumptionCount: assumptionRecords.length,
  });

  return {
    id: entry.id,
    userId: entry.userId,
    sessionId: entry.sessionId,
    conversationId: entry.conversationId,
    actionType: entry.actionType,
    actionCategory: entry.actionCategory,
    entityType: entry.entityType,
    entityId: entry.entityId,
    entitySnapshot: entry.entitySnapshot,
    intent: entry.intent,
    reasoning: entry.reasoning,
    confidence: entry.confidence != null ? Number(entry.confidence) : null,
    inputSummary: entry.inputSummary,
    outputSummary: entry.outputSummary,
    metadata: entry.metadata,
    status: entry.status,
    errorMessage: entry.errorMessage,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    durationMs,
    createdAt: entry.createdAt,
    assumptions: assumptionRecords,
  };
}

/**
 * Start an audit entry for a long-running action
 * Returns an ID to be used with completeAuditAction or failAuditAction
 */
export async function startAuditAction(
  input: AuditLogCreateInput
): Promise<string> {
  logger.debug("Starting audit action", {
    userId: input.userId,
    actionType: input.actionType,
  });

  const entry = await auditLogRepository.create({
    ...input,
    status: "pending",
    startedAt: new Date(),
  });

  return entry.id;
}

/**
 * Complete a pending audit action
 * SECURITY: Requires userId to verify the audit log belongs to that user
 */
export async function completeAuditAction(
  userId: string,
  auditLogId: string,
  result: {
    status?: AuditStatus;
    reasoning?: string;
    confidence?: number;
    outputSummary?: string;
    entitySnapshot?: Record<string, unknown>;
    assumptions?: {
      assumption: string;
      category: AssumptionCategory;
      evidence: Evidence[];
      confidence: number;
    }[];
  }
): Promise<AuditLogWithAssumptions> {
  logger.debug("Completing audit action", { userId, auditLogId });

  // SECURITY: Verify ownership before completing
  const existing = await auditLogRepository.findById(auditLogId);
  if (!existing) {
    throw new Error(`Audit log entry not found: ${auditLogId}`);
  }
  if (existing.userId !== userId) {
    throw new Error(`Unauthorized: audit log entry does not belong to user`);
  }

  // Complete the audit log entry
  await auditLogRepository.complete(auditLogId, {
    status: result.status ?? "completed",
    reasoning: result.reasoning,
    confidence: result.confidence,
    outputSummary: result.outputSummary,
    entitySnapshot: result.entitySnapshot,
  });

  // Create assumptions if provided
  if (result.assumptions?.length) {
    await assumptionRepository.createMany(auditLogId, result.assumptions);
  }

  // Fetch and return the complete entry
  const entry = await auditLogRepository.findById(auditLogId);
  if (!entry) {
    // This should not happen in normal operation, but can occur due to race conditions
    throw new Error(`Audit log entry not found after completion: ${auditLogId}`);
  }
  return entry;
}

/**
 * Mark a pending audit action as failed
 * SECURITY: Requires userId to verify the audit log belongs to that user
 */
export async function failAuditAction(
  userId: string,
  auditLogId: string,
  errorMessage: string
): Promise<void> {
  logger.debug("Failing audit action", { userId, auditLogId, errorMessage });

  // SECURITY: Verify ownership before failing
  const existing = await auditLogRepository.findById(auditLogId);
  if (!existing) {
    throw new Error(`Audit log entry not found: ${auditLogId}`);
  }
  if (existing.userId !== userId) {
    throw new Error(`Unauthorized: audit log entry does not belong to user`);
  }

  await auditLogRepository.fail(auditLogId, errorMessage);
}

/**
 * Execute an action with automatic audit logging
 * Wraps any operation with audit trail creation
 */
export async function withAuditTrail<T>(
  input: AuditLogCreateInput & {
    assumptions?: {
      assumption: string;
      category: AssumptionCategory;
      evidence: Evidence[];
      confidence: number;
    }[];
  },
  action: () => Promise<T>
): Promise<AuditedAction<T>> {
  const startTime = Date.now();
  const auditLogId = await startAuditAction(input);

  try {
    const result = await action();

    await completeAuditAction(input.userId, auditLogId, {
      status: "completed",
      assumptions: input.assumptions,
    });

    // Calculate duration after completion to include audit logging overhead
    const durationMs = Date.now() - startTime;

    return {
      auditLogId,
      result,
      durationMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await failAuditAction(input.userId, auditLogId, errorMessage);
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// Query Service
// ─────────────────────────────────────────────────────────────

/**
 * Query audit log entries
 */
export async function queryAuditLog(
  options: AuditQueryOptions
): Promise<AuditQueryResult> {
  logger.debug("Querying audit log", {
    userId: options.userId,
    actionTypes: options.actionTypes,
    limit: options.limit,
  });

  const { entries, totalCount } = await auditLogRepository.findByUser(options);
  const limit = options.limit ?? 50;

  return {
    entries,
    totalCount,
    hasMore: (options.offset ?? 0) + entries.length < totalCount,
  };
}

/**
 * Get a single audit log entry by ID
 * SECURITY: Requires userId to verify the audit log belongs to that user
 */
export async function getAuditEntry(
  userId: string,
  id: string
): Promise<AuditLogWithAssumptions | null> {
  const entry = await auditLogRepository.findById(id);
  
  // SECURITY: Verify ownership before returning
  if (entry && entry.userId !== userId) {
    return null; // Don't reveal existence of other users' audit logs
  }
  
  return entry;
}

/**
 * Get audit trail for a specific entity
 */
export async function getEntityAuditTrail(
  userId: string,
  entityType: string,
  entityId: string
): Promise<AuditLogWithAssumptions[]> {
  logger.debug("Getting entity audit trail", { userId, entityType, entityId });
  return auditLogRepository.findByEntity(userId, entityType, entityId);
}

/**
 * Get recent actions for a user
 */
export async function getRecentActions(
  userId: string,
  limit = 10
): Promise<AuditLogWithAssumptions[]> {
  return auditLogRepository.getRecentActions(userId, limit);
}

/**
 * Get audit entries for a conversation
 * SECURITY: Requires userId to verify conversation ownership
 */
export async function getConversationAuditTrail(
  userId: string,
  conversationId: string,
  options?: { limit?: number; offset?: number }
): Promise<AuditLogWithAssumptions[]> {
  return auditLogRepository.findByConversation(userId, conversationId, options);
}

// ─────────────────────────────────────────────────────────────
// Assumption Service
// ─────────────────────────────────────────────────────────────

/**
 * Query assumptions
 */
export async function queryAssumptions(
  options: AssumptionQueryOptions
): Promise<AssumptionQueryResult> {
  logger.debug("Querying assumptions", {
    userId: options.userId,
    category: options.category,
    unverifiedOnly: options.unverifiedOnly,
  });

  const { assumptions, totalCount } = await assumptionRepository.find(options);
  const limit = options.limit ?? 50;

  return {
    assumptions,
    totalCount,
    hasMore: (options.offset ?? 0) + assumptions.length < totalCount,
  };
}

/**
 * Get assumptions for a specific audit log entry
 * SECURITY: Requires userId to verify the audit log belongs to that user
 */
export async function getAssumptionsForAction(
  userId: string,
  auditLogId: string
): Promise<AssumptionRecord[]> {
  // SECURITY: Verify audit log ownership before returning assumptions
  const auditLog = await auditLogRepository.findById(auditLogId, false);
  if (!auditLog) {
    return []; // Don't reveal existence of other users' audit logs
  }
  if (auditLog.userId !== userId) {
    return []; // Don't reveal existence of other users' assumptions
  }

  return assumptionRepository.findByAuditLog(auditLogId);
}

/**
 * Get unverified assumptions for a user
 */
export async function getUnverifiedAssumptions(
  userId: string,
  limit = 20
): Promise<AssumptionRecord[]> {
  return assumptionRepository.findUnverified(userId, limit);
}

/**
 * Verify an assumption
 * Used when user confirms or corrects an assumption
 */
export async function verifyAssumption(
  userId: string,
  assumptionId: string,
  input: AssumptionVerifyInput
): Promise<AssumptionRecord> {
  logger.info("Verifying assumption", {
    userId,
    assumptionId,
    verified: input.verified,
    verifiedBy: input.verifiedBy,
  });

  // Verify the assumption exists and belongs to the user
  const assumption = await assumptionRepository.findById(assumptionId);
  if (!assumption) {
    throw new Error(`Assumption not found: ${assumptionId}`);
  }

  // Verify ownership through the audit log
  const auditEntry = await auditLogRepository.findById(assumption.auditLogId, false);
  if (!auditEntry || auditEntry.userId !== userId) {
    throw new Error("Unauthorized: Assumption does not belong to user");
  }

  const updated = await assumptionRepository.verify(assumptionId, input);

  return {
    id: updated.id,
    auditLogId: updated.auditLogId,
    assumption: updated.assumption,
    category: updated.category,
    evidence: updated.evidence,
    confidence: Number(updated.confidence),
    verified: updated.verified,
    verifiedAt: updated.verifiedAt,
    verifiedBy: updated.verifiedBy,
    correction: updated.correction,
    createdAt: updated.createdAt,
  };
}

// ─────────────────────────────────────────────────────────────
// Statistics Service
// ─────────────────────────────────────────────────────────────

/**
 * Get audit statistics for a user
 */
export async function getAuditStats(userId: string): Promise<AuditStats> {
  logger.debug("Getting audit stats", { userId });

  // Get total entries
  const totalEntries = await auditLogRepository.count({ userId });

  // Get entries by action type
  const actionTypes = ["query", "create", "update", "delete", "send", "analyze"];
  const byActionType: Record<string, number> = {};

  for (const actionType of actionTypes) {
    byActionType[actionType] = await auditLogRepository.count({
      userId,
      actionTypes: [actionType],
    });
  }

  // Get entries by status
  const statuses = ["pending", "completed", "failed", "rolled_back"];
  const byStatus: Record<string, number> = {};

  for (const status of statuses) {
    byStatus[status] = await auditLogRepository.count({
      userId,
      status: status as AuditStatus,
    });
  }

  // Get assumption stats
  const assumptionStats = await assumptionRepository.countByUser(userId);

  return {
    totalEntries,
    byActionType,
    byStatus,
    totalAssumptions: assumptionStats.total,
    unverifiedAssumptions: assumptionStats.unverified,
    // Verification rate = what percentage of all assumptions have been verified
    verificationRate:
      assumptionStats.total > 0
        ? assumptionStats.verified / assumptionStats.total
        : 0,
  };
}

// ─────────────────────────────────────────────────────────────
// Audit Service Object (for dependency injection)
// ─────────────────────────────────────────────────────────────

/**
 * Audit service as an object for easier mocking and DI
 */
export const auditService = {
  // Logging
  logAgentAction,
  startAuditAction,
  completeAuditAction,
  failAuditAction,
  withAuditTrail,

  // Query
  queryAuditLog,
  getAuditEntry,
  getEntityAuditTrail,
  getRecentActions,
  getConversationAuditTrail,

  // Assumptions
  queryAssumptions,
  getAssumptionsForAction,
  getUnverifiedAssumptions,
  verifyAssumption,

  // Statistics
  getAuditStats,
};

