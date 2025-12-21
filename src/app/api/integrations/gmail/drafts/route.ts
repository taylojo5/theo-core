// ═══════════════════════════════════════════════════════════════════════════
// Gmail Drafts API
// Create, list, and manage email drafts
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createGmailClient } from "@/integrations/gmail";
import {
  createDraft,
  listDrafts,
  validateComposeParams,
} from "@/integrations/gmail/actions";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Validation Schema
// ─────────────────────────────────────────────────────────────

const CreateDraftSchema = z.object({
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
// GET /api/integrations/gmail/drafts - List drafts
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get pagination params
    const searchParams = request.nextUrl.searchParams;
    const maxResults = parseInt(searchParams.get("maxResults") || "50", 10);
    const pageToken = searchParams.get("pageToken") || undefined;

    // Get valid access token
    const accessToken = await getValidAccessToken(session.user.id);
    if (!accessToken) {
      return NextResponse.json(
        { error: "Gmail not connected or token expired" },
        { status: 401 }
      );
    }

    // Create client and list drafts
    const client = createGmailClient(accessToken, session.user.id);
    const result = await listDrafts(client, { maxResults, pageToken });

    return NextResponse.json({
      drafts: result.drafts,
      nextPageToken: result.nextPageToken,
    });
  } catch (error) {
    console.error("[Drafts API] List error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to list drafts",
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/gmail/drafts - Create draft
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate body
    const body = await request.json();
    const parseResult = CreateDraftSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parseResult.error.errors,
        },
        { status: 400 }
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

    // Create client and draft
    const client = createGmailClient(accessToken, session.user.id);
    const result = await createDraft(client, params);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("[Drafts API] Create error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to create draft",
      },
      { status: 500 }
    );
  }
}
