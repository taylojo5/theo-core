// ═══════════════════════════════════════════════════════════════════════════
// Calendar Approval Detail API
// Get, approve, or reject individual approvals
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import {
  getApproval,
  approveCalendarAction,
  rejectCalendarAction,
  cancelApproval,
} from "@/integrations/calendar/actions";
import { calendarLogger } from "@/integrations/calendar/logger";
import { z } from "zod";

const logger = calendarLogger.child("api.approvals.id");

// ─────────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────────

const ApprovalActionSchema = z.object({
  action: z.enum(["approve", "reject", "cancel"]),
  notes: z.string().optional(),
  decidedBy: z.string().optional(),
  autoExecute: z.boolean().optional(),
});

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/calendar/approvals/[id] - Get approval
// ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarApprovals
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
    const { id } = await params;

    const approval = await getApproval(userId, id);

    if (!approval) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404, headers }
      );
    }

    return NextResponse.json({ approval }, { headers });
  } catch (error) {
    logger.error("Failed to get approval", { userId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get approval",
      },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/calendar/approvals/[id] - Approve/reject
// ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarApprovals
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
    const { id } = await params;

    // Parse and validate body
    const body = await request.json();
    const parseResult = ApprovalActionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.issues,
        },
        { status: 400, headers }
      );
    }

    const { action, notes, decidedBy, autoExecute } = parseResult.data;

    let result;

    switch (action) {
      case "approve":
        result = await approveCalendarAction(userId, id, {
          decidedBy,
          autoExecute: autoExecute ?? true,
        });
        break;
      case "reject":
        result = await rejectCalendarAction(userId, id, {
          notes,
          decidedBy,
        });
        break;
      case "cancel":
        result = await cancelApproval(userId, id);
        break;
    }

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.message,
          details: result.error,
        },
        { status: 400, headers }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: result.message,
        approval: result.approval,
        event: result.event,
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to process approval action", { userId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to process approval action",
      },
      { status: 500, headers }
    );
  }
}
