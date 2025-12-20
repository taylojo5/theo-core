// ═══════════════════════════════════════════════════════════════════════════
// Relationships API
// POST /api/context/relationships - Create a new relationship
// GET /api/context/relationships - List relationships (filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  parseAndValidateBody,
  validateQuery,
  createRelationshipSchema,
  listRelationshipsQuerySchema,
} from "@/lib/validation";
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
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
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

    const relationship = await createRelationship(
      session.user.id,
      validation.data,
      { userId: session.user.id }
    );

    return NextResponse.json(relationship, { status: 201 });
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
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
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
        session.user.id,
        forEntityType,
        forEntityId,
        {
          relationshipTypes: relationship ? [relationship] : undefined,
          targetTypes: targetType ? [targetType] : undefined,
          includeDeleted,
          limit,
        }
      );
      return NextResponse.json({
        items: relationships,
        hasMore: relationships.length === limit,
      });
    }

    // Special query: get related entities with resolved entity data
    const resolveEntities = searchParams.get("resolveEntities") === "true";
    if (resolveEntities && sourceType && sourceId && targetType) {
      const relatedEntities = await getRelatedEntities(
        session.user.id,
        sourceType,
        sourceId,
        targetType,
        {
          relationshipTypes: relationship ? [relationship] : undefined,
          limit,
        }
      );
      return NextResponse.json({
        items: relatedEntities,
        hasMore: relatedEntities.length === limit,
      });
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

    const result = await listRelationships(session.user.id, options);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing relationships:", error);
    return NextResponse.json(
      { error: "Failed to list relationships" },
      { status: 500 }
    );
  }
}
