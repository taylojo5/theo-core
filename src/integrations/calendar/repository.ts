// ═══════════════════════════════════════════════════════════════════════════
// Calendar Repository
// Database operations for Calendar, CalendarSyncState, Events, and Approvals
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import {
  Prisma,
} from "@prisma/client";
import type {
  Calendar,
  CalendarSyncState,
  CalendarApproval,
  Event,
} from "@prisma/client";
import type { CalendarActionType, CalendarApprovalStatus } from "./types";
import type { CalendarCreateInput, EventDbCreateInput } from "./mappers";
import { calendarInputToPrisma, eventInputToUncheckedPrisma } from "./mappers";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type CalendarSyncStateUpdate = Partial<
  Omit<
    Prisma.CalendarSyncStateUpdateInput,
    "user" | "createdAt" | "updatedAt" | "id"
  >
>;

export type CalendarUpdateInput = Partial<
  Omit<
    Prisma.CalendarUpdateInput,
    "user" | "createdAt" | "updatedAt" | "id" | "googleCalendarId" | "userId"
  >
>;

export type EventUpdateInput = Partial<
  Omit<
    Prisma.EventUpdateInput,
    "user" | "createdAt" | "updatedAt" | "id"
  >
>;

export interface EventSearchQuery {
  query?: string;
  calendarId?: string;
  googleCalendarId?: string;
  startDate?: Date;
  endDate?: Date;
  type?: string;
  status?: string;
  allDay?: boolean;
  hasAttendees?: boolean;
  hasConference?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: "startsAt" | "endsAt" | "createdAt" | "updatedAt";
  orderDirection?: "asc" | "desc";
  includeDeleted?: boolean;
}

export interface EventSearchResult {
  events: Event[];
  total: number;
  hasMore: boolean;
}

export type ApprovalCreateInput = {
  userId: string;
  actionType: CalendarActionType;
  calendarId: string;
  eventId?: string;
  eventSnapshot: Prisma.InputJsonValue;
  requestedBy?: string;
  expiresAt?: Date;
  metadata?: Prisma.InputJsonValue;
};

export type ApprovalUpdateInput = Partial<
  Omit<
    Prisma.CalendarApprovalUpdateInput,
    "user" | "createdAt" | "updatedAt" | "id" | "userId"
  >
>;

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Remove undefined values from an object, returning only defined fields.
 * This prevents undefined optional fields from overwriting existing database values with NULL.
 */
function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  ) as Partial<T>;
}

/**
 * Build update data object that only includes defined (non-undefined) fields.
 * Uses dynamic filtering to avoid hardcoding field names.
 * 
 * @param input - The input object with potentially undefined fields
 * @returns An object containing only fields that are explicitly defined
 */
function buildEventUpdateData(input: EventDbCreateInput): Prisma.EventUncheckedUpdateInput {
  // Start with fields that should always be set on update
  const baseData: Prisma.EventUncheckedUpdateInput = {
    updatedAt: new Date(),
    deletedAt: null, // Un-delete if previously soft-deleted
    sourceSyncedAt: input.sourceSyncedAt ?? new Date(),
    sequence: input.sequence ?? 0,
  };

  // Fields that need JSON casting (Prisma requires explicit InputJsonValue type)
  const jsonFields = [
    "metadata",
    "recurrence",
    "attendees",
    "organizer",
    "creator",
    "conferenceData",
    "reminders",
  ] as const;

  // Fields to exclude from automatic copying (handled specially or not updateable)
  const excludeFields = new Set([
    "userId",           // Not updateable - event ownership doesn't change
    "googleEventId",    // Not updateable - this is the unique identifier
    "id",               // Not in input, but defensive
    "createdAt",        // Not updateable
    "updatedAt",        // Handled in baseData
    "deletedAt",        // Handled in baseData
    "sourceSyncedAt",   // Handled in baseData with default
    "sequence",         // Handled in baseData with default
    ...jsonFields,      // Handled separately with casting
  ]);

  // Dynamically copy all defined non-excluded fields
  const dynamicData = omitUndefined(
    Object.fromEntries(
      Object.entries(input).filter(([key]) => !excludeFields.has(key))
    )
  );

  // Add JSON fields with proper casting (only if defined)
  const jsonData: Prisma.EventUncheckedUpdateInput = {};
  for (const field of jsonFields) {
    if (input[field] !== undefined) {
      jsonData[field] = input[field] as Prisma.InputJsonValue;
    }
  }

  return {
    ...baseData,
    ...dynamicData,
    ...jsonData,
  };
}

