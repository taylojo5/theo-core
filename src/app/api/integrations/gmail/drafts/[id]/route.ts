// ═══════════════════════════════════════════════════════════════════════════
// Gmail Draft API (Individual)
// Get, update, and delete a specific draft
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createGmailClient } from "@/integrations/gmail";
import {
  getDraft,
  updateDraft,
  deleteDraft,
  validateComposeParams,
} from "@/integrations/gmail/actions";
import { apiLogger } from "@/integrations/gmail";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { withCsrfProtection } from "@/lib/csrf";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Validation Schema
// ─────────────────────────────────────────────────────────────

const UpdateDraftSchema = z.object({
  to: z.array(z.string().email()).min(1, "At least one recipient required"),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  bodyHtml: z.string().optional(),
  threadId: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
});

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/gmail/drafts/[id] - Get draft
// ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailDrafts
  );
  if (rateLimitResponse) return rateLimitResponse;

  // Capture variables before try block for error logging
  let userId: string | undefined;
  let draftId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    userId = session.user.id;
    const resolvedParams = await params;
    draftId = resolvedParams.id;

    // Get valid access token
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Gmail not connected or token expired" },
        { status: 401, headers }
      );
    }

    // Create client and get draft
    const client = createGmailClient(accessToken, userId);
    const draft = await getDraft(client, draftId);

    return NextResponse.json(draft, { headers });
  } catch (error) {
    apiLogger.error("Failed to get draft", { userId, draftId }, error);

    // Check if it's a not found error
    const errorMessage =
      error instanceof Error ? error.message : "Failed to get draft";
    const status =
      errorMessage.includes("not found") || errorMessage.includes("404")
        ? 404
        : 500;

    return NextResponse.json({ error: errorMessage }, { status, headers });
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/integrations/gmail/drafts/[id] - Update draft
// ─────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailDrafts
  );
  if (rateLimitResponse) return rateLimitResponse;

  // Capture variables before try block for error logging
  let userId: string | undefined;
  let draftId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    userId = session.user.id;
    const resolvedParams = await params;
    draftId = resolvedParams.id;

    // Parse and validate body
    const body = await request.json();

    // CSRF protection - critical for updating drafts
    const csrfError = await withCsrfProtection(request, body, headers);
    if (csrfError) return csrfError;
    const parseResult = UpdateDraftSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.errors,
        },
        { status: 400, headers }
      );
    }

    const updateParams = parseResult.data;

    // Additional validation
    const validation = validateComposeParams(updateParams);
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
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Gmail not connected or token expired" },
        { status: 401, headers }
      );
    }

    // Create client and update draft
    const client = createGmailClient(accessToken, userId);
    const result = await updateDraft(client, draftId, updateParams);

    return NextResponse.json(result, { headers });
  } catch (error) {
    apiLogger.error("Failed to update draft", { userId, draftId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update draft",
      },
      { status: 500, headers }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/integrations/gmail/drafts/[id] - Delete draft
// ─────────────────────────────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailDrafts
  );
  if (rateLimitResponse) return rateLimitResponse;

  // CSRF protection - critical for deleting drafts
  const csrfError = await withCsrfProtection(request, undefined, headers);
  if (csrfError) return csrfError;

  // Capture variables before try block for error logging
  let userId: string | undefined;
  let draftId: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    userId = session.user.id;
    const resolvedParams = await params;
    draftId = resolvedParams.id;

    // Get valid access token
    const accessToken = await getValidAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Gmail not connected or token expired" },
        { status: 401, headers }
      );
    }

    // Create client and delete draft
    const client = createGmailClient(accessToken, userId);
    await deleteDraft(client, draftId);

    return NextResponse.json({ success: true }, { headers });
  } catch (error) {
    apiLogger.error("Failed to delete draft", { userId, draftId }, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete draft",
      },
      { status: 500, headers }
    );
  }
}
