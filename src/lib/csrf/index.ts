// ═══════════════════════════════════════════════════════════════════════════
// CSRF Protection
// Double-submit cookie pattern for protecting state-changing actions
// ═══════════════════════════════════════════════════════════════════════════

import { createHmac, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";
const CSRF_BODY_FIELD = "_csrf";
const TOKEN_LENGTH = 32;
const TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─────────────────────────────────────────────────────────────
// Token Generation
// ─────────────────────────────────────────────────────────────

/**
 * Get the secret for signing CSRF tokens
 */
function getSecret(): string {
  const secret = process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("CSRF_SECRET or NEXTAUTH_SECRET must be set");
  }
  return secret;
}

/**
 * Generate a signed CSRF token
 * Token format: <random>.<timestamp>.<signature>
 */
export function generateCsrfToken(): string {
  const random = randomBytes(TOKEN_LENGTH).toString("hex");
  const timestamp = Date.now().toString();
  const signature = createHmac("sha256", getSecret())
    .update(`${random}.${timestamp}`)
    .digest("hex")
    .slice(0, 16);

  return `${random}.${timestamp}.${signature}`;
}

/**
 * Verify a CSRF token signature and expiry
 */
export function verifyCsrfToken(token: string): boolean {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [random, timestamp, signature] = parts;

  // Check expiry
  const tokenTime = parseInt(timestamp, 10);
  if (isNaN(tokenTime) || Date.now() - tokenTime > TOKEN_EXPIRY_MS) {
    return false;
  }

  // Verify signature
  const expectedSignature = createHmac("sha256", getSecret())
    .update(`${random}.${timestamp}`)
    .digest("hex")
    .slice(0, 16);

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) return false;

  let result = 0;
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }

  return result === 0;
}

// ─────────────────────────────────────────────────────────────
// Cookie Management
// ─────────────────────────────────────────────────────────────

/**
 * Get or create CSRF token from cookies
 * Should be called in Server Components or API routes
 */
export async function getCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  let token = cookieStore.get(CSRF_COOKIE_NAME)?.value;

  // If no token or invalid, generate new one
  if (!token || !verifyCsrfToken(token)) {
    token = generateCsrfToken();
    // Note: Setting cookies in this context requires the response to be sent
    // The middleware will handle setting the cookie
  }

  return token;
}

/**
 * Set CSRF cookie on response
 */
export function setCsrfCookie(response: NextResponse, token: string): void {
  response.cookies.set(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TOKEN_EXPIRY_MS / 1000, // 24 hours in seconds
  });
}

// ─────────────────────────────────────────────────────────────
// Validation Middleware
// ─────────────────────────────────────────────────────────────

/**
 * Extract CSRF token from request (header or body)
 */
function extractCsrfToken(request: NextRequest, body?: unknown): string | null {
  // Check header first
  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (headerToken) return headerToken;

  // Check body field
  if (body && typeof body === "object" && CSRF_BODY_FIELD in body) {
    return (body as Record<string, unknown>)[CSRF_BODY_FIELD] as string;
  }

  return null;
}

/**
 * Validate CSRF token for a request
 * Compares cookie token with header/body token
 */
export async function validateCsrf(
  request: NextRequest,
  body?: unknown
): Promise<{ valid: boolean; error?: string }> {
  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
  if (!cookieToken) {
    return { valid: false, error: "Missing CSRF cookie" };
  }

  // Verify cookie token is valid (not expired, properly signed)
  if (!verifyCsrfToken(cookieToken)) {
    return { valid: false, error: "CSRF token expired or invalid" };
  }

  // Get token from header or body
  const requestToken = extractCsrfToken(request, body);
  if (!requestToken) {
    return { valid: false, error: "Missing CSRF token in request" };
  }

  // Compare tokens
  if (cookieToken !== requestToken) {
    return { valid: false, error: "CSRF token mismatch" };
  }

  return { valid: true };
}

/**
 * CSRF protection middleware for API routes
 * Use this in routes that modify state
 * @param request - The incoming request
 * @param body - Optional parsed body for CSRF token extraction
 * @param headers - Optional rate limit headers to include in error responses
 */
export async function withCsrfProtection(
  request: NextRequest,
  body?: unknown,
  headers?: HeadersInit
): Promise<NextResponse | null> {
  // Skip CSRF check for safe methods
  const method = request.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(method)) {
    return null;
  }

  const result = await validateCsrf(request, body);

  if (!result.valid) {
    return NextResponse.json(
      {
        error: {
          code: "CSRF_VALIDATION_FAILED",
          message: result.error || "CSRF validation failed",
        },
      },
      { status: 403, headers }
    );
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface CsrfToken {
  token: string;
  cookieName: typeof CSRF_COOKIE_NAME;
  headerName: typeof CSRF_HEADER_NAME;
}

/**
 * Get CSRF token and metadata for client use
 */
export async function getCsrfTokenResponse(): Promise<CsrfToken> {
  const token = await getCsrfToken();
  return {
    token,
    cookieName: CSRF_COOKIE_NAME,
    headerName: CSRF_HEADER_NAME,
  };
}
