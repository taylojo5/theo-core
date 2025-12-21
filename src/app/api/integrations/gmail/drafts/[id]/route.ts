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
import { getValidAccessToken } from "@/lib/auth/token-refresh";
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: draftId } = await params;

    // Get valid access token
    const accessToken = await getValidAccessToken(session.user.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Gmail not connected or token expired" },
        { status: 401 }
      );
    }

    // Create client and get draft
    const client = createGmailClient(accessToken, session.user.id);
    const draft = await getDraft(client, draftId);

    return NextResponse.json(draft);
  } catch (error) {
    console.error("[Drafts API] Get error:", error);

    // Check if it's a not found error
    const errorMessage =
      error instanceof Error ? error.message : "Failed to get draft";
    const status =
      errorMessage.includes("not found") || errorMessage.includes("404")
        ? 404
        : 500;

    return NextResponse.json({ error: errorMessage }, { status });
  }
}

// ─────────────────────────────────────────────────────────────
// PUT /api/integrations/gmail/drafts/[id] - Update draft
// ─────────────────────────────────────────────────────────────

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: draftId } = await params;

    // Parse and validate body
    const body = await request.json();
    const parseResult = UpdateDraftSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.errors,
        },
        { status: 400 }
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
        { status: 400 }
      );
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(session.user.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Gmail not connected or token expired" },
        { status: 401 }
      );
    }

    // Create client and update draft
    const client = createGmailClient(accessToken, session.user.id);
    const result = await updateDraft(client, draftId, updateParams);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Drafts API] Update error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to update draft",
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/integrations/gmail/drafts/[id] - Delete draft
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

    const { id: draftId } = await params;

    // Get valid access token
    const accessToken = await getValidAccessToken(session.user.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Gmail not connected or token expired" },
        { status: 401 }
      );
    }

    // Create client and delete draft
    const client = createGmailClient(accessToken, session.user.id);
    await deleteDraft(client, draftId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Drafts API] Delete error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to delete draft",
      },
      { status: 500 }
    );
  }
}
