// ═══════════════════════════════════════════════════════════════════════════
// OpenLoops Service Types
// OpenLoop-specific types, DTOs, and interfaces
// ═══════════════════════════════════════════════════════════════════════════

import type { OpenLoop } from "@prisma/client";
import type {
  CreateOpenLoopInput,
  UpdateOpenLoopInput,
  ListOpenLoopsOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  OpenLoopStatus,
  OpenLoopType,
  OpenLoopPriority,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Search Options
// ─────────────────────────────────────────────────────────────

/** Options for open loop search */
export interface SearchOpenLoopsOptions {
  /** Maximum results to return (default: 20) */
  limit?: number;
  /** Include soft-deleted open loops */
  includeDeleted?: boolean;
  /** Filter by status */
  status?: OpenLoopStatus;
}

// ─────────────────────────────────────────────────────────────
// Source OpenLoop Input
// ─────────────────────────────────────────────────────────────

/** Input for upserting open loops from external sources */
export interface SourceOpenLoopInput {
  /** Unique ID from the source system */
  sourceId: string;
  /** OpenLoop data */
  data: Omit<CreateOpenLoopInput, "source" | "sourceId">;
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

export interface IOpenLoopsService {
  // CRUD
  create(
    userId: string,
    data: CreateOpenLoopInput,
    context?: ServiceContext
  ): Promise<OpenLoop>;

  getById(userId: string, id: string): Promise<OpenLoop | null>;

  update(
    userId: string,
    id: string,
    data: UpdateOpenLoopInput,
    context?: ServiceContext
  ): Promise<OpenLoop>;

  delete(userId: string, id: string, context?: ServiceContext): Promise<void>;

  restore(userId: string, id: string, context?: ServiceContext): Promise<OpenLoop>;

  // Status transitions
  resolve(
    userId: string,
    id: string,
    resolution: string,
    context?: ServiceContext
  ): Promise<OpenLoop>;

  cancel(userId: string, id: string, context?: ServiceContext): Promise<OpenLoop>;

  markStale(userId: string, id: string, context?: ServiceContext): Promise<OpenLoop>;

  reopen(userId: string, id: string, context?: ServiceContext): Promise<OpenLoop>;

  // Query
  list(
    userId: string,
    options?: ListOpenLoopsOptions
  ): Promise<PaginatedResult<OpenLoop>>;

  findBySource(
    userId: string,
    source: Source,
    sourceId: string
  ): Promise<OpenLoop | null>;

  search(
    userId: string,
    query: string,
    options?: SearchOpenLoopsOptions
  ): Promise<OpenLoop[]>;

  // Status queries
  getOpen(userId: string, limit?: number): Promise<OpenLoop[]>;

  getOverdue(userId: string, limit?: number): Promise<OpenLoop[]>;

  getByPerson(userId: string, personId: string): Promise<OpenLoop[]>;

  // Bulk
  upsertFromSource(
    userId: string,
    source: Source,
    openLoops: SourceOpenLoopInput[],
    context?: ServiceContext
  ): Promise<UpsertResult<OpenLoop>>;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/** Error codes specific to open loops service */
export type OpenLoopsErrorCode =
  | "OPEN_LOOP_NOT_FOUND"
  | "OPEN_LOOP_ALREADY_EXISTS"
  | "DUPLICATE_SOURCE_ID"
  | "INVALID_STATUS_TRANSITION";

/** Custom error for open loops service operations */
export class OpenLoopsServiceError extends Error {
  constructor(
    public readonly code: OpenLoopsErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OpenLoopsServiceError";
  }
}

// Re-export types from base for convenience
export type {
  OpenLoop,
  CreateOpenLoopInput,
  UpdateOpenLoopInput,
  ListOpenLoopsOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  OpenLoopStatus,
  OpenLoopType,
  OpenLoopPriority,
};



