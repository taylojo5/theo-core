// ═══════════════════════════════════════════════════════════════════════════
// Update Calendar Event Tool
// Action tool for modifying calendar events (requires Calendar integration + approval)
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { defineTool, objectSchema } from "../types";
import { requestEventUpdate } from "@/integrations/calendar/actions";
import { calendarEventRepository } from "@/integrations/calendar/repository";
import type { EventVisibility } from "@/integrations/calendar/types";
import { DateTime } from "luxon";

// ─────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────

/** Email regex for attendees */
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Input schema for calendar event update */
const updateCalendarEventInputSchema = z.object({
  eventId: z.string().min(1, "Event ID is required"),
  calendarId: z.string().optional(), // Required for Google API, may be inferred
  summary: z.string().min(1).max(1000).optional(),
  description: z.string().max(10000).optional().nullable(),
  location: z.string().max(1000).optional().nullable(),
  startTime: z
    .string()
    .refine((val) => !val || DateTime.fromISO(val).isValid, {
      message: "Invalid start time format",
    })
    .optional(),
  endTime: z
    .string()
    .refine((val) => !val || DateTime.fromISO(val).isValid, {
      message: "Invalid end time format",
    })
    .optional(),
  timeZone: z.string().optional(),
  // Attendee modifications
  addAttendees: z
    .array(
      z.object({
        email: z.string().regex(emailRegex),
        optional: z.boolean().optional(),
      })
    )
    .optional(),
  removeAttendees: z.array(z.string().regex(emailRegex)).optional(),
  // Meeting link
  createMeetLink: z.boolean().optional(),
  removeMeetLink: z.boolean().optional(),
  // Visibility
  visibility: z.enum(["default", "public", "private", "confidential"]).optional(),
  // How to notify attendees
  sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
});

type UpdateCalendarEventInput = z.infer<typeof updateCalendarEventInputSchema>;

