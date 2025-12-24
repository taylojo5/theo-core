// ═══════════════════════════════════════════════════════════════════════════
// Calendar Mock Factories
// Functions to create mock Google Calendar API response objects for testing
// ═══════════════════════════════════════════════════════════════════════════

import type {
  GoogleCalendar,
  GoogleEvent,
  EventAttendee,
  EventDateTime,
  EventReminders,
  ConferenceData,
  CalendarListResponse,
  EventListResponse,
  WatchResponse,
  CalendarAccessRole,
  EventStatus,
  EventVisibility,
  AttendeeResponseStatus,
} from "@/integrations/calendar/types";

// ─────────────────────────────────────────────────────────────
// Calendar Factory
// ─────────────────────────────────────────────────────────────

export interface CreateCalendarOptions {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  timeZone?: string;
  accessRole?: CalendarAccessRole;
  selected?: boolean;
  primary?: boolean;
  hidden?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
  deleted?: boolean;
}

let calendarCounter = 0;

/**
 * Create a mock Google Calendar
 */
export function createMockCalendar(
  options: CreateCalendarOptions = {}
): GoogleCalendar {
  calendarCounter++;
  const id = options.id || `cal_${calendarCounter.toString().padStart(3, "0")}@group.calendar.google.com`;

  return {
    id,
    summary: options.summary || `Calendar ${calendarCounter}`,
    description: options.description,
    location: options.location,
    timeZone: options.timeZone || "America/New_York",
    accessRole: options.accessRole || "owner",
    selected: options.selected ?? true,
    primary: options.primary ?? false,
    hidden: options.hidden ?? false,
    backgroundColor: options.backgroundColor || "#039be5",
    foregroundColor: options.foregroundColor || "#ffffff",
    deleted: options.deleted ?? false,
    etag: `"etag_cal_${calendarCounter}"`,
  };
}

/**
 * Create a mock primary calendar
 */
export function createMockPrimaryCalendar(
  email: string = "test@example.com",
  options: Partial<CreateCalendarOptions> = {}
): GoogleCalendar {
  return createMockCalendar({
    id: email,
    summary: email,
    primary: true,
    accessRole: "owner",
    ...options,
  });
}

// ─────────────────────────────────────────────────────────────
// Event Factory
// ─────────────────────────────────────────────────────────────

export interface CreateEventOptions {
  id?: string;
  calendarId?: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: EventStatus;
  visibility?: EventVisibility;
  start?: EventDateTime;
  end?: EventDateTime;
  isAllDay?: boolean;
  startDate?: Date;
  durationMinutes?: number;
  timeZone?: string;
  attendees?: EventAttendee[];
  organizer?: { email: string; displayName?: string; self?: boolean };
  creator?: { email: string; displayName?: string; self?: boolean };
  recurrence?: string[];
  recurringEventId?: string;
  hangoutLink?: string;
  conferenceData?: ConferenceData;
  reminders?: EventReminders;
  colorId?: string;
  iCalUID?: string;
  sequence?: number;
  htmlLink?: string;
  created?: string;
  updated?: string;
}

let eventCounter = 0;

/**
 * Create a mock Google Calendar event
 */
export function createMockEvent(
  options: CreateEventOptions = {}
): GoogleEvent {
  eventCounter++;
  const id = options.id || `evt_${eventCounter.toString().padStart(5, "0")}`;
  const calendarId = options.calendarId || "primary";

  // Calculate start and end times
  const startDate = options.startDate || new Date();
  const durationMinutes = options.durationMinutes || 60;
  const endDate = new Date(startDate.getTime() + durationMinutes * 60 * 1000);
  const timeZone = options.timeZone || "America/New_York";

  let start: EventDateTime;
  let end: EventDateTime;

  if (options.start && options.end) {
    start = options.start;
    end = options.end;
  } else if (options.isAllDay) {
    // All-day event: use date format
    start = { date: startDate.toISOString().split("T")[0] };
    end = { date: endDate.toISOString().split("T")[0] };
  } else {
    // Timed event: use dateTime format
    start = { dateTime: startDate.toISOString(), timeZone };
    end = { dateTime: endDate.toISOString(), timeZone };
  }

  const now = new Date().toISOString();

  return {
    id,
    calendarId,
    summary: options.summary || `Event ${eventCounter}`,
    description: options.description,
    location: options.location,
    status: options.status || "confirmed",
    visibility: options.visibility || "default",
    start,
    end,
    timeZone,
    attendees: options.attendees,
    organizer: options.organizer || {
      email: "organizer@example.com",
      self: true,
    },
    creator: options.creator || {
      email: "creator@example.com",
      self: true,
    },
    recurrence: options.recurrence,
    recurringEventId: options.recurringEventId,
    hangoutLink: options.hangoutLink,
    conferenceData: options.conferenceData,
    reminders: options.reminders || { useDefault: true },
    colorId: options.colorId,
    iCalUID: options.iCalUID || `${id}@google.com`,
    sequence: options.sequence ?? 0,
    htmlLink: options.htmlLink || `https://www.google.com/calendar/event?eid=${id}`,
    created: options.created || now,
    updated: options.updated || now,
    etag: `"etag_${id}"`,
  } as GoogleEvent;
}

