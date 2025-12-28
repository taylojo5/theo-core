// ═══════════════════════════════════════════════════════════════════════════
// Projects Service
// CRUD operations for Project entities with audit logging
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
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  IProjectsService,
  SearchProjectsOptions,
  SourceProjectInput,
  ProjectWithRelations,
} from "./types";
import { ProjectsServiceError as ProjectsError } from "./types";

// ─────────────────────────────────────────────────────────────
// Projects Service Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Create a new project
 */
export async function createProject(
  userId: string,
  data: CreateProjectInput,
  context?: ServiceContext
): Promise<Project> {
  const normalizedTags = data.tags ? normalizeTags(data.tags) : [];
  const importance =
    data.importance !== undefined ? validateImportance(data.importance) : 5;

  // Validate parent if provided
  if (data.parentId) {
    const parent = await db.project.findFirst({
      where: { id: data.parentId, userId, ...softDeleteFilter() },
    });
    if (!parent) {
      throw new ProjectsError(
        "INVALID_HIERARCHY",
        `Parent project not found: ${data.parentId}`
      );
    }
  }

  try {
    const project = await db.project.create({
      data: {
        userId,
        name: data.name,
        description: data.description,
        type: data.type ?? "project",
        parentId: data.parentId,
        position: data.position ?? 0,
        status: data.status ?? "active",
        priority: data.priority ?? "medium",
        importance,
        targetDate: data.targetDate,
        dueDate: data.dueDate,
        estimatedDays: data.estimatedDays,
        notes: data.notes,
        objective: data.objective,
        color: data.color,
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
      entityType: "project",
      entityId: project.id,
      entitySnapshot: project as unknown as Prisma.InputJsonValue,
      outputSummary: `Created project: ${project.name}`,
    });

    return project;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new ProjectsError(
          "DUPLICATE_SOURCE_ID",
          `A project from ${data.source} with ID ${data.sourceId} already exists`,
          { source: data.source, sourceId: data.sourceId }
        );
      }
    }
    throw error;
  }
}

/**
 * Get a project by ID
 */
export async function getProjectById(
  userId: string,
  id: string
): Promise<Project | null> {
  return db.project.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });
}

/**
 * Get a project by ID with relations
 */
export async function getProjectByIdWithRelations(
  userId: string,
  id: string
): Promise<ProjectWithRelations | null> {
  return db.project.findFirst({
    where: { id, userId, ...softDeleteFilter() },
    include: {
      parent: true,
      children: {
        where: softDeleteFilter(),
        orderBy: { position: "asc" },
      },
    },
  });
}

/**
 * Update a project
 */
export async function updateProject(
  userId: string,
  id: string,
  data: UpdateProjectInput,
  context?: ServiceContext
): Promise<Project> {
  const existing = await db.project.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new ProjectsError("PROJECT_NOT_FOUND", `Project not found: ${id}`);
  }

  // Validate parent if being changed
  if (data.parentId !== undefined && data.parentId !== null) {
    if (data.parentId === id) {
      throw new ProjectsError(
        "CIRCULAR_REFERENCE",
        "A project cannot be its own parent"
      );
    }
    const parent = await db.project.findFirst({
      where: { id: data.parentId, userId, ...softDeleteFilter() },
    });
    if (!parent) {
      throw new ProjectsError(
        "INVALID_HIERARCHY",
        `Parent project not found: ${data.parentId}`
      );
    }
  }

  const normalizedTags = data.tags ? normalizeTags(data.tags) : undefined;
  const importance =
    data.importance !== undefined ? validateImportance(data.importance) : undefined;

  const project = await db.project.update({
    where: { id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.parentId !== undefined && { parentId: data.parentId }),
      ...(data.position !== undefined && { position: data.position }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.progress !== undefined && { progress: data.progress }),
      ...(data.startedAt !== undefined && { startedAt: data.startedAt }),
      ...(data.completedAt !== undefined && { completedAt: data.completedAt }),
      ...(data.priority !== undefined && { priority: data.priority }),
      ...(importance !== undefined && { importance }),
      ...(data.targetDate !== undefined && { targetDate: data.targetDate }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate }),
      ...(data.estimatedDays !== undefined && { estimatedDays: data.estimatedDays }),
      ...(data.taskCount !== undefined && { taskCount: data.taskCount }),
      ...(data.completedTaskCount !== undefined && {
        completedTaskCount: data.completedTaskCount,
      }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.objective !== undefined && { objective: data.objective }),
      ...(data.color !== undefined && { color: data.color }),
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
    entityType: "project",
    entityId: project.id,
    entitySnapshot: project as unknown as Prisma.InputJsonValue,
    outputSummary: `Updated project: ${project.name}`,
  });

  return project;
}

/**
 * Soft delete a project
 */
export async function deleteProject(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<void> {
  const existing = await db.project.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new ProjectsError("PROJECT_NOT_FOUND", `Project not found: ${id}`);
  }

  await db.project.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "delete",
    actionCategory: "context",
    entityType: "project",
    entityId: id,
    outputSummary: `Deleted project: ${existing.name}`,
  });
}

/**
 * Restore a soft-deleted project
 */
