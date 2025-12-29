// ═══════════════════════════════════════════════════════════════════════════
// Opportunities Service
// CRUD operations for Opportunity entities with audit logging
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { logAuditEntry } from "@/services/audit";
import { Prisma } from "@prisma/client";
import {
  softDeleteFilter,
  normalizePagination,
  processPaginatedResults,
  buildOrderBy,
  normalizeTags,
  validateImportance,
  addDays,
} from "../utils";
import type {
  Opportunity,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  ListOpportunitiesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  IOpportunitiesService,
  SearchOpportunitiesOptions,
  SourceOpportunityInput,
} from "./types";
import { OpportunitiesServiceError as OpportunitiesError } from "./types";

// ─────────────────────────────────────────────────────────────
// Opportunities Service Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Create a new opportunity
 */
export async function createOpportunity(
  userId: string,
  data: CreateOpportunityInput,
  context?: ServiceContext
): Promise<Opportunity> {
  const normalizedTags = data.tags ? normalizeTags(data.tags) : [];
  const importance =
    data.importance !== undefined ? validateImportance(data.importance) : 5;

  try {
    const opportunity = await db.opportunity.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        type: data.type ?? "general",
        status: data.status ?? "identified",
        priority: data.priority ?? "medium",
        importance,
        expiresAt: data.expiresAt,
        context: data.context,
        trigger: data.trigger,
        relatedPersonId: data.relatedPersonId,
        participants: data.participants ?? [],
        relatedEmailId: data.relatedEmailId,
        relatedEventId: data.relatedEventId,
        relatedTaskId: data.relatedTaskId,
        relatedProjectId: data.relatedProjectId,
        potentialValue: data.potentialValue,
        effort: data.effort,
        risk: data.risk,
        category: data.category,
        source: data.source,
        sourceId: data.sourceId,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? {},
        tags: normalizedTags,
      },
    });

    await logAuditEntry({
      userId: context?.userId ?? userId,
      sessionId: context?.sessionId,
      conversationId: context?.conversationId,
      actionType: "create",
      actionCategory: "context",
      entityType: "opportunity",
      entityId: opportunity.id,
      entitySnapshot: opportunity as unknown as Prisma.InputJsonValue,
      outputSummary: `Created opportunity: ${opportunity.title}`,
    });

    return opportunity;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new OpportunitiesError(
          "DUPLICATE_SOURCE_ID",
          `An opportunity from ${data.source} with ID ${data.sourceId} already exists`,
          { source: data.source, sourceId: data.sourceId }
        );
      }
    }
    throw error;
  }
}

/**
 * Get an opportunity by ID
 */
export async function getOpportunityById(
  userId: string,
  id: string
): Promise<Opportunity | null> {
  return db.opportunity.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });
}

/**
 * Update an opportunity
 */