/**
 * Create a mock all-day event
 */
export function createMockAllDayEvent(
  date: Date,
  options: Partial<CreateEventOptions> = {}
): GoogleEvent {
  return createMockEvent({
    isAllDay: true,
    startDate: date,
    durationMinutes: 24 * 60, // Full day
    ...options,
  });
}

/**
 * Create a mock recurring event
 */
export function createMockRecurringEvent(
  options: CreateEventOptions & { rrule?: string } = {}
): GoogleEvent {
  return createMockEvent({
    recurrence: options.recurrence || [options.rrule || "RRULE:FREQ=WEEKLY;COUNT=10"],
    ...options,
  });
}

/**
 * Create a mock event with attendees
 */
export function createMockEventWithAttendees(
  attendeeEmails: string[],
  options: Partial<CreateEventOptions> = {}
): GoogleEvent {
  const attendees: EventAttendee[] = attendeeEmails.map((email, i) => ({
    email,
    displayName: `Attendee ${i + 1}`,
    responseStatus: "needsAction" as AttendeeResponseStatus,
    optional: false,
  }));

  return createMockEvent({
    attendees,
    ...options,
  });
}

/**
 * Create a mock event with Google Meet
 */
export function createMockEventWithMeet(
  options: Partial<CreateEventOptions> = {}
): GoogleEvent {
  const meetId = `meet-${Date.now()}`;
  
  return createMockEvent({
    hangoutLink: `https://meet.google.com/${meetId}`,
    conferenceData: {
      conferenceId: meetId,
      conferenceSolution: {
        key: { type: "hangoutsMeet" },
        name: "Google Meet",
        iconUri: "https://fonts.gstatic.com/s/i/productlogos/meet_2020q4/v6/web-512dp/logo_meet_2020q4_color_2x_web_512dp.png",
      },
      entryPoints: [
        {
          entryPointType: "video",
          uri: `https://meet.google.com/${meetId}`,
          label: meetId,
        },
      ],
    },
    ...options,
  });
}

// ─────────────────────────────────────────────────────────────
// Attendee Factory
// ─────────────────────────────────────────────────────────────

export interface CreateAttendeeOptions {
  email?: string;
  displayName?: string;
  responseStatus?: AttendeeResponseStatus;
  optional?: boolean;
  organizer?: boolean;
  self?: boolean;
  resource?: boolean;
}

let attendeeCounter = 0;

/**
 * Create a mock event attendee
 */
export function createMockAttendee(
  options: CreateAttendeeOptions = {}
): EventAttendee {
  attendeeCounter++;

  return {
    email: options.email || `attendee${attendeeCounter}@example.com`,
    displayName: options.displayName || `Attendee ${attendeeCounter}`,
    responseStatus: options.responseStatus || "needsAction",
    optional: options.optional ?? false,
    organizer: options.organizer ?? false,
    self: options.self ?? false,
    resource: options.resource ?? false,
  };
}

// ─────────────────────────────────────────────────────────────
// Response Factory
// ─────────────────────────────────────────────────────────────

/**
 * Create a mock CalendarList.list response
 */
export function createMockCalendarListResponse(
  calendars: GoogleCalendar[],
  options: { nextPageToken?: string; nextSyncToken?: string } = {}
): CalendarListResponse {
  return {
    items: calendars,
    nextPageToken: options.nextPageToken,
    // Only include sync token if there's no page token (final page)
    nextSyncToken: options.nextPageToken ? undefined : (options.nextSyncToken || `sync_token_${Date.now()}`),
    etag: `"etag_list_${Date.now()}"`,
  };
}

