// ═══════════════════════════════════════════════════════════════════════════
// Single Place API
// GET /api/context/places/[id] - Get place by ID
// PATCH /api/context/places/[id] - Update place
// DELETE /api/context/places/[id] - Soft delete place
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  validateParams,
  validateObject,
  updatePlaceSchema,
  idParamSchema,
} from "@/lib/validation";
import {
  getPlaceById,
  updatePlace,
  deletePlace,
  restorePlace,
  PlacesServiceError,
  type UpdatePlaceInput,
} from "@/services/context";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────────────────────
// GET - Get Place by ID
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

    const place = await getPlaceById(session.user.id, paramValidation.data.id);

    if (!place) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    return NextResponse.json(place);
  } catch (error) {
    console.error("Error fetching place:", error);
    return NextResponse.json(
      { error: "Failed to fetch place" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH - Update Place
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

    // Parse and check for restore operation first
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    // Check if this is a restore operation
    if (body.restore === true) {
      const place = await restorePlace(
        session.user.id,
        paramValidation.data.id,
        { userId: session.user.id }
      );
      return NextResponse.json(place);
    }

    // Validate update body
    const validation = validateObject(body, updatePlaceSchema);
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

    const place = await updatePlace(
      session.user.id,
      paramValidation.data.id,
      validation.data as UpdatePlaceInput,
      { userId: session.user.id }
    );

    return NextResponse.json(place);
  } catch (error) {
    console.error("Error updating place:", error);

    if (error instanceof PlacesServiceError) {
      if (error.code === "PLACE_NOT_FOUND") {
        return NextResponse.json({ error: "Place not found" }, { status: 404 });
      }
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update place" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE - Soft Delete Place
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

    await deletePlace(session.user.id, paramValidation.data.id, {
      userId: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting place:", error);

    if (error instanceof PlacesServiceError) {
      if (error.code === "PLACE_NOT_FOUND") {
        return NextResponse.json({ error: "Place not found" }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to delete place" },
      { status: 500 }
    );
  }
}
