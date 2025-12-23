// ═══════════════════════════════════════════════════════════════════════════
// Relationships Service
// CRUD operations for EntityRelationship with audit logging
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { logAuditEntry } from "@/services/audit";
import { Prisma } from "@prisma/client";
import {
  softDeleteFilter,
  normalizePagination,
  processPaginatedResults,
  validateImportance,
} from "../utils";
import type {
  EntityRelationship,
  CreateRelationshipInput,
  UpdateRelationshipInput,
  ListRelationshipsOptions,
  PaginatedResult,
  EntityType,
  ServiceContext,
  RelatedEntity,
  IRelationshipsService,
  RelationshipQueryOptions,
  GetRelatedEntitiesOptions,
  SyncRelationshipsInput,
  ContextEntity,
} from "./types";
import { RelationshipsServiceError as RelationshipsError } from "./types";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Valid entity types */
const VALID_ENTITY_TYPES: EntityType[] = [
  "person",
  "place",
  "event",
  "task",
  "deadline",
];

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Validate entity type
 */
function validateEntityType(type: string): EntityType {
  if (!VALID_ENTITY_TYPES.includes(type as EntityType)) {
    throw new RelationshipsError(
      "INVALID_ENTITY_TYPE",
      `Invalid entity type: ${type}. Valid types: ${VALID_ENTITY_TYPES.join(", ")}`,
      { type }
    );
  }
  return type as EntityType;
}

/**
 * Fetch an entity by type and ID
 */
async function fetchEntity(
  userId: string,
  entityType: EntityType,
  entityId: string
): Promise<ContextEntity | null> {
  const where = {
    id: entityId,
    userId,
    ...softDeleteFilter(),
  };

  switch (entityType) {
    case "person":
      return db.person.findFirst({ where });
    case "place":
      return db.place.findFirst({ where });
    case "event":
      return db.event.findFirst({ where });
    case "task":
      return db.task.findFirst({ where });
    case "deadline":
      return db.deadline.findFirst({ where });
    default:
      return null;
  }
}

/**
 * Verify entity exists
 */
async function verifyEntityExists(
  userId: string,
  entityType: EntityType,
  entityId: string
): Promise<void> {
  const entity = await fetchEntity(userId, entityType, entityId);
  if (!entity) {
    throw new RelationshipsError(
      "ENTITY_NOT_FOUND",
      `${entityType} not found: ${entityId}`,
      { entityType, entityId }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Relationships Service Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Create a new relationship
 */
export async function createRelationship(
  userId: string,
  data: CreateRelationshipInput,
  context?: ServiceContext
): Promise<EntityRelationship> {
  // Validate entity types
  validateEntityType(data.sourceType);
  validateEntityType(data.targetType);

  // Prevent self-referential relationships
  if (
    data.sourceType === data.targetType &&
    data.sourceId === data.targetId
  ) {
    throw new RelationshipsError(
      "SELF_RELATIONSHIP",
      "Cannot create a relationship between an entity and itself"
    );
  }

  // Verify both entities exist
  await verifyEntityExists(userId, data.sourceType as EntityType, data.sourceId);
  await verifyEntityExists(userId, data.targetType as EntityType, data.targetId);

  // Validate strength
  const strength =
    data.strength !== undefined ? validateImportance(data.strength) : 5;

  try {
    const relationship = await db.entityRelationship.create({
      data: {
        userId,
        sourceType: data.sourceType,
        sourceId: data.sourceId,
        targetType: data.targetType,
        targetId: data.targetId,
        relationship: data.relationship,
        strength,
        bidirectional: data.bidirectional ?? false,
        notes: data.notes,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? {},
      },
    });

    // Log audit entry
    await logAuditEntry({
      userId: context?.userId ?? userId,
      sessionId: context?.sessionId,
      conversationId: context?.conversationId,
      actionType: "create",
      actionCategory: "context",
      entityType: "relationship",
      entityId: relationship.id,
      entitySnapshot: relationship as unknown as Prisma.InputJsonValue,
      outputSummary: `Created relationship: ${data.sourceType}(${data.sourceId}) -[${data.relationship}]-> ${data.targetType}(${data.targetId})`,
    });

    return relationship;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      // Unique constraint violation
      if (error.code === "P2002") {
        throw new RelationshipsError(
          "RELATIONSHIP_ALREADY_EXISTS",
          `A ${data.relationship} relationship already exists between these entities`,
          {
            sourceType: data.sourceType,
            sourceId: data.sourceId,
            targetType: data.targetType,
            targetId: data.targetId,
            relationship: data.relationship,
          }
        );
      }
    }
    throw error;
  }
}

/**
 * Get a relationship by ID
 */
export async function getRelationshipById(
  userId: string,
  id: string
): Promise<EntityRelationship | null> {
  return db.entityRelationship.findFirst({
    where: {
      id,
      userId,
      ...softDeleteFilter(),
    },
  });
}

/**
 * Update a relationship
 */
export async function updateRelationship(
  userId: string,
  id: string,
  data: UpdateRelationshipInput,
  context?: ServiceContext
): Promise<EntityRelationship> {
  // Verify relationship exists and user owns it
  const existing = await db.entityRelationship.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new RelationshipsError(
      "RELATIONSHIP_NOT_FOUND",
      `Relationship not found: ${id}`
    );
  }

  // Validate strength if provided
  const strength =
    data.strength !== undefined ? validateImportance(data.strength) : undefined;

  const relationship = await db.entityRelationship.update({
    where: { id },
    data: {
      ...(data.relationship !== undefined && { relationship: data.relationship }),
      ...(strength !== undefined && { strength }),
      ...(data.bidirectional !== undefined && {
        bidirectional: data.bidirectional,
      }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.metadata !== undefined && {
        metadata: data.metadata as Prisma.InputJsonValue,
      }),
    },
  });

  // Log audit entry
  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "update",
    actionCategory: "context",
    entityType: "relationship",
    entityId: relationship.id,
    entitySnapshot: relationship as unknown as Prisma.InputJsonValue,
    outputSummary: `Updated relationship: ${relationship.relationship}`,
  });

  return relationship;
}

