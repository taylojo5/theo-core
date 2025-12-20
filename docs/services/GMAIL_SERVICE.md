# Gmail Integration Service

> **Status**: Phase 3 - Chunk 4 Complete  
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
| 2     | Gmail Client Library      | ✅ Complete |
| 3     | Email Database Models     | ✅ Complete |
| 4     | Contact Sync Pipeline     | ✅ Complete |
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
│  │  │  Threads    │  │   History    │  │   Drafts       │  │   │
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

---

## Gmail Client Library (Chunk 2)

The Gmail client provides a type-safe wrapper around the Google Gmail and People APIs with built-in rate limiting, retry logic, and error handling.

### Installation

The client uses the `googleapis` package:

```bash
npm install googleapis
```

### Basic Usage

```typescript
import { GmailClient, createGmailClient } from "@/integrations/gmail";

// Create a client
const client = createGmailClient(accessToken, userId);

// Or with custom config
const client = new GmailClient({
  accessToken,
  userId,
  enableRateLimiting: true,
  maxRetries: 3,
  timeoutMs: 30000,
});
```

### Message Operations

```typescript
// List messages
const { messages, nextPageToken } = await client.listMessages({
  query: "from:sender@example.com",
  maxResults: 50,
  labelIds: ["INBOX"],
});

// Get message with full details
const message = await client.getMessage(messageId, { format: "full" });

// List with full message details (fetches each message)
const { messages } = await client.listMessagesFull({ maxResults: 10 });

// Modify message labels
await client.modifyMessage(messageId, {
  addLabelIds: ["STARRED"],
  removeLabelIds: ["UNREAD"],
});

// Convenience methods
await client.markAsRead(messageId);
await client.markAsUnread(messageId);
await client.starMessage(messageId);
await client.unstarMessage(messageId);
await client.trashMessage(messageId);
await client.untrashMessage(messageId);
```

### Thread Operations

```typescript
// List threads
const { threads, nextPageToken } = await client.listThreads({
  query: "subject:meeting",
  maxResults: 20,
});

// Get thread with all messages
const thread = await client.getThread(threadId);
console.log(thread.messages); // Array of ParsedGmailMessage
console.log(thread.participants); // Array of EmailAddress
console.log(thread.latestDate);

// Trash/untrash thread
await client.trashThread(threadId);
await client.untrashThread(threadId);
```

### Label Operations

```typescript
// List all labels
const labels = await client.listLabels();

// Get specific label
const label = await client.getLabel("INBOX");
console.log(label.messagesTotal);
console.log(label.messagesUnread);

// Create label
const newLabel = await client.createLabel("Important Projects", {
  labelListVisibility: "labelShow",
  backgroundColor: "#4285f4",
  textColor: "#ffffff",
});

// Delete label
await client.deleteLabel(labelId);
```

### Contact Operations

```typescript
// List contacts
const { contacts, nextPageToken } = await client.listContacts({
  pageSize: 100,
  sortOrder: "LAST_MODIFIED_DESCENDING",
});

// List contacts with parsed format
const { contacts } = await client.listContactsParsed();
contacts.forEach((c) => {
  console.log(c.name, c.email, c.company);
});

// Get specific contact
const contact = await client.getContact("people/c12345");

// Search contacts
const results = await client.searchContacts("John", 10);
```

### History (Sync) Operations

```typescript
// Get current history ID
const historyId = await client.getHistoryId();

// List changes since a history ID
const history = await client.listHistory({
  startHistoryId: previousHistoryId,
  historyTypes: ["messageAdded", "messageDeleted"],
});

history.history?.forEach((h) => {
  h.messagesAdded?.forEach((m) => console.log("Added:", m.message.id));
  h.messagesDeleted?.forEach((m) => console.log("Deleted:", m.message.id));
});
```

### Send & Draft Operations

```typescript
// Send an email
const sent = await client.sendMessage({
  to: ["recipient@example.com"],
  cc: ["cc@example.com"],
  subject: "Hello from Theo",
  body: "This is the email body",
  bodyHtml: "<p>This is the <strong>HTML</strong> body</p>",
});

// Create a draft
const draft = await client.createDraft({
  to: ["recipient@example.com"],
  subject: "Draft Subject",
  body: "Draft content",
});

// Update a draft
await client.updateDraft(draft.id, {
  to: ["recipient@example.com"],
  subject: "Updated Subject",
  body: "Updated content",
});

// Send a draft
const sentMessage = await client.sendDraft(draft.id);

// List drafts
const { drafts } = await client.listDrafts();

// Get draft details
const draftDetails = await client.getDraft(draftId);

// Delete draft
await client.deleteDraft(draftId);
```

