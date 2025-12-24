// ═══════════════════════════════════════════════════════════════════════════
// Mock Calendar Client
// A testable mock implementation of CalendarClient for integration tests
// ═══════════════════════════════════════════════════════════════════════════

import { vi } from "vitest";
import type {
  GoogleCalendar,
  GoogleEvent,
  CalendarListResponse,
  EventListResponse,
  WatchResponse,
  ListCalendarsOptions,
  ListEventsOptions,
  EventCreateInput,
  EventUpdateInput,
  AttendeeResponseStatus,
} from "@/integrations/calendar/types";
import {
  createMockCalendar,
  createMockPrimaryCalendar,
  createMockEvent,
  createMockCalendarListResponse,
  createMockEventListResponse,
  createMockWatchResponse,
} from "./mock-factories";

// ─────────────────────────────────────────────────────────────
// Mock Client Options
// ─────────────────────────────────────────────────────────────

export interface MockClientOptions {
  /** User email for primary calendar */
  userEmail?: string;
  /** User ID */
  userId?: string;
  /** Initial calendars */
  calendars?: GoogleCalendar[];
  /** Initial events (keyed by calendarId) */
  events?: Map<string, GoogleEvent[]>;
  /** Simulate errors on specific operations */
  errorOn?: {
    operation: string;
    error: Error;
    times?: number;
  }[];
  /** Simulate rate limiting */
  simulateRateLimiting?: boolean;
  /** Latency in ms */
  latencyMs?: number;
}

// ─────────────────────────────────────────────────────────────
// Mock Calendar Client
// ─────────────────────────────────────────────────────────────

/**
 * Mock Calendar Client for testing
 *
 * This provides a full mock implementation of the CalendarClient interface
 * that can be used for integration testing without hitting the real API.
 */
export class MockCalendarClient {
  private calendars: Map<string, GoogleCalendar> = new Map();
  private events: Map<string, Map<string, GoogleEvent>> = new Map(); // calendarId -> eventId -> event
  private userEmail: string;
  private userId: string;
  private errorConfig: NonNullable<MockClientOptions["errorOn"]> = [];
  private errorCounts: Map<string, number> = new Map();
  private latencyMs: number;
  private syncTokens: Map<string, string> = new Map(); // calendarId -> syncToken
  private webhooks: Map<string, WatchResponse> = new Map();

  // Spy functions for verification
  public listCalendars = vi.fn(this._listCalendars.bind(this));
  public getCalendar = vi.fn(this._getCalendar.bind(this));
  public listEvents = vi.fn(this._listEvents.bind(this));
  public getEvent = vi.fn(this._getEvent.bind(this));
  public createEvent = vi.fn(this._createEvent.bind(this));
  public updateEvent = vi.fn(this._updateEvent.bind(this));
  public deleteEvent = vi.fn(this._deleteEvent.bind(this));
  public respondToEvent = vi.fn(this._respondToEvent.bind(this));
  public watchEvents = vi.fn(this._watchEvents.bind(this));
  public stopWatch = vi.fn(this._stopWatch.bind(this));