// ─────────────────────────────────────────────────────────────
// Calendar Sync State Repository
// ─────────────────────────────────────────────────────────────

export const calendarSyncStateRepository = {
  /**
   * Get sync state for a user
   */
  get: async (userId: string): Promise<CalendarSyncState | null> => {
    return db.calendarSyncState.findUnique({
      where: { userId },
    });
  },

  /**
   * Get sync state for a user (creates if doesn't exist)
   */
  getOrCreate: async (userId: string): Promise<CalendarSyncState> => {
    return db.calendarSyncState.upsert({
      where: { userId },
      create: {
        user: { connect: { id: userId } },
      },
      update: {},
    });
  },

  /**
   * Update sync state
   */
  update: async (
    userId: string,
    data: CalendarSyncStateUpdate
  ): Promise<CalendarSyncState> => {
    return db.calendarSyncState.upsert({
      where: { userId },
      create: {
        user: { connect: { id: userId } },
        syncStatus: (data.syncStatus as string) || "idle",
        syncToken: data.syncToken as string | undefined,
        syncTokenSetAt: data.syncTokenSetAt as Date | undefined,
        lastSyncAt: data.lastSyncAt as Date | undefined,
        lastFullSyncAt: data.lastFullSyncAt as Date | undefined,
        syncError: data.syncError as string | undefined,
        eventCount: (data.eventCount as number) || 0,
        calendarCount: (data.calendarCount as number) || 0,
        fullSyncPageToken: data.fullSyncPageToken as string | undefined,
        fullSyncProgress: (data.fullSyncProgress as number) || 0,
        fullSyncStartedAt: data.fullSyncStartedAt as Date | undefined,
        embeddingsPending: (data.embeddingsPending as number) || 0,
        embeddingsCompleted: (data.embeddingsCompleted as number) || 0,
        embeddingsFailed: (data.embeddingsFailed as number) || 0,
        webhookChannelId: data.webhookChannelId as string | undefined,
        webhookResourceId: data.webhookResourceId as string | undefined,
        webhookExpiration: data.webhookExpiration as Date | undefined,
        ...(data.syncCalendarIds !== undefined && {
          syncCalendarIds: data.syncCalendarIds as string[],
        }),
        ...(data.excludeCalendarIds !== undefined && {
          excludeCalendarIds: data.excludeCalendarIds as string[],
        }),
      },
      update: data,
    });
  },

  /**
   * Update sync token after successful sync
   */
  updateSyncToken: async (userId: string, token: string): Promise<void> => {
    await db.calendarSyncState.update({
      where: { userId },
      data: {
        syncToken: token,
        syncTokenSetAt: new Date(),
        lastSyncAt: new Date(),
        syncError: null,
      },
    });
  },

  /**
   * Clear sync token (forces full sync on next run)
   */
  clearSyncToken: async (userId: string): Promise<void> => {
    await db.calendarSyncState.update({
      where: { userId },
      data: {
        syncToken: null,
        syncTokenSetAt: null,
      },
    });
  },

  /**
   * Set sync error
   */
  setError: async (userId: string, error: string): Promise<void> => {
    await db.calendarSyncState.update({
      where: { userId },
      data: {
        syncStatus: "error",
        syncError: error,
      },
    });
  },

  /**
   * Clear sync error
   */
  clearError: async (userId: string): Promise<void> => {
    await db.calendarSyncState.update({
      where: { userId },
      data: {
        syncError: null,
      },
    });
  },

  /**
   * Set sync status to syncing
   */
  startSync: async (
    userId: string,
    type: "full_sync" | "incremental_sync" = "incremental_sync"
  ): Promise<CalendarSyncState> => {
    return db.calendarSyncState.update({
      where: { userId },
      data: {
        syncStatus: type,
        syncError: null,
        ...(type === "full_sync" && { fullSyncStartedAt: new Date() }),
      },
    });
  },

  /**
   * Complete sync with final statistics
   */
  completeSync: async (
    userId: string,
    stats: {
      eventCount?: number;
      calendarCount?: number;
      syncToken?: string;
    }
  ): Promise<CalendarSyncState> => {
    return db.calendarSyncState.update({
      where: { userId },
      data: {
        syncStatus: "idle",
        lastSyncAt: new Date(),
        syncError: null,
        ...(stats.eventCount !== undefined && { eventCount: stats.eventCount }),
        ...(stats.calendarCount !== undefined && { calendarCount: stats.calendarCount }),
        ...(stats.syncToken && {
          syncToken: stats.syncToken,
          syncTokenSetAt: new Date(),
        }),
      },
    });
  },

  /**
   * Update full sync progress
   */
  updateFullSyncProgress: async (
    userId: string,
    progress: number,
    pageToken?: string
  ): Promise<void> => {
    await db.calendarSyncState.update({
      where: { userId },
      data: {
        fullSyncProgress: progress,
        fullSyncPageToken: pageToken ?? null,
      },
    });
  },

  /**
   * Clear full sync checkpoint
   */
  clearFullSyncCheckpoint: async (userId: string): Promise<void> => {
    await db.calendarSyncState.update({
      where: { userId },
      data: {
        fullSyncPageToken: null,
        fullSyncProgress: 0,
        fullSyncStartedAt: null,
        lastFullSyncAt: new Date(),
      },
    });
  },

  /**
   * Update webhook configuration
   */
  updateWebhook: async (
    userId: string,
    channelId: string,
    resourceId: string,
    expiration: Date
  ): Promise<void> => {
    await db.calendarSyncState.update({
      where: { userId },
      data: {
        webhookChannelId: channelId,
        webhookResourceId: resourceId,
        webhookExpiration: expiration,
      },
    });
  },

  /**
   * Clear webhook configuration
   */
  clearWebhook: async (userId: string): Promise<void> => {
    await db.calendarSyncState.update({
      where: { userId },
      data: {
        webhookChannelId: null,
        webhookResourceId: null,
        webhookExpiration: null,
      },
    });
  },

  /**
   * Update embedding statistics
   */
  updateEmbeddingStats: async (
    userId: string,
    stats: {
      pending?: number;
      completed?: number;
      failed?: number;
    }
  ): Promise<void> => {
    await db.calendarSyncState.update({
      where: { userId },
      data: {
        ...(stats.pending !== undefined && { embeddingsPending: stats.pending }),
        ...(stats.completed !== undefined && { embeddingsCompleted: stats.completed }),
        ...(stats.failed !== undefined && { embeddingsFailed: stats.failed }),
      },
    });
  },

  /**
   * Increment embedding counters
   */
  incrementEmbeddingStats: async (
    userId: string,
    delta: {
      pending?: number;
      completed?: number;
      failed?: number;
    }
  ): Promise<void> => {
    await db.calendarSyncState.update({
      where: { userId },
      data: {
        ...(delta.pending !== undefined && { embeddingsPending: { increment: delta.pending } }),
        ...(delta.completed !== undefined && { embeddingsCompleted: { increment: delta.completed } }),
        ...(delta.failed !== undefined && { embeddingsFailed: { increment: delta.failed } }),
      },
    });
  },

  /**
   * Find users with expiring webhooks
   */
  findExpiringWebhooks: async (withinMs: number): Promise<CalendarSyncState[]> => {
    const expirationThreshold = new Date(Date.now() + withinMs);
    return db.calendarSyncState.findMany({
      where: {
        webhookExpiration: {
          not: null,
          lte: expirationThreshold,
        },
      },
    });
  },

  /**
   * Find sync state by webhook channel ID
   * Used for processing webhook notifications
   */
  findByWebhookChannel: async (channelId: string): Promise<CalendarSyncState | null> => {
    return db.calendarSyncState.findFirst({
      where: {
        webhookChannelId: channelId,
      },
    });
  },

  /**
   * Delete sync state for a user
   */
  delete: async (userId: string): Promise<void> => {
    await db.calendarSyncState.delete({
      where: { userId },
    });
  },
};

