// ═══════════════════════════════════════════════════════════════════════════
// Events Service
// CRUD operations for Event entities with audit logging
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
  getDateRange,
} from "../utils";
import type {
  Event,
  CreateEventInput,
  UpdateEventInput,
  ListEventsOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  EventStatus,
  IEventsService,
  SearchEventsOptions,
  SourceEventInput,
  EventWithPlace,
  EventTimeRangeOptions,
  TimeRangePreset,
} from "./types";
import { EventsServiceError as EventsError } from "./types";

// ─────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Validate event date range
 */
function validateDateRange(startsAt: Date, endsAt?: Date): void {
  if (endsAt && endsAt < startsAt) {
    throw new EventsError(
      "INVALID_DATE_RANGE",
      "Event end date must be after start date",
      { startsAt, endsAt }
    );
  }
}

/**
 * Validate status transition
 */
function validateStatusTransition(
  currentStatus: string,
  newStatus: EventStatus
): void {
  // Define valid transitions
  const validTransitions: Record<string, EventStatus[]> = {
    tentative: ["confirmed", "cancelled"],
    confirmed: ["tentative", "cancelled"],
    cancelled: ["tentative", "confirmed"], // Allow un-cancelling
  };

  const allowed = validTransitions[currentStatus] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new EventsError(
      "INVALID_STATUS_TRANSITION",
      `Cannot transition from '${currentStatus}' to '${newStatus}'`,
      { currentStatus, newStatus }
    );
  }
}

/**
 * Get date range from preset
 */
function getPresetDateRange(preset: TimeRangePreset): { start: Date; end: Date } {
  const now = new Date();

  switch (preset) {
    case "today":
      return getDateRange("today");

    case "tomorrow": {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const start = new Date(tomorrow);
      start.setHours(0, 0, 0, 0);
      const end = new Date(tomorrow);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    case "this_week":
      return getDateRange("week");

    case "next_week": {
      const start = new Date(now);
      start.setDate(now.getDate() - now.getDay() + 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    case "this_month":
      return getDateRange("month");

    case "next_month": {
      const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Events Service Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Create a new event
 */
export async function createEvent(
  userId: string,
  data: CreateEventInput,
  context?: ServiceContext
): Promise<Event> {
  // Validate date range
  validateDateRange(data.startsAt, data.endsAt);

  // Verify place exists if provided
  if (data.placeId) {
    const place = await db.place.findFirst({
      where: { id: data.placeId, userId, ...softDeleteFilter() },
    });
    if (!place) {
      throw new EventsError("PLACE_NOT_FOUND", `Place not found: ${data.placeId}`);
    }
  }

  // Normalize tags
  const normalizedTags = data.tags ? normalizeTags(data.tags) : [];

  // Validate importance
  const importance = data.importance !== undefined
    ? validateImportance(data.importance)
    : 5;

  try {
    const event = await db.event.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        type: data.type ?? "meeting",
        startsAt: data.startsAt,
        endsAt: data.endsAt,
        allDay: data.allDay ?? false,
        timezone: data.timezone,
        location: data.location,
        placeId: data.placeId,
        virtualUrl: data.virtualUrl,
        status: data.status ?? "confirmed",
        visibility: data.visibility ?? "private",
        notes: data.notes,
        importance,
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
      entityType: "event",
      entityId: event.id,
      entitySnapshot: event as unknown as Prisma.InputJsonValue,
      outputSummary: `Created event: ${event.title}`,
    });

    return event;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new EventsError(
          "DUPLICATE_SOURCE_ID",
          `An event from ${data.source} with ID ${data.sourceId} already exists`,
          { source: data.source, sourceId: data.sourceId }
        );
      }
    }
    throw error;
  }
}

/**
 * Get an event by ID
 */
export async function getEventById(
  userId: string,
  id: string
): Promise<Event | null> {
  return db.event.findFirst({
    where: {
      id,
      userId,
      ...softDeleteFilter(),
    },
  });
}

/**
 * Get an event by ID with place relation
 */
export async function getEventByIdWithPlace(
  userId: string,
  id: string
): Promise<EventWithPlace | null> {
  return db.event.findFirst({
    where: {
      id,
      userId,
      ...softDeleteFilter(),
    },
    include: {
      place: true,
    },
  });
}

/**
 * Update an event
 */
export async function updateEvent(
  userId: string,
  id: string,
  data: UpdateEventInput,
  context?: ServiceContext
): Promise<Event> {
  // Verify event exists and user owns it
  const existing = await db.event.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new EventsError("EVENT_NOT_FOUND", `Event not found: ${id}`);
  }

  // Validate date range if dates are being updated
  const startsAt = data.startsAt ?? existing.startsAt;
  const endsAt = data.endsAt !== undefined ? data.endsAt : existing.endsAt;
  if (endsAt) {
    validateDateRange(startsAt, endsAt);
  }

  // Verify place exists if provided
  if (data.placeId) {
    const place = await db.place.findFirst({
      where: { id: data.placeId, userId, ...softDeleteFilter() },
    });
    if (!place) {
      throw new EventsError("PLACE_NOT_FOUND", `Place not found: ${data.placeId}`);
    }
  }

  // Normalize tags if provided
  const normalizedTags = data.tags ? normalizeTags(data.tags) : undefined;

  // Validate importance if provided
  const importance = data.importance !== undefined
    ? validateImportance(data.importance)
    : undefined;

  try {
    const event = await db.event.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.startsAt !== undefined && { startsAt: data.startsAt }),
        ...(data.endsAt !== undefined && { endsAt: data.endsAt }),
        ...(data.allDay !== undefined && { allDay: data.allDay }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.placeId !== undefined && { placeId: data.placeId }),
        ...(data.virtualUrl !== undefined && { virtualUrl: data.virtualUrl }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.visibility !== undefined && { visibility: data.visibility }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(importance !== undefined && { importance }),
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
      entityType: "event",
      entityId: event.id,
      entitySnapshot: event as unknown as Prisma.InputJsonValue,
      outputSummary: `Updated event: ${event.title}`,
    });

    return event;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new EventsError(
          "DUPLICATE_SOURCE_ID",
          `An event with this source ID already exists`
        );
      }
    }
    throw error;
  }
}

