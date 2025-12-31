import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";
import {
  formatScopes,
  SCOPE_SETS,
  ALL_GMAIL_SCOPES,
  hasAllScopes,
  parseScopes,
} from "./scopes";

// Re-export scope utilities (Edge-compatible, no crypto)
export * from "./scopes";

// NOTE: The following are NOT re-exported to keep this module Edge-compatible:
// - "./scope-upgrade" - Uses crypto for token encryption
// - "./token-refresh" - Uses crypto for token decryption
// Import these directly from their respective modules when needed in server-only code.

/**
 * Get the OAuth scopes to request based on configuration
 * Uses GMAIL_OAUTH_SCOPES env var to control scope level:
 * - "basic" (default): Only basic auth scopes
 * - "gmail-readonly": Gmail read + contacts
 * - "gmail-full": Full Gmail + contacts (read, send, manage)
 */
function getConfiguredScopes(): string {
  const scopeLevel = process.env.GMAIL_OAUTH_SCOPES || "basic";

  switch (scopeLevel) {
    case "gmail-full":
      return formatScopes(SCOPE_SETS.gmailFull);
    case "gmail-readonly":
      return formatScopes(SCOPE_SETS.gmailReadOnly);
    case "basic":
    default:
      return formatScopes(SCOPE_SETS.basic);
  }
}

/**
 * Encrypt a token if running in Node.js environment
 * Returns the original token if crypto is not available (Edge runtime)
 */
async function encryptToken(
  token: string | undefined
): Promise<string | undefined> {
  if (!token) return undefined;

  // Only encrypt in Node.js runtime (not Edge)
  // Use NEXT_RUNTIME check which is Edge-compatible
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const { encrypt } = await import("@/lib/crypto");
      return encrypt(token);
    } catch {
      // Crypto not available, return as-is
      return token;
    }
  }
  return token;
}

/**
 * NextAuth.js v5 configuration
 * @see https://authjs.dev/getting-started/installation
 *
 * Note: Token encryption is handled via the linkAccount event to maintain
 * Edge Runtime compatibility for the auth middleware.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  // Use standard PrismaAdapter - encryption is handled in linkAccount event
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
          // Scopes based on configuration
          scope: getConfiguredScopes(),
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

        // Update account scopes in database when user re-authenticates
        // This is necessary because linkAccount event only fires for NEW accounts,
        // not when an existing user re-authenticates with additional scopes
        if (account.scope && user?.id) {
          try {
            // Encrypt tokens and update account with new scopes
            const encryptedAccessToken = await encryptToken(
              account.access_token
            );
            const encryptedRefreshToken = await encryptToken(
              account.refresh_token
            );
            const encryptedIdToken = await encryptToken(account.id_token);

            await db.account.updateMany({
              where: {
                userId: user.id,
                provider: account.provider,
                providerAccountId: account.providerAccountId,
              },
              data: {
                access_token: encryptedAccessToken,
                refresh_token: encryptedRefreshToken,
                id_token: encryptedIdToken,
                scope: account.scope,
                expires_at: account.expires_at,
              },
            });

            console.log(
              `[Auth] Updated account scopes for user ${user.id}: ${account.scope}`
            );
          } catch (error) {
            console.error("[Auth] Failed to update account scopes:", error);
          }
        }
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
     * This runs in Edge runtime for middleware
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

  // Events to respond to authentication lifecycle
  events: {
    /**
     * Called when an account is linked or updated
     * This runs in Node.js runtime, so we can safely use crypto
     */
    async linkAccount({ user, account }) {
      // Encrypt tokens before they're stored
      // This runs server-side only, not in Edge
      if (account.access_token || account.refresh_token || account.id_token) {
        try {
          const encryptedAccessToken = await encryptToken(account.access_token);
          const encryptedRefreshToken = await encryptToken(
            account.refresh_token
          );
          const encryptedIdToken = await encryptToken(account.id_token);

          // Update the account with encrypted tokens
          await db.account.updateMany({
            where: {
              userId: user.id,
              provider: account.provider,
              providerAccountId: account.providerAccountId,
            },
            data: {
              access_token: encryptedAccessToken,
              refresh_token: encryptedRefreshToken,
              id_token: encryptedIdToken,
            },
          });
        } catch (error) {
          console.error("[Auth] Failed to encrypt tokens:", error);
        }
      }

      // Check if Gmail scopes were granted
      // Note: We don't trigger sync here to avoid bundling Gmail sync code in Edge runtime.
      // The sync is triggered via the /api/integrations/gmail/sync endpoint after redirect.
      if (account.provider === "google" && account.scope && user.id) {
        const grantedScopes = parseScopes(account.scope);
        const hasGmailScopes = hasAllScopes(grantedScopes, ALL_GMAIL_SCOPES);

        if (hasGmailScopes) {
          console.log(
            `[Auth] Gmail scopes granted for user ${user.id}. Sync should be triggered via API.`
          );
        }
      }
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
