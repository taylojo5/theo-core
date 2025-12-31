// ═══════════════════════════════════════════════════════════════════════════
// Gmail Connect API
// POST /api/integrations/gmail/connect - Initiate Gmail connection
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkGmailScopes } from "@/lib/auth/scope-upgrade";
import { ALL_GMAIL_SCOPES, formatScopes, BASE_SCOPES } from "@/lib/auth/scopes";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import {
  startRecurringSync,
  hasRecurringSync,
  triggerMetadataSync,
  isSyncConfigured,
  hasMetadataSynced,
  triggerSync,
  apiLogger,
} from "@/integrations/gmail";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface ConnectRequest {
  /** If true, force re-consent even if already connected */
  force?: boolean;
  /** Redirect URL after successful connection */
  redirectUrl?: string;
}

interface ConnectResponse {
  success: boolean;
  alreadyConnected?: boolean;
  /** Whether sync has been configured (labels selected) */
  syncConfigured?: boolean;
  /** If true, metadata has been synced (labels + contacts) */
  metadataSynced?: boolean;
  /** If true, client should call signIn("google", ...) with authorizationParams */
  signInRequired?: boolean;
  /** Authorization params to pass to signIn() */
  authorizationParams?: {
    scope: string;
    prompt: string;
    access_type: string;
    include_granted_scopes: string;
  };
  /** Callback URL for after OAuth completes */
  callbackUrl?: string;
  message?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/gmail/connect
// ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest
): Promise<NextResponse<ConnectResponse>> {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailConnect
  );
  if (rateLimitResponse)
    return rateLimitResponse as NextResponse<ConnectResponse>;

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized",
      },
      { status: 401, headers }
    );
  }

  const userId = session.user.id;

  // Parse request body
  let body: ConnectRequest = {};
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // Empty body is fine
  }

  // Check current Gmail scope status
  const scopeCheck = await checkGmailScopes(userId);

  // If already connected and not forcing, check sync configuration status
  if (scopeCheck.hasRequiredScopes && !body.force) {
    // Check if sync is configured (user has selected labels)
    const syncIsConfigured = await isSyncConfigured(userId);
    // Check if metadata (labels + contacts) has been synced
    const metadataIsSynced = await hasMetadataSynced(userId);

    try {
      if (syncIsConfigured) {
        // Sync is configured - ensure recurring sync is running
        const hasRecurring = await hasRecurringSync(userId);
        if (!hasRecurring) {
          // Start recurring sync for this user (runs every 5 min)
          await startRecurringSync(userId);
          // Trigger an immediate sync to get the latest emails
          await triggerSync(userId);
          apiLogger.info("Started auto-sync for configured user", { userId });
        }
      } else if (!metadataIsSynced) {
        // Sync not configured and metadata not synced - trigger metadata sync
        // This lets the user configure which labels to sync
        await triggerMetadataSync(userId);
        apiLogger.info("Triggered metadata sync for new connection", {
          userId,
        });
      }
    } catch (error) {
      // Log but don't fail the request if sync scheduling fails
      apiLogger.error("Failed to setup sync", { userId }, error);
    }

    return NextResponse.json(
      {
        success: true,
        alreadyConnected: true,
        syncConfigured: syncIsConfigured,
        metadataSynced: metadataIsSynced,
        message: syncIsConfigured
          ? "Gmail is connected and syncing"
          : metadataIsSynced
            ? "Gmail connected. Please configure which labels to sync."
            : "Gmail connected. Syncing labels and contacts...",
      },
      { headers }
    );
  }

  // Check if user has any Gmail-specific scopes already
  // (not just base scopes like openid, email, profile)
  const hasAnyGmailScopes = scopeCheck.grantedScopes.some((scope) =>
    ALL_GMAIL_SCOPES.includes(scope as (typeof ALL_GMAIL_SCOPES)[number])
  );

  // Build the full scope string including base scopes
  const allScopes = [...BASE_SCOPES, ...ALL_GMAIL_SCOPES];
  const scopeString = formatScopes(allScopes);

  // Return info for client to use NextAuth's signIn() function
  // This ensures proper PKCE handling
  return NextResponse.json(
    {
      success: true,
      signInRequired: true,
      authorizationParams: {
        scope: scopeString,
        prompt: "consent",
        access_type: "offline",
        include_granted_scopes: "true",
      },
      callbackUrl: body.redirectUrl || "/settings/integrations/gmail",
      message: hasAnyGmailScopes
        ? "Additional permissions required for Gmail"
        : "Authorization required to connect Gmail",
    },
    { headers }
  );
}

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/gmail/connect
// Returns connection status
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<
  NextResponse<{
    connected: boolean;
    hasRequiredScopes: boolean;
    missingScopes: string[];
  }>
> {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.gmailConnect
  );
  if (rateLimitResponse)
    return rateLimitResponse as NextResponse<{
      connected: boolean;
      hasRequiredScopes: boolean;
      missingScopes: string[];
    }>;

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        connected: false,
        hasRequiredScopes: false,
        missingScopes: [...ALL_GMAIL_SCOPES],
      },
      { status: 401, headers }
    );
  }

  const scopeCheck = await checkGmailScopes(session.user.id);

  return NextResponse.json(
    {
      connected: scopeCheck.hasRequiredScopes,
      hasRequiredScopes: scopeCheck.hasRequiredScopes,
      missingScopes: scopeCheck.missingScopes,
    },
    { headers }
  );
}
