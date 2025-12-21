# Gmail Integration Service

> **Status**: Phase 3 - Complete ✅  
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
| 5     | Email Sync Worker         | ✅ Complete |
| 6     | Email Content Processing  | ✅ Complete |
| 7     | Email Search & Embeddings | ✅ Complete |
| 8     | Email Actions             | ✅ Complete |
| 9     | Gmail Settings UI         | ✅ Complete |
| 10    | Integration Testing       | ✅ Complete |

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

## Email Content Processing (Chunk 6)

The content extraction module analyzes email content to extract structured data including people, dates, action items, and topics. This enriches the context system with actionable information from unstructured email content.

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   EMAIL CONTENT PROCESSOR                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Email Input                                                     │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │  People  │  │  Dates   │  │ Actions  │  │  Topics  │        │
│  │Extraction│  │Extraction│  │Extraction│  │Extraction│        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │                │
│       ▼             ▼             ▼             ▼                │
│  ┌──────────────────────────────────────────────────────┐       │
│  │              EmailProcessingResult                    │       │
│  │  • ExtractedPerson[] (linked to Person entities)     │       │
│  │  • ExtractedDate[] (deadlines, meetings, etc.)       │       │
│  │  • ExtractedActionItem[] (tasks, requests)           │       │
│  │  • ExtractedTopic[] (categorization)                 │       │
│  │  • Summary                                            │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Basic Usage

```typescript
import {
  processEmailContent,
  processEmailQuick,
  processEmailBatch,
} from "@/integrations/gmail";

// Process a single email
const result = await processEmailContent(email, {
  people: { linkToExisting: true },
  dates: { futureOnly: true },
  actions: { minConfidence: 0.6 },
});

console.log(`Found ${result.people.length} people`);
console.log(`Found ${result.dates.length} dates`);
console.log(`Found ${result.actionItems.length} action items`);
console.log(`Topics: ${result.topics.map((t) => t.name).join(", ")}`);

// Quick processing (dates and actions only)
const quickResult = await processEmailQuick(email);

// Batch processing
const batchResult = await processEmailBatch(emails, {
  concurrency: 5,
  continueOnError: true,
  onProgress: (done, total) => console.log(`${done}/${total}`),
});
```

### People Extraction

Extracts people from email headers and body, linking them to existing Person entities.

```typescript
import {
  extractPeople,
  extractSender,
  extractRecipients,
} from "@/integrations/gmail";

// Extract all people
const people = await extractPeople(email, {
  linkToExisting: true, // Link to Person entities
  createMissing: false, // Don't create new Persons
});

// Each person has:
// - email: string
// - name?: string
// - role: 'sender' | 'recipient' | 'cc' | 'bcc' | 'mentioned' | 'reply_to'
// - linkedPersonId?: string
// - linkedPerson?: Person
// - confidence: number (0-1)

// Just get sender
const sender = await extractSender(email);

// Just get recipients
const recipients = await extractRecipients(email);
```

### Date Extraction

Uses `chrono-node` for natural language date parsing with deadline detection.

```typescript
import {
  extractDates,
  extractDeadlines,
  formatExtractedDate,
} from "@/integrations/gmail";

// Extract all dates
const dates = extractDates(text, {
  referenceDate: email.internalDate, // For relative dates
  futureOnly: true, // Only future dates
  minConfidence: 0.5,
});

// Each date has:
// - date: Date
// - endDate?: Date (for ranges)
// - originalText: string ("next Tuesday")
// - type: 'absolute' | 'relative' | 'deadline' | 'meeting' | 'reminder' | ...
// - isPotentialDeadline: boolean
// - hasTime: boolean
// - confidence: number (0-1)

// Just get potential deadlines
const deadlines = extractDeadlines(text);

// Format for display
console.log(formatExtractedDate(dates[0])); // "Tue, Dec 24"
```

**Supported Date Patterns:**

| Pattern   | Example                             | Type        |
| --------- | ----------------------------------- | ----------- |
| Absolute  | "January 5th, 2025"                 | `absolute`  |
| Relative  | "next Tuesday", "in 3 days"         | `relative`  |
| Deadline  | "due by Friday", "deadline: Dec 31" | `deadline`  |
| Meeting   | "meeting at 3pm"                    | `meeting`   |
| Reminder  | "remind me on Monday"               | `reminder`  |
| Range     | "from Monday to Friday"             | `range`     |
| Recurring | "every Monday"                      | `recurring` |

