// ═══════════════════════════════════════════════════════════════════════════
// Relationships API
// POST /api/context/relationships - Create a new relationship
// GET /api/context/relationships - List relationships (filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createRelationship,
  listRelationships,
  getRelationshipsFor,
  getRelatedEntities,
  RelationshipsServiceError,
  type CreateRelationshipInput,
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.sourceType || typeof body.sourceType !== "string") {
      return NextResponse.json(
        { error: "sourceType is required" },
        { status: 400 }
      );
    }

    if (!body.sourceId || typeof body.sourceId !== "string") {
      return NextResponse.json(
        { error: "sourceId is required" },
        { status: 400 }
      );
    }

    if (!body.targetType || typeof body.targetType !== "string") {
      return NextResponse.json(
        { error: "targetType is required" },
        { status: 400 }
      );
    }

    if (!body.targetId || typeof body.targetId !== "string") {
      return NextResponse.json(
        { error: "targetId is required" },
        { status: 400 }
      );
    }

    if (!body.relationship || typeof body.relationship !== "string") {
      return NextResponse.json(
        { error: "relationship is required" },
        { status: 400 }
      );
    }

    // Build input
    const input: CreateRelationshipInput = {
      sourceType: body.sourceType,
      sourceId: body.sourceId,
      targetType: body.targetType,
      targetId: body.targetId,
      relationship: body.relationship,
      strength: body.strength,
      bidirectional: body.bidirectional,
      notes: body.notes,
      metadata: body.metadata,
    };

    const relationship = await createRelationship(
      session.user.id,
      input,
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);

    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const cursor = searchParams.get("cursor") || undefined;
    const sourceType = searchParams.get("sourceType") as EntityType | undefined;
    const sourceId = searchParams.get("sourceId") || undefined;
    const targetType = searchParams.get("targetType") as EntityType | undefined;
    const targetId = searchParams.get("targetId") || undefined;
    const relationship = searchParams.get("relationship") || undefined;
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    // Special query: get all relationships for a specific entity
    const forEntityType = searchParams.get("forEntityType") as EntityType | undefined;
    const forEntityId = searchParams.get("forEntityId") || undefined;
    
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

