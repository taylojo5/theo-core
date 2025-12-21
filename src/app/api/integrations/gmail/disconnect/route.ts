// ═══════════════════════════════════════════════════════════════════════════
// Gmail Disconnect API
// DELETE /api/integrations/gmail/disconnect - Revoke Gmail access
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { revokeGmailAccess, isGmailConnected } from "@/lib/auth/scope-upgrade";
import { logAuditEntry } from "@/services/audit";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { withCsrfProtection } from "@/lib/csrf";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface DisconnectResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/integrations/gmail/disconnect
// ─────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest
): Promise<NextResponse<DisconnectResponse>> {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailConnect
  );
  if (rateLimitResponse)
    return rateLimitResponse as NextResponse<DisconnectResponse>;

  // CSRF protection - critical for disconnecting accounts
  const csrfError = await withCsrfProtection(request, undefined, headers);
  if (csrfError) return csrfError as NextResponse<DisconnectResponse>;

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

  // Check if Gmail is currently connected
  const isConnected = await isGmailConnected(userId);

  if (!isConnected) {
    return NextResponse.json(
      {
        success: true,
        message: "Gmail is not currently connected",
      },
      { headers }
    );
  }

  // Revoke Gmail access
  const result = await revokeGmailAccess(userId);

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error || "Failed to disconnect Gmail",
      },
      { status: 500, headers }
    );
  }

  // Log the disconnection for audit (fire-and-forget to avoid blocking response)
  logAuditEntry({
    userId,
    actionType: "delete",
    actionCategory: "integration",
    entityType: "gmail_connection",
    inputSummary: "User disconnected Gmail integration",
    outputSummary: "Gmail access revoked successfully",
    metadata: {
      integration: "gmail",
      action: "disconnect",
    },
  }).catch((error) => {
    // Log audit failure but don't block the response
    console.error("Failed to log Gmail disconnect audit entry:", error);
  });

  return NextResponse.json(
    {
      success: true,
      message: "Gmail has been disconnected successfully",
    },
    { headers }
  );
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/gmail/disconnect
// Alternative method for disconnect (for form submissions)
// ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest
): Promise<NextResponse<DisconnectResponse>> {
  // Delegate to DELETE handler
  return DELETE(request);
}
