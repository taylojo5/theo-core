// ═══════════════════════════════════════════════════════════════════════════
// People Service
// CRUD operations for Person entities with audit logging
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { logAuditEntry } from "@/services/audit";
import { Prisma } from "@prisma/client";
import {
  softDeleteFilter,
  normalizePagination,
  processPaginatedResults,
  buildOrderBy,
  normalizeEmail,
  isValidEmail,
  normalizeTags,
  validateImportance,
} from "../utils";
import {
  embedPerson,
  removePersonEmbedding,
  type EmbeddingContext,
} from "../embedding-integration";
import type {
  Person,
  CreatePersonInput,
  UpdatePersonInput,
  ListPeopleOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  IPeopleService,
  SearchPeopleOptions,
  SourcePersonInput,
} from "./types";
import { PeopleServiceError as PeopleError } from "./types";

// ─────────────────────────────────────────────────────────────
// People Service Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Create a new person
 */
export async function createPerson(
  userId: string,
  data: CreatePersonInput,
  context?: ServiceContext
): Promise<Person> {
  // Validate and normalize email
  let normalizedEmail: string | undefined;
  if (data.email) {
    if (!isValidEmail(data.email)) {
      throw new PeopleError("INVALID_EMAIL", `Invalid email format: ${data.email}`);
    }
    normalizedEmail = normalizeEmail(data.email);
  }

  // Normalize tags
  const normalizedTags = data.tags ? normalizeTags(data.tags) : [];

  // Validate importance
  const importance = data.importance !== undefined
    ? validateImportance(data.importance)
    : 5;

  try {
    const person = await db.person.create({
      data: {
        userId,
        name: data.name,
        email: normalizedEmail,
        phone: data.phone,
        avatarUrl: data.avatarUrl,
        type: data.type ?? "contact",
        importance,
        company: data.company,
        title: data.title,
        location: data.location,
        timezone: data.timezone,
        bio: data.bio,
        notes: data.notes,
        preferences: (data.preferences as Prisma.InputJsonValue) ?? {},
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
      entityType: "person",
      entityId: person.id,
      entitySnapshot: person as unknown as Prisma.InputJsonValue,
      outputSummary: `Created person: ${person.name}`,
    });

    // Generate embedding (fire-and-forget, errors don't fail the operation)
    void embedPerson(person, context as EmbeddingContext);

    return person;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation
      if (error.code === "P2002") {
        const target = error.meta?.target as string[] | undefined;
        if (target?.includes("email")) {
          throw new PeopleError(
            "DUPLICATE_EMAIL",
            `A person with email ${normalizedEmail} already exists`,
            { email: normalizedEmail }
          );
        }
        if (target?.includes("sourceId")) {
          throw new PeopleError(
            "DUPLICATE_SOURCE_ID",
            `A person from ${data.source} with ID ${data.sourceId} already exists`,
            { source: data.source, sourceId: data.sourceId }
          );
        }
      }
    }
    throw error;
  }
}

/**
 * Get a person by ID
 */
export async function getPersonById(
  userId: string,
  id: string
): Promise<Person | null> {
  return db.person.findFirst({
    where: {
      id,
      userId,
      ...softDeleteFilter(),
    },
  });
}

/**
 * Update a person
 */
export async function updatePerson(
  userId: string,
  id: string,
  data: UpdatePersonInput,
  context?: ServiceContext
): Promise<Person> {
  // Verify person exists and user owns it
  const existing = await db.person.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new PeopleError("PERSON_NOT_FOUND", `Person not found: ${id}`);
  }

  // Validate and normalize email if provided
  let normalizedEmail: string | undefined;
  if (data.email !== undefined) {
    if (data.email && !isValidEmail(data.email)) {
      throw new PeopleError("INVALID_EMAIL", `Invalid email format: ${data.email}`);
    }
    normalizedEmail = data.email ? normalizeEmail(data.email) : undefined;
  }

  // Normalize tags if provided
  const normalizedTags = data.tags ? normalizeTags(data.tags) : undefined;

  // Validate importance if provided
  const importance = data.importance !== undefined
    ? validateImportance(data.importance)
    : undefined;

  try {
    const person = await db.person.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(normalizedEmail !== undefined && { email: normalizedEmail }),
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
        ...(data.type !== undefined && { type: data.type }),
        ...(importance !== undefined && { importance }),
        ...(data.company !== undefined && { company: data.company }),
        ...(data.title !== undefined && { title: data.title }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.bio !== undefined && { bio: data.bio }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.preferences !== undefined && {
          preferences: data.preferences as Prisma.InputJsonValue,
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
      entityType: "person",
      entityId: person.id,
      entitySnapshot: person as unknown as Prisma.InputJsonValue,
      outputSummary: `Updated person: ${person.name}`,
    });

    // Update embedding (fire-and-forget, errors don't fail the operation)
    void embedPerson(person, context as EmbeddingContext);

    return person;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = error.meta?.target as string[] | undefined;
        if (target?.includes("email")) {
          throw new PeopleError(
            "DUPLICATE_EMAIL",
            `A person with email ${normalizedEmail} already exists`,
            { email: normalizedEmail }
          );
        }
      }
    }
    throw error;
  }
}

/**
 * Soft delete a person
 */
