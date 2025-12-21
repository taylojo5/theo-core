// ═══════════════════════════════════════════════════════════════════════════
// Gmail Approval API (Individual)
// Get, approve, or reject a specific approval
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createGmailClient, apiLogger } from "@/integrations/gmail";
import {
  getApproval,
  approveAndSend,
  rejectApproval,
} from "@/integrations/gmail/actions";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { withCsrfProtection } from "@/lib/csrf";
import {
  unauthorized,
  notFound,
  validationError,
  gmailNotConnected,
  handleApiError,
} from "@/lib/api";
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailApprovals
  );
  if (rateLimitResponse) return rateLimitResponse;

  // Capture variables before try block for error logging
  let userId: string | undefined;
  let approvalId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return unauthorized("Authentication required", headers);
    }

    userId = session.user.id;
    const resolvedParams = await params;
    approvalId = resolvedParams.id;

    const approval = await getApproval(userId, approvalId);

    if (!approval) {
      return notFound("Approval", headers);
    }

    return NextResponse.json(approval, { headers });
  } catch (error) {
    apiLogger.error("Failed to get approval", { userId, approvalId }, error);
    return handleApiError(error, headers);
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/gmail/approvals/[id] - Approve or reject
// ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailApprovals
  );
  if (rateLimitResponse) return rateLimitResponse;

  // Capture variables before try block for error logging
  let userId: string | undefined;
  let approvalId: string | undefined;
  let action: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return unauthorized("Authentication required", headers);
    }

    userId = session.user.id;

    // Parse body first so we can check CSRF from body
    const body = await request.json();

    // CSRF protection - critical for approval/rejection actions
    const csrfError = await withCsrfProtection(request, body, headers);
    if (csrfError) return csrfError;

    const resolvedParams = await params;
    approvalId = resolvedParams.id;
    const parseResult = ActionSchema.safeParse(body);

    if (!parseResult.success) {
      return validationError(
        "Invalid request body",
        parseResult.error.errors,
        headers
      );
    }

    action = parseResult.data.action;
    const notes = parseResult.data.notes;

    // Get valid access token
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return gmailNotConnected(headers);
    }

    const client = createGmailClient(accessToken, userId);

    // Handle action
    if (action === "approve") {
      const result = await approveAndSend(client, userId, approvalId);

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: "GMAIL_SEND_FAILED",
              message: result.errorMessage || "Failed to send email",
            },
            approval: result.approval,
          },
          { status: 500, headers }
        );
      }

      return NextResponse.json(
        {
          success: true,
          approval: result.approval,
          sentMessageId: result.sentMessageId,
        },
        { headers }
      );
    }

    // Reject
    const result = await rejectApproval(client, userId, approvalId, notes);

    return NextResponse.json(
      {
        success: true,
        approval: result.approval,
      },
      { headers }
    );
  } catch (error) {
    apiLogger.error(
      "Approval action failed",
      { userId, approvalId, action },
      error
    );
    return handleApiError(error, headers);
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/integrations/gmail/approvals/[id] - Cancel/reject
// ─────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailApprovals
  );
  if (rateLimitResponse) return rateLimitResponse;

  // CSRF protection - critical for cancelling approvals
  const csrfError = await withCsrfProtection(request, undefined, headers);
  if (csrfError) return csrfError;

  // Capture variables before try block for error logging
  let userId: string | undefined;
  let approvalId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return unauthorized("Authentication required", headers);
    }

    userId = session.user.id;
    const resolvedParams = await params;
    approvalId = resolvedParams.id;

    // Get valid access token
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return gmailNotConnected(headers);
    }

    const client = createGmailClient(accessToken, userId);
    const result = await rejectApproval(
      client,
      userId,
      approvalId,
      "Cancelled by user"
    );

    return NextResponse.json(
      {
        success: true,
        approval: result.approval,
      },
      { headers }
    );
  } catch (error) {
    apiLogger.error("Failed to cancel approval", { userId, approvalId }, error);
    return handleApiError(error, headers);
  }
}
