# Gmail Integration Service

> **Status**: Phase 3 - Chunk 1 Complete  
> **Last Updated**: December 2024  
> **Related**: [AUTH_SECURITY.md](../AUTH_SECURITY.md), [INTEGRATIONS_GUIDE.md](../INTEGRATIONS_GUIDE.md)

---

## Overview

The Gmail integration enables Theo to:

- **Read**: Access user's email content and metadata
- **Sync**: Import contacts and email data into the context system
- **Search**: Enable semantic search across emails
- **Act**: Draft and send emails (with user approval)

---

## Implementation Status

| Chunk | Description               | Status      |
| ----- | ------------------------- | ----------- |
| 1     | Gmail OAuth & Scopes      | ✅ Complete |
| 2     | Gmail Client Library      | 🔲 Pending  |
| 3     | Email Database Models     | 🔲 Pending  |
| 4     | Contact Sync Pipeline     | 🔲 Pending  |
| 5     | Email Sync Worker         | 🔲 Pending  |
| 6     | Email Content Processing  | 🔲 Pending  |
| 7     | Email Search & Embeddings | 🔲 Pending  |
| 8     | Email Actions             | 🔲 Pending  |
| 9     | Gmail Settings UI         | 🔲 Pending  |
| 10    | Integration Testing       | 🔲 Pending  |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GMAIL INTEGRATION                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   OAuth Layer                             │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │   Scopes    │  │ Scope        │  │ Token          │  │   │
│  │  │ Management  │  │ Upgrade      │  │ Refresh        │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Gmail Client                            │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │  Messages   │  │   Labels     │  │   Contacts     │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Sync Workers                           │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │ Full Sync   │  │ Incremental  │  │ Contact Sync   │  │   │
│  │  │             │  │ Sync         │  │                │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Storage Layer                           │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │  Emails     │  │  Embeddings  │  │   Contacts     │  │   │
│  │  │  (Prisma)   │  │  (pgvector)  │  │   (Person)     │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## OAuth & Scopes (Chunk 1)

### Required Scopes

| Scope                                               | Purpose       |
| --------------------------------------------------- | ------------- |
| `https://www.googleapis.com/auth/gmail.readonly`    | Read emails   |
| `https://www.googleapis.com/auth/gmail.send`        | Send emails   |
| `https://www.googleapis.com/auth/gmail.labels`      | Manage labels |
| `https://www.googleapis.com/auth/contacts.readonly` | Read contacts |

### Scope Management

```typescript
import {
  GMAIL_SCOPES,
  ALL_GMAIL_SCOPES,
  hasGmailReadAccess,
  hasGmailSendAccess,
  getIntegrationStatus,
} from "@/lib/auth/scopes";

// Check individual capabilities
const scopes = parseScopes(account.scope);
const canRead = hasGmailReadAccess(scopes);
const canSend = hasGmailSendAccess(scopes);

// Get full integration status
const status = getIntegrationStatus(scopes);
// {
//   gmail: { connected: true, canRead: true, canSend: true, ... },
//   contacts: { connected: true },
//   missingScopes: [],
// }
```

### Scope Upgrade Flow

```typescript
import { checkGmailScopes, generateUpgradeUrl } from "@/lib/auth/scope-upgrade";

// Check current scope status
const result = await checkGmailScopes(userId);
// {
//   hasRequiredScopes: false,
//   grantedScopes: ["openid", "email", "profile"],
//   missingScopes: ["gmail.readonly", ...],
//   upgradeUrl: "https://accounts.google.com/o/oauth2/..."
// }

// Generate upgrade URL with custom state
const authUrl = generateUpgradeUrl(
  ALL_GMAIL_SCOPES,
  Buffer.from(JSON.stringify({ userId, redirectUrl })).toString("base64url")
);
```

### Files

```
src/lib/auth/
├── index.ts           # NextAuth config with configurable scopes
├── scopes.ts          # Scope definitions and utilities
├── scope-upgrade.ts   # Scope checking and upgrade flow
└── token-refresh.ts   # Token refresh utilities
```

