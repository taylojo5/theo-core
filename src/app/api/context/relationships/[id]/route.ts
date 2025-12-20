// ═══════════════════════════════════════════════════════════════════════════
// Single Relationship API
// GET /api/context/relationships/[id] - Get relationship by ID
// PATCH /api/context/relationships/[id] - Update relationship
// DELETE /api/context/relationships/[id] - Delete relationship
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  validateParams,
  validateObject,
  updateRelationshipSchema,
  idParamSchema,
} from "@/lib/validation";
import {
  getRelationshipById,
  updateRelationship,
  deleteRelationship,
  restoreRelationship,
  RelationshipsServiceError,
} from "@/services/context";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────────────────────
// GET - Get Relationship by ID
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params;

    // Validate params
    const paramValidation = validateParams(resolvedParams, idParamSchema);
    if (!paramValidation.success) {
      return paramValidation.error;
    }

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const relationship = await getRelationshipById(
      session.user.id,
      paramValidation.data.id
    );

    if (!relationship) {
      return NextResponse.json(
        { error: "Relationship not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(relationship);
  } catch (error) {
    console.error("Error fetching relationship:", error);
    return NextResponse.json(
      { error: "Failed to fetch relationship" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH - Update Relationship
// ─────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params;

    // Validate params
    const paramValidation = validateParams(resolvedParams, idParamSchema);
    if (!paramValidation.success) {
      return paramValidation.error;
    }

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Check if this is a restore operation
    if (body.restore === true) {
      const relationship = await restoreRelationship(
        session.user.id,
        paramValidation.data.id,
        { userId: session.user.id }
      );
      return NextResponse.json(relationship);
    }

    // Validate update body
    const validation = validateObject(body, updateRelationshipSchema);
    if (!validation.success) {
      return validation.error;
    }

    // Ensure at least one field is being updated
    const hasUpdate = Object.keys(validation.data).length > 0;
    if (!hasUpdate) {
      return NextResponse.json(
        { error: "At least one field must be provided for update" },
        { status: 400 }
      );
    }

    const relationship = await updateRelationship(
      session.user.id,
      paramValidation.data.id,
      validation.data,
      { userId: session.user.id }
    );

    return NextResponse.json(relationship);
  } catch (error) {
    console.error("Error updating relationship:", error);

    if (error instanceof RelationshipsServiceError) {
      if (error.code === "RELATIONSHIP_NOT_FOUND") {
        return NextResponse.json(
          { error: "Relationship not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update relationship" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE - Delete Relationship
// ─────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const resolvedParams = await params;

    // Validate params
    const paramValidation = validateParams(resolvedParams, idParamSchema);
    if (!paramValidation.success) {
      return paramValidation.error;
    }

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await deleteRelationship(session.user.id, paramValidation.data.id, {
      userId: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting relationship:", error);

    if (error instanceof RelationshipsServiceError) {
      if (error.code === "RELATIONSHIP_NOT_FOUND") {
        return NextResponse.json(
          { error: "Relationship not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to delete relationship" },
      { status: 500 }
    );
  }
}