export async function updateOpportunity(
  userId: string,
  id: string,
  data: UpdateOpportunityInput,
  context?: ServiceContext
): Promise<Opportunity> {
  const existing = await db.opportunity.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new OpportunitiesError("OPPORTUNITY_NOT_FOUND", `Opportunity not found: ${id}`);
  }

  const normalizedTags = data.tags ? normalizeTags(data.tags) : undefined;
  const importance =
    data.importance !== undefined ? validateImportance(data.importance) : undefined;

  // Helper to check if a field was explicitly provided (including null)
  const isProvided = <T>(value: T | undefined): value is T => value !== undefined;

  const opportunity = await db.opportunity.update({
    where: { id },
    data: {
      ...(isProvided(data.title) && { title: data.title }),
      ...(isProvided(data.description) && { description: data.description }),
      ...(isProvided(data.type) && { type: data.type }),
      ...(isProvided(data.status) && { status: data.status }),
      ...(isProvided(data.priority) && { priority: data.priority }),
      ...(importance !== undefined && { importance }),
      ...(isProvided(data.expiresAt) && { expiresAt: data.expiresAt }),
      ...(isProvided(data.evaluatedAt) && { evaluatedAt: data.evaluatedAt }),
      ...(isProvided(data.decidedAt) && { decidedAt: data.decidedAt }),
      ...(isProvided(data.convertedAt) && { convertedAt: data.convertedAt }),
      ...(isProvided(data.context) && { context: data.context }),
      ...(isProvided(data.trigger) && { trigger: data.trigger }),
      ...(isProvided(data.outcome) && { outcome: data.outcome }),
      ...(isProvided(data.outcomeNotes) && { outcomeNotes: data.outcomeNotes }),
      ...(isProvided(data.convertedToType) && { convertedToType: data.convertedToType }),
      ...(isProvided(data.convertedToId) && { convertedToId: data.convertedToId }),
      ...(isProvided(data.relatedPersonId) && { relatedPersonId: data.relatedPersonId }),
      ...(isProvided(data.participants) && { participants: data.participants }),
      ...(isProvided(data.relatedEmailId) && { relatedEmailId: data.relatedEmailId }),
      ...(isProvided(data.relatedEventId) && { relatedEventId: data.relatedEventId }),
      ...(isProvided(data.relatedTaskId) && { relatedTaskId: data.relatedTaskId }),
      ...(isProvided(data.relatedProjectId) && { relatedProjectId: data.relatedProjectId }),
      ...(isProvided(data.potentialValue) && { potentialValue: data.potentialValue }),
      ...(isProvided(data.effort) && { effort: data.effort }),
      ...(isProvided(data.risk) && { risk: data.risk }),
      ...(isProvided(data.category) && { category: data.category }),
      ...(isProvided(data.metadata) && {
        metadata: data.metadata as Prisma.InputJsonValue,
      }),
      ...(normalizedTags !== undefined && { tags: normalizedTags }),
    },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "update",
    actionCategory: "context",
    entityType: "opportunity",
    entityId: opportunity.id,
    entitySnapshot: opportunity as unknown as Prisma.InputJsonValue,
    outputSummary: `Updated opportunity: ${opportunity.title}`,
  });

  return opportunity;
}

/**
 * Soft delete an opportunity
 */
export async function deleteOpportunity(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<void> {
  const existing = await db.opportunity.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new OpportunitiesError("OPPORTUNITY_NOT_FOUND", `Opportunity not found: ${id}`);
  }

  await db.opportunity.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "delete",
    actionCategory: "context",
    entityType: "opportunity",
    entityId: id,
    outputSummary: `Deleted opportunity: ${existing.title}`,
  });
}

/**
 * Restore a soft-deleted opportunity
 */