### Action Item Extraction

Identifies tasks and requests from email content using pattern matching.

```typescript
import {
  extractActionItems,
  extractActionItemsWithAssignees,
} from "@/integrations/gmail";

// Extract action items
const actions = extractActionItems(bodyText, {
  minConfidence: 0.5,
});

// Each action has:
// - title: string
// - context: string (surrounding text)
// - priority: 'urgent' | 'high' | 'medium' | 'low'
// - indicators: ('imperative_verb' | 'question' | 'deadline_mention' | ...)[]
// - confidence: number (0-1)
// - dueDate?: ExtractedDate
// - assignee?: ExtractedPerson

// Include assignee detection
const actionsWithAssignees = extractActionItemsWithAssignees(
  bodyText,
  people // From extractPeople()
);
```

**Detected Patterns:**

| Indicator        | Example                       |
| ---------------- | ----------------------------- |
| Imperative verb  | "Please send the report"      |
| Question         | "Can you review this?"        |
| Assignment       | "I need you to complete this" |
| Deadline mention | "Finish by Friday"            |
| Checkbox         | "[ ] Review document"         |
| Numbered list    | "1. First task"               |

**Priority Detection:**

| Priority | Keywords                                    |
| -------- | ------------------------------------------- |
| Urgent   | "urgent", "asap", "immediately", "critical" |
| High     | "important", "priority", "time-sensitive"   |
| Medium   | (default)                                   |
| Low      | "no rush", "whenever", "if you have time"   |

### Topic Categorization

Categorizes emails using keyword analysis and sender domain detection.

```typescript
import {
  extractTopics,
  getEmailPrimaryTopic,
  matchesTopic,
} from "@/integrations/gmail";

// Extract topics
const topics = extractTopics(email, {
  maxTopics: 3,
  minConfidence: 0.3,
});

// Each topic has:
// - name: string ("Finance", "Travel", ...)
// - category: TopicCategory
// - confidence: number (0-1)
// - keywords: string[] (matched keywords)

// Get primary topic
const primary = getEmailPrimaryTopic(email);

// Check if email matches a topic
if (matchesTopic(email, "finance", 0.4)) {
  // Handle financial email
}
```

**Topic Categories:**

| Category     | Example Keywords                      |
| ------------ | ------------------------------------- |
| `work`       | project, meeting, deadline, client    |
| `finance`    | invoice, payment, receipt, bank       |
| `travel`     | flight, hotel, booking, itinerary     |
| `scheduling` | meeting, appointment, calendar        |
| `project`    | launch, release, github, pull request |
| `support`    | ticket, issue, help, customer service |
| `newsletter` | unsubscribe, weekly update            |
| `shopping`   | order, shipping, delivery, tracking   |
| `legal`      | contract, agreement, attorney         |
| `health`     | doctor, prescription, medical         |
| `education`  | course, exam, certificate             |
| `social`     | invitation, party, networking         |
| `personal`   | family, birthday, vacation            |

**Sender-Based Categorization:**

Emails from known domains are automatically boosted:

- `amazon.com` → shopping
- `expedia.com` → travel
- `paypal.com` → finance
- `github.com` → project
- `calendly.com` → scheduling

### Processing Results

```typescript
import {
  hasActionableContent,
  getDeadlines,
  getHighPriorityActions,
  getLinkedPeople,
  hasProcessingErrors,
  getPrimaryTopic,
} from "@/integrations/gmail";

// Check if email has actionable content
if (hasActionableContent(result)) {
  // Has deadlines or action items
}

// Get just the deadlines
const deadlines = getDeadlines(result);

// Get urgent/high priority actions
const urgent = getHighPriorityActions(result);

// Get IDs of linked Person entities
const personIds = getLinkedPeople(result);

// Check for processing errors
if (hasProcessingErrors(result)) {
  console.error("Errors:", result.metadata.errors);
}

// Get primary topic
const topic = getPrimaryTopic(result);
```

### Processing Options

```typescript
const options: EmailProcessingOptions = {
  people: {
    linkToExisting: true, // Link to Person entities
    createMissing: false, // Create new Persons
    minMentionConfidence: 0.6, // For body mentions
  },
  dates: {
    referenceDate: new Date(), // For relative dates
    futureOnly: true, // Only future dates
    minConfidence: 0.5,
  },
  actions: {
    minConfidence: 0.5,
    createTasks: false, // Don't auto-create Tasks
  },
  topics: {
    maxTopics: 3,
    minConfidence: 0.3,
  },
  skip: {
    people: false,
    dates: false,
    actions: false,
    topics: false,
    summary: false,
  },
};
```

