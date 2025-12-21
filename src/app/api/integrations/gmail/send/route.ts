// ═══════════════════════════════════════════════════════════════════════════
// Gmail Send API
// Send emails with approval workflow or directly
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createGmailClient } from "@/integrations/gmail";
import {
  requestApproval,
  sendEmailDirect,
  sendDraft,
  validateComposeParams,
} from "@/integrations/gmail/actions";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { withCsrfProtection } from "@/lib/csrf";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────────

const SendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1, "At least one recipient required"),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Body is required"),
  bodyHtml: z.string().optional(),
  threadId: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional(),
  // Whether to require approval (default: false for user-initiated sends)
  requireApproval: z.boolean().optional().default(false),
  // Metadata for approval
  requestedBy: z.string().optional(),
  expiresInMinutes: z.number().positive().optional(),
});

const SendDraftSchema = z.object({
  draftId: z.string().min(1, "Draft ID is required"),
});

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/gmail/send - Send email
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailSend
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

    // Parse body
    const body = await request.json();

    // CSRF protection - critical for sending emails
    const csrfError = await withCsrfProtection(request, body, headers);
    if (csrfError) return csrfError;

    // Check if sending a draft or composing new
    if (body.draftId) {
      // Sending an existing draft
      const parseResult = SendDraftSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          { error: "Validation failed", details: parseResult.error.errors },
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

      // Create client and send draft
      const client = createGmailClient(accessToken, session.user.id);
      const result = await sendDraft(
        client,
        session.user.id,
        parseResult.data.draftId
      );

      if (!result.success) {
        return NextResponse.json(
          { error: result.errorMessage || "Failed to send draft" },
          { status: 500, headers }
        );
      }

      return NextResponse.json(
        {
          success: true,
          messageId: result.messageId,
          threadId: result.threadId,
        },
        { headers }
      );
    }

    // Composing and sending new email
    const parseResult = SendEmailSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.errors },
        { status: 400, headers }
      );
    }

    const params = parseResult.data;

    // Additional validation
    const validation = validateComposeParams(params);
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Validation failed", details: validation.errors },
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

    const client = createGmailClient(accessToken, session.user.id);

    // If requiring approval, create approval request
    if (params.requireApproval) {
      const approvalResult = await requestApproval(client, session.user.id, {
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        body: params.body,
        bodyHtml: params.bodyHtml,
        threadId: params.threadId,
        inReplyTo: params.inReplyTo,
        references: params.references,
        requestedBy: params.requestedBy,
        expiresInMinutes: params.expiresInMinutes,
      });

      return NextResponse.json(
        {
          success: true,
          requiresApproval: true,
          approvalId: approvalResult.approval.id,
          draftId: approvalResult.draftId,
          expiresAt: approvalResult.approval.expiresAt,
        },
        { status: 202, headers }
      ); // 202 Accepted
    }

    // Direct send (user-initiated)
    const result = await sendEmailDirect(client, session.user.id, {
      to: params.to,
      cc: params.cc,
      bcc: params.bcc,
      subject: params.subject,
      body: params.body,
      bodyHtml: params.bodyHtml,
      threadId: params.threadId,
      inReplyTo: params.inReplyTo,
      references: params.references,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.errorMessage || "Failed to send email" },
        { status: 500, headers }
      );
    }

    return NextResponse.json(
      {
        success: true,
        messageId: result.messageId,
        threadId: result.threadId,
      },
      { headers }
    );
  } catch (error) {
    console.error("[Send API] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to send email",
      },
      { status: 500, headers }
    );
  }
}
