// ═══════════════════════════════════════════════════════════════════════════
// Tasks API
// POST /api/context/tasks - Create a new task
// GET /api/context/tasks - List user's tasks (paginated, filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  createTask,
  listTasks,
  searchTasks,
  getOverdueTasks,
  getTasksDueSoon,
  TasksServiceError,
  type CreateTaskInput,
  type ListTasksOptions,
  type Source,
  type TaskStatus,
  type TaskPriority,
  type SortOrder,
} from "@/services/context";

// ─────────────────────────────────────────────────────────────
// POST - Create Task
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

    // Build input
    const input: CreateTaskInput = {
      title: body.title,
      description: body.description,
      parentId: body.parentId,
      position: body.position,
      status: body.status,
      priority: body.priority,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      estimatedMinutes: body.estimatedMinutes,
      notes: body.notes,
      assignedToId: body.assignedToId,
      source: body.source ?? "manual",
      sourceId: body.sourceId,
      metadata: body.metadata,
      tags: body.tags,
    };

    const task = await createTask(
      session.user.id,
      input,
      { userId: session.user.id }
    );

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);

    if (error instanceof TasksServiceError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// GET - List/Search Tasks
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
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as SortOrder;
    const status = searchParams.get("status") as TaskStatus | undefined;
    const priority = searchParams.get("priority") as TaskPriority | undefined;
    const assignedToId = searchParams.get("assignedToId") || undefined;
    const source = searchParams.get("source") as Source | undefined;
    const tags = searchParams.get("tags")?.split(",").filter(Boolean) || undefined;
    const includeDeleted = searchParams.get("includeDeleted") === "true";
    const includeSubtasks = searchParams.get("includeSubtasks") === "true";

    // Parent filter (null for top-level only)
    const parentIdParam = searchParams.get("parentId");
    const parentId = parentIdParam === "null" ? null : parentIdParam || undefined;

    // Date filters
    const dueBefore = searchParams.get("dueBefore")
      ? new Date(searchParams.get("dueBefore")!)
      : undefined;
    const dueAfter = searchParams.get("dueAfter")
      ? new Date(searchParams.get("dueAfter")!)
      : undefined;

    // Special filter: overdue tasks
    const overdue = searchParams.get("overdue") === "true";
    if (overdue) {
      const results = await getOverdueTasks(session.user.id, limit);
      return NextResponse.json({
        items: results,
        hasMore: results.length === limit,
      });
    }

    // Special filter: due soon
    const dueSoon = searchParams.get("dueSoon") === "true";
    if (dueSoon) {
      const days = parseInt(searchParams.get("days") || "7", 10);
      const results = await getTasksDueSoon(session.user.id, days, limit);
      return NextResponse.json({
        items: results,
        hasMore: results.length === limit,
      });
    }

    // If search query provided, use search function
    if (q) {
      const results = await searchTasks(session.user.id, q, { limit });
      return NextResponse.json({
        items: results,
        hasMore: false,
      });
    }

    // Otherwise use list with filters
    const options: ListTasksOptions = {
      limit,
      cursor,
      sortBy,
      sortOrder,
      status,
      priority,
      parentId,
      assignedToId,
      dueBefore,
      dueAfter,
      includeSubtasks,
      source,
      tags,
      includeDeleted,
    };

    const result = await listTasks(session.user.id, options);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error listing tasks:", error);
    return NextResponse.json(
      { error: "Failed to list tasks" },
      { status: 500 }
    );
  }
}

