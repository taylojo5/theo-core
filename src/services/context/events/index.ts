// ═══════════════════════════════════════════════════════════════════════════
// Events Service
// Barrel exports for Event entity management
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Service interface
  IEventsService,
  // Event-specific types
  SearchEventsOptions,
  SourceEventInput,
  EventWithPlace,
  TimeRangePreset,
  EventTimeRangeOptions,
  EventsErrorCode,
  // Re-exported base types
  Event,
  Place,
  CreateEventInput,
  UpdateEventInput,
  ListEventsOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  EventStatus,
} from "./types";

export { EventsServiceError } from "./types";

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  EventsService,
  // Individual functions (for direct import)
  createEvent,
  getEventById,
  getEventByIdWithPlace,
  updateEvent,
  updateEventStatus,
  cancelEvent,
  confirmEvent,
  deleteEvent,
  restoreEvent,
  listEvents,
  findEventBySource,
  searchEvents,
  getUpcomingEvents,
  getPastEvents,
  getEventsByTimeRange,
  getEventsOnDate,
  getEventsByPlace,
  upsertEventsFromSource,
} from "./events-service";

