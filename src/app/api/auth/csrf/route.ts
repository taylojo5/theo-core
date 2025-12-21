// ═══════════════════════════════════════════════════════════════════════════
// CSRF Token API
// GET /api/auth/csrf - Get a CSRF token for the current session
// ═══════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { generateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { auth } from "@/lib/auth";

/**
 * GET /api/auth/csrf
 * Returns a CSRF token for authenticated users
 * Sets the token as an HttpOnly cookie and returns metadata
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate a new CSRF token
  const token = generateCsrfToken();

  // Create response with the token
  const response = NextResponse.json({
    token,
    headerName: "x-csrf-token",
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });

  // Set the CSRF cookie
  setCsrfCookie(response, token);

  return response;
}
