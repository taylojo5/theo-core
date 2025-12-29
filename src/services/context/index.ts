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
  RoutineType,
  RoutineFrequency,
  RoutineStatus,
  OpenLoopType,
  OpenLoopStatus,
  OpenLoopPriority,
  ProjectType,
  ProjectStatus,
  ProjectPriority,
  NoteType,
  OpportunityType,
  OpportunityStatus,
  OpportunityPriority,

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

  // Routine
  CreateRoutineInput,
  UpdateRoutineInput,
  ListRoutinesOptions,

  // OpenLoop
  CreateOpenLoopInput,
  UpdateOpenLoopInput,
  ListOpenLoopsOptions,

  // Project
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsOptions,

  // Note
  CreateNoteInput,
  UpdateNoteInput,
  ListNotesOptions,

  // Opportunity
  CreateOpportunityInput,
  UpdateOpportunityInput,
  ListOpportunitiesOptions,

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
  Routine,
  OpenLoop,
  Project,
  Note,
  Opportunity,
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
// Relationships Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  RelationshipsService,
  // Individual functions
  createRelationship,
  getRelationshipById,
  updateRelationship,
  deleteRelationship,
  restoreRelationship,
  listRelationships,
  getRelationshipsFor,
  getRelatedEntities,
  findRelationshipBetween,
  relationshipExists,
  syncRelationships,
  createManyRelationships,
  deleteRelationshipsForEntity,
  // Error class
  RelationshipsServiceError,
} from "./relationships";

export type {
  // Service interface
  IRelationshipsService,
  // Query options
  RelationshipQueryOptions,
  GetRelatedEntitiesOptions,
  // Entity types
  ContextEntity,
  RelationshipWithEntities,
  // Sync input
  SyncRelationshipsInput,
  // Error types
  RelationshipsErrorCode,
} from "./relationships";

// ─────────────────────────────────────────────────────────────
// Routines Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  RoutinesService,
  // Individual functions
  createRoutine,
  getRoutineById,
  updateRoutine,
  deleteRoutine,
  restoreRoutine,
  pauseRoutine,
  resumeRoutine,
  archiveRoutine,
  recordRoutineCompletion,
  recordRoutineSkip,
  listRoutines,
  findRoutineBySource,
  searchRoutines,
  getRoutinesDueNow,
  getUpcomingRoutines,
  getRoutinesByCategory,
  upsertRoutinesFromSource,
  // Error class
  RoutinesServiceError,
} from "./routines";

export type {
  // Service interface
  IRoutinesService,
  // Routine-specific types
  SearchRoutinesOptions,
  SourceRoutineInput,
  RoutinesErrorCode,
} from "./routines";

// ─────────────────────────────────────────────────────────────
// OpenLoops Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  OpenLoopsService,
  // Individual functions
  createOpenLoop,
  getOpenLoopById,
  updateOpenLoop,
  deleteOpenLoop,
  restoreOpenLoop,
  resolveOpenLoop,
  cancelOpenLoop,
  markOpenLoopStale,
  reopenOpenLoop,
  listOpenLoops,
  findOpenLoopBySource,
  searchOpenLoops,
  getOpenOpenLoops,
  getOverdueOpenLoops,
  getOpenLoopsByPerson,
  upsertOpenLoopsFromSource,
  // Error class
  OpenLoopsServiceError,
} from "./open-loops";

export type {
  // Service interface
  IOpenLoopsService,
  // OpenLoop-specific types
  SearchOpenLoopsOptions,
  SourceOpenLoopInput,
  OpenLoopsErrorCode,
} from "./open-loops";

// ─────────────────────────────────────────────────────────────
// Projects Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  ProjectsService,
  // Individual functions
  createProject,
  getProjectById,
  getProjectByIdWithRelations,
  updateProject,
  deleteProject,
  restoreProject,
  startProject,
  completeProject,
  cancelProject,
  putProjectOnHold,
  archiveProject,
  getProjectChildren,
  setProjectParent,
  listProjects,
  findProjectBySource,
  searchProjects,
  getActiveProjects,
  getOverdueProjects,
  upsertProjectsFromSource,
  // Error class
  ProjectsServiceError,
} from "./projects";

export type {
  // Service interface
  IProjectsService,
  // Project-specific types
  SearchProjectsOptions,
  SourceProjectInput,
  ProjectWithRelations,
  ProjectsErrorCode,
} from "./projects";

// ─────────────────────────────────────────────────────────────
// Notes Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  NotesService,
  // Individual functions
  createNote,
  getNoteById,
  updateNote,
  deleteNote,
  restoreNote,
  pinNote,
  unpinNote,
  favoriteNote,
  unfavoriteNote,
  listNotes,
  findNoteBySource,
  searchNotes,
  getPinnedNotes,
  getFavoriteNotes,
  getRecentNotes,
  getNotesByCategory,
  upsertNotesFromSource,
  // Error class
  NotesServiceError,
} from "./notes";

export type {
  // Service interface
  INotesService,
  // Note-specific types
  SearchNotesOptions,
  SourceNoteInput,
  NotesErrorCode,
} from "./notes";

// ─────────────────────────────────────────────────────────────
// Opportunities Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  OpportunitiesService,
  // Individual functions
  createOpportunity,
  getOpportunityById,
  updateOpportunity,
  deleteOpportunity,
  restoreOpportunity,
  startEvaluatingOpportunity,
  pursueOpportunity,
  declineOpportunity,
  markOpportunityExpired,
  archiveOpportunity,
  convertOpportunity,
  listOpportunities,
  findOpportunityBySource,
  searchOpportunities,
  getActiveOpportunities,
  getExpiringOpportunities,
  getOpportunitiesByPerson,
  getOpportunitiesByCategory,
  upsertOpportunitiesFromSource,
  // Error class
  OpportunitiesServiceError,
} from "./opportunities";

export type {
  // Service interface
  IOpportunitiesService,
  // Opportunity-specific types
  SearchOpportunitiesOptions,
  SourceOpportunityInput,
  OpportunitiesErrorCode,
} from "./opportunities";

// ─────────────────────────────────────────────────────────────
// Context Search Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  ContextSearchService,
  getContextSearchService,
  createContextSearchService,
  // Individual functions
  searchContext,
  textSearchContext,
  semanticSearchContext,
} from "./context-search";

export type {
  // Service interface
  IContextSearchService,
  // Search options
  UnifiedSearchOptions,
} from "./context-search";

// ─────────────────────────────────────────────────────────────
// Embedding Integration
// ─────────────────────────────────────────────────────────────

export {
  // Content builders
  buildPersonContent,
  buildPlaceContent,
  buildEventContent,
  buildTaskContent,
  buildDeadlineContent,
  buildEntityContent,
  // Embedding operations
  storeEntityEmbedding,
  removeEntityEmbedding,
  // Entity lifecycle hooks
  afterEntityCreate,
  afterEntityUpdate,
  afterEntityDelete,
  // Convenience functions
  embedPerson,
  removePersonEmbedding,
  embedPlace,
  removePlaceEmbedding,
  embedEvent,
  removeEventEmbedding,
  embedTask,
  removeTaskEmbedding,
  embedDeadline,
  removeDeadlineEmbedding,
} from "./embedding-integration";

export type {
  EmbeddingContext,
  EmbeddingResult,
} from "./embedding-integration";