/** Output type for calendar event update */
interface UpdateCalendarEventOutput {
  success: boolean;
  requiresApproval: boolean;
  approval: {
    id: string;
    expiresAt: string;
  };
  changes: string[];
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

export const updateCalendarEventTool: ToolDefinition<
  UpdateCalendarEventInput,
  UpdateCalendarEventOutput
> = defineTool({
  // ═══════════════════════════════════════════════════════════
  // LLM Interface
  // ═══════════════════════════════════════════════════════════
  name: "update_calendar_event",
  description: "Modify an existing calendar event (requires user approval)",

  whenToUse: `Use when the user wants to:
- Reschedule: "Move my 2pm meeting to 3pm", "Reschedule to tomorrow"
- Add people: "Add John to the meeting", "Invite Sarah"
- Remove people: "Remove John from the invite"
- Change details: "Update the meeting title", "Add a location"
- Modify duration: "Make it 30 minutes instead", "Extend by an hour"

Requires an event ID from prior context or a list_calendar_events query.
Do NOT use to create new events (use create_calendar_event instead).`,

  examples: [
    'User: "Move my 2pm meeting to 3pm" → update_calendar_event({ eventId: "...", startTime: "...T15:00:00", endTime: "...T16:00:00" })',
    'User: "Add John to the team meeting" → update_calendar_event({ eventId: "...", addAttendees: [{ email: "john@..." }] })',
    'User: "Change the location to Room 101" → update_calendar_event({ eventId: "...", location: "Room 101" })',
    'User: "Remove the meeting description" → update_calendar_event({ eventId: "...", description: null })',
    'User: "Add a Google Meet link" → update_calendar_event({ eventId: "...", createMeetLink: true })',
  ],

  parametersSchema: objectSchema(
    {
      eventId: {
        type: "string",
        description: "The ID of the event to update",
      },
      calendarId: {
        type: "string",
        description: "Calendar ID (if known)",
      },
      summary: {
        type: "string",
        description: "New event title",
        maxLength: 1000,
      },
      description: {
        type: "string",
        description: "New description (null to clear)",
        maxLength: 10000,
      },
      location: {
        type: "string",
        description: "New location (null to clear)",
        maxLength: 1000,
      },
      startTime: {
        type: "string",
        format: "date-time",
        description: "New start time (ISO 8601)",
      },
      endTime: {
        type: "string",
        format: "date-time",
        description: "New end time (ISO 8601)",
      },
      timeZone: {
        type: "string",
        description: "Time zone for the event",
      },
      addAttendees: {
        type: "array",
        items: {
          type: "object",
          properties: {
            email: { type: "string", format: "email" },
            optional: { type: "boolean" },
          },
          required: ["email"],
        },
        description: "Attendees to add to the event",
      },
      removeAttendees: {
        type: "array",
        items: { type: "string", format: "email" },
        description: "Attendee emails to remove from the event",
      },
      createMeetLink: {
        type: "boolean",
        description: "Add a Google Meet link",
      },
      removeMeetLink: {
        type: "boolean",
        description: "Remove the Google Meet link",
      },
      visibility: {
        type: "string",
        enum: ["default", "public", "private", "confidential"],
        description: "Event visibility",
      },
      sendUpdates: {
        type: "string",
        enum: ["all", "externalOnly", "none"],
        description: "How to notify attendees of changes",
      },
    },
    ["eventId"] // Required fields
  ),

  // ═══════════════════════════════════════════════════════════
  // Internal Configuration
  // ═══════════════════════════════════════════════════════════
  category: "external",
  riskLevel: "high", // Affects user's schedule, may notify attendees
  requiresApproval: true, // Always requires user approval
  requiredIntegrations: ["calendar"],

  // ═══════════════════════════════════════════════════════════
  // Validation & Execution
  // ═══════════════════════════════════════════════════════════
  inputValidator: updateCalendarEventInputSchema,

  execute: async (input, context): Promise<UpdateCalendarEventOutput> => {
    const {
      eventId,
      calendarId,
      summary,
      description,
      location,
      startTime,
      endTime,
      timeZone,
      addAttendees,
      removeAttendees,
      createMeetLink,
      removeMeetLink,
      visibility,
      sendUpdates,
    } = input;

    // Track changes for the response
    const changes: string[] = [];

    // Build update object - must match EventUpdateInput type
    const updates: Record<string, unknown> = {};

    if (summary !== undefined) {
      updates.summary = summary;
      changes.push(`title → "${summary}"`);
    }

    if (description !== undefined) {
      updates.description = description ?? undefined;
      changes.push(description === null ? "cleared description" : "updated description");
    }

    if (location !== undefined) {
      updates.location = location ?? undefined;
      changes.push(location === null ? "cleared location" : `location → "${location}"`);
    }

    // Handle time updates
    if (startTime || endTime) {
      const startDt = startTime ? DateTime.fromISO(startTime) : undefined;
      const endDt = endTime ? DateTime.fromISO(endTime) : undefined;

      // Validate that end time is after start time when both are provided
      if (startDt && endDt && endDt <= startDt) {
        throw new Error("End time must be after start time");
      }

      if (startDt) {
        updates.start = {
          dateTime: startDt.toISO()!,
          timeZone: timeZone || startDt.zoneName || "UTC",
        };
        changes.push(`start → ${startDt.toLocaleString(DateTime.DATETIME_MED)}`);
      }

      if (endDt) {
        updates.end = {
          dateTime: endDt.toISO()!,
          timeZone: timeZone || endDt.zoneName || "UTC",
        };
        changes.push(`end → ${endDt.toLocaleString(DateTime.TIME_SIMPLE)}`);
      }
    }

    // Handle attendee modifications
    // We need to fetch current attendees if adding or removing to properly merge
    if (addAttendees?.length || removeAttendees?.length) {
      // Fetch the existing event to get current attendees
      const existingEvent = await calendarEventRepository.findById(eventId);
      
      if (!existingEvent) {
        throw new Error("Event not found - cannot modify attendees");
      }

      // Defense-in-depth: verify ownership before reading event data
      // (requestEventUpdate will also verify, but we shouldn't read data we don't own)
      if (existingEvent.userId !== context.userId) {
        throw new Error("Permission denied - you do not own this event");
      }

      // Parse existing attendees from JSON (stored as JSONB in database)
      let currentAttendees: Array<{ email: string; optional?: boolean; responseStatus?: string }> = [];
      if (existingEvent.attendees && typeof existingEvent.attendees === "object") {
        // attendees is stored as Prisma.JsonValue, need to parse it
        if (Array.isArray(existingEvent.attendees)) {
          currentAttendees = existingEvent.attendees as Array<{ 
            email: string; 
            optional?: boolean; 
            responseStatus?: string;
          }>;
        }
      }

      // Create a map for faster lookups (email -> attendee)
      const attendeeMap = new Map<string, { email: string; optional?: boolean; responseStatus?: string }>();
      for (const attendee of currentAttendees) {
        if (attendee.email) {
          attendeeMap.set(attendee.email.toLowerCase(), attendee);
        }
      }

      // Remove attendees if specified
      if (removeAttendees?.length) {
        const removeSet = new Set(removeAttendees.map(e => e.toLowerCase()));
        for (const email of removeSet) {
          attendeeMap.delete(email);
        }
        // Use removeSet.size for accurate count (handles duplicate emails in input)
        changes.push(`removing ${removeSet.size} attendee(s)`);
      }

      // Add new attendees if specified
      if (addAttendees?.length) {
        let actuallyAdded = 0;
        for (const newAttendee of addAttendees) {
          const emailLower = newAttendee.email.toLowerCase();
          const existingAttendee = attendeeMap.get(emailLower);
          
          if (existingAttendee) {
            // Attendee already exists - only update optional flag if specified,
            // preserve their existing responseStatus (don't reset accepted/declined)
            attendeeMap.set(emailLower, {
              ...existingAttendee,
              email: newAttendee.email, // Use the case from the new request
              ...(newAttendee.optional !== undefined && { optional: newAttendee.optional }),
            });
          } else {
            // Truly new attendee - set to needsAction
            attendeeMap.set(emailLower, { 
              email: newAttendee.email, 
              optional: newAttendee.optional,
              responseStatus: "needsAction",
            });
            actuallyAdded++;
          }
        }
        // More accurate change message
        if (actuallyAdded > 0) {
          changes.push(`adding ${actuallyAdded} attendee(s)`);
        }
        if (addAttendees.length > actuallyAdded) {
          changes.push(`updating ${addAttendees.length - actuallyAdded} existing attendee(s)`);
        }
      }

      // Convert map back to array for the update
      updates.attendees = Array.from(attendeeMap.values());
    }

    // Handle Meet link - stored in metadata for action layer to process
    if (createMeetLink) {
      changes.push("adding Google Meet link (pending)");
    } else if (removeMeetLink) {
      changes.push("removing Google Meet link (pending)");
    }

    if (visibility !== undefined) {
      updates.visibility = visibility as EventVisibility;
      changes.push(`visibility → ${visibility}`);
    }

    // Determine calendar ID
    const targetCalendarId = calendarId || "primary";

    // Request the update
    const result = await requestEventUpdate({
      actionType: "update",
      userId: context.userId,
      calendarId: targetCalendarId,
      eventId,
      requestedBy: "agent",
      notes: context.conversationId ? `From conversation: ${context.conversationId}` : undefined,
      checkConflicts: !!(startTime || endTime), // Only check conflicts if time is changing
      sendUpdates: sendUpdates || "all",
      updates,
    });

    if (!result.success || !result.approval) {
      throw new Error(result.error || "Failed to create event update request");
    }

    // Build conflict list if any
    const conflicts = result.conflicts?.map((c) => ({
      title: c.title,
      startTime: c.startsAt.toISOString(),
      endTime: c.endsAt.toISOString(),
    }));

    // Build message
    let message: string;
    if (changes.length === 0) {
      message = "No changes specified for the event.";
    } else if (changes.length === 1) {
      message = `Proposed update: ${changes[0]}. Awaiting your approval.`;
    } else {
      message = `Proposed ${changes.length} changes. Awaiting your approval.`;
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
      changes,
      conflicts,
      message,
    };
  },
});

