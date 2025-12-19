// ═══════════════════════════════════════════════════════════════════════════
// Context Service
// Barrel exports for context entity management
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Enums & Constants
  EntityType,
  Source,
  SortOrder,
  PersonType,
  PlaceType,
  EventType,
  EventStatus,
  TaskStatus,
  TaskPriority,
  DeadlineType,
  DeadlineStatus,
  RelationshipType,

  // Pagination
  PaginationParams,
  PaginatedResult,

  // Base Query Options
  BaseListOptions,

  // Person
  CreatePersonInput,
  UpdatePersonInput,
  ListPeopleOptions,

  // Place
  CreatePlaceInput,
  UpdatePlaceInput,
  ListPlacesOptions,

  // Event
  CreateEventInput,
  UpdateEventInput,
  ListEventsOptions,

  // Task
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksOptions,

  // Deadline
  CreateDeadlineInput,
  UpdateDeadlineInput,
  ListDeadlinesOptions,

  // Relationship
  CreateRelationshipInput,
  UpdateRelationshipInput,
  ListRelationshipsOptions,
  RelatedEntity,

  // Search
  ContextSearchOptions,
  ContextSearchResult,

  // Service Context
  ServiceContext,

  // Utility Types
  BaseEntity,
  SourceEntityInput,
  UpsertResult,

  // Re-exported Prisma types
  Person,
  Place,
  Event,
  Task,
  Deadline,
  EntityRelationship,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

export {
  // Soft Delete
  excludeDeleted,
  onlyDeleted,
  softDeleteFilter,

  // Pagination
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizePagination,
  processPaginatedResults,
  buildOrderBy,

  // Email
  normalizeEmail,
  extractEmailDomain,
  isValidEmail,

  // Content Hash
  generateContentHash,
  generateEntityHash,

  // Text
  buildSearchableContent,
  truncateText,
  extractSnippet,

  // Tags
  normalizeTags,
  mergeTags,

  // Dates
  isPast,
  isFuture,
  isWithinDays,
  getDateRange,

  // Importance
  validateImportance,
  getImportanceLabel,
} from "./utils";

// ─────────────────────────────────────────────────────────────
// People Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  PeopleService,
  // Individual functions
  createPerson,
  getPersonById,
  updatePerson,
  deletePerson,
  restorePerson,
  listPeople,
  findPersonByEmail,
  findPersonBySource,
  searchPeople,
  upsertPeopleFromSource,
  // Error class
  PeopleServiceError,
} from "./people";

export type {
  // Service interface
  IPeopleService,
  // Person-specific types
  SearchPeopleOptions,
  SourcePersonInput,
  PeopleErrorCode,
} from "./people";

// ─────────────────────────────────────────────────────────────
// Places Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  PlacesService,
  // Individual functions
  createPlace,
  getPlaceById,
  updatePlace,
  deletePlace,
  restorePlace,
  listPlaces,
  findPlaceBySource,
  searchPlaces,
  findPlacesByCity,
  findPlacesNearby,
  upsertPlacesFromSource,
  // Error class
  PlacesServiceError,
} from "./places";

export type {
  // Service interface
  IPlacesService,
  // Place-specific types
  SearchPlacesOptions,
  SourcePlaceInput,
  GeocodingResult,
  PlacesErrorCode,
} from "./places";

// ─────────────────────────────────────────────────────────────
// Events Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  EventsService,
  // Individual functions
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
  // Error class
  EventsServiceError,
} from "./events";

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
} from "./events";

// ─────────────────────────────────────────────────────────────
// Tasks Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  TasksService,
  // Individual functions
  createTask,
  getTaskById,
  getTaskByIdWithRelations,
  updateTask,
  updateTaskStatus,
  completeTask,
  startTask,
  deferTask,
  cancelTask,
  reopenTask,
  getSubtasks,
  setTaskParent,
  reorderTask,
  deleteTask,
  restoreTask,
  listTasks,
  findTaskBySource,
  searchTasks,
  getOverdueTasks,
  getTasksDueSoon,
  getTasksDueOnDate,
  getTasksAssignedTo,
  upsertTasksFromSource,
  // Error class
  TasksServiceError,
} from "./tasks";

export type {
  // Service interface
  ITasksService,
  // Task-specific types
  SearchTasksOptions,
  SourceTaskInput,
  TaskWithRelations,
  TaskDueDateOptions,
  TasksErrorCode,
} from "./tasks";

// ─────────────────────────────────────────────────────────────
// Deadlines Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  DeadlinesService,
  // Individual functions
  createDeadline,
  getDeadlineById,
  getDeadlineByIdWithRelations,
  updateDeadline,
  updateDeadlineStatus,
  completeDeadline,
  markDeadlineMissed,
  extendDeadline,
  reopenDeadline,
  deleteDeadline,
  restoreDeadline,
  listDeadlines,
  findDeadlineBySource,
  searchDeadlines,
  getOverdueDeadlines,
  getApproachingDeadlines,
  getDeadlinesByUrgency,
  calculateDeadlineUrgency,
  getDeadlinesByTask,
  getDeadlinesByEvent,
  upsertDeadlinesFromSource,
  // Error class
  DeadlinesServiceError,
} from "./deadlines";

export type {
  // Service interface
  IDeadlinesService,
  // Deadline-specific types
  SearchDeadlinesOptions,
  SourceDeadlineInput,
  DeadlineWithRelations,
  DeadlineWithUrgency,
  UrgencyLevel,
  DeadlineUrgencyOptions,
  DeadlinesErrorCode,
} from "./deadlines";

// ─────────────────────────────────────────────────────────────
// Services (to be added in subsequent chunks)
// ─────────────────────────────────────────────────────────────

// export { RelationshipsService } from "./relationships";
// export { ContextSearchService } from "./search";
