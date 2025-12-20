// ═══════════════════════════════════════════════════════════════════════════
// People Service Types
// Person-specific types, DTOs, and interfaces
// ═══════════════════════════════════════════════════════════════════════════

import type { Person } from "@prisma/client";
import type {
  CreatePersonInput,
  UpdatePersonInput,
  ListPeopleOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Search Options
// ─────────────────────────────────────────────────────────────

/** Options for people search */
export interface SearchPeopleOptions {
  /** Maximum results to return (default: 20) */
  limit?: number;
  /** Include soft-deleted people */
  includeDeleted?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Source Person Input
// ─────────────────────────────────────────────────────────────

/** Input for upserting people from external sources */
export interface SourcePersonInput {
  /** Unique ID from the source system */
  sourceId: string;
  /** Person data */
  data: Omit<CreatePersonInput, "source" | "sourceId">;
}

/** Options for upserting people from external sources */
export interface UpsertPeopleOptions {
  /** Force update even if no changes detected (default: false) */
  forceUpdate?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

export interface IPeopleService {
  // CRUD
  create(
    userId: string,
    data: CreatePersonInput,
    context?: ServiceContext
  ): Promise<Person>;

  getById(userId: string, id: string): Promise<Person | null>;

  update(
    userId: string,
    id: string,
    data: UpdatePersonInput,
    context?: ServiceContext
  ): Promise<Person>;

  delete(userId: string, id: string, context?: ServiceContext): Promise<void>;

  restore(
    userId: string,
    id: string,
    context?: ServiceContext
  ): Promise<Person>;

  // Query
  list(
    userId: string,
    options?: ListPeopleOptions
  ): Promise<PaginatedResult<Person>>;

  findByEmail(userId: string, email: string): Promise<Person | null>;

  findBySource(
    userId: string,
    source: Source,
    sourceId: string
  ): Promise<Person | null>;

  search(
    userId: string,
    query: string,
    options?: SearchPeopleOptions
  ): Promise<Person[]>;

  // Bulk
  upsertFromSource(
    userId: string,
    source: Source,
    people: SourcePersonInput[],
    context?: ServiceContext,
    options?: UpsertPeopleOptions
  ): Promise<UpsertResult<Person>>;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/** Error codes specific to people service */
export type PeopleErrorCode =
  | "PERSON_NOT_FOUND"
  | "PERSON_ALREADY_EXISTS"
  | "INVALID_EMAIL"
  | "DUPLICATE_EMAIL"
  | "DUPLICATE_SOURCE_ID";

/** Custom error for people service operations */
export class PeopleServiceError extends Error {
  constructor(
    public readonly code: PeopleErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PeopleServiceError";
  }
}

// Re-export types from base for convenience
export type {
  Person,
  CreatePersonInput,
  UpdatePersonInput,
  ListPeopleOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
};

// Export UpsertPeopleOptions (defined in this file)
export type { UpsertPeopleOptions };
