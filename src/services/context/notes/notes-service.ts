// ═══════════════════════════════════════════════════════════════════════════
// Notes Service
// CRUD operations for Note entities with audit logging
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
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  ListNotesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  INotesService,
  SearchNotesOptions,
  SourceNoteInput,
} from "./types";
import { NotesServiceError as NotesError } from "./types";

// ─────────────────────────────────────────────────────────────
// Notes Service Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Count words in content
 */
function countWords(content: string): number {
  return content
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Create a new note
 */
export async function createNote(
  userId: string,
  data: CreateNoteInput,
  context?: ServiceContext
): Promise<Note> {
  if (!data.content || data.content.trim().length === 0) {
    throw new NotesError("CONTENT_REQUIRED", "Note content is required");
  }

  const normalizedTags = data.tags ? normalizeTags(data.tags) : [];
  const importance =
    data.importance !== undefined ? validateImportance(data.importance) : 5;
  const wordCount = countWords(data.content);

  try {
    const note = await db.note.create({
      data: {
        userId,
        title: data.title,
        content: data.content,
        type: data.type ?? "note",
        folderId: data.folderId,
        isPinned: data.isPinned ?? false,
        isFavorite: data.isFavorite ?? false,
        importance,
        category: data.category,
        relatedPersonIds: data.relatedPersonIds ?? [],
        relatedTaskIds: data.relatedTaskIds ?? [],
        relatedEventIds: data.relatedEventIds ?? [],
        relatedProjectIds: data.relatedProjectIds ?? [],
        source: data.source,
        sourceId: data.sourceId,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? {},
        tags: normalizedTags,
        wordCount,
      },
    });

    await logAuditEntry({
      userId: context?.userId ?? userId,
      sessionId: context?.sessionId,
      conversationId: context?.conversationId,
      actionType: "create",
      actionCategory: "context",
      entityType: "note",
      entityId: note.id,
      entitySnapshot: note as unknown as Prisma.InputJsonValue,
      outputSummary: `Created note: ${note.title ?? "Untitled"}`,
    });

    return note;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new NotesError(
          "DUPLICATE_SOURCE_ID",
          `A note from ${data.source} with ID ${data.sourceId} already exists`,
          { source: data.source, sourceId: data.sourceId }
        );
      }
    }
    throw error;
  }
}

/**
 * Get a note by ID
 */
export async function getNoteById(
  userId: string,
  id: string
): Promise<Note | null> {
  return db.note.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });
}

/**
 * Update a note
 */
export async function updateNote(
  userId: string,
  id: string,
  data: UpdateNoteInput,
  context?: ServiceContext
): Promise<Note> {
  const existing = await db.note.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new NotesError("NOTE_NOT_FOUND", `Note not found: ${id}`);
  }

  const normalizedTags = data.tags ? normalizeTags(data.tags) : undefined;
  const importance =
    data.importance !== undefined ? validateImportance(data.importance) : undefined;
  const wordCount = data.content ? countWords(data.content) : undefined;

  const note = await db.note.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.type !== undefined && { type: data.type }),
      ...(data.folderId !== undefined && { folderId: data.folderId }),
      ...(data.isPinned !== undefined && { isPinned: data.isPinned }),
      ...(data.isFavorite !== undefined && { isFavorite: data.isFavorite }),
      ...(importance !== undefined && { importance }),
      ...(data.category !== undefined && { category: data.category }),
      ...(data.relatedPersonIds !== undefined && {
        relatedPersonIds: data.relatedPersonIds,
      }),
      ...(data.relatedTaskIds !== undefined && {
        relatedTaskIds: data.relatedTaskIds,
      }),
      ...(data.relatedEventIds !== undefined && {
        relatedEventIds: data.relatedEventIds,
      }),
      ...(data.relatedProjectIds !== undefined && {
        relatedProjectIds: data.relatedProjectIds,
      }),
      ...(wordCount !== undefined && { wordCount }),
      ...(data.lastViewedAt !== undefined && { lastViewedAt: data.lastViewedAt }),
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
    entityType: "note",
    entityId: note.id,
    entitySnapshot: note as unknown as Prisma.InputJsonValue,
    outputSummary: `Updated note: ${note.title ?? "Untitled"}`,
  });

  return note;
}

/**
 * Soft delete a note
 */
export async function deleteNote(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<void> {
  const existing = await db.note.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new NotesError("NOTE_NOT_FOUND", `Note not found: ${id}`);
  }

  await db.note.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "delete",
    actionCategory: "context",
    entityType: "note",
    entityId: id,
    outputSummary: `Deleted note: ${existing.title ?? "Untitled"}`,
  });
}

/**
 * Restore a soft-deleted note
 */
export async function restoreNote(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Note> {
  const existing = await db.note.findFirst({
    where: { id, userId, deletedAt: { not: null } },
  });

  if (!existing) {
    throw new NotesError("NOTE_NOT_FOUND", `Deleted note not found: ${id}`);
  }

  const note = await db.note.update({
    where: { id },
    data: { deletedAt: null },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "update",
    actionCategory: "context",
    entityType: "note",
    entityId: id,
    outputSummary: `Restored note: ${note.title ?? "Untitled"}`,
  });

  return note;
}

/**
 * Pin a note
 */
export async function pinNote(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Note> {
  return updateNote(userId, id, { isPinned: true }, context);
}

/**
 * Unpin a note
 */
export async function unpinNote(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Note> {
  return updateNote(userId, id, { isPinned: false }, context);
}

/**
 * Favorite a note
 */
export async function favoriteNote(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Note> {
  return updateNote(userId, id, { isFavorite: true }, context);
}

/**
 * Unfavorite a note
 */
export async function unfavoriteNote(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Note> {
  return updateNote(userId, id, { isFavorite: false }, context);
}

/**
 * List notes with filtering and pagination
 */
export async function listNotes(
  userId: string,
  options: ListNotesOptions = {}
): Promise<PaginatedResult<Note>> {
  const pagination = normalizePagination(options);
  const orderBy = buildOrderBy(options.sortBy ?? "updatedAt", options.sortOrder ?? "desc");

  const where: Prisma.NoteWhereInput = {
    userId,
    ...softDeleteFilter(options.includeDeleted),
    ...(options.type && { type: options.type }),
    ...(options.category && { category: options.category }),
    ...(options.folderId && { folderId: options.folderId }),
    ...(options.isPinned !== undefined && { isPinned: options.isPinned }),
    ...(options.isFavorite !== undefined && { isFavorite: options.isFavorite }),
    ...(options.minImportance && { importance: { gte: options.minImportance } }),
    ...(options.tags?.length && { tags: { hasSome: options.tags } }),
    ...(options.search && {
      OR: [
        { title: { contains: options.search, mode: "insensitive" as const } },
        { content: { contains: options.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const notes = await db.note.findMany({
    where,
    orderBy,
    ...pagination,
  });

  return processPaginatedResults(notes, options.limit ?? 20);
}

/**
 * Find a note by source
 */
export async function findNoteBySource(
  userId: string,
  source: Source,
  sourceId: string
): Promise<Note | null> {
  return db.note.findFirst({
    where: { userId, source, sourceId, ...softDeleteFilter() },
  });
}

/**
 * Search notes by title/content
 */
export async function searchNotes(
  userId: string,
  query: string,
  options: SearchNotesOptions = {}
): Promise<Note[]> {
  const limit = options.limit ?? 20;

  const searchFields: Prisma.NoteWhereInput[] = [
    { title: { contains: query, mode: "insensitive" } },
    { tags: { hasSome: [query.toLowerCase()] } },
  ];

  // Include content search if enabled (default: true)
  if (options.searchContent !== false) {
    searchFields.push({ content: { contains: query, mode: "insensitive" } });
  }

  return db.note.findMany({
    where: {
      userId,
      ...(options.includeDeleted ? {} : softDeleteFilter()),
      OR: searchFields,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

/**
 * Get pinned notes
 */
export async function getPinnedNotes(
  userId: string,
  limit: number = 20
): Promise<Note[]> {
  return db.note.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      isPinned: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

/**
 * Get favorite notes
 */
export async function getFavoriteNotes(
  userId: string,
  limit: number = 20
): Promise<Note[]> {
  return db.note.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      isFavorite: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

/**
 * Get recent notes
 */
export async function getRecentNotes(
  userId: string,
  limit: number = 20
): Promise<Note[]> {
  return db.note.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

/**
 * Get notes by category
 */
export async function getNotesByCategory(
  userId: string,
  category: string
): Promise<Note[]> {
  return db.note.findMany({
    where: {
      userId,
      category,
      ...softDeleteFilter(),
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Upsert notes from external source
 */
export async function upsertNotesFromSource(
  userId: string,
  source: Source,
  notes: SourceNoteInput[],
  context?: ServiceContext
): Promise<UpsertResult<Note>> {
  const created: Note[] = [];
  const updated: Note[] = [];
  let unchanged = 0;

  for (const input of notes) {
    const existing = await findNoteBySource(userId, source, input.sourceId);

    if (existing) {
      if (existing.content !== input.data.content) {
        const updatedNote = await updateNote(
          userId,
          existing.id,
          { ...input.data } as UpdateNoteInput,
          context
        );
        updated.push(updatedNote);
      } else {
        unchanged++;
      }
    } else {
      const newNote = await createNote(
        userId,
        { ...input.data, source, sourceId: input.sourceId },
        context
      );
      created.push(newNote);
    }
  }

  return { created, updated, unchanged };
}

// ─────────────────────────────────────────────────────────────
// Service Object
// ─────────────────────────────────────────────────────────────

export const NotesService: INotesService = {
  create: createNote,
  getById: getNoteById,
  update: updateNote,
  delete: deleteNote,
  restore: restoreNote,
  pin: pinNote,
  unpin: unpinNote,
  favorite: favoriteNote,
  unfavorite: unfavoriteNote,
  list: listNotes,
  findBySource: findNoteBySource,
  search: searchNotes,
  getPinned: getPinnedNotes,
  getFavorites: getFavoriteNotes,
  getRecent: getRecentNotes,
  getByCategory: getNotesByCategory,
  upsertFromSource: upsertNotesFromSource,
};

