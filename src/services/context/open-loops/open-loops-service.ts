// ═══════════════════════════════════════════════════════════════════════════
// OpenLoops Service
// CRUD operations for OpenLoop entities with audit logging
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
} from "../utils";
import type {
  OpenLoop,
  CreateOpenLoopInput,
  UpdateOpenLoopInput,
  ListOpenLoopsOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  IOpenLoopsService,
  SearchOpenLoopsOptions,
  SourceOpenLoopInput,
} from "./types";
import { OpenLoopsServiceError as OpenLoopsError } from "./types";

// ─────────────────────────────────────────────────────────────
// OpenLoops Service Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Create a new open loop
 */
export async function createOpenLoop(
  userId: string,
  data: CreateOpenLoopInput,
  context?: ServiceContext
): Promise<OpenLoop> {
  const normalizedTags = data.tags ? normalizeTags(data.tags) : [];
  const importance =
    data.importance !== undefined ? validateImportance(data.importance) : 5;

  try {
    const openLoop = await db.openLoop.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        type: data.type ?? "follow_up",
        context: data.context,
        trigger: data.trigger,
        status: data.status ?? "open",
        priority: data.priority ?? "medium",
        importance,
        dueAt: data.dueAt,
        reminderAt: data.reminderAt,
        staleAfter: data.staleAfter,
        relatedPersonId: data.relatedPersonId,
        relatedTaskId: data.relatedTaskId,
        relatedEventId: data.relatedEventId,
        relatedEmailId: data.relatedEmailId,
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
      entityType: "open_loop",
      entityId: openLoop.id,
      entitySnapshot: openLoop as unknown as Prisma.InputJsonValue,
      outputSummary: `Created open loop: ${openLoop.title}`,
    });

    return openLoop;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new OpenLoopsError(
          "DUPLICATE_SOURCE_ID",
          `An open loop from ${data.source} with ID ${data.sourceId} already exists`,
          { source: data.source, sourceId: data.sourceId }
        );
      }
    }
    throw error;
  }
}

/**
 * Get an open loop by ID
 */
export async function getOpenLoopById(
  userId: string,
  id: string
): Promise<OpenLoop | null> {
  return db.openLoop.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });
}

/**
 * Update an open loop
 */
export async function updateOpenLoop(
  userId: string,
  id: string,
  data: UpdateOpenLoopInput,
  context?: ServiceContext
): Promise<OpenLoop> {
  const existing = await db.openLoop.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new OpenLoopsError("OPEN_LOOP_NOT_FOUND", `Open loop not found: ${id}`);
  }

  const normalizedTags = data.tags ? normalizeTags(data.tags) : undefined;
  const importance =
    data.importance !== undefined ? validateImportance(data.importance) : undefined;

  // Helper to check if a field was explicitly provided (including null)
  const isProvided = <T>(value: T | undefined): value is T => value !== undefined;

  const openLoop = await db.openLoop.update({
    where: { id },
    data: {
      ...(isProvided(data.title) && { title: data.title }),
      ...(isProvided(data.description) && { description: data.description }),
      ...(isProvided(data.type) && { type: data.type }),
      ...(isProvided(data.context) && { context: data.context }),
      ...(isProvided(data.trigger) && { trigger: data.trigger }),
      ...(isProvided(data.status) && { status: data.status }),
      ...(isProvided(data.resolvedAt) && { resolvedAt: data.resolvedAt }),
      ...(isProvided(data.resolution) && { resolution: data.resolution }),
      ...(isProvided(data.resolvedBy) && { resolvedBy: data.resolvedBy }),
      ...(isProvided(data.priority) && { priority: data.priority }),
      ...(importance !== undefined && { importance }),
      ...(isProvided(data.dueAt) && { dueAt: data.dueAt }),
      ...(isProvided(data.reminderAt) && { reminderAt: data.reminderAt }),
      ...(isProvided(data.staleAfter) && { staleAfter: data.staleAfter }),
      ...(isProvided(data.relatedPersonId) && {
        relatedPersonId: data.relatedPersonId,
      }),
      ...(isProvided(data.relatedTaskId) && {
        relatedTaskId: data.relatedTaskId,
      }),
      ...(isProvided(data.relatedEventId) && {
        relatedEventId: data.relatedEventId,
      }),
      ...(isProvided(data.relatedEmailId) && {
        relatedEmailId: data.relatedEmailId,
      }),
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
    entityType: "open_loop",
    entityId: openLoop.id,
    entitySnapshot: openLoop as unknown as Prisma.InputJsonValue,
    outputSummary: `Updated open loop: ${openLoop.title}`,
  });

  return openLoop;
}

