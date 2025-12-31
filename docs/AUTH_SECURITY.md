# Authentication & Security Documentation

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [DATA_LAYER.md](./DATA_LAYER.md), [RATE_LIMITING.md](./RATE_LIMITING.md)

---

## Overview

Theo uses **NextAuth.js v5** (Auth.js) for authentication with a JWT session strategy. The system supports Google OAuth for authentication and integrations, with automatic token refresh for long-lived access.

---

## Technology Stack

| Component        | Technology           | Purpose                         |
| ---------------- | -------------------- | ------------------------------- |
| Authentication   | NextAuth.js v5       | OAuth flows, session management |
| Database Adapter | @auth/prisma-adapter | User/account storage            |
| Session Strategy | JWT                  | Edge-compatible sessions        |
| OAuth Provider   | Google               | Primary authentication          |
| Token Management | Custom refresh logic | Long-lived integration access   |

---

## Quick Start

### Environment Configuration

```env
# .env.local

# NextAuth Configuration
AUTH_SECRET="your-secret-key-here"  # Generate with: openssl rand -base64 32

# Google OAuth (required)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Trust host (for production deployments)
AUTH_TRUST_HOST=true
```

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Navigate to **APIs & Services** → **Credentials**
4. Create **OAuth 2.0 Client ID**
5. Configure authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://your-domain.com/api/auth/callback/google`

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     AUTHENTICATION FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌───────────┐    ┌──────────┐    ┌──────────┐ │
│  │  Client  │───▶│ Middleware│───▶│ NextAuth │───▶│  Google  │ │
│  └──────────┘    └───────────┘    └──────────┘    └──────────┘ │
│       │                                                 │        │
│       │                                                 │        │
│       ▼                                                 ▼        │
│  ┌──────────┐                                   ┌──────────┐    │
│  │  JWT     │◀──────────────────────────────────│  Tokens  │    │
│  │ Session  │                                   │ (OAuth)  │    │
│  └──────────┘                                   └──────────┘    │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    PRISMA DATABASE                        │   │
│  │  ┌────────┐  ┌─────────┐  ┌─────────┐  ┌────────────┐   │   │
│  │  │  User  │  │ Account │  │ Session │  │ Verification│   │   │
│  │  └────────┘  └─────────┘  └─────────┘  │    Token   │   │   │
│  │                                        └────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## NextAuth Configuration

### Core Configuration

```typescript:src/lib/auth/index.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/lib/db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(db),

  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: "offline",  // Required for refresh tokens
          prompt: "consent",       // Always show consent to get refresh token
          scope: "openid email profile",
        },
      },
    }),
  ],

  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  pages: {
    signIn: "/login",
    error: "/login",
  },

  callbacks: {
    jwt({ token, user, account }) { /* ... */ },
    session({ session, token }) { /* ... */ },
    authorized({ auth, request }) { /* ... */ },
  },

  debug: process.env.NODE_ENV === "development",
  trustHost: true,
});
```

### OAuth Scopes

Theo uses a tiered scope system for OAuth:

#### Base Scopes (Always Requested)

| Scope     | Purpose                       |
| --------- | ----------------------------- |
| `openid`  | OpenID Connect authentication |
| `email`   | User email address            |
| `profile` | User name and profile picture |

#### Gmail Integration Scopes

These are requested when the user connects Gmail integration:

| Scope                                               | Purpose              |
| --------------------------------------------------- | -------------------- |
| `https://www.googleapis.com/auth/gmail.readonly`    | Read email messages  |
| `https://www.googleapis.com/auth/gmail.send`        | Send emails          |
| `https://www.googleapis.com/auth/gmail.labels`      | Manage email labels  |
| `https://www.googleapis.com/auth/contacts.readonly` | Read user's contacts |

#### Scope Configuration

The initial OAuth scopes can be configured via environment variable:

```env
# Options: "basic", "gmail-readonly", "gmail-full"
GMAIL_OAUTH_SCOPES=basic  # Default: only basic auth scopes
```

| Setting          | Scopes Included                                |
| ---------------- | ---------------------------------------------- |
| `basic`          | openid, email, profile                         |
| `gmail-readonly` | basic + gmail.readonly, gmail.labels, contacts |
| `gmail-full`     | gmail-readonly + gmail.send                    |

