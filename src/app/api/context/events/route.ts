// ═══════════════════════════════════════════════════════════════════════════
// Events API
// POST /api/context/events - Create a new event
// GET /api/context/events - List user's events (paginated, filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createEvent,
  listEvents,
  searchEvents,
  getUpcomingEvents,
  EventsServiceError,
  type CreateEventInput,
  type ListEventsOptions,
  type Source,
  type EventType,
  type EventStatus,
  type SortOrder,
} from "@/services/context";

// ─────────────────────────────────────────────────────────────
// POST - Create Event
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
    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json(
        { error: "Title is required and must be a string" },
        { status: 400 }
      );
    }

    if (!body.startsAt) {
      return NextResponse.json(
        { error: "startsAt is required" },
        { status: 400 }
      );
    }

    // Build input
    const input: CreateEventInput = {
      title: body.title,
      description: body.description,
      type: body.type,
      startsAt: new Date(body.startsAt),
      endsAt: body.endsAt ? new Date(body.endsAt) : undefined,
      allDay: body.allDay,
      timezone: body.timezone,
      location: body.location,
      placeId: body.placeId,
      virtualUrl: body.virtualUrl,
      status: body.status,
      visibility: body.visibility,
      notes: body.notes,
      importance: body.importance,
      source: body.source ?? "manual",
      sourceId: body.sourceId,
      metadata: body.metadata,
      tags: body.tags,
    };

    const event = await createEvent(
      session.user.id,
      input,
      { userId: session.user.id }
    );

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
    const sortBy = searchParams.get("sortBy") || "startsAt";
    const sortOrder = (searchParams.get("sortOrder") || "asc") as SortOrder;
    const type = searchParams.get("type") as EventType | undefined;
    const status = searchParams.get("status") as EventStatus | undefined;
    const placeId = searchParams.get("placeId") || undefined;
    const source = searchParams.get("source") as Source | undefined;
    const tags = searchParams.get("tags")?.split(",").filter(Boolean) || undefined;
    const includeDeleted = searchParams.get("includeDeleted") === "true";

    // Date filters
    const startsAfter = searchParams.get("startsAfter")
      ? new Date(searchParams.get("startsAfter")!)
      : undefined;
    const startsBefore = searchParams.get("startsBefore")
      ? new Date(searchParams.get("startsBefore")!)
      : undefined;
    const endsAfter = searchParams.get("endsAfter")
      ? new Date(searchParams.get("endsAfter")!)
      : undefined;
    const endsBefore = searchParams.get("endsBefore")
      ? new Date(searchParams.get("endsBefore")!)
      : undefined;

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
    if (q) {
      const results = await searchEvents(session.user.id, q, { limit });
      return NextResponse.json({
        items: results,
        hasMore: false,
      });
    }

    // Otherwise use list with filters
    const options: ListEventsOptions = {
      limit,
      cursor,
      sortBy,
      sortOrder,
      type,
      status,
      startsAfter,
      startsBefore,
      endsAfter,
      endsBefore,
      placeId,
      source,
      tags,
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