// ─────────────────────────────────────────────────────────────
// Calendar Repository
// ─────────────────────────────────────────────────────────────

export const calendarRepository = {
  /**
   * Create a new calendar
   */
  create: async (input: CalendarCreateInput): Promise<Calendar> => {
    return db.calendar.create({
      data: calendarInputToPrisma(input),
    });
  },

  /**
   * Upsert a calendar (create or update based on userId + googleCalendarId)
   */
  upsert: async (input: CalendarCreateInput): Promise<Calendar> => {
    return db.calendar.upsert({
      where: {
        userId_googleCalendarId: {
          userId: input.userId,
          googleCalendarId: input.googleCalendarId,
        },
      },
      create: calendarInputToPrisma(input),
      update: {
        name: input.name,
        description: input.description,
        timeZone: input.timeZone,
        isPrimary: input.isPrimary,
        isOwner: input.isOwner,
        accessRole: input.accessRole,
        backgroundColor: input.backgroundColor,
        foregroundColor: input.foregroundColor,
        isSelected: input.isSelected ?? true,
        isHidden: input.isHidden ?? false,
        updatedAt: new Date(),
      },
    });
  },

  /**
   * Bulk upsert calendars for efficient sync
   */
  upsertMany: async (inputs: CalendarCreateInput[]): Promise<number> => {
    const results = await db.$transaction(
      inputs.map((input) =>
        db.calendar.upsert({
          where: {
            userId_googleCalendarId: {
              userId: input.userId,
              googleCalendarId: input.googleCalendarId,
            },
          },
          create: calendarInputToPrisma(input),
          update: {
            name: input.name,
            description: input.description,
            timeZone: input.timeZone,
            isPrimary: input.isPrimary,
            isOwner: input.isOwner,
            accessRole: input.accessRole,
            backgroundColor: input.backgroundColor,
            foregroundColor: input.foregroundColor,
            isSelected: input.isSelected ?? true,
            isHidden: input.isHidden ?? false,
            updatedAt: new Date(),
          },
        })
      )
    );
    return results.length;
  },

  /**
   * Find all calendars for a user
   */
  findByUser: async (userId: string): Promise<Calendar[]> => {
    return db.calendar.findMany({
      where: { userId },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    });
  },

  /**
   * Find selected calendars for a user (calendars to sync)
   */
  findSelected: async (userId: string): Promise<Calendar[]> => {
    return db.calendar.findMany({
      where: {
        userId,
        isSelected: true,
        isHidden: false,
      },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    });
  },

  /**
   * Find a calendar by Google Calendar ID
   */
  findByGoogleId: async (
    userId: string,
    googleCalendarId: string
  ): Promise<Calendar | null> => {
    return db.calendar.findUnique({
      where: {
        userId_googleCalendarId: { userId, googleCalendarId },
      },
    });
  },

  /**
   * Find a calendar by database ID
   */
  findById: async (id: string): Promise<Calendar | null> => {
    return db.calendar.findUnique({
      where: { id },
    });
  },

  /**
   * Find the primary calendar for a user
   */
  findPrimary: async (userId: string): Promise<Calendar | null> => {
    return db.calendar.findFirst({
      where: { userId, isPrimary: true },
    });
  },

  /**
   * Update a calendar
   */
  update: async (
    id: string,
    data: CalendarUpdateInput
  ): Promise<Calendar | null> => {
    try {
      return await db.calendar.update({
        where: { id },
        data,
      });
    } catch {
      return null;
    }
  },

  /**
   * Update calendar selection status
   */
  updateSelection: async (
    userId: string,
    calendarId: string,
    isSelected: boolean
  ): Promise<void> => {
    await db.calendar.update({
      where: { id: calendarId },
      data: { isSelected },
    });
  },

  /**
   * Bulk update calendar selection
   */
  updateSelectionMany: async (
    userId: string,
    calendarIds: string[],
    isSelected: boolean
  ): Promise<number> => {
    const result = await db.calendar.updateMany({
      where: {
        userId,
        id: { in: calendarIds },
      },
      data: { isSelected },
    });
    return result.count;
  },

  /**
   * Count calendars for a user
   */
  count: async (userId: string): Promise<number> => {
    return db.calendar.count({
      where: { userId },
    });
  },

  /**
   * Delete a calendar by ID
   */
  delete: async (userId: string, calendarId: string): Promise<boolean> => {
    try {
      await db.calendar.delete({
        where: {
          id: calendarId,
          userId, // Ensure user owns the calendar
        },
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Delete all calendars for a user
   */
  deleteAll: async (userId: string): Promise<number> => {
    const result = await db.calendar.deleteMany({
      where: { userId },
    });
    return result.count;
  },

  /**
   * Mark calendars not in the provided list as deleted (for sync cleanup)
   */
  deleteNotIn: async (
    userId: string,
    googleCalendarIds: string[]
  ): Promise<number> => {
    const result = await db.calendar.deleteMany({
      where: {
        userId,
        googleCalendarId: { notIn: googleCalendarIds },
      },
    });
    return result.count;
  },
};

// ─────────────────────────────────────────────────────────────
// Calendar Event Repository
// ─────────────────────────────────────────────────────────────

export const calendarEventRepository = {
  /**
   * Create a new event
   */
  create: async (input: EventDbCreateInput): Promise<Event> => {
    return db.event.create({
      data: eventInputToUncheckedPrisma(input),
    });
  },

  /**
   * Upsert an event (create or update based on googleEventId)
   */
  upsert: async (input: EventDbCreateInput): Promise<Event> => {
    if (!input.googleEventId) {
      // No Google Event ID - just create
      return db.event.create({
        data: eventInputToUncheckedPrisma(input),
      });
    }

    // Find existing non-deleted event by googleEventId and userId
    // We explicitly filter deletedAt: null to:
    // 1. Avoid resurrecting soft-deleted events during sync
    // 2. Ensure deterministic results if duplicates exist
    const existing = await db.event.findFirst({
      where: {
        userId: input.userId,
        googleEventId: input.googleEventId,
        deletedAt: null,
      },
    });

    if (existing) {
      // Update existing event - only include defined fields to preserve existing data
      return db.event.update({
        where: { id: existing.id },
        data: buildEventUpdateData(input),
      });
    }

    // Create new event
    return db.event.create({
      data: eventInputToUncheckedPrisma(input),
    });
  },

  /**
   * Bulk upsert events for efficient sync
   * Uses a transaction to ensure atomicity - all events are upserted or none are.
   */
  upsertMany: async (inputs: EventDbCreateInput[]): Promise<number> => {
    if (inputs.length === 0) return 0;

    // Use interactive transaction for atomicity
    const results = await db.$transaction(async (tx) => {
      const upserted: Event[] = [];

      for (const input of inputs) {
        // Validate required fields
        if (!input.googleEventId) {
          throw new Error("Cannot upsert event without googleEventId");
        }

        // Find existing non-deleted event by googleEventId and userId
        // We explicitly filter deletedAt: null to:
        // 1. Avoid resurrecting soft-deleted events during sync
        // 2. Ensure deterministic results if duplicates exist
        const existing = await tx.event.findFirst({
          where: {
            userId: input.userId,
            googleEventId: input.googleEventId,
            deletedAt: null,
          },
        });

        if (existing) {
          // Update existing event - only include defined fields to preserve existing data
          const updated = await tx.event.update({
            where: { id: existing.id },
            data: buildEventUpdateData(input),
          });
          upserted.push(updated);
        } else {
          // Create new event
          const created = await tx.event.create({
            data: eventInputToUncheckedPrisma(input),
          });
          upserted.push(created);
        }
      }

      return upserted;
    });

    return results.length;
  },

  /**
   * Find an event by internal database ID
   */
  findById: async (id: string): Promise<Event | null> => {
    return db.event.findUnique({
      where: { id },
    });
  },

  /**
   * Find an event by Google Event ID
   */
  findByGoogleId: async (
    userId: string,
    googleEventId: string
  ): Promise<Event | null> => {
    return db.event.findFirst({
      where: {
        userId,
        googleEventId,
        deletedAt: null,
      },
    });
  },

  /**
   * Find events by calendar
   */
  findByCalendar: async (
    userId: string,
    googleCalendarId: string,
    options?: {
      limit?: number;
      offset?: number;
      includeDeleted?: boolean;
    }
  ): Promise<Event[]> => {
    return db.event.findMany({
      where: {
        userId,
        googleCalendarId,
        ...(options?.includeDeleted !== true && { deletedAt: null }),
      },
      orderBy: { startsAt: "asc" },
      take: options?.limit,
      skip: options?.offset,
    });
  },

  /**
   * Find upcoming events for a user
   */
  findUpcoming: async (userId: string, hours: number = 24): Promise<Event[]> => {
    const now = new Date();
    const endTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

    return db.event.findMany({
      where: {
        userId,
        startsAt: {
          gte: now,
          lte: endTime,
        },
        deletedAt: null,
        source: "google_calendar",
      },
      orderBy: { startsAt: "asc" },
    });
  },

  /**
   * Find events in a time range
   */
  findInRange: async (
    userId: string,
    start: Date,
    end: Date,
    options?: {
      calendarId?: string;
      includeDeleted?: boolean;
    }
  ): Promise<Event[]> => {
    return db.event.findMany({
      where: {
        userId,
        source: "google_calendar",
        OR: [
          // Events that start within the range
          {
            startsAt: {
              gte: start,
              lte: end,
            },
          },
          // Events that end within the range
          {
            endsAt: {
              gte: start,
              lte: end,
            },
          },
          // Events that span the entire range
          {
            AND: [
              { startsAt: { lte: start } },
              { endsAt: { gte: end } },
            ],
          },
        ],
        ...(options?.calendarId && { googleCalendarId: options.calendarId }),
        ...(options?.includeDeleted !== true && { deletedAt: null }),
      },
      orderBy: { startsAt: "asc" },
    });
  },

  /**
   * Find events that conflict with a time range
   */
  findConflicts: async (
    userId: string,
    start: Date,
    end: Date,
    excludeEventId?: string
  ): Promise<Event[]> => {
    return db.event.findMany({
      where: {
        userId,
        source: "google_calendar",
        deletedAt: null,
        status: { not: "cancelled" },
        ...(excludeEventId && { id: { not: excludeEventId } }),
        // Event overlaps with the given range
        OR: [
          // Starts during the range
          {
            AND: [
              { startsAt: { gte: start } },
              { startsAt: { lt: end } },
            ],
          },
          // Ends during the range
          {
            AND: [
              { endsAt: { gt: start } },
              { endsAt: { lte: end } },
            ],
          },
          // Encompasses the range
          {
            AND: [
              { startsAt: { lte: start } },
              { endsAt: { gte: end } },
            ],
          },
        ],
      },
      orderBy: { startsAt: "asc" },
    });
  },

  /**
   * Search events
   */
  search: async (
    userId: string,
    query: EventSearchQuery
  ): Promise<EventSearchResult> => {
    const {
      query: searchQuery,
      calendarId,
      googleCalendarId,
      startDate,
      endDate,
      type,
      status,
      allDay,
      hasAttendees,
      hasConference,
      limit = 50,
      offset = 0,
      orderBy = "startsAt",
      orderDirection = "asc",
      includeDeleted = false,
    } = query;

    const where: Prisma.EventWhereInput = {
      userId,
      source: "google_calendar",
      ...(includeDeleted !== true && { deletedAt: null }),
      ...(calendarId && { calendarId }),
      ...(googleCalendarId && { googleCalendarId }),
      ...(type && { type }),
      ...(status && { status }),
      ...(allDay !== undefined && { allDay }),
      ...(hasAttendees !== undefined && {
        attendees: hasAttendees ? { not: Prisma.DbNull } : { equals: Prisma.DbNull },
      }),
      ...(hasConference !== undefined && {
        conferenceData: hasConference ? { not: Prisma.DbNull } : { equals: Prisma.DbNull },
      }),
    };

    // Add text search
    if (searchQuery) {
      where.OR = [
        { title: { contains: searchQuery, mode: "insensitive" } },
        { description: { contains: searchQuery, mode: "insensitive" } },
        { location: { contains: searchQuery, mode: "insensitive" } },
      ];
    }

    // Add date range
    if (startDate || endDate) {
      where.startsAt = {};
      if (startDate) {
        where.startsAt.gte = startDate;
      }
      if (endDate) {
        where.startsAt.lte = endDate;
      }
    }

    const [total, events] = await Promise.all([
      db.event.count({ where }),
      db.event.findMany({
        where,
        orderBy: { [orderBy]: orderDirection },
        take: limit,
        skip: offset,
      }),
    ]);

    return {
      events,
      total,
      hasMore: offset + events.length < total,
    };
  },

  /**
   * Update an event
   */
  update: async (
    id: string,
    data: EventUpdateInput
  ): Promise<Event | null> => {
    try {
      return await db.event.update({
        where: { id },
        data,
      });
    } catch {
      return null;
    }
  },

  /**
   * Update event by Google Event ID
   */
  updateByGoogleId: async (
    userId: string,
    googleEventId: string,
    data: EventUpdateInput
  ): Promise<Event | null> => {
    const event = await calendarEventRepository.findByGoogleId(userId, googleEventId);
    if (!event) return null;
    return calendarEventRepository.update(event.id, data);
  },

  /**
   * Hard delete an event
   */
  delete: async (eventId: string): Promise<boolean> => {
    try {
      await db.event.delete({
        where: { id: eventId },
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Soft delete an event (set deletedAt)
   */
  softDelete: async (eventId: string): Promise<boolean> => {
    try {
      await db.event.update({
        where: { id: eventId },
        data: { deletedAt: new Date() },
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Soft delete event by Google Event ID
   */
  softDeleteByGoogleId: async (
    userId: string,
    googleEventId: string
  ): Promise<boolean> => {
    const event = await calendarEventRepository.findByGoogleId(userId, googleEventId);
    if (!event) return false;
    return calendarEventRepository.softDelete(event.id);
  },

  /**
   * Delete multiple events by Google Event IDs
   */
  deleteMany: async (eventIds: string[]): Promise<number> => {
    const result = await db.event.deleteMany({
      where: { id: { in: eventIds } },
    });
    return result.count;
  },

  /**
   * Soft delete events not in the provided list (for sync cleanup)
   */
  softDeleteNotIn: async (
    userId: string,
    googleCalendarId: string,
    googleEventIds: string[]
  ): Promise<number> => {
    const result = await db.event.updateMany({
      where: {
        userId,
        googleCalendarId,
        googleEventId: { notIn: googleEventIds },
        deletedAt: null,
      },
      data: { deletedAt: new Date() },
    });
    return result.count;
  },

  /**
   * Count events for a user
   */
  count: async (userId: string, includeDeleted = false): Promise<number> => {
    return db.event.count({
      where: {
        userId,
        source: "google_calendar",
        ...(includeDeleted !== true && { deletedAt: null }),
      },
    });
  },

  /**
   * Count events by calendar
   */
  countByCalendar: async (
    userId: string,
    googleCalendarId: string
  ): Promise<number> => {
    return db.event.count({
      where: {
        userId,
        googleCalendarId,
        deletedAt: null,
      },
    });
  },

  /**
   * Get events pending embedding
   */
  findPendingEmbeddings: async (
    userId: string,
    limit = 100
  ): Promise<Event[]> => {
    // Events that don't have embeddings yet (simple heuristic: recently synced)
    return db.event.findMany({
      where: {
        userId,
        source: "google_calendar",
        deletedAt: null,
        // Add embedding tracking field check when available
      },
      orderBy: { sourceSyncedAt: "desc" },
      take: limit,
    });
  },

  /**
   * Find recurring event instances
   */
  findRecurringInstances: async (
    userId: string,
    recurringEventId: string
  ): Promise<Event[]> => {
    return db.event.findMany({
      where: {
        userId,
        recurringEventId,
        deletedAt: null,
      },
      orderBy: { startsAt: "asc" },
    });
  },

  /**
   * Find today's events
   * Uses UTC for consistency since events are stored as UTC Date objects
   */
  findToday: async (userId: string): Promise<Event[]> => {
    const now = new Date();
    // Use UTC methods since events are stored as UTC Date objects
    const startOfDay = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      0, 0, 0, 0
    ));
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    return calendarEventRepository.findInRange(userId, startOfDay, endOfDay);
  },

  /**
   * Find events for this week
   * Uses UTC for consistency since events are stored as UTC Date objects
   */
  findThisWeek: async (userId: string): Promise<Event[]> => {
    const now = new Date();
    // Use UTC methods since events are stored as UTC Date objects
    const dayOfWeek = now.getUTCDay();
    const startOfWeek = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - dayOfWeek,
      0, 0, 0, 0
    ));

    const endOfWeek = new Date(startOfWeek.getTime() + 7 * 24 * 60 * 60 * 1000);

    return calendarEventRepository.findInRange(userId, startOfWeek, endOfWeek);
  },
};

// ─────────────────────────────────────────────────────────────
// Calendar Approval Repository
// ─────────────────────────────────────────────────────────────

export const calendarApprovalRepository = {
  /**
   * Create a new approval request
   */
  create: async (input: ApprovalCreateInput): Promise<CalendarApproval> => {
    return db.calendarApproval.create({
      data: {
        user: { connect: { id: input.userId } },
        actionType: input.actionType,
        calendarId: input.calendarId,
        eventId: input.eventId,
        eventSnapshot: input.eventSnapshot,
        requestedBy: input.requestedBy,
        expiresAt: input.expiresAt,
        metadata: input.metadata ?? {},
      },
    });
  },

  /**
   * Find approval by ID
   */
  findById: async (id: string): Promise<CalendarApproval | null> => {
    return db.calendarApproval.findUnique({
      where: { id },
    });
  },

  /**
   * Find approval by ID for a specific user
   */
  findByUserAndId: async (
    userId: string,
    id: string
  ): Promise<CalendarApproval | null> => {
    return db.calendarApproval.findFirst({
      where: { id, userId },
    });
  },

  /**
   * Find pending approvals for a user
   */
  findPending: async (userId: string): Promise<CalendarApproval[]> => {
    return db.calendarApproval.findMany({
      where: {
        userId,
        status: "pending",
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      orderBy: { requestedAt: "desc" },
    });
  },

  /**
   * Find approvals by status
   */
  findByStatus: async (
    userId: string,
    status: CalendarApprovalStatus
  ): Promise<CalendarApproval[]> => {
    return db.calendarApproval.findMany({
      where: { userId, status },
      orderBy: { requestedAt: "desc" },
    });
  },

  /**
   * Find expired approvals
   */
  findExpired: async (): Promise<CalendarApproval[]> => {
    return db.calendarApproval.findMany({
      where: {
        status: "pending",
        expiresAt: {
          not: null,
          lte: new Date(),
        },
      },
    });
  },

  /**
   * Update an approval
   */
  update: async (
    id: string,
    data: ApprovalUpdateInput
  ): Promise<CalendarApproval | null> => {
    try {
      return await db.calendarApproval.update({
        where: { id },
        data,
      });
    } catch {
      return null;
    }
  },

  /**
   * Approve an approval request
   */
  approve: async (id: string, decidedBy?: string): Promise<CalendarApproval> => {
    return db.calendarApproval.update({
      where: { id },
      data: {
        status: "approved",
        decidedAt: new Date(),
        decidedBy: decidedBy ?? "user",
      },
    });
  },

  /**
   * Reject an approval request
   */
  reject: async (id: string, notes?: string, decidedBy?: string): Promise<CalendarApproval> => {
    return db.calendarApproval.update({
      where: { id },
      data: {
        status: "rejected",
        decidedAt: new Date(),
        decidedBy: decidedBy ?? "user",
        notes,
      },
    });
  },

  /**
   * Mark approval as expired
   */
  expire: async (id: string): Promise<CalendarApproval> => {
    return db.calendarApproval.update({
      where: { id },
      data: {
        status: "expired",
        decidedAt: new Date(),
        decidedBy: "auto_expired",
      },
    });
  },

  /**
   * Expire all pending approvals that have passed their expiration
   */
  expireAll: async (): Promise<number> => {
    const result = await db.calendarApproval.updateMany({
      where: {
        status: "pending",
        expiresAt: {
          not: null,
          lte: new Date(),
        },
      },
      data: {
        status: "expired",
        decidedAt: new Date(),
        decidedBy: "auto_expired",
      },
    });
    return result.count;
  },

  /**
   * Mark approval as executed
   */
  markExecuted: async (
    id: string,
    resultEventId?: string
  ): Promise<CalendarApproval> => {
    return db.calendarApproval.update({
      where: { id },
      data: {
        status: "executed",
        resultEventId,
      },
    });
  },

  /**
   * Mark approval as failed
   */
  markFailed: async (
    id: string,
    errorMessage: string
  ): Promise<CalendarApproval> => {
    return db.calendarApproval.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage,
      },
    });
  },

  /**
   * Count pending approvals for a user
   */
  countPending: async (userId: string): Promise<number> => {
    return db.calendarApproval.count({
      where: {
        userId,
        status: "pending",
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
  },

  /**
   * Find recent approvals for a user
   */
  findRecent: async (userId: string, limit = 20): Promise<CalendarApproval[]> => {
    return db.calendarApproval.findMany({
      where: { userId },
      orderBy: { requestedAt: "desc" },
      take: limit,
    });
  },

  /**
   * Delete old approvals (cleanup)
   */
  deleteOld: async (olderThan: Date): Promise<number> => {
    const result = await db.calendarApproval.deleteMany({
      where: {
        status: { in: ["executed", "expired", "rejected", "failed"] },
        decidedAt: { lt: olderThan },
      },
    });
    return result.count;
  },

  /**
   * Delete all approvals for a user
   */
  deleteAll: async (userId: string): Promise<number> => {
    const result = await db.calendarApproval.deleteMany({
      where: { userId },
    });
    return result.count;
  },
};

