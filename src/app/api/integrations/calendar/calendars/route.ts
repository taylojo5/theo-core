// ═══════════════════════════════════════════════════════════════════════════
// Calendar List API
// List user's calendars
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { calendarRepository } from "@/integrations/calendar/repository";
import { calendarLogger } from "@/integrations/calendar/logger";

const logger = calendarLogger.child("api.calendars");

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/calendar/calendars - List calendars
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Apply rate limiting
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
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const includeHidden = searchParams.get("includeHidden") === "true";
    const selectedOnly = searchParams.get("selectedOnly") === "true";

    // Get calendars from repository
    let calendars = await calendarRepository.findByUser(userId);

    // Apply filters
    if (!includeHidden) {
      calendars = calendars.filter((c) => !c.isHidden);
    }
    if (selectedOnly) {
      calendars = calendars.filter((c) => c.isSelected);
    }

    // Sort: primary first, then by name
    calendars.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json(
      {
        calendars,
        count: calendars.length,
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to list calendars", { userId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list calendars",
      },
      { status: 500, headers }
    );
  }
}
