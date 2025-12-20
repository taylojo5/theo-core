// ═══════════════════════════════════════════════════════════════════════════
// Places API
// POST /api/context/places - Create a new place
// GET /api/context/places - List user's places (paginated, filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import {
  parseAndValidateBody,
  validateQuery,
  createPlaceSchema,
  listPlacesQuerySchema,
} from "@/lib/validation";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
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
    const validation = await parseAndValidateBody(request, createPlaceSchema);
    if (!validation.success) {
      return validation.error;
    }

    const place = await createPlace(
      userId,
      validation.data as CreatePlaceInput,
      {
        userId,
      }
    );

    return NextResponse.json(place, { status: 201, headers });
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
    const validation = validateQuery(searchParams, listPlacesQuerySchema);
    if (!validation.success) {
      return validation.error;
    }

    const { limit, cursor, type, city, country, search, includeDeleted } =
      validation.data;

    // If search query provided, use search function
    if (search) {
      const results = await searchPlaces(userId, search, { limit });
      return NextResponse.json(
        {
          items: results,
          hasMore: false,
        },
        { headers }
      );
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

    const result = await listPlaces(userId, options);

    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error("Error listing places:", error);
    return NextResponse.json(
      { error: "Failed to list places" },
      { status: 500 }
    );
  }
}
