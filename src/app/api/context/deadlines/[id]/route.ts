// ═══════════════════════════════════════════════════════════════════════════
// Single Deadline API
// GET /api/context/deadlines/[id] - Get deadline by ID
// PATCH /api/context/deadlines/[id] - Update deadline
// DELETE /api/context/deadlines/[id] - Soft delete deadline
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getDeadlineById,
  getDeadlineByIdWithRelations,
  updateDeadline,
  updateDeadlineStatus,
  completeDeadline,
  markDeadlineMissed,
  extendDeadline,
  deleteDeadline,
  restoreDeadline,
  calculateDeadlineUrgency,
  DeadlinesServiceError,
  type DeadlineStatus,
} from "@/services/context";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────────────────────
// GET - Get Deadline by ID
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
    const includeUrgency = searchParams.get("includeUrgency") === "true";

    // Get deadline with optional relations
    if (includeRelations) {
      const deadline = await getDeadlineByIdWithRelations(session.user.id, id);
      if (!deadline) {
        return NextResponse.json(
          { error: "Deadline not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(deadline);
    }

    const deadline = await getDeadlineById(session.user.id, id);

    if (!deadline) {
      return NextResponse.json(
        { error: "Deadline not found" },
        { status: 404 }
      );
    }

    // Optionally calculate urgency
    if (includeUrgency) {
      const urgency = calculateDeadlineUrgency(deadline);
      return NextResponse.json({
        ...deadline,
        urgency,
      });
    }

    return NextResponse.json(deadline);
  } catch (error) {
    console.error("Error fetching deadline:", error);
    return NextResponse.json(
      { error: "Failed to fetch deadline" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// PATCH - Update Deadline
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
      const deadline = await restoreDeadline(session.user.id, id, {
        userId: session.user.id,
      });
      return NextResponse.json(deadline);
    }

    // Check if this is a complete operation
    if (body.complete === true) {
      const deadline = await completeDeadline(session.user.id, id, {
        userId: session.user.id,
      });
      return NextResponse.json(deadline);
    }

    // Check if this is a missed operation
    if (body.missed === true) {
      const deadline = await markDeadlineMissed(session.user.id, id, {
        userId: session.user.id,
      });
      return NextResponse.json(deadline);
    }

    // Check if this is an extend operation
    if (body.extendTo) {
      const deadline = await extendDeadline(
        session.user.id,
        id,
        new Date(body.extendTo),
        { userId: session.user.id }
      );
      return NextResponse.json(deadline);
    }

    // Check if this is a status-only update
    if (body.status && Object.keys(body).length === 1) {
      const deadline = await updateDeadlineStatus(
        session.user.id,
        id,
        body.status as DeadlineStatus,
        { userId: session.user.id }
      );
      return NextResponse.json(deadline);
    }

    // Validate at least one field is being updated
    const updateFields = [
      "title", "description", "type", "dueAt", "reminderAt", "status",
      "importance", "taskId", "eventId", "notes", "consequences", "metadata", "tags"
    ];
    const hasUpdate = updateFields.some((field) => body[field] !== undefined);

    if (!hasUpdate) {
      return NextResponse.json(
        { error: "At least one field must be provided for update" },
        { status: 400 }
      );
    }

    const deadline = await updateDeadline(
      session.user.id,
      id,
      {
        title: body.title,
        description: body.description,
        type: body.type,
        dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
        reminderAt: body.reminderAt ? new Date(body.reminderAt) : undefined,
        status: body.status,
        importance: body.importance,
        taskId: body.taskId,
        eventId: body.eventId,
        notes: body.notes,
        consequences: body.consequences,
        metadata: body.metadata,
        tags: body.tags,
      },
      { userId: session.user.id }
    );

    return NextResponse.json(deadline);
  } catch (error) {
    console.error("Error updating deadline:", error);

    if (error instanceof DeadlinesServiceError) {
      if (error.code === "DEADLINE_NOT_FOUND") {
        return NextResponse.json(
          { error: "Deadline not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update deadline" },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE - Soft Delete Deadline
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

    await deleteDeadline(session.user.id, id, { userId: session.user.id });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting deadline:", error);

    if (error instanceof DeadlinesServiceError) {
      if (error.code === "DEADLINE_NOT_FOUND") {
        return NextResponse.json(
          { error: "Deadline not found" },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to delete deadline" },
      { status: 500 }
    );
  }
}