export async function restoreOpportunity(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Opportunity> {
  const existing = await db.opportunity.findFirst({
    where: { id, userId, deletedAt: { not: null } },
  });

  if (!existing) {
    throw new OpportunitiesError(
      "OPPORTUNITY_NOT_FOUND",
      `Deleted opportunity not found: ${id}`
    );
  }

  const opportunity = await db.opportunity.update({
    where: { id },
    data: { deletedAt: null },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "update",
    actionCategory: "context",
    entityType: "opportunity",
    entityId: id,
    outputSummary: `Restored opportunity: ${opportunity.title}`,
  });

  return opportunity;
}

/**
 * Start evaluating an opportunity
 */
export async function startEvaluatingOpportunity(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Opportunity> {
  return updateOpportunity(
    userId,
    id,
    {
      status: "evaluating",
      evaluatedAt: new Date(),
    },
    context
  );
}

/**
 * Pursue an opportunity
 */
export async function pursueOpportunity(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Opportunity> {
  return updateOpportunity(
    userId,
    id,
    {
      status: "pursuing",
    },
    context
  );
}

/**
 * Decline an opportunity
 */
export async function declineOpportunity(
  userId: string,
  id: string,
  reason?: string,
  context?: ServiceContext
): Promise<Opportunity> {
  return updateOpportunity(
    userId,
    id,
    {
      status: "declined",
      outcome: "declined",
      outcomeNotes: reason,
      decidedAt: new Date(),
    },
    context
  );
}

/**
 * Mark an opportunity as expired
 */
export async function markOpportunityExpired(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Opportunity> {
  return updateOpportunity(
    userId,
    id,
    {
      status: "expired",
      outcome: "expired",
      decidedAt: new Date(),
    },
    context
  );
}

/**
 * Archive an opportunity
 */
export async function archiveOpportunity(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Opportunity> {
  return updateOpportunity(userId, id, { status: "archived" }, context);
}

/**
 * Convert an opportunity to another entity
 */
export async function convertOpportunity(
  userId: string,
  id: string,
  convertedToType: string,
  convertedToId: string,
  context?: ServiceContext
): Promise<Opportunity> {
  const existing = await getOpportunityById(userId, id);
  
  if (!existing) {
    throw new OpportunitiesError("OPPORTUNITY_NOT_FOUND", `Opportunity not found: ${id}`);
  }

  if (existing.status === "converted") {
    throw new OpportunitiesError(
      "ALREADY_CONVERTED",
      `Opportunity already converted to ${existing.convertedToType}`,
      { existingConvertedToType: existing.convertedToType, existingConvertedToId: existing.convertedToId }
    );
  }

  return updateOpportunity(
    userId,
    id,
    {
      status: "converted",
      outcome: "accepted",
      convertedToType,
      convertedToId,
      convertedAt: new Date(),
      decidedAt: new Date(),
    },
    context
  );
}

/**
 * List opportunities with filtering and pagination
 */
export async function listOpportunities(
  userId: string,
  options: ListOpportunitiesOptions = {}
): Promise<PaginatedResult<Opportunity>> {
  const pagination = normalizePagination(options);
  const orderBy = buildOrderBy(options.sortBy ?? "createdAt", options.sortOrder ?? "desc");

  const where: Prisma.OpportunityWhereInput = {
    userId,
    ...softDeleteFilter(options.includeDeleted),
    ...(options.type && { type: options.type }),
    ...(options.status && { status: options.status }),
    ...(options.priority && { priority: options.priority }),
    ...(options.category && { category: options.category }),
    ...(options.expiresBefore && { expiresAt: { lte: options.expiresBefore } }),
    ...(options.expiresAfter && { expiresAt: { gte: options.expiresAfter } }),
    ...(options.relatedPersonId && { relatedPersonId: options.relatedPersonId }),
    ...(options.minImportance && { importance: { gte: options.minImportance } }),
    ...(options.source && { source: options.source }),
    ...(options.tags?.length && { tags: { hasSome: options.tags } }),
    ...(options.search && {
      OR: [
        { title: { contains: options.search, mode: "insensitive" as const } },
        { description: { contains: options.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const opportunities = await db.opportunity.findMany({
    where,
    orderBy,
    ...pagination,
  });

  return processPaginatedResults(opportunities, options.limit ?? 20);
}

/**
 * Find an opportunity by source
 */
export async function findOpportunityBySource(
  userId: string,
  source: Source,
  sourceId: string
): Promise<Opportunity | null> {
  return db.opportunity.findFirst({
    where: { userId, source, sourceId, ...softDeleteFilter() },
  });
}

/**
 * Search opportunities by title/description
 */
export async function searchOpportunities(
  userId: string,
  query: string,
  options: SearchOpportunitiesOptions = {}
): Promise<Opportunity[]> {
  const limit = options.limit ?? 20;

  return db.opportunity.findMany({
    where: {
      userId,
      ...(options.includeDeleted ? {} : softDeleteFilter()),
      ...(options.status && { status: options.status }),
      ...(options.priority && { priority: options.priority }),
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { context: { contains: query, mode: "insensitive" } },
        { potentialValue: { contains: query, mode: "insensitive" } },
        { tags: { hasSome: [query.toLowerCase()] } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

/**
 * Get all active opportunities (identified, evaluating, or pursuing)
 */
export async function getActiveOpportunities(
  userId: string,
  limit: number = 50
): Promise<Opportunity[]> {
  return db.opportunity.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      status: { in: ["identified", "evaluating", "pursuing"] },
    },
    // Use importance (numeric) for proper ordering since priority is a string
    // that would sort alphabetically ("high" < "low" < "medium" < "urgent")
    orderBy: [{ importance: "desc" }, { expiresAt: "asc" }],
    take: limit,
  });
}

/**
 * Get opportunities expiring soon
 */
export async function getExpiringOpportunities(
  userId: string,
  withinDays: number = 7,
  limit: number = 20
): Promise<Opportunity[]> {
  const now = new Date();
  const future = addDays(now, withinDays);

  return db.opportunity.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      status: { in: ["identified", "evaluating", "pursuing"] },
      expiresAt: {
        gte: now,
        lte: future,
      },
    },
    orderBy: { expiresAt: "asc" },
    take: limit,
  });
}

/**
 * Get opportunities by related person
 */
export async function getOpportunitiesByPerson(
  userId: string,
  personId: string
): Promise<Opportunity[]> {
  return db.opportunity.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      OR: [
        { relatedPersonId: personId },
        { participants: { has: personId } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Get opportunities by category
 */
export async function getOpportunitiesByCategory(
  userId: string,
  category: string
): Promise<Opportunity[]> {
  return db.opportunity.findMany({
    where: {
      userId,
      category,
      ...softDeleteFilter(),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Check if an opportunity's key fields have changed
 */
function hasOpportunityChanged(
  existing: Opportunity,
  input: SourceOpportunityInput
): boolean {
  // Compare key fields that indicate meaningful changes
  return (
    existing.title !== input.data.title ||
    existing.description !== input.data.description ||
    existing.type !== input.data.type ||
    existing.status !== input.data.status ||
    existing.priority !== input.data.priority ||
    existing.importance !== input.data.importance
  );
}

/**
 * Upsert opportunities from external source
 */
export async function upsertOpportunitiesFromSource(
  userId: string,
  source: Source,
  opportunities: SourceOpportunityInput[],
  context?: ServiceContext
): Promise<UpsertResult<Opportunity>> {
  const created: Opportunity[] = [];
  const updated: Opportunity[] = [];
  let unchanged = 0;

  for (const input of opportunities) {
    const existing = await findOpportunityBySource(userId, source, input.sourceId);

    if (existing) {
      // Only update if key fields have changed to avoid unnecessary writes
      if (hasOpportunityChanged(existing, input)) {
        const updatedOpp = await updateOpportunity(
          userId,
          existing.id,
          { ...input.data } as UpdateOpportunityInput,
          context
        );
        updated.push(updatedOpp);
      } else {
        unchanged++;
      }
    } else {
      const newOpp = await createOpportunity(
        userId,
        { ...input.data, source, sourceId: input.sourceId },
        context
      );
      created.push(newOpp);
    }
  }

  return { created, updated, unchanged };
}

// ─────────────────────────────────────────────────────────────
// Service Object
// ─────────────────────────────────────────────────────────────

export const OpportunitiesService: IOpportunitiesService = {
  create: createOpportunity,
  getById: getOpportunityById,
  update: updateOpportunity,
  delete: deleteOpportunity,
  restore: restoreOpportunity,
  startEvaluating: startEvaluatingOpportunity,
  pursue: pursueOpportunity,
  decline: declineOpportunity,
  markExpired: markOpportunityExpired,
  archive: archiveOpportunity,
  convert: convertOpportunity,
  list: listOpportunities,
  findBySource: findOpportunityBySource,
  search: searchOpportunities,
  getActive: getActiveOpportunities,
  getExpiring: getExpiringOpportunities,
  getByPerson: getOpportunitiesByPerson,
  getByCategory: getOpportunitiesByCategory,
  upsertFromSource: upsertOpportunitiesFromSource,
};

