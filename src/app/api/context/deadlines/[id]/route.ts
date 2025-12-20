// ═══════════════════════════════════════════════════════════════════════════
// Single Deadline API
// GET /api/context/deadlines/[id] - Get deadline by ID
// PATCH /api/context/deadlines/[id] - Update deadline
// DELETE /api/context/deadlines/[id] - Soft delete deadline
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  validateParams,
  validateObject,
  updateDeadlineSchema,
  idParamSchema,
} from "@/lib/validation";
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
    const resolvedParams = await params;

    // Validate params
    const paramValidation = validateParams(resolvedParams, idParamSchema);
    if (!paramValidation.success) {
      return paramValidation.error;
    }

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check for options
    const { searchParams } = new URL(request.url);
    const includeRelations = searchParams.get("includeRelations") === "true";
    const includeUrgency = searchParams.get("includeUrgency") === "true";

    // Get deadline with optional relations
    if (includeRelations) {
      const deadline = await getDeadlineByIdWithRelations(
        session.user.id,
        paramValidation.data.id
      );
      if (!deadline) {
        return NextResponse.json(
          { error: "Deadline not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(deadline);
    }

    const deadline = await getDeadlineById(
      session.user.id,
      paramValidation.data.id
    );

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
    const resolvedParams = await params;

    // Validate params
    const paramValidation = validateParams(resolvedParams, idParamSchema);
    if (!paramValidation.success) {
      return paramValidation.error;
    }

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const deadlineId = paramValidation.data.id;

    // Check if this is a restore operation
    if (body.restore === true) {
      const deadline = await restoreDeadline(session.user.id, deadlineId, {
        userId: session.user.id,
      });
      return NextResponse.json(deadline);
    }

    // Check if this is a complete operation
    if (body.complete === true) {
      const deadline = await completeDeadline(session.user.id, deadlineId, {
        userId: session.user.id,
      });
      return NextResponse.json(deadline);
    }

    // Check if this is a missed operation
    if (body.missed === true) {
      const deadline = await markDeadlineMissed(session.user.id, deadlineId, {
        userId: session.user.id,
      });
      return NextResponse.json(deadline);
    }

    // Check if this is an extend operation
    if (body.extendTo) {
      const deadline = await extendDeadline(
        session.user.id,
        deadlineId,
        new Date(body.extendTo as string),
        { userId: session.user.id }
      );
      return NextResponse.json(deadline);
    }

    // Check if this is a status-only update
    if (body.status && Object.keys(body).length === 1) {
      const deadline = await updateDeadlineStatus(
        session.user.id,
        deadlineId,
        body.status as DeadlineStatus,
        { userId: session.user.id }
      );
      return NextResponse.json(deadline);
    }

    // Validate update body
    const validation = validateObject(body, updateDeadlineSchema);
    if (!validation.success) {
      return validation.error;
    }

    // Ensure at least one field is being updated
    const hasUpdate = Object.keys(validation.data).length > 0;
    if (!hasUpdate) {
      return NextResponse.json(
        { error: "At least one field must be provided for update" },
        { status: 400 }
      );
    }

    // Convert date strings to Date objects
    const updateData = {
      ...validation.data,
      dueAt: validation.data.dueAt
        ? new Date(validation.data.dueAt)
        : undefined,
      reminderAt: validation.data.reminderAt
        ? new Date(validation.data.reminderAt)
        : undefined,
    };

    const deadline = await updateDeadline(
      session.user.id,
      deadlineId,
      updateData,
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
    const resolvedParams = await params;

    // Validate params
    const paramValidation = validateParams(resolvedParams, idParamSchema);
    if (!paramValidation.success) {
      return paramValidation.error;
    }

    // Authenticate user
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await deleteDeadline(session.user.id, paramValidation.data.id, {
      userId: session.user.id,
    });

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
