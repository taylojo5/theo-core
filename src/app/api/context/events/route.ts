// ═══════════════════════════════════════════════════════════════════════════
// Events API
// POST /api/context/events - Create a new event
// GET /api/context/events - List user's events (paginated, filterable)
// Uses Luxon for reliable ISO date parsing
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import {
  parseAndValidateBody,
  validateQuery,
  createEventSchema,
  listEventsQuerySchema,
} from "@/lib/validation";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import {
  createEvent,
  listEvents,
  searchEvents,
  getUpcomingEvents,
  EventsServiceError,
  type CreateEventInput,
  type ListEventsOptions,
  type EventType,
  type EventStatus,
} from "@/services/context";

// ─────────────────────────────────────────────────────────────
// POST - Create Event
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
    const validation = await parseAndValidateBody(request, createEventSchema);
    if (!validation.success) {
      return validation.error;
    }

    // Convert date strings to Date objects using Luxon and cast types
    const input = {
      ...validation.data,
      type: validation.data.type as EventType,
      startsAt: DateTime.fromISO(validation.data.startsAt).toJSDate(),
      endsAt: validation.data.endsAt
        ? DateTime.fromISO(validation.data.endsAt).toJSDate()
        : undefined,
      virtualUrl: validation.data.virtualUrl || undefined,
    } as CreateEventInput;

    const event = await createEvent(userId, input, {
      userId,
    });

    return NextResponse.json(event, { status: 201, headers });
  } catch (error) {
    console.error("Error creating event:", error);

    if (error instanceof EventsServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create event" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// GET - List/Search Events
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
    const validation = validateQuery(searchParams, listEventsQuerySchema);
    if (!validation.success) {
      return validation.error;
    }

    const {
      limit,
      cursor,
      type,
      status,
      startsAfter,
      startsBefore,
      search,
      includeDeleted,
    } = validation.data;

    // Special filter: upcoming events
    const upcoming = searchParams.get("upcoming") === "true";
    if (upcoming) {
      const results = await getUpcomingEvents(userId, limit);
      return NextResponse.json(
        {
          items: results,
          hasMore: results.length === limit,
        },
        { headers }
      );
    }

    // If search query provided, use search function
    if (search) {
      const results = await searchEvents(userId, search, { limit });
      return NextResponse.json(
        {
          items: results,
          hasMore: false,
        },
        { headers }
      );
    }

    // Otherwise use list with filters (using Luxon for date parsing)
    const options: ListEventsOptions = {
      limit,
      cursor,
      type: type as EventType,
      status: status as EventStatus,
      startsAfter: startsAfter ? DateTime.fromISO(startsAfter).toJSDate() : undefined,
      startsBefore: startsBefore ? DateTime.fromISO(startsBefore).toJSDate() : undefined,
      includeDeleted,
    };

    const result = await listEvents(userId, options);

    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error("Error listing events:", error);
    return NextResponse.json(
      { error: "Failed to list events" },
      { status: 500 }
    );
  }
}
