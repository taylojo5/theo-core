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
// Services (to be added in subsequent chunks)
// ─────────────────────────────────────────────────────────────

// export { PeopleService } from "./people";
// export { PlacesService } from "./places";
// export { EventsService } from "./events";
// export { TasksService } from "./tasks";
// export { DeadlinesService } from "./deadlines";
// export { RelationshipsService } from "./relationships";
// export { ContextSearchService } from "./search";

