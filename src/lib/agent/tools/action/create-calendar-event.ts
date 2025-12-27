// ═══════════════════════════════════════════════════════════════════════════
// Create Calendar Event Tool
// Action tool for creating calendar events (requires Calendar integration + approval)
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { defineTool, objectSchema } from "../types";
import { requestEventCreation } from "@/integrations/calendar/actions";
import type { EventVisibility } from "@/integrations/calendar/types";
import { DateTime } from "luxon";

// ─────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────

/** Email regex for attendees */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Input schema for calendar event creation */
const createCalendarEventInputSchema = z.object({
  calendarId: z.string().optional(), // Uses primary calendar if not specified
  summary: z.string().min(1, "Event title is required").max(1000),
  description: z.string().max(10000).optional(),
  location: z.string().max(1000).optional(),
  startTime: z.string().refine((val) => DateTime.fromISO(val).isValid, {
    message: "Invalid start time. Use ISO 8601 format (e.g., 2024-01-15T14:00:00)",
  }),
  endTime: z.string().refine((val) => DateTime.fromISO(val).isValid, {
    message: "Invalid end time. Use ISO 8601 format (e.g., 2024-01-15T15:00:00)",
  }),
  timeZone: z.string().optional(), // Defaults to user's timezone
  allDay: z.boolean().optional(),
  attendees: z
    .array(
      z.object({
        email: z.string().regex(emailRegex, "Invalid attendee email"),
        optional: z.boolean().optional(),
      })
    )
    .max(100)
    .optional(),
  createMeetLink: z.boolean().optional(),
  visibility: z.enum(["default", "public", "private", "confidential"]).optional(),
  reminderMinutes: z.number().int().min(0).max(40320).optional(), // Max 4 weeks
  recurrence: z.array(z.string()).optional(), // RRULE strings
});

type CreateCalendarEventInput = z.infer<typeof createCalendarEventInputSchema>;

/** Output type for calendar event creation */
interface CreateCalendarEventOutput {
  success: boolean;
  requiresApproval: boolean;
  approval: {
    id: string;
    expiresAt: string;
  };
  eventPreview: {
    summary: string;
    startTime: string;
    endTime: string;
    location?: string;
    attendeeCount: number;
    hasMeetLink: boolean;
  };
  conflicts?: Array<{
    title: string;
    startTime: string;
    endTime: string;
  }>;
  message: string;
}

// ─────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────

export const createCalendarEventTool: ToolDefinition<
  CreateCalendarEventInput,
  CreateCalendarEventOutput
