// ═══════════════════════════════════════════════════════════════════════════
// Places API
// POST /api/context/places - Create a new place
// GET /api/context/places - List user's places (paginated, filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  parseAndValidateBody,
  validateQuery,
  createPlaceSchema,
  listPlacesQuerySchema,
} from "@/lib/validation";
import {
  createPlace,
  listPlaces,
  searchPlaces,
  PlacesServiceError,
  type CreatePlaceInput,
  type ListPlacesOptions,
  type Source,
  type PlaceType,
} from "@/services/context";

// ─────────────────────────────────────────────────────────────
// POST - Create Place
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate request body
    const validation = await parseAndValidateBody(request, createPlaceSchema);
    if (!validation.success) {
      return validation.error;
    }

    const place = await createPlace(
      session.user.id,
      validation.data as CreatePlaceInput,
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(searchParams, listPlacesQuerySchema);
    if (!validation.success) {
      return validation.error;
    }

    const { limit, cursor, type, city, country, search, includeDeleted } =
      validation.data;

    // If search query provided, use search function
    if (search) {
      const results = await searchPlaces(session.user.id, search, { limit });
      return NextResponse.json({
        items: results,
        hasMore: false,
      });
    }

    // Otherwise use list with filters
    const options: ListPlacesOptions = {
      limit,
      cursor,
      type: type as PlaceType,
      city,
      country,
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
