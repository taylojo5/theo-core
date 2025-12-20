// ═══════════════════════════════════════════════════════════════════════════
// Events API
// POST /api/context/events - Create a new event
// GET /api/context/events - List user's events (paginated, filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  parseAndValidateBody,
  validateQuery,
  createEventSchema,
  listEventsQuerySchema,
} from "@/lib/validation";
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
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate request body
    const validation = await parseAndValidateBody(request, createEventSchema);
    if (!validation.success) {
      return validation.error;
    }

    // Convert date strings to Date objects and cast types
    const input = {
      ...validation.data,
      type: validation.data.type as EventType,
      startsAt: new Date(validation.data.startsAt),
      endsAt: validation.data.endsAt
        ? new Date(validation.data.endsAt)
        : undefined,
      virtualUrl: validation.data.virtualUrl || undefined,
    } as CreateEventInput;

    const event = await createEvent(session.user.id, input, {
      userId: session.user.id,
    });

    return NextResponse.json(event, { status: 201 });
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
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
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
      const results = await getUpcomingEvents(session.user.id, limit);
      return NextResponse.json({
        items: results,
        hasMore: results.length === limit,
      });
    }

    // If search query provided, use search function
    if (search) {
      const results = await searchEvents(session.user.id, search, { limit });
      return NextResponse.json({
        items: results,
        hasMore: false,
      });
    }

    // Otherwise use list with filters
    const options: ListEventsOptions = {
      limit,
      cursor,
      type: type as EventType,
      status: status as EventStatus,
      startsAfter: startsAfter ? new Date(startsAfter) : undefined,
      startsBefore: startsBefore ? new Date(startsBefore) : undefined,
      includeDeleted,
    };

    const result = await listEvents(session.user.id, options);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing events:", error);
    return NextResponse.json(
      { error: "Failed to list events" },
      { status: 500 }
    );
  }
}