/**
 * Create a mock Events.list response
 */
export function createMockEventListResponse(
  events: GoogleEvent[],
  options: {
    nextPageToken?: string;
    nextSyncToken?: string;
    timeZone?: string;
    accessRole?: CalendarAccessRole;
  } = {}
): EventListResponse {
  return {
    items: events,
    summary: "Calendar",
    timeZone: options.timeZone || "America/New_York",
    accessRole: options.accessRole || "owner",
    nextPageToken: options.nextPageToken,
    nextSyncToken: options.nextSyncToken || `sync_token_${Date.now()}`,
    etag: `"etag_events_${Date.now()}"`,
    updated: new Date().toISOString(),
  };
}

/**
 * Create a mock watch response
 */
export function createMockWatchResponse(
  options: { channelId?: string; resourceId?: string; expirationMs?: number } = {}
): WatchResponse {
  const now = Date.now();
  const expiration = now + (options.expirationMs || 7 * 24 * 60 * 60 * 1000); // 7 days default

  return {
    id: options.channelId || `channel_${now}`,
    resourceId: options.resourceId || `resource_${now}`,
    resourceUri: "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    expiration: expiration.toString(),
  };
}

// ─────────────────────────────────────────────────────────────
// Database Model Factories
// ─────────────────────────────────────────────────────────────

export interface CreateDbCalendarOptions {
  id?: string;
  userId?: string;
  googleCalendarId?: string;
  name?: string;
  description?: string;
  timezone?: string;
  accessRole?: string;
  isPrimary?: boolean;
  isSelected?: boolean;
  isHidden?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
}

let dbCalendarCounter = 0;

/**
 * Create a mock database Calendar model
 */
export function createMockDbCalendar(options: CreateDbCalendarOptions = {}) {
  dbCalendarCounter++;
  const now = new Date();

  return {
    id: options.id || `db_cal_${dbCalendarCounter}`,
    userId: options.userId || "test-user-id",
    googleCalendarId: options.googleCalendarId || `cal_${dbCalendarCounter}@group.calendar.google.com`,
    name: options.name || `Calendar ${dbCalendarCounter}`,
    description: options.description || null,
    timezone: options.timezone || "America/New_York",
    accessRole: options.accessRole || "owner",
    isPrimary: options.isPrimary ?? false,
    isSelected: options.isSelected ?? true,
    isHidden: options.isHidden ?? false,
    backgroundColor: options.backgroundColor || "#039be5",
    foregroundColor: options.foregroundColor || "#ffffff",
    createdAt: now,
    updatedAt: now,
  };
}

export interface CreateDbEventOptions {
  id?: string;
  userId?: string;
  calendarId?: string;
  googleEventId?: string;
  googleCalendarId?: string;
  title?: string;
  description?: string;
  location?: string;
  virtualUrl?: string;
  startsAt?: Date;
  endsAt?: Date;
  allDay?: boolean;
  timezone?: string;
  status?: string;
  visibility?: string;
  source?: string;
  sourceId?: string;
  recurrence?: string[] | null;
  recurringEventId?: string | null;
  attendees?: object[] | null;
  organizer?: object | null;
  creator?: object | null;
  reminders?: object | null;
  conferenceData?: object | null;
  hangoutLink?: string | null;
  iCalUID?: string | null;
  sequence?: number;
  etag?: string | null;
  htmlLink?: string | null;
}

let dbEventCounter = 0;

/**
 * Create a mock database Event model
 */
