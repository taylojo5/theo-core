// ═══════════════════════════════════════════════════════════════════════════
// Places API
// POST /api/context/places - Create a new place
// GET /api/context/places - List user's places (paginated, filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createPlace,
  listPlaces,
  searchPlaces,
  PlacesServiceError,
  type CreatePlaceInput,
  type ListPlacesOptions,
  type Source,
  type PlaceType,
  type SortOrder,
} from "@/services/context";

// ─────────────────────────────────────────────────────────────
// POST - Create Place
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
    if (!body.name || typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Name is required and must be a string" },
        { status: 400 }
      );
    }

    // Build input
    const input: CreatePlaceInput = {
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
      source: body.source ?? "manual",
      sourceId: body.sourceId,
      metadata: body.metadata,
      tags: body.tags,
    };

    const place = await createPlace(
      session.user.id,
      input,
      { userId: session.user.id }
    );

    return NextResponse.json(place, { status: 201 });
  } catch (error) {
    console.error("Error creating place:", error);

    if (error instanceof PlacesServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create place" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// GET - List/Search Places
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

    const q = searchParams.get("q");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 100);
    const cursor = searchParams.get("cursor") || undefined;
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as SortOrder;
    const type = searchParams.get("type") as PlaceType | undefined;
    const city = searchParams.get("city") || undefined;
    const country = searchParams.get("country") || undefined;
    const source = searchParams.get("source") as Source | undefined;
    const tags = searchParams.get("tags")?.split(",").filter(Boolean) || undefined;
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    // If search query provided, use search function
    if (q) {
      const results = await searchPlaces(session.user.id, q, { limit });
      return NextResponse.json({
        items: results,
        hasMore: false,
      });
    }

    // Otherwise use list with filters
    const options: ListPlacesOptions = {
      limit,
      cursor,
      sortBy,
      sortOrder,
      type,
      city,
      country,
      source,
      tags,
      includeDeleted,
    };

    const result = await listPlaces(session.user.id, options);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing places:", error);
    return NextResponse.json(
      { error: "Failed to list places" },
      { status: 500 }
    );
  }
}