/**
 * Soft delete a relationship
 */
export async function deleteRelationship(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<void> {
  // Verify relationship exists and user owns it
  const existing = await db.entityRelationship.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new RelationshipsError(
      "RELATIONSHIP_NOT_FOUND",
      `Relationship not found: ${id}`
    );
  }

  await db.entityRelationship.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  // Log audit entry
  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "delete",
    actionCategory: "context",
    entityType: "relationship",
    entityId: id,
    outputSummary: `Deleted relationship: ${existing.relationship}`,
  });
}

/**
 * Restore a soft-deleted relationship
 */
export async function restoreRelationship(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<EntityRelationship> {
  // Find deleted relationship
  const existing = await db.entityRelationship.findFirst({
    where: {
      id,
      userId,
      deletedAt: { not: null },
    },
  });

  if (!existing) {
    throw new RelationshipsError(
      "RELATIONSHIP_NOT_FOUND",
      `Deleted relationship not found: ${id}`
    );
  }

  const relationship = await db.entityRelationship.update({
    where: { id },
    data: { deletedAt: null },
  });

  // Log audit entry
  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "update",
    actionCategory: "context",
    entityType: "relationship",
    entityId: relationship.id,
    outputSummary: `Restored relationship: ${relationship.relationship}`,
  });

  return relationship;
}

/**
 * List relationships with filtering and pagination
 */
export async function listRelationships(
  userId: string,
  options: ListRelationshipsOptions = {}
): Promise<PaginatedResult<EntityRelationship>> {
  const pagination = normalizePagination(options);

  // Build where clause
  const where: Prisma.EntityRelationshipWhereInput = {
    userId,
    ...softDeleteFilter(options.includeDeleted),
    ...(options.sourceType && { sourceType: options.sourceType }),
    ...(options.sourceId && { sourceId: options.sourceId }),
    ...(options.targetType && { targetType: options.targetType }),
    ...(options.targetId && { targetId: options.targetId }),
    ...(options.relationship && { relationship: options.relationship }),
  };

  const relationships = await db.entityRelationship.findMany({
    where,
    orderBy: { createdAt: "desc" },
    ...pagination,
  });

  return processPaginatedResults(relationships, options.limit ?? 20);
}

/**
 * Get all relationships for a specific entity
 */
