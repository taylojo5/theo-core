// ═══════════════════════════════════════════════════════════════════════════
// Embedding Integration
// Integrates embedding generation into entity lifecycle
// ═══════════════════════════════════════════════════════════════════════════

import {
  getEmbeddingService,
  deleteEmbeddings as deleteEntityEmbeddings,
} from "@/lib/embeddings";
import { buildSearchableContent } from "./utils";
import type { EntityType } from "./types";
import type { Person, Place, Event, Task, Deadline } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface EmbeddingContext {
  /** Skip embedding generation (for performance-sensitive operations) */
  skipEmbedding?: boolean;
}

export interface EmbeddingResult {
  success: boolean;
  error?: Error;
}

// ─────────────────────────────────────────────────────────────
// Content Builders
// ─────────────────────────────────────────────────────────────

/**
 * Build embeddable content for a Person entity
 * Creates a searchable text representation of the person
 */
export function buildPersonContent(person: Person): string {
  return buildSearchableContent([
    person.name,
    person.email,
    person.company,
    person.title,
    person.bio,
    person.notes,
    person.location,
    person.type ? `Type: ${person.type}` : null,
    person.tags?.length ? `Tags: ${person.tags.join(", ")}` : null,
  ]);
}

/**
 * Build embeddable content for a Place entity
 */
export function buildPlaceContent(place: Place): string {
  const locationParts = [
    place.address,
    place.city,
    place.state,
    place.country,
    place.postalCode,
  ]
    .filter(Boolean)
    .join(", ");

  return buildSearchableContent([
    place.name,
    place.type ? `Type: ${place.type}` : null,
    locationParts || null,
    place.notes,
    place.tags?.length ? `Tags: ${place.tags.join(", ")}` : null,
  ]);
}

/**
 * Build embeddable content for an Event entity
 */
export function buildEventContent(event: Event): string {
  const dateInfo = event.startsAt
    ? `Scheduled: ${event.startsAt.toISOString().split("T")[0]}`
    : null;

  return buildSearchableContent([
    event.title,
    event.description,
    event.type ? `Type: ${event.type}` : null,
    event.location,
    dateInfo,
    event.notes,
    event.tags?.length ? `Tags: ${event.tags.join(", ")}` : null,
  ]);
}

/**
 * Build embeddable content for a Task entity
 */
export function buildTaskContent(task: Task): string {
  const dueDateInfo = task.dueDate
    ? `Due: ${task.dueDate.toISOString().split("T")[0]}`
    : null;

  return buildSearchableContent([
    task.title,
    task.description,
    task.status ? `Status: ${task.status}` : null,
    task.priority ? `Priority: ${task.priority}` : null,
    dueDateInfo,
    task.notes,
    task.tags?.length ? `Tags: ${task.tags.join(", ")}` : null,
  ]);
}

/**
 * Build embeddable content for a Deadline entity
 */
export function buildDeadlineContent(deadline: Deadline): string {
  const dueInfo = deadline.dueAt
    ? `Due: ${deadline.dueAt.toISOString().split("T")[0]}`
    : null;

  return buildSearchableContent([
    deadline.title,
    deadline.description,
    deadline.type ? `Type: ${deadline.type}` : null,
    dueInfo,
    deadline.consequences,
    deadline.notes,
    deadline.tags?.length ? `Tags: ${deadline.tags.join(", ")}` : null,
  ]);
}

/**
 * Build embeddable content for any entity type
 */
