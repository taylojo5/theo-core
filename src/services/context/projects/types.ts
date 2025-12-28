// ═══════════════════════════════════════════════════════════════════════════
// Projects Service Types
// Project-specific types, DTOs, and interfaces
// ═══════════════════════════════════════════════════════════════════════════

import type { Project } from "@prisma/client";
import type {
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  ProjectStatus,
  ProjectType,
  ProjectPriority,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Search Options
// ─────────────────────────────────────────────────────────────

/** Options for project search */
export interface SearchProjectsOptions {
  /** Maximum results to return (default: 20) */
  limit?: number;
  /** Include soft-deleted projects */
  includeDeleted?: boolean;
  /** Include child projects in search */
  includeChildren?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Source Project Input
// ─────────────────────────────────────────────────────────────

/** Input for upserting projects from external sources */
export interface SourceProjectInput {
  /** Unique ID from the source system */
  sourceId: string;
  /** Project data */
  data: Omit<CreateProjectInput, "source" | "sourceId">;
}

// ─────────────────────────────────────────────────────────────
// Project with Relations
// ─────────────────────────────────────────────────────────────

/** Project with optional relations */
export interface ProjectWithRelations extends Project {
  parent?: Project | null;
  children?: Project[];
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

export interface IProjectsService {
  // CRUD
  create(
    userId: string,
    data: CreateProjectInput,
    context?: ServiceContext
  ): Promise<Project>;

  getById(userId: string, id: string): Promise<Project | null>;

  getByIdWithRelations(userId: string, id: string): Promise<ProjectWithRelations | null>;

  update(
    userId: string,
    id: string,
    data: UpdateProjectInput,
    context?: ServiceContext
  ): Promise<Project>;

  delete(userId: string, id: string, context?: ServiceContext): Promise<void>;

  restore(userId: string, id: string, context?: ServiceContext): Promise<Project>;

  // Status transitions
  start(userId: string, id: string, context?: ServiceContext): Promise<Project>;

  complete(userId: string, id: string, context?: ServiceContext): Promise<Project>;

  cancel(userId: string, id: string, context?: ServiceContext): Promise<Project>;

  putOnHold(userId: string, id: string, context?: ServiceContext): Promise<Project>;

  archive(userId: string, id: string, context?: ServiceContext): Promise<Project>;

  // Hierarchy
  getChildren(userId: string, parentId: string): Promise<Project[]>;

  setParent(
    userId: string,
    id: string,
    parentId: string | null,
    context?: ServiceContext
  ): Promise<Project>;

  // Query
  list(
    userId: string,
    options?: ListProjectsOptions
  ): Promise<PaginatedResult<Project>>;

  findBySource(
    userId: string,
    source: Source,
    sourceId: string
  ): Promise<Project | null>;

  search(
    userId: string,
    query: string,
    options?: SearchProjectsOptions
  ): Promise<Project[]>;

  // Status queries
  getActive(userId: string, limit?: number): Promise<Project[]>;

  getOverdue(userId: string, limit?: number): Promise<Project[]>;

  // Bulk
  upsertFromSource(
    userId: string,
    source: Source,
    projects: SourceProjectInput[],
    context?: ServiceContext
  ): Promise<UpsertResult<Project>>;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/** Error codes specific to projects service */
export type ProjectsErrorCode =
  | "PROJECT_NOT_FOUND"
  | "PROJECT_ALREADY_EXISTS"
  | "DUPLICATE_SOURCE_ID"
  | "INVALID_STATUS_TRANSITION"
  | "INVALID_HIERARCHY"
  | "CIRCULAR_REFERENCE";

/** Custom error for projects service operations */
export class ProjectsServiceError extends Error {
  constructor(
    public readonly code: ProjectsErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ProjectsServiceError";
  }
}

// Re-export types from base for convenience
export type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  ProjectStatus,
  ProjectType,
  ProjectPriority,
};


