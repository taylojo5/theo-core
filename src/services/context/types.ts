// ═══════════════════════════════════════════════════════════════════════════
// Context Service Types
// Shared types, DTOs, and interfaces for all context entities
// ═══════════════════════════════════════════════════════════════════════════

import type {
  Person,
  Place,
  Event,
  Task,
  Deadline,
  EntityRelationship,
} from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Enums & Constants
// ─────────────────────────────────────────────────────────────

/** Types of context entities in the system */
export type EntityType = "person" | "place" | "event" | "task" | "deadline";

/** Sources from which entities can originate */
export type Source = "manual" | "gmail" | "slack" | "calendar" | "import";

/** Sort order for queries */
export type SortOrder = "asc" | "desc";

// Person types
export type PersonType =
  | "contact"
  | "colleague"
  | "friend"
  | "family"
  | "lead"
  | "client"
  | "vendor";

// Place types
export type PlaceType =
  | "location"
  | "home"
  | "office"
  | "restaurant"
  | "venue"
  | "city"
  | "airport"
  | "hotel";

// Event types
export type EventType =
  | "meeting"
  | "call"
  | "travel"
  | "deadline"
  | "reminder"
  | "social"
  | "conference";

// Event status
export type EventStatus = "tentative" | "confirmed" | "cancelled";

// Task status
export type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "deferred";

// Task priority
export type TaskPriority = "low" | "medium" | "high" | "urgent";

// Deadline types
export type DeadlineType = "deadline" | "milestone" | "reminder";

// Deadline status
export type DeadlineStatus = "pending" | "completed" | "missed" | "extended";

// ─────────────────────────────────────────────────────────────
// Pagination Types
// ─────────────────────────────────────────────────────────────

/** Standard pagination parameters */
export interface PaginationParams {
  /** Number of items to return (default: 20, max: 100) */
  limit?: number;
  /** Cursor for pagination (typically an entity ID) */
  cursor?: string;
}

/** Paginated result wrapper */
export interface PaginatedResult<T> {
  /** Items in this page */
  items: T[];
  /** Cursor for next page, if more items exist */
  nextCursor?: string;
  /** Whether more items exist beyond this page */
  hasMore: boolean;
  /** Total count (optional, expensive for large datasets) */
  totalCount?: number;
}

// ─────────────────────────────────────────────────────────────
// Base Query Options
// ─────────────────────────────────────────────────────────────