export function buildEntityContent(
  entityType: EntityType,
  entity: Person | Place | Event | Task | Deadline
): string {
  switch (entityType) {
    case "person":
      return buildPersonContent(entity as Person);
    case "place":
      return buildPlaceContent(entity as Place);
    case "event":
      return buildEventContent(entity as Event);
    case "task":
      return buildTaskContent(entity as Task);
    case "deadline":
      return buildDeadlineContent(entity as Deadline);
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Embedding Operations (Fail-Safe)
// ─────────────────────────────────────────────────────────────

/**
 * Store or update embedding for an entity
 * Fails gracefully - errors are logged but don't fail the main operation
 */
export async function storeEntityEmbedding(
  userId: string,
  entityType: EntityType,
  entityId: string,
  content: string
): Promise<EmbeddingResult> {
  try {
    const embeddingService = getEmbeddingService();
    await embeddingService.storeEntityEmbedding(
      userId,
      entityType,
      entityId,
      content
    );
    return { success: true };
  } catch (error) {
    // Log the error but don't rethrow - embedding failures shouldn't fail entity operations
    console.error(
      `[Embedding] Failed to store embedding for ${entityType}:${entityId}:`,
      error instanceof Error ? error.message : error
    );
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Delete embeddings for an entity
 * Fails gracefully - errors are logged but don't fail the main operation
 */
export async function removeEntityEmbedding(
  userId: string,
  entityType: EntityType,
  entityId: string
): Promise<EmbeddingResult> {
  try {
    await deleteEntityEmbeddings(userId, entityType, entityId);
    return { success: true };
  } catch (error) {
    console.error(
      `[Embedding] Failed to delete embedding for ${entityType}:${entityId}:`,
      error instanceof Error ? error.message : error
    );
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Entity Lifecycle Hooks
// ─────────────────────────────────────────────────────────────

/**
 * Handle embedding after entity creation
 * Call this after successfully creating an entity
 */
export async function afterEntityCreate<
  T extends { id: string; userId: string },
>(
  entityType: EntityType,
  entity: T,
  contentBuilder: (entity: T) => string,
  context?: EmbeddingContext
): Promise<EmbeddingResult> {
  if (context?.skipEmbedding) {
    return { success: true };
  }

  const content = contentBuilder(entity);
  return storeEntityEmbedding(entity.userId, entityType, entity.id, content);
}

/**
 * Handle embedding after entity update
 * Call this after successfully updating an entity
 */
export async function afterEntityUpdate<
  T extends { id: string; userId: string },
>(
  entityType: EntityType,
  entity: T,
  contentBuilder: (entity: T) => string,
  context?: EmbeddingContext
): Promise<EmbeddingResult> {
  if (context?.skipEmbedding) {
    return { success: true };
  }

  const content = contentBuilder(entity);
  return storeEntityEmbedding(entity.userId, entityType, entity.id, content);
}

/**
 * Handle embedding after entity deletion
 * Call this after successfully deleting an entity
 */
export async function afterEntityDelete(
  entityType: EntityType,
  userId: string,
  entityId: string,
  context?: EmbeddingContext
): Promise<EmbeddingResult> {
  if (context?.skipEmbedding) {
    return { success: true };
  }

  return removeEntityEmbedding(userId, entityType, entityId);
}

// ─────────────────────────────────────────────────────────────
// Convenience Functions for Each Entity Type
// ─────────────────────────────────────────────────────────────

/**
 * Generate embedding for a Person after create/update
 */
export async function embedPerson(
  person: Person,
  context?: EmbeddingContext
): Promise<EmbeddingResult> {
  return afterEntityCreate("person", person, buildPersonContent, context);
}

/**
 * Remove embedding for a deleted Person
 */
export async function removePersonEmbedding(
  userId: string,
  personId: string,
  context?: EmbeddingContext
): Promise<EmbeddingResult> {
  return afterEntityDelete("person", userId, personId, context);
}

/**
 * Generate embedding for a Place after create/update
 */
export async function embedPlace(
  place: Place,
  context?: EmbeddingContext
): Promise<EmbeddingResult> {
  return afterEntityCreate("place", place, buildPlaceContent, context);
}

/**
 * Remove embedding for a deleted Place
 */
export async function removePlaceEmbedding(
  userId: string,
  placeId: string,
  context?: EmbeddingContext
): Promise<EmbeddingResult> {
  return afterEntityDelete("place", userId, placeId, context);
}

/**
 * Generate embedding for an Event after create/update
 */
export async function embedEvent(
  event: Event,
  context?: EmbeddingContext
): Promise<EmbeddingResult> {
  return afterEntityCreate("event", event, buildEventContent, context);
}

/**
 * Remove embedding for a deleted Event
 */
export async function removeEventEmbedding(
  userId: string,
  eventId: string,
  context?: EmbeddingContext
): Promise<EmbeddingResult> {
  return afterEntityDelete("event", userId, eventId, context);
}

/**
 * Generate embedding for a Task after create/update
 */
export async function embedTask(
  task: Task,
  context?: EmbeddingContext
): Promise<EmbeddingResult> {
  return afterEntityCreate("task", task, buildTaskContent, context);
}

/**
 * Remove embedding for a deleted Task
 */
export async function removeTaskEmbedding(
  userId: string,
  taskId: string,
  context?: EmbeddingContext
): Promise<EmbeddingResult> {
  return afterEntityDelete("task", userId, taskId, context);
}

/**
 * Generate embedding for a Deadline after create/update
 */
export async function embedDeadline(
  deadline: Deadline,
  context?: EmbeddingContext
): Promise<EmbeddingResult> {
  return afterEntityCreate("deadline", deadline, buildDeadlineContent, context);
}

/**
 * Remove embedding for a deleted Deadline
 */
export async function removeDeadlineEmbedding(
  userId: string,
  deadlineId: string,
  context?: EmbeddingContext
): Promise<EmbeddingResult> {
  return afterEntityDelete("deadline", userId, deadlineId, context);
}
