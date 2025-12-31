// ═══════════════════════════════════════════════════════════════════════════
// Relationships Service
// Barrel exports for relationship management
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Service
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
} from "./relationships-service";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

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
} from "./types";

// Error class
export { RelationshipsServiceError } from "./types";

// Re-export base types for convenience
export type {
  EntityRelationship,
  CreateRelationshipInput,
  UpdateRelationshipInput,
  ListRelationshipsOptions,
  RelatedEntity,
} from "./types";