### Performance

The extraction is optimized for speed:

| Operation         | Target  | Notes                |
| ----------------- | ------- | -------------------- |
| Full processing   | < 500ms | Single email         |
| Quick processing  | < 100ms | Dates + actions only |
| Batch (10 emails) | < 2s    | With concurrency     |

### File Structure

```
src/integrations/gmail/extraction/
├── index.ts          # Public exports
├── processor.ts      # Main orchestrator
├── types.ts          # TypeScript definitions
├── people.ts         # People extraction
├── dates.ts          # Date extraction (chrono-node)
├── action-items.ts   # Action item extraction
└── topics.ts         # Topic categorization
```

---

## Email Actions (Chunk 8)

The email actions module enables drafting and sending emails with a mandatory approval workflow for agent-initiated sends. This ensures users maintain full control over outbound email communications.

### Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                   EMAIL ACTIONS FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Agent/User Request                                              │
│       │                                                          │
│       ▼                                                          │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   COMPOSE                                  │   │
│  │  • Validate recipients                                    │   │
│  │  • Build message content                                  │   │
│  │  • Support replies/forwards                               │   │
│  └────────────────────┬─────────────────────────────────────┘   │
│                       │                                          │
│                       ▼                                          │
│  ┌────────────────────────────────────┐                         │
│  │     User-Initiated?                 │                         │
│  └────────────────────┬───────────────┘                         │
│            No ────────┼──────── Yes                              │
│                       │                                          │
│       ┌───────────────┴───────────────┐                         │
│       ▼                               ▼                          │
│  ┌──────────────┐             ┌──────────────┐                  │
│  │   CREATE     │             │   DIRECT     │                  │
│  │   APPROVAL   │             │   SEND       │                  │
│  └───────┬──────┘             └──────┬───────┘                  │
│          │                           │                           │
│          ▼                           │                           │
│  ┌──────────────┐                   │                           │
│  │  User Reviews │                   │                           │
│  │  & Decides    │                   │                           │
│  └───────┬──────┘                   │                           │
│          │                           │                           │
│  ┌───────┴───────┐                  │                           │
│  │               │                   │                           │
│  ▼               ▼                   │                           │
│ Approve       Reject                 │                           │
│  │               │                   │                           │
│  ▼               ▼                   │                           │
│ Send Draft   Delete Draft            │                           │
│  │                                   │                           │
│  └───────────────┬───────────────────┘                          │
│                  ▼                                               │
│           ┌──────────────┐                                       │
│           │  AUDIT LOG   │                                       │
│           └──────────────┘                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Draft Management

```typescript
import {
  createDraft,
  updateDraft,
  deleteDraft,
  getDraft,
  listDrafts,
} from "@/integrations/gmail";

// Create a draft
const result = await createDraft(client, {
  to: ["recipient@example.com"],
  cc: ["cc@example.com"],
  subject: "Project Update",
  body: "Here's the latest update on the project...",
  bodyHtml: "<p>Here's the latest update on the project...</p>",
});

console.log(`Draft created: ${result.draftId}`);

// Update a draft
await updateDraft(client, result.draftId, {
  to: ["recipient@example.com"],
  subject: "Updated: Project Update",
  body: "Updated content...",
});

// List drafts
const { drafts, nextPageToken } = await listDrafts(client, {
  maxResults: 20,
});

// Delete a draft
await deleteDraft(client, draftId);
```

### Composition Utilities

```typescript
import {
  validateComposeParams,
  validateEmailAddresses,
  buildReplyParams,
  buildForwardParams,
  formatEmailForDisplay,
  parseDisplayEmail,
} from "@/integrations/gmail";

// Validate compose parameters
const validation = validateComposeParams({
  to: ["valid@email.com", "invalid-email"],
  subject: "Test",
  body: "Content",
});

if (!validation.valid) {
  console.error(validation.errors);
  // ["Invalid recipient addresses: invalid-email"]
}

// Validate email addresses
const { valid, invalid } = validateEmailAddresses(["a@b.com", "bad"]);

// Build reply parameters
const replyParams = buildReplyParams(
  originalMessage,
  "Thanks for your message!",
  "<p>Thanks for your message!</p>"
);
// Automatically handles: Re: subject, threading, references

// Build forward parameters
const forwardParams = buildForwardParams(
  originalMessage,
  ["forward-to@example.com"],
  "FYI - see below"
);
// Automatically handles: Fwd: subject, forward header

// Format for display
formatEmailForDisplay("john@example.com", "John Doe");
// "John Doe <john@example.com>"

// Parse display format
parseDisplayEmail("John Doe <john@example.com>");
// { name: "John Doe", email: "john@example.com" }
```

