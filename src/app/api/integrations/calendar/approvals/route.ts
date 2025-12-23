// ═══════════════════════════════════════════════════════════════════════════
// Calendar Approvals API
// List pending calendar action approvals
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { calendarApprovalRepository } from "@/integrations/calendar/repository";
import { getPendingApprovals } from "@/integrations/calendar/actions";
import { calendarLogger } from "@/integrations/calendar/logger";

const logger = calendarLogger.child("api.approvals");

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/calendar/approvals - List approvals
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
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
    const searchParams = request.nextUrl.searchParams;

    // Parse query parameters
    const status = searchParams.get("status") || undefined;
    const pendingOnly = searchParams.get("pending") === "true";
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10),
      100
    );
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    let approvals;

    if (pendingOnly || !status) {
      // Get pending approvals
      approvals = await getPendingApprovals(userId);
    } else {
      // Get approvals by status
      approvals = await calendarApprovalRepository.findByStatus(
        userId,
        status as "pending" | "approved" | "rejected" | "expired" | "executed" | "failed"
      );
    }

    // Apply pagination manually (since repository methods don't support it)
    const paginatedApprovals = approvals.slice(offset, offset + limit);

    return NextResponse.json(
      {
        approvals: paginatedApprovals,
        total: approvals.length,
        count: paginatedApprovals.length,
        offset,
        limit,
        hasMore: offset + limit < approvals.length,
      },
      { headers }
    );
  } catch (error) {
    logger.error("Failed to list approvals", { userId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list approvals",
      },
      { status: 500, headers }
    );
  }
}

