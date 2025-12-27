// ═══════════════════════════════════════════════════════════════════════════
// Deadlines API
// POST /api/context/deadlines - Create a new deadline
// GET /api/context/deadlines - List user's deadlines (paginated, filterable)
// Uses Luxon for reliable ISO date parsing
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { DateTime } from "luxon";
import {
  parseAndValidateBody,
  validateQuery,
  createDeadlineSchema,
  listDeadlinesQuerySchema,
} from "@/lib/validation";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import {
  createDeadline,
  listDeadlines,
  searchDeadlines,
  getOverdueDeadlines,
  getApproachingDeadlines,
  getDeadlinesByUrgency,
  DeadlinesServiceError,
  type ListDeadlinesOptions,
  type DeadlineType,
  type DeadlineStatus,
  type UrgencyLevel,
} from "@/services/context";

// ─────────────────────────────────────────────────────────────
// POST - Create Deadline
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
    const validation = await parseAndValidateBody(
      request,
      createDeadlineSchema
    );
    if (!validation.success) {
      return validation.error;
    }

    // Convert date strings to Date objects using Luxon
    const input = {
      ...validation.data,
      dueAt: DateTime.fromISO(validation.data.dueAt).toJSDate(),
      reminderAt: validation.data.reminderAt
        ? DateTime.fromISO(validation.data.reminderAt).toJSDate()
        : undefined,
    };

    const deadline = await createDeadline(userId, input, {
      userId,
    });

    return NextResponse.json(deadline, { status: 201, headers });
  } catch (error) {
    console.error("Error creating deadline:", error);

    if (error instanceof DeadlinesServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create deadline" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// GET - List/Search Deadlines
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
    const validation = validateQuery(searchParams, listDeadlinesQuerySchema);
    if (!validation.success) {
      return validation.error;
    }

    const {
      limit,
      cursor,
      status,
      type,
      dueBefore,
      dueAfter,
      search,
      includeDeleted,
    } = validation.data;

    // Special filter: overdue deadlines
    const overdue = searchParams.get("overdue") === "true";
    if (overdue) {
      const results = await getOverdueDeadlines(userId, limit);
      return NextResponse.json(
        {
          items: results,
          hasMore: results.length === limit,
        },
        { headers }
      );
    }

    // Special filter: approaching deadlines
    const approaching = searchParams.get("approaching") === "true";
    if (approaching) {
      const days = parseInt(searchParams.get("days") || "7", 10);
      const results = await getApproachingDeadlines(userId, days, limit);
      return NextResponse.json(
        {
          items: results,
          hasMore: results.length === limit,
        },
        { headers }
      );
    }

    // Special filter: by urgency level
    const urgency = searchParams.get("urgency") as UrgencyLevel | undefined;
    if (urgency) {
      const results = await getDeadlinesByUrgency(userId, {
        minUrgency: urgency,
      });
      return NextResponse.json(
        {
          items: results.slice(0, limit),
          hasMore: results.length > limit,
        },
        { headers }
      );
    }

    // If search query provided, use search function
    if (search) {
      const results = await searchDeadlines(userId, search, { limit });
      return NextResponse.json(
        {
          items: results,
          hasMore: false,
        },
        { headers }
      );
    }

    // Otherwise use list with filters (using Luxon for date parsing)
    const options: ListDeadlinesOptions = {
      limit,
      cursor,
      type: type as DeadlineType,
      status: status as DeadlineStatus,
      dueBefore: dueBefore ? DateTime.fromISO(dueBefore).toJSDate() : undefined,
      dueAfter: dueAfter ? DateTime.fromISO(dueAfter).toJSDate() : undefined,
      includeDeleted,
    };

    const result = await listDeadlines(userId, options);

    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error("Error listing deadlines:", error);
    return NextResponse.json(
      { error: "Failed to list deadlines" },
      { status: 500 }
    );
  }
}
