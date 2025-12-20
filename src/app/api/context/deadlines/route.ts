// ═══════════════════════════════════════════════════════════════════════════
// Deadlines API
// POST /api/context/deadlines - Create a new deadline
// GET /api/context/deadlines - List user's deadlines (paginated, filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  parseAndValidateBody,
  validateQuery,
  createDeadlineSchema,
  listDeadlinesQuerySchema,
} from "@/lib/validation";
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
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
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

    // Convert date strings to Date objects
    const input = {
      ...validation.data,
      dueAt: new Date(validation.data.dueAt),
      reminderAt: validation.data.reminderAt
        ? new Date(validation.data.reminderAt)
        : undefined,
    };

    const deadline = await createDeadline(session.user.id, input, {
      userId: session.user.id,
    });

    return NextResponse.json(deadline, { status: 201 });
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
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
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
      const results = await getOverdueDeadlines(session.user.id, limit);
      return NextResponse.json({
        items: results,
        hasMore: results.length === limit,
      });
    }

    // Special filter: approaching deadlines
    const approaching = searchParams.get("approaching") === "true";
    if (approaching) {
      const days = parseInt(searchParams.get("days") || "7", 10);
      const results = await getApproachingDeadlines(
        session.user.id,
        days,
        limit
      );
      return NextResponse.json({
        items: results,
        hasMore: results.length === limit,
      });
    }

    // Special filter: by urgency level
    const urgency = searchParams.get("urgency") as UrgencyLevel | undefined;
    if (urgency) {
      const results = await getDeadlinesByUrgency(session.user.id, {
        minUrgency: urgency,
      });
      return NextResponse.json({
        items: results.slice(0, limit),
        hasMore: results.length > limit,
      });
    }

    // If search query provided, use search function
    if (search) {
      const results = await searchDeadlines(session.user.id, search, { limit });
      return NextResponse.json({
        items: results,
        hasMore: false,
      });
    }

    // Otherwise use list with filters
    const options: ListDeadlinesOptions = {
      limit,
      cursor,
      type: type as DeadlineType,
      status: status as DeadlineStatus,
      dueBefore: dueBefore ? new Date(dueBefore) : undefined,
      dueAfter: dueAfter ? new Date(dueAfter) : undefined,
      includeDeleted,
    };

    const result = await listDeadlines(session.user.id, options);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing deadlines:", error);
    return NextResponse.json(
      { error: "Failed to list deadlines" },
      { status: 500 }
    );
  }
}
