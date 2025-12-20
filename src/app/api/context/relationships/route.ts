// ═══════════════════════════════════════════════════════════════════════════
// Relationships API
// POST /api/context/relationships - Create a new relationship
// GET /api/context/relationships - List relationships (filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import {
  parseAndValidateBody,
  validateQuery,
  createRelationshipSchema,
  listRelationshipsQuerySchema,
} from "@/lib/validation";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import {
  createRelationship,
  listRelationships,
  getRelationshipsFor,
  getRelatedEntities,
  RelationshipsServiceError,
  type ListRelationshipsOptions,
  type EntityType,
} from "@/services/context";

// ─────────────────────────────────────────────────────────────
// POST - Create Relationship
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const {
      response: rateLimitResponse,
      userId,
      headers,
    } = await applyRateLimit(request, RATE_LIMITS.create);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate request body
    const validation = await parseAndValidateBody(
      request,
      createRelationshipSchema
    );
    if (!validation.success) {
      return validation.error;
    }

    const relationship = await createRelationship(userId, validation.data, {
      userId,
    });

    return NextResponse.json(relationship, { status: 201, headers });
  } catch (error) {
    console.error("Error creating relationship:", error);

    if (error instanceof RelationshipsServiceError) {
      const status = error.code === "RELATIONSHIP_ALREADY_EXISTS" ? 409 : 400;
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status }
      );
    }

    return NextResponse.json(
      { error: "Failed to create relationship" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// GET - List Relationships
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const {
      response: rateLimitResponse,
      userId,
      headers,
    } = await applyRateLimit(request, RATE_LIMITS.api);

    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(
      searchParams,
      listRelationshipsQuerySchema
    );
    if (!validation.success) {
      return validation.error;
    }

    const { limit, cursor, entityType, entityId, relationship } =
      validation.data;

    const includeDeleted = searchParams.get("includeDeleted") === "true";

    // Additional query params not in base schema
    const sourceType = searchParams.get("sourceType") as EntityType | undefined;
    const sourceId = searchParams.get("sourceId") || undefined;
    const targetType = searchParams.get("targetType") as EntityType | undefined;
    const targetId = searchParams.get("targetId") || undefined;

    // Special query: get all relationships for a specific entity
    const forEntityType =
      entityType ||
      (searchParams.get("forEntityType") as EntityType | undefined);
    const forEntityId =
      entityId || searchParams.get("forEntityId") || undefined;

    if (forEntityType && forEntityId) {
      const relationships = await getRelationshipsFor(
        userId,
        forEntityType,
        forEntityId,
        {
          relationshipTypes: relationship ? [relationship] : undefined,
          targetTypes: targetType ? [targetType] : undefined,
          includeDeleted,
          limit,
        }
      );
      return NextResponse.json(
        {
          items: relationships,
          hasMore: relationships.length === limit,
        },
        { headers }
      );
    }

    // Special query: get related entities with resolved entity data
    const resolveEntities = searchParams.get("resolveEntities") === "true";
    if (resolveEntities && sourceType && sourceId && targetType) {
      const relatedEntities = await getRelatedEntities(
        userId,
        sourceType,
        sourceId,
        targetType,
        {
          relationshipTypes: relationship ? [relationship] : undefined,
          limit,
        }
      );
      return NextResponse.json(
        {
          items: relatedEntities,
          hasMore: relatedEntities.length === limit,
        },
        { headers }
      );
    }

    // Standard list with filters
    const options: ListRelationshipsOptions = {
      limit,
      cursor,
      sourceType,
      sourceId,
      targetType,
      targetId,
      relationship,
      includeDeleted,
    };

    const result = await listRelationships(userId, options);

    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error("Error listing relationships:", error);
    return NextResponse.json(
      { error: "Failed to list relationships" },
      { status: 500 }
    );
  }
}
