// ═══════════════════════════════════════════════════════════════════════════
// Single Place API
// GET /api/context/places/[id] - Get place by ID
// PATCH /api/context/places/[id] - Update place
// DELETE /api/context/places/[id] - Soft delete place
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getPlaceById,
  updatePlace,
  deletePlace,
  restorePlace,
  PlacesServiceError,
} from "@/services/context";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────────────────────
// GET - Get Place by ID
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const place = await getPlaceById(session.user.id, id);

    if (!place) {
      return NextResponse.json(
        { error: "Place not found" },
        { status: 404 }
      );
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
    const { id } = await params;

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

    // Check if this is a restore operation
    if (body.restore === true) {
      const place = await restorePlace(session.user.id, id, {
        userId: session.user.id,
      });
      return NextResponse.json(place);
    }

    // Validate at least one field is being updated
    const updateFields = [
      "name", "type", "address", "city", "state", "country", "postalCode",
      "latitude", "longitude", "timezone", "notes", "importance", "metadata", "tags"
    ];
    const hasUpdate = updateFields.some((field) => body[field] !== undefined);

    if (!hasUpdate) {
      return NextResponse.json(
        { error: "At least one field must be provided for update" },
        { status: 400 }
      );
    }

    const place = await updatePlace(
      session.user.id,
      id,
      {
        name: body.name,
        type: body.type,
        address: body.address,
        city: body.city,
        state: body.state,
        country: body.country,
        postalCode: body.postalCode,
        latitude: body.latitude,
        longitude: body.longitude,
        timezone: body.timezone,
        notes: body.notes,
        importance: body.importance,
        metadata: body.metadata,
        tags: body.tags,
      },
      { userId: session.user.id }
    );

    return NextResponse.json(place);
  } catch (error) {
    console.error("Error updating place:", error);

    if (error instanceof PlacesServiceError) {
      if (error.code === "PLACE_NOT_FOUND") {
        return NextResponse.json(
          { error: "Place not found" },
          { status: 404 }
        );
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
    const { id } = await params;

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await deletePlace(session.user.id, id, { userId: session.user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting place:", error);

    if (error instanceof PlacesServiceError) {
      if (error.code === "PLACE_NOT_FOUND") {
        return NextResponse.json(
          { error: "Place not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to delete place" },
      { status: 500 }
    );
  }
}

