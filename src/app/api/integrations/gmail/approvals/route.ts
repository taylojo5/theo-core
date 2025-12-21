// ═══════════════════════════════════════════════════════════════════════════
// Gmail Approvals API
// List and manage email approvals
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createGmailClient } from "@/integrations/gmail";
import {
  requestApproval,
  getPendingApprovals,
  getApprovals,
  getApprovalStats,
  validateComposeParams,
} from "@/integrations/gmail/actions";
import type { ApprovalStatus } from "@/integrations/gmail/actions";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Validation Schema
// ─────────────────────────────────────────────────────────────

const RequestApprovalSchema = z.object({
  to: z.array(z.string().email()).min(1, "At least one recipient required"),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  bodyHtml: z.string().optional(),
  threadId: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
  requestedBy: z.string().optional(),
  expiresInMinutes: z.number().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/gmail/approvals - List approvals
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailApprovals
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as ApprovalStatus | null;
    const pendingOnly = searchParams.get("pending") === "true";
    const includeExpired = searchParams.get("includeExpired") === "true";
    const statsOnly = searchParams.get("stats") === "true";
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Return stats only if requested
    if (statsOnly) {
      const stats = await getApprovalStats(session.user.id);
      return NextResponse.json(stats, { headers });
    }

    // Get pending approvals or all with filter
    let approvals;
    if (pendingOnly) {
      approvals = await getPendingApprovals(session.user.id, {
        limit,
        offset,
        includeExpired,
      });
    } else {
      approvals = await getApprovals(session.user.id, {
        status: status || undefined,
        limit,
        offset,
      });
    }

    return NextResponse.json(
      {
        approvals,
        count: approvals.length,
        offset,
        limit,
      },
      { headers }
    );
  } catch (error) {
    console.error("[Approvals API] List error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to list approvals",
      },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/gmail/approvals - Request approval
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailApprovals
  );
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    // Parse and validate body
    const body = await request.json();
    const parseResult = RequestApprovalSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.errors,
        },
        { status: 400, headers }
      );
    }

    const params = parseResult.data;

    // Additional validation
    const validation = validateComposeParams(params);
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.errors,
        },
        { status: 400, headers }
      );
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(session.user.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Gmail not connected or token expired" },
        { status: 401, headers }
      );
    }

    // Create client and request approval
    const client = createGmailClient(accessToken, session.user.id);
    const result = await requestApproval(client, session.user.id, params);

    return NextResponse.json(
      {
        approval: result.approval,
        draftId: result.draftId,
        gmailDraftId: result.gmailDraftId,
      },
      { status: 201, headers }
    );
  } catch (error) {
    console.error("[Approvals API] Create error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to request approval",
      },
      { status: 500, headers }
    );
  }
}