/**
 * Soft delete an open loop
 */
export async function deleteOpenLoop(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<void> {
  const existing = await db.openLoop.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new OpenLoopsError("OPEN_LOOP_NOT_FOUND", `Open loop not found: ${id}`);
  }

  await db.openLoop.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "delete",
    actionCategory: "context",
    entityType: "open_loop",
    entityId: id,
    outputSummary: `Deleted open loop: ${existing.title}`,
  });
}

/**
 * Restore a soft-deleted open loop
 */
export async function restoreOpenLoop(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<OpenLoop> {
  const existing = await db.openLoop.findFirst({
    where: { id, userId, deletedAt: { not: null } },
  });

  if (!existing) {
    throw new OpenLoopsError(
      "OPEN_LOOP_NOT_FOUND",
      `Deleted open loop not found: ${id}`
    );
  }

  const openLoop = await db.openLoop.update({
    where: { id },
    data: { deletedAt: null },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "update",
    actionCategory: "context",
    entityType: "open_loop",
    entityId: id,
    outputSummary: `Restored open loop: ${openLoop.title}`,
  });

  return openLoop;
}

/**
 * Resolve an open loop
 */
export async function resolveOpenLoop(
  userId: string,
  id: string,
  resolution: string,
  context?: ServiceContext
): Promise<OpenLoop> {
  return updateOpenLoop(
    userId,
    id,
    {
      status: "resolved",
      resolution,
      resolvedAt: new Date(),
      resolvedBy: "user",
    },
    context
  );
}

/**
 * Cancel an open loop
 */
export async function cancelOpenLoop(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<OpenLoop> {
  return updateOpenLoop(userId, id, { status: "cancelled" }, context);
}

/**
 * Mark an open loop as stale
 */
export async function markOpenLoopStale(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<OpenLoop> {
  return updateOpenLoop(userId, id, { status: "stale" }, context);
}

/**
 * Reopen a closed open loop
 */
export async function reopenOpenLoop(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<OpenLoop> {
  return updateOpenLoop(
    userId,
    id,
    { status: "open", resolvedAt: null, resolution: null, resolvedBy: null },
    context
  );
}

/**
 * List open loops with filtering and pagination
 */
export async function listOpenLoops(
  userId: string,
  options: ListOpenLoopsOptions = {}
): Promise<PaginatedResult<OpenLoop>> {
  const pagination = normalizePagination(options);
  const orderBy = buildOrderBy(options.sortBy ?? "createdAt", options.sortOrder ?? "desc");

  const where: Prisma.OpenLoopWhereInput = {
    userId,
    ...softDeleteFilter(options.includeDeleted),
    ...(options.type && { type: options.type }),
    ...(options.status && { status: options.status }),
    ...(options.priority && { priority: options.priority }),
    ...(options.dueBefore && { dueAt: { lte: options.dueBefore } }),
    ...(options.dueAfter && { dueAt: { gte: options.dueAfter } }),
    ...(options.relatedPersonId && { relatedPersonId: options.relatedPersonId }),
    ...(options.source && { source: options.source }),
    ...(options.tags?.length && { tags: { hasSome: options.tags } }),
    ...(options.search && {
      OR: [
        { title: { contains: options.search, mode: "insensitive" as const } },
        { description: { contains: options.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const openLoops = await db.openLoop.findMany({
    where,
    orderBy,
    ...pagination,
  });

  return processPaginatedResults(openLoops, options.limit ?? 20);
}

/**
 * Find an open loop by source
 */
export async function findOpenLoopBySource(
  userId: string,
  source: Source,
  sourceId: string
): Promise<OpenLoop | null> {
  return db.openLoop.findFirst({
    where: { userId, source, sourceId, ...softDeleteFilter() },
  });
}

/**
 * Search open loops by title/description
 */
export async function searchOpenLoops(
  userId: string,
  query: string,
  options: SearchOpenLoopsOptions = {}
): Promise<OpenLoop[]> {
  const limit = options.limit ?? 20;

  return db.openLoop.findMany({
    where: {
      userId,
      ...(options.includeDeleted ? {} : softDeleteFilter()),
      ...(options.status && { status: options.status }),
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { context: { contains: query, mode: "insensitive" } },
        { tags: { hasSome: [query.toLowerCase()] } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

/**
 * Get all open (unresolved) open loops
 */
export async function getOpenOpenLoops(
  userId: string,
  limit: number = 50
): Promise<OpenLoop[]> {
  return db.openLoop.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      status: { in: ["open", "in_progress"] },
    },
    orderBy: [{ priority: "desc" }, { dueAt: "asc" }],
    take: limit,
  });
}

/**
 * Get overdue open loops
 */
export async function getOverdueOpenLoops(
  userId: string,
  limit: number = 20
): Promise<OpenLoop[]> {
  const now = new Date();

  return db.openLoop.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      status: { in: ["open", "in_progress"] },
      dueAt: { lt: now },
    },
    orderBy: { dueAt: "asc" },
    take: limit,
  });
}

/**
 * Get open loops by related person
 */
export async function getOpenLoopsByPerson(
  userId: string,
  personId: string
): Promise<OpenLoop[]> {
  return db.openLoop.findMany({
    where: {
      userId,
      relatedPersonId: personId,
      ...softDeleteFilter(),
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Upsert open loops from external source
 */
export async function upsertOpenLoopsFromSource(
  userId: string,
  source: Source,
  openLoops: SourceOpenLoopInput[],
  context?: ServiceContext
): Promise<UpsertResult<OpenLoop>> {
  const created: OpenLoop[] = [];
  const updated: OpenLoop[] = [];
  const unchanged = 0;

  for (const input of openLoops) {
    const existing = await findOpenLoopBySource(userId, source, input.sourceId);

    if (existing) {
      // Always update from source to ensure all field changes are captured
      // This avoids having to compare every field individually
      const updatedLoop = await updateOpenLoop(
        userId,
        existing.id,
        { ...input.data } as UpdateOpenLoopInput,
        context
      );
      updated.push(updatedLoop);
    } else {
      const newLoop = await createOpenLoop(
        userId,
        { ...input.data, source, sourceId: input.sourceId },
        context
      );
      created.push(newLoop);
    }
  }

  return { created, updated, unchanged };
}

// ─────────────────────────────────────────────────────────────
// Service Object
// ─────────────────────────────────────────────────────────────

export const OpenLoopsService: IOpenLoopsService = {
  create: createOpenLoop,
  getById: getOpenLoopById,
  update: updateOpenLoop,
  delete: deleteOpenLoop,
  restore: restoreOpenLoop,
  resolve: resolveOpenLoop,
  cancel: cancelOpenLoop,
  markStale: markOpenLoopStale,
  reopen: reopenOpenLoop,
  list: listOpenLoops,
  findBySource: findOpenLoopBySource,
  search: searchOpenLoops,
  getOpen: getOpenOpenLoops,
  getOverdue: getOverdueOpenLoops,
  getByPerson: getOpenLoopsByPerson,
  upsertFromSource: upsertOpenLoopsFromSource,
};