---

## API Endpoints

### Integration Status

```
GET /api/integrations/status
```

Returns the current status of all integrations including Gmail.

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
    "canManageLabels": true
  },
  "contacts": {
    "connected": true
  },
  "missingScopes": [],
  "upgradeRequired": false
}
```

### Connect Gmail

```
POST /api/integrations/gmail/connect
```

Initiates the Gmail connection flow.

Request:

```json
{
  "force": false,
  "redirectUrl": "/settings/integrations/gmail"
}
```

Response (needs auth):

```json
{
  "success": true,
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?...",
  "message": "Authorization required to connect Gmail"
}
```

Response (already connected):

```json
{
  "success": true,
  "alreadyConnected": true,
  "message": "Gmail is already connected with all required permissions"
}
```

### Check Gmail Connection

```
GET /api/integrations/gmail/connect
```

Returns connection status and upgrade URL if needed.

Response:

```json
{
  "connected": false,
  "hasRequiredScopes": false,
  "missingScopes": [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.labels",
    "https://www.googleapis.com/auth/contacts.readonly"
  ],
  "upgradeUrl": "https://accounts.google.com/o/oauth2/..."
}
```

### Disconnect Gmail

```
DELETE /api/integrations/gmail/disconnect
```

Revokes Gmail access and removes scopes.

Response:

```json
{
  "success": true,
  "message": "Gmail has been disconnected successfully"
}
```

---

## Configuration

### Environment Variables

```env
# Google OAuth credentials (required)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret

# Initial OAuth scopes (optional)
# Options: "basic", "gmail-readonly", "gmail-full"
GMAIL_OAUTH_SCOPES=basic
```

### Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable the following APIs:
   - Gmail API
   - People API (for contacts)
3. Configure OAuth consent screen:
   - Add scopes for Gmail and Contacts
   - Add test users (for development)
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-domain.com/api/auth/callback/google`

---

## Security Considerations

### Minimal Scope Requests

- Initial auth only requests basic scopes
- Gmail scopes are requested only when user connects Gmail
- Users can disconnect at any time

### Token Security

- Access tokens stored encrypted in database
- Refresh tokens used for automatic renewal
- 5-minute buffer before expiry triggers refresh

### Audit Logging

All Gmail connection/disconnection events are logged:

```typescript
await logAuditEntry({
  userId,
  actionType: "delete",
  actionCategory: "integration",
  entityType: "gmail_connection",
  inputSummary: "User disconnected Gmail integration",
});
```

### Rate Limiting

Gmail API has quotas that must be respected:

- 250 quota units per user per second
- 1,000,000,000 quota units per day

The Gmail client (Chunk 2) will implement rate limiting to stay within these limits.

---

## Testing

### Scope Utilities

```bash
npm test -- tests/lib/auth/scopes.test.ts
npm test -- tests/lib/auth/scope-upgrade.test.ts
```

### Manual Testing

1. Start the dev server: `npm run dev`
2. Login with Google (basic scopes)
3. Check integration status: `GET /api/integrations/status`
4. Initiate Gmail connection: `POST /api/integrations/gmail/connect`
5. Follow the returned `authUrl` to grant permissions
6. Verify connection: `GET /api/integrations/status`
7. Disconnect: `DELETE /api/integrations/gmail/disconnect`

---

## Next Steps

### Chunk 2: Gmail Client Library

- Install `googleapis` package
- Create `GmailClient` class
- Implement message listing and fetching
- Add rate limiting and error handling

### Chunk 3: Email Database Models

- Add Email, EmailLabel, GmailSyncState models to Prisma
- Create migrations
- Implement repository pattern for data access

---

## Related Documentation

- [AUTH_SECURITY.md](../AUTH_SECURITY.md) - OAuth and token management
- [INTEGRATIONS_GUIDE.md](../INTEGRATIONS_GUIDE.md) - General integration patterns
- [PHASE_3_PLAN.md](../PHASE_3_PLAN.md) - Full implementation plan