### Approval Workflow

The approval workflow is required for all agent-initiated email sends. This ensures users maintain control and can review emails before they're sent.

```typescript
import {
  requestApproval,
  approveAndSend,
  rejectApproval,
  getPendingApprovals,
  getApprovalStats,
} from "@/integrations/gmail";

// Request approval for sending an email
const result = await requestApproval(client, userId, {
  to: ["recipient@example.com"],
  subject: "Meeting Follow-up",
  body: "Thank you for meeting with me today...",
  requestedBy: "theo-agent", // Agent identifier
  expiresInMinutes: 60 * 24, // 24 hours
  metadata: {
    conversationId: "conv_123",
    context: "Post-meeting follow-up",
  },
});

console.log(`Approval ID: ${result.approval.id}`);
console.log(`Draft ID: ${result.draftId}`);
console.log(`Expires at: ${result.approval.expiresAt}`);

// Get pending approvals
const pending = await getPendingApprovals(userId);
console.log(`${pending.length} emails awaiting approval`);

// Approve and send
const sendResult = await approveAndSend(client, userId, approvalId);
if (sendResult.success) {
  console.log(`Sent! Message ID: ${sendResult.sentMessageId}`);
} else {
  console.error(`Failed: ${sendResult.errorMessage}`);
}

// Reject an approval
const rejectResult = await rejectApproval(
  client,
  userId,
  approvalId,
  "I want to revise the wording" // Optional notes
);

// Get approval statistics
const stats = await getApprovalStats(userId);
console.log(`Pending: ${stats.pending}`);
console.log(`Sent: ${stats.sent}`);
console.log(`Rejected: ${stats.rejected}`);
```

### Approval States

| Status     | Description                      |
| ---------- | -------------------------------- |
| `pending`  | Awaiting user decision           |
| `approved` | User approved (may fail to send) |
| `rejected` | User rejected, draft deleted     |
| `expired`  | Expired before user decision     |
| `sent`     | Successfully sent                |

### Expiration Management

Approvals automatically expire after a configurable period (default: 24 hours):

```typescript
import {
  expireOverdueApprovals,
  isApprovalExpired,
  getTimeUntilExpiration,
} from "@/integrations/gmail";

// Run periodically to expire old approvals
const expiredCount = await expireOverdueApprovals();
console.log(`Expired ${expiredCount} approvals`);

// Check if an approval is expired
if (isApprovalExpired(approval)) {
  console.log("This approval has expired");
}

// Get time remaining
const msRemaining = getTimeUntilExpiration(approval);
if (msRemaining !== null && msRemaining < 3600000) {
  console.log("Less than 1 hour remaining!");
}
```

### Direct Send (User-Initiated)

For user-initiated sends from the UI, the approval workflow can be bypassed:

```typescript
import {
  sendEmailDirect,
  sendDraft,
  sendReply,
  sendReplyAll,
} from "@/integrations/gmail";

// ⚠️ WARNING: Only use for user-initiated sends, not agent actions

// Send directly
const result = await sendEmailDirect(client, userId, {
  to: ["recipient@example.com"],
  subject: "Quick note",
  body: "Just wanted to say...",
});

// Send an existing draft
await sendDraft(client, userId, draftId);

// Reply to a message
await sendReply(client, userId, originalMessage, "Thanks!");

// Reply-all
await sendReplyAll(
  client,
  userId,
  originalMessage,
  "Thanks everyone!",
  undefined,
  userEmail
);
```

### API Endpoints

#### Drafts

```
GET /api/integrations/gmail/drafts
```

List all drafts.

Query parameters:

- `maxResults` (number, default: 50)
- `pageToken` (string)

```
POST /api/integrations/gmail/drafts
```

Create a new draft.

Request:

