// ═══════════════════════════════════════════════════════════════════════════
// Gmail Disconnect API
// DELETE /api/integrations/gmail/disconnect - Revoke Gmail access
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { revokeGmailAccess, isGmailConnected } from "@/lib/auth/scope-upgrade";
import { logAuditEntry } from "@/services/audit";

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

export async function DELETE(): Promise<NextResponse<DisconnectResponse>> {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  // Check if Gmail is currently connected
  const isConnected = await isGmailConnected(userId);

  if (!isConnected) {
    return NextResponse.json({
      success: true,
      message: "Gmail is not currently connected",
    });
  }

  // Revoke Gmail access
  const result = await revokeGmailAccess(userId);

  if (!result.success) {
    return NextResponse.json(
      {
        success: false,
        error: result.error || "Failed to disconnect Gmail",
      },
      { status: 500 }
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

  return NextResponse.json({
    success: true,
    message: "Gmail has been disconnected successfully",
  });
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/gmail/disconnect
// Alternative method for disconnect (for form submissions)
// ─────────────────────────────────────────────────────────────

export async function POST(): Promise<NextResponse<DisconnectResponse>> {
  // Delegate to DELETE handler
  return DELETE();
}