> = defineTool({
  // ═══════════════════════════════════════════════════════════
  // LLM Interface
  // ═══════════════════════════════════════════════════════════
  name: "create_calendar_event",
  description: "Schedule a new calendar event (requires user approval)",

  whenToUse: `Use when the user wants to:
- Schedule a meeting: "Schedule a meeting with...", "Book a meeting..."
- Add an event: "Add to my calendar...", "Put on my calendar..."
- Set an appointment: "Schedule an appointment...", "Book time for..."
- Create recurring events: "Set up a weekly meeting..."
- Block time: "Block off 2pm-3pm for..."

This creates an approval request. The event is NOT created until approved.
Consider using check_availability first to verify time slots.`,

  examples: [
    'User: "Schedule a meeting with Sarah tomorrow at 2pm" → create_calendar_event({ summary: "Meeting with Sarah", startTime: "2024-01-16T14:00:00", endTime: "2024-01-16T15:00:00" })',
    'User: "Book a 30 minute call with John at 3pm" → create_calendar_event({ summary: "Call with John", startTime: "...", endTime: "...", attendees: [{ email: "john@..." }], createMeetLink: true })',
    'User: "Add dentist appointment on Friday 10am-11am" → create_calendar_event({ summary: "Dentist appointment", startTime: "2024-01-19T10:00:00", endTime: "2024-01-19T11:00:00", location: "..." })',
    'User: "Set up a weekly team sync every Monday at 9am" → create_calendar_event({ summary: "Team Sync", startTime: "...", endTime: "...", recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"] })',
  ],

  parametersSchema: objectSchema(
    {
      calendarId: {
        type: "string",
        description: "Calendar ID (defaults to primary calendar if not specified)",
      },
      summary: {
        type: "string",
        description: "Event title/name",
        minLength: 1,
        maxLength: 1000,
      },
      description: {
        type: "string",
        description: "Event description or agenda",
        maxLength: 10000,
      },
      location: {
        type: "string",
        description: "Event location (address, room, or virtual)",
        maxLength: 1000,
      },
      startTime: {
        type: "string",
        format: "date-time",
        description: "Event start time (ISO 8601 format)",
      },
      endTime: {
        type: "string",
        format: "date-time",
        description: "Event end time (ISO 8601 format)",
      },
      timeZone: {
        type: "string",
        description: "Time zone (e.g., 'America/New_York'). Defaults to user's timezone.",
      },
      allDay: {
        type: "boolean",
        description: "Whether this is an all-day event",
      },
      attendees: {
        type: "array",
        items: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            optional: { type: "boolean" },
          },
          required: ["email"],
        },
        description: "People to invite to the event",
      },
      createMeetLink: {
        type: "boolean",
        description: "Whether to create a Google Meet link",
      },
      visibility: {
        type: "string",
        enum: ["default", "public", "private", "confidential"],
        description: "Event visibility",
      },
      reminderMinutes: {
        type: "integer",
        description: "Minutes before event to send reminder",
        minimum: 0,
        maximum: 40320,
      },
      recurrence: {
        type: "array",
        items: { type: "string" },
        description: "RRULE recurrence rules (e.g., 'RRULE:FREQ=WEEKLY;BYDAY=MO')",
      },
    },
    ["summary", "startTime", "endTime"] // Required fields
  ),

  // ═══════════════════════════════════════════════════════════
  // Internal Configuration
  // ═══════════════════════════════════════════════════════════
  category: "external",
  riskLevel: "high", // Affects user's schedule, may invite others
  requiresApproval: true, // Always requires user approval
  requiredIntegrations: ["calendar"],

  // ═══════════════════════════════════════════════════════════
  // Validation & Execution
  // ═══════════════════════════════════════════════════════════
  inputValidator: createCalendarEventInputSchema,

  execute: async (input, context): Promise<CreateCalendarEventOutput> => {
    const {
      calendarId,
      summary,
      description,
      location,
      startTime,
      endTime,
      timeZone,
      allDay,
      attendees,
      createMeetLink,
      visibility,
      reminderMinutes,
      recurrence,
    } = input;

    // Parse times
    const startDt = DateTime.fromISO(startTime);
    const endDt = DateTime.fromISO(endTime);

    // Validate end is after start
    if (endDt <= startDt) {
      throw new Error("End time must be after start time");
    }

    // Determine calendar ID (use primary if not specified)
    const targetCalendarId = calendarId || "primary";
    const isAllDay = allDay ?? false;

    // Build event creation request
    const result = await requestEventCreation({
      actionType: "create",
      userId: context.userId,
      calendarId: targetCalendarId,
      requestedBy: "agent",
      notes: context.conversationId ? `From conversation: ${context.conversationId}` : undefined,
      checkConflicts: true,
      event: {
        summary,
        description,
        location,
        start: isAllDay
          ? { date: startDt.toISODate()! }
          : { dateTime: startDt.toISO()!, timeZone: timeZone || startDt.zoneName || "UTC" },
        end: isAllDay
          ? { date: endDt.toISODate()! }
          : { dateTime: endDt.toISO()!, timeZone: timeZone || endDt.zoneName || "UTC" },
        timeZone: timeZone || startDt.zoneName || "UTC",
        attendees: attendees?.map((a) => ({ email: a.email, optional: a.optional })),
        createConference: createMeetLink,
        visibility: visibility as EventVisibility,
        reminders:
          reminderMinutes !== undefined
            ? {
                useDefault: false,
                overrides: [{ method: "popup" as const, minutes: reminderMinutes }],
              }
            : undefined,
        recurrence,
      },
    });

    if (!result.success || !result.approval) {
      throw new Error(result.error || "Failed to create calendar event request");
    }

    // Format time for display
    const formattedStart = startDt.toLocaleString(DateTime.DATETIME_MED);
    const formattedEnd = endDt.toLocaleString(DateTime.TIME_SIMPLE);

    // Build conflict list if any
    const conflicts = result.conflicts?.map((c) => ({
      title: c.title,
      startTime: c.startsAt.toISOString(),
      endTime: c.endsAt.toISOString(),
    }));

    // Build message
    let message = `Created event "${summary}" (${formattedStart} - ${formattedEnd}) for your approval.`;
    if (attendees?.length) {
      message += ` ${attendees.length} attendee(s) will be invited.`;
    }
    if (conflicts?.length) {
      message += ` Note: ${conflicts.length} potential conflict(s) detected.`;
    }

    return {
      success: true,
      requiresApproval: true,
      approval: {
        id: result.approvalId!,
        expiresAt: result.approval.expiresAt?.toISOString() ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
      eventPreview: {
        summary,
        startTime,
        endTime,
        location,
        attendeeCount: attendees?.length || 0,
        hasMeetLink: createMeetLink || false,
      },
      conflicts,
      message,
    };
  },
});