```json
{
  "to": ["recipient@example.com"],
  "cc": ["cc@example.com"],
  "subject": "Subject Line",
  "body": "Email body text",
  "bodyHtml": "<p>Email body HTML</p>",
  "threadId": "thread_123",
  "inReplyTo": "message-id@example.com"
}
```

```
GET /api/integrations/gmail/drafts/[id]
```

Get a specific draft.

```
PUT /api/integrations/gmail/drafts/[id]
```

Update a draft.

```
DELETE /api/integrations/gmail/drafts/[id]
```

Delete a draft.

#### Send

```
POST /api/integrations/gmail/send
```

Send an email or draft.

Request (send new email):

```json
{
  "to": ["recipient@example.com"],
  "subject": "Subject",
  "body": "Content",
  "requireApproval": true,
  "requestedBy": "theo-agent",
  "expiresInMinutes": 1440
}
```

Request (send existing draft):

```json
{
  "draftId": "draft_123"
}
```

Response (with approval):

```json
{
  "success": true,
  "requiresApproval": true,
  "approvalId": "approval_123",
  "draftId": "draft_456",
  "expiresAt": "2024-12-21T16:00:00.000Z"
}
```

Response (direct send):

```json
{
  "success": true,
  "messageId": "msg_123",
  "threadId": "thread_456"
}
```

#### Approvals

```
GET /api/integrations/gmail/approvals
```

List approvals.

Query parameters:

- `status` (string): Filter by status
- `pending` (boolean): Only pending approvals
- `includeExpired` (boolean): Include expired
- `stats` (boolean): Return stats only
- `limit` (number)
- `offset` (number)

```
POST /api/integrations/gmail/approvals
```

Create an approval request.

```
GET /api/integrations/gmail/approvals/[id]
```

Get a specific approval.

```
POST /api/integrations/gmail/approvals/[id]
```

Approve or reject.

Request:

```json
{
  "action": "approve"
}
```

Or:

```json
{
  "action": "reject",
  "notes": "I want to revise this"
}
```

```
DELETE /api/integrations/gmail/approvals/[id]
```

Cancel/reject an approval.

### UI Components

#### Email Preview

```tsx
import { EmailPreview, EmailPreviewCompact } from "@/components/email";

// Full preview
<EmailPreview
  to={["recipient@example.com"]}
  cc={["cc@example.com"]}
  subject="Meeting Follow-up"
  body="Thank you for meeting with me today..."
  bodyHtml="<p>Thank you for meeting with me today...</p>"
  threadId="thread_123"
  showHtml={true}
/>

// Compact preview (for lists)
<EmailPreviewCompact
  to={["recipient@example.com"]}
  subject="Meeting Follow-up"
  snippet="Thank you for meeting..."
  status="pending"
  requestedAt={new Date()}
  expiresAt={new Date(Date.now() + 86400000)}
  onClick={() => openApprovalDialog(approval)}
/>
```

#### Approval Dialog

```tsx
import { ApprovalDialog } from "@/components/email";

<ApprovalDialog
  approval={{
    id: "approval_123",
    to: ["recipient@example.com"],
    cc: [],
    bcc: [],
    subject: "Meeting Follow-up",
    body: "Thank you for meeting...",
    bodyHtml: null,
    threadId: null,
    inReplyTo: null,
    status: "pending",
    requestedAt: new Date(),
    expiresAt: new Date(Date.now() + 86400000),
    requestedBy: "theo-agent",
  }}
  isOpen={isDialogOpen}
  onClose={() => setIsDialogOpen(false)}
  onApprove={async (id) => {
    await fetch(`/api/integrations/gmail/approvals/${id}`, {
      method: "POST",
      body: JSON.stringify({ action: "approve" }),
    });
  }}
  onReject={async (id, notes) => {
    await fetch(`/api/integrations/gmail/approvals/${id}`, {
      method: "POST",
      body: JSON.stringify({ action: "reject", notes }),
    });
  }}
  isLoading={isLoading}
/>;
```

### Database Schema

The `EmailApproval` model stores approval requests:

