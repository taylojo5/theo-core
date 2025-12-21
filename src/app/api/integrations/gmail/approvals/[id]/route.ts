// ═══════════════════════════════════════════════════════════════════════════
// Gmail Approval API (Individual)
// Get, approve, or reject a specific approval
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createGmailClient } from "@/integrations/gmail";
import {
  getApproval,
  approveAndSend,
  rejectApproval,
} from "@/integrations/gmail/actions";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Validation Schema
// ─────────────────────────────────────────────────────────────

const ActionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  notes: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/gmail/approvals/[id] - Get approval
// ─────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: approvalId } = await params;

    const approval = await getApproval(session.user.id, approvalId);

    if (!approval) {
      return NextResponse.json(
        { error: "Approval not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(approval);
  } catch (error) {
    console.error("[Approval API] Get error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to get approval",
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/gmail/approvals/[id] - Approve or reject
// ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: approvalId } = await params;

    // Parse and validate body
    const body = await request.json();
    const parseResult = ActionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.errors,
        },
        { status: 400 }
      );
    }

    const { action, notes } = parseResult.data;

    // Get valid access token
    const accessToken = await getValidAccessToken(session.user.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Gmail not connected or token expired" },
        { status: 401 }
      );
    }

    const client = createGmailClient(accessToken, session.user.id);

    // Handle action
    if (action === "approve") {
      const result = await approveAndSend(client, session.user.id, approvalId);

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: result.errorMessage || "Failed to send email",
            approval: result.approval,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        approval: result.approval,
        sentMessageId: result.sentMessageId,
      });
    }

    // Reject
    const result = await rejectApproval(
      client,
      session.user.id,
      approvalId,
      notes
    );

    return NextResponse.json({
      success: true,
      approval: result.approval,
    });
  } catch (error) {
    console.error("[Approval API] Action error:", error);

    // Handle specific errors
    const errorMessage =
      error instanceof Error ? error.message : "Failed to process action";
    const status = errorMessage.includes("not found")
      ? 404
      : errorMessage.includes("expired")
        ? 410
        : errorMessage.includes("Cannot")
          ? 400
          : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/integrations/gmail/approvals/[id] - Cancel/reject
// ─────────────────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: approvalId } = await params;

    // Get valid access token
    const accessToken = await getValidAccessToken(session.user.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Gmail not connected or token expired" },
        { status: 401 }
      );
    }

    const client = createGmailClient(accessToken, session.user.id);
    const result = await rejectApproval(
      client,
      session.user.id,
      approvalId,
      "Cancelled by user"
    );

    return NextResponse.json({
      success: true,
      approval: result.approval,
    });
  } catch (error) {
    console.error("[Approval API] Delete error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to cancel approval",
      },
      { status: 500 }
    );
  }
}
