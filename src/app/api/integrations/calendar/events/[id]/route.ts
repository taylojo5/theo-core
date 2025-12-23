// ═══════════════════════════════════════════════════════════════════════════
// Calendar Event Detail API
// Get, update, delete individual events
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { calendarEventRepository } from "@/integrations/calendar/repository";
import {
  requestEventUpdate,
  requestEventDeletion,
  requestEventResponse,
} from "@/integrations/calendar/actions";
import { calendarLogger } from "@/integrations/calendar/logger";
import { z } from "zod";
import type { EventUpdateInput, AttendeeResponseStatus } from "@/integrations/calendar/types";

const logger = calendarLogger.child("api.events.id");

// ─────────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────────

const UpdateEventSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  timezone: z.string().optional(),
  location: z.string().optional(),
  attendees: z
    .array(
      z.object({
        email: z.string().email(),
        displayName: z.string().optional(),
        optional: z.boolean().optional(),
      })
    )
    .optional(),
  recurrence: z.array(z.string()).optional(),
  reminders: z
    .object({
      useDefault: z.boolean().optional(),
      overrides: z
        .array(
          z.object({
            method: z.enum(["email", "popup"]),
            minutes: z.number().min(0),
          })
        )
        .optional(),
    })
    .optional(),
  visibility: z.enum(["default", "public", "private"]).optional(),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
  requestedBy: z.string().optional(),
  checkConflicts: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const RespondEventSchema = z.object({
  response: z.enum(["accepted", "declined", "tentative"]),
  comment: z.string().optional(),
  sendUpdates: z.enum(["all", "externalOnly", "none"]).optional(),
  requestedBy: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/calendar/events/[id] - Get event
// ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarEvents
  );
  if (rateLimitResponse) return rateLimitResponse;

  let userId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    userId = session.user.id;
    const { id } = await params;

    const event = await calendarEventRepository.findById(id);

    if (!event) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404, headers }
      );
    }

    // Verify ownership
    if (event.userId !== userId) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json({ event }, { headers });
  } catch (error) {
    logger.error("Failed to get event", { userId }, error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get event",
      },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/integrations/calendar/events/[id] - Update event
// ─────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarActions
  );
  if (rateLimitResponse) return rateLimitResponse;

  let userId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    userId = session.user.id;
    const { id } = await params;

    // Verify event exists and belongs to user
    const event = await calendarEventRepository.findById(id);
    if (!event || event.userId !== userId) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404, headers }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parseResult = UpdateEventSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.issues,
        },
        { status: 400, headers }
      );
    }

    const data = parseResult.data;

    // Build update input for Google Calendar API format
    const updates: EventUpdateInput = {};
    if (data.title !== undefined) updates.summary = data.title;
    if (data.description !== undefined) updates.description = data.description;
    if (data.startsAt !== undefined) {
      updates.start = data.allDay
        ? { date: data.startsAt.split("T")[0] }
        : { dateTime: data.startsAt, timeZone: data.timezone };
    }
    if (data.endsAt !== undefined) {
      updates.end = data.allDay
        ? { date: data.endsAt.split("T")[0] }
        : { dateTime: data.endsAt, timeZone: data.timezone };
    }
    if (data.location !== undefined) updates.location = data.location;
    if (data.attendees !== undefined) {
      updates.attendees = data.attendees.map((a) => ({
        email: a.email,
        displayName: a.displayName,
        optional: a.optional,
      }));
    }
    if (data.recurrence !== undefined) updates.recurrence = data.recurrence;
    if (data.reminders !== undefined) {
      updates.reminders = {
        useDefault: data.reminders.useDefault ?? true,
        overrides: data.reminders.overrides,
      };
    }
    if (data.visibility !== undefined) updates.visibility = data.visibility;

    // Request event update (goes through approval workflow)
    const result = await requestEventUpdate({
      actionType: "update",
      userId,
      calendarId: event.googleCalendarId || "",
      eventId: id,
      googleEventId: event.googleEventId || undefined,
      updates,
      checkConflicts: data.checkConflicts ?? true,
      requestedBy: data.requestedBy,
      sendUpdates: data.sendUpdates,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.message,
          details: result.error,
        },
        { status: 400, headers }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        approvalId: result.approvalId,
        approval: result.approval,
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to update event", { userId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update event",
      },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/integrations/calendar/events/[id] - Delete event
// ─────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarActions
  );
  if (rateLimitResponse) return rateLimitResponse;

  let userId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    userId = session.user.id;
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Verify event exists and belongs to user
    const event = await calendarEventRepository.findById(id);
    if (!event || event.userId !== userId) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404, headers }
      );
    }

    const requestedBy = searchParams.get("requestedBy") || undefined;
    const sendUpdates =
      (searchParams.get("sendUpdates") as "all" | "externalOnly" | "none") ||
      undefined;

    // Request event deletion (goes through approval workflow)
    const result = await requestEventDeletion({
      actionType: "delete",
      userId,
      calendarId: event.googleCalendarId || "",
      eventId: id,
      googleEventId: event.googleEventId || undefined,
      requestedBy,
      sendUpdates,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.message,
          details: result.error,
        },
        { status: 400, headers }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        approvalId: result.approvalId,
        approval: result.approval,
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to delete event", { userId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete event",
      },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/calendar/events/[id] - RSVP to event
// ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarActions
  );
  if (rateLimitResponse) return rateLimitResponse;

  let userId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    userId = session.user.id;
    const { id } = await params;

    // Verify event exists and belongs to user
    const event = await calendarEventRepository.findById(id);
    if (!event || event.userId !== userId) {
      return NextResponse.json(
        { error: "Event not found" },
        { status: 404, headers }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parseResult = RespondEventSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.issues,
        },
        { status: 400, headers }
      );
    }

    const data = parseResult.data;

    // Map response to AttendeeResponseStatus
    const responseStatus: AttendeeResponseStatus = data.response;

    // Request event response (goes through approval workflow)
    const result = await requestEventResponse({
      actionType: "respond",
      userId,
      calendarId: event.googleCalendarId || "",
      eventId: id,
      googleEventId: event.googleEventId || undefined,
      response: responseStatus,
      comment: data.comment,
      requestedBy: data.requestedBy,
      sendUpdates: data.sendUpdates,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.message,
          details: result.error,
        },
        { status: 400, headers }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        approvalId: result.approvalId,
        approval: result.approval,
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to respond to event", { userId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to respond to event",
      },
      { status: 500, headers }
    );
  }
}