/** Base options for entity list queries */
export interface BaseListOptions extends PaginationParams {
  /** Sort field */
  sortBy?: string;
  /** Sort order */
  sortOrder?: SortOrder;
  /** Search query (full-text search on name/title) */
  search?: string;
  /** Filter by source */
  source?: Source;
  /** Filter by tags (any match) */
  tags?: string[];
  /** Include soft-deleted items */
  includeDeleted?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Person DTOs
// ─────────────────────────────────────────────────────────────

export interface CreatePersonInput {
  name: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  type?: PersonType;
  importance?: number;
  company?: string;
  title?: string;
  location?: string;
  timezone?: string;
  bio?: string;
  notes?: string;
  preferences?: Record<string, unknown>;
  source: Source;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface UpdatePersonInput {
  name?: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  type?: PersonType;
  importance?: number;
  company?: string;
  title?: string;
  location?: string;
  timezone?: string;
  bio?: string;
  notes?: string;
  preferences?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface ListPeopleOptions extends BaseListOptions {
  /** Filter by person type */
  type?: PersonType;
  /** Filter by company */
  company?: string;
  /** Filter by minimum importance */
  minImportance?: number;
}

// ─────────────────────────────────────────────────────────────
// Place DTOs
// ─────────────────────────────────────────────────────────────

export interface CreatePlaceInput {
  name: string;
  type?: PlaceType;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  notes?: string;
  importance?: number;
  source: Source;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface UpdatePlaceInput {
  name?: string;
  type?: PlaceType;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  notes?: string;
  importance?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface ListPlacesOptions extends BaseListOptions {
  /** Filter by place type */
  type?: PlaceType;
  /** Filter by city */
  city?: string;
  /** Filter by country */
  country?: string;
}

// ─────────────────────────────────────────────────────────────
// Event DTOs
// ─────────────────────────────────────────────────────────────

export interface CreateEventInput {
  title: string;
  description?: string;
  type?: EventType;
  startsAt: Date;
  endsAt?: Date;
  allDay?: boolean;
  timezone?: string;
  location?: string;
  placeId?: string;
  virtualUrl?: string;
  status?: EventStatus;
  visibility?: "private" | "public";
  notes?: string;
  importance?: number;
  source: Source;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  type?: EventType;
  startsAt?: Date;
  endsAt?: Date;
  allDay?: boolean;
  timezone?: string;
  location?: string;
  placeId?: string;
  virtualUrl?: string;
  status?: EventStatus;
  visibility?: "private" | "public";
  notes?: string;
  importance?: number;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface ListEventsOptions extends BaseListOptions {
  /** Filter by event type */
  type?: EventType;
  /** Filter by status */
  status?: EventStatus;
  /** Filter events starting after this date */
  startsAfter?: Date;
  /** Filter events starting before this date */
  startsBefore?: Date;
  /** Filter events ending after this date */
  endsAfter?: Date;
  /** Filter events ending before this date */
  endsBefore?: Date;
  /** Filter by place */
  placeId?: string;
}

// ─────────────────────────────────────────────────────────────
// Task DTOs
// ─────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  title: string;
  description?: string;
  parentId?: string;
  position?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date;
  startDate?: Date;
  estimatedMinutes?: number;
  notes?: string;
  assignedToId?: string;
  source: Source;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  parentId?: string | null;
  position?: number;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: Date | null;
  startDate?: Date | null;
  completedAt?: Date | null;
  estimatedMinutes?: number | null;
  actualMinutes?: number | null;
  notes?: string | null;
  assignedToId?: string | null;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface ListTasksOptions extends BaseListOptions {
  /** Filter by status */
  status?: TaskStatus;
  /** Filter by priority */
  priority?: TaskPriority;
  /** Filter by parent task (null for top-level tasks) */
  parentId?: string | null;
  /** Filter by assigned person */
  assignedToId?: string;
  /** Filter tasks due before this date */
  dueBefore?: Date;
  /** Filter tasks due after this date */
  dueAfter?: Date;
  /** Include subtasks in results */
  includeSubtasks?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Deadline DTOs
// ─────────────────────────────────────────────────────────────

export interface CreateDeadlineInput {
  title: string;
  description?: string;
  type?: DeadlineType;
  dueAt: Date;
  reminderAt?: Date;
  status?: DeadlineStatus;
  importance?: number;
  taskId?: string;
  eventId?: string;
  notes?: string;
  consequences?: string;
  source: Source;
  sourceId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface UpdateDeadlineInput {
  title?: string;
  description?: string;
  type?: DeadlineType;
  dueAt?: Date;
  reminderAt?: Date;
  status?: DeadlineStatus;
  importance?: number;
  taskId?: string;
  eventId?: string;
  notes?: string;
  consequences?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}

export interface ListDeadlinesOptions extends BaseListOptions {
  /** Filter by deadline type */
  type?: DeadlineType;
  /** Filter by status */
  status?: DeadlineStatus;
  /** Filter deadlines due before this date */
  dueBefore?: Date;
  /** Filter deadlines due after this date */
  dueAfter?: Date;
  /** Filter by associated task */
  taskId?: string;
  /** Filter by associated event */
  eventId?: string;
  /** Filter by minimum importance */
  minImportance?: number;
}

// ─────────────────────────────────────────────────────────────
// Relationship DTOs
// ─────────────────────────────────────────────────────────────

/** Common relationship types */
export type RelationshipType =
  // Person to Person
  | "works_with"
  | "manages"
  | "reports_to"
  | "knows"
  | "introduced_by"
  | "related_to"
  // Person to Place
  | "works_at"
  | "lives_at"
  | "frequents"
  // Person to Event
  | "attends"
  | "organizes"
  | "declined"
  | "invited_to"
  // Person to Task
  | "assigned_to"
  | "created_by"
  | "mentioned_in"
  // Event to Place
  | "located_at"
  // Task to Event
  | "scheduled_for"
  | "discussed_in"
  // Generic
  | "related_to";

export interface CreateRelationshipInput {
  sourceType: EntityType;
  sourceId: string;
  targetType: EntityType;
  targetId: string;
  relationship: RelationshipType | string;
  strength?: number;
  bidirectional?: boolean;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateRelationshipInput {
  relationship?: RelationshipType | string;
  strength?: number;
  bidirectional?: boolean;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface ListRelationshipsOptions extends PaginationParams {
  /** Filter by source entity */
  sourceType?: EntityType;
  sourceId?: string;
  /** Filter by target entity */
  targetType?: EntityType;
  targetId?: string;
  /** Filter by relationship type */
  relationship?: RelationshipType | string;
  /** Include soft-deleted */
  includeDeleted?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Related Entity Results
// ─────────────────────────────────────────────────────────────

/** Result when fetching related entities */
export interface RelatedEntity<T> {
  /** The related entity */
  entity: T;
  /** The relationship record */
  relationship: EntityRelationship;
  /** Direction of the relationship */
  direction: "outgoing" | "incoming";
}

// ─────────────────────────────────────────────────────────────
// Search Types
// ─────────────────────────────────────────────────────────────

/** Options for context search */
export interface ContextSearchOptions {
  /** Entity types to search (all if not specified) */
  entityTypes?: EntityType[];
  /** Maximum results to return */
  limit?: number;
  /** Use semantic search (embeddings) in addition to text search */
  useSemanticSearch?: boolean;
  /** Minimum similarity score for semantic results (0-1) */
  minSimilarity?: number;
}

/** Result from context search */
export interface ContextSearchResult {
  /** Type of entity */
  entityType: EntityType;
  /** Entity ID */
  entityId: string;
  /** The matched entity (polymorphic) */
  entity: Person | Place | Event | Task | Deadline;
  /** Relevance score (0-1) */
  score: number;
  /** How the match was found */
  matchType: "text" | "semantic" | "both";
  /** Matched content snippet */
  snippet?: string;
}

// ─────────────────────────────────────────────────────────────
// Service Context
// ─────────────────────────────────────────────────────────────

/** Context passed to service methods for audit logging */
export interface ServiceContext {
  userId: string;
  sessionId?: string;
  conversationId?: string;
}

// ─────────────────────────────────────────────────────────────
// Utility Types
// ─────────────────────────────────────────────────────────────

/** Entity with common fields */
export interface BaseEntity {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/** Input for source-based upsert operations */
export interface SourceEntityInput<T> {
  sourceId: string;
  data: T;
}

/** Result of a bulk upsert operation */
export interface UpsertResult<T> {
  created: T[];
  updated: T[];
  unchanged: number;
}

// Re-export Prisma types for convenience
export type { Person, Place, Event, Task, Deadline, EntityRelationship };

