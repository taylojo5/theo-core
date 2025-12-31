# Web Traffic Flow Diagrams

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [AUTH_SECURITY.md](./AUTH_SECURITY.md), [INTEGRATIONS.md](./INTEGRATIONS.md)

---

This document contains swimlane diagrams showing web traffic flows for authentication and integration connections.

---

## 1. OAuth Sign-In Flow

The primary authentication flow using Google OAuth via NextAuth.js.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                           OAUTH SIGN-IN FLOW                                                                                │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                                             │
│    Browser                    Next.js App                 NextAuth.js                    Google OAuth                  Database              │
│       │                           │                            │                              │                           │                 │
│       │ (1) Click "Sign In        │                            │                              │                           │                 │
│       │     with Google"          │                            │                              │                           │                 │
│       ├──────────────────────────▶│                            │                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │ (2) signIn("google")       │                              │                           │                 │
│       │                           ├───────────────────────────▶│                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │ (3) Generate OAuth URL       │                           │                 │
│       │                           │                            │     with scopes:             │                           │                 │
│       │                           │                            │     - openid                 │                           │                 │
│       │                           │                            │     - email                  │                           │                 │
│       │                           │                            │     - profile                │                           │                 │
│       │                           │                            ├─────────────────────────────▶│                           │                 │
│       │                           │                            │                              │                           │                 │
│       │◀─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                           │                 │
│       │         (4) HTTP 302 Redirect to Google               │                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │─────────────────────────────────────────────────────────────────────────────────────▶│                           │                 │
│       │                           │      (5) User visits Google consent screen              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │                              │ ┌───────────────────────┐ │                 │
│       │                           │                            │                              │ │ Google Consent Screen │ │                 │
│       │                           │                            │                              │ │                       │ │                 │
│       │                           │                            │                              │ │ "Theo wants to:"      │ │                 │
│       │                           │                            │                              │ │ • See your email      │ │                 │
│       │                           │                            │                              │ │ • See your profile    │ │                 │
│       │                           │                            │                              │ │                       │ │                 │
│       │                           │                            │                              │ │ [Allow] [Deny]        │ │                 │
│       │                           │                            │                              │ └───────────────────────┘ │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │ (6) User clicks "Allow"      │                           │                 │
│       │◀─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                           │                 │
│       │         (7) Redirect to /api/auth/callback/google?code=xxx                           │                           │                 │
│       │                           │                            │                              │                           │                 │
│       ├──────────────────────────▶│                            │                              │                           │                 │
│       │                           │ (8) Handle callback        │                              │                           │                 │
│       │                           ├───────────────────────────▶│                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │ (9) Exchange code for tokens │                           │                 │
│       │                           │                            ├─────────────────────────────▶│                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │◀────────────────────────────│                           │                 │
│       │                           │                            │   {access_token,             │                           │                 │
│       │                           │                            │    refresh_token,            │                           │                 │
│       │                           │                            │    id_token,                 │                           │                 │
│       │                           │                            │    expires_at}               │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │ (10) Create/Update User      │                           │                 │
│       │                           │                            │      via PrismaAdapter       │                           │                 │
│       │                           │                            ├─────────────────────────────────────────────────────────▶│                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │                              │            ┌──────────────┤                 │
│       │                           │                            │                              │            │  User table  │                 │
│       │                           │                            │                              │            │  Account tbl │                 │
│       │                           │                            │                              │            └──────────────┤                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │ (11) linkAccount event:      │                           │                 │
│       │                           │                            │      • Encrypt tokens        │                           │                 │
│       │                           │                            │      • Store encrypted       │                           │                 │
│       │                           │                            ├─────────────────────────────────────────────────────────▶│                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │ (12) Create JWT session      │                           │                 │
│       │                           │◀───────────────────────────┤   token with user.id         │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │◀──────────────────────────│                            │                              │                           │                 │
│       │   (13) Set session cookie │                            │                              │                           │                 │
│       │        + Redirect to /chat│                            │                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │   ════════════════════════════════════════════════════════════════════════════════════════════════════════════                     │
│       │                              USER IS NOW AUTHENTICATED                                                                              │
│       │   ════════════════════════════════════════════════════════════════════════════════════════════════════════════                     │
│       │                           │                            │                              │                           │                 │
│       │ (14) Subsequent requests  │                            │                              │                           │                 │
│       │      include JWT cookie   │                            │                              │                           │                 │
│       ├──────────────────────────▶│                            │                              │                           │                 │
│       │                           │ (15) Middleware validates  │                              │                           │                 │
│       │                           │      JWT via auth()        │                              │                           │                 │
│       │                           ├───────────────────────────▶│                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │◀───────────────────────────┤                              │                           │                 │
│       │                           │   {user: {id, email, name}}│                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │◀──────────────────────────│                            │                              │                           │                 │
│       │     Protected page        │                            │                              │                           │                 │
│       │                           │                            │                              │                           │                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Sign-In Flow Summary