  constructor(options: MockClientOptions = {}) {
    this.userEmail = options.userEmail || "test@example.com";
    this.userId = options.userId || "test-user-id";
    this.latencyMs = options.latencyMs || 0;
    this.errorConfig = options.errorOn || [];

    // Initialize calendars
    if (options.calendars) {
      options.calendars.forEach((cal) => this.calendars.set(cal.id, cal));
    } else {
      // Create default primary calendar
      const primary = createMockPrimaryCalendar(this.userEmail);
      this.calendars.set(primary.id, primary);
    }

    // Initialize events
    if (options.events) {
      options.events.forEach((eventList, calendarId) => {
        const eventMap = new Map<string, GoogleEvent>();
        eventList.forEach((event) => eventMap.set(event.id, event));
        this.events.set(calendarId, eventMap);
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Error Simulation
  // ─────────────────────────────────────────────────────────────

  private async maybeSimulateError(operation: string): Promise<void> {
    const config = this.errorConfig.find((e) => e.operation === operation);
    if (!config) return;

    const count = this.errorCounts.get(operation) || 0;
    const maxTimes = config.times ?? 1;

    if (count < maxTimes) {
      this.errorCounts.set(operation, count + 1);
      throw config.error;
    }
  }

  private async maybeDelay(): Promise<void> {
    if (this.latencyMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.latencyMs));
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Calendar Operations
  // ─────────────────────────────────────────────────────────────

  private async _listCalendars(
    _options?: ListCalendarsOptions
  ): Promise<CalendarListResponse> {
    await this.maybeDelay();
    await this.maybeSimulateError("listCalendars");

    const calendars = Array.from(this.calendars.values()).filter(
      (cal) => !cal.deleted
    );

    return createMockCalendarListResponse(calendars);
  }

  private async _getCalendar(calendarId: string): Promise<GoogleCalendar | null> {
    await this.maybeDelay();
    await this.maybeSimulateError("getCalendar");

    return this.calendars.get(calendarId) || null;
  }

  // ─────────────────────────────────────────────────────────────
  // Event Operations
  // ─────────────────────────────────────────────────────────────

  private async _listEvents(options?: ListEventsOptions): Promise<EventListResponse> {
    await this.maybeDelay();
    await this.maybeSimulateError("listEvents");

    const calendarId = options?.calendarId || "primary";
    const calendarEvents = this.events.get(calendarId);

    if (!calendarEvents) {
      return createMockEventListResponse([]);
    }

    let events = Array.from(calendarEvents.values());

    // Apply filters
    if (options?.timeMin) {
      const minTime = new Date(options.timeMin);
      events = events.filter((e) => {
        const eventTime = e.start.dateTime
          ? new Date(e.start.dateTime)
          : new Date(e.start.date!);
        return eventTime >= minTime;
      });
    }

    if (options?.timeMax) {
      const maxTime = new Date(options.timeMax);
      events = events.filter((e) => {
        const eventTime = e.start.dateTime
          ? new Date(e.start.dateTime)
          : new Date(e.start.date!);
        return eventTime <= maxTime;
      });
    }

    if (!options?.showDeleted) {
      events = events.filter((e) => e.status !== "cancelled");
    }

    // Apply pagination
    const maxResults = options?.maxResults || 250;
    const hasMore = events.length > maxResults;
    events = events.slice(0, maxResults);

    return createMockEventListResponse(events, {
      nextPageToken: hasMore ? "next_page_token" : undefined,
      nextSyncToken: hasMore ? undefined : `sync_${calendarId}_${Date.now()}`,
    });
  }

  private async _getEvent(
    calendarId: string,
    eventId: string
  ): Promise<GoogleEvent | null> {
    await this.maybeDelay();
    await this.maybeSimulateError("getEvent");

    const calendarEvents = this.events.get(calendarId);
    if (!calendarEvents) return null;

    return calendarEvents.get(eventId) || null;
  }

  private async _createEvent(
    calendarId: string,
    input: EventCreateInput
  ): Promise<GoogleEvent> {
    await this.maybeDelay();
    await this.maybeSimulateError("createEvent");

    const event = createMockEvent({
      calendarId,
      summary: input.summary,
      description: input.description,
      location: input.location,
      start: input.start,
      end: input.end,
      timeZone: input.timeZone,
      visibility: input.visibility,
      recurrence: input.recurrence,
      reminders: input.reminders,
      attendees: input.attendees?.map((a) => ({
        email: a.email,
        optional: a.optional,
        responseStatus: "needsAction" as AttendeeResponseStatus,
      })),
    });

    // Add conference if requested
    if (input.createConference) {
      const meetId = `meet-${Date.now()}`;
      event.hangoutLink = `https://meet.google.com/${meetId}`;
      event.conferenceData = {
        conferenceId: meetId,
        conferenceSolution: {
          key: { type: "hangoutsMeet" },
          name: "Google Meet",
        },
        entryPoints: [{ entryPointType: "video", uri: `https://meet.google.com/${meetId}` }],
      };
    }

    // Store the event
    if (!this.events.has(calendarId)) {
      this.events.set(calendarId, new Map());
    }
    this.events.get(calendarId)!.set(event.id, event);

    return event;
  }

  private async _updateEvent(
    calendarId: string,
    eventId: string,
    updates: EventUpdateInput
  ): Promise<GoogleEvent> {
    await this.maybeDelay();
    await this.maybeSimulateError("updateEvent");

    const calendarEvents = this.events.get(calendarId);
    if (!calendarEvents) {
      throw new Error(`Calendar ${calendarId} not found`);
    }

    const event = calendarEvents.get(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    // Apply updates
    const updated: GoogleEvent = {
      ...event,
      summary: updates.summary ?? event.summary,
      description: updates.description ?? event.description,
      location: updates.location ?? event.location,
      start: updates.start ?? event.start,
      end: updates.end ?? event.end,
      visibility: updates.visibility ?? event.visibility,
      status: updates.status ?? event.status,
      recurrence: updates.recurrence ?? event.recurrence,
      reminders: updates.reminders ?? event.reminders,
      sequence: (event.sequence ?? 0) + 1,
      updated: new Date().toISOString(),
    };

    if (updates.attendees) {
      updated.attendees = updates.attendees.map((a) => ({
        email: a.email,
        optional: a.optional,
        responseStatus: a.responseStatus || "needsAction",
      }));
    }

    calendarEvents.set(eventId, updated);

    return updated;
  }

  private async _deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.maybeDelay();
    await this.maybeSimulateError("deleteEvent");

    const calendarEvents = this.events.get(calendarId);
    if (!calendarEvents) {
      throw new Error(`Calendar ${calendarId} not found`);
    }

    const event = calendarEvents.get(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    // Mark as cancelled (soft delete)
    event.status = "cancelled";
    event.updated = new Date().toISOString();
  }

  private async _respondToEvent(
    calendarId: string,
    eventId: string,
    response: AttendeeResponseStatus
  ): Promise<GoogleEvent> {
    await this.maybeDelay();
    await this.maybeSimulateError("respondToEvent");

    const calendarEvents = this.events.get(calendarId);
    if (!calendarEvents) {
      throw new Error(`Calendar ${calendarId} not found`);
    }

    const event = calendarEvents.get(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    // Update self attendee's response
    if (event.attendees) {
      const selfAttendee = event.attendees.find((a) => a.self);
      if (selfAttendee) {
        selfAttendee.responseStatus = response;
      }
    }

    event.updated = new Date().toISOString();

    return event;
  }

  // ─────────────────────────────────────────────────────────────
  // Watch Operations
  // ─────────────────────────────────────────────────────────────

  private async _watchEvents(
    calendarId: string,
    webhookUrl: string
  ): Promise<WatchResponse> {
    await this.maybeDelay();
    await this.maybeSimulateError("watchEvents");

    const watch = createMockWatchResponse({
      channelId: `channel_${calendarId}_${Date.now()}`,
      resourceId: `resource_${calendarId}`,
    });

    this.webhooks.set(watch.id, watch);

    return watch;
  }

  private async _stopWatch(channelId: string, resourceId: string): Promise<void> {
    await this.maybeDelay();
    await this.maybeSimulateError("stopWatch");

    this.webhooks.delete(channelId);
  }

  // ─────────────────────────────────────────────────────────────
  // Test Helpers
  // ─────────────────────────────────────────────────────────────

  /**
   * Add calendars for testing
   */
  addCalendars(calendars: GoogleCalendar[]): void {
    calendars.forEach((cal) => this.calendars.set(cal.id, cal));
  }

  /**
   * Add events for testing
   */
  addEvents(calendarId: string, events: GoogleEvent[]): void {
    if (!this.events.has(calendarId)) {
      this.events.set(calendarId, new Map());
    }
    const eventMap = this.events.get(calendarId)!;
    events.forEach((event) => eventMap.set(event.id, event));
  }

  /**
   * Get all stored events for a calendar
   */
  getStoredEvents(calendarId: string): GoogleEvent[] {
    const eventMap = this.events.get(calendarId);
    return eventMap ? Array.from(eventMap.values()) : [];
  }

  /**
   * Get all stored calendars
   */
  getStoredCalendars(): GoogleCalendar[] {
    return Array.from(this.calendars.values());
  }

  /**
   * Reset all spies
   */
  resetSpies(): void {
    this.listCalendars.mockClear();
    this.getCalendar.mockClear();
    this.listEvents.mockClear();
    this.getEvent.mockClear();
    this.createEvent.mockClear();
    this.updateEvent.mockClear();
    this.deleteEvent.mockClear();
    this.respondToEvent.mockClear();
    this.watchEvents.mockClear();
    this.stopWatch.mockClear();
  }

  /**
   * Clear all data
   */
  clearAll(): void {
    this.calendars.clear();
    this.events.clear();
    this.webhooks.clear();
    this.syncTokens.clear();
    this.errorCounts.clear();
    this.resetSpies();
  }
}

/**
 * Create a configured mock calendar client
 */
export function createMockCalendarClient(
  options?: MockClientOptions
): MockCalendarClient {
  return new MockCalendarClient(options);
}