**Note:** Users can upgrade their scopes later via the scope upgrade flow without re-authenticating completely.

---

## Session Management

### JWT Strategy

Theo uses JWT sessions for Edge runtime compatibility:

```typescript
session: {
  strategy: "jwt",
  maxAge: 30 * 24 * 60 * 60, // 30 days
}
```

**Why JWT over Database Sessions:**

- Edge-compatible (works with middleware)
- No database lookup on every request
- Stateless, easier to scale

### Session Data Structure

```typescript
interface Session {
  user: {
    id: string; // User ID from database
    name?: string;
    email?: string;
    image?: string;
  };
  expires: string; // ISO date string
}
```

### Type Augmentation

Extend the default session type to include user ID:

```typescript:src/types/next-auth.d.ts
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
```

---

## Callbacks

### JWT Callback

Runs when JWT is created or updated. Used to add custom data to the token:

```typescript
async jwt({ token, user, account }) {
  // Initial sign in - add user ID
  if (user) {
    token.id = user.id;
  }

  // Store OAuth tokens for integrations
  if (account) {
    token.accessToken = account.access_token;
    token.refreshToken = account.refresh_token;
    token.expiresAt = account.expires_at;
  }

  return token;
}
```

### Session Callback

Exposes token data to the client-side session:

```typescript
async session({ session, token }) {
  if (token && session.user) {
    session.user.id = token.id as string;
  }
  return session;
}
```

### Authorized Callback

Controls access to protected routes (runs in middleware):

```typescript
authorized({ auth: session, request }) {
  const isLoggedIn = !!session?.user;
  const isOnDashboard = request.nextUrl.pathname.startsWith("/chat");
  const isOnSettings = request.nextUrl.pathname.startsWith("/settings");
  const isProtected = isOnDashboard || isOnSettings;

  if (isProtected) {
    return isLoggedIn; // Redirect to login if not authenticated
  }

  return true; // Allow access to public pages
}
```

---

## Middleware

### Route Protection

The middleware protects routes and handles redirects:

```typescript:middleware.ts
import { auth } from "@/lib/auth";

export default auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

### Protected vs Public Routes

| Route Pattern | Access                 |
| ------------- | ---------------------- |
| `/`           | Public (landing page)  |
| `/login`      | Public                 |
| `/api/*`      | API auth (route-level) |
| `/chat/*`     | **Protected**          |
| `/settings/*` | **Protected**          |
| Static assets | Public                 |

---

## OAuth Token Management

### Token Storage

OAuth tokens are stored in the `Account` table:

```typescript
model Account {
  // ... other fields
  access_token   String? @db.Text
  refresh_token  String? @db.Text
  expires_at     Int?
}
```

### Token Refresh Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    TOKEN REFRESH FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. getValidAccessToken(userId)                             │
│     │                                                        │
│     ▼                                                        │
│  2. Check expires_at vs current time (with 5min buffer)     │
│     │                                                        │
│     ├─ Token valid ──────▶ Return access_token              │
│     │                                                        │
│     ▼                                                        │
│  3. Token expired → refreshGoogleToken(refresh_token)       │
│     │                                                        │
│     ▼                                                        │
│  4. Call Google OAuth token endpoint                        │
│     │                                                        │
│     ▼                                                        │
│  5. Update Account with new tokens                          │
│     │                                                        │
│     ▼                                                        │
│  6. Return new access_token                                 │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Token Refresh Implementation

```typescript:src/lib/auth/token-refresh.ts
const EXPIRY_BUFFER_SECONDS = 300; // 5 minutes

export async function getValidAccessToken(
  userId: string
): Promise<string | null> {
  const account = await db.account.findFirst({
    where: { userId, provider: "google" },
  });

  if (!account) return null;

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = account.expires_at || 0;

  // Return if still valid
  if (expiresAt > now + EXPIRY_BUFFER_SECONDS && account.access_token) {
    return account.access_token;
  }

  // Refresh if we have a refresh token
  if (!account.refresh_token) return null;

  const result = await refreshGoogleToken(account.refresh_token);

  if (result.success) {
    await db.account.update({
      where: { id: account.id },
      data: {
        access_token: result.accessToken,
        expires_at: result.expiresAt,
      },
    });
    return result.accessToken || null;
  }

  return null;
}
```

### Token Health Checking

```typescript
export async function checkTokenHealth(
  userId: string
): Promise<TokenHealthStatus> {
  const account = await db.account.findFirst({
    where: { userId, provider: "google" },
  });

  return {
    hasAccount: !!account,
    hasRefreshToken: !!account?.refresh_token,
    hasAccessToken: !!account?.access_token,
    isExpired: (account?.expires_at || 0) < Math.floor(Date.now() / 1000),
    expiresIn: /* seconds until expiry */,
    expiresInHuman: /* "2h 30m" format */,
  };
}
```

### Token Status API

```
GET /api/auth/token-status
```

Response:

```json
{
  "hasAccount": true,
  "hasRefreshToken": true,
  "hasAccessToken": true,
  "isExpired": false,
  "expiresIn": 3400,
  "expiresInHuman": "56m",
  "recommendations": []
}
```

```
POST /api/auth/token-status
```

Forces a token refresh and returns updated status.

---

## API Route Authentication

### Requiring Authentication

Use the `auth()` function in API routes:

```typescript
import { auth } from "@/lib/auth";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Proceed with authenticated request
  const userId = session.user.id;
  // ...
}
```

### Pattern: Auth + Rate Limiting

```typescript
import { auth } from "@/lib/auth";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const { response, userId, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.api
  );

  if (response) return response; // Rate limited

  // Check authentication
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Proceed...
}
```

---

## Client-Side Usage

### Session Provider

Wrap your app with the session provider:

```typescript:src/components/providers/session-provider.tsx
"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextAuthSessionProvider>
      {children}
    </NextAuthSessionProvider>
  );
}
```

### Accessing Session

```typescript
"use client";

