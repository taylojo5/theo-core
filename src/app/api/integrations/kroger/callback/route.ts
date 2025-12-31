import { storeKrogerTokenSet } from "@/integrations/kroger/auth/connection";
import { exchangeKrogerCodeForTokenSet } from "@/integrations/kroger/auth/oauth";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { applyRateLimit } from "@/lib/rate-limit/middleware";
import { NextRequest, NextResponse } from "next/server";
import { cacheDelete, cacheGet } from "@/lib/redis/cache";
import { KROGER_STATE_CACHE_PREFIX, KROGER_STATE_CACHE_TTL } from "@/integrations/kroger/constants";

// ─────────────────────────────────────────────────────────────
// POST /api/integrations/kroger/callback - Handle Kroger callback
// ─────────────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // Apply rate limiting
  const { response: rateLimitResponse } = await applyRateLimit(
    request,
    RATE_LIMITS.krogerCallback
  );
  if (rateLimitResponse) return rateLimitResponse;

  // Parse the query parameters
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing code or state" },
      { status: 400 }
    );
  }

  console.log(`[Kroger] Code: ${code}. State: ${state}`);

  // Get the user ID from the Redis state cache
  const stateData = await cacheGet<{
    userId: string;
    returnUrl: string;
    state: string;
    createdAt: number;
  }>(`${KROGER_STATE_CACHE_PREFIX}${state}`);

  console.log(`[Kroger] State data key: ${KROGER_STATE_CACHE_PREFIX}${state}`);
  console.log(`[Kroger] State data: ${JSON.stringify(stateData)}`);

  if (!stateData) {
    return NextResponse.json(
      { error: "Invalid or expired state" },
      { status: 403 }
    );
  }

  if (String(stateData.state) !== state) {
    return NextResponse.json(
      { error: "Invalid or expired state" },
      { status: 403 }
    );
  }

  if ((stateData.createdAt + KROGER_STATE_CACHE_TTL) < new Date().getTime()) {
    return NextResponse.json(
      { error: "Invalid or expired state timeout" },
      { status: 403 }
    );
  }

  // Delete the state from the Redis cache
  await cacheDelete(`${KROGER_STATE_CACHE_PREFIX}${state}`);

  const { userId, returnUrl } = stateData;

  // Exchange the code for a token
  const tokenSet = await exchangeKrogerCodeForTokenSet(code);

  // Store the token set
  await storeKrogerTokenSet(userId, tokenSet);

  // Redirect to the success page
  return NextResponse.redirect(new URL(returnUrl, request.url));
}