export async function getRelationshipsFor(
  userId: string,
  entityType: EntityType,
  entityId: string,
  options: RelationshipQueryOptions = {}
): Promise<EntityRelationship[]> {
  validateEntityType(entityType);

  const direction = options.direction ?? "both";
  const limit = options.limit ?? 100;

  // Build conditions based on direction
  const conditions: Prisma.EntityRelationshipWhereInput[] = [];

  if (direction === "outgoing" || direction === "both") {
    conditions.push({
      sourceType: entityType,
      sourceId: entityId,
    });
  }

  if (direction === "incoming" || direction === "both") {
    conditions.push({
      targetType: entityType,
      targetId: entityId,
    });
  }

  // For bidirectional relationships, also check reverse direction
  if (direction === "both") {
    conditions.push({
      bidirectional: true,
      OR: [
        { sourceType: entityType, sourceId: entityId },
        { targetType: entityType, targetId: entityId },
      ],
    });
  }

  const where: Prisma.EntityRelationshipWhereInput = {
    userId,
    ...softDeleteFilter(options.includeDeleted),
    ...(options.relationshipTypes?.length && {
      relationship: { in: options.relationshipTypes },
    }),
    ...(options.minStrength !== undefined && {
      strength: { gte: options.minStrength },
    }),
  };

  // Combine direction conditions with targetTypes filter using AND
  // to prevent the OR clauses from overwriting each other
  if (options.targetTypes?.length) {
    where.AND = [
      { OR: conditions },
      {
        OR: [
          { targetType: { in: options.targetTypes } },
          { sourceType: { in: options.targetTypes } },
        ],
      },
    ];
  } else {
    where.OR = conditions;
  }

  return db.entityRelationship.findMany({
    where,
    orderBy: [{ strength: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
}

/**
 * Get related entities of a specific type
 */
export async function getRelatedEntities<T extends ContextEntity>(
  userId: string,
  entityType: EntityType,
  entityId: string,
  targetType: EntityType,
  options: GetRelatedEntitiesOptions = {}
): Promise<RelatedEntity<T>[]> {
  validateEntityType(entityType);
  validateEntityType(targetType);

  const limit = options.limit ?? 50;

  // Build where clause for relationships
  const where: Prisma.EntityRelationshipWhereInput = {
    userId,
    ...softDeleteFilter(options.includeDeleted),
    OR: [
      // Outgoing relationships to target type
      {
        sourceType: entityType,
        sourceId: entityId,
        targetType: targetType,
      },
      // Incoming relationships from target type (bidirectional only)
      {
        targetType: entityType,
        targetId: entityId,
        sourceType: targetType,
        bidirectional: true,
      },
    ],
    ...(options.relationshipTypes?.length && {
      relationship: { in: options.relationshipTypes },
    }),
    ...(options.minStrength !== undefined && {
      strength: { gte: options.minStrength },
    }),
  };

  const relationships = await db.entityRelationship.findMany({
    where,
    orderBy: [{ strength: "desc" }, { createdAt: "desc" }],
    take: limit,
  });

  // Fetch and resolve related entities
  const results: RelatedEntity<T>[] = [];

  for (const rel of relationships) {
    // Determine which entity ID to fetch based on direction
    const isOutgoing =
      rel.sourceType === entityType && rel.sourceId === entityId;
    const relatedId = isOutgoing ? rel.targetId : rel.sourceId;
    const direction: "outgoing" | "incoming" = isOutgoing
      ? "outgoing"
      : "incoming";

    const entity = await fetchEntity(userId, targetType, relatedId);

    if (entity) {
      results.push({
        entity: entity as T,
        relationship: rel,
        direction,
      });
    }
  }

  return results;
}

/**
 * Find relationship between two specific entities
 */
export async function findRelationshipBetween(
  userId: string,
  sourceType: EntityType,
  sourceId: string,
  targetType: EntityType,
  targetId: string,
  relationshipType?: string
): Promise<EntityRelationship | null> {
  validateEntityType(sourceType);
  validateEntityType(targetType);

  // Check both directions for bidirectional relationships
  return db.entityRelationship.findFirst({
    where: {
      userId,
      ...softDeleteFilter(),
      OR: [
        {
          sourceType,
          sourceId,
          targetType,
          targetId,
          ...(relationshipType && { relationship: relationshipType }),
        },
        // Check reverse direction for bidirectional
        {
          sourceType: targetType,
          sourceId: targetId,
          targetType: sourceType,
          targetId: sourceId,
          bidirectional: true,
          ...(relationshipType && { relationship: relationshipType }),
        },
      ],
    },
  });
}

/**
 * Check if a relationship exists between two entities
 */
export async function relationshipExists(
  userId: string,
  sourceType: EntityType,
  sourceId: string,
  targetType: EntityType,
  targetId: string,
  relationshipType?: string
): Promise<boolean> {
  const relationship = await findRelationshipBetween(
    userId,
    sourceType,
    sourceId,
    targetType,
    targetId,
    relationshipType
  );
  return relationship !== null;
}

/**
 * Sync relationships for an entity (replace existing with new set)
 */
export async function syncRelationships(
  userId: string,
  input: SyncRelationshipsInput,
  context?: ServiceContext
): Promise<{ created: number; deleted: number }> {
  validateEntityType(input.sourceType);

  // Get existing relationships for this entity
  const existingRelationships = await db.entityRelationship.findMany({
    where: {
      userId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      ...softDeleteFilter(),
    },
  });

  // Build set of new relationship keys
  const newRelKeys = new Set(
    input.relationships.map(
      (r) => `${r.targetType}:${r.targetId}:${r.relationship}`
    )
  );

  // Find relationships to delete (exist but not in new set)
  const toDelete = existingRelationships.filter(
    (r) => !newRelKeys.has(`${r.targetType}:${r.targetId}:${r.relationship}`)
  );

  // Build set of existing relationship keys
  const existingRelKeys = new Set(
    existingRelationships.map(
      (r) => `${r.targetType}:${r.targetId}:${r.relationship}`
    )
  );

  // Find relationships to create (in new set but don't exist)
  const toCreate = input.relationships.filter(
    (r) => !existingRelKeys.has(`${r.targetType}:${r.targetId}:${r.relationship}`)
  );

  // Delete removed relationships
  if (toDelete.length > 0) {
    await db.entityRelationship.updateMany({
      where: {
        id: { in: toDelete.map((r) => r.id) },
      },
      data: { deletedAt: new Date() },
    });
  }

  // Create new relationships
  let createdCount = 0;
  for (const rel of toCreate) {
    try {
      await createRelationship(
        userId,
        {
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          ...rel,
        },
        context
      );
      createdCount++;
    } catch (error) {
      // Skip if entity doesn't exist
      if (
        error instanceof RelationshipsError &&
        error.code === "ENTITY_NOT_FOUND"
      ) {
        continue;
      }
      throw error;
    }
  }

  // Log sync audit entry
  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "update",
    actionCategory: "context",
    entityType: "relationship",
    outputSummary: `Synced relationships for ${input.sourceType}(${input.sourceId}): created ${createdCount}, deleted ${toDelete.length}`,
  });

  return { created: createdCount, deleted: toDelete.length };
}

/**
 * Create multiple relationships at once
 */
export async function createManyRelationships(
  userId: string,
  relationships: CreateRelationshipInput[],
  context?: ServiceContext
): Promise<EntityRelationship[]> {
  const results: EntityRelationship[] = [];

  for (const data of relationships) {
    try {
      const relationship = await createRelationship(userId, data, context);
      results.push(relationship);
    } catch (error) {
      // Skip duplicates and missing entities, but rethrow other errors
      if (error instanceof RelationshipsError) {
        if (
          error.code === "RELATIONSHIP_ALREADY_EXISTS" ||
          error.code === "ENTITY_NOT_FOUND"
        ) {
          continue;
        }
      }
      throw error;
    }
  }

  return results;
}

/**
 * Delete all relationships for an entity
 */
export async function deleteRelationshipsForEntity(
  userId: string,
  entityType: EntityType,
  entityId: string,
  context?: ServiceContext
): Promise<number> {
  validateEntityType(entityType);

  // Find all relationships involving this entity
  const relationships = await db.entityRelationship.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      OR: [
        { sourceType: entityType, sourceId: entityId },
        { targetType: entityType, targetId: entityId },
      ],
    },
  });

  if (relationships.length === 0) {
    return 0;
  }

  // Soft delete all
  await db.entityRelationship.updateMany({
    where: {
      id: { in: relationships.map((r) => r.id) },
    },
    data: { deletedAt: new Date() },
  });

  // Log audit entry
  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "delete",
    actionCategory: "context",
    entityType: "relationship",
    outputSummary: `Deleted ${relationships.length} relationships for ${entityType}(${entityId})`,
  });

  return relationships.length;
}

// ─────────────────────────────────────────────────────────────
// Service Object (for DI / testing)
// ─────────────────────────────────────────────────────────────

/**
 * Relationships service object implementing IRelationshipsService
 * Can be used for dependency injection or testing
 */
export const RelationshipsService: IRelationshipsService = {
  create: createRelationship,
  getById: getRelationshipById,
  update: updateRelationship,
  delete: deleteRelationship,
  restore: restoreRelationship,
  list: listRelationships,
  getRelationshipsFor,
  getRelatedEntities,
  findBetween: findRelationshipBetween,
  exists: relationshipExists,
  syncRelationships,
  createMany: createManyRelationships,
  deleteForEntity: deleteRelationshipsForEntity,
};