/**
 * Update event status with validation
 */
export async function updateEventStatus(
  userId: string,
  id: string,
  status: EventStatus,
  context?: ServiceContext
): Promise<Event> {
  const existing = await db.event.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new EventsError("EVENT_NOT_FOUND", `Event not found: ${id}`);
  }

  // Validate transition
  validateStatusTransition(existing.status, status);

  return updateEvent(userId, id, { status }, context);
}

/**
 * Cancel an event
 */
export async function cancelEvent(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Event> {
  return updateEventStatus(userId, id, "cancelled", context);
}

/**
 * Confirm an event
 */
export async function confirmEvent(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Event> {
  return updateEventStatus(userId, id, "confirmed", context);
}

/**
 * Soft delete an event
 */
export async function deleteEvent(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<void> {
  const existing = await db.event.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new EventsError("EVENT_NOT_FOUND", `Event not found: ${id}`);
  }

  await db.event.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "delete",
    actionCategory: "context",
    entityType: "event",
    entityId: id,
    outputSummary: `Deleted event: ${existing.title}`,
  });
}

/**
 * Restore a soft-deleted event
 */
export async function restoreEvent(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Event> {
  const existing = await db.event.findFirst({
    where: {
      id,
      userId,
      deletedAt: { not: null },
    },
  });

  if (!existing) {
    throw new EventsError("EVENT_NOT_FOUND", `Deleted event not found: ${id}`);
  }

  const event = await db.event.update({
    where: { id },
    data: { deletedAt: null },
  });

  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "update",
    actionCategory: "context",
    entityType: "event",
    entityId: event.id,
    outputSummary: `Restored event: ${event.title}`,
  });

  return event;
}

/**
 * List events with filtering and pagination
 */
export async function listEvents(
  userId: string,
  options: ListEventsOptions = {}
): Promise<PaginatedResult<Event>> {
  const pagination = normalizePagination(options);
  const orderBy = buildOrderBy(options.sortBy ?? "startsAt", options.sortOrder ?? "asc");

  const where: Prisma.EventWhereInput = {
    userId,
    ...softDeleteFilter(options.includeDeleted),
    ...(options.type && { type: options.type }),
    ...(options.status && { status: options.status }),
    ...(options.startsAfter && { startsAt: { gte: options.startsAfter } }),
    ...(options.startsBefore && { startsAt: { lte: options.startsBefore } }),
    ...(options.endsAfter && { endsAt: { gte: options.endsAfter } }),
    ...(options.endsBefore && { endsAt: { lte: options.endsBefore } }),
    ...(options.placeId && { placeId: options.placeId }),
    ...(options.source && { source: options.source }),
    ...(options.tags?.length && { tags: { hasSome: options.tags } }),
    ...(options.search && {
      OR: [
        { title: { contains: options.search, mode: "insensitive" as const } },
        { description: { contains: options.search, mode: "insensitive" as const } },
        { location: { contains: options.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const events = await db.event.findMany({
    where,
    orderBy,
    ...pagination,
  });

  return processPaginatedResults(events, options.limit ?? 20);
}

/**
 * Find an event by source and sourceId
 */
export async function findEventBySource(
  userId: string,
  source: Source,
  sourceId: string
): Promise<Event | null> {
  return db.event.findFirst({
    where: {
      userId,
      source,
      sourceId,
      ...softDeleteFilter(),
    },
  });
}

/**
 * Search events by title/description
 */
export async function searchEvents(
  userId: string,
  query: string,
  options: SearchEventsOptions = {}
): Promise<Event[]> {
  const limit = options.limit ?? 20;

  return db.event.findMany({
    where: {
      userId,
      ...softDeleteFilter(options.includeDeleted),
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { description: { contains: query, mode: "insensitive" } },
        { location: { contains: query, mode: "insensitive" } },
        { notes: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: [
      { startsAt: "desc" },
    ],
    take: limit,
  });
}

/**
 * Get upcoming events
 */
export async function getUpcomingEvents(
  userId: string,
  limit: number = 10
): Promise<Event[]> {
  return db.event.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      startsAt: { gte: new Date() },
      status: { not: "cancelled" },
    },
    orderBy: { startsAt: "asc" },
    take: limit,
  });
}

/**
 * Get past events
 */
export async function getPastEvents(
  userId: string,
  limit: number = 10
): Promise<Event[]> {
  return db.event.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      startsAt: { lt: new Date() },
    },
    orderBy: { startsAt: "desc" },
    take: limit,
  });
}

/**
 * Get events by time range
 */
export async function getEventsByTimeRange(
  userId: string,
  options: EventTimeRangeOptions
): Promise<Event[]> {
  let startsAfter: Date | undefined;
  let startsBefore: Date | undefined;

  if (options.preset) {
    const range = getPresetDateRange(options.preset);
    startsAfter = range.start;
    startsBefore = range.end;
  } else {
    startsAfter = options.startsAfter;
    startsBefore = options.startsBefore;
  }

  return db.event.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      ...(startsAfter && { startsAt: { gte: startsAfter } }),
      ...(startsBefore && { startsAt: { lte: startsBefore } }),
      ...(options.includeEnded === false && {
        OR: [
          { endsAt: null },
          { endsAt: { gte: new Date() } },
        ],
      }),
    },
    orderBy: { startsAt: "asc" },
  });
}

/**
 * Get events on a specific date
 */
export async function getEventsOnDate(
  userId: string,
  date: Date
): Promise<Event[]> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return db.event.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      startsAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    orderBy: { startsAt: "asc" },
  });
}

/**
 * Get events at a specific place
 */
export async function getEventsByPlace(
  userId: string,
  placeId: string
): Promise<Event[]> {
  return db.event.findMany({
    where: {
      userId,
      placeId,
      ...softDeleteFilter(),
    },
    orderBy: { startsAt: "desc" },
  });
}

/**
 * Upsert events from an external source
 */
export async function upsertEventsFromSource(
  userId: string,
  source: Source,
  events: SourceEventInput[],
  context?: ServiceContext
): Promise<UpsertResult<Event>> {
  const created: Event[] = [];
  const updated: Event[] = [];
  let unchanged = 0;

  for (const { sourceId, data } of events) {
    const existing = await findEventBySource(userId, source, sourceId);

    if (existing) {
      const hasChanges =
        existing.title !== data.title ||
        existing.startsAt.getTime() !== data.startsAt.getTime() ||
        (data.endsAt !== undefined && existing.endsAt?.getTime() !== data.endsAt?.getTime()) ||
        (data.location !== undefined && existing.location !== data.location);

      if (hasChanges) {
        const updatedEvent = await updateEvent(
          userId,
          existing.id,
          { ...data },
          context
        );
        updated.push(updatedEvent);
      } else {
        unchanged++;
      }
    } else {
      const newEvent = await createEvent(
        userId,
        { ...data, source, sourceId },
        context
      );
      created.push(newEvent);
    }
  }

  return { created, updated, unchanged };
}

// ─────────────────────────────────────────────────────────────
// Service Object (for DI / testing)
// ─────────────────────────────────────────────────────────────

export const EventsService: IEventsService = {
  create: createEvent,
  getById: getEventById,
  getByIdWithPlace: getEventByIdWithPlace,
  update: updateEvent,
  delete: deleteEvent,
  restore: restoreEvent,
  updateStatus: updateEventStatus,
  cancel: cancelEvent,
  confirm: confirmEvent,
  list: listEvents,
  findBySource: findEventBySource,
  search: searchEvents,
  getUpcoming: getUpcomingEvents,
  getPast: getPastEvents,
  getByTimeRange: getEventsByTimeRange,
  getOnDate: getEventsOnDate,
  getByPlace: getEventsByPlace,
  upsertFromSource: upsertEventsFromSource,
};

