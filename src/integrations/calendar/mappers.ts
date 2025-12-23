// ═══════════════════════════════════════════════════════════════════════════
// Calendar Mappers
// Bidirectional mapping between Google Calendar API and Prisma database models
// ═══════════════════════════════════════════════════════════════════════════

import type { Prisma, Event, Calendar } from "@prisma/client";
import type {
  GoogleCalendar,
  GoogleEvent,
  EventDateTime,
  EventAttendee,
  EventCreator,
  EventOrganizer,
  EventReminders,
  ConferenceData,
  EventCreateInput,
  EventUpdateInput,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Date/Time Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Parse a Google Calendar EventDateTime to a JavaScript Date
 *
 * Handles both all-day events (date only) and timed events (dateTime).
 *
 * For timed events: Returns the exact time from the RFC3339 dateTime string.
 *
 * For all-day events: Returns midnight UTC on the event date.
 * This ensures consistent storage regardless of server timezone.
 * The original event timezone is preserved separately in the Event model's
 * `timezone` field for proper display/interpretation.
 *
 * @param eventDateTime - Google Calendar date/time object
 * @param _fallbackTimezone - Unused, kept for API compatibility
 * @returns JavaScript Date object (UTC for all-day events)
 */
export function parseEventDateTime(
  eventDateTime: EventDateTime,
  _fallbackTimezone?: string
): Date {
  if (eventDateTime.dateTime) {
    // Timed event - dateTime is in RFC3339 format (includes timezone offset)
    return new Date(eventDateTime.dateTime);
  }

  if (eventDateTime.date) {
    // All-day event - date is in YYYY-MM-DD format
    // Parse as midnight UTC for consistent storage across different server timezones
    // The 'Z' suffix ensures UTC interpretation, avoiding local timezone issues
    return new Date(`${eventDateTime.date}T00:00:00Z`);
  }

  // Fallback - shouldn't happen with valid data
  throw new Error("EventDateTime must have either date or dateTime");
}

/**
 * Get the timezone to store for an event
 *
 * For all-day events, returns the event's timezone or a fallback.
 * For timed events, the timezone is embedded in the RFC3339 dateTime.
 *
 * @param eventDateTime - Google Calendar date/time object
 * @param fallbackTimezone - Timezone to use if not specified
 * @returns Timezone string
 */
export function getStorageTimezone(
  eventDateTime: EventDateTime,
  fallbackTimezone: string = "UTC"
): string {
  // Use the event's timezone if specified, otherwise fallback
  return eventDateTime.timeZone || fallbackTimezone;
}

/**
 * Check if an EventDateTime represents an all-day event
 */
export function isAllDayEvent(dateTime: EventDateTime): boolean {
  return dateTime.date !== undefined && dateTime.dateTime === undefined;
}

/**
 * Format a JavaScript Date to a Google Calendar EventDateTime
 *
 * @param date - JavaScript Date to format
 * @param allDay - Whether this is an all-day event
 * @param timeZone - Timezone for the event
 * @returns EventDateTime object for Google API
 */
export function formatEventDateTime(
  date: Date,
  allDay: boolean,
  timeZone?: string
): EventDateTime {
  if (allDay) {
    // Format as YYYY-MM-DD for all-day events
    // Use UTC methods since all-day events are stored as midnight UTC
    // (via parseEventDateTime which appends 'Z' to the date string)
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return {
      date: `${year}-${month}-${day}`,
      timeZone,
    };
  }

  // Format as RFC3339 for timed events
  return {
    dateTime: date.toISOString(),
    timeZone,
  };
}

/**
 * Get the timezone from an EventDateTime, with fallback
 */
export function getEventTimezone(
  dateTime: EventDateTime,
  fallback: string = "UTC"
): string {
  return dateTime.timeZone || fallback;
}

// ─────────────────────────────────────────────────────────────
// Calendar Mappers
// ─────────────────────────────────────────────────────────────

/**
 * Input type for creating/updating a Calendar in the database
 */
export interface CalendarCreateInput {
  userId: string;
  googleCalendarId: string;
  name: string;
  description?: string;
  timeZone?: string;
  isPrimary: boolean;
  isOwner: boolean;
  accessRole: string;
  backgroundColor?: string;
  foregroundColor?: string;
  isSelected?: boolean;
  isHidden?: boolean;
}

/**
 * Map a Google Calendar to database input
 *
 * Converts a Google Calendar API response into the format expected
 * by Prisma for database storage.
 *
 * @param calendar - Google Calendar from the API
 * @param userId - The user ID who owns this calendar
 * @returns Calendar input ready for database insertion
 *
 * @example
 * ```typescript
 * const googleCals = await client.listCalendars();
 * const inputs = googleCals.map(cal => mapGoogleCalendarToDb(cal, userId));
 * await prisma.calendar.createMany({ data: inputs.map(calendarInputToPrisma) });
 * ```
 */
export function mapGoogleCalendarToDb(
  calendar: GoogleCalendar,
  userId: string
): CalendarCreateInput {
  return {
    userId,
    googleCalendarId: calendar.id,
    name: calendar.summary,
    description: calendar.description,
    timeZone: calendar.timeZone,
    isPrimary: calendar.primary ?? false,
    isOwner: calendar.accessRole === "owner",
    accessRole: calendar.accessRole,
    backgroundColor: calendar.backgroundColor,
    foregroundColor: calendar.foregroundColor,
    isSelected: calendar.selected ?? true,
    isHidden: calendar.hidden ?? false,
  };
}

/**
 * Convert CalendarCreateInput to Prisma create data
 */
export function calendarInputToPrisma(
  input: CalendarCreateInput
): Prisma.CalendarCreateInput {
  return {
    user: { connect: { id: input.userId } },
    googleCalendarId: input.googleCalendarId,
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
  };
}

/**
 * Convert CalendarCreateInput to Prisma upsert data
 */
export function calendarInputToUpsertPrisma(
  input: CalendarCreateInput
): Prisma.CalendarUpsertArgs["create"] {
  return {
    user: { connect: { id: input.userId } },
    googleCalendarId: input.googleCalendarId,
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
  };
}

/**
 * Map a database Calendar back to Google Calendar format
 *
 * Useful for displaying calendar data in API responses that match
 * the Google Calendar structure.
 *
 * @param calendar - Database calendar record
 * @returns Partial Google Calendar object
 */
export function mapDbCalendarToGoogle(calendar: Calendar): Partial<GoogleCalendar> {
  return {
    id: calendar.googleCalendarId,
    summary: calendar.name,
    description: calendar.description ?? undefined,
    timeZone: calendar.timeZone ?? undefined,
    accessRole: calendar.accessRole as GoogleCalendar["accessRole"],
    primary: calendar.isPrimary,
    hidden: calendar.isHidden,
    selected: calendar.isSelected,
    backgroundColor: calendar.backgroundColor ?? undefined,
    foregroundColor: calendar.foregroundColor ?? undefined,
  };
}

/**
 * Batch convert Google Calendars to database inputs
 */
export function mapGoogleCalendarsToDb(
  calendars: GoogleCalendar[],
  userId: string
): CalendarCreateInput[] {
  return calendars.map((cal) => mapGoogleCalendarToDb(cal, userId));
}

// ─────────────────────────────────────────────────────────────
// Event Mappers
// ─────────────────────────────────────────────────────────────

/**
 * Input type for creating an Event in the database
 */
export interface EventDbCreateInput {
  userId: string;
  title: string;
  description?: string;
  type: string;
  startsAt: Date;
  endsAt?: Date;
  allDay: boolean;
  timezone?: string;
  location?: string;
  virtualUrl?: string;
  status: string;
  visibility: string;
  source: string;
  sourceId?: string;
  sourceSyncedAt?: Date;
  metadata?: Record<string, unknown>;
  tags?: string[];

  // Google Calendar specific
  googleEventId?: string;
  googleCalendarId?: string;
  calendarId?: string;
  recurringEventId?: string;
  recurrence?: unknown;
  attendees?: unknown;
  organizer?: unknown;
  creator?: unknown;
  conferenceData?: unknown;
  hangoutLink?: string;
  reminders?: unknown;
  iCalUID?: string;
  sequence?: number;
  etag?: string;
  htmlLink?: string;
}

/**
 * Map event type from Google Calendar event properties
 *
 * Determines the internal event type based on Google Calendar
 * event characteristics.
 */
export function inferEventType(event: GoogleEvent): string {
  // Check for conference data (meeting with video call)
  if (event.conferenceData || event.hangoutLink) {
    return "call";
  }

  // Check for specific event types from Google
  if (event.eventType === "outOfOffice") {
    return "reminder";
  }

  if (event.eventType === "focusTime") {
    return "reminder";
  }

  // Check for location (likely an in-person meeting or travel)
  if (event.location) {
    // Simple heuristic - could be enhanced
    return "meeting";
  }

  // Default to meeting
  return "meeting";
}

/**
 * Map event status from Google to internal format
 */
export function mapEventStatus(googleStatus?: string): string {
  switch (googleStatus) {
    case "confirmed":
      return "confirmed";
    case "tentative":
      return "tentative";
    case "cancelled":
      return "cancelled";
    default:
      return "confirmed";
  }
}

/**
 * Map event visibility from Google to internal format
 * 
 * Google Calendar API visibility values:
 * - "default": Uses the calendar's default visibility
 * - "public": Visible to everyone
 * - "private": Only visible to attendees
 * - "confidential": Similar to private, but hides event details
 */
export function mapEventVisibility(googleVisibility?: string): string {
  switch (googleVisibility) {
    case "default":
      return "default";
    case "public":
      return "public";
    case "private":
      return "private";
    case "confidential":
      return "confidential";
    default:
      // If no visibility specified, default to "default" (inherits from calendar)
      return "default";
  }
}

/**
 * Map a Google Calendar event to database input
 *
 * Converts a Google Calendar API event response into the format
 * expected by Prisma for database storage. Handles all event fields
 * including attendees, recurrence, and conference data.
 *
 * @param event - Google Calendar event from the API
 * @param userId - The user ID who owns this event
 * @param googleCalendarId - The Google Calendar ID this event belongs to
 * @param calendarId - Optional database Calendar ID to link
 * @returns Event input ready for database insertion
 *
 * @example
 * ```typescript
 * const events = await client.listEvents(calendarId);
 * const inputs = events.map(e => mapGoogleEventToDb(e, userId, calendarId));
 * await prisma.event.createMany({ data: inputs.map(eventInputToPrisma) });
 * ```
 */
export function mapGoogleEventToDb(
  event: GoogleEvent,
  userId: string,
  googleCalendarId: string,
  calendarId?: string
): EventDbCreateInput {
  const allDay = isAllDayEvent(event.start);
  const startsAt = parseEventDateTime(event.start);
  const endsAt = event.end ? parseEventDateTime(event.end) : undefined;
  const timezone = getEventTimezone(event.start);

  return {
    userId,
    title: event.summary || "(No title)",
    description: event.description,
    type: inferEventType(event),
    startsAt,
    endsAt,
    allDay,
    timezone,
    location: event.location,
    virtualUrl: event.hangoutLink,
    status: mapEventStatus(event.status),
    visibility: mapEventVisibility(event.visibility),
    source: "google_calendar",
    sourceId: event.id,
    sourceSyncedAt: new Date(),
    metadata: {},
    tags: [],

    // Google Calendar specific
    googleEventId: event.id,
    googleCalendarId,
    calendarId,
    recurringEventId: event.recurringEventId,
    recurrence: event.recurrence,
    attendees: event.attendees,
    organizer: event.organizer,
    creator: event.creator,
    conferenceData: event.conferenceData,
    hangoutLink: event.hangoutLink,
    reminders: event.reminders,
    iCalUID: event.iCalUID,
    sequence: event.sequence ?? 0,
    etag: event.etag,
    htmlLink: event.htmlLink,
  };
}

/**
 * Convert EventDbCreateInput to Prisma create data
 */
export function eventInputToPrisma(
  input: EventDbCreateInput
): Prisma.EventCreateInput {
  return {
    user: { connect: { id: input.userId } },
    title: input.title,
    description: input.description,
    type: input.type,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    allDay: input.allDay,
    timezone: input.timezone,
    location: input.location,
    virtualUrl: input.virtualUrl,
    status: input.status,
    visibility: input.visibility,
    source: input.source,
    sourceId: input.sourceId,
    sourceSyncedAt: input.sourceSyncedAt,
    metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    tags: input.tags ?? [],

    // Google Calendar specific
    googleEventId: input.googleEventId,
    googleCalendarId: input.googleCalendarId,
    calendar: input.calendarId
      ? { connect: { id: input.calendarId } }
      : undefined,
    recurringEventId: input.recurringEventId,
    recurrence: input.recurrence as Prisma.InputJsonValue,
    attendees: input.attendees as Prisma.InputJsonValue,
    organizer: input.organizer as Prisma.InputJsonValue,
    creator: input.creator as Prisma.InputJsonValue,
    conferenceData: input.conferenceData as Prisma.InputJsonValue,
    hangoutLink: input.hangoutLink,
    reminders: input.reminders as Prisma.InputJsonValue,
    iCalUID: input.iCalUID,
    sequence: input.sequence ?? 0,
    etag: input.etag,
    htmlLink: input.htmlLink,
  };
}

/**
 * Convert EventDbCreateInput to Prisma unchecked create (for upserts/createMany)
 */
export function eventInputToUncheckedPrisma(
  input: EventDbCreateInput
): Prisma.EventUncheckedCreateInput {
  return {
    userId: input.userId,
    title: input.title,
    description: input.description,
    type: input.type,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    allDay: input.allDay,
    timezone: input.timezone,
    location: input.location,
    virtualUrl: input.virtualUrl,
    status: input.status,
    visibility: input.visibility,
    source: input.source,
    sourceId: input.sourceId,
    sourceSyncedAt: input.sourceSyncedAt,
    metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    tags: input.tags ?? [],

    // Google Calendar specific
    googleEventId: input.googleEventId,
    googleCalendarId: input.googleCalendarId,
    calendarId: input.calendarId,
    recurringEventId: input.recurringEventId,
    recurrence: input.recurrence as Prisma.InputJsonValue,
    attendees: input.attendees as Prisma.InputJsonValue,
    organizer: input.organizer as Prisma.InputJsonValue,
    creator: input.creator as Prisma.InputJsonValue,
    conferenceData: input.conferenceData as Prisma.InputJsonValue,
    hangoutLink: input.hangoutLink,
    reminders: input.reminders as Prisma.InputJsonValue,
    iCalUID: input.iCalUID,
    sequence: input.sequence ?? 0,
    etag: input.etag,
    htmlLink: input.htmlLink,
  };
}

/**
 * Map a database Event to Google Calendar event input format
 *
 * Converts a database Event record back to the format expected
 * by the Google Calendar API for creates/updates.
 *
 * @param event - Database event record
 * @returns Event input for Google Calendar API
 */
export function mapDbEventToGoogleInput(event: Event): EventCreateInput {
  const allDay = event.allDay;

  // Calculate end time/date when not provided
  let endDateTime: EventDateTime;
  if (event.endsAt) {
    endDateTime = formatEventDateTime(event.endsAt, allDay, event.timezone ?? undefined);
  } else if (allDay) {
    // For all-day events, Google Calendar expects end date to be the day AFTER the start
    // (the end date is exclusive). Add one day to startsAt.
    const endDate = new Date(event.startsAt);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    endDateTime = formatEventDateTime(endDate, true, event.timezone ?? undefined);
  } else {
    // For timed events without an end time, default to 1 hour duration
    // Use UTC methods for consistency with all-day event handling
    const endDate = new Date(event.startsAt);
    endDate.setUTCHours(endDate.getUTCHours() + 1);
    endDateTime = formatEventDateTime(endDate, false, event.timezone ?? undefined);
  }

  return {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start: formatEventDateTime(event.startsAt, allDay, event.timezone ?? undefined),
    end: endDateTime,
    timeZone: event.timezone ?? undefined,
    visibility: event.visibility as EventCreateInput["visibility"],
    recurrence: (event.recurrence as string[] | null) ?? undefined,
    reminders: (event.reminders as EventReminders | null) ?? undefined,
  };
}

/**
 * Map partial event updates to Google Calendar API format
 *
 * Converts partial event updates into the format expected by
 * the Google Calendar API for PATCH operations.
 *
 * @param updates - Partial event updates
 * @returns Partial Google event input for API
 */
export function mapEventUpdatesToGoogle(
  updates: Partial<Event>
): EventUpdateInput {
  const result: EventUpdateInput = {};

  if (updates.title !== undefined) {
    result.summary = updates.title;
  }

  if (updates.description !== undefined) {
    result.description = updates.description ?? undefined;
  }

  if (updates.location !== undefined) {
    result.location = updates.location ?? undefined;
  }

  if (updates.startsAt !== undefined) {
    result.start = formatEventDateTime(
      updates.startsAt,
      updates.allDay ?? false,
      updates.timezone ?? undefined
    );
  }

  if (updates.endsAt !== undefined) {
    result.end = updates.endsAt
      ? formatEventDateTime(
          updates.endsAt,
          updates.allDay ?? false,
          updates.timezone ?? undefined
        )
      : undefined;
  }

  if (updates.visibility !== undefined) {
    result.visibility = updates.visibility as EventUpdateInput["visibility"];
  }

  if (updates.status !== undefined) {
    result.status = updates.status as EventUpdateInput["status"];
  }

  if (updates.recurrence !== undefined) {
    result.recurrence = (updates.recurrence as string[] | null) ?? undefined;
  }

  if (updates.reminders !== undefined) {
    result.reminders = (updates.reminders as EventReminders | null) ?? undefined;
  }

  return result;
}

/**
 * Batch convert Google events to database inputs
 */
export function mapGoogleEventsToDb(
  events: GoogleEvent[],
  userId: string,
  googleCalendarId: string,
  calendarId?: string
): EventDbCreateInput[] {
  return events.map((event) =>
    mapGoogleEventToDb(event, userId, googleCalendarId, calendarId)
  );
}

// ─────────────────────────────────────────────────────────────
// Attendee Mappers
// ─────────────────────────────────────────────────────────────

/**
 * Normalized attendee format for internal use
 */
export interface NormalizedAttendee {
  email: string;
  displayName?: string;
  responseStatus: string;
  isOrganizer: boolean;
  isSelf: boolean;
  isOptional: boolean;
  isResource: boolean;
  comment?: string;
}

/**
 * Normalize a Google Calendar attendee to internal format
 */
export function normalizeAttendee(attendee: EventAttendee): NormalizedAttendee {
  return {
    email: attendee.email,
    displayName: attendee.displayName,
    responseStatus: attendee.responseStatus ?? "needsAction",
    isOrganizer: attendee.organizer ?? false,
    isSelf: attendee.self ?? false,
    isOptional: attendee.optional ?? false,
    isResource: attendee.resource ?? false,
    comment: attendee.comment,
  };
}

/**
 * Normalize all attendees from a Google event
 */
export function normalizeAttendees(
  attendees: EventAttendee[] | undefined
): NormalizedAttendee[] {
  if (!attendees) return [];
  return attendees.map(normalizeAttendee);
}

/**
 * Convert normalized attendee back to Google format
 */
export function denormalizeAttendee(
  attendee: NormalizedAttendee
): EventAttendee {
  return {
    email: attendee.email,
    displayName: attendee.displayName,
    responseStatus: attendee.responseStatus as EventAttendee["responseStatus"],
    // Pass boolean values directly - they're required in NormalizedAttendee
    // Using || undefined would incorrectly convert false to undefined
    organizer: attendee.isOrganizer,
    self: attendee.isSelf,
    optional: attendee.isOptional,
    resource: attendee.isResource,
    comment: attendee.comment,
  };
}

/**
 * Convert normalized attendees back to Google format
 */
export function denormalizeAttendees(
  attendees: NormalizedAttendee[]
): EventAttendee[] {
  return attendees.map(denormalizeAttendee);
}

/**
 * Extract the current user's attendee from an event
 */
export function findSelfAttendee(
  attendees: EventAttendee[] | undefined
): EventAttendee | undefined {
  return attendees?.find((a) => a.self === true);
}

/**
 * Get the organizer from attendees list
 */
export function findOrganizer(
  attendees: EventAttendee[] | undefined
): EventAttendee | undefined {
  return attendees?.find((a) => a.organizer === true);
}

/**
 * Count attendees by response status
 */
export function countAttendeeResponses(
  attendees: EventAttendee[] | undefined
): Record<string, number> {
  const counts: Record<string, number> = {
    accepted: 0,
    declined: 0,
    tentative: 0,
    needsAction: 0,
  };

  if (!attendees) return counts;

  for (const attendee of attendees) {
    const status = attendee.responseStatus ?? "needsAction";
    counts[status] = (counts[status] ?? 0) + 1;
  }

  return counts;
}

// ─────────────────────────────────────────────────────────────
// Creator/Organizer Mappers
// ─────────────────────────────────────────────────────────────

/**
 * Normalized organizer/creator format
 */
export interface NormalizedParticipant {
  email?: string;
  displayName?: string;
  isSelf: boolean;
}

/**
 * Normalize an event creator
 */
export function normalizeCreator(
  creator: EventCreator | undefined
): NormalizedParticipant | undefined {
  if (!creator) return undefined;
  return {
    email: creator.email,
    displayName: creator.displayName,
    isSelf: creator.self ?? false,
  };
}

/**
 * Normalize an event organizer
 */
export function normalizeOrganizer(
  organizer: EventOrganizer | undefined
): NormalizedParticipant | undefined {
  if (!organizer) return undefined;
  return {
    email: organizer.email,
    displayName: organizer.displayName,
    isSelf: organizer.self ?? false,
  };
}

// ─────────────────────────────────────────────────────────────
// Recurrence Mappers
// ─────────────────────────────────────────────────────────────

/**
 * Parsed recurrence information
 */
export interface RecurrenceInfo {
  /** The recurrence rule (RRULE) */
  rrule?: string;
  /** Recurrence dates (RDATE) */
  rdates: string[];
  /** Exception dates (EXDATE) */
  exdates: string[];
  /** Whether this is a recurring event */
  isRecurring: boolean;
}

/**
 * Parse recurrence rules from Google format
 *
 * Google Calendar returns recurrence as an array of RFC 5545 strings:
 * - RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR
 * - EXDATE;TZID=America/New_York:20240315T090000
 * - RDATE;VALUE=DATE:20240401
 *
 * @param recurrence - Array of recurrence rules from Google
 * @returns Parsed recurrence information
 */
export function parseRecurrenceRules(
  recurrence: string[] | undefined | null
): RecurrenceInfo {
  const result: RecurrenceInfo = {
    rrule: undefined,
    rdates: [],
    exdates: [],
    isRecurring: false,
  };

  if (!recurrence || recurrence.length === 0) {
    return result;
  }

  result.isRecurring = true;

  for (const rule of recurrence) {
    if (rule.startsWith("RRULE:")) {
      result.rrule = rule;
    } else if (rule.startsWith("RDATE")) {
      result.rdates.push(rule);
    } else if (rule.startsWith("EXDATE")) {
      result.exdates.push(rule);
    }
  }

  return result;
}

/**
 * Format recurrence info back to Google format
 */
export function formatRecurrenceRules(info: RecurrenceInfo): string[] {
  const rules: string[] = [];

  if (info.rrule) {
    rules.push(info.rrule);
  }

  rules.push(...info.rdates);
  rules.push(...info.exdates);

  return rules;
}

/**
 * Extract frequency from an RRULE
 */
export function extractRecurrenceFrequency(
  rrule: string | undefined
): string | undefined {
  if (!rrule) return undefined;

  const match = rrule.match(/FREQ=(\w+)/);
  return match ? match[1] : undefined;
}

/**
 * Human-readable recurrence description
 */
export function describeRecurrence(recurrence: string[] | undefined): string {
  const info = parseRecurrenceRules(recurrence);

  if (!info.isRecurring) {
    return "Does not repeat";
  }

  const freq = extractRecurrenceFrequency(info.rrule);

  switch (freq) {
    case "DAILY":
      return "Repeats daily";
    case "WEEKLY":
      return "Repeats weekly";
    case "MONTHLY":
      return "Repeats monthly";
    case "YEARLY":
      return "Repeats yearly";
    default:
      return "Repeats";
  }
}

// ─────────────────────────────────────────────────────────────
// Conference Data Mappers
// ─────────────────────────────────────────────────────────────

/**
 * Extract the primary meeting URL from conference data
 */
export function extractMeetingUrl(
  conferenceData: ConferenceData | undefined
): string | undefined {
  if (!conferenceData?.entryPoints) return undefined;

  // Prefer video entry point
  const videoEntry = conferenceData.entryPoints.find(
    (ep) => ep.entryPointType === "video"
  );

  if (videoEntry?.uri) {
    return videoEntry.uri;
  }

  // Fall back to any entry point with a URI
  const anyEntry = conferenceData.entryPoints.find((ep) => ep.uri);
  return anyEntry?.uri;
}

/**
 * Check if event has conference/meeting data
 */
export function hasConferenceData(event: GoogleEvent): boolean {
  return !!(event.conferenceData || event.hangoutLink);
}

/**
 * Get the conference solution name
 */
export function getConferenceSolutionName(
  conferenceData: ConferenceData | undefined
): string | undefined {
  return conferenceData?.conferenceSolution?.name;
}

// ─────────────────────────────────────────────────────────────
// Embedding Preparation
// ─────────────────────────────────────────────────────────────

/**
 * Prepare event content for embedding generation
 *
 * Combines event title, description, location, and attendees into
 * a searchable text string optimized for semantic search.
 *
 * @param event - Event data
 * @returns Formatted text string for embedding generation
 */
export function prepareEventForEmbedding(event: {
  title: string;
  description?: string | null;
  location?: string | null;
  attendees?: EventAttendee[] | unknown;
  startsAt: Date;
  endsAt?: Date | null;
  allDay?: boolean;
}): string {
  const parts: string[] = [];

  // Title is always included
  parts.push(`Event: ${event.title}`);

  // Date/time
  if (event.allDay) {
    parts.push(`Date: ${event.startsAt.toLocaleDateString()}`);
  } else {
    parts.push(`Time: ${event.startsAt.toLocaleString()}`);
    if (event.endsAt) {
      parts.push(`Until: ${event.endsAt.toLocaleString()}`);
    }
  }

  // Location
  if (event.location) {
    parts.push(`Location: ${event.location}`);
  }

  // Attendees (if array)
  if (Array.isArray(event.attendees) && event.attendees.length > 0) {
    const attendeeNames = event.attendees
      .slice(0, 5) // Limit to first 5 for embedding
      .map((a: EventAttendee) => a.displayName || a.email)
      .join(", ");
    parts.push(`Attendees: ${attendeeNames}`);
    if (event.attendees.length > 5) {
      parts.push(`(and ${event.attendees.length - 5} more)`);
    }
  }

  // Description (truncated)
  if (event.description) {
    const maxLength = 1500;
    const truncated = event.description.slice(0, maxLength);
    parts.push(truncated);
  }

  return parts.join("\n");
}

/**
 * Prepare event metadata for embedding storage
 */
export function prepareEventEmbeddingMetadata(event: {
  id: string;
  googleEventId?: string | null;
  googleCalendarId?: string | null;
  title: string;
  startsAt: Date;
  status: string;
}): Record<string, unknown> {
  return {
    eventId: event.id,
    googleEventId: event.googleEventId,
    googleCalendarId: event.googleCalendarId,
    title: event.title,
    startsAt: event.startsAt.toISOString(),
    status: event.status,
  };
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Check if an event is cancelled
 */
export function isEventCancelled(event: GoogleEvent): boolean {
  return event.status === "cancelled";
}

/**
 * Check if an event is a recurring event instance
 */
export function isRecurringEventInstance(event: GoogleEvent): boolean {
  return !!event.recurringEventId;
}

/**
 * Check if an event is the master recurring event
 */
export function isMasterRecurringEvent(event: GoogleEvent): boolean {
  return !!event.recurrence && event.recurrence.length > 0;
}

/**
 * Get event duration in minutes
 */
export function getEventDurationMinutes(event: GoogleEvent): number {
  const start = parseEventDateTime(event.start);
  const end = event.end ? parseEventDateTime(event.end) : start;

  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (1000 * 60));
}

/**
 * Check if event is currently happening
 */
export function isEventHappening(event: GoogleEvent, now: Date = new Date()): boolean {
  const start = parseEventDateTime(event.start);
  const end = event.end ? parseEventDateTime(event.end) : start;

  return now >= start && now <= end;
}

/**
 * Check if event is in the past
 */
export function isEventPast(event: GoogleEvent, now: Date = new Date()): boolean {
  const end = event.end
    ? parseEventDateTime(event.end)
    : parseEventDateTime(event.start);

  return end < now;
}

/**
 * Check if event is in the future
 */
export function isEventFuture(event: GoogleEvent, now: Date = new Date()): boolean {
  const start = parseEventDateTime(event.start);
  return start > now;
}

