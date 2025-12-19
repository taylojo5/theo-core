import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

/**
 * NextAuth.js v5 configuration
 * @see https://authjs.dev/getting-started/installation
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          // Request offline access for refresh tokens
          access_type: "offline",
          prompt: "consent",
          // Basic profile scopes for authentication
          scope: "openid email profile",
        },
      },
    }),
  ],

  // Use JWT strategy for sessions (works better with Edge runtime)
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/login",
    error: "/login", // Redirect to login page on error
  },

  callbacks: {
    /**
     * JWT callback - runs when JWT is created or updated
     */
    async jwt({ token, user, account }) {
      // Initial sign in - add user ID and account info to token
      if (user) {
        token.id = user.id;
      }
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at;
      }
      return token;
    },

    /**
     * Session callback - runs when session is checked
     * Exposes user ID to client-side session
     */
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },

    /**
     * Authorized callback - runs on every request to check if user is allowed
     */
    authorized({ auth: session, request }) {
      const isLoggedIn = !!session?.user;
      const isOnDashboard = request.nextUrl.pathname.startsWith("/chat");
      const isOnSettings = request.nextUrl.pathname.startsWith("/settings");
      const isProtected = isOnDashboard || isOnSettings;

      if (isProtected) {
        return isLoggedIn; // Redirect to login if not logged in
      }

      return true; // Allow access to public pages
    },
  },

  // Enable debug mode in development
  debug: process.env.NODE_ENV === "development",

  // Trust the host header (required for some deployments)
  trustHost: true,
});

/**
 * Helper to get the current session on the server
 * Use this in Server Components and Server Actions
 */
export { auth as getServerSession };

/**
 * Helper type for session user with ID
 */
export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