export async function deletePerson(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<void> {
  // Verify person exists and user owns it
  const existing = await db.person.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new PeopleError("PERSON_NOT_FOUND", `Person not found: ${id}`);
  }

  await db.person.update({
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
    entityType: "person",
    entityId: id,
    outputSummary: `Deleted person: ${existing.name}`,
  });

  // Remove embedding (fire-and-forget, errors don't fail the operation)
  void removePersonEmbedding(userId, id, context as EmbeddingContext);
}

/**
 * Restore a soft-deleted person
 */
export async function restorePerson(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Person> {
  // Find deleted person
  const existing = await db.person.findFirst({
    where: {
      id,
      userId,
      deletedAt: { not: null },
    },
  });

  if (!existing) {
    throw new PeopleError(
      "PERSON_NOT_FOUND",
      `Deleted person not found: ${id}`
    );
  }

  const person = await db.person.update({
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
    entityType: "person",
    entityId: person.id,
    outputSummary: `Restored person: ${person.name}`,
  });

  return person;
}

/**
 * List people with filtering and pagination
 */
export async function listPeople(
  userId: string,
  options: ListPeopleOptions = {}
): Promise<PaginatedResult<Person>> {
  const pagination = normalizePagination(options);
  const orderBy = buildOrderBy(options.sortBy ?? "name", options.sortOrder ?? "asc");

  // Build where clause
  const where: Prisma.PersonWhereInput = {
    userId,
    ...softDeleteFilter(options.includeDeleted),
    ...(options.type && { type: options.type }),
    ...(options.company && {
      company: { contains: options.company, mode: "insensitive" as const },
    }),
    ...(options.minImportance && { importance: { gte: options.minImportance } }),
    ...(options.source && { source: options.source }),
    ...(options.tags?.length && { tags: { hasSome: options.tags } }),
    ...(options.search && {
      OR: [
        { name: { contains: options.search, mode: "insensitive" as const } },
        { email: { contains: options.search, mode: "insensitive" as const } },
        { company: { contains: options.search, mode: "insensitive" as const } },
        { title: { contains: options.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const people = await db.person.findMany({
    where,
    orderBy,
    ...pagination,
  });

  return processPaginatedResults(people, options.limit ?? 20);
}

/**
 * Find a person by email
 */
export async function findPersonByEmail(
  userId: string,
  email: string
): Promise<Person | null> {
  const normalizedEmail = normalizeEmail(email);

  return db.person.findFirst({
    where: {
      userId,
      email: normalizedEmail,
      ...softDeleteFilter(),
    },
  });
}

/**
 * Find a person by source and sourceId
 */
export async function findPersonBySource(
  userId: string,
  source: Source,
  sourceId: string
): Promise<Person | null> {
  return db.person.findFirst({
    where: {
      userId,
      source,
      sourceId,
      ...softDeleteFilter(),
    },
  });
}

/**
 * Search people by name (full-text search)
 */
export async function searchPeople(
  userId: string,
  query: string,
  options: SearchPeopleOptions = {}
): Promise<Person[]> {
  const limit = options.limit ?? 20;

  // Search across multiple fields
  const people = await db.person.findMany({
    where: {
      userId,
      ...softDeleteFilter(options.includeDeleted),
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { company: { contains: query, mode: "insensitive" } },
        { title: { contains: query, mode: "insensitive" } },
        { bio: { contains: query, mode: "insensitive" } },
        { notes: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: [
      // Prioritize name matches (rough approximation - Prisma doesn't support search ranking)
      { importance: "desc" },
      { name: "asc" },
    ],
    take: limit,
  });

  return people;
}

/**
 * Upsert people from an external source
 * Creates new people or updates existing ones based on sourceId
 */
export async function upsertPeopleFromSource(
  userId: string,
  source: Source,
  people: SourcePersonInput[],
  context?: ServiceContext
): Promise<UpsertResult<Person>> {
  const created: Person[] = [];
  const updated: Person[] = [];
  let unchanged = 0;

  for (const { sourceId, data } of people) {
    // Check if person exists
    const existing = await findPersonBySource(userId, source, sourceId);

    if (existing) {
      // Check if data has changed (only compare fields that are explicitly provided)
      const hasChanges =
        existing.name !== data.name ||
        (data.email !== undefined && existing.email !== (data.email ? normalizeEmail(data.email) : null)) ||
        (data.phone !== undefined && existing.phone !== data.phone) ||
        (data.company !== undefined && existing.company !== data.company) ||
        (data.title !== undefined && existing.title !== data.title);

      if (hasChanges) {
        const updatedPerson = await updatePerson(
          userId,
          existing.id,
          { ...data },
          context
        );
        updated.push(updatedPerson);
      } else {
        unchanged++;
      }
    } else {
      // Create new person
      const newPerson = await createPerson(
        userId,
        { ...data, source, sourceId },
        context
      );
      created.push(newPerson);
    }
  }

  return { created, updated, unchanged };
}

// ─────────────────────────────────────────────────────────────
// Service Object (for DI / testing)
// ─────────────────────────────────────────────────────────────

/**
 * People service object implementing IPeopleService
 * Can be used for dependency injection or testing
 */
export const PeopleService: IPeopleService = {
  create: createPerson,
  getById: getPersonById,
  update: updatePerson,
  delete: deletePerson,
  restore: restorePerson,
  list: listPeople,
  findByEmail: findPersonByEmail,
  findBySource: findPersonBySource,
  search: searchPeople,
  upsertFromSource: upsertPeopleFromSource,
};

