// ═══════════════════════════════════════════════════════════════════════════
// Calendar Mappers Tests
// Tests for Google Calendar API to database mapping functions
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import {
  parseEventDateTime,
  getStorageTimezone,
  isAllDayEvent,
  formatEventDateTime,
  mapEventStatus,
  mapEventVisibility,
  mapGoogleCalendarToDb,
  mapGoogleEventToDb,
  normalizeAttendee,
  normalizeAttendees,
  denormalizeAttendee,
  denormalizeAttendees,
  findSelfAttendee,
  countAttendeeResponses,
  extractMeetingUrl,
  hasConferenceData,
  prepareEventForEmbedding,
  isEventCancelled,
  isRecurringEventInstance,
  isMasterRecurringEvent,
  getEventDurationMinutes,
  isEventHappening,
  isEventPast,
  isEventFuture,
  parseRecurrenceRules,
  describeRecurrence,
  inferEventType,
} from "@/integrations/calendar/mappers";
import {
  createMockEvent,
  createMockCalendar,
  createMockAttendee,
  createMockEventWithMeet,
  createMockAllDayEvent,
  createMockRecurringEvent,
  resetMockCounters,
} from "./mocks";
import type { EventAttendee, EventDateTime } from "@/integrations/calendar/types";

describe("Calendar Mappers", () => {
  beforeEach(() => {
    resetMockCounters();
  });

  // ─────────────────────────────────────────────────────────────
  // Date/Time Parsing Tests
  // ─────────────────────────────────────────────────────────────

  describe("parseEventDateTime", () => {
    it("should parse timed events with dateTime", () => {
      const dateTime: EventDateTime = {
        dateTime: "2024-03-15T10:00:00-05:00",
        timeZone: "America/New_York",
      };

      const result = parseEventDateTime(dateTime);

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe("2024-03-15T15:00:00.000Z");
    });

    it("should parse all-day events with date to midnight UTC", () => {
      const dateTime: EventDateTime = {
        date: "2024-03-15",
      };

      const result = parseEventDateTime(dateTime);

      expect(result).toBeInstanceOf(Date);
      expect(result.toISOString()).toBe("2024-03-15T00:00:00.000Z");
    });

    it("should throw for invalid EventDateTime without date or dateTime", () => {
      const dateTime: EventDateTime = {} as EventDateTime;

      expect(() => parseEventDateTime(dateTime)).toThrow(
        "EventDateTime must have either date or dateTime"
      );
    });

    it("should handle UTC dateTime correctly", () => {
      const dateTime: EventDateTime = {
        dateTime: "2024-03-15T15:00:00Z",
      };

      const result = parseEventDateTime(dateTime);

      expect(result.toISOString()).toBe("2024-03-15T15:00:00.000Z");
    });
  });

  describe("getStorageTimezone", () => {
    it("should return event timezone when specified", () => {
      const dateTime: EventDateTime = {
        dateTime: "2024-03-15T10:00:00-05:00",
        timeZone: "America/New_York",
      };

      const result = getStorageTimezone(dateTime);

      expect(result).toBe("America/New_York");
    });

    it("should return fallback timezone when not specified", () => {
      const dateTime: EventDateTime = {
        date: "2024-03-15",
      };

      const result = getStorageTimezone(dateTime, "America/Los_Angeles");

      expect(result).toBe("America/Los_Angeles");
    });

    it("should default to UTC when no timezone specified", () => {
      const dateTime: EventDateTime = {
        date: "2024-03-15",
      };

      const result = getStorageTimezone(dateTime);

      expect(result).toBe("UTC");
    });
  });

  describe("isAllDayEvent", () => {
    it("should return true for all-day events", () => {
      const dateTime: EventDateTime = { date: "2024-03-15" };

      expect(isAllDayEvent(dateTime)).toBe(true);
    });

    it("should return false for timed events", () => {
      const dateTime: EventDateTime = {
        dateTime: "2024-03-15T10:00:00Z",
      };

      expect(isAllDayEvent(dateTime)).toBe(false);
    });
  });

  describe("formatEventDateTime", () => {
    it("should format timed events with dateTime and timezone", () => {
      const date = new Date("2024-03-15T15:00:00.000Z");

      const result = formatEventDateTime(date, false, "America/New_York");

      expect(result.dateTime).toBe("2024-03-15T15:00:00.000Z");
      expect(result.timeZone).toBe("America/New_York");
      expect(result.date).toBeUndefined();
    });

    it("should format all-day events with date only in UTC", () => {
      const date = new Date("2024-03-15T00:00:00.000Z");

      const result = formatEventDateTime(date, true);

      expect(result.date).toBe("2024-03-15");
      expect(result.dateTime).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Status and Visibility Mapping Tests
  // ─────────────────────────────────────────────────────────────

  describe("mapEventStatus", () => {
    it("should map confirmed status", () => {
      expect(mapEventStatus("confirmed")).toBe("confirmed");
    });

    it("should map tentative status", () => {
      expect(mapEventStatus("tentative")).toBe("tentative");
    });

    it("should map cancelled status", () => {
      expect(mapEventStatus("cancelled")).toBe("cancelled");
    });

    it("should default to confirmed for unknown status", () => {
      expect(mapEventStatus("unknown")).toBe("confirmed");
      expect(mapEventStatus(undefined)).toBe("confirmed");
    });
  });

  describe("mapEventVisibility", () => {
    it("should map public visibility", () => {
      expect(mapEventVisibility("public")).toBe("public");
    });

    it("should map private visibility", () => {
      expect(mapEventVisibility("private")).toBe("private");
    });

    it("should map confidential visibility", () => {
      expect(mapEventVisibility("confidential")).toBe("confidential");
    });

    it("should preserve default visibility", () => {
      expect(mapEventVisibility("default")).toBe("default");
    });

    it("should default to default for unknown visibility", () => {
      expect(mapEventVisibility("unknown")).toBe("default");
      expect(mapEventVisibility(undefined)).toBe("default");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Calendar Mapping Tests
  // ─────────────────────────────────────────────────────────────

  describe("mapGoogleCalendarToDb", () => {
    it("should map a Google Calendar to database input", () => {
      const googleCal = createMockCalendar({
        id: "test@group.calendar.google.com",
        summary: "Test Calendar",
        description: "A test calendar",
        timeZone: "America/New_York",
        accessRole: "owner",
        primary: true,
        selected: true,
        hidden: false,
        backgroundColor: "#039be5",
        foregroundColor: "#ffffff",
      });

      const result = mapGoogleCalendarToDb(googleCal, "user-123");

      expect(result.userId).toBe("user-123");
      expect(result.googleCalendarId).toBe("test@group.calendar.google.com");
      expect(result.name).toBe("Test Calendar");
      expect(result.description).toBe("A test calendar");
      expect(result.timeZone).toBe("America/New_York");
      expect(result.accessRole).toBe("owner");
      expect(result.isPrimary).toBe(true);
      expect(result.isSelected).toBe(false); // Defaults to false - user must opt-in
      expect(result.isHidden).toBe(false);
    });

    it("should handle calendars with minimal data", () => {
      const googleCal = createMockCalendar({
        id: "minimal@calendar.com",
        summary: "Minimal",
      });

      const result = mapGoogleCalendarToDb(googleCal, "user-456");

      expect(result.userId).toBe("user-456");
      expect(result.googleCalendarId).toBe("minimal@calendar.com");
      expect(result.name).toBe("Minimal");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Event Mapping Tests
  // ─────────────────────────────────────────────────────────────

  describe("mapGoogleEventToDb", () => {
    it("should map a Google Event to database input", () => {
      const googleEvent = createMockEvent({
        id: "event-123",
        calendarId: "primary",
        summary: "Team Meeting",
        description: "Weekly sync",
        location: "Conference Room A",
        startDate: new Date("2024-03-15T10:00:00Z"),
        durationMinutes: 60,
      });

      const result = mapGoogleEventToDb(googleEvent, "user-123", "primary");

      expect(result.userId).toBe("user-123");
      expect(result.googleEventId).toBe("event-123");
      expect(result.googleCalendarId).toBe("primary");
      expect(result.title).toBe("Team Meeting");
      expect(result.description).toBe("Weekly sync");
      expect(result.location).toBe("Conference Room A");
      expect(result.source).toBe("google_calendar");
    });

    it("should handle all-day events", () => {
      const allDayEvent = createMockAllDayEvent(new Date("2024-03-15"), {
        summary: "All Day Event",
      });

      const result = mapGoogleEventToDb(allDayEvent, "user-123", "primary");

      expect(result.allDay).toBe(true);
    });

    it("should handle events with attendees", () => {
      const event = createMockEvent({
        attendees: [
          createMockAttendee({ email: "a@example.com", responseStatus: "accepted" }),
          createMockAttendee({ email: "b@example.com", responseStatus: "declined" }),
        ],
      });

      const result = mapGoogleEventToDb(event, "user-123", "primary");

      expect(result.attendees).toHaveLength(2);
    });

    it("should handle events with conference data", () => {
      const meetEvent = createMockEventWithMeet({
        summary: "Video Call",
      });

      const result = mapGoogleEventToDb(meetEvent, "user-123", "primary");

      expect(result.hangoutLink).toContain("meet.google.com");
      expect(result.conferenceData).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Attendee Mapping Tests
  // ─────────────────────────────────────────────────────────────

  describe("normalizeAttendee", () => {
    it("should normalize an attendee to stored format", () => {
      const attendee: EventAttendee = {
        email: "test@example.com",
        displayName: "Test User",
        responseStatus: "accepted",
        optional: true,
        organizer: false,
        self: true,
      };

      const result = normalizeAttendee(attendee);

      expect(result.email).toBe("test@example.com");
      expect(result.displayName).toBe("Test User");
      expect(result.responseStatus).toBe("accepted");
      expect(result.isOptional).toBe(true);
      expect(result.isOrganizer).toBe(false);
      expect(result.isSelf).toBe(true);
    });
  });

  describe("denormalizeAttendee", () => {
    it("should denormalize a NormalizedAttendee to API format", () => {
      const normalized = {
        email: "test@example.com",
        displayName: "Test User",
        responseStatus: "accepted",
        isOptional: true,
        isOrganizer: false,
        isSelf: true,
        isResource: false,
      };

      const result = denormalizeAttendee(normalized);

      expect(result.email).toBe("test@example.com");
      expect(result.displayName).toBe("Test User");
      expect(result.responseStatus).toBe("accepted");
      expect(result.optional).toBe(true);
    });

    it("should preserve explicit false values", () => {
      const normalized = {
        email: "test@example.com",
        responseStatus: "needsAction",
        isOptional: false,
        isOrganizer: false,
        isSelf: false,
        isResource: false,
      };

      const result = denormalizeAttendee(normalized);

      expect(result.optional).toBe(false);
      expect(result.organizer).toBe(false);
      expect(result.self).toBe(false);
    });
  });

  describe("findSelfAttendee", () => {
    it("should find the self attendee", () => {
      const attendees: EventAttendee[] = [
        createMockAttendee({ email: "other@example.com", self: false }),
        createMockAttendee({ email: "me@example.com", self: true }),
      ];

      const result = findSelfAttendee(attendees);

      expect(result?.email).toBe("me@example.com");
    });

    it("should return undefined if no self attendee", () => {
      const attendees: EventAttendee[] = [
        createMockAttendee({ email: "other@example.com", self: false }),
      ];

      const result = findSelfAttendee(attendees);

      expect(result).toBeUndefined();
    });
  });

  describe("countAttendeeResponses", () => {
    it("should count attendee responses correctly", () => {
      const attendees: EventAttendee[] = [
        createMockAttendee({ responseStatus: "accepted" }),
        createMockAttendee({ responseStatus: "accepted" }),
        createMockAttendee({ responseStatus: "declined" }),
        createMockAttendee({ responseStatus: "tentative" }),
        createMockAttendee({ responseStatus: "needsAction" }),
      ];

      const result = countAttendeeResponses(attendees);

      expect(result.accepted).toBe(2);
      expect(result.declined).toBe(1);
      expect(result.tentative).toBe(1);
      expect(result.needsAction).toBe(1);
    });

    it("should handle empty attendee list", () => {
      const result = countAttendeeResponses([]);

      expect(result.accepted).toBe(0);
      expect(result.declined).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Conference/Meeting URL Tests
  // ─────────────────────────────────────────────────────────────

  describe("extractMeetingUrl", () => {
    it("should extract video URL from conference data", () => {
      const conferenceData = {
        conferenceId: "meet-123",
        entryPoints: [
          { entryPointType: "video" as const, uri: "https://meet.google.com/abc-defg-hij" },
        ],
      };

      const result = extractMeetingUrl(conferenceData);

      expect(result).toBe("https://meet.google.com/abc-defg-hij");
    });

    it("should extract from conference entry points", () => {
      const conferenceData = {
        entryPoints: [
          { entryPointType: "video" as const, uri: "https://zoom.us/j/123456" },
        ],
      };

      const result = extractMeetingUrl(conferenceData);

      expect(result).toBe("https://zoom.us/j/123456");
    });

    it("should return undefined for undefined conference data", () => {
      const result = extractMeetingUrl(undefined);

      expect(result).toBeUndefined();
    });
  });

  describe("hasConferenceData", () => {
    it("should return true for events with conference data", () => {
      const event = createMockEventWithMeet();

      expect(hasConferenceData(event)).toBe(true);
    });

    it("should return false for events without conference data", () => {
      const event = createMockEvent();

      expect(hasConferenceData(event)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Event State Tests
  // ─────────────────────────────────────────────────────────────

  describe("isEventCancelled", () => {
    it("should return true for cancelled events", () => {
      const event = createMockEvent({ status: "cancelled" });

      expect(isEventCancelled(event)).toBe(true);
    });

    it("should return false for confirmed events", () => {
      const event = createMockEvent({ status: "confirmed" });

      expect(isEventCancelled(event)).toBe(false);
    });
  });

  describe("isRecurringEventInstance", () => {
    it("should return true for instances of recurring events", () => {
      const event = createMockEvent({ recurringEventId: "master-event-id" });

      expect(isRecurringEventInstance(event)).toBe(true);
    });

    it("should return false for non-recurring events", () => {
      const event = createMockEvent();

      expect(isRecurringEventInstance(event)).toBe(false);
    });
  });

  describe("isMasterRecurringEvent", () => {
    it("should return true for master recurring events", () => {
      const event = createMockRecurringEvent();

      expect(isMasterRecurringEvent(event)).toBe(true);
    });

    it("should return false for non-recurring events", () => {
      const event = createMockEvent();

      expect(isMasterRecurringEvent(event)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Event Duration and Time Tests
  // ─────────────────────────────────────────────────────────────

  describe("getEventDurationMinutes", () => {
    it("should calculate duration for timed events", () => {
      const event = createMockEvent({
        startDate: new Date("2024-03-15T10:00:00Z"),
        durationMinutes: 90,
      });

      const result = getEventDurationMinutes(event);

      expect(result).toBe(90);
    });

    it("should calculate duration for all-day events", () => {
      const event = createMockEvent({
        start: { date: "2024-03-15" },
        end: { date: "2024-03-16" },
      });

      const result = getEventDurationMinutes(event);

      expect(result).toBe(24 * 60); // 1 day
    });
  });

  describe("isEventHappening", () => {
    it("should return true for events happening now", () => {
      const now = new Date();
      const event = createMockEvent({
        startDate: new Date(now.getTime() - 30 * 60 * 1000), // Started 30 min ago
        durationMinutes: 60,
      });

      expect(isEventHappening(event, now)).toBe(true);
    });

    it("should return false for past events", () => {
      const now = new Date();
      const event = createMockEvent({
        startDate: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
        durationMinutes: 60,
      });

      expect(isEventHappening(event, now)).toBe(false);
    });

    it("should return false for future events", () => {
      const now = new Date();
      const event = createMockEvent({
        startDate: new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2 hours from now
        durationMinutes: 60,
      });

      expect(isEventHappening(event, now)).toBe(false);
    });
  });

  describe("isEventPast", () => {
    it("should return true for past events", () => {
      const now = new Date();
      const event = createMockEvent({
        startDate: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        durationMinutes: 60,
      });

      expect(isEventPast(event, now)).toBe(true);
    });

    it("should return false for current or future events", () => {
      const now = new Date();
      const event = createMockEvent({
        startDate: new Date(now.getTime() + 60 * 60 * 1000),
        durationMinutes: 60,
      });

      expect(isEventPast(event, now)).toBe(false);
    });
  });

  describe("isEventFuture", () => {
    it("should return true for future events", () => {
      const now = new Date();
      const event = createMockEvent({
        startDate: new Date(now.getTime() + 60 * 60 * 1000),
        durationMinutes: 60,
      });

      expect(isEventFuture(event, now)).toBe(true);
    });

    it("should return false for past or current events", () => {
      const now = new Date();
      const event = createMockEvent({
        startDate: new Date(now.getTime() - 60 * 60 * 1000),
        durationMinutes: 60,
      });

      expect(isEventFuture(event, now)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Recurrence Tests
  // ─────────────────────────────────────────────────────────────

  describe("parseRecurrenceRules", () => {
    it("should parse RRULE from recurrence array", () => {
      const recurrence = ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"];

      const result = parseRecurrenceRules(recurrence);

      expect(result.isRecurring).toBe(true);
      expect(result.rrule).toBe("RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR");
    });

    it("should identify non-recurring events", () => {
      const result = parseRecurrenceRules(undefined);

      expect(result.isRecurring).toBe(false);
      expect(result.rrule).toBeUndefined();
    });

    it("should parse EXDATE and RDATE", () => {
      const recurrence = [
        "RRULE:FREQ=WEEKLY",
        "EXDATE:20240315",
        "RDATE:20240401",
      ];

      const result = parseRecurrenceRules(recurrence);

      expect(result.isRecurring).toBe(true);
      expect(result.exdates).toHaveLength(1);
      expect(result.rdates).toHaveLength(1);
    });
  });

  describe("describeRecurrence", () => {
    it("should describe daily recurrence", () => {
      const result = describeRecurrence(["RRULE:FREQ=DAILY"]);

      expect(result.toLowerCase()).toContain("daily");
    });

    it("should describe weekly recurrence", () => {
      const result = describeRecurrence(["RRULE:FREQ=WEEKLY"]);

      expect(result.toLowerCase()).toContain("weekly");
    });

    it("should describe non-recurring events", () => {
      const result = describeRecurrence(undefined);

      expect(result).toBe("Does not repeat");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Event Type Inference Tests
  // ─────────────────────────────────────────────────────────────

  describe("inferEventType", () => {
    it("should detect events with video calls as call type", () => {
      const event = createMockEventWithMeet({
        summary: "Video Meeting",
      });

      expect(inferEventType(event)).toBe("call");
    });

    it("should detect out of office events as reminder type", () => {
      const event = createMockEvent({
        summary: "Out of Office",
      });
      event.eventType = "outOfOffice";

      expect(inferEventType(event)).toBe("reminder");
    });

    it("should detect focus time events as reminder type", () => {
      const event = createMockEvent({
        summary: "Focus Time",
      });
      event.eventType = "focusTime";

      expect(inferEventType(event)).toBe("reminder");
    });

    it("should detect events with location as meeting type", () => {
      const event = createMockEvent({
        summary: "Regular Meeting",
        location: "Conference Room A",
      });

      expect(inferEventType(event)).toBe("meeting");
    });

    it("should default to meeting type for events without special markers", () => {
      const event = createMockEvent({
        summary: "General Event",
      });

      expect(inferEventType(event)).toBe("meeting");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Embedding Preparation Tests
  // ─────────────────────────────────────────────────────────────

  describe("prepareEventForEmbedding", () => {
    it("should prepare event text for embedding", () => {
      const event = {
        title: "Quarterly Review Meeting",
        description: "Review Q4 performance and set Q1 goals",
        location: "Main Conference Room",
        attendees: [
          { email: "john@example.com", displayName: "John Smith" },
          { email: "jane@example.com", displayName: "Jane Doe" },
        ],
        startsAt: new Date("2024-03-15T10:00:00Z"),
        endsAt: new Date("2024-03-15T11:00:00Z"),
        allDay: false,
      };

      const result = prepareEventForEmbedding(event);

      expect(result).toContain("Quarterly Review Meeting");
      expect(result).toContain("Q4 performance");
      expect(result).toContain("Main Conference Room");
      expect(result).toContain("John Smith");
      expect(result).toContain("Jane Doe");
    });

    it("should handle events with minimal data", () => {
      const event = {
        title: "Simple Event",
        description: null,
        location: null,
        attendees: null,
        startsAt: new Date(),
        endsAt: new Date(),
        allDay: false,
      };

      const result = prepareEventForEmbedding(event);

      expect(result).toContain("Simple Event");
    });
  });
});

