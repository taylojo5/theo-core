// ═══════════════════════════════════════════════════════════════════════════
// Calendar Disconnect API
// DELETE /api/integrations/calendar/disconnect - Revoke Calendar access
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  revokeCalendarAccess,
  isCalendarConnected,
} from "@/lib/auth/scope-upgrade";
import { logAuditEntry } from "@/services/audit";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { calendarLogger } from "@/integrations/calendar/logger";

const logger = calendarLogger.child("api.disconnect");

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface DisconnectResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/integrations/calendar/disconnect
// ─────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest
): Promise<NextResponse<DisconnectResponse>> {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarConnect
  );
  if (rateLimitResponse)
    return rateLimitResponse as NextResponse<DisconnectResponse>;

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401, headers }
    );
  }

  const userId = session.user.id;

  // Check if Calendar is currently connected
  const isConnected = await isCalendarConnected(userId);

  if (!isConnected) {
    return NextResponse.json(
      {
        success: true,
        message: "Calendar is not currently connected",
      },
      { headers }
    );
  }

  // Revoke Calendar access
  const result = await revokeCalendarAccess(userId);

  if (!result.success) {
    logger.error("Failed to revoke Calendar access", { userId, error: result.error });
    return NextResponse.json(
      {
        success: false,
        error: result.error || "Failed to disconnect Calendar",
      },
      { status: 500, headers }
    );
  }

  // Log the disconnection for audit (fire-and-forget to avoid blocking response)
  logAuditEntry({
    userId,
    actionType: "delete",
    actionCategory: "integration",
    entityType: "calendar_connection",
    inputSummary: "User disconnected Calendar integration",
    outputSummary: "Calendar access revoked successfully",
    metadata: {
      integration: "calendar",
      action: "disconnect",
    },
  }).catch((error) => {
    // Log audit failure but don't block the response
    logger.warn("Failed to log Calendar disconnect audit entry", { userId }, error);
  });

  logger.info("Calendar disconnected successfully", { userId });

  return NextResponse.json(
    {
      success: true,
      message: "Calendar has been disconnected successfully",
    },
    { headers }
  );
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/calendar/disconnect
// Alternative method for disconnect (for form submissions)
// ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest
): Promise<NextResponse<DisconnectResponse>> {
  // Delegate to DELETE handler
  return DELETE(request);
}

