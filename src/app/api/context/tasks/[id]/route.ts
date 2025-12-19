// ═══════════════════════════════════════════════════════════════════════════
// Single Task API
// GET /api/context/tasks/[id] - Get task by ID
// PATCH /api/context/tasks/[id] - Update task
// DELETE /api/context/tasks/[id] - Soft delete task
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getTaskById,
  getTaskByIdWithRelations,
  updateTask,
  updateTaskStatus,
  completeTask,
  startTask,
  deleteTask,
  restoreTask,
  getSubtasks,
  TasksServiceError,
  type TaskStatus,
} from "@/services/context";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────────────────────
// GET - Get Task by ID
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Check for options
    const { searchParams } = new URL(request.url);
    const includeRelations = searchParams.get("includeRelations") === "true";
    const includeSubtasks = searchParams.get("includeSubtasks") === "true";

    // Get task with optional relations
    if (includeRelations) {
      const task = await getTaskByIdWithRelations(session.user.id, id);
      if (!task) {
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(task);
    }

    const task = await getTaskById(session.user.id, id);

    if (!task) {
      return NextResponse.json(
        { error: "Task not found" },
        { status: 404 }
      );
    }

    // Optionally include subtasks
    if (includeSubtasks) {
      const subtasks = await getSubtasks(session.user.id, id);
      return NextResponse.json({
        ...task,
        subtasks,
      });
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      { error: "Failed to fetch task" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH - Update Task
// ─────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

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

    // Check if this is a restore operation
    if (body.restore === true) {
      const task = await restoreTask(session.user.id, id, {
        userId: session.user.id,
      });
      return NextResponse.json(task);
    }

    // Check if this is a complete operation
    if (body.complete === true) {
      const task = await completeTask(session.user.id, id, {
        userId: session.user.id,
      });
      return NextResponse.json(task);
    }

    // Check if this is a start operation
    if (body.start === true) {
      const task = await startTask(session.user.id, id, {
        userId: session.user.id,
      });
      return NextResponse.json(task);
    }

    // Check if this is a status-only update
    if (body.status && Object.keys(body).length === 1) {
      const task = await updateTaskStatus(
        session.user.id,
        id,
        body.status as TaskStatus,
        { userId: session.user.id }
      );
      return NextResponse.json(task);
    }

    // Validate at least one field is being updated
    const updateFields = [
      "title", "description", "parentId", "position", "status", "priority",
      "dueDate", "startDate", "completedAt", "estimatedMinutes", "actualMinutes",
      "notes", "assignedToId", "metadata", "tags"
    ];
    const hasUpdate = updateFields.some((field) => body[field] !== undefined);

    if (!hasUpdate) {
      return NextResponse.json(
        { error: "At least one field must be provided for update" },
        { status: 400 }
      );
    }

    const task = await updateTask(
      session.user.id,
      id,
      {
        title: body.title,
        description: body.description,
        parentId: body.parentId,
        position: body.position,
        status: body.status,
        priority: body.priority,
        dueDate: body.dueDate ? new Date(body.dueDate) : body.dueDate,
        startDate: body.startDate ? new Date(body.startDate) : body.startDate,
        completedAt: body.completedAt ? new Date(body.completedAt) : body.completedAt,
        estimatedMinutes: body.estimatedMinutes,
        actualMinutes: body.actualMinutes,
        notes: body.notes,
        assignedToId: body.assignedToId,
        metadata: body.metadata,
        tags: body.tags,
      },
      { userId: session.user.id }
    );

    return NextResponse.json(task);
  } catch (error) {
    console.error("Error updating task:", error);

    if (error instanceof TasksServiceError) {
      if (error.code === "TASK_NOT_FOUND") {
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update task" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE - Soft Delete Task
// ─────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    await deleteTask(session.user.id, id, { userId: session.user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting task:", error);

    if (error instanceof TasksServiceError) {
      if (error.code === "TASK_NOT_FOUND") {
        return NextResponse.json(
          { error: "Task not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}

