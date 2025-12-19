// ═══════════════════════════════════════════════════════════════════════════
// Single Event API
// GET /api/context/events/[id] - Get event by ID
// PATCH /api/context/events/[id] - Update event
// DELETE /api/context/events/[id] - Soft delete event
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getEventById,
  getEventByIdWithPlace,
  updateEvent,
  updateEventStatus,
  deleteEvent,
  restoreEvent,
  EventsServiceError,
  type EventStatus,
} from "@/services/context";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────────────────────
// GET - Get Event by ID
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

    // Check for options
    const { searchParams } = new URL(request.url);
    const includePlace = searchParams.get("includePlace") === "true";

    // Get event with optional place relation
    if (includePlace) {
      const event = await getEventByIdWithPlace(session.user.id, id);
      if (!event) {
        return NextResponse.json(
          { error: "Event not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(event);
    }

    const event = await getEventById(session.user.id, id);

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error fetching event:", error);
    return NextResponse.json(
      { error: "Failed to fetch event" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH - Update Event
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
      const event = await restoreEvent(session.user.id, id, {
        userId: session.user.id,
      });
      return NextResponse.json(event);
    }

    // Check if this is a status-only update
    if (body.status && Object.keys(body).length === 1) {
      const event = await updateEventStatus(
        session.user.id,
        id,
        body.status as EventStatus,
        { userId: session.user.id }
      );
      return NextResponse.json(event);
    }

    // Validate at least one field is being updated
    const updateFields = [
      "title", "description", "type", "startsAt", "endsAt", "allDay",
      "timezone", "location", "placeId", "virtualUrl", "status", "visibility",
      "notes", "importance", "metadata", "tags"
    ];
    const hasUpdate = updateFields.some((field) => body[field] !== undefined);

    if (!hasUpdate) {
      return NextResponse.json(
        { error: "At least one field must be provided for update" },
        { status: 400 }
      );
    }

    const event = await updateEvent(
      session.user.id,
      id,
      {
        title: body.title,
        description: body.description,
        type: body.type,
        startsAt: body.startsAt ? new Date(body.startsAt) : undefined,
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
        metadata: body.metadata,
        tags: body.tags,
      },
      { userId: session.user.id }
    );

    return NextResponse.json(event);
  } catch (error) {
    console.error("Error updating event:", error);

    if (error instanceof EventsServiceError) {
      if (error.code === "EVENT_NOT_FOUND") {
        return NextResponse.json(
          { error: "Event not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update event" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE - Soft Delete Event
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

    await deleteEvent(session.user.id, id, { userId: session.user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting event:", error);

    if (error instanceof EventsServiceError) {
      if (error.code === "EVENT_NOT_FOUND") {
        return NextResponse.json(
          { error: "Event not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to delete event" },
      { status: 500 }
    );
  }
}

