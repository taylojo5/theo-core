// ═══════════════════════════════════════════════════════════════════════════
// Calendar Client
// Type-safe Google Calendar API client with retry logic and rate limiting
// ═══════════════════════════════════════════════════════════════════════════

import { google, calendar_v3 } from "googleapis";
import { CalendarError, CalendarErrorCode, parseGoogleApiError } from "./errors";
import { CalendarRateLimiter, createCalendarRateLimiter } from "./rate-limiter";
import { clientLogger } from "./logger";
import {
  CALENDAR_MAX_RETRY_DELAY_MS,
  CALENDAR_REQUEST_TIMEOUT_MS,
  CALENDAR_MAX_RETRIES,
  CALENDAR_BASE_RETRY_DELAY_MS,
  DEFAULT_EVENT_PAGE_SIZE,
  DEFAULT_CALENDAR_PAGE_SIZE,
  WEBHOOK_MAX_LIFETIME_MS,
} from "./constants";
import {
  CALENDAR_QUOTA_UNITS,
  type GoogleCalendar,
  type GoogleEvent,
  type CalendarListResponse,
  type EventListResponse,
  type WatchResponse,
  type ListCalendarsOptions,
  type ListEventsOptions,
  type EventCreateInput,
  type EventUpdateInput,
  type CalendarOperation,
  type AttendeeResponseStatus,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Client Configuration
// ─────────────────────────────────────────────────────────────

export interface CalendarClientConfig {
  /** OAuth2 access token */
  accessToken: string;
  /** User ID for rate limiting */
  userId: string;
  /** Enable rate limiting (default: true) */
  enableRateLimiting?: boolean;
  /** Maximum retry attempts for retryable errors (default: 3) */
  maxRetries?: number;
  /** Request timeout in ms (default: 30000) */
  timeoutMs?: number;
}

const DEFAULT_CONFIG = {
  enableRateLimiting: true,
  maxRetries: CALENDAR_MAX_RETRIES,
  timeoutMs: CALENDAR_REQUEST_TIMEOUT_MS,
} as const;

// ─────────────────────────────────────────────────────────────
// Calendar Client Class
// ─────────────────────────────────────────────────────────────

/**
 * Google Calendar API client with rate limiting, retry logic, and type safety
 *
 * @example
 * ```typescript
 * const client = createCalendarClient(accessToken, userId);
 *
 * // List calendars
 * const calendars = await client.listCalendars();
 *
 * // List events with sync token support
 * const events = await client.listEvents("primary", { syncToken });
 *
 * // Create an event with Google Meet
 * const event = await client.createEvent("primary", {
 *   summary: "Team Meeting",
 *   start: { dateTime: "2024-01-15T10:00:00Z" },
 *   end: { dateTime: "2024-01-15T11:00:00Z" },
 *   createConference: true,
 * });
 * ```
 */
export class CalendarClient {
  private calendar: calendar_v3.Calendar;
  private rateLimiter: CalendarRateLimiter | null;
  private config: Required<CalendarClientConfig>;

  constructor(config: CalendarClientConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Create OAuth2 client with access token
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: config.accessToken });

    // Initialize Calendar API client
    this.calendar = google.calendar({ version: "v3", auth });

    // Initialize rate limiter
    this.rateLimiter = this.config.enableRateLimiting
      ? createCalendarRateLimiter(config.userId)
      : null;
  }

  // ─────────────────────────────────────────────────────────────
  // Calendar Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * List all calendars the user has access to
   */
  async listCalendars(
    options: ListCalendarsOptions = {}
  ): Promise<CalendarListResponse> {
    return this.execute("calendarList.list", async () => {
      const response = await this.calendar.calendarList.list({
        maxResults: options.maxResults || DEFAULT_CALENDAR_PAGE_SIZE,
        pageToken: options.pageToken,
        showHidden: options.showHidden,
        syncToken: options.syncToken,
      });

      const items = (response.data.items || []) as GoogleCalendar[];

      return {
        items,
        nextPageToken: response.data.nextPageToken || undefined,
        nextSyncToken: response.data.nextSyncToken || undefined,
        etag: response.data.etag || undefined,
      };
    });
  }

  /**
   * List all calendars across multiple pages
   */
  async listAllCalendars(
    options: Omit<ListCalendarsOptions, "pageToken"> = {}
  ): Promise<GoogleCalendar[]> {
    const calendars: GoogleCalendar[] = [];
    let pageToken: string | undefined;

    do {
      const response = await this.listCalendars({
        ...options,
        pageToken,
      });
      calendars.push(...response.items);
      pageToken = response.nextPageToken;
    } while (pageToken);

    return calendars;
  }

  /**
   * Get a specific calendar by ID
   */
  async getCalendar(calendarId: string): Promise<GoogleCalendar> {
    return this.execute("calendarList.get", async () => {
      const response = await this.calendar.calendarList.get({
        calendarId,
      });

      return response.data as GoogleCalendar;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Event Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * List events from a calendar with support for pagination and sync tokens
   */
  async listEvents(
    calendarId: string,
    options: ListEventsOptions = {}
  ): Promise<EventListResponse> {
    return this.execute("events.list", async () => {
      const response = await this.calendar.events.list({
        calendarId,
        maxResults: options.maxResults || DEFAULT_EVENT_PAGE_SIZE,
        pageToken: options.pageToken,
        timeMin: options.timeMin,
        timeMax: options.timeMax,
        updatedMin: options.updatedMin,
        syncToken: options.syncToken,
        showDeleted: options.showDeleted,
        singleEvents: options.singleEvents,
        orderBy: options.orderBy,
        q: options.q,
        timeZone: options.timeZone,
        maxAttendees: options.maxAttendees,
      });

      const items = (response.data.items || []) as GoogleEvent[];

      return {
        items,
        summary: response.data.summary || undefined,
        description: response.data.description || undefined,
        timeZone: response.data.timeZone || undefined,
        accessRole: response.data.accessRole as EventListResponse["accessRole"],
        nextPageToken: response.data.nextPageToken || undefined,
        nextSyncToken: response.data.nextSyncToken || undefined,
        defaultReminders: response.data.defaultReminders as EventListResponse["defaultReminders"],
        etag: response.data.etag || undefined,
        updated: response.data.updated || undefined,
      };
    });
  }

  /**
   * List all events from a calendar across multiple pages
   */
  async listAllEvents(
    calendarId: string,
    options: Omit<ListEventsOptions, "pageToken"> = {}
  ): Promise<{ events: GoogleEvent[]; nextSyncToken?: string }> {
    const events: GoogleEvent[] = [];
    let pageToken: string | undefined;
    let nextSyncToken: string | undefined;

    do {
      const response = await this.listEvents(calendarId, {
        ...options,
        pageToken,
      });
      events.push(...response.items);
      pageToken = response.nextPageToken;
      nextSyncToken = response.nextSyncToken;
    } while (pageToken);

    return { events, nextSyncToken };
  }

  /**
   * Get a specific event by ID
   */
  async getEvent(calendarId: string, eventId: string): Promise<GoogleEvent> {
    return this.execute("events.get", async () => {
      return this._getEventRaw(calendarId, eventId);
    });
  }

  /**
   * Internal method to fetch event without rate limiting
   * Use this within operations that are already wrapped in execute()
   */
  private async _getEventRaw(calendarId: string, eventId: string): Promise<GoogleEvent> {
    const response = await this.calendar.events.get({
      calendarId,
      eventId,
    });

    return response.data as GoogleEvent;
  }

  /**
   * Get instances of a recurring event
   */
  async getEventInstances(
    calendarId: string,
    eventId: string,
    options: {
      timeMin?: string;
      timeMax?: string;
      maxResults?: number;
      pageToken?: string;
    } = {}
  ): Promise<EventListResponse> {
    return this.execute("events.instances", async () => {
      const response = await this.calendar.events.instances({
        calendarId,
        eventId,
        timeMin: options.timeMin,
        timeMax: options.timeMax,
        maxResults: options.maxResults,
        pageToken: options.pageToken,
      });

      const items = (response.data.items || []) as GoogleEvent[];

      return {
        items,
        nextPageToken: response.data.nextPageToken || undefined,
        etag: response.data.etag || undefined,
      };
    });
  }

  /**
   * Create a new event
   */
  async createEvent(
    calendarId: string,
    event: EventCreateInput
  ): Promise<GoogleEvent> {
    return this.execute("events.insert", async () => {
      // Build the request body
      const requestBody: calendar_v3.Schema$Event = {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: event.start,
        end: event.end,
        attendees: event.attendees?.map((a) => ({
          email: a.email,
          optional: a.optional,
        })),
        reminders: event.reminders,
        recurrence: event.recurrence,
        visibility: event.visibility,
        guestsCanInviteOthers: event.guestsCanInviteOthers,
        guestsCanSeeOtherGuests: event.guestsCanSeeOtherGuests,
        colorId: event.colorId,
      };

      // Add Google Meet if requested
      if (event.createConference) {
        requestBody.conferenceData = {
          createRequest: {
            requestId: `theo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            conferenceSolutionKey: {
              type: "hangoutsMeet",
            },
          },
        };
      }

      const response = await this.calendar.events.insert({
        calendarId,
        requestBody,
        conferenceDataVersion: event.createConference ? 1 : undefined,
        sendUpdates: event.attendees?.length ? "all" : "none",
      });

      return response.data as GoogleEvent;
    });
  }

  /**
   * Update an existing event
   * 
   * Note: This operation costs 3 quota units total:
   * - 1 unit for events.get (prefetch existing event)
   * - 2 units for events.update (the actual update)
   * 
   * All 3 units are checked and consumed atomically before any API calls,
   * preventing quota waste if the rate limit check fails.
   */
  async updateEvent(
    calendarId: string,
    eventId: string,
    event: EventUpdateInput,
    options: {
      /** Send notification updates to attendees */
      sendUpdates?: "all" | "externalOnly" | "none";
    } = {}
  ): Promise<GoogleEvent> {
    // Execute with additionalUnits: 1 to account for the prefetch (events.get)
    // This ensures all 3 quota units are checked atomically before any API calls
    return this.execute("events.update", async () => {
      // First, get the existing event to merge with updates
      // Quota already consumed above, so use internal method without rate-limiting
      const existing = await this._getEventRaw(calendarId, eventId);

      // Build the updated event
      const requestBody: calendar_v3.Schema$Event = {
        ...existing,
        summary: event.summary ?? existing.summary,
        description: event.description ?? existing.description,
        location: event.location ?? existing.location,
        start: event.start ?? existing.start,
        end: event.end ?? existing.end,
        attendees: event.attendees ?? existing.attendees,
        reminders: event.reminders ?? existing.reminders,
        recurrence: event.recurrence ?? existing.recurrence,
        visibility: event.visibility ?? existing.visibility,
        status: event.status ?? existing.status,
        colorId: event.colorId ?? existing.colorId,
      };

      const response = await this.calendar.events.update({
        calendarId,
        eventId,
        requestBody,
        sendUpdates: options.sendUpdates || "none",
      });

      return response.data as GoogleEvent;
    }, { additionalUnits: 1 });
  }

  /**
   * Patch an event (partial update)
   */
  async patchEvent(
    calendarId: string,
    eventId: string,
    patch: Partial<EventUpdateInput>,
    options: {
      sendUpdates?: "all" | "externalOnly" | "none";
    } = {}
  ): Promise<GoogleEvent> {
    return this.execute("events.patch", async () => {
      const response = await this.calendar.events.patch({
        calendarId,
        eventId,
        requestBody: patch as calendar_v3.Schema$Event,
        sendUpdates: options.sendUpdates || "none",
      });

      return response.data as GoogleEvent;
    });
  }

  /**
   * Delete an event
   */
  async deleteEvent(
    calendarId: string,
    eventId: string,
    options: {
      sendUpdates?: "all" | "externalOnly" | "none";
    } = {}
  ): Promise<void> {
    return this.execute("events.delete", async () => {
      await this.calendar.events.delete({
        calendarId,
        eventId,
        sendUpdates: options.sendUpdates || "none",
      });
    });
  }

  /**
   * Move an event to another calendar
   */
  async moveEvent(
    calendarId: string,
    eventId: string,
    destinationCalendarId: string,
    options: {
      sendUpdates?: "all" | "externalOnly" | "none";
    } = {}
  ): Promise<GoogleEvent> {
    return this.execute("events.move", async () => {
      const response = await this.calendar.events.move({
        calendarId,
        eventId,
        destination: destinationCalendarId,
        sendUpdates: options.sendUpdates || "none",
      });

      return response.data as GoogleEvent;
    });
  }

  /**
   * Quick add an event using natural language
   */
  async quickAddEvent(
    calendarId: string,
    text: string,
    options: {
      sendUpdates?: "all" | "externalOnly" | "none";
    } = {}
  ): Promise<GoogleEvent> {
    return this.execute("events.quickAdd", async () => {
      const response = await this.calendar.events.quickAdd({
        calendarId,
        text,
        sendUpdates: options.sendUpdates || "none",
      });

      return response.data as GoogleEvent;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Event Response (RSVP)
  // ─────────────────────────────────────────────────────────────

  /**
   * Respond to an event invitation (RSVP)
   * 
   * Note: This operation costs 3 quota units total:
   * - 1 unit for events.get (prefetch event to find attendee entry)
   * - 2 units for events.patch (the actual RSVP update)
   * 
   * All 3 units are checked and consumed atomically before any API calls,
   * preventing quota waste if the rate limit check fails.
   */
  async respondToEvent(
    calendarId: string,
    eventId: string,
    response: AttendeeResponseStatus,
    options: {
      /** Optional comment with the response */
      comment?: string;
      /** Send notification updates */
      sendUpdates?: "all" | "externalOnly" | "none";
    } = {}
  ): Promise<GoogleEvent> {
    // Execute with additionalUnits: 1 to account for the prefetch (events.get)
    // This ensures all 3 quota units are checked atomically before any API calls
    return this.execute("events.patch", async () => {
      // Get the current event to find our attendee entry
      // Quota already consumed above, so use internal method without rate-limiting
      const event = await this._getEventRaw(calendarId, eventId);

      // Validate event has attendees
      if (!event.attendees || event.attendees.length === 0) {
        throw new CalendarError(
          CalendarErrorCode.INVALID_REQUEST,
          "Cannot respond to event: event has no attendees",
          false
        );
      }

      // Find the current user in the attendee list
      const selfAttendee = event.attendees.find((a) => a.self);
      if (!selfAttendee) {
        throw new CalendarError(
          CalendarErrorCode.INVALID_REQUEST,
          "Cannot respond to event: current user is not an attendee",
          false
        );
      }

      // Update our response status in the attendees list
      const updatedAttendees = event.attendees.map((attendee) => {
        if (attendee.self) {
          return {
            ...attendee,
            responseStatus: response,
            comment: options.comment ?? attendee.comment,
          };
        }
        return attendee;
      });

      const patchResponse = await this.calendar.events.patch({
        calendarId,
        eventId,
        requestBody: {
          attendees: updatedAttendees,
        },
        sendUpdates: options.sendUpdates || "all",
      });

      return patchResponse.data as GoogleEvent;
    }, { additionalUnits: 1 });
  }

  // ─────────────────────────────────────────────────────────────
  // Webhook Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Set up a watch channel for calendar events
   */
  async watchEvents(
    calendarId: string,
    channelId: string,
    webhookUrl: string,
    options: {
      /** Token to include in notifications */
      token?: string;
      /** Expiration time (max 7 days from now) */
      expiration?: Date;
    } = {}
  ): Promise<WatchResponse> {
    // Validate webhook URL uses HTTPS
    if (!webhookUrl.startsWith("https://")) {
      throw new CalendarError(
        CalendarErrorCode.INVALID_REQUEST,
        "Webhook URL must use HTTPS",
        false
      );
    }

    return this.execute("events.watch", async () => {
      // Calculate expiration (max 7 days)
      const maxExpiration = Date.now() + WEBHOOK_MAX_LIFETIME_MS;
      const requestedExpiration = options.expiration?.getTime() || maxExpiration;
      const expiration = Math.min(requestedExpiration, maxExpiration);

      const response = await this.calendar.events.watch({
        calendarId,
        requestBody: {
          id: channelId,
          type: "web_hook",
          address: webhookUrl,
          token: options.token,
          expiration: String(expiration),
        },
      });

      return {
        id: response.data.id!,
        resourceId: response.data.resourceId!,
        resourceUri: response.data.resourceUri!,
        expiration: response.data.expiration!,
        token: response.data.token || undefined,
      };
    });
  }

  /**
   * Stop receiving notifications for a watch channel
   */
  async stopWatching(channelId: string, resourceId: string): Promise<void> {
    return this.execute("channels.stop", async () => {
      await this.calendar.channels.stop({
        requestBody: {
          id: channelId,
          resourceId,
        },
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Settings Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * List all user calendar settings
   */
  async listSettings(): Promise<Array<{ id: string; value: string }>> {
    return this.execute("settings.list", async () => {
      const response = await this.calendar.settings.list();

      return (response.data.items || []).map((item) => ({
        id: item.id!,
        value: item.value!,
      }));
    });
  }

  /**
   * Get a specific setting
   */
  async getSetting(settingId: string): Promise<{ id: string; value: string }> {
    return this.execute("settings.get", async () => {
      const response = await this.calendar.settings.get({
        setting: settingId,
      });

      return {
        id: response.data.id!,
        value: response.data.value!,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Free/Busy Query
  // ─────────────────────────────────────────────────────────────

  /**
   * Query free/busy information for calendars
   */
  async queryFreeBusy(
    timeMin: string,
    timeMax: string,
    calendarIds: string[]
  ): Promise<
    Record<
      string,
      {
        busy: Array<{ start: string; end: string }>;
        errors?: Array<{ domain: string; reason: string }>;
      }
    >
  > {
    return this.execute("freebusy.query", async () => {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin,
          timeMax,
          items: calendarIds.map((id) => ({ id })),
        },
      });

      const calendars = response.data.calendars || {};
      const result: Record<
        string,
        {
          busy: Array<{ start: string; end: string }>;
          errors?: Array<{ domain: string; reason: string }>;
        }
      > = {};

      for (const [id, data] of Object.entries(calendars)) {
        result[id] = {
          busy: (data.busy || []).map((b) => ({
            start: b.start!,
            end: b.end!,
          })),
          errors: data.errors?.map((e) => ({
            domain: e.domain!,
            reason: e.reason!,
          })),
        };
      }

      return result;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Colors
  // ─────────────────────────────────────────────────────────────

  /**
   * Get available calendar and event colors
   */
  async getColors(): Promise<{
    calendar: Record<string, { background: string; foreground: string }>;
    event: Record<string, { background: string; foreground: string }>;
  }> {
    return this.execute("colors.get", async () => {
      const response = await this.calendar.colors.get();

      const mapColors = (
        colors: Record<string, { background?: string; foreground?: string }> | undefined
      ): Record<string, { background: string; foreground: string }> => {
        const result: Record<string, { background: string; foreground: string }> = {};
        if (colors) {
          for (const [id, color] of Object.entries(colors)) {
            result[id] = {
              background: color.background!,
              foreground: color.foreground!,
            };
          }
        }
        return result;
      };

      return {
        calendar: mapColors(response.data.calendar as Record<string, { background?: string; foreground?: string }>),
        event: mapColors(response.data.event as Record<string, { background?: string; foreground?: string }>),
      };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Execution & Retry Logic
  // ─────────────────────────────────────────────────────────────

  /**
   * Execute an API call with rate limiting and retry logic
   * 
   * Rate limiting strategy to minimize quota waste:
   * 1. Wait for quota availability using peek (read-only, no consumption)
   * 2. Verify with peek immediately before consuming
   * 3. Only consume quota via check() when we're confident it will succeed
   * 4. If check() fails due to race condition, we've only wasted one attempt
   * 
   * @param operation - The primary operation being performed
   * @param fn - The function to execute
   * @param options.additionalUnits - Extra quota units to account for (e.g., prefetch calls)
   */
  private async execute<T>(
    operation: CalendarOperation,
    fn: () => Promise<T>,
    options?: { additionalUnits?: number }
  ): Promise<T> {
    // Calculate total units needed (operation units + any additional)
    const additionalUnits = options?.additionalUnits ?? 0;
    
    // Rate limit check and consumption
    if (this.rateLimiter) {
      try {
        // Get total units needed for rate limiting
        const operationUnits = CALENDAR_QUOTA_UNITS[operation];
        const totalUnits = operationUnits + additionalUnits;
        
        // Wait for total quota to become available (peek-only, no consumption)
        await this.rateLimiter.waitForQuotaUnits(totalUnits, this.config.timeoutMs, operation);

        // Verify quota is still available with peek before consuming
        // This reduces the chance of wasting quota due to race conditions
        const peekResult = await this.rateLimiter.peekUnits(totalUnits);
        if (!peekResult.allowed) {
          // Quota was consumed between waitForQuota and peek
          // Wait the suggested time and try peeking again
          if (peekResult.waitMs) {
            await this.sleep(peekResult.waitMs);
          }
          
          const retryPeek = await this.rateLimiter.peekUnits(totalUnits);
          if (!retryPeek.allowed) {
            throw new CalendarError(
              CalendarErrorCode.RATE_LIMITED,
              "Rate limit exceeded after waiting",
              true,
              retryPeek.waitMs || 1000
            );
          }
        }

        // Now consume total quota - at this point we're confident it should succeed
        // If it fails due to a last-moment race condition, we accept the small
        // quota waste as the cost of avoiding larger waste scenarios
        const checkResult = await this.rateLimiter.checkUnits(totalUnits);
        if (!checkResult.allowed) {
          // Rare race condition: another request consumed quota between our
          // peek and check. The quota units are consumed but we can't proceed.
          // This is acceptable as it only wastes one set of units, vs the old
          // approach which could waste many units in wait loops.
          throw new CalendarError(
            CalendarErrorCode.RATE_LIMITED,
            "Rate limit exceeded (concurrent request consumed quota)",
            true,
            checkResult.waitMs || 1000
          );
        }
      } catch (error) {
        // Rate limiter error - re-throw as Calendar error
        if (error instanceof CalendarError) throw error;
        throw new CalendarError(
          CalendarErrorCode.RATE_LIMITED,
          "Rate limit check failed",
          true,
          1000
        );
      }
    }

    let lastError: CalendarError | undefined;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await fn();
        return result;
      } catch (error) {
        const calendarError = parseGoogleApiError(error);
        lastError = calendarError;

        // Don't retry non-retryable errors
        if (!calendarError.retryable) {
          throw calendarError;
        }

        // Don't retry on last attempt
        if (attempt === this.config.maxRetries) {
          throw calendarError;
        }

        // Calculate backoff delay
        const baseDelay = calendarError.retryAfterMs || CALENDAR_BASE_RETRY_DELAY_MS;
        const delay = Math.min(
          baseDelay * Math.pow(2, attempt - 1),
          CALENDAR_MAX_RETRY_DELAY_MS
        );

        clientLogger.warn("Retrying operation", {
          operation,
          attempt,
          maxRetries: this.config.maxRetries,
          delayMs: delay,
          error: calendarError.message,
        });

        await this.sleep(delay);
      }
    }

    // Should not reach here, but TypeScript needs this
    throw (
      lastError ||
      new CalendarError(CalendarErrorCode.UNKNOWN, "Unknown error", false)
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─────────────────────────────────────────────────────────────
// Factory Functions
// ─────────────────────────────────────────────────────────────

/**
 * Create a Calendar client from an access token
 */
export function createCalendarClient(
  accessToken: string,
  userId: string,
  options?: Partial<CalendarClientConfig>
): CalendarClient {
  return new CalendarClient({
    accessToken,
    userId,
    ...options,
  });
}

export default CalendarClient;