### Profile

```typescript
const profile = await client.getProfile();
console.log(profile.emailAddress);
console.log(profile.messagesTotal);
console.log(profile.historyId);
```

### Error Handling

```typescript
import {
  GmailError,
  GmailErrorCode,
  isGmailError,
  isRetryableError,
  needsTokenRefresh,
  needsScopeUpgrade,
} from "@/integrations/gmail";

try {
  await client.getMessage(messageId);
} catch (error) {
  if (isGmailError(error)) {
    switch (error.code) {
      case GmailErrorCode.UNAUTHORIZED:
        // Token expired, need refresh
        break;
      case GmailErrorCode.RATE_LIMITED:
        // Wait and retry
        console.log(`Retry after ${error.retryAfterMs}ms`);
        break;
      case GmailErrorCode.NOT_FOUND:
        // Message doesn't exist
        break;
      case GmailErrorCode.INSUFFICIENT_PERMISSION:
        // Need scope upgrade
        break;
    }
  }
}
```

### Rate Limiting

The client includes built-in rate limiting that respects Gmail API quotas:

```typescript
import {
  GmailRateLimiter,
  createRateLimiter,
  GMAIL_RATE_LIMITS,
  GMAIL_QUOTA_UNITS,
} from "@/integrations/gmail";

// Create a rate limiter
const limiter = createRateLimiter(userId);

// Check if operation is allowed
const result = await limiter.check("messages.get");
if (result.allowed) {
  // Proceed with operation
} else {
  console.log(`Wait ${result.waitMs}ms`);
}

// Wait for quota
await limiter.waitForQuota("messages.send");

// Get current status
const status = await limiter.getStatus();
console.log(status.perSecond.remaining);
console.log(status.perMinute.remaining);
```

### Utility Functions

```typescript
import {
  parseGmailMessage,
  parseGmailThread,
  parseEmailAddress,
  parseEmailAddressList,
  formatEmailAddress,
  extractBody,
  extractAttachments,
  parseGoogleContact,
  buildRawMessage,
  isSystemLabel,
  getLabelDisplayName,
  buildSearchQuery,
  stripHtml,
  truncateText,
} from "@/integrations/gmail";

// Parse email addresses
const addr = parseEmailAddress("John Doe <john@example.com>");
// { name: "John Doe", email: "john@example.com" }

// Parse list of addresses
const addrs = parseEmailAddressList("John <j@ex.com>, Jane <jane@ex.com>");

// Format back to string
const str = formatEmailAddress(addr);
// "John Doe <john@example.com>"

// Build a search query
const query = buildSearchQuery({
  from: "sender@example.com",
  hasAttachment: true,
  after: new Date("2024-01-01"),
  isUnread: true,
});
// "from:sender@example.com has:attachment after:2024/01/01 is:unread"

// Check system labels
isSystemLabel("INBOX"); // true
isSystemLabel("my-label"); // false

// Get display name
getLabelDisplayName("CATEGORY_SOCIAL"); // "Social"

// Strip HTML from email body
const plainText = stripHtml(htmlBody);
```

### File Structure

```
src/integrations/gmail/
├── index.ts           # Public API exports
├── client.ts          # GmailClient class
├── types.ts           # TypeScript type definitions
├── errors.ts          # Error types and parsing
├── rate-limiter.ts    # Gmail-specific rate limiting
└── utils.ts           # Parsing and utility functions
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

### Sync Contacts

```
POST /api/integrations/gmail/sync/contacts
```

Triggers a contact sync from Google Contacts to Person entities.

Request:

```json
{
  "maxContacts": 1000,
  "requireEmail": true,
  "forceUpdate": false
}
```

Response:

```json
{
  "success": true,
  "message": "Successfully synced 150 contacts",
  "data": {
    "created": 45,
    "updated": 12,
    "unchanged": 93,
    "skipped": 8,
    "total": 158,
    "errors": 0,
    "durationMs": 2341
  }
}
```

### Contact Sync Status

```
GET /api/integrations/gmail/sync/contacts
```

Returns the current contact sync status.

Response:

```json
{
  "contactCount": 150,
  "lastSyncAt": "2024-12-20T12:00:00.000Z",
  "status": "idle",
  "hasContactsAccess": true
}
```

---

## Contact Sync Pipeline (Chunk 4)

The contact sync pipeline imports Google Contacts as Person entities in the context system, with automatic deduplication and update detection.

### How It Works

1. **Fetch Contacts**: Uses the People API via GmailClient to paginate through all contacts
2. **Filter & Validate**: Skips contacts without email (configurable) and handles duplicates
3. **Map to Person**: Converts Google Contact fields to Person entity structure
4. **Upsert**: Creates new people or updates existing ones via `upsertPeopleFromSource()`
5. **Track State**: Updates sync state with contact count and last sync time

### Usage

```typescript
import { syncContacts, getContactSyncStatus } from "@/integrations/gmail/sync";

