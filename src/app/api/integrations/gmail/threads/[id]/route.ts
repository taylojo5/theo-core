// ═══════════════════════════════════════════════════════════════════════════
// Gmail Thread API
// GET /api/integrations/gmail/threads/[id] - Get emails in a thread
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { emailRepository, apiLogger } from "@/integrations/gmail";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ThreadEmail {
  id: string;
  gmailId: string;
  subject: string | null;
  fromAddress: string;
  fromName: string | null;
  toAddresses: string[];
  ccAddresses: string[];
  bodyText: string | null;
  bodyHtml: string | null;
  internalDate: string;
  isRead: boolean;
  isStarred: boolean;
  hasAttachments: boolean;
  labelIds: string[];
}

interface ThreadResponse {
  threadId: string;
  emails: ThreadEmail[];
  emailCount: number;
}

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/gmail/threads/[id]
// ─────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<ThreadResponse | { error: string }>> {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailSync
  );
  if (rateLimitResponse)
    return rateLimitResponse as NextResponse<
      ThreadResponse | { error: string }
    >;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers }
      );
    }

    const { id: threadId } = await params;

    // Get all emails in the thread
    const emails = await emailRepository.findByThread(
      session.user.id,
      threadId
    );

    if (emails.length === 0) {
      return NextResponse.json(
        { error: "Thread not found" },
        { status: 404, headers }
      );
    }

    // Map to response format
    const threadEmails: ThreadEmail[] = emails.map((email) => ({
      id: email.id,
      gmailId: email.gmailId,
      subject: email.subject,
      fromAddress: email.fromAddress,
      fromName: email.fromName,
      toAddresses: email.toAddresses,
      ccAddresses: email.ccAddresses,
      bodyText: email.bodyText,
      bodyHtml: email.bodyHtml,
      internalDate: email.internalDate.toISOString(),
      isRead: email.isRead,
      isStarred: email.isStarred,
      hasAttachments: email.hasAttachments,
      labelIds: email.labelIds,
    }));

    return NextResponse.json(
      {
        threadId,
        emails: threadEmails,
        emailCount: emails.length,
      },
      { headers }
    );
  } catch (error) {
    apiLogger.error("Failed to get thread", {}, error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to get thread",
      },
      { status: 500, headers }
    );
  }
}