| Step  | Component     | Action                                   |
| ----- | ------------- | ---------------------------------------- |
| 1-2   | Browser → App | User clicks "Sign In with Google"        |
| 3-4   | NextAuth      | Generates OAuth URL, redirects to Google |
| 5-6   | Google        | User consents to basic permissions       |
| 7     | Google        | Redirects back with authorization code   |
| 8-9   | NextAuth      | Exchanges code for OAuth tokens          |
| 10-11 | NextAuth + DB | Creates user, encrypts and stores tokens |
| 12-13 | NextAuth      | Creates JWT session, sets cookie         |
| 14-15 | Middleware    | Validates JWT on subsequent requests     |

---

## 2. Gmail Integration Connection Flow

The flow for connecting Gmail after initial authentication. This upgrades the user's OAuth scopes to include Gmail permissions.

**Important:** This flow uses NextAuth.js's `signIn()` function (not a custom OAuth URL) to ensure proper PKCE handling.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      GMAIL CONNECTION FLOW (Scope Upgrade)                                                                  │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                                                             │
│    Browser                    Next.js API                  NextAuth.js                    Google OAuth                  Database            │
│       │                           │                            │                              │                           │                 │
│       │ (1) User on Settings page │                            │                              │                           │                 │
│       │     clicks "Connect Gmail"│                            │                              │                           │                 │
│       ├──────────────────────────▶│                            │                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │ (2) POST /api/integrations/gmail/connect                  │                           │                 │
│       │                           │     Body: {redirectUrl: "/settings/integrations/gmail"}  │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │ (3) Check session via auth()                             │                           │                 │
│       │                           ├───────────────────────────▶│                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │◀───────────────────────────┤                              │                           │                 │
│       │                           │    {user: {id: "xxx"}}     │                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │ (4) checkGmailScopes(userId)                              │                           │                 │
│       │                           │     Query Account.scope    │                              │                           │                 │
│       │                           ├─────────────────────────────────────────────────────────────────────────────────────▶│                 │
│       │                           │                            │                              │                           │                 │
│       │                           │◀────────────────────────────────────────────────────────────────────────────────────│                 │
│       │                           │   scope: "openid email profile"                          │                           │                 │
│       │                           │   (missing Gmail scopes)   │                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │◀──────────────────────────│                            │                              │                           │                 │
│       │  (5) Response: {          │                            │                              │                           │                 │
│       │        signInRequired: true,                           │                              │                           │                 │
│       │        authorizationParams: {                          │                              │                           │                 │
│       │          scope: "openid email profile gmail.readonly...",                            │                           │                 │
│       │          prompt: "consent",                            │                              │                           │                 │
│       │          access_type: "offline",                       │                              │                           │                 │
│       │          include_granted_scopes: "true"                │                              │                           │                 │
│       │        },                  │                            │                              │                           │                 │
│       │        callbackUrl: "/settings/integrations/gmail"     │                              │                           │                 │
│       │      }                    │                            │                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │ (6) signIn("google",      │                            │                              │                           │                 │
│       │       {callbackUrl},      │                            │                              │                           │                 │
│       │       authorizationParams)│                            │                              │                           │                 │
│       ├──────────────────────────────────────────────────────▶│                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │ (7) NextAuth generates OAuth │                           │                 │
│       │                           │                            │     URL with PKCE, sets      │                           │                 │
│       │                           │                            │     code_verifier cookie     │                           │                 │
│       │                           │                            ├─────────────────────────────▶│                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │◀─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                           │                 │
│       │         (8) Redirect to Google consent screen         │                              │                           │                 │
│       │─────────────────────────────────────────────────────────────────────────────────────▶│                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │                              │ ┌───────────────────────┐ │                 │
│       │                           │                            │                              │ │ Google Consent Screen │ │                 │
│       │                           │                            │                              │ │                       │ │                 │
│       │                           │                            │                              │ │ "Theo wants to:"      │ │                 │
│       │                           │                            │                              │ │ • Read your email     │ │                 │
│       │                           │                            │                              │ │ • Send email          │ │                 │
│       │                           │                            │                              │ │ • Manage labels       │ │                 │
│       │                           │                            │                              │ │ • Read contacts       │ │                 │
│       │                           │                            │                              │ │                       │ │                 │
│       │                           │                            │                              │ │ [Allow] [Deny]        │ │                 │
│       │                           │                            │                              │ └───────────────────────┘ │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │ (9) User clicks "Allow"      │                           │                 │
│       │◀─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                           │                 │
│       │         (10) Redirect to /api/auth/callback/google?code=xxx                          │                           │                 │
│       │                           │                            │                              │                           │                 │
│       ├──────────────────────────▶│                            │                              │                           │                 │
│       │                           │ (11) Handle callback       │                              │                           │                 │
│       │                           ├───────────────────────────▶│                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │ (12) Verify PKCE, exchange   │                           │                 │
│       │                           │                            │      code for tokens         │                           │                 │
│       │                           │                            ├─────────────────────────────▶│                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │◀────────────────────────────│                           │                 │
│       │                           │                            │   {access_token,             │                           │                 │
│       │                           │                            │    refresh_token,            │                           │                 │
│       │                           │                            │    scope: "...gmail..."      │                           │                 │
│       │                           │                            │    expires_at}               │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │ (13) linkAccount event:      │                           │                 │
│       │                           │                            │      • Encrypt new tokens    │                           │                 │
│       │                           │                            │      • Update Account        │                           │                 │
│       │                           │                            ├─────────────────────────────────────────────────────────▶│                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │                              │            ┌──────────────┤                 │
│       │                           │                            │                              │            │ Account.scope│                 │
│       │                           │                            │                              │            │ now includes │                 │
│       │                           │                            │                              │            │ Gmail scopes │                 │
│       │                           │                            │                              │            └──────────────┤                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │ (14) Check if Gmail scopes   │                           │                 │
│       │                           │                            │      were granted            │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │                           │                            │ (15) If Gmail connected:     │                           │                 │
│       │                           │                            │      • startRecurringSync()  │                           │                 │
│       │                           │                            │      • triggerSync()         │                           │                 │
│       │                           │                            ├─────────────────────────────────────────────────────────▶│                 │
│       │                           │                            │                              │            ┌──────────────┤                 │
│       │                           │                            │                              │            │ Queue sync   │                 │
│       │                           │                            │                              │            │ job in Redis │                 │
│       │                           │                            │                              │            └──────────────┤                 │
│       │                           │                            │                              │                           │                 │
│       │                           │◀───────────────────────────┤                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │◀──────────────────────────│                            │                              │                           │                 │
│       │  (16) Redirect to         │                            │                              │                           │                 │
│       │       /settings/integrations/gmail                     │                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │   ════════════════════════════════════════════════════════════════════════════════════════════════════════════                     │
│       │                              GMAIL IS NOW CONNECTED - SYNC STARTED                                                                  │
│       │   ════════════════════════════════════════════════════════════════════════════════════════════════════════════                     │
│       │                           │                            │                              │                           │                 │
│       │ (17) Page loads, fetches  │                            │                              │                           │                 │
│       │      connection status    │                            │                              │                           │                 │
│       ├──────────────────────────▶│                            │                              │                           │                 │
│       │  GET /api/integrations/gmail/connect                   │                              │                           │                 │
│       │                           │                            │                              │                           │                 │
│       │◀──────────────────────────│                            │                              │                           │                 │
│       │  {connected: true,        │                            │                              │                           │                 │
│       │   hasRequiredScopes: true,│                            │                              │                           │                 │
│       │   missingScopes: []}      │                            │                              │                           │                 │
│       │                           │                            │                              │                           │                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Gmail Connection Flow Summary

