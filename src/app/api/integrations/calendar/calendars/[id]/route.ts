// ═══════════════════════════════════════════════════════════════════════════
// Calendar Detail API
// Get and update individual calendar settings
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { calendarRepository } from "@/integrations/calendar/repository";
import { calendarLogger } from "@/integrations/calendar/logger";
import { z } from "zod";

const logger = calendarLogger.child("api.calendars.id");

// ─────────────────────────────────────────────────────────────
// Validation Schema
// ─────────────────────────────────────────────────────────────

const UpdateCalendarSchema = z.object({
  isSelected: z.boolean().optional(),
  isHidden: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/calendar/calendars/[id] - Get calendar
// ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarCalendars
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

    const calendar = await calendarRepository.findById(id);

    if (!calendar) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404, headers }
      );
    }

    // Verify ownership
    if (calendar.userId !== userId) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json({ calendar }, { headers });
  } catch (error) {
    logger.error("Failed to get calendar", { userId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get calendar",
      },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/integrations/calendar/calendars/[id] - Update calendar
// ─────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarCalendars
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

    // Find calendar and verify ownership
    const calendar = await calendarRepository.findById(id);
    if (!calendar || calendar.userId !== userId) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404, headers }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parseResult = UpdateCalendarSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.issues,
        },
        { status: 400, headers }
      );
    }

    const updates = parseResult.data;

    // Update calendar
    const updated = await calendarRepository.update(id, updates);

    logger.info("Calendar updated", {
      userId,
      calendarId: id,
      updates,
    });

    return NextResponse.json({ calendar: updated }, { headers });
  } catch (error) {
    logger.error("Failed to update calendar", { userId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update calendar",
      },
      { status: 500, headers }
    );
  }
}