// Sync contacts for a user
const result = await syncContacts(userId, accessToken, {
  maxContacts: 1000,
  requireEmail: true,
  forceUpdate: false,
});

console.log(`Created: ${result.created}`);
console.log(`Updated: ${result.updated}`);
console.log(`Unchanged: ${result.unchanged}`);
console.log(`Skipped: ${result.skipped}`);
console.log(`Duration: ${result.durationMs}ms`);

// Get sync status
const status = await getContactSyncStatus(userId);
console.log(`Total contacts: ${status.contactCount}`);
console.log(`Last synced: ${status.lastSyncAt}`);
```

### Options

| Option          | Type    | Default | Description                              |
| --------------- | ------- | ------- | ---------------------------------------- |
| `maxContacts`   | number  | 1000    | Maximum number of contacts to sync       |
| `requireEmail`  | boolean | true    | Only sync contacts with email addresses  |
| `forceUpdate`   | boolean | false   | Force update even if no changes detected |
| `includePhotos` | boolean | true    | Include contact photo URLs               |
| `pageSize`      | number  | 100     | Page size for API requests               |

### Deduplication

Contacts are deduplicated in two ways:

1. **By Source ID**: Each contact's `resourceName` is stored as `sourceId` on the Person entity
2. **By Email**: Duplicate emails within the same sync batch are skipped

When an existing Person is found (by source or email), it is updated rather than duplicated.

### Field Mapping

| Google Contact Field      | Person Field |
| ------------------------- | ------------ |
| `names[0].displayName`    | `name`       |
| `emailAddresses[0].value` | `email`      |
| `phoneNumbers[0].value`   | `phone`      |
| `organizations[0].name`   | `company`    |
| `organizations[0].title`  | `title`      |
| `photos[0].url`           | `avatarUrl`  |
| `biographies[0].value`    | `bio`        |
| `resourceName`            | `sourceId`   |
| Full contact data         | `metadata`   |

### Error Handling

The sync process is resilient to individual contact failures:

```typescript
const result = await syncContacts(userId, accessToken);

if (result.errors.length > 0) {
  result.errors.forEach((err) => {
    console.error(`Failed to sync ${err.contactName}: ${err.message}`);
  });
}
```

### File Structure

```
src/integrations/gmail/sync/
├── index.ts           # Public exports
├── contacts.ts        # Contact sync logic
└── types.ts           # Sync type definitions

src/app/api/integrations/gmail/sync/
└── contacts/
    └── route.ts       # API endpoint
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

| Limit Type              | Value                  |
| ----------------------- | ---------------------- |
| Per-user per second     | 250 quota units        |
| Daily quota (Workspace) | 1,000,000,000 units    |
| Client rate limiting    | 100 units/sec, 15k/min |

Different operations consume different quota units:

| Operation     | Quota Units |
| ------------- | ----------- |
| messages.list | 5           |
| messages.get  | 5           |
| messages.send | 100         |
| threads.list  | 10          |
| threads.get   | 10          |
| drafts.create | 10          |
| drafts.send   | 100         |

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

### Testing the Client

```typescript
import { GmailClient, createGmailClient } from "@/integrations/gmail";

// Create client with test token
const client = createGmailClient(testAccessToken, "test-user-id");

// Test message listing
const { messages } = await client.listMessages({ maxResults: 5 });
console.log(`Found ${messages.length} messages`);

// Test profile
const profile = await client.getProfile();
console.log(`Logged in as ${profile.emailAddress}`);
```

---

## Next Steps

### Chunk 5: Email Sync Worker

- Implement full sync (initial import of all emails)
- Implement incremental sync using Gmail History API
- Create BullMQ worker for background processing
- Handle sync state management and error recovery

### Chunk 6: Email Content Processing

- Extract people mentions from emails
- Parse dates and potential deadlines
- Identify action items
- Categorize email topics

---

## Related Documentation

- [AUTH_SECURITY.md](../AUTH_SECURITY.md) - OAuth and token management
- [INTEGRATIONS_GUIDE.md](../INTEGRATIONS_GUIDE.md) - General integration patterns
- [PHASE_3_PLAN.md](../PHASE_3_PLAN.md) - Full implementation plan