| Step  | Component          | Action                                                |
| ----- | ------------------ | ----------------------------------------------------- |
| 1-2   | Browser → API      | User clicks "Connect Gmail", POST to connect endpoint |
| 3-4   | API                | Verify session, check current scopes                  |
| 5     | API → Browser      | Return `signInRequired: true` + `authorizationParams` |
| 6-7   | Browser → NextAuth | Call `signIn("google", ...)` with Gmail scopes        |
| 8-9   | Google             | User consents to Gmail permissions, redirects back    |
| 10-12 | NextAuth           | Verify PKCE, exchange code for tokens                 |
| 13    | NextAuth           | Encrypt tokens, update Account with merged scopes     |
| 14-15 | NextAuth           | Detect Gmail scopes granted, start email sync         |
| 16-17 | Browser            | Redirect to settings, confirm connection              |

---

## Key Differences Between Flows

| Aspect                       | OAuth Sign-In                      | Gmail Connection                                        |
| ---------------------------- | ---------------------------------- | ------------------------------------------------------- |
| **Entry Point**              | Login page                         | Settings page                                           |
| **Initial State**            | Unauthenticated                    | Already authenticated                                   |
| **Scopes Requested**         | Basic (openid, email, profile)     | Gmail + Contacts scopes                                 |
| **`include_granted_scopes`** | Not needed                         | `true` (preserves existing scopes)                      |
| **Post-Auth Action**         | Create user, JWT session           | Start Gmail sync jobs                                   |
| **Redirect Target**          | `/chat` (dashboard)                | `/settings/integrations/gmail`                          |
| **OAuth Initiation**         | `signIn("google")` from login page | `signIn("google", {...}, authParams)` from API response |

