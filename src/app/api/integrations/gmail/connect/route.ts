// ═══════════════════════════════════════════════════════════════════════════
// Gmail Connect API
// POST /api/integrations/gmail/connect - Initiate Gmail connection
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkGmailScopes, generateUpgradeUrl } from "@/lib/auth/scope-upgrade";
import { ALL_GMAIL_SCOPES } from "@/lib/auth/scopes";

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
  authUrl?: string;
  message?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/gmail/connect
// ─────────────────────────────────────────────────────────────

export async function POST(
  request: Request
): Promise<NextResponse<ConnectResponse>> {
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

  // If already connected and not forcing, return early
  if (scopeCheck.hasRequiredScopes && !body.force) {
    return NextResponse.json({
      success: true,
      alreadyConnected: true,
      message: "Gmail is already connected with all required permissions",
    });
  }

  // Generate state parameter for OAuth flow
  // This encodes the user ID and optional redirect URL
  const state = Buffer.from(
    JSON.stringify({
      userId,
      redirectUrl: body.redirectUrl || "/settings/integrations/gmail",
      action: "gmail-connect",
      timestamp: Date.now(),
    })
  ).toString("base64url");

  // Generate OAuth URL with Gmail scopes
  const authUrl = generateUpgradeUrl(ALL_GMAIL_SCOPES, state);

  // Check if user has any Gmail-specific scopes already
  // (not just base scopes like openid, email, profile)
  const hasAnyGmailScopes = scopeCheck.grantedScopes.some((scope) =>
    ALL_GMAIL_SCOPES.includes(scope as (typeof ALL_GMAIL_SCOPES)[number])
  );

  return NextResponse.json({
    success: true,
    authUrl,
    message: hasAnyGmailScopes
      ? "Additional permissions required for Gmail"
      : "Authorization required to connect Gmail",
  });
}

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/gmail/connect
// Returns connection status and upgrade URL if needed
// ─────────────────────────────────────────────────────────────

export async function GET(): Promise<
  NextResponse<{
    connected: boolean;
    hasRequiredScopes: boolean;
    missingScopes: string[];
    upgradeUrl?: string;
  }>
> {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        connected: false,
        hasRequiredScopes: false,
        missingScopes: [...ALL_GMAIL_SCOPES],
      },
      { status: 401 }
    );
  }

  const scopeCheck = await checkGmailScopes(session.user.id);

  return NextResponse.json({
    connected: scopeCheck.hasRequiredScopes,
    hasRequiredScopes: scopeCheck.hasRequiredScopes,
    missingScopes: scopeCheck.missingScopes,
    upgradeUrl: scopeCheck.upgradeUrl,
  });
}
