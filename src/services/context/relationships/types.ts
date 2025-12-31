// ═══════════════════════════════════════════════════════════════════════════
// Relationships Service Types
// Relationship-specific types, DTOs, and interfaces
// ═══════════════════════════════════════════════════════════════════════════

import type {
  EntityRelationship,
  Person,
  Place,
  Event,
  Task,
  Deadline,
} from "@prisma/client";
import type {
  CreateRelationshipInput,
  UpdateRelationshipInput,
  ListRelationshipsOptions,
  PaginatedResult,
  EntityType,
  ServiceContext,
  RelatedEntity,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Query Options
// ─────────────────────────────────────────────────────────────

/** Options for querying relationships for a specific entity */
export interface RelationshipQueryOptions {
  /** Filter by relationship type(s) */
  relationshipTypes?: string[];
  /** Filter by target entity type(s) */
  targetTypes?: EntityType[];
  /** Filter by direction */
  direction?: "outgoing" | "incoming" | "both";
  /** Minimum strength threshold */
  minStrength?: number;
  /** Include soft-deleted relationships */
  includeDeleted?: boolean;
  /** Maximum results */
  limit?: number;
}

/** Options for getting related entities */
export interface GetRelatedEntitiesOptions {
  /** Filter by relationship type(s) */
  relationshipTypes?: string[];
  /** Minimum strength threshold */
  minStrength?: number;
  /** Include soft-deleted relationships */
  includeDeleted?: boolean;
  /** Maximum results */
  limit?: number;
}

// ─────────────────────────────────────────────────────────────
// Entity Union Type
// ─────────────────────────────────────────────────────────────

/** Union type for all context entities */
export type ContextEntity = Person | Place | Event | Task | Deadline;

// ─────────────────────────────────────────────────────────────
// Relationship With Entities
// ─────────────────────────────────────────────────────────────

/** Relationship with resolved source and target entities */
export interface RelationshipWithEntities {
  relationship: EntityRelationship;
  source?: ContextEntity;
  target?: ContextEntity;
}

// ─────────────────────────────────────────────────────────────
// Sync Input
// ─────────────────────────────────────────────────────────────

/** Input for syncing relationships for an entity */
export interface SyncRelationshipsInput {
  sourceType: EntityType;
  sourceId: string;
  /** New set of relationships - will replace existing */
  relationships: Omit<CreateRelationshipInput, "sourceType" | "sourceId">[];
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

export interface IRelationshipsService {
  // CRUD
  create(
    userId: string,
    data: CreateRelationshipInput,
    context?: ServiceContext
  ): Promise<EntityRelationship>;

  getById(userId: string, id: string): Promise<EntityRelationship | null>;

  update(
    userId: string,
    id: string,
    data: UpdateRelationshipInput,
    context?: ServiceContext
  ): Promise<EntityRelationship>;

  delete(userId: string, id: string, context?: ServiceContext): Promise<void>;

  restore(
    userId: string,
    id: string,
    context?: ServiceContext
  ): Promise<EntityRelationship>;

  // Query
  list(
    userId: string,
    options?: ListRelationshipsOptions
  ): Promise<PaginatedResult<EntityRelationship>>;

  /** Get all relationships for a specific entity */
  getRelationshipsFor(
    userId: string,
    entityType: EntityType,
    entityId: string,
    options?: RelationshipQueryOptions
  ): Promise<EntityRelationship[]>;

  /** Get related entities of a specific type */
  getRelatedEntities<T extends ContextEntity>(
    userId: string,
    entityType: EntityType,
    entityId: string,
    targetType: EntityType,
    options?: GetRelatedEntitiesOptions
  ): Promise<RelatedEntity<T>[]>;

  /** Find relationship between two specific entities */
  findBetween(
    userId: string,
    sourceType: EntityType,
    sourceId: string,
    targetType: EntityType,
    targetId: string,
    relationshipType?: string
  ): Promise<EntityRelationship | null>;

  /** Check if a relationship exists between two entities */
  exists(
    userId: string,
    sourceType: EntityType,
    sourceId: string,
    targetType: EntityType,
    targetId: string,
    relationshipType?: string
  ): Promise<boolean>;

  // Bulk operations
  /** Sync relationships for an entity (replace existing with new set) */
  syncRelationships(
    userId: string,
    input: SyncRelationshipsInput,
    context?: ServiceContext
  ): Promise<{ created: number; deleted: number }>;

  /** Create multiple relationships at once */
  createMany(
    userId: string,
    relationships: CreateRelationshipInput[],
    context?: ServiceContext
  ): Promise<EntityRelationship[]>;

  /** Delete all relationships for an entity */
  deleteForEntity(
    userId: string,
    entityType: EntityType,
    entityId: string,
    context?: ServiceContext
  ): Promise<number>;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/** Error codes specific to relationships service */
export type RelationshipsErrorCode =
  | "RELATIONSHIP_NOT_FOUND"
  | "RELATIONSHIP_ALREADY_EXISTS"
  | "INVALID_ENTITY_TYPE"
  | "INVALID_RELATIONSHIP_TYPE"
  | "SELF_RELATIONSHIP"
  | "ENTITY_NOT_FOUND";

/** Custom error for relationships service operations */
export class RelationshipsServiceError extends Error {
  constructor(
    public readonly code: RelationshipsErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "RelationshipsServiceError";
  }
}

// Re-export types from base for convenience
export type {
  EntityRelationship,
  CreateRelationshipInput,
  UpdateRelationshipInput,
  ListRelationshipsOptions,
  PaginatedResult,
  EntityType,
  ServiceContext,
  RelatedEntity,
  Person,
  Place,
  Event,
  Task,
  Deadline,
};