export async function restoreProject(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Project> {
  const existing = await db.project.findFirst({
    where: { id, userId, deletedAt: { not: null } },
  });

  if (!existing) {
    throw new ProjectsError(
      "PROJECT_NOT_FOUND",
      `Deleted project not found: ${id}`
    );
  }

  const project = await db.project.update({
    where: { id },
    data: { deletedAt: null },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "update",
    actionCategory: "context",
    entityType: "project",
    entityId: id,
    outputSummary: `Restored project: ${project.name}`,
  });

  return project;
}

/**
 * Start a project
 */
export async function startProject(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Project> {
  return updateProject(
    userId,
    id,
    { status: "active", startedAt: new Date() },
    context
  );
}

/**
 * Complete a project
 */
export async function completeProject(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Project> {
  return updateProject(
    userId,
    id,
    { status: "completed", completedAt: new Date(), progress: 100 },
    context
  );
}

/**
 * Cancel a project
 */
export async function cancelProject(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Project> {
  return updateProject(userId, id, { status: "cancelled" }, context);
}

/**
 * Put a project on hold
 */
export async function putProjectOnHold(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Project> {
  return updateProject(userId, id, { status: "on_hold" }, context);
}

/**
 * Archive a project
 */
export async function archiveProject(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Project> {
  return updateProject(userId, id, { status: "archived" }, context);
}

/**
 * Get children of a project
 */
export async function getProjectChildren(
  userId: string,
  parentId: string
): Promise<Project[]> {
  return db.project.findMany({
    where: { userId, parentId, ...softDeleteFilter() },
    orderBy: { position: "asc" },
  });
}

/**
 * Set project parent
 */
export async function setProjectParent(
  userId: string,
  id: string,
  parentId: string | null,
  context?: ServiceContext
): Promise<Project> {
  return updateProject(userId, id, { parentId }, context);
}

/**
 * List projects with filtering and pagination
 */
export async function listProjects(
  userId: string,
  options: ListProjectsOptions = {}
): Promise<PaginatedResult<Project>> {
  const pagination = normalizePagination(options);
  const orderBy = buildOrderBy(options.sortBy ?? "createdAt", options.sortOrder ?? "desc");

  const where: Prisma.ProjectWhereInput = {
    userId,
    ...softDeleteFilter(options.includeDeleted),
    ...(options.type && { type: options.type }),
    ...(options.status && { status: options.status }),
    ...(options.priority && { priority: options.priority }),
    ...(options.parentId !== undefined && { parentId: options.parentId }),
    ...(options.dueBefore && { dueDate: { lte: options.dueBefore } }),
    ...(options.dueAfter && { dueDate: { gte: options.dueAfter } }),
    ...(options.source && { source: options.source }),
    ...(options.tags?.length && { tags: { hasSome: options.tags } }),
    ...(options.search && {
      OR: [
        { name: { contains: options.search, mode: "insensitive" as const } },
        { description: { contains: options.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const projects = await db.project.findMany({
    where,
    orderBy,
    ...pagination,
    ...(options.includeChildren && {
      include: {
        children: {
          where: softDeleteFilter(),
          orderBy: { position: "asc" },
        },
      },
    }),
  });

  return processPaginatedResults(projects, options.limit ?? 20);
}

/**
 * Find a project by source
 */
export async function findProjectBySource(
  userId: string,
  source: Source,
  sourceId: string
): Promise<Project | null> {
  return db.project.findFirst({
    where: { userId, source, sourceId, ...softDeleteFilter() },
  });
}

/**
 * Search projects by name/description
 */
export async function searchProjects(
  userId: string,
  query: string,
  options: SearchProjectsOptions = {}
): Promise<Project[]> {
  const limit = options.limit ?? 20;

  return db.project.findMany({
    where: {
      userId,
      ...(options.includeDeleted ? {} : softDeleteFilter()),
      ...(options.includeChildren === false && { parentId: null }),
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { objective: { contains: query, mode: "insensitive" } },
        { tags: { hasSome: [query.toLowerCase()] } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

/**
 * Get active projects
 */
export async function getActiveProjects(
  userId: string,
  limit: number = 50
): Promise<Project[]> {
  return db.project.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      status: "active",
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
    take: limit,
  });
}

/**
 * Get overdue projects
 */
export async function getOverdueProjects(
  userId: string,
  limit: number = 20
): Promise<Project[]> {
  const now = new Date();

  return db.project.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      status: { in: ["active", "planning"] },
      dueDate: { lt: now },
    },
    orderBy: { dueDate: "asc" },
    take: limit,
  });
}

/**
 * Upsert projects from external source
 */
export async function upsertProjectsFromSource(
  userId: string,
  source: Source,
  projects: SourceProjectInput[],
  context?: ServiceContext
): Promise<UpsertResult<Project>> {
  const created: Project[] = [];
  const updated: Project[] = [];
  let unchanged = 0;

  for (const input of projects) {
    const existing = await findProjectBySource(userId, source, input.sourceId);

    if (existing) {
      if (existing.name !== input.data.name) {
        const updatedProject = await updateProject(
          userId,
          existing.id,
          { ...input.data } as UpdateProjectInput,
          context
        );
        updated.push(updatedProject);
      } else {
        unchanged++;
      }
    } else {
      const newProject = await createProject(
        userId,
        { ...input.data, source, sourceId: input.sourceId },
        context
      );
      created.push(newProject);
    }
  }

  return { created, updated, unchanged };
}

// ─────────────────────────────────────────────────────────────
// Service Object
// ─────────────────────────────────────────────────────────────

export const ProjectsService: IProjectsService = {
  create: createProject,
  getById: getProjectById,
  getByIdWithRelations: getProjectByIdWithRelations,
  update: updateProject,
  delete: deleteProject,
  restore: restoreProject,
  start: startProject,
  complete: completeProject,
  cancel: cancelProject,
  putOnHold: putProjectOnHold,
  archive: archiveProject,
  getChildren: getProjectChildren,
  setParent: setProjectParent,
  list: listProjects,
  findBySource: findProjectBySource,
  search: searchProjects,
  getActive: getActiveProjects,
  getOverdue: getOverdueProjects,
  upsertFromSource: upsertProjectsFromSource,
};

