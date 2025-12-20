// ═══════════════════════════════════════════════════════════════════════════
// Gmail Contact Sync API
// POST /api/integrations/gmail/sync/contacts - Trigger contact sync
// GET /api/integrations/gmail/sync/contacts - Get contact sync status
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getValidAccessToken } from "@/lib/auth/token-refresh";
import { hasContactsAccess } from "@/lib/auth/scopes";
import { checkGmailScopes } from "@/lib/auth/scope-upgrade";
import {
  syncContacts,
  getContactSyncStatus,
  type ContactSyncOptions,
} from "@/integrations/gmail/sync";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface SyncContactsRequest {
  /** Maximum contacts to sync (default: 1000) */
  maxContacts?: number;
  /** Only sync contacts with email addresses (default: true) */
  requireEmail?: boolean;
  /** Force update even if no changes (default: false) */
  forceUpdate?: boolean;
}

interface SyncContactsResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    created: number;
    updated: number;
    unchanged: number;
    skipped: number;
    total: number;
    errors: number;
    durationMs: number;
  };
}

interface ContactSyncStatusResponse {
  contactCount: number;
  lastSyncAt: string | null;
  status: string;
  hasContactsAccess: boolean;
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/gmail/sync/contacts
// Trigger a contact sync
// ─────────────────────────────────────────────────────────────

export async function POST(
  request: Request
): Promise<NextResponse<SyncContactsResponse>> {
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

  // Parse request body
  let body: SyncContactsRequest = {};
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // Empty body is fine
  }

  // Check if user has contacts access
  const scopeCheck = await checkGmailScopes(userId);
  const hasAccess = hasContactsAccess(scopeCheck.grantedScopes);

  if (!hasAccess) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Missing contacts access. Please reconnect Gmail with contacts permission.",
      },
      { status: 403 }
    );
  }

  // Get a valid access token
  const accessToken = await getValidAccessToken(userId);

  if (!accessToken) {
    return NextResponse.json(
      {
        success: false,
        error: "Unable to get valid access token. Please reconnect Gmail.",
      },
      { status: 401 }
    );
  }

  // Build sync options
  const options: ContactSyncOptions = {};
  if (body.maxContacts !== undefined) {
    options.maxContacts = body.maxContacts;
  }
  if (body.requireEmail !== undefined) {
    options.requireEmail = body.requireEmail;
  }
  if (body.forceUpdate !== undefined) {
    options.forceUpdate = body.forceUpdate;
  }

  try {
    // Run contact sync
    const result = await syncContacts(userId, accessToken, options, {
      userId,
      sessionId: undefined,
      conversationId: undefined,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${result.total} contacts`,
      data: {
        created: result.created,
        updated: result.updated,
        unchanged: result.unchanged,
        skipped: result.skipped,
        total: result.total,
        errors: result.errors.length,
        durationMs: result.durationMs,
      },
    });
  } catch (error) {
    console.error("[ContactSync] Sync failed:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        error: `Contact sync failed: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/gmail/sync/contacts
// Get contact sync status
// ─────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<ContactSyncStatusResponse>> {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        contactCount: 0,
        lastSyncAt: null,
        status: "unknown",
        hasContactsAccess: false,
      },
      { status: 401 }
    );
  }

  const userId = session.user.id;

  // Check if user has contacts access
  const scopeCheck = await checkGmailScopes(userId);
  const hasAccess = hasContactsAccess(scopeCheck.grantedScopes);

  // Get sync status
  const status = await getContactSyncStatus(userId);

  return NextResponse.json({
    contactCount: status.contactCount,
    lastSyncAt: status.lastSyncAt?.toISOString() ?? null,
    status: status.status,
    hasContactsAccess: hasAccess,
  });
}
