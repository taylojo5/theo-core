// ═══════════════════════════════════════════════════════════════════════════
// Calendar OpenAPI Schemas
// Schema definitions for Calendar integration endpoints
// ═══════════════════════════════════════════════════════════════════════════

import { z, MetadataSchema } from "./common";

// ─────────────────────────────────────────────────────────────
// Calendar Schemas
// ─────────────────────────────────────────────────────────────

export const CalendarSchema = z
  .object({
    id: z.string().openapi({ description: "Calendar ID" }),
    userId: z.string(),
    googleCalendarId: z.string().openapi({ description: "Google Calendar ID" }),
    name: z.string().openapi({ description: "Calendar name" }),
    description: z.string().nullable(),
    timeZone: z.string().nullable(),
    isPrimary: z.boolean(),
    isOwner: z.boolean(),
    accessRole: z.string(),
    backgroundColor: z.string().nullable(),
    foregroundColor: z.string().nullable(),
    isSelected: z.boolean(),
    isHidden: z.boolean(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("Calendar");

export const CalendarListResponseSchema = z
  .object({
    calendars: z.array(CalendarSchema),
    count: z.number(),
  })
  .openapi("CalendarListResponse");

export const CalendarUpdateSchema = z
  .object({
    isSelected: z.boolean().optional().openapi({
      description: "Whether to include this calendar in sync",
    }),
    isHidden: z.boolean().optional().openapi({
      description: "Whether to hide this calendar from the UI",
    }),
  })
  .openapi("CalendarUpdate");

// ─────────────────────────────────────────────────────────────
// Event Schemas
// ─────────────────────────────────────────────────────────────

export const AttendeeSchema = z
  .object({
    email: z.string().email(),
    displayName: z.string().optional(),
    optional: z.boolean().optional(),
  })
  .openapi("Attendee");

export const ReminderOverrideSchema = z
  .object({
    method: z.enum(["email", "popup"]),
    minutes: z.number().min(0),
  })
  .openapi("ReminderOverride");

export const RemindersSchema = z
  .object({
    useDefault: z.boolean().optional(),
    overrides: z.array(ReminderOverrideSchema).optional(),
  })
  .openapi("Reminders");

export const CalendarEventSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    googleEventId: z.string().nullable(),
    googleCalendarId: z.string().nullable(),
    calendarId: z.string().nullable(),
    title: z.string(),
    description: z.string().nullable(),
    startsAt: z.string().datetime(),
    endsAt: z.string().datetime().nullable(),
    allDay: z.boolean(),
    timezone: z.string().nullable(),
    location: z.string().nullable(),
    status: z.string().nullable(),
    visibility: z.string().nullable(),
    attendees: z.any().nullable(),
    organizer: z.any().nullable(),
    recurrence: z.any().nullable(),
    conferenceData: z.any().nullable(),
    hangoutLink: z.string().nullable(),
    htmlLink: z.string().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("CalendarEvent");

export const CalendarEventListResponseSchema = z
  .object({
    events: z.array(CalendarEventSchema),
    total: z.number(),
    hasMore: z.boolean(),
    offset: z.number(),
    limit: z.number(),
  })
  .openapi("CalendarEventListResponse");

export const CalendarEventCreateSchema = z
  .object({
    calendarId: z.string().min(1).openapi({
      description: "Target calendar ID",
    }),
    title: z.string().min(1).openapi({
      description: "Event title",
      example: "Team Meeting",
    }),
    description: z.string().optional().openapi({
      description: "Event description",
    }),
    startsAt: z.string().datetime().openapi({
      description: "Event start time (ISO 8601)",
    }),
    endsAt: z.string().datetime().optional().openapi({
      description: "Event end time (ISO 8601)",
    }),
    allDay: z.boolean().optional().openapi({
      description: "Whether this is an all-day event",
    }),
    timezone: z.string().optional().openapi({
      description: "Timezone for the event",
      example: "America/New_York",
    }),
    location: z.string().optional().openapi({
      description: "Event location",
    }),
    attendees: z.array(AttendeeSchema).optional().openapi({
      description: "Event attendees",
    }),
    recurrence: z.array(z.string()).optional().openapi({
      description: "RRULE recurrence rules",
    }),
    reminders: RemindersSchema.optional(),
    visibility: z.enum(["default", "public", "private"]).optional(),
    sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
    requestedBy: z.string().optional(),
    checkConflicts: z.boolean().optional(),
    metadata: MetadataSchema.optional(),
  })
  .openapi("CalendarEventCreate");

export const CalendarEventUpdateSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    allDay: z.boolean().optional(),
    timezone: z.string().optional(),
    location: z.string().optional(),
    attendees: z.array(AttendeeSchema).optional(),
    recurrence: z.array(z.string()).optional(),
    reminders: RemindersSchema.optional(),
    visibility: z.enum(["default", "public", "private"]).optional(),
    sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
    requestedBy: z.string().optional(),
    checkConflicts: z.boolean().optional(),
    metadata: MetadataSchema.optional(),
  })
  .openapi("CalendarEventUpdate");

export const EventResponseSchema = z
  .object({
    response: z.enum(["accepted", "declined", "tentative"]).openapi({
      description: "RSVP response",
    }),
    comment: z.string().optional(),
    sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
    requestedBy: z.string().optional(),
    metadata: MetadataSchema.optional(),
  })
  .openapi("EventResponse");

// ─────────────────────────────────────────────────────────────
// Approval Schemas
// ─────────────────────────────────────────────────────────────

export const CalendarApprovalSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    actionType: z.enum(["create", "update", "delete", "respond"]),
    calendarId: z.string(),
    eventId: z.string().nullable(),
    eventSnapshot: z.any(),
    status: z.enum([
      "pending",
      "approved",
      "rejected",
      "expired",
      "executed",
      "failed",
      "cancelled",
    ]),
    requestedAt: z.string().datetime(),
    requestedBy: z.string().nullable(),
    expiresAt: z.string().datetime().nullable(),
    decidedAt: z.string().datetime().nullable(),
    decidedBy: z.string().nullable(),
    resultEventId: z.string().nullable(),
    errorMessage: z.string().nullable(),
    notes: z.string().nullable(),
    metadata: MetadataSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .openapi("CalendarApproval");

export const CalendarApprovalListResponseSchema = z
  .object({
    approvals: z.array(CalendarApprovalSchema),
    total: z.number(),
    count: z.number(),
    offset: z.number(),
    limit: z.number(),
    hasMore: z.boolean(),
  })
  .openapi("CalendarApprovalListResponse");

export const CalendarApprovalActionSchema = z
  .object({
    action: z.enum(["approve", "reject", "cancel"]).openapi({
      description: "Action to take on the approval",
    }),
    notes: z.string().optional().openapi({
      description: "Optional notes about the decision",
    }),
    decidedBy: z.string().optional().openapi({
      description: "Who made the decision",
    }),
    autoExecute: z.boolean().optional().openapi({
      description: "Whether to auto-execute on approval (default: true)",
    }),
  })
  .openapi("CalendarApprovalAction");

// ─────────────────────────────────────────────────────────────
// Sync Schemas
// ─────────────────────────────────────────────────────────────

export const CalendarSyncTriggerSchema = z
  .object({
    type: z.enum(["auto", "full", "incremental"]).optional().openapi({
      description: "Type of sync to trigger",
    }),
    enableRecurring: z.boolean().optional().openapi({
      description: "Enable/disable recurring sync",
    }),
  })
  .openapi("CalendarSyncTrigger");

export const CalendarSyncStatusSchema = z
  .object({
    status: z.enum([
      "idle",
      "syncing",
      "full_sync",
      "incremental_sync",
      "error",
      "paused",
    ]),
    lastSyncAt: z.string().datetime().nullable(),
    lastFullSyncAt: z.string().datetime().nullable(),
    syncToken: z.string().nullable().openapi({
      description: "'present' if sync token exists, null otherwise",
    }),
    recurring: z.boolean(),
    stats: z.object({
      eventCount: z.number(),
      calendarCount: z.number(),
      embeddingsPending: z.number(),
      embeddingsCompleted: z.number(),
      embeddingsFailed: z.number(),
    }),
    error: z.string().nullable(),
    webhook: z.object({
      active: z.boolean(),
      expiresAt: z.string().datetime().nullable(),
    }),
  })
  .openapi("CalendarSyncStatus");

// ─────────────────────────────────────────────────────────────
// Webhook Schemas
// ─────────────────────────────────────────────────────────────

export const CalendarWebhookResponseSchema = z
  .object({
    received: z.boolean(),
    processed: z.boolean().optional(),
    triggeredSync: z.boolean().optional(),
    eventsProcessed: z.number().optional(),
    error: z.string().optional(),
  })
  .openapi("CalendarWebhookResponse");

// ─────────────────────────────────────────────────────────────
// Action Result Schemas
// ─────────────────────────────────────────────────────────────

export const CalendarActionResultSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    approvalId: z.string().optional(),
    approval: CalendarApprovalSchema.optional(),
  })
  .openapi("CalendarActionResult");

export const CalendarApprovalResultSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
    approval: CalendarApprovalSchema.optional(),
    executedResult: z
      .object({
        success: z.boolean(),
        event: CalendarEventSchema.optional(),
        message: z.string(),
      })
      .optional(),
  })
  .openapi("CalendarApprovalResult");

