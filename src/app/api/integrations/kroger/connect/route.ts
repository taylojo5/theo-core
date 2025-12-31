import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getKrogerAuthorizationUrl } from "@/integrations/kroger/auth/oauth";
import { cacheSet } from "@/lib/redis/cache";
import { KROGER_STATE_CACHE_PREFIX, KROGER_STATE_CACHE_TTL } from "@/integrations/kroger/constants";

// ─────────────────────────────────────────────────────────────
// GET /api/integrations/kroger/connect - Initiate Kroger OAuth connection flow
// ─────────────────────────────────────────────────────────────
export async function GET(): Promise<NextResponse> {
  // Get the user ID from the request auth context
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // Generate a state for CSRF protection
  const state = crypto.randomUUID();

  // Store the state in the Redis cache
  const success = await cacheSet(`${KROGER_STATE_CACHE_PREFIX}${state}`, {
    userId,
    returnUrl: "/settings/integrations/kroger?oauth=success",
    state,
    createdAt: new Date().getTime(),
  }, { ttlSeconds: KROGER_STATE_CACHE_TTL });

  if (!success) {
    return NextResponse.json(
      { error: "Failed to store state in Redis cache" },
      { status: 500 }
    );
  }

  console.log(`[Kroger] State stored in Redis cache: ${success}. Key: ${KROGER_STATE_CACHE_PREFIX}${state}`);

  // Get the authorization URL
  const authorizationUrl = await getKrogerAuthorizationUrl(state);

  // Redirect to the authorization URL
  return NextResponse.redirect(authorizationUrl);
}