import { auth } from "@/lib/auth";

/**
 * NextAuth.js Middleware
 * Protects routes and handles authentication redirects
 *
 * Protected routes:
 * - /chat/* - Chat interface
 * - /settings/* - User settings
 *
 * Public routes:
 * - / - Landing page
 * - /login - Sign in page
 * - /api/* - API routes (handled by their own auth)
 */
export default auth;

export const config = {
  /*
   * Match all routes except:
   * - _next/static (static files)
   * - _next/image (image optimization)
   * - favicon.ico (favicon)
   * - public folder files
   * - API routes (they handle their own auth)
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

