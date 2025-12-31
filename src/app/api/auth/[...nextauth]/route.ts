import { handlers } from "@/lib/auth";

/**
 * NextAuth.js API route handlers
 * Handles: GET /api/auth/* and POST /api/auth/*
 *
 * Routes handled:
 * - /api/auth/signin - Sign in page
 * - /api/auth/signout - Sign out
 * - /api/auth/callback/google - OAuth callback
 * - /api/auth/session - Get session
 * - /api/auth/csrf - CSRF token
 * - /api/auth/providers - List providers
 */
export const { GET, POST } = handlers;
