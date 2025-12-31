// ═══════════════════════════════════════════════════════════════════════════
// Calendar Events API
// List events and request event creation
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { calendarEventRepository } from "@/integrations/calendar/repository";
import { requestEventCreation } from "@/integrations/calendar/actions";
import { calendarLogger } from "@/integrations/calendar/logger";
import { z } from "zod";
import type { EventCreateInput } from "@/integrations/calendar/types";

const logger = calendarLogger.child("api.events");

// ─────────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────────

const CreateEventSchema = z.object({
  calendarId: z.string().min(1, "Calendar ID is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startsAt: z.string().datetime({ message: "Invalid start date" }),
  endsAt: z.string().datetime({ message: "Invalid end date" }).optional(),
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

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/calendar/events - List events
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
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
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const query = searchParams.get("query") || undefined;
    const calendarId = searchParams.get("calendarId") || undefined;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const status = searchParams.get("status") || undefined;
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const orderBy = (searchParams.get("orderBy") || "startsAt") as
      | "startsAt"
      | "endsAt"
      | "createdAt"
      | "updatedAt";
    const orderDirection = (searchParams.get("order") || "asc") as
      | "asc"
      | "desc";

    // Use today/thisWeek shortcuts if no date range specified
    const today = searchParams.get("today") === "true";
    const thisWeek = searchParams.get("thisWeek") === "true";

    let events: Awaited<ReturnType<typeof calendarEventRepository.findToday>>;
    let total = 0;
    let hasMore = false;

    if (today) {
      events = await calendarEventRepository.findToday(userId);
      total = events.length;
    } else if (thisWeek) {
      events = await calendarEventRepository.findThisWeek(userId);
      total = events.length;
    } else {
      // Use search with filters
      const result = await calendarEventRepository.search(userId, {
        query,
        calendarId,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        status,
        limit,
        offset,
        orderBy,
        orderDirection,
      });
      events = result.events;
      total = result.total;
      hasMore = result.hasMore;
    }

    return NextResponse.json(
      {
        events,
        total,
        hasMore,
        offset,
        limit,
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to list events", { userId }, error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list events",
      },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/calendar/events - Request event creation
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
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

    // Parse and validate body
    const body = await request.json();
    const parseResult = CreateEventSchema.safeParse(body);

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

    // Build event input for Google Calendar API format
    const eventInput: EventCreateInput = {
      summary: data.title,
      description: data.description,
      start: data.allDay
        ? { date: data.startsAt.split("T")[0] }
        : { dateTime: data.startsAt, timeZone: data.timezone },
      end: data.endsAt
        ? data.allDay
          ? { date: data.endsAt.split("T")[0] }
          : { dateTime: data.endsAt, timeZone: data.timezone }
        : data.allDay
          ? { date: data.startsAt.split("T")[0] }
          : { dateTime: data.startsAt, timeZone: data.timezone },
      location: data.location,
      attendees: data.attendees?.map((a) => ({
        email: a.email,
        displayName: a.displayName,
        optional: a.optional,
      })),
      recurrence: data.recurrence,
      reminders: data.reminders
        ? {
            useDefault: data.reminders.useDefault ?? true,
            overrides: data.reminders.overrides,
          }
        : undefined,
      visibility: data.visibility,
    };

    // Request event creation (goes through approval workflow)
    const result = await requestEventCreation({
      actionType: "create",
      userId,
      calendarId: data.calendarId,
      event: eventInput,
      checkConflicts: data.checkConflicts ?? true,
      requestedBy: data.requestedBy,
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
      { status: 201, headers }
    );
  } catch (error) {
    logger.error("Failed to create event", { userId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create event",
      },
      { status: 500, headers }
    );
  }
}