export function createMockDbEvent(options: CreateDbEventOptions = {}) {
  dbEventCounter++;
  const now = new Date();
  const startsAt = options.startsAt || new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const endsAt = options.endsAt || new Date(startsAt.getTime() + 60 * 60 * 1000);

  return {
    id: options.id || `db_evt_${dbEventCounter}`,
    userId: options.userId || "test-user-id",
    calendarId: options.calendarId || null,
    googleEventId: options.googleEventId || `evt_${dbEventCounter}`,
    googleCalendarId: options.googleCalendarId || "primary",
    title: options.title || `Event ${dbEventCounter}`,
    description: options.description || null,
    location: options.location || null,
    virtualUrl: options.virtualUrl || null,
    startsAt,
    endsAt,
    allDay: options.allDay ?? false,
    timezone: options.timezone || "America/New_York",
    status: options.status || "confirmed",
    visibility: options.visibility || "default",
    source: options.source || "google_calendar",
    sourceId: options.sourceId || `evt_${dbEventCounter}`,
    recurrence: options.recurrence || null,
    recurringEventId: options.recurringEventId || null,
    attendees: options.attendees || null,
    organizer: options.organizer || null,
    creator: options.creator || null,
    reminders: options.reminders || null,
    conferenceData: options.conferenceData || null,
    hangoutLink: options.hangoutLink || null,
    iCalUID: options.iCalUID || `${options.googleEventId || `evt_${dbEventCounter}`}@google.com`,
    sequence: options.sequence ?? 0,
    etag: options.etag || null,
    htmlLink: options.htmlLink || null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
}

export interface CreateDbApprovalOptions {
  id?: string;
  userId?: string;
  actionType?: "create" | "update" | "delete" | "respond";
  status?: "pending" | "approved" | "rejected" | "expired" | "executed" | "failed";
  calendarId?: string;
  eventId?: string | null;
  eventSnapshot?: object | null;
  actionData?: object;
  conflicts?: object[] | null;
  agentContext?: string | null;
  userNotes?: string | null;
  expiresAt?: Date;
}

let dbApprovalCounter = 0;

/**
 * Create a mock database CalendarApproval model
 */
export function createMockDbApproval(options: CreateDbApprovalOptions = {}) {
  dbApprovalCounter++;
  const now = new Date();

  return {
    id: options.id || `db_approval_${dbApprovalCounter}`,
    userId: options.userId || "test-user-id",
    actionType: options.actionType || "create",
    status: options.status || "pending",
    calendarId: options.calendarId || "primary",
    eventId: options.eventId || null,
    eventSnapshot: options.eventSnapshot || null,
    actionData: options.actionData || { summary: "New Event" },
    conflicts: options.conflicts || null,
    agentContext: options.agentContext || null,
    userNotes: options.userNotes || null,
    expiresAt: options.expiresAt || new Date(now.getTime() + 24 * 60 * 60 * 1000),
    createdAt: now,
    updatedAt: now,
    executedAt: null,
  };
}

// ─────────────────────────────────────────────────────────────
// Sync State Factory
// ─────────────────────────────────────────────────────────────

export interface CreateDbSyncStateOptions {
  id?: string;
  userId?: string;
  status?: string;
  lastSyncAt?: Date | null;
  lastFullSyncAt?: Date | null;
  lastIncrementalSyncAt?: Date | null;
  calendarSyncToken?: string | null;
  eventSyncTokens?: Record<string, string> | null;
  eventCount?: number;
  calendarCount?: number;
  webhookChannelId?: string | null;
  webhookResourceId?: string | null;
  webhookExpiration?: Date | null;
  errorMessage?: string | null;
  errorCount?: number;
}

let dbSyncStateCounter = 0;

/**
 * Create a mock database CalendarSyncState model
 */
export function createMockDbSyncState(options: CreateDbSyncStateOptions = {}) {
  dbSyncStateCounter++;
  const now = new Date();

  return {
    id: options.id || `db_sync_${dbSyncStateCounter}`,
    userId: options.userId || "test-user-id",
    status: options.status || "idle",
    lastSyncAt: options.lastSyncAt || null,
    lastFullSyncAt: options.lastFullSyncAt || null,
    lastIncrementalSyncAt: options.lastIncrementalSyncAt || null,
    calendarSyncToken: options.calendarSyncToken || null,
    eventSyncTokens: options.eventSyncTokens || null,
    eventCount: options.eventCount ?? 0,
    calendarCount: options.calendarCount ?? 0,
    webhookChannelId: options.webhookChannelId || null,
    webhookResourceId: options.webhookResourceId || null,
    webhookExpiration: options.webhookExpiration || null,
    errorMessage: options.errorMessage || null,
    errorCount: options.errorCount ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

// ─────────────────────────────────────────────────────────────
// Reset Counters (for test isolation)
// ─────────────────────────────────────────────────────────────

/**
 * Reset all counters for test isolation
 */
export function resetMockCounters(): void {
  calendarCounter = 0;
  eventCounter = 0;
  attendeeCounter = 0;
  dbCalendarCounter = 0;
  dbEventCounter = 0;
  dbApprovalCounter = 0;
  dbSyncStateCounter = 0;
}

