// ═══════════════════════════════════════════════════════════════════════════
// Tasks Service
// CRUD operations for Task entities with audit logging
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
  addDays,
  getStartOfDay,
  getEndOfDay,
} from "../utils";
import {
  embedTask,
  removeTaskEmbedding,
  type EmbeddingContext,
} from "../embedding-integration";
import type {
  Task,
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  TaskStatus,
  ITasksService,
  SearchTasksOptions,
  SourceTaskInput,
  TaskWithRelations,
} from "./types";
import { TasksServiceError as TasksError } from "./types";

// ─────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Validate task status transition
 */
function validateStatusTransition(
  currentStatus: string,
  newStatus: TaskStatus
): void {
  const validTransitions: Record<string, TaskStatus[]> = {
    pending: ["in_progress", "completed", "cancelled", "deferred"],
    in_progress: ["pending", "completed", "cancelled", "deferred"],
    completed: ["pending", "in_progress"], // Allow reopening
    cancelled: ["pending"], // Allow reopening
    deferred: ["pending", "in_progress"],
  };

  const allowed = validTransitions[currentStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new TasksError(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition from '${currentStatus}' to '${newStatus}'`,
      { currentStatus, newStatus }
    );
  }
}

/**
 * Check for circular reference in task hierarchy
 */
async function checkCircularReference(
  userId: string,
  taskId: string,
  newParentId: string
): Promise<boolean> {
  // If the new parent is the task itself, it's circular
  if (taskId === newParentId) {
    return true;
  }

  // Walk up the parent chain from newParentId
  let currentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      return true; // Already visited - cycle detected
    }
    if (currentId === taskId) {
      return true; // Found the task in its own ancestry
    }

    visited.add(currentId);

    const parentTask: { parentId: string | null } | null = await db.task.findFirst({
      where: { id: currentId, userId, ...softDeleteFilter() },
      select: { parentId: true },
    });

    currentId = parentTask?.parentId ?? null;
  }

  return false;
}

// ─────────────────────────────────────────────────────────────
// Tasks Service Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Create a new task
 */
export async function createTask(
  userId: string,
  data: CreateTaskInput,
  context?: ServiceContext
): Promise<Task> {
  // Verify parent task exists if provided
  if (data.parentId) {
    const parent = await db.task.findFirst({
      where: { id: data.parentId, userId, ...softDeleteFilter() },
    });
    if (!parent) {
      throw new TasksError("TASK_NOT_FOUND", `Parent task not found: ${data.parentId}`);
    }
  }

  // Verify assigned person exists if provided
  if (data.assignedToId) {
    const person = await db.person.findFirst({
      where: { id: data.assignedToId, userId, ...softDeleteFilter() },
    });
    if (!person) {
      throw new TasksError("PERSON_NOT_FOUND", `Person not found: ${data.assignedToId}`);
    }
  }

  // Normalize tags
  const normalizedTags = data.tags ? normalizeTags(data.tags) : [];

  // Get next position if parent provided
  let position = data.position ?? 0;
  if (data.parentId && data.position === undefined) {
    const lastSibling = await db.task.findFirst({
      where: { parentId: data.parentId, userId, ...softDeleteFilter() },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    position = (lastSibling?.position ?? -1) + 1;
  }

  try {
    const task = await db.task.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        parentId: data.parentId,
        position,
        status: data.status ?? "pending",
        priority: data.priority ?? "medium",
        dueDate: data.dueDate,
        startDate: data.startDate,
        estimatedMinutes: data.estimatedMinutes,
        notes: data.notes,
        assignedToId: data.assignedToId,
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
      entityType: "task",
      entityId: task.id,
      entitySnapshot: task as unknown as Prisma.InputJsonValue,
      outputSummary: `Created task: ${task.title}`,
    });

    // Generate embedding (fire-and-forget, errors don't fail the operation)
    void embedTask(task, context as EmbeddingContext);

    return task;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new TasksError(
          "DUPLICATE_SOURCE_ID",
          `A task from ${data.source} with ID ${data.sourceId} already exists`,
          { source: data.source, sourceId: data.sourceId }
        );
      }
    }
    throw error;
  }
}

/**
 * Get a task by ID
 */
export async function getTaskById(
  userId: string,
  id: string
): Promise<Task | null> {
  return db.task.findFirst({
    where: {
      id,
      userId,
      ...softDeleteFilter(),
    },
  });
}

/**
 * Get a task by ID with relations
 */
export async function getTaskByIdWithRelations(
  userId: string,
  id: string
): Promise<TaskWithRelations | null> {
  return db.task.findFirst({
    where: {
      id,
      userId,
      ...softDeleteFilter(),
    },
    include: {
      parent: true,
      subtasks: {
        where: softDeleteFilter(),
        orderBy: { position: "asc" },
      },
      assignedTo: true,
    },
  });
}

/**
 * Update a task
 */
export async function updateTask(
  userId: string,
  id: string,
  data: UpdateTaskInput,
  context?: ServiceContext
): Promise<Task> {
  const existing = await db.task.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new TasksError("TASK_NOT_FOUND", `Task not found: ${id}`);
  }

  // Verify parent task if being changed
  if (data.parentId !== undefined && data.parentId !== null) {
    const parent = await db.task.findFirst({
      where: { id: data.parentId, userId, ...softDeleteFilter() },
    });
    if (!parent) {
      throw new TasksError("TASK_NOT_FOUND", `Parent task not found: ${data.parentId}`);
    }

    // Check for circular reference
    if (await checkCircularReference(userId, id, data.parentId)) {
      throw new TasksError(
        "CIRCULAR_REFERENCE",
        "Cannot set parent: would create circular reference",
        { taskId: id, parentId: data.parentId }
      );
    }
  }

  // Verify assigned person if being changed
  if (data.assignedToId !== undefined && data.assignedToId !== null) {
    const person = await db.person.findFirst({
      where: { id: data.assignedToId, userId, ...softDeleteFilter() },
    });
    if (!person) {
      throw new TasksError("PERSON_NOT_FOUND", `Person not found: ${data.assignedToId}`);
    }
  }

  // Normalize tags if provided
  const normalizedTags = data.tags ? normalizeTags(data.tags) : undefined;

  // Auto-set completedAt when status changes to completed
  let completedAt = data.completedAt;
  if (data.status === "completed" && existing.status !== "completed" && !completedAt) {
    completedAt = new Date();
  } else if (data.status && data.status !== "completed" && existing.completedAt) {
    completedAt = undefined; // Clear completedAt when reopening
  }

  try {
    const task = await db.task.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.parentId !== undefined && { parentId: data.parentId }),
        ...(data.position !== undefined && { position: data.position }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.priority !== undefined && { priority: data.priority }),
        ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
        ...(data.startDate !== undefined && { startDate: data.startDate }),
        ...(completedAt !== undefined && { completedAt }),
        ...(data.estimatedMinutes !== undefined && { estimatedMinutes: data.estimatedMinutes }),
        ...(data.actualMinutes !== undefined && { actualMinutes: data.actualMinutes }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId }),
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
      entityType: "task",
      entityId: task.id,
      entitySnapshot: task as unknown as Prisma.InputJsonValue,
      outputSummary: `Updated task: ${task.title}`,
    });

    // Update embedding (fire-and-forget, errors don't fail the operation)
    void embedTask(task, context as EmbeddingContext);

    return task;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new TasksError("DUPLICATE_SOURCE_ID", `A task with this source ID already exists`);
      }
    }
    throw error;
  }
}

/**
 * Update task status with validation
 */
export async function updateTaskStatus(
  userId: string,
  id: string,
  status: TaskStatus,
  context?: ServiceContext
): Promise<Task> {
  const existing = await db.task.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new TasksError("TASK_NOT_FOUND", `Task not found: ${id}`);
  }

  validateStatusTransition(existing.status, status);

  return updateTask(userId, id, { status }, context);
}

/**
 * Complete a task
 */
export async function completeTask(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Task> {
  return updateTaskStatus(userId, id, "completed", context);
}

/**
 * Start a task (set to in_progress)
 */
export async function startTask(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Task> {
  return updateTaskStatus(userId, id, "in_progress", context);
}

/**
 * Defer a task
 */
export async function deferTask(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Task> {
  return updateTaskStatus(userId, id, "deferred", context);
}

/**
 * Cancel a task
 */
export async function cancelTask(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Task> {
  return updateTaskStatus(userId, id, "cancelled", context);
}

/**
 * Reopen a completed or cancelled task
 */
export async function reopenTask(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Task> {
  return updateTaskStatus(userId, id, "pending", context);
}

/**
 * Get subtasks of a task
 */
export async function getSubtasks(
  userId: string,
  parentId: string
): Promise<Task[]> {
  return db.task.findMany({
    where: {
      userId,
      parentId,
      ...softDeleteFilter(),
    },
    orderBy: { position: "asc" },
  });
}

/**
 * Set or change a task's parent
 */
export async function setTaskParent(
  userId: string,
  id: string,
  parentId: string | null,
  context?: ServiceContext
): Promise<Task> {
  if (parentId) {
    // Check circular reference
    if (await checkCircularReference(userId, id, parentId)) {
      throw new TasksError(
        "CIRCULAR_REFERENCE",
        "Cannot set parent: would create circular reference",
        { taskId: id, parentId }
      );
    }
  }

  return updateTask(userId, id, { parentId }, context);
}

/**
 * Reorder a task within its siblings
 */
export async function reorderTask(
  userId: string,
  id: string,
  newPosition: number,
  context?: ServiceContext
): Promise<Task> {
  const task = await db.task.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!task) {
    throw new TasksError("TASK_NOT_FOUND", `Task not found: ${id}`);
  }

  const oldPosition = task.position;

  // Get siblings
  const siblings = await db.task.findMany({
    where: {
      userId,
      parentId: task.parentId,
      id: { not: id },
      ...softDeleteFilter(),
    },
    orderBy: { position: "asc" },
  });

  // Reposition siblings as needed
  if (newPosition < oldPosition) {
    // Moving up: shift tasks between new and old position down
    for (const sibling of siblings) {
      if (sibling.position >= newPosition && sibling.position < oldPosition) {
        await db.task.update({
          where: { id: sibling.id },
          data: { position: sibling.position + 1 },
        });
      }
    }
  } else if (newPosition > oldPosition) {
    // Moving down: shift tasks between old and new position up
    for (const sibling of siblings) {
      if (sibling.position > oldPosition && sibling.position <= newPosition) {
        await db.task.update({
          where: { id: sibling.id },
          data: { position: sibling.position - 1 },
        });
      }
    }
  }

  return updateTask(userId, id, { position: newPosition }, context);
}

/**
 * Soft delete a task
 */
export async function deleteTask(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<void> {
  const existing = await db.task.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new TasksError("TASK_NOT_FOUND", `Task not found: ${id}`);
  }

  await db.task.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "delete",
    actionCategory: "context",
    entityType: "task",
    entityId: id,
    outputSummary: `Deleted task: ${existing.title}`,
  });

  // Remove embedding (fire-and-forget, errors don't fail the operation)
  void removeTaskEmbedding(userId, id, context as EmbeddingContext);
}

/**
 * Restore a soft-deleted task
 */
export async function restoreTask(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Task> {
  const existing = await db.task.findFirst({
    where: {
      id,
      userId,
      deletedAt: { not: null },
    },
  });

  if (!existing) {
    throw new TasksError("TASK_NOT_FOUND", `Deleted task not found: ${id}`);
  }

  const task = await db.task.update({
    where: { id },
    data: { deletedAt: null },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "update",
    actionCategory: "context",
    entityType: "task",
    entityId: task.id,
    outputSummary: `Restored task: ${task.title}`,
  });

  return task;
}

/**
 * List tasks with filtering and pagination
 */
export async function listTasks(
  userId: string,
  options: ListTasksOptions = {}
): Promise<PaginatedResult<Task>> {
  const pagination = normalizePagination(options);
  const orderBy = buildOrderBy(options.sortBy ?? "createdAt", options.sortOrder ?? "desc");

  // Handle parentId filter (null means top-level tasks)
  const parentIdFilter = options.parentId === null
    ? { parentId: null }
    : options.parentId
      ? { parentId: options.parentId }
      : options.includeSubtasks === false
        ? { parentId: null }
        : {};

  const where: Prisma.TaskWhereInput = {
    userId,
    ...softDeleteFilter(options.includeDeleted),
    ...parentIdFilter,
    ...(options.status && { status: options.status }),
    ...(options.priority && { priority: options.priority }),
    ...(options.assignedToId && { assignedToId: options.assignedToId }),
    ...(options.dueBefore && { dueDate: { lte: options.dueBefore } }),
    ...(options.dueAfter && { dueDate: { gte: options.dueAfter } }),
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

  const tasks = await db.task.findMany({
    where,
    orderBy,
    ...pagination,
  });

  return processPaginatedResults(tasks, options.limit ?? 20);
}

/**
 * Find a task by source and sourceId
 */
export async function findTaskBySource(
  userId: string,
  source: Source,
  sourceId: string
): Promise<Task | null> {
  return db.task.findFirst({
    where: {
      userId,
      source,
      sourceId,
      ...softDeleteFilter(),
    },
  });
}

/**
 * Search tasks
 */
export async function searchTasks(
  userId: string,
  query: string,
  options: SearchTasksOptions = {}
): Promise<Task[]> {
  const limit = options.limit ?? 20;

  return db.task.findMany({
    where: {
      userId,
      ...softDeleteFilter(options.includeDeleted),
      ...(options.includeSubtasks === false && { parentId: null }),
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { notes: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: [
      { priority: "desc" },
      { dueDate: "asc" },
    ],
    take: limit,
  });
}

/**
 * Get overdue tasks
 */
export async function getOverdueTasks(
  userId: string,
  limit: number = 20
): Promise<Task[]> {
  return db.task.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      dueDate: { lt: new Date() },
      status: { notIn: ["completed", "cancelled"] },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
  });
}

/**
 * Get tasks due soon (within N days)
 * Uses Luxon for accurate day calculations (DST-safe)
 */
export async function getTasksDueSoon(
  userId: string,
  days: number = 7,
  limit: number = 20
): Promise<Task[]> {
  const now = new Date();
  const future = addDays(now, days);

  return db.task.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      dueDate: {
        gte: now,
        lte: future,
      },
      status: { notIn: ["completed", "cancelled"] },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
  });
}

/**
 * Get tasks due on a specific date
 * Uses Luxon for accurate day boundaries (timezone-aware)
 */
export async function getTasksDueOnDate(
  userId: string,
  date: Date
): Promise<Task[]> {
  const startOfDayDate = getStartOfDay(date);
  const endOfDayDate = getEndOfDay(date);

  return db.task.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      dueDate: {
        gte: startOfDayDate,
        lte: endOfDayDate,
      },
    },
    orderBy: { priority: "desc" },
  });
}

/**
 * Get tasks assigned to a specific person
 */
export async function getTasksAssignedTo(
  userId: string,
  personId: string
): Promise<Task[]> {
  return db.task.findMany({
    where: {
      userId,
      assignedToId: personId,
      ...softDeleteFilter(),
    },
    orderBy: [
      { status: "asc" },
      { dueDate: "asc" },
    ],
  });
}

/**
 * Upsert tasks from an external source
 */
export async function upsertTasksFromSource(
  userId: string,
  source: Source,
  tasks: SourceTaskInput[],
  context?: ServiceContext
): Promise<UpsertResult<Task>> {
  const created: Task[] = [];
  const updated: Task[] = [];
  let unchanged = 0;

  for (const { sourceId, data } of tasks) {
    const existing = await findTaskBySource(userId, source, sourceId);

    if (existing) {
      const hasChanges =
        existing.title !== data.title ||
        (data.description !== undefined && existing.description !== data.description) ||
        (data.status !== undefined && existing.status !== data.status) ||
        (data.dueDate !== undefined && existing.dueDate?.getTime() !== data.dueDate?.getTime());

      if (hasChanges) {
        const updatedTask = await updateTask(
          userId,
          existing.id,
          { ...data },
          context
        );
        updated.push(updatedTask);
      } else {
        unchanged++;
      }
    } else {
      const newTask = await createTask(
        userId,
        { ...data, source, sourceId },
        context
      );
      created.push(newTask);
    }
  }

  return { created, updated, unchanged };
}

// ─────────────────────────────────────────────────────────────
// Service Object (for DI / testing)
// ─────────────────────────────────────────────────────────────

export const TasksService: ITasksService = {
  create: createTask,
  getById: getTaskById,
  getByIdWithRelations: getTaskByIdWithRelations,
  update: updateTask,
  delete: deleteTask,
  restore: restoreTask,
  updateStatus: updateTaskStatus,
  complete: completeTask,
  start: startTask,
  defer: deferTask,
  cancel: cancelTask,
  reopen: reopenTask,
  getSubtasks,
  setParent: setTaskParent,
  reorder: reorderTask,
  list: listTasks,
  findBySource: findTaskBySource,
  search: searchTasks,
  getOverdue: getOverdueTasks,
  getDueSoon: getTasksDueSoon,
  getDueOnDate: getTasksDueOnDate,
  getAssignedTo: getTasksAssignedTo,
  upsertFromSource: upsertTasksFromSource,
};