import { useSession, signIn, signOut } from "next-auth/react";

function UserProfile() {
  const { data: session, status } = useSession();

  if (status === "loading") return <div>Loading...</div>;

  if (!session) {
    return <button onClick={() => signIn("google")}>Sign In</button>;
  }

  return (
    <div>
      <p>Welcome, {session.user.name}</p>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

### Session in Server Components

```typescript
import { auth } from "@/lib/auth";

async function ServerComponent() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return <div>Hello, {session.user.name}</div>;
}
```

---

## Security Best Practices

### 1. User Data Isolation

Always filter by `userId` in database queries:

```typescript
// ✅ Correct
const tasks = await db.task.findMany({
  where: { userId: session.user.id },
});

// ❌ Security vulnerability
const tasks = await db.task.findMany();
```

### 2. Entity Ownership Verification

Before updates/deletes, verify the user owns the entity:

```typescript
const task = await db.task.findFirst({
  where: { id: taskId, userId: session.user.id },
});

if (!task) {
  return Response.json({ error: "Not found" }, { status: 404 });
}

// Safe to update
await db.task.update({ where: { id: taskId }, data: {...} });
```

### 3. Token Security

- Store tokens in encrypted database columns (handled by Prisma adapter)
- Never expose tokens to client-side code
- Use automatic refresh to minimize token lifetime

### 4. HTTPS Enforcement

In production, ensure all traffic uses HTTPS:

```typescript
// next.config.ts
const config = {
  // Force HTTPS in production
  poweredByHeader: false,
};
```

### 5. Environment Variables

- Never commit secrets to version control
- Use different secrets for dev/staging/production
- Rotate `AUTH_SECRET` if compromised

---

## Error Handling

### Authentication Errors

| Error                     | Cause                 | Resolution              |
| ------------------------- | --------------------- | ----------------------- |
| `OAuthCallbackError`      | OAuth flow failed     | Check callback URLs     |
| `SessionTokenError`       | Invalid/expired JWT   | Clear cookies, re-login |
| `RefreshAccessTokenError` | Refresh token revoked | Re-authenticate         |

### Token Refresh Errors

```typescript
const result = await refreshGoogleToken(refreshToken);

if (!result.success) {
  // result.error contains the reason
  // Common: "invalid_grant" (token revoked)
  // Action: Prompt user to re-authenticate
}
```

---

## Testing

### Mock Authentication

For testing protected routes:

```typescript
// In tests
import { auth } from "@/lib/auth";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(() =>
    Promise.resolve({
      user: { id: "test-user-id", email: "test@example.com" },
    })
  ),
}));
```

### Token Refresh Testing

```typescript
import { checkTokenHealth, forceTokenRefresh } from "@/lib/auth/token-refresh";

describe("Token Refresh", () => {
  it("should detect expired tokens", async () => {
    const health = await checkTokenHealth("user-id");
    expect(health.isExpired).toBe(true);
  });
});
```

---

## Scope Upgrade Flow

Theo supports upgrading OAuth scopes without requiring complete re-authentication. This allows users to start with basic auth and later enable Gmail integration.

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                    SCOPE UPGRADE FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User clicks "Connect Gmail" in settings                 │
│     │                                                        │
│     ▼                                                        │
│  2. POST /api/integrations/gmail/connect                    │
│     │                                                        │
│     ▼                                                        │
│  3. Check current scopes vs required scopes                 │
│     │                                                        │
│     ├─ All scopes present ──▶ Return "already connected"    │
│     │                                                        │
│     ▼                                                        │
│  4. Generate OAuth URL with include_granted_scopes=true     │
│     │                                                        │
│     ▼                                                        │
│  5. Redirect user to Google consent screen                  │
│     │                                                        │
│     ▼                                                        │
│  6. Google callback updates Account with merged scopes      │
│     │                                                        │
│     ▼                                                        │
│  7. User redirected to Gmail settings with success          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Scope Utilities

```typescript
import { checkGmailScopes, isGmailConnected } from "@/lib/auth/scope-upgrade";
import { signIn } from "next-auth/react";
import { ALL_GMAIL_SCOPES, BASE_SCOPES, formatScopes } from "@/lib/auth/scopes";

// Check if user has Gmail scopes
const { hasRequiredScopes, missingScopes } = await checkGmailScopes(userId);

// Trigger scope upgrade using NextAuth signIn (handles PKCE properly)
if (!hasRequiredScopes) {
  const scopeString = formatScopes([...BASE_SCOPES, ...ALL_GMAIL_SCOPES]);
  signIn(
    "google",
    { callbackUrl: "/settings/integrations/gmail" },
    {
      scope: scopeString,
      prompt: "consent",
      access_type: "offline",
      include_granted_scopes: "true",
    }
  );
}

// Quick check if Gmail is connected
const connected = await isGmailConnected(userId);
```

---

## Integration Status API

### Check Integration Status

```
GET /api/integrations/status
```

Response:

```json
{
  "authenticated": true,
  "google": {
    "connected": true,
    "email": "user@example.com",
    "tokenHealth": {
      "hasRefreshToken": true,
      "isExpired": false,
      "expiresIn": 3400,
      "expiresInHuman": "56m"
    }
  },
  "gmail": {
    "connected": true,
    "canRead": true,
    "canSend": true,
    "canManageLabels": true,
    "syncStatus": "idle",
    "lastSyncAt": "2024-12-20T10:30:00Z"
  },
  "contacts": {
    "connected": true,
    "contactCount": 142
  },
  "missingScopes": [],
  "upgradeRequired": false
}
```

### Connect Gmail

```
POST /api/integrations/gmail/connect
```

Request body (optional):

```json
{
  "force": false,
  "redirectUrl": "/settings/integrations/gmail"
}
```

Response:

```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "message": "Authorization required to connect Gmail"
}
```

### Disconnect Gmail

```
DELETE /api/integrations/gmail/disconnect
```

Response:

```json
{
  "success": true,
  "message": "Gmail has been disconnected successfully"
}
```

---

## Related Documentation

- [RATE_LIMITING.md](./RATE_LIMITING.md) - Rate limiting for API protection
- [DATA_LAYER.md](./DATA_LAYER.md) - User and Account models
- [API_REFERENCE.md](./API_REFERENCE.md) - Protected API endpoints
- [services/GMAIL_SERVICE.md](./services/GMAIL_SERVICE.md) - Gmail integration details
- [NextAuth.js Docs](https://authjs.dev/) - Official documentation