**Note:** Both flows use NextAuth.js's `signIn()` function to ensure proper PKCE handling. The Gmail connection flow receives authorization parameters from the API, then uses the client-side `signIn()` to initiate OAuth.

---

## State Parameter

Both flows use NextAuth.js's built-in `state` parameter handling for security:

### Sign-In Flow State

- Managed by NextAuth internally
- Contains CSRF protection token
- Includes `callbackUrl` for post-auth redirect

### Gmail Connection Flow State

- Also managed by NextAuth internally (via `signIn()` function)
- Contains CSRF protection token and PKCE code verifier
- `callbackUrl` passed as parameter to `signIn()` for post-auth redirect

**Note:** The Gmail flow previously used a custom state parameter, but now uses NextAuth's built-in state handling to ensure proper PKCE support.

---

## Error Handling Flows

### Sign-In Error Flow

```
User → Google → Denies Access
                     ↓
        Redirect to /api/auth/callback/google?error=access_denied
                     ↓
        NextAuth redirects to /login?error=OAuthCallback
                     ↓
        Login page displays "An error occurred during sign in"
```

### Gmail Connection Error Flow

```
User → Google → Denies Access
                     ↓
        Redirect to /api/auth/callback/google?error=access_denied
                     ↓
        NextAuth handles error, no scope update
                     ↓
        Redirect to /settings/integrations/gmail
                     ↓
        Page shows "Not Connected" status
```

---

## Related Documentation

- [AUTH_SECURITY.md](./AUTH_SECURITY.md) - Detailed authentication configuration
- [INTEGRATIONS.md](./INTEGRATIONS.md) - Integration architecture
- [services/GMAIL_SERVICE.md](./services/GMAIL_SERVICE.md) - Gmail sync details
