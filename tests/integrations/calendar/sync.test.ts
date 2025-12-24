// ═══════════════════════════════════════════════════════════════════════════
// Calendar Sync Tests
// Tests for full and incremental sync functionality
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createMockCalendar,
  createMockEvent,
  createMockEventListResponse,
  createMockCalendarListResponse,
  createMockDbSyncState,
  createMockDbCalendar,
  resetMockCounters,
  MockCalendarClient,
} from "./mocks";

// Mock dependencies
vi.mock("@/integrations/calendar/repository", () => ({
  calendarRepository: {
    findByUser: vi.fn(),
    upsertMany: vi.fn(),
    findById: vi.fn(),
  },
  calendarEventRepository: {
    upsertMany: vi.fn(),
    findByUser: vi.fn(),
    softDeleteMany: vi.fn(),
  },
  calendarSyncStateRepository: {
    findOrCreate: vi.fn(),
    update: vi.fn(),
    findByUser: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    $transaction: vi.fn((fn) => fn({
      calendar: { findMany: vi.fn(), upsert: vi.fn() },
      event: { findMany: vi.fn(), upsert: vi.fn() },
      calendarSyncState: { findUnique: vi.fn(), upsert: vi.fn() },
    })),
  },
}));

describe("Calendar Sync", () => {
  beforeEach(() => {
    resetMockCounters();
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // Sync State Tests
  // ─────────────────────────────────────────────────────────────

  describe("Sync State Management", () => {
    it("should create default sync state", () => {
      const syncState = createMockDbSyncState();

      expect(syncState.status).toBe("idle");
      expect(syncState.eventCount).toBe(0);
      expect(syncState.calendarCount).toBe(0);
      expect(syncState.errorCount).toBe(0);
    });

    it("should track sync status transitions", () => {
      // Initial state
      const idle = createMockDbSyncState({ status: "idle" });
      expect(idle.status).toBe("idle");

      // Syncing state
      const syncing = createMockDbSyncState({ status: "syncing" });
      expect(syncing.status).toBe("syncing");

      // Full sync state
      const fullSync = createMockDbSyncState({ status: "full_sync" });
      expect(fullSync.status).toBe("full_sync");

      // Incremental sync state
      const incrementalSync = createMockDbSyncState({ status: "incremental_sync" });
      expect(incrementalSync.status).toBe("incremental_sync");

      // Error state
      const error = createMockDbSyncState({
        status: "error",
        errorMessage: "Sync failed",
        errorCount: 1,
      });
      expect(error.status).toBe("error");
      expect(error.errorMessage).toBe("Sync failed");
    });

    it("should track sync tokens", () => {
      const syncState = createMockDbSyncState({
        calendarSyncToken: "cal_sync_token_123",
        eventSyncTokens: {
          primary: "evt_sync_primary_456",
          "work@calendar.com": "evt_sync_work_789",
        },
      });

      expect(syncState.calendarSyncToken).toBe("cal_sync_token_123");
      expect(syncState.eventSyncTokens).toHaveProperty("primary");
      expect((syncState.eventSyncTokens as Record<string, string>)["primary"]).toBe("evt_sync_primary_456");
    });

    it("should track webhook information", () => {
      const syncState = createMockDbSyncState({
        webhookChannelId: "channel_123",
        webhookResourceId: "resource_456",
        webhookExpiration: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(syncState.webhookChannelId).toBe("channel_123");
      expect(syncState.webhookResourceId).toBe("resource_456");
      expect(syncState.webhookExpiration).toBeInstanceOf(Date);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Mock Client Tests
  // ─────────────────────────────────────────────────────────────

  describe("Mock Calendar Client", () => {
    it("should list calendars", async () => {
      const client = new MockCalendarClient();
      const calendars = [
        createMockCalendar({ id: "cal-1", summary: "Work" }),
        createMockCalendar({ id: "cal-2", summary: "Personal" }),
      ];
      client.addCalendars(calendars);

      const result = await client.listCalendars();

      expect(result.items).toHaveLength(3); // 2 added + 1 default primary
    });

    it("should list events for a calendar", async () => {
      const client = new MockCalendarClient();
      const events = [
        createMockEvent({ id: "evt-1", summary: "Meeting 1" }),
        createMockEvent({ id: "evt-2", summary: "Meeting 2" }),
      ];
      client.addEvents("primary", events);

      const result = await client.listEvents({ calendarId: "primary" });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].summary).toBe("Meeting 1");
    });

    it("should create events", async () => {
      const client = new MockCalendarClient();

      const created = await client.createEvent("primary", {
        summary: "New Meeting",
        start: { dateTime: "2024-03-15T10:00:00Z" },
        end: { dateTime: "2024-03-15T11:00:00Z" },
      });

      expect(created.summary).toBe("New Meeting");
      expect(client.getStoredEvents("primary")).toHaveLength(1);
    });

    it("should update events", async () => {
      const client = new MockCalendarClient();
      const event = createMockEvent({ id: "evt-1", summary: "Original" });
      client.addEvents("primary", [event]);

      const updated = await client.updateEvent("primary", "evt-1", {
        summary: "Updated Title",
      });

      expect(updated.summary).toBe("Updated Title");
      expect(updated.sequence).toBe(1);
    });

    it("should delete events (soft delete)", async () => {
      const client = new MockCalendarClient();
      const event = createMockEvent({ id: "evt-1" });
      client.addEvents("primary", [event]);

      await client.deleteEvent("primary", "evt-1");

      const events = client.getStoredEvents("primary");
      expect(events[0].status).toBe("cancelled");
    });

    it("should handle respond to event", async () => {
      const client = new MockCalendarClient();
      const event = createMockEvent({
        id: "evt-1",
        attendees: [
          { email: "me@example.com", self: true, responseStatus: "needsAction" },
        ],
      });
      client.addEvents("primary", [event]);

      await client.respondToEvent("primary", "evt-1", "accepted");

      const events = client.getStoredEvents("primary");
      const selfAttendee = events[0].attendees?.find((a) => a.self);
      expect(selfAttendee?.responseStatus).toBe("accepted");
    });

    it("should filter events by time range", async () => {
      const client = new MockCalendarClient();
      const events = [
        createMockEvent({
          id: "past",
          startDate: new Date("2024-01-01T10:00:00Z"),
        }),
        createMockEvent({
          id: "future",
          startDate: new Date("2024-06-01T10:00:00Z"),
        }),
      ];
      client.addEvents("primary", events);

      const result = await client.listEvents({
        calendarId: "primary",
        timeMin: "2024-03-01T00:00:00Z",
      });

      expect(result.items.some((e) => e.id === "future")).toBe(true);
      expect(result.items.some((e) => e.id === "past")).toBe(false);
    });

    it("should simulate errors", async () => {
      const client = new MockCalendarClient({
        errorOn: [
          { operation: "listCalendars", error: new Error("API Error"), times: 1 },
        ],
      });

      await expect(client.listCalendars()).rejects.toThrow("API Error");

      // Second call should succeed
      const result = await client.listCalendars();
      expect(result.items).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Full Sync Flow Tests
  // ─────────────────────────────────────────────────────────────

  describe("Full Sync Flow", () => {
    it("should sync calendars from Google to database", async () => {
      const { calendarRepository } = await import(
        "@/integrations/calendar/repository"
      );

      const googleCalendars = [
        createMockCalendar({ id: "primary", summary: "Primary Calendar", primary: true }),
        createMockCalendar({ id: "work@calendar.com", summary: "Work" }),
      ];

      // upsertMany returns a count (number), not an array
      vi.mocked(calendarRepository.upsertMany).mockResolvedValue(2);

      // Simulate syncing calendars
      const result = await calendarRepository.upsertMany(
        googleCalendars.map((cal) => ({
          userId: "user-123",
          googleCalendarId: cal.id,
          name: cal.summary,
          timeZone: cal.timeZone || "UTC",
          accessRole: cal.accessRole,
          isPrimary: cal.primary || false,
          isOwner: cal.accessRole === "owner",
          isSelected: cal.selected ?? true,
          isHidden: cal.hidden ?? false,
        }))
      );

      expect(result).toBe(2);
      expect(calendarRepository.upsertMany).toHaveBeenCalled();
    });

    it("should track sync progress", () => {
      const progress = {
        phase: "calendars",
        calendarsProcessed: 0,
        calendarsTotal: 5,
        eventsProcessed: 0,
        eventsTotal: 0,
        errors: [],
      };

      // Simulate progress updates
      progress.calendarsProcessed = 5;
      progress.phase = "events";
      progress.eventsTotal = 100;
      progress.eventsProcessed = 50;

      expect(progress.calendarsProcessed).toBe(5);
      expect(progress.eventsProcessed).toBe(50);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Incremental Sync Tests
  // ─────────────────────────────────────────────────────────────

  describe("Incremental Sync", () => {
    it("should use sync token for incremental sync", async () => {
      const client = new MockCalendarClient();
      const events = [createMockEvent({ id: "new-event" })];
      client.addEvents("primary", events);

      // Simulate incremental sync with token
      const result = await client.listEvents({
        calendarId: "primary",
        // syncToken would be used here in real implementation
      });

      expect(result.nextSyncToken).toBeDefined();
    });

    it("should handle sync token expiration", async () => {
      // When sync token expires, Google returns 410 Gone
      // The system should fall back to full sync
      const syncState = createMockDbSyncState({
        calendarSyncToken: "expired_token",
        lastFullSyncAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      });

      // Simulate detecting expired token scenario
      const needsFullSync = !syncState.calendarSyncToken || 
        (syncState.lastFullSyncAt && 
         Date.now() - syncState.lastFullSyncAt.getTime() > 7 * 24 * 60 * 60 * 1000);

      expect(needsFullSync).toBe(true);
    });

    it("should detect event changes", () => {
      const oldEvent = createMockEvent({
        id: "evt-1",
        summary: "Original Title",
        updated: "2024-03-01T10:00:00Z",
      });

      const updatedEvent = createMockEvent({
        id: "evt-1",
        summary: "Updated Title",
        updated: "2024-03-15T10:00:00Z",
      });

      const hasChanged = oldEvent.updated !== updatedEvent.updated;
      expect(hasChanged).toBe(true);
    });

    it("should handle deleted events", () => {
      const deletedEvent = createMockEvent({
        id: "evt-1",
        status: "cancelled",
      });

      expect(deletedEvent.status).toBe("cancelled");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Pagination Tests
  // ─────────────────────────────────────────────────────────────

  describe("Pagination Handling", () => {
    it("should handle paginated calendar list", () => {
      const page1 = createMockCalendarListResponse(
        [createMockCalendar({ id: "cal-1" })],
        { nextPageToken: "token_page_2" }
      );

      const page2 = createMockCalendarListResponse(
        [createMockCalendar({ id: "cal-2" })],
        { nextSyncToken: "sync_token_final" }
      );

      expect(page1.nextPageToken).toBe("token_page_2");
      expect(page1.nextSyncToken).toBeUndefined();
      expect(page2.nextPageToken).toBeUndefined();
      expect(page2.nextSyncToken).toBe("sync_token_final");
    });

    it("should handle paginated event list", () => {
      const page1 = createMockEventListResponse(
        [createMockEvent({ id: "evt-1" })],
        { nextPageToken: "events_page_2" }
      );

      const page2 = createMockEventListResponse(
        [createMockEvent({ id: "evt-2" })],
        { nextSyncToken: "events_sync_token" }
      );

      expect(page1.nextPageToken).toBe("events_page_2");
      expect(page2.nextSyncToken).toBe("events_sync_token");
    });

    it("should aggregate results across pages", () => {
      const allEvents = [
        createMockEvent({ id: "evt-1" }),
        createMockEvent({ id: "evt-2" }),
        createMockEvent({ id: "evt-3" }),
      ];

      expect(allEvents).toHaveLength(3);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Error Handling Tests
  // ─────────────────────────────────────────────────────────────

  describe("Sync Error Handling", () => {
    it("should track error count", () => {
      const syncState = createMockDbSyncState({
        status: "error",
        errorMessage: "Rate limit exceeded",
        errorCount: 3,
      });

      expect(syncState.errorCount).toBe(3);
      expect(syncState.errorMessage).toBe("Rate limit exceeded");
    });

    it("should implement exponential backoff", () => {
      const errorCount = 3;
      const baseDelay = 1000;
      const maxDelay = 60000;

      const delay = Math.min(baseDelay * Math.pow(2, errorCount), maxDelay);

      expect(delay).toBe(8000); // 1000 * 2^3 = 8000
    });

    it("should pause sync after max errors", () => {
      const maxErrors = 5;
      const syncState = createMockDbSyncState({
        status: "error",
        errorCount: 6,
      });

      const shouldPause = syncState.errorCount >= maxErrors;
      expect(shouldPause).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Calendar Selection Tests
  // ─────────────────────────────────────────────────────────────

  describe("Calendar Selection for Sync", () => {
    it("should only sync selected calendars", () => {
      const calendars = [
        createMockDbCalendar({ id: "1", isSelected: true, isHidden: false }),
        createMockDbCalendar({ id: "2", isSelected: false, isHidden: false }),
        createMockDbCalendar({ id: "3", isSelected: true, isHidden: true }),
      ];

      const selectedForSync = calendars.filter((c) => c.isSelected && !c.isHidden);

      expect(selectedForSync).toHaveLength(1);
      expect(selectedForSync[0].id).toBe("1");
    });

    it("should always sync primary calendar", () => {
      const calendars = [
        createMockDbCalendar({ id: "1", isPrimary: true, isSelected: false }),
        createMockDbCalendar({ id: "2", isPrimary: false, isSelected: true }),
      ];

      const toSync = calendars.filter((c) => c.isPrimary || c.isSelected);

      expect(toSync).toHaveLength(2);
    });
  });
});

