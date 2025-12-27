// ═══════════════════════════════════════════════════════════════════════════
// List Calendar Events Tool
// Query calendar events by date range and filters
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { defineTool, objectSchema } from "../types";
import { calendarEventRepository } from "@/integrations/calendar/repository";

// ─────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────

/** Input schema for calendar event query */
const listCalendarEventsInputSchema = z.object({
  startDate: z.string().refine(
    (val) => !isNaN(new Date(val).getTime()),
    { message: "Invalid start date format" }
  ),
  endDate: z.string().refine(
    (val) => !isNaN(new Date(val).getTime()),
    { message: "Invalid end date format" }
  ).optional(),
  query: z.string().optional(),
  calendarId: z.string().optional(),
  status: z.enum(["confirmed", "tentative", "cancelled"]).optional(),
  allDay: z.boolean().optional(),
  hasAttendees: z.boolean().optional(),
  hasConference: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

type ListCalendarEventsInput = z.infer<typeof listCalendarEventsInputSchema>;

/** Output type for calendar event query */
interface ListCalendarEventsOutput {
  events: CalendarEventResult[];
  totalCount: number;
  hasMore: boolean;
}

/** Individual calendar event result */
interface CalendarEventResult {
  id: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  allDay: boolean;
  location?: string;
  status: string;
  hasConference: boolean;
  meetingLink?: string;
  attendeeCount: number;
  isOrganizer: boolean;
  calendarName?: string;
}

// ─────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────

export const listCalendarEventsTool: ToolDefinition<ListCalendarEventsInput, ListCalendarEventsOutput> = defineTool({
  // ═══════════════════════════════════════════════════════════
  // LLM Interface
  // ═══════════════════════════════════════════════════════════
  name: "list_calendar_events",
  description: "Query calendar events within a date range",

  whenToUse: `Use when the user asks about:
- Their schedule: "What's on my calendar today?", "Show my meetings"
- Upcoming events: "What do I have tomorrow?", "This week's events"
- Specific date ranges: "Meetings next week", "Events in January"
- Finding meetings: "When is my meeting with John?", "Find the project review"

This queries synced calendar events from Google Calendar.`,

  examples: [
    'User: "What\'s on my calendar today?" → list_calendar_events({ startDate: "2024-01-15", endDate: "2024-01-15" })',
    'User: "Show my meetings this week" → list_calendar_events({ startDate: "2024-01-15", endDate: "2024-01-21" })',
    'User: "Find meetings with video calls" → list_calendar_events({ startDate: "2024-01-15", hasConference: true })',
    'User: "What all-day events do I have?" → list_calendar_events({ startDate: "2024-01-15", allDay: true })',
    'User: "Search for project review meeting" → list_calendar_events({ startDate: "2024-01-01", query: "project review" })',
  ],

  parametersSchema: objectSchema(
    {
      startDate: {
        type: "string",
        format: "date",
        description: "Start of date range (ISO format, required)",
      },
      endDate: {
        type: "string",
        format: "date",
        description: "End of date range (ISO format, defaults to startDate)",
      },
      query: {
        type: "string",
        description: "Text search in event title, description, or location",
      },
      calendarId: {
        type: "string",
        description: "Filter by specific calendar ID",
      },
      status: {
        type: "string",
        enum: ["confirmed", "tentative", "cancelled"],
        description: "Filter by event status",
      },
      allDay: {
        type: "boolean",
        description: "Filter for all-day events only",
      },
      hasAttendees: {
        type: "boolean",
        description: "Filter for events with attendees",
      },
      hasConference: {
        type: "boolean",
        description: "Filter for events with video conference (Meet, Zoom, etc.)",
      },
      limit: {
        type: "integer",
        description: "Maximum results to return (1-50, default 20)",
        minimum: 1,
        maximum: 50,
      },
    },
    ["startDate"]
  ),

  // ═══════════════════════════════════════════════════════════
  // Internal Configuration
  // ═══════════════════════════════════════════════════════════
  category: "query",
  riskLevel: "low",
  requiresApproval: false,
  requiredIntegrations: ["calendar"],

  // ═══════════════════════════════════════════════════════════
  // Validation & Execution
  // ═══════════════════════════════════════════════════════════
  inputValidator: listCalendarEventsInputSchema,

  execute: async (input, context) => {
    const {
      startDate,
      endDate,
      query,
      calendarId,
      status,
      allDay,
      hasAttendees,
      hasConference,
      limit,
    } = input;

    // Parse dates - use UTC to avoid timezone drift
    const startDateTime = new Date(startDate);
    startDateTime.setUTCHours(0, 0, 0, 0);

    let endDateTime: Date;
    if (endDate) {
      endDateTime = new Date(endDate);
    } else {
      // Default to same day if no end date
      endDateTime = new Date(startDate);
    }
    endDateTime.setUTCHours(23, 59, 59, 999);

    // Execute the search
    const searchResult = await calendarEventRepository.search(context.userId, {
      query,
      calendarId,
      startDate: startDateTime,
      endDate: endDateTime,
      status,
      allDay,
      hasAttendees,
      hasConference,
      limit,
      orderBy: "startsAt",
      orderDirection: "asc",
    });

    // Map results to output format
    const events: CalendarEventResult[] = searchResult.events.map((event) => {
      // Parse attendees if present
      const attendees = event.attendees as Array<{ email: string; self?: boolean }> | null;
      const attendeeCount = attendees?.length ?? 0;
      
      // Check if user is the organizer by checking the organizer.self field
      const organizer = event.organizer as { email?: string; displayName?: string; self?: boolean } | null;
      const isOrganizer = organizer?.self === true;

      return {
        id: event.id,
        title: event.title,
        description: event.description ?? undefined,
        startsAt: event.startsAt.toISOString(),
        endsAt: event.endsAt?.toISOString(),
        allDay: event.allDay,
        location: event.location ?? undefined,
        status: event.status ?? "confirmed",
        hasConference: Boolean(event.conferenceData || event.hangoutLink),
        meetingLink: event.hangoutLink ?? event.virtualUrl ?? undefined,
        attendeeCount,
        isOrganizer,
        calendarName: undefined, // Would need a join to get this
      };
    });

    return {
      events,
      totalCount: searchResult.total,
      hasMore: searchResult.hasMore,
    };
  },
});


