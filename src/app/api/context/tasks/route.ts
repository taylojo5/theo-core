// ═══════════════════════════════════════════════════════════════════════════
// Tasks API
// POST /api/context/tasks - Create a new task
// GET /api/context/tasks - List user's tasks (paginated, filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  parseAndValidateBody,
  validateQuery,
  createTaskSchema,
  listTasksQuerySchema,
} from "@/lib/validation";
import {
  createTask,
  listTasks,
  searchTasks,
  getOverdueTasks,
  getTasksDueSoon,
  TasksServiceError,
  type ListTasksOptions,
  type TaskStatus,
  type TaskPriority,
} from "@/services/context";

// ─────────────────────────────────────────────────────────────
// POST - Create Task
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate request body
    const validation = await parseAndValidateBody(request, createTaskSchema);
    if (!validation.success) {
      return validation.error;
    }

    // Convert date strings to Date objects
    const input = {
      ...validation.data,
      dueDate: validation.data.dueDate
        ? new Date(validation.data.dueDate)
        : undefined,
      startDate: validation.data.startDate
        ? new Date(validation.data.startDate)
        : undefined,
    };

    const task = await createTask(session.user.id, input, {
      userId: session.user.id,
    });

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate query parameters
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(searchParams, listTasksQuerySchema);
    if (!validation.success) {
      return validation.error;
    }

    const {
      limit,
      cursor,
      status,
      priority,
      parentId,
      dueBefore,
      dueAfter,
      search,
      includeDeleted,
    } = validation.data;

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
    if (search) {
      const results = await searchTasks(session.user.id, search, { limit });
      return NextResponse.json({
        items: results,
        hasMore: false,
      });
    }

    // Otherwise use list with filters
    const options: ListTasksOptions = {
      limit,
      cursor,
      status: status as TaskStatus,
      priority: priority as TaskPriority,
      parentId: parentId === "null" ? null : parentId,
      dueBefore: dueBefore ? new Date(dueBefore) : undefined,
      dueAfter: dueAfter ? new Date(dueAfter) : undefined,
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
