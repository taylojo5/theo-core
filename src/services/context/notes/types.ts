// ═══════════════════════════════════════════════════════════════════════════
// Notes Service Types
// Note-specific types, DTOs, and interfaces
// ═══════════════════════════════════════════════════════════════════════════

import type { Note } from "@prisma/client";
import type {
  CreateNoteInput,
  UpdateNoteInput,
  ListNotesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  NoteType,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Search Options
// ─────────────────────────────────────────────────────────────

/** Options for note search */
export interface SearchNotesOptions {
  /** Maximum results to return (default: 20) */
  limit?: number;
  /** Include soft-deleted notes */
  includeDeleted?: boolean;
  /** Search in content as well as title */
  searchContent?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Source Note Input
// ─────────────────────────────────────────────────────────────

/** Input for upserting notes from external sources */
export interface SourceNoteInput {
  /** Unique ID from the source system */
  sourceId: string;
  /** Note data */
  data: Omit<CreateNoteInput, "source" | "sourceId">;
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

export interface INotesService {
  // CRUD
  create(
    userId: string,
    data: CreateNoteInput,
    context?: ServiceContext
  ): Promise<Note>;

  getById(userId: string, id: string): Promise<Note | null>;

  update(
    userId: string,
    id: string,
    data: UpdateNoteInput,
    context?: ServiceContext
  ): Promise<Note>;

  delete(userId: string, id: string, context?: ServiceContext): Promise<void>;

  restore(userId: string, id: string, context?: ServiceContext): Promise<Note>;

  // Organization
  pin(userId: string, id: string, context?: ServiceContext): Promise<Note>;

  unpin(userId: string, id: string, context?: ServiceContext): Promise<Note>;

  favorite(userId: string, id: string, context?: ServiceContext): Promise<Note>;

  unfavorite(userId: string, id: string, context?: ServiceContext): Promise<Note>;

  // Query
  list(
    userId: string,
    options?: ListNotesOptions
  ): Promise<PaginatedResult<Note>>;

  findBySource(
    userId: string,
    source: Source,
    sourceId: string
  ): Promise<Note | null>;

  search(
    userId: string,
    query: string,
    options?: SearchNotesOptions
  ): Promise<Note[]>;

  // Special queries
  getPinned(userId: string, limit?: number): Promise<Note[]>;

  getFavorites(userId: string, limit?: number): Promise<Note[]>;

  getRecent(userId: string, limit?: number): Promise<Note[]>;

  getByCategory(userId: string, category: string): Promise<Note[]>;

  // Bulk
  upsertFromSource(
    userId: string,
    source: Source,
    notes: SourceNoteInput[],
    context?: ServiceContext
  ): Promise<UpsertResult<Note>>;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/** Error codes specific to notes service */
export type NotesErrorCode =
  | "NOTE_NOT_FOUND"
  | "NOTE_ALREADY_EXISTS"
  | "DUPLICATE_SOURCE_ID"
  | "CONTENT_REQUIRED";

/** Custom error for notes service operations */
export class NotesServiceError extends Error {
  constructor(
    public readonly code: NotesErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "NotesServiceError";
  }
}

// Re-export types from base for convenience
export type {
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  ListNotesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  NoteType,
};