```prisma
model EmailApproval {
  id            String    @id @default(cuid())
  userId        String

  // Draft reference
  draftId       String    @unique
  gmailDraftId  String?

  // Email content snapshot
  to            String[]
  cc            String[]
  bcc           String[]
  subject       String
  body          String    @db.Text
  bodyHtml      String?   @db.Text

  // Threading
  threadId      String?
  inReplyTo     String?

  // Approval status
  status        String    @default("pending")

  // Metadata
  requestedAt   DateTime  @default(now())
  requestedBy   String?
  expiresAt     DateTime?
  decidedAt     DateTime?
  decidedBy     String?

  // Result tracking
  sentMessageId String?
  sentAt        DateTime?
  errorMessage  String?

  // Context
  notes         String?   @db.Text
  metadata      Json      @default("{}")

  // Relations
  user          User      @relation(...)

  @@index([userId, status])
  @@index([userId, requestedAt(sort: Desc)])
  @@index([expiresAt])
}
```

### Security Considerations

1. **Mandatory Approval**: Agent-initiated sends MUST go through the approval workflow
2. **Audit Logging**: All email actions (create, send, approve, reject) are logged
3. **Expiration**: Approvals expire after a configurable period (default: 24 hours)
4. **User Ownership**: Users can only access their own approvals
5. **Draft Cleanup**: Rejected approvals delete the associated Gmail draft

### File Structure

```
src/integrations/gmail/actions/
├── index.ts          # Public exports
├── types.ts          # TypeScript definitions
├── compose.ts        # Draft creation and utilities
├── approval.ts       # Approval workflow
└── send.ts           # Send operations

src/app/api/integrations/gmail/
├── drafts/
│   ├── route.ts           # List/create drafts
│   └── [id]/route.ts      # Get/update/delete draft
├── send/
│   └── route.ts           # Send email or draft
└── approvals/
    ├── route.ts           # List/create approvals
    └── [id]/route.ts      # Get/approve/reject

src/components/email/
├── index.ts               # Public exports
├── email-preview.tsx      # Email preview component
└── approval-dialog.tsx    # Approval modal
```

---

## Thread View (Chunk 9)

The Thread View component displays email conversations as threaded discussions, allowing users to see all related messages in context.

### API Endpoint

```
GET /api/integrations/gmail/threads/[id]
```

Returns all emails in a thread sorted by date.

Response:

```json
{
  "threadId": "thread_123abc",
  "emails": [
    {
      "id": "email_1",
      "gmailId": "abc123",
      "subject": "Re: Project Update",
      "fromAddress": "sender@example.com",
      "fromName": "John Doe",
      "toAddresses": ["recipient@example.com"],
      "ccAddresses": [],
      "bodyText": "Thanks for the update...",
      "bodyHtml": "<p>Thanks for the update...</p>",
      "internalDate": "2024-12-21T10:00:00.000Z",
      "isRead": true,
      "isStarred": false,
      "hasAttachments": false,
      "labelIds": ["INBOX", "IMPORTANT"]
    }
  ],
  "emailCount": 5
}
```

### UI Component

```tsx
import { ThreadView } from "@/components/email";

// Basic usage
<ThreadView
  threadId="thread_123abc"
  onClose={() => setSelectedThread(null)}
  className="mx-auto max-w-2xl"
/>;
```

Features:

- **Expandable emails** - Click to expand/collapse individual messages
- **Last email expanded** - Most recent message shown expanded by default
- **Visual indicators** - Unread, starred, and attachment badges
- **Responsive design** - Works on mobile and desktop

---

## Sync Configuration

Email sync respects user-configured filters stored in `GmailSyncState`:

| Field             | Type       | Description                                      |
| ----------------- | ---------- | ------------------------------------------------ |
| `syncLabels`      | `String[]` | Only sync emails with these labels (empty = all) |
| `excludeLabels`   | `String[]` | Exclude emails with these labels                 |
| `maxEmailAgeDays` | `Int?`     | Only sync emails from the last N days            |
| `syncAttachments` | `Boolean`  | Whether to sync attachment metadata              |

### How It Works

1. **Full Sync**: Configuration is loaded and used to build Gmail search query
2. **Incremental Sync**: New messages are filtered after fetching

```typescript
// Example: Filter to only sync INBOX and exclude PROMOTIONS
await syncStateRepository.update(userId, {
  syncLabels: ["INBOX", "IMPORTANT"],
  excludeLabels: ["CATEGORY_PROMOTIONS", "SPAM"],
  maxEmailAgeDays: 90, // Only last 90 days
});
```

### Query Building

The sync configuration is converted to a Gmail search query:

```typescript
// With syncLabels: ["INBOX", "IMPORTANT"]
// With excludeLabels: ["SPAM"]
// With maxEmailAgeDays: 30
// Generates: "(label:INBOX OR label:IMPORTANT) -label:SPAM after:2024/11/21 -in:drafts"
```

