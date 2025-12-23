// ═══════════════════════════════════════════════════════════════════════════
// Tasks API
// POST /api/context/tasks - Create a new task
// GET /api/context/tasks - List user's tasks (paginated, filterable)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import {
  parseAndValidateBody,
  validateQuery,
  createTaskSchema,
  listTasksQuerySchema,
} from "@/lib/validation";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
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

    const task = await createTask(userId, input, {
      userId,
    });

    return NextResponse.json(task, { status: 201, headers });
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
      const results = await getOverdueTasks(userId, limit);
      return NextResponse.json(
        {
          items: results,
          hasMore: results.length === limit,
        },
        { headers }
      );
    }

    // Special filter: due soon
    const dueSoon = searchParams.get("dueSoon") === "true";
    if (dueSoon) {
      const days = parseInt(searchParams.get("days") || "7", 10);
      const results = await getTasksDueSoon(userId, days, limit);
      return NextResponse.json(
        {
          items: results,
          hasMore: results.length === limit,
        },
        { headers }
      );
    }

    // If search query provided, use search function
    if (search) {
      const results = await searchTasks(userId, search, { limit });
      return NextResponse.json(
        {
          items: results,
          hasMore: false,
        },
        { headers }
      );
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

    const result = await listTasks(userId, options);

    return NextResponse.json(result, { headers });
  } catch (error) {
    console.error("Error listing tasks:", error);
    return NextResponse.json(
      { error: "Failed to list tasks" },
      { status: 500 }
    );
  }
}
