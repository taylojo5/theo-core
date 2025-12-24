# Integration Patterns Guide

This document establishes consistent patterns for implementing OAuth-based integrations in Theo. Gmail is the reference implementation - all integrations should follow these patterns.

---

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [API Endpoint Patterns](#api-endpoint-patterns)
4. [Connection Flow](#connection-flow)
5. [Disconnection Flow](#disconnection-flow)
6. [Scope Management](#scope-management)
7. [UI Component Patterns](#ui-component-patterns)
8. [Sync Patterns](#sync-patterns)
9. [Checklist for New Integrations](#checklist-for-new-integrations)

---

## Overview

All Google OAuth integrations share a single OAuth provider (`google`) but manage different scope sets. Each integration:

- Has dedicated `/connect` and `/disconnect` API endpoints
- Uses centralized scope checking utilities in `@/lib/auth/scope-upgrade`
- Follows the PKCE-safe connection flow via NextAuth's `signIn()` function
- Has dedicated rate limits
- Logs audit events for connections/disconnections

### Integrations Currently Implemented

| Integration | Status | Reference |
|------------|--------|-----------|
| Gmail | ✅ Complete | Reference implementation |
| Calendar | 🔧 Needs alignment | This document's focus |

---

## Directory Structure

Each integration follows this structure:

```
src/
├── app/api/integrations/{integration}/
│   ├── connect/
│   │   └── route.ts          # POST: initiate, GET: check status
│   ├── disconnect/
│   │   └── route.ts          # DELETE/POST: revoke access
│   ├── sync/
│   │   └── route.ts          # GET: status, POST: trigger, DELETE: stop
│   └── ... (integration-specific endpoints)
├── integrations/{integration}/
│   ├── client.ts             # API client
│   ├── constants.ts          # Configuration constants
│   ├── errors.ts             # Error classes
│   ├── index.ts              # Public exports
│   ├── logger.ts             # Integration-specific logger
│   ├── mappers.ts            # Data transformation
│   ├── rate-limiter.ts       # Rate limiting logic
│   ├── repository.ts         # Database operations
│   ├── scopes.ts             # Scope utilities (re-exports from lib/auth/scopes)
│   ├── types.ts              # TypeScript types
│   └── sync/                 # Sync-related modules
└── lib/auth/
    ├── scopes.ts             # Centralized scope definitions
    └── scope-upgrade.ts      # Scope checking and upgrade utilities
```

---

## API Endpoint Patterns

### Connect Endpoint (`/api/integrations/{integration}/connect`)

**Purpose**: Check connection status and initiate OAuth flow when needed.

#### GET - Check Connection Status

Returns the current connection state without modifying anything.

```typescript
// Response type
interface ConnectionStatusResponse {
  connected: boolean;
  hasRequiredScopes: boolean;
  missingScopes: string[];
}
```

#### POST - Initiate Connection

Checks if scope upgrade is needed and returns auth parameters for the client.

```typescript
// Request type
interface ConnectRequest {
  force?: boolean;          // Force re-consent even if connected
  redirectUrl?: string;     // Where to redirect after OAuth
}

// Response type
interface ConnectResponse {
  success: boolean;
  alreadyConnected?: boolean;
  signInRequired?: boolean;
  authorizationParams?: {
    scope: string;
    prompt: string;
    access_type: string;
    include_granted_scopes: string;
  };
  callbackUrl?: string;
  message?: string;
  error?: string;
}
```

**Key Implementation Details**:

1. Apply rate limiting using `RATE_LIMITS.{integration}Connect`
2. Check authentication via `auth()`
3. Check current scope status via `check{Integration}Scopes(userId)`
4. If already connected and not forcing, ensure recurring sync is running
5. Return `signInRequired: true` with `authorizationParams` when OAuth is needed
6. Include all base scopes + integration scopes in the scope string

**Reference Implementation**: `src/app/api/integrations/gmail/connect/route.ts`

---

### Disconnect Endpoint (`/api/integrations/{integration}/disconnect`)

**Purpose**: Revoke integration access and clean up resources.

#### DELETE - Disconnect Integration

```typescript
// Response type
interface DisconnectResponse {
  success: boolean;
  message?: string;
  error?: string;
}
```

**Key Implementation Details**:

1. Apply rate limiting
2. Check if integration is currently connected
3. Revoke access using `revoke{Integration}Access(userId)` from scope-upgrade
4. Log audit entry (fire-and-forget)
5. Also support POST method for form submissions

**Reference Implementation**: `src/app/api/integrations/gmail/disconnect/route.ts`

---

## Connection Flow

The correct connection flow uses NextAuth's `signIn()` on the client side to ensure proper PKCE handling:

```
┌──────────────┐     POST /connect      ┌─────────────────┐
│   Client     │ ─────────────────────► │   Connect API   │
│   (Page)     │                        │                 │
└──────────────┘                        └─────────────────┘
       │                                        │
       │                                        │ Check scopes
       │                                        ▼
       │                               ┌─────────────────┐
       │                               │  Scope Check    │
       │                               │  (scope-upgrade)│
       │                               └─────────────────┘
       │                                        │
       │    { signInRequired: true,             │
       │◄─────authorizationParams: {...} }──────┘
       │
       │    signIn("google", { callbackUrl }, authorizationParams)
       │
       ▼
┌──────────────┐
│  NextAuth    │ ────────────► Google OAuth ────────────► Callback
│  signIn()    │                                              │
└──────────────┘                                              │
       ▲                                                      │
       │◄─────────────────────────────────────────────────────┘
       │              Redirect to callbackUrl
       ▼
┌──────────────┐
│   Page       │ ──────► Fetch connection status ──────► Show connected
└──────────────┘
```

### Client-Side Implementation

```typescript
const handleConnect = async () => {
  try {
    const res = await fetch("/api/integrations/{integration}/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ redirectUrl: "/settings/integrations/{integration}" }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || `Connection failed (${res.status})`);
    }

    const data = await res.json();

    if (data.signInRequired && data.authorizationParams) {
      // Use NextAuth's signIn() to properly handle PKCE
      await signIn(
        "google",
        { callbackUrl: data.callbackUrl || "/settings/integrations/{integration}" },
        data.authorizationParams
      );
    } else if (data.alreadyConnected) {
      await fetchConnectionStatus();
    }
  } catch (error) {
    // Handle error
  }
};
```

### Anti-Pattern (DO NOT USE)

```typescript
// ❌ WRONG - Direct signIn without connect API
await signIn("google", {
  callbackUrl: "/settings/integrations/calendar",
  scope: "https://www.googleapis.com/auth/calendar.events",
});
```

**Why this is wrong**:
1. Doesn't check if already connected (unnecessary OAuth flows)
2. Doesn't merge with base scopes properly
3. Doesn't set `access_type: "offline"` for refresh tokens
4. Doesn't enable incremental authorization with `include_granted_scopes`
5. Doesn't ensure recurring sync is running after connection

---

## Disconnection Flow

```
┌──────────────┐    DELETE /disconnect   ┌─────────────────┐
│   Client     │ ─────────────────────► │  Disconnect API │
│   (Page)     │                        │                 │
└──────────────┘                        └─────────────────┘
       │                                        │
       │                                        │ Check connected
       │                                        ▼
       │                               ┌─────────────────┐
       │                               │   Revoke at     │
       │                               │   Google + DB   │
       │                               └─────────────────┘
       │                                        │
       │                                        │ Log audit
       │    { success: true }                   │
       │◄───────────────────────────────────────┘
       │
       ▼
┌──────────────┐
│   Page       │ ──────► Clear local state ──────► Show disconnected
└──────────────┘
```

### Client-Side Implementation

```typescript
const handleDisconnect = async () => {
  try {
    const res = await fetch("/api/integrations/{integration}/disconnect", {
      method: "DELETE",
    });

    if (res.ok) {
      toast.success("{Integration} disconnected successfully");
      await fetchConnectionStatus();
      // Clear other integration-specific data
      setSyncData(undefined);
      setApprovalsData(undefined);
    } else {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to disconnect");
    }
  } catch (error) {
    toast.error(error.message);
  }
};
```

### Anti-Pattern (DO NOT USE)

```typescript
// ❌ WRONG - Using generic auth revoke
await fetch("/api/auth/revoke", {
  method: "POST",
  body: JSON.stringify({ provider: "google" }),
});
```

**Why this is wrong**:
1. Revokes ALL Google access, not just the specific integration
2. Doesn't properly clean up integration-specific scopes
3. Doesn't clean up integration-specific database records

---

## Scope Management

### Centralized Scope Definitions (`src/lib/auth/scopes.ts`)

All scopes are defined centrally:

```typescript
// Gmail scopes
export const GMAIL_SCOPES = { ... };
export const ALL_GMAIL_SCOPES = [ ... ];

// Calendar scopes
export const CALENDAR_SCOPES = { ... };
export const ALL_CALENDAR_SCOPES = [ ... ];
```

### Integration-Specific Scope Utilities (`src/lib/auth/scope-upgrade.ts`)

Each integration should have:

```typescript
// Check if integration has required scopes
export async function check{Integration}Scopes(userId: string): Promise<ScopeCheckResult>

// Check if integration is connected
export async function is{Integration}Connected(userId: string): Promise<boolean>

// Revoke integration access
export async function revoke{Integration}Access(userId: string): Promise<ScopeUpgradeResult>
```

### Scope Re-exports (`src/integrations/{integration}/scopes.ts`)

Each integration re-exports relevant scope utilities:

```typescript
export {
  {INTEGRATION}_SCOPES,
  ALL_{INTEGRATION}_SCOPES,
  has{Integration}ReadAccess,
  has{Integration}WriteAccess,
  // etc.
} from "@/lib/auth/scopes";
```

---

## UI Component Patterns

### Connection Status Component

Each integration has a `ConnectionStatus` component that:

1. Receives `data`, `isLoading`, `onConnect`, `onDisconnect`, `onRefresh` props
2. Shows appropriate badges: Connected, Limited Access, Not Connected
3. Displays token health information when connected
4. Shows missing scopes warning when applicable
5. Has Connect/Disconnect/Refresh buttons

### Page Component

Each integration settings page:

1. Uses `fetchConnectionStatus` that calls BOTH `/api/integrations/status` and `/api/integrations/{integration}/connect` (GET)
2. Has `handleConnect` that calls the `/connect` POST endpoint, then uses `signIn()` if needed
3. Has `handleDisconnect` that calls the `/disconnect` DELETE endpoint
4. Clears related state after disconnect
5. Polls for sync status when sync is active

---

## Sync Patterns

### Sync Endpoint (`/api/integrations/{integration}/sync`)

- **GET**: Return sync status
- **POST**: Trigger sync (with type: "auto", "full", "incremental")
- **DELETE**: Stop/cancel sync

### Auto-Sync on Connection

When a connection is established or verified, the connect endpoint should:

1. Check if recurring sync is already running
2. Start recurring sync if not running
3. Trigger an immediate sync to get fresh data

---

## Checklist for New Integrations

When adding a new integration or aligning an existing one:

### API Endpoints

- [ ] `/api/integrations/{integration}/connect`
  - [ ] GET for status check
  - [ ] POST for initiating connection
  - [ ] Rate limiting with `RATE_LIMITS.{integration}Connect`
  
- [ ] `/api/integrations/{integration}/disconnect`
  - [ ] DELETE for revocation
  - [ ] POST as alternative method
  - [ ] Rate limiting
  - [ ] Audit logging

### Scope Management

- [ ] Add scope constants to `src/lib/auth/scopes.ts`
- [ ] Add `check{Integration}Scopes()` to `src/lib/auth/scope-upgrade.ts`
- [ ] Add `is{Integration}Connected()` to `src/lib/auth/scope-upgrade.ts`
- [ ] Add `revoke{Integration}Access()` to `src/lib/auth/scope-upgrade.ts`
- [ ] Create `src/integrations/{integration}/scopes.ts` with re-exports

### Rate Limits

- [ ] Add `{integration}Connect` to `RATE_LIMITS` in middleware

### UI

- [ ] Connection status component with proper interface
- [ ] Page using proper connect/disconnect handlers
- [ ] Proper error handling and state clearing

---

## Current Issues: Calendar Integration

The Calendar integration currently has these deviations from the standard pattern:

### Issues

1. **Missing `/connect` endpoint**: Calendar page calls `signIn()` directly
2. **Missing `/disconnect` endpoint**: Calendar page calls `/api/auth/revoke`
3. **Missing scope-upgrade utilities**: No `checkCalendarScopes()` or `revokeCalendarAccess()`
4. **Incorrect OAuth params**: Missing `access_type`, `include_granted_scopes`, etc.
5. **Missing rate limit**: No `RATE_LIMITS.calendarConnect`

### Required Fixes

1. Create `/api/integrations/calendar/connect/route.ts`
2. Create `/api/integrations/calendar/disconnect/route.ts`
3. Add Calendar scope utilities to `scope-upgrade.ts`
4. Update Calendar page to use new endpoints
5. Add `calendarConnect` rate limit


