// ═══════════════════════════════════════════════════════════════════════════
// Calendar Connect API
// POST /api/integrations/calendar/connect - Initiate Calendar connection
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkCalendarScopes } from "@/lib/auth/scope-upgrade";
import { ALL_CALENDAR_SCOPES, formatScopes, BASE_SCOPES } from "@/lib/auth/scopes";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";
import { calendarLogger } from "@/integrations/calendar/logger";
import {
  getCalendarQueue,
  startRecurringSync,
  scheduleIncrementalSync,
  hasRecurringSyncActive,
} from "@/integrations/calendar/sync";

const logger = calendarLogger.child("api.connect");

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
// POST /api/integrations/calendar/connect
// ─────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest
): Promise<NextResponse<ConnectResponse>> {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarConnect
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

  // Check current Calendar scope status
  const scopeCheck = await checkCalendarScopes(userId);

  // If already connected with write access and not forcing, ensure sync is running
  if (scopeCheck.hasRequiredScopes && !body.force) {
    // Ensure recurring sync is running for this user
    try {
      const queue = getCalendarQueue();
      const hasRecurring = await hasRecurringSyncActive(queue, userId);
      
      if (!hasRecurring) {
        // Start recurring sync for this user
        await startRecurringSync(queue, userId);
        // Trigger an immediate sync to get the latest events
        await scheduleIncrementalSync(queue, userId);
        logger.info("Started auto-sync for returning user", { userId });
      }
    } catch (error) {
      // Log but don't fail the request if sync scheduling fails
      logger.error("Failed to start auto-sync", { userId }, error);
    }

    logger.info("Calendar already connected", { userId });

    return NextResponse.json(
      {
        success: true,
        alreadyConnected: true,
        message: "Calendar is already connected with all required permissions",
      },
      { headers }
    );
  }

  // Check if user has any Calendar-specific scopes already
  const hasAnyCalendarScopes = scopeCheck.grantedScopes.some((scope) =>
    ALL_CALENDAR_SCOPES.includes(scope as (typeof ALL_CALENDAR_SCOPES)[number])
  );

  // Build the full scope string including base scopes
  const allScopes = [...BASE_SCOPES, ...ALL_CALENDAR_SCOPES];
  const scopeString = formatScopes(allScopes);

  logger.info("Initiating Calendar connection", {
    userId,
    hasAnyCalendarScopes,
    missingScopes: scopeCheck.missingScopes,
  });

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
      callbackUrl: body.redirectUrl || "/settings/integrations/calendar",
      message: hasAnyCalendarScopes
        ? "Additional permissions required for Calendar"
        : "Authorization required to connect Calendar",
    },
    { headers }
  );
}

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/calendar/connect
// Returns connection status
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<
  NextResponse<{
    connected: boolean;
    hasRequiredScopes: boolean;
    canRead: boolean;
    canWrite: boolean;
    missingScopes: string[];
  }>
> {
  // Apply rate limiting
  const { response: rateLimitResponse, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.calendarConnect
  );
  if (rateLimitResponse)
    return rateLimitResponse as NextResponse<{
      connected: boolean;
      hasRequiredScopes: boolean;
      canRead: boolean;
      canWrite: boolean;
      missingScopes: string[];
    }>;

  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json(
      {
        connected: false,
        hasRequiredScopes: false,
        canRead: false,
        canWrite: false,
        missingScopes: [...ALL_CALENDAR_SCOPES],
      },
      { status: 401, headers }
    );
  }

  const scopeCheck = await checkCalendarScopes(session.user.id);

  return NextResponse.json(
    {
      connected: scopeCheck.canRead,
      hasRequiredScopes: scopeCheck.hasRequiredScopes,
      canRead: scopeCheck.canRead,
      canWrite: scopeCheck.canWrite,
      missingScopes: scopeCheck.missingScopes,
    },
    { headers }
  );
}

