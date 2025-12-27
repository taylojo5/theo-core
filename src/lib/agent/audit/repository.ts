// ═══════════════════════════════════════════════════════════════════════════
// Agent Audit Repository
// Database access layer for audit log and assumptions
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import type { Prisma, AuditLog, AgentAssumption } from "@prisma/client";
import { auditLogger } from "../logger";
import type {
  AuditLogCreateInput,
  AuditLogUpdateInput,
  AuditLogWithAssumptions,
  AssumptionCreateInput,
  AssumptionVerifyInput,
  AssumptionRecord,
  AuditQueryOptions,
  AssumptionQueryOptions,
} from "./types";

const logger = auditLogger.child("repository");

// ─────────────────────────────────────────────────────────────
// Audit Log Repository
// ─────────────────────────────────────────────────────────────

/**
 * Repository for audit log operations
 */
export const auditLogRepository = {
  /**
   * Create a new audit log entry
   */
  async create(input: AuditLogCreateInput): Promise<AuditLog> {
    const startedAt = input.startedAt ?? new Date();

    logger.debug("Creating audit log entry", {
      userId: input.userId,
      actionType: input.actionType,
      actionCategory: input.actionCategory,
    });

    const entry = await db.auditLog.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        conversationId: input.conversationId,
        actionType: input.actionType,
        actionCategory: input.actionCategory,
        entityType: input.entityType,
        entityId: input.entityId,
        entitySnapshot: input.entitySnapshot as Prisma.InputJsonValue,
        intent: input.intent,
        reasoning: input.reasoning,
        confidence: input.confidence,
        inputSummary: input.inputSummary,
        outputSummary: input.outputSummary,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? {},
        status: input.status ?? "pending",
        errorMessage: input.errorMessage,
        startedAt,
      },
    });

    logger.debug("Audit log entry created", { id: entry.id });

    return entry;
  },

  /**
   * Create a completed audit log entry (for synchronous operations)
   */
  async createCompleted(input: AuditLogCreateInput): Promise<AuditLog> {
    const startedAt = input.startedAt ?? new Date();
    const completedAt = new Date();

    const entry = await db.auditLog.create({
      data: {
        userId: input.userId,
        sessionId: input.sessionId,
        conversationId: input.conversationId,
        actionType: input.actionType,
        actionCategory: input.actionCategory,
        entityType: input.entityType,
        entityId: input.entityId,
        entitySnapshot: input.entitySnapshot as Prisma.InputJsonValue,
        intent: input.intent,
        reasoning: input.reasoning,
        confidence: input.confidence,
        inputSummary: input.inputSummary,
        outputSummary: input.outputSummary,
        metadata: (input.metadata as Prisma.InputJsonValue) ?? {},
        status: input.status ?? "completed",
        errorMessage: input.errorMessage,
        startedAt,
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
      },
    });

    logger.debug("Completed audit log entry created", { id: entry.id });

    return entry;
  },

  /**
   * Update an existing audit log entry
   */
  async update(id: string, input: AuditLogUpdateInput): Promise<AuditLog> {
    logger.debug("Updating audit log entry", { id, status: input.status });

    const entry = await db.auditLog.update({
      where: { id },
      data: {
        status: input.status,
        reasoning: input.reasoning,
        confidence: input.confidence,
        outputSummary: input.outputSummary,
        errorMessage: input.errorMessage,
        entitySnapshot: input.entitySnapshot as Prisma.InputJsonValue,
        completedAt: input.completedAt,
        durationMs: input.durationMs,
      },
    });

    return entry;
  },

  /**
   * Complete a pending audit log entry
   */
  async complete(
    id: string,
    input: Omit<AuditLogUpdateInput, "completedAt" | "durationMs"> & {
      startedAt?: Date;
    }
  ): Promise<AuditLog> {
    const entry = await db.auditLog.findUnique({ where: { id } });
    if (!entry) {
      throw new Error(`Audit log entry not found: ${id}`);
    }

    const completedAt = new Date();
    const startTime = input.startedAt ?? entry.startedAt;
    const durationMs = completedAt.getTime() - startTime.getTime();

    return this.update(id, {
      ...input,
      status: input.status ?? "completed",
      completedAt,
      durationMs,
    });
  },

  /**
   * Mark an audit log entry as failed
   */
  async fail(id: string, errorMessage: string): Promise<AuditLog> {
    return this.complete(id, {
      status: "failed",
      errorMessage,
    });
  },

  /**
   * Find an audit log entry by ID
   */
  async findById(
    id: string,
    includeAssumptions = true
  ): Promise<AuditLogWithAssumptions | null> {
    if (includeAssumptions) {
      const entry = await db.auditLog.findUnique({
        where: { id },
        include: { assumptions: true },
      });

      if (!entry) {
        return null;
      }

      return mapToAuditLogWithAssumptions(entry, entry.assumptions);
    } else {
      const entry = await db.auditLog.findUnique({
        where: { id },
      });

      if (!entry) {
        return null;
      }

      return mapToAuditLogWithAssumptions(entry, []);
    }
  },

  /**
   * Find audit log entries by user
   */
  async findByUser(
    options: AuditQueryOptions
  ): Promise<{ entries: AuditLogWithAssumptions[]; totalCount: number }> {
    const where = buildAuditLogWhere(options);
    const includeAssumptions = options.includeAssumptions ?? true;

    if (includeAssumptions) {
      const [entriesWithAssumptions, totalCount] = await Promise.all([
        db.auditLog.findMany({
          where,
          include: { assumptions: true },
          orderBy: { createdAt: options.orderBy ?? "desc" },
          take: options.limit ?? 50,
          skip: options.offset ?? 0,
        }),
        db.auditLog.count({ where }),
      ]);

      const entries = entriesWithAssumptions.map((e) =>
        mapToAuditLogWithAssumptions(e, e.assumptions)
      );

      return { entries, totalCount };
    } else {
      const [entriesWithoutAssumptions, totalCount] = await Promise.all([
        db.auditLog.findMany({
          where,
          orderBy: { createdAt: options.orderBy ?? "desc" },
          take: options.limit ?? 50,
          skip: options.offset ?? 0,
        }),
        db.auditLog.count({ where }),
      ]);

      const entries = entriesWithoutAssumptions.map((e) =>
        mapToAuditLogWithAssumptions(e, [])
      );

      return { entries, totalCount };
    }
  },

  /**
   * Find audit log entries by conversation
   * SECURITY: Requires userId to verify conversation ownership
   */
  async findByConversation(
    userId: string,
    conversationId: string,
    options?: Pick<AuditQueryOptions, "limit" | "offset" | "includeAssumptions">
  ): Promise<AuditLogWithAssumptions[]> {
    const includeAssumptions = options?.includeAssumptions !== false;

    // SECURITY: Always include userId filter to prevent unauthorized access
    // This ensures users can only access audit trails for their own conversations
    const whereClause = { conversationId, userId };

    if (includeAssumptions) {
      const entries = await db.auditLog.findMany({
        where: whereClause,
        include: { assumptions: true },
        orderBy: { createdAt: "desc" },
        take: options?.limit ?? 100,
        skip: options?.offset ?? 0,
      });

      return entries.map((e) =>
        mapToAuditLogWithAssumptions(e, e.assumptions)
      );
    } else {
      const entries = await db.auditLog.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: options?.limit ?? 100,
        skip: options?.offset ?? 0,
      });

      return entries.map((e) =>
        mapToAuditLogWithAssumptions(e, [])
      );
    }
  },

  /**
   * Find audit log entries for a specific entity
   */
  async findByEntity(
    userId: string,
    entityType: string,
    entityId: string
  ): Promise<AuditLogWithAssumptions[]> {
    const entries = await db.auditLog.findMany({
      where: {
        userId,
        entityType,
        entityId,
      },
      include: { assumptions: true },
      orderBy: { createdAt: "desc" },
    });

    return entries.map((e) =>
      mapToAuditLogWithAssumptions(e, e.assumptions ?? [])
    );
  },

  /**
   * Get recent actions for a user
   */
  async getRecentActions(
    userId: string,
    limit = 10
  ): Promise<AuditLogWithAssumptions[]> {
    const entries = await db.auditLog.findMany({
      where: { userId },
      include: { assumptions: true },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return entries.map((e) =>
      mapToAuditLogWithAssumptions(e, e.assumptions ?? [])
    );
  },

  /**
   * Count audit log entries matching criteria
   */
  async count(options: Omit<AuditQueryOptions, "limit" | "offset">): Promise<number> {
    const where = buildAuditLogWhere(options);
    return db.auditLog.count({ where });
  },
};

// ─────────────────────────────────────────────────────────────
// Assumption Repository
// ─────────────────────────────────────────────────────────────

/**
 * Repository for assumption operations
 */
export const assumptionRepository = {
  /**
   * Create a new assumption
   */
  async create(input: AssumptionCreateInput): Promise<AgentAssumption> {
    logger.debug("Creating assumption", {
      auditLogId: input.auditLogId,
      category: input.category,
    });

    const assumption = await db.agentAssumption.create({
      data: {
        auditLogId: input.auditLogId,
        assumption: input.assumption,
        category: input.category,
        evidence: input.evidence as unknown as Prisma.InputJsonValue,
        confidence: input.confidence,
      },
    });

    return assumption;
  },

  /**
   * Create multiple assumptions at once
   */
  async createMany(
    auditLogId: string,
    inputs: Omit<AssumptionCreateInput, "auditLogId">[]
  ): Promise<AgentAssumption[]> {
    if (inputs.length === 0) {
      return [];
    }

    // Use transaction to ensure all or nothing
    const assumptions = await db.$transaction(
      inputs.map((input) =>
        db.agentAssumption.create({
          data: {
            auditLogId,
            assumption: input.assumption,
            category: input.category,
            evidence: input.evidence as unknown as Prisma.InputJsonValue,
            confidence: input.confidence,
          },
        })
      )
    );

    logger.debug("Created multiple assumptions", {
      auditLogId,
      count: assumptions.length,
    });

    return assumptions;
  },

  /**
   * Find an assumption by ID
   */
  async findById(id: string): Promise<AssumptionRecord | null> {
    const assumption = await db.agentAssumption.findUnique({
      where: { id },
    });

    if (!assumption) {
      return null;
    }

    return mapToAssumptionRecord(assumption);
  },

  /**
   * Find assumptions by audit log ID
   */
  async findByAuditLog(auditLogId: string): Promise<AssumptionRecord[]> {
    const assumptions = await db.agentAssumption.findMany({
      where: { auditLogId },
      orderBy: { createdAt: "asc" },
    });

    return assumptions.map(mapToAssumptionRecord);
  },

  /**
   * Find assumptions matching criteria
   */
  async find(options: AssumptionQueryOptions): Promise<{
    assumptions: AssumptionRecord[];
    totalCount: number;
  }> {
    // First, get audit log IDs for the user (security filter)
    const auditLogIds = await db.auditLog.findMany({
      where: { userId: options.userId },
      select: { id: true },
    });

    const userAuditLogIds = auditLogIds.map((a) => a.id);

    // Build the where clause with security filter
    const where: Prisma.AgentAssumptionWhereInput = {};

    if (options.auditLogId) {
      // When a specific auditLogId is requested, verify it belongs to the user
      // by checking it's in the user's audit log IDs (SECURITY: prevents access to other users' assumptions)
      if (!userAuditLogIds.includes(options.auditLogId)) {
        // Return empty result if the audit log doesn't belong to the user
        return { assumptions: [], totalCount: 0 };
      }
      where.auditLogId = options.auditLogId;
    } else {
      // No specific audit log requested, filter to all user's audit logs
      where.auditLogId = { in: userAuditLogIds };
    }

    if (options.category) {
      where.category = options.category;
    }

    if (options.unverifiedOnly) {
      where.verified = null;
    }

    const [assumptions, totalCount] = await Promise.all([
      db.agentAssumption.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: options.limit ?? 50,
        skip: options.offset ?? 0,
      }),
      db.agentAssumption.count({ where }),
    ]);

    return {
      assumptions: assumptions.map(mapToAssumptionRecord),
      totalCount,
    };
  },

  /**
   * Find unverified assumptions for a user
   */
  async findUnverified(
    userId: string,
    limit = 20
  ): Promise<AssumptionRecord[]> {
    // Get user's audit log IDs
    const auditLogIds = await db.auditLog.findMany({
      where: { userId },
      select: { id: true },
    });

    const assumptions = await db.agentAssumption.findMany({
      where: {
        auditLogId: { in: auditLogIds.map((a) => a.id) },
        verified: null,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return assumptions.map(mapToAssumptionRecord);
  },

  /**
   * Verify an assumption
   */
  async verify(
    id: string,
    input: AssumptionVerifyInput
  ): Promise<AgentAssumption> {
    logger.debug("Verifying assumption", {
      id,
      verified: input.verified,
      verifiedBy: input.verifiedBy,
    });

    const assumption = await db.agentAssumption.update({
      where: { id },
      data: {
        verified: input.verified,
        verifiedAt: new Date(),
        verifiedBy: input.verifiedBy,
        correction: input.correction,
      },
    });

    return assumption;
  },

  /**
   * Count assumptions for a user
   */
  async countByUser(userId: string): Promise<{
    total: number;
    unverified: number;
    verified: number;
    correct: number;
    incorrect: number;
  }> {
    const auditLogIds = await db.auditLog.findMany({
      where: { userId },
      select: { id: true },
    });

    const ids = auditLogIds.map((a) => a.id);

    const [total, unverified, correct, incorrect] = await Promise.all([
      db.agentAssumption.count({
        where: { auditLogId: { in: ids } },
      }),
      db.agentAssumption.count({
        where: { auditLogId: { in: ids }, verified: null },
      }),
      db.agentAssumption.count({
        where: { auditLogId: { in: ids }, verified: true },
      }),
      db.agentAssumption.count({
        where: { auditLogId: { in: ids }, verified: false },
      }),
    ]);

    return {
      total,
      unverified,
      verified: correct + incorrect,
      correct,
      incorrect,
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Build Prisma where clause for audit log queries
 */
function buildAuditLogWhere(
  options: AuditQueryOptions
): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {
    userId: options.userId,
  };

  if (options.sessionId) {
    where.sessionId = options.sessionId;
  }

  if (options.conversationId) {
    where.conversationId = options.conversationId;
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

  if (options.entityId) {
    where.entityId = options.entityId;
  }

  if (options.status) {
    if (Array.isArray(options.status)) {
      where.status = { in: options.status };
    } else {
      where.status = options.status;
    }
  }

  if (options.dateRange) {
    where.createdAt = {
      gte: options.dateRange.start,
      lte: options.dateRange.end,
    };
  }

  return where;
}

/**
 * Map Prisma AuditLog to our domain type
 */
function mapToAuditLogWithAssumptions(
  entry: AuditLog,
  assumptions: AgentAssumption[]
): AuditLogWithAssumptions {
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
    // Convert Decimal to number
    confidence: entry.confidence != null ? Number(entry.confidence) : null,
    inputSummary: entry.inputSummary,
    outputSummary: entry.outputSummary,
    metadata: entry.metadata,
    status: entry.status,
    errorMessage: entry.errorMessage,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    durationMs: entry.durationMs,
    createdAt: entry.createdAt,
    assumptions: assumptions.map(mapToAssumptionRecord),
  };
}

/**
 * Map Prisma AgentAssumption to our domain type
 */
function mapToAssumptionRecord(assumption: AgentAssumption): AssumptionRecord {
  return {
    id: assumption.id,
    auditLogId: assumption.auditLogId,
    assumption: assumption.assumption,
    category: assumption.category,
    evidence: assumption.evidence,
    // Convert Decimal to number
    confidence: Number(assumption.confidence),
    verified: assumption.verified,
    verifiedAt: assumption.verifiedAt,
    verifiedBy: assumption.verifiedBy,
    correction: assumption.correction,
    createdAt: assumption.createdAt,
  };
}

