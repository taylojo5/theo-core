// ═══════════════════════════════════════════════════════════════════════════
// Calendar Test Mocks - Index
// Central export for all Calendar test mocks and utilities
// ═══════════════════════════════════════════════════════════════════════════

export { MockCalendarClient, createMockCalendarClient } from "./mock-client";
export type { MockClientOptions } from "./mock-client";

export {
  // Google API factories
  createMockCalendar,
  createMockPrimaryCalendar,
  createMockEvent,
  createMockAllDayEvent,
  createMockRecurringEvent,
  createMockEventWithAttendees,
  createMockEventWithMeet,
  createMockAttendee,
  createMockCalendarListResponse,
  createMockEventListResponse,
  createMockWatchResponse,
  // Database model factories
  createMockDbCalendar,
  createMockDbEvent,
  createMockDbApproval,
  createMockDbSyncState,
  // Utilities
  resetMockCounters,
} from "./mock-factories";

export type {
  CreateCalendarOptions,
  CreateEventOptions,
  CreateAttendeeOptions,
  CreateDbCalendarOptions,
  CreateDbEventOptions,
  CreateDbApprovalOptions,
  CreateDbSyncStateOptions,
} from "./mock-factories";


