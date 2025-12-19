// ═══════════════════════════════════════════════════════════════════════════
// Deadlines API
// POST /api/context/deadlines - Create a new deadline
// GET /api/context/deadlines - List user's deadlines (paginated, filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createDeadline,
  listDeadlines,
  searchDeadlines,
  getOverdueDeadlines,
  getApproachingDeadlines,
  getDeadlinesByUrgency,
  DeadlinesServiceError,
  type CreateDeadlineInput,
  type ListDeadlinesOptions,
  type Source,
  type DeadlineType,
  type DeadlineStatus,
  type SortOrder,
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

    if (!body.dueAt) {
      return NextResponse.json(
        { error: "dueAt is required" },
        { status: 400 }
      );
    }

    // Build input
    const input: CreateDeadlineInput = {
      title: body.title,
      description: body.description,
      type: body.type,
      dueAt: new Date(body.dueAt),
      reminderAt: body.reminderAt ? new Date(body.reminderAt) : undefined,
      status: body.status,
      importance: body.importance,
      taskId: body.taskId,
      eventId: body.eventId,
      notes: body.notes,
      consequences: body.consequences,
      source: body.source ?? "manual",
      sourceId: body.sourceId,
      metadata: body.metadata,
      tags: body.tags,
    };

    const deadline = await createDeadline(
      session.user.id,
      input,
      { userId: session.user.id }
    );

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
    const sortBy = searchParams.get("sortBy") || "dueAt";
    const sortOrder = (searchParams.get("sortOrder") || "asc") as SortOrder;
    const type = searchParams.get("type") as DeadlineType | undefined;
    const status = searchParams.get("status") as DeadlineStatus | undefined;
    const taskId = searchParams.get("taskId") || undefined;
    const eventId = searchParams.get("eventId") || undefined;
    const source = searchParams.get("source") as Source | undefined;
    const tags = searchParams.get("tags")?.split(",").filter(Boolean) || undefined;
    const includeDeleted = searchParams.get("includeDeleted") === "true";
    const minImportance = searchParams.get("minImportance")
      ? parseInt(searchParams.get("minImportance")!, 10)
      : undefined;

    // Date filters
    const dueBefore = searchParams.get("dueBefore")
      ? new Date(searchParams.get("dueBefore")!)
      : undefined;
    const dueAfter = searchParams.get("dueAfter")
      ? new Date(searchParams.get("dueAfter")!)
      : undefined;

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
      const results = await getApproachingDeadlines(session.user.id, days, limit);
      return NextResponse.json({
        items: results,
        hasMore: results.length === limit,
      });
    }

    // Special filter: by urgency level
    const urgency = searchParams.get("urgency") as UrgencyLevel | undefined;
    if (urgency) {
      const results = await getDeadlinesByUrgency(session.user.id, { minUrgency: urgency });
      return NextResponse.json({
        items: results.slice(0, limit),
        hasMore: results.length > limit,
      });
    }

    // If search query provided, use search function
    if (q) {
      const results = await searchDeadlines(session.user.id, q, { limit });
      return NextResponse.json({
        items: results,
        hasMore: false,
      });
    }

    // Otherwise use list with filters
    const options: ListDeadlinesOptions = {
      limit,
      cursor,
      sortBy,
      sortOrder,
      type,
      status,
      dueBefore,
      dueAfter,
      taskId,
      eventId,
      minImportance,
      source,
      tags,
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