---

## Testing

### Test Suite

The Gmail integration includes comprehensive unit and integration tests located in `tests/integrations/gmail/`.

#### Test Files

| File                 | Description                             | Tests    |
| -------------------- | --------------------------------------- | -------- |
| `utils.test.ts`      | Email parsing, encoding, query building | ~50      |
| `errors.test.ts`     | Error handling and classification       | ~40      |
| `sync.test.ts`       | Sync job constants and types            | ~30      |
| `actions.test.ts`    | Draft/send/approval operations          | ~50      |
| `extraction.test.ts` | Date, action, topic extraction          | ~60      |
| `mappers.test.ts`    | Contact and email mapping               | ~30      |
| **Total**            |                                         | **~260** |

#### Test Fixtures

Test fixtures are located in `tests/integrations/gmail/fixtures/`:

- `messages.ts` - Gmail message and thread fixtures
- `contacts.ts` - Google Contact fixtures
- `index.ts` - Barrel exports for all fixtures

#### Running Tests

```bash
# Run all Gmail tests
npm test -- tests/integrations/gmail/

# Run specific test file
npm test -- tests/integrations/gmail/utils.test.ts

# Run with coverage
npm test -- tests/integrations/gmail/ --coverage
```

### Manual Testing

1. Start the dev server: `npm run dev`
2. Login with Google (basic scopes)
3. Check integration status: `GET /api/integrations/status`
4. Initiate Gmail connection: `POST /api/integrations/gmail/connect`
5. Follow the returned `authUrl` to grant permissions
6. Verify connection: `GET /api/integrations/status`
7. Trigger sync: `POST /api/integrations/gmail/sync`
8. Test email search: `GET /api/search/emails?q=test`
9. Disconnect: `DELETE /api/integrations/gmail/disconnect`

### Security Review Checklist

- [x] Tokens encrypted at rest (via NextAuth)
- [x] Minimal scope requests (only what's needed)
- [x] All actions audit logged
- [x] Rate limiting enforced (per-user)
- [x] Input validation complete (Zod schemas)
- [x] No sensitive data in logs
- [x] Approval required for agent-initiated sends
- [x] Expiration on pending approvals

---

## Performance Considerations

### Sync Performance

| Metric               | Target       | Actual      |
| -------------------- | ------------ | ----------- |
| Full sync (500 msgs) | < 5 minutes  | ~3 minutes  |
| Incremental sync     | < 30 seconds | ~10 seconds |
| Contact sync (1000)  | < 2 minutes  | ~90 seconds |

### Search Performance

| Metric          | Target  |
| --------------- | ------- |
| Text search     | < 200ms |
| Semantic search | < 500ms |
| Combined search | < 500ms |

### Optimizations Applied

1. **Batch embedding generation** - Process emails in batches of 10-20
2. **Content truncation** - Limit email body to 2000 chars for embeddings
3. **Deduplication** - Skip unchanged emails using content hashing
4. **Priority queuing** - New mail prioritized over full sync
5. **Rate limit awareness** - Built-in delays to respect Gmail quotas

---

## Troubleshooting

### Common Issues

#### Token Refresh Failures

If you see `UNAUTHORIZED` errors:

1. Check that refresh token is stored
2. Verify Google OAuth credentials are valid
3. Try disconnecting and reconnecting Gmail

#### Sync Not Starting

If sync jobs aren't processing:

1. Verify Redis is running: `docker compose ps`
2. Check worker logs: `npm run worker:logs`
3. Verify BullMQ queues: visit Redis Commander at `http://localhost:8081`

#### Missing Emails

If emails aren't appearing:

1. Check sync status: `GET /api/integrations/gmail/sync/status`
2. Verify history ID is valid
3. Trigger full sync if needed

#### Rate Limit Errors

If you see `RATE_LIMITED` errors:

1. Check current quota usage
2. Wait for rate limit window to reset
3. Consider reducing batch sizes

---

## Related Documentation

- [AUTH_SECURITY.md](../AUTH_SECURITY.md) - OAuth and token management
- [INTEGRATIONS_GUIDE.md](../INTEGRATIONS_GUIDE.md) - General integration patterns
- [PHASE_3_PLAN.md](../PHASE_3_PLAN.md) - Full implementation plan
