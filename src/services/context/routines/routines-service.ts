// ═══════════════════════════════════════════════════════════════════════════
// Routines Service
// CRUD operations for Routine entities with audit logging
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
  addHours,
} from "../utils";
import type {
  Routine,
  CreateRoutineInput,
  UpdateRoutineInput,
  ListRoutinesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  IRoutinesService,
  SearchRoutinesOptions,
  SourceRoutineInput,
} from "./types";
import { RoutinesServiceError as RoutinesError } from "./types";

// ─────────────────────────────────────────────────────────────
// Routines Service Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Create a new routine
 */
export async function createRoutine(
  userId: string,
  data: CreateRoutineInput,
  context?: ServiceContext
): Promise<Routine> {
  // Normalize tags
  const normalizedTags = data.tags ? normalizeTags(data.tags) : [];

  // Validate importance
  const importance =
    data.importance !== undefined ? validateImportance(data.importance) : 5;

  try {
    const routine = await db.routine.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        type: data.type ?? "habit",
        frequency: data.frequency,
        schedule: (data.schedule as Prisma.InputJsonValue) ?? null,
        timezone: data.timezone,
        durationMinutes: data.durationMinutes,
        preferredTime: data.preferredTime,
        status: data.status ?? "active",
        isActive: true,
        notes: data.notes,
        importance,
        category: data.category,
        relatedTaskIds: data.relatedTaskIds ?? [],
        relatedEventIds: data.relatedEventIds ?? [],
        source: data.source,
        sourceId: data.sourceId,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? {},
        tags: normalizedTags,
      },
    });

    // Log audit entry
    await logAuditEntry({
      userId: context?.userId ?? userId,
      sessionId: context?.sessionId,
      conversationId: context?.conversationId,
      actionType: "create",
      actionCategory: "context",
      entityType: "routine",
      entityId: routine.id,
      entitySnapshot: routine as unknown as Prisma.InputJsonValue,
      outputSummary: `Created routine: ${routine.name}`,
    });

    return routine;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = error.meta?.target as string[] | undefined;
        if (target?.includes("sourceId")) {
          throw new RoutinesError(
            "DUPLICATE_SOURCE_ID",
            `A routine from ${data.source} with ID ${data.sourceId} already exists`,
            { source: data.source, sourceId: data.sourceId }
          );
        }
      }
    }
    throw error;
  }
}

/**
 * Get a routine by ID
 */
export async function getRoutineById(
  userId: string,
  id: string
): Promise<Routine | null> {
  return db.routine.findFirst({
    where: {
      id,
      userId,
      ...softDeleteFilter(),
    },
  });
}

/**
 * Update a routine
 */
export async function updateRoutine(
  userId: string,
  id: string,
  data: UpdateRoutineInput,
  context?: ServiceContext
): Promise<Routine> {
  // Verify routine exists and user owns it
  const existing = await db.routine.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new RoutinesError("ROUTINE_NOT_FOUND", `Routine not found: ${id}`);
  }

  // Normalize tags if provided
  const normalizedTags = data.tags ? normalizeTags(data.tags) : undefined;

  // Validate importance if provided
  const importance =
    data.importance !== undefined
      ? validateImportance(data.importance)
      : undefined;

  const routine = await db.routine.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.frequency !== undefined && { frequency: data.frequency }),
      ...(data.schedule !== undefined && {
        schedule: data.schedule as Prisma.InputJsonValue,
      }),
      ...(data.timezone !== undefined && { timezone: data.timezone }),
      ...(data.durationMinutes !== undefined && {
        durationMinutes: data.durationMinutes,
      }),
      ...(data.preferredTime !== undefined && {
        preferredTime: data.preferredTime,
      }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.streak !== undefined && { streak: data.streak }),
      ...(data.completionCount !== undefined && {
        completionCount: data.completionCount,
      }),
      ...(data.skipCount !== undefined && { skipCount: data.skipCount }),
      ...(data.lastCompletedAt !== undefined && {
        lastCompletedAt: data.lastCompletedAt,
      }),
      ...(data.lastRunAt !== undefined && { lastRunAt: data.lastRunAt }),
      ...(data.nextRunAt !== undefined && { nextRunAt: data.nextRunAt }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(importance !== undefined && { importance }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.relatedTaskIds !== undefined && {
        relatedTaskIds: data.relatedTaskIds,
      }),
      ...(data.relatedEventIds !== undefined && {
        relatedEventIds: data.relatedEventIds,
      }),
      ...(data.metadata !== undefined && {
        metadata: data.metadata as Prisma.InputJsonValue,
      }),
      ...(normalizedTags !== undefined && { tags: normalizedTags }),
    },
  });

  // Log audit entry
  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "update",
    actionCategory: "context",
    entityType: "routine",
    entityId: routine.id,
    entitySnapshot: routine as unknown as Prisma.InputJsonValue,
    outputSummary: `Updated routine: ${routine.name}`,
  });

  return routine;
}

/**
 * Soft delete a routine
 */
export async function deleteRoutine(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<void> {
  const existing = await db.routine.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new RoutinesError("ROUTINE_NOT_FOUND", `Routine not found: ${id}`);
  }

  await db.routine.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  // Log audit entry
  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "delete",
    actionCategory: "context",
    entityType: "routine",
    entityId: id,
    outputSummary: `Deleted routine: ${existing.name}`,
  });
}

/**
 * Restore a soft-deleted routine
 */
export async function restoreRoutine(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Routine> {
  const existing = await db.routine.findFirst({
    where: {
      id,
      userId,
      deletedAt: { not: null },
    },
  });

  if (!existing) {
    throw new RoutinesError(
      "ROUTINE_NOT_FOUND",
      `Deleted routine not found: ${id}`
    );
  }

  const routine = await db.routine.update({
    where: { id },
    data: { deletedAt: null },
  });

  // Log audit entry
  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "update",
    actionCategory: "context",
    entityType: "routine",
    entityId: id,
    outputSummary: `Restored routine: ${routine.name}`,
  });

  return routine;
}

/**
 * Pause a routine
 */
export async function pauseRoutine(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Routine> {
  return updateRoutine(userId, id, { status: "paused", isActive: false }, context);
}

/**
 * Resume a paused routine
 */
export async function resumeRoutine(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Routine> {
  return updateRoutine(userId, id, { status: "active", isActive: true }, context);
}

/**
 * Archive a routine
 */
export async function archiveRoutine(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Routine> {
  return updateRoutine(userId, id, { status: "archived", isActive: false }, context);
}

/**
 * Record a routine completion
 */
export async function recordRoutineCompletion(
  userId: string,
  id: string,
  rating?: number,
  context?: ServiceContext
): Promise<Routine> {
  const existing = await db.routine.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new RoutinesError("ROUTINE_NOT_FOUND", `Routine not found: ${id}`);
  }

  const now = new Date();
  const newCompletionCount = existing.completionCount + 1;

  // Calculate new average rating if provided
  let newAverageRating = existing.averageRating;
  if (rating !== undefined && rating >= 0 && rating <= 5) {
    const currentTotal = existing.averageRating
      ? Number(existing.averageRating) * existing.completionCount
      : 0;
    newAverageRating = new Prisma.Decimal(
      (currentTotal + rating) / newCompletionCount
    );
  }

  return updateRoutine(
    userId,
    id,
    {
      completionCount: newCompletionCount,
      lastCompletedAt: now,
      lastRunAt: now,
      streak: existing.streak + 1,
      averageRating: newAverageRating,
    },
    context
  );
}

/**
 * Record a routine skip
 */
export async function recordRoutineSkip(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Routine> {
  const existing = await db.routine.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new RoutinesError("ROUTINE_NOT_FOUND", `Routine not found: ${id}`);
  }

  return updateRoutine(
    userId,
    id,
    {
      skipCount: existing.skipCount + 1,
      lastRunAt: new Date(),
      streak: 0, // Reset streak on skip
    },
    context
  );
}

/**
 * List routines with filtering and pagination
 */
export async function listRoutines(
  userId: string,
  options: ListRoutinesOptions = {}
): Promise<PaginatedResult<Routine>> {
  const pagination = normalizePagination(options);
  const orderBy = buildOrderBy(options.sortBy ?? "createdAt", options.sortOrder ?? "desc");

  const where: Prisma.RoutineWhereInput = {
    userId,
    ...softDeleteFilter(options.includeDeleted),
    ...(options.type && { type: options.type }),
    ...(options.status && { status: options.status }),
    ...(options.category && { category: options.category }),
    ...(options.isActive !== undefined && { isActive: options.isActive }),
    ...(options.nextRunBefore && { nextRunAt: { lte: options.nextRunBefore } }),
    ...(options.nextRunAfter && { nextRunAt: { gte: options.nextRunAfter } }),
    ...(options.source && { source: options.source }),
    ...(options.tags?.length && { tags: { hasSome: options.tags } }),
    ...(options.search && {
      OR: [
        { name: { contains: options.search, mode: "insensitive" as const } },
        { description: { contains: options.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const routines = await db.routine.findMany({
    where,
    orderBy,
    ...pagination,
  });

  return processPaginatedResults(routines, options.limit ?? 20);
}

/**
 * Find a routine by source
 */
export async function findRoutineBySource(
  userId: string,
  source: Source,
  sourceId: string
): Promise<Routine | null> {
  return db.routine.findFirst({
    where: {
      userId,
      source,
      sourceId,
      ...softDeleteFilter(),
    },
  });
}

/**
 * Search routines by name/description
 */
export async function searchRoutines(
  userId: string,
  query: string,
  options: SearchRoutinesOptions = {}
): Promise<Routine[]> {
  const limit = options.limit ?? 20;

  return db.routine.findMany({
    where: {
      userId,
      ...(options.includeDeleted ? {} : softDeleteFilter()),
      ...(options.isActive !== undefined && { isActive: options.isActive }),
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { category: { contains: query, mode: "insensitive" } },
        { tags: { hasSome: [query.toLowerCase()] } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

/**
 * Get routines due now (nextRunAt is in the past or now)
 */
export async function getRoutinesDueNow(
  userId: string,
  limit: number = 20
): Promise<Routine[]> {
  const now = new Date();

  return db.routine.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      isActive: true,
      nextRunAt: { lte: now },
    },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });
}

/**
 * Get upcoming routines
 */
export async function getUpcomingRoutines(
  userId: string,
  hours: number = 24,
  limit: number = 20
): Promise<Routine[]> {
  const now = new Date();
  const future = addHours(now, hours);

  return db.routine.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      isActive: true,
      nextRunAt: {
        gt: now,
        lte: future,
      },
    },
    orderBy: { nextRunAt: "asc" },
    take: limit,
  });
}

/**
 * Get routines by category
 */
export async function getRoutinesByCategory(
  userId: string,
  category: string
): Promise<Routine[]> {
  return db.routine.findMany({
    where: {
      userId,
      category,
      ...softDeleteFilter(),
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Upsert routines from external source
 */
export async function upsertRoutinesFromSource(
  userId: string,
  source: Source,
  routines: SourceRoutineInput[],
  context?: ServiceContext
): Promise<UpsertResult<Routine>> {
  const created: Routine[] = [];
  const updated: Routine[] = [];
  const unchanged = 0;

  for (const input of routines) {
    const existing = await findRoutineBySource(userId, source, input.sourceId);

    if (existing) {
      // Always update from source to ensure all field changes are captured
      // This avoids having to compare every field individually
      const updatedRoutine = await updateRoutine(
        userId,
        existing.id,
        { ...input.data } as UpdateRoutineInput,
        context
      );
      updated.push(updatedRoutine);
    } else {
      const newRoutine = await createRoutine(
        userId,
        {
          ...input.data,
          source,
          sourceId: input.sourceId,
        },
        context
      );
      created.push(newRoutine);
    }
  }

  return { created, updated, unchanged };
}

// ─────────────────────────────────────────────────────────────
// Service Object
// ─────────────────────────────────────────────────────────────

export const RoutinesService: IRoutinesService = {
  create: createRoutine,
  getById: getRoutineById,
  update: updateRoutine,
  delete: deleteRoutine,
  restore: restoreRoutine,
  pause: pauseRoutine,
  resume: resumeRoutine,
  archive: archiveRoutine,
  recordCompletion: recordRoutineCompletion,
  recordSkip: recordRoutineSkip,
  list: listRoutines,
  findBySource: findRoutineBySource,
  search: searchRoutines,
  getDueNow: getRoutinesDueNow,
  getUpcoming: getUpcomingRoutines,
  getByCategory: getRoutinesByCategory,
  upsertFromSource: upsertRoutinesFromSource,
};

