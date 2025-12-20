// ═══════════════════════════════════════════════════════════════════════════
// Rate Limit Middleware
// Helper functions for applying rate limits to API routes
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  checkRateLimit,
  RATE_LIMITS,
  type RateLimitConfig,
  type RateLimitResult,
} from "./index";

export { RATE_LIMITS };

/**
 * Check rate limit for a request
 * Uses user ID if authenticated, falls back to IP address
 */
export async function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ result: RateLimitResult; userId: string | null }> {
  // Get user ID for rate limiting (or IP for unauthenticated)
  const session = await auth();
  const userId = session?.user?.id ?? null;

  // Use user ID if authenticated, otherwise use IP from headers
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const key = userId || forwardedFor?.split(",")[0] || realIp || "anonymous";

  const result = checkRateLimit(key, config);

  return { result, userId };
}

/**
 * Generate rate limit headers for response
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  const headers: Record<string, string> = {
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.resetAt.toISOString(),
  };

  if (result.retryAfterMs) {
    headers["Retry-After"] = Math.ceil(result.retryAfterMs / 1000).toString();
  }

  return headers;
}

/**
 * Create a 429 response for rate limit exceeded
 */
export function rateLimitExceededResponse(result: RateLimitResult): Response {
  return Response.json(
    {
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please try again later.",
        retryAfterMs: result.retryAfterMs,
        resetAt: result.resetAt.toISOString(),
      },
    },
    {
      status: 429,
      headers: rateLimitHeaders(result),
    }
  );
}

/**
 * Apply rate limiting to a handler
 * Returns null if allowed, Response if rate limited
 */
export async function applyRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{
  response: Response | null;
  userId: string | null;
  headers: HeadersInit;
}> {
  const { result, userId } = await withRateLimit(request, config);

  if (!result.allowed) {
    return {
      response: rateLimitExceededResponse(result),
      userId,
      headers: rateLimitHeaders(result),
    };
  }

  return {
    response: null,
    userId,
    headers: rateLimitHeaders(result),
  };
}
