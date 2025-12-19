// ═══════════════════════════════════════════════════════════════════════════
// Deadlines Service
// CRUD operations for Deadline entities with audit logging
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
import {
  embedDeadline,
  removeDeadlineEmbedding,
  type EmbeddingContext,
} from "../embedding-integration";
import type {
  Deadline,
  CreateDeadlineInput,
  UpdateDeadlineInput,
  ListDeadlinesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  DeadlineStatus,
  IDeadlinesService,
  SearchDeadlinesOptions,
  SourceDeadlineInput,
  DeadlineWithRelations,
  DeadlineWithUrgency,
  UrgencyLevel,
  DeadlineUrgencyOptions,
} from "./types";
import { DeadlinesServiceError as DeadlinesError } from "./types";

// ─────────────────────────────────────────────────────────────
// Urgency Calculation
// ─────────────────────────────────────────────────────────────

/**
 * Calculate days remaining until deadline
 */
function calculateDaysRemaining(dueAt: Date): number {
  const now = new Date();
  const diffMs = dueAt.getTime() - now.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

/**
 * Calculate urgency level based on days remaining
 */
function calculateUrgencyLevel(
  daysRemaining: number,
  urgentDays: number = 1,
  approachingDays: number = 7
): UrgencyLevel {
  if (daysRemaining < 0) return "overdue";
  if (daysRemaining <= urgentDays) return "urgent";
  if (daysRemaining <= approachingDays) return "approaching";
  if (daysRemaining <= 30) return "normal";
  return "distant";
}

/**
 * Add urgency information to a deadline
 */
export function calculateDeadlineUrgency(deadline: Deadline): DeadlineWithUrgency {
  const daysRemaining = calculateDaysRemaining(deadline.dueAt);
  const urgency = calculateUrgencyLevel(daysRemaining);

  return {
    ...deadline,
    urgency,
    daysRemaining,
  };
}

// ─────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Validate deadline status transition
 */
function validateStatusTransition(
  currentStatus: string,
  newStatus: DeadlineStatus
): void {
  const validTransitions: Record<string, DeadlineStatus[]> = {
    pending: ["completed", "missed", "extended"],
    completed: ["pending"], // Allow reopening
    missed: ["pending", "extended"], // Allow reopening or extending
    extended: ["pending", "completed", "missed"],
  };

  const allowed = validTransitions[currentStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new DeadlinesError(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition from '${currentStatus}' to '${newStatus}'`,
      { currentStatus, newStatus }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Deadlines Service Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Create a new deadline
 */
export async function createDeadline(
  userId: string,
  data: CreateDeadlineInput,
  context?: ServiceContext
): Promise<Deadline> {
  // Verify task exists if provided
  if (data.taskId) {
    const task = await db.task.findFirst({
      where: { id: data.taskId, userId, ...softDeleteFilter() },
    });
    if (!task) {
      throw new DeadlinesError("TASK_NOT_FOUND", `Task not found: ${data.taskId}`);
    }
  }

  // Verify event exists if provided
  if (data.eventId) {
    const event = await db.event.findFirst({
      where: { id: data.eventId, userId, ...softDeleteFilter() },
    });
    if (!event) {
      throw new DeadlinesError("EVENT_NOT_FOUND", `Event not found: ${data.eventId}`);
    }
  }

  // Normalize tags
  const normalizedTags = data.tags ? normalizeTags(data.tags) : [];

  // Validate importance
  const importance = data.importance !== undefined
    ? validateImportance(data.importance)
    : 5;

  try {
    const deadline = await db.deadline.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        type: data.type ?? "deadline",
        dueAt: data.dueAt,
        reminderAt: data.reminderAt,
        status: data.status ?? "pending",
        importance,
        taskId: data.taskId,
        eventId: data.eventId,
        notes: data.notes,
        consequences: data.consequences,
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
      entityType: "deadline",
      entityId: deadline.id,
      entitySnapshot: deadline as unknown as Prisma.InputJsonValue,
      outputSummary: `Created deadline: ${deadline.title}`,
    });

    // Generate embedding (fire-and-forget, errors don't fail the operation)
    void embedDeadline(deadline, context as EmbeddingContext);

    return deadline;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new DeadlinesError(
          "DUPLICATE_SOURCE_ID",
          `A deadline from ${data.source} with ID ${data.sourceId} already exists`,
          { source: data.source, sourceId: data.sourceId }
        );
      }
    }
    throw error;
  }
}

/**
 * Get a deadline by ID
 */
export async function getDeadlineById(
  userId: string,
  id: string
): Promise<Deadline | null> {
  return db.deadline.findFirst({
    where: {
      id,
      userId,
      ...softDeleteFilter(),
    },
  });
}

/**
 * Get a deadline by ID with relations
 */
export async function getDeadlineByIdWithRelations(
  userId: string,
  id: string
): Promise<DeadlineWithRelations | null> {
  return db.deadline.findFirst({
    where: {
      id,
      userId,
      ...softDeleteFilter(),
    },
    include: {
      task: true,
      event: true,
    },
  });
}

/**
 * Update a deadline
 */
export async function updateDeadline(
  userId: string,
  id: string,
  data: UpdateDeadlineInput,
  context?: ServiceContext
): Promise<Deadline> {
  const existing = await db.deadline.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new DeadlinesError("DEADLINE_NOT_FOUND", `Deadline not found: ${id}`);
  }

  // Verify task if being changed
  if (data.taskId !== undefined && data.taskId !== null) {
    const task = await db.task.findFirst({
      where: { id: data.taskId, userId, ...softDeleteFilter() },
    });
    if (!task) {
      throw new DeadlinesError("TASK_NOT_FOUND", `Task not found: ${data.taskId}`);
    }
  }

  // Verify event if being changed
  if (data.eventId !== undefined && data.eventId !== null) {
    const event = await db.event.findFirst({
      where: { id: data.eventId, userId, ...softDeleteFilter() },
    });
    if (!event) {
      throw new DeadlinesError("EVENT_NOT_FOUND", `Event not found: ${data.eventId}`);
    }
  }

  // Normalize tags if provided
  const normalizedTags = data.tags ? normalizeTags(data.tags) : undefined;

  // Validate importance if provided
  const importance = data.importance !== undefined
    ? validateImportance(data.importance)
    : undefined;

  try {
    const deadline = await db.deadline.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.dueAt !== undefined && { dueAt: data.dueAt }),
        ...(data.reminderAt !== undefined && { reminderAt: data.reminderAt }),
        ...(data.status !== undefined && { status: data.status }),
        ...(importance !== undefined && { importance }),
        ...(data.taskId !== undefined && { taskId: data.taskId }),
        ...(data.eventId !== undefined && { eventId: data.eventId }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.consequences !== undefined && { consequences: data.consequences }),
        ...(data.metadata !== undefined && {
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
      entityType: "deadline",
      entityId: deadline.id,
      entitySnapshot: deadline as unknown as Prisma.InputJsonValue,
      outputSummary: `Updated deadline: ${deadline.title}`,
    });

    // Update embedding (fire-and-forget, errors don't fail the operation)
    void embedDeadline(deadline, context as EmbeddingContext);

    return deadline;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new DeadlinesError("DUPLICATE_SOURCE_ID", `A deadline with this source ID already exists`);
      }
    }
    throw error;
  }
}

/**
 * Update deadline status with validation
 */
export async function updateDeadlineStatus(
  userId: string,
  id: string,
  status: DeadlineStatus,
  context?: ServiceContext
): Promise<Deadline> {
  const existing = await db.deadline.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new DeadlinesError("DEADLINE_NOT_FOUND", `Deadline not found: ${id}`);
  }

  validateStatusTransition(existing.status, status);

  return updateDeadline(userId, id, { status }, context);
}

/**
 * Mark deadline as completed
 */
export async function completeDeadline(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Deadline> {
  return updateDeadlineStatus(userId, id, "completed", context);
}

/**
 * Mark deadline as missed
 */
export async function markDeadlineMissed(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Deadline> {
  return updateDeadlineStatus(userId, id, "missed", context);
}

/**
 * Extend a deadline to a new due date
 */
export async function extendDeadline(
  userId: string,
  id: string,
  newDueAt: Date,
  context?: ServiceContext
): Promise<Deadline> {
  const existing = await db.deadline.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new DeadlinesError("DEADLINE_NOT_FOUND", `Deadline not found: ${id}`);
  }

  // Validate new due date is in the future
  if (newDueAt <= new Date()) {
    throw new DeadlinesError(
      "INVALID_DUE_DATE",
      "Extended due date must be in the future",
      { newDueAt }
    );
  }

  validateStatusTransition(existing.status, "extended");

  return updateDeadline(
    userId,
    id,
    { status: "extended", dueAt: newDueAt },
    context
  );
}

/**
 * Reopen a completed or missed deadline
 */
export async function reopenDeadline(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Deadline> {
  return updateDeadlineStatus(userId, id, "pending", context);
}

/**
 * Soft delete a deadline
 */
export async function deleteDeadline(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<void> {
  const existing = await db.deadline.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new DeadlinesError("DEADLINE_NOT_FOUND", `Deadline not found: ${id}`);
  }

  await db.deadline.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "delete",
    actionCategory: "context",
    entityType: "deadline",
    entityId: id,
    outputSummary: `Deleted deadline: ${existing.title}`,
  });

  // Remove embedding (fire-and-forget, errors don't fail the operation)
  void removeDeadlineEmbedding(userId, id, context as EmbeddingContext);
}

/**
 * Restore a soft-deleted deadline
 */
export async function restoreDeadline(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Deadline> {
  const existing = await db.deadline.findFirst({
    where: {
      id,
      userId,
      deletedAt: { not: null },
    },
  });

  if (!existing) {
    throw new DeadlinesError("DEADLINE_NOT_FOUND", `Deleted deadline not found: ${id}`);
  }

  const deadline = await db.deadline.update({
    where: { id },
    data: { deletedAt: null },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "update",
    actionCategory: "context",
    entityType: "deadline",
    entityId: deadline.id,
    outputSummary: `Restored deadline: ${deadline.title}`,
  });

  return deadline;
}

/**
 * List deadlines with filtering and pagination
 */
export async function listDeadlines(
  userId: string,
  options: ListDeadlinesOptions = {}
): Promise<PaginatedResult<Deadline>> {
  const pagination = normalizePagination(options);
  const orderBy = buildOrderBy(options.sortBy ?? "dueAt", options.sortOrder ?? "asc");

  const where: Prisma.DeadlineWhereInput = {
    userId,
    ...softDeleteFilter(options.includeDeleted),
    ...(options.type && { type: options.type }),
    ...(options.status && { status: options.status }),
    ...(options.dueBefore && { dueAt: { lte: options.dueBefore } }),
    ...(options.dueAfter && { dueAt: { gte: options.dueAfter } }),
    ...(options.taskId && { taskId: options.taskId }),
    ...(options.eventId && { eventId: options.eventId }),
    ...(options.minImportance && { importance: { gte: options.minImportance } }),
    ...(options.source && { source: options.source }),
    ...(options.tags?.length && { tags: { hasSome: options.tags } }),
    ...(options.search && {
      OR: [
        { title: { contains: options.search, mode: "insensitive" as const } },
        { description: { contains: options.search, mode: "insensitive" as const } },
        { notes: { contains: options.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const deadlines = await db.deadline.findMany({
    where,
    orderBy,
    ...pagination,
  });

  return processPaginatedResults(deadlines, options.limit ?? 20);
}

/**
 * Find a deadline by source and sourceId
 */
export async function findDeadlineBySource(
  userId: string,
  source: Source,
  sourceId: string
): Promise<Deadline | null> {
  return db.deadline.findFirst({
    where: {
      userId,
      source,
      sourceId,
      ...softDeleteFilter(),
    },
  });
}

/**
 * Search deadlines
 */
export async function searchDeadlines(
  userId: string,
  query: string,
  options: SearchDeadlinesOptions = {}
): Promise<Deadline[]> {
  const limit = options.limit ?? 20;

  return db.deadline.findMany({
    where: {
      userId,
      ...softDeleteFilter(options.includeDeleted),
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { notes: { contains: query, mode: "insensitive" } },
        { consequences: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { dueAt: "asc" },
    take: limit,
  });
}

/**
 * Get overdue deadlines
 */
export async function getOverdueDeadlines(
  userId: string,
  limit: number = 20
): Promise<Deadline[]> {
  return db.deadline.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      dueAt: { lt: new Date() },
      status: { in: ["pending", "extended"] },
    },
    orderBy: { dueAt: "asc" },
    take: limit,
  });
}

/**
 * Get approaching deadlines (within N days)
 */
export async function getApproachingDeadlines(
  userId: string,
  days: number = 7,
  limit: number = 20
): Promise<Deadline[]> {
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  return db.deadline.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      dueAt: {
        gte: now,
        lte: future,
      },
      status: { in: ["pending", "extended"] },
    },
    orderBy: { dueAt: "asc" },
    take: limit,
  });
}

/**
 * Get deadlines with urgency calculation
 */
export async function getDeadlinesByUrgency(
  userId: string,
  options: DeadlineUrgencyOptions = {}
): Promise<DeadlineWithUrgency[]> {
  const {
    includeOverdue = true,
    urgentDays = 1,
    approachingDays = 7,
    minUrgency,
  } = options;

  // Calculate date range
  const now = new Date();
  const approachingDate = new Date(now.getTime() + approachingDays * 24 * 60 * 60 * 1000);
  const normalDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // Determine date filter based on minUrgency
  let dateFilter: Prisma.DeadlineWhereInput = {};

  switch (minUrgency) {
    case "overdue":
      dateFilter = { dueAt: { lt: now } };
      break;
    case "urgent":
      if (!includeOverdue) {
        dateFilter = {
          dueAt: {
            gte: now,
            lte: new Date(now.getTime() + urgentDays * 24 * 60 * 60 * 1000),
          },
        };
      } else {
        dateFilter = {
          dueAt: {
            lte: new Date(now.getTime() + urgentDays * 24 * 60 * 60 * 1000),
          },
        };
      }
      break;
    case "approaching":
      if (!includeOverdue) {
        dateFilter = { dueAt: { gte: now, lte: approachingDate } };
      } else {
        dateFilter = { dueAt: { lte: approachingDate } };
      }
      break;
    case "normal":
      if (!includeOverdue) {
        dateFilter = { dueAt: { gte: now, lte: normalDate } };
      } else {
        dateFilter = { dueAt: { lte: normalDate } };
      }
      break;
    default:
      if (!includeOverdue) {
        dateFilter = { dueAt: { gte: now } };
      }
  }

  const deadlines = await db.deadline.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      status: { in: ["pending", "extended"] },
      ...dateFilter,
    },
    orderBy: { dueAt: "asc" },
  });

  // Add urgency calculation
  return deadlines.map((deadline) => ({
    ...deadline,
    ...calculateDeadlineUrgency(deadline),
  }));
}

/**
 * Get deadlines for a task
 */
export async function getDeadlinesByTask(
  userId: string,
  taskId: string
): Promise<Deadline[]> {
  return db.deadline.findMany({
    where: {
      userId,
      taskId,
      ...softDeleteFilter(),
    },
    orderBy: { dueAt: "asc" },
  });
}

/**
 * Get deadlines for an event
 */
export async function getDeadlinesByEvent(
  userId: string,
  eventId: string
): Promise<Deadline[]> {
  return db.deadline.findMany({
    where: {
      userId,
      eventId,
      ...softDeleteFilter(),
    },
    orderBy: { dueAt: "asc" },
  });
}

/**
 * Upsert deadlines from an external source
 */
export async function upsertDeadlinesFromSource(
  userId: string,
  source: Source,
  deadlines: SourceDeadlineInput[],
  context?: ServiceContext
): Promise<UpsertResult<Deadline>> {
  const created: Deadline[] = [];
  const updated: Deadline[] = [];
  let unchanged = 0;

  for (const { sourceId, data } of deadlines) {
    const existing = await findDeadlineBySource(userId, source, sourceId);

    if (existing) {
      const hasChanges =
        existing.title !== data.title ||
        existing.dueAt.getTime() !== data.dueAt.getTime() ||
        (data.status !== undefined && existing.status !== data.status);

      if (hasChanges) {
        const updatedDeadline = await updateDeadline(
          userId,
          existing.id,
          { ...data },
          context
        );
        updated.push(updatedDeadline);
      } else {
        unchanged++;
      }
    } else {
      const newDeadline = await createDeadline(
        userId,
        { ...data, source, sourceId },
        context
      );
      created.push(newDeadline);
    }
  }

  return { created, updated, unchanged };
}

// ─────────────────────────────────────────────────────────────
// Service Object (for DI / testing)
// ─────────────────────────────────────────────────────────────

export const DeadlinesService: IDeadlinesService = {
  create: createDeadline,
  getById: getDeadlineById,
  getByIdWithRelations: getDeadlineByIdWithRelations,
  update: updateDeadline,
  delete: deleteDeadline,
  restore: restoreDeadline,
  updateStatus: updateDeadlineStatus,
  complete: completeDeadline,
  markMissed: markDeadlineMissed,
  extend: extendDeadline,
  reopen: reopenDeadline,
  list: listDeadlines,
  findBySource: findDeadlineBySource,
  search: searchDeadlines,
  getOverdue: getOverdueDeadlines,
  getApproaching: getApproachingDeadlines,
  getByUrgency: getDeadlinesByUrgency,
  calculateUrgency: calculateDeadlineUrgency,
  getByTask: getDeadlinesByTask,
  getByEvent: getDeadlinesByEvent,
  upsertFromSource: upsertDeadlinesFromSource,
};

