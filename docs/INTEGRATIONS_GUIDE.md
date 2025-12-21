# Integrations Guide

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [AUTH_SECURITY.md](./AUTH_SECURITY.md), [QUEUE_WORKERS.md](./QUEUE_WORKERS.md)

---

## Overview

Theo integrates with external services like Gmail and Slack to sync context and enable actions. This guide covers the integration architecture and how to build new integrations.

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    INTEGRATION LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   CONNECTED ACCOUNTS                     │    │
│  │  (OAuth tokens, sync state, permissions)                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                          │                                       │
│           ┌──────────────┼──────────────┐                       │
│           ▼              ▼              ▼                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   GMAIL     │  │   SLACK     │  │  CALENDAR   │             │
│  │ Integration │  │ Integration │  │ Integration │             │
│  │             │  │             │  │             │             │
│  │ • Sync      │  │ • Messages  │  │ • Events    │             │
│  │ • Send      │  │ • Channels  │  │ • Reminders │             │
│  │ • Search    │  │ • Users     │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│           │              │              │                       │
│           └──────────────┼──────────────┘                       │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    CONTEXT SERVICES                      │    │
│  │  (People, Events, Tasks, etc.)                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Connected Accounts

### Database Model

```prisma
model ConnectedAccount {
  id                String    @id
  userId            String
  provider          String    // "google", "slack", "microsoft"
  providerAccountId String
  accessToken       String
  refreshToken      String?
  tokenExpires      DateTime?
  scopes            String[]
  lastSyncAt        DateTime?
  syncCursor        Json      @default("{}")
  syncEnabled       Boolean   @default(true)
  status            String    @default("active")
  errorMessage      String?

  @@unique([userId, provider, providerAccountId])
}
```

### Status Values

| Status    | Description                  |
| --------- | ---------------------------- |
| `active`  | Working normally             |
| `expired` | Token expired, needs refresh |
| `revoked` | User revoked access          |
| `error`   | Sync error occurred          |

---

## Gmail Integration

### Setup

```env
# .env.local
GOOGLE_CLIENT_ID="your-client-id"
GOOGLE_CLIENT_SECRET="your-client-secret"
TOKEN_ENCRYPTION_KEY="32-byte-base64-encoded-key"  # For encrypting tokens at rest
```

### Scopes Required

```typescript
// src/lib/auth/scopes.ts
export const GMAIL_SCOPES = {
  READ: "https://www.googleapis.com/auth/gmail.readonly",
  SEND: "https://www.googleapis.com/auth/gmail.send",
  MODIFY: "https://www.googleapis.com/auth/gmail.modify",
  CONTACTS: "https://www.googleapis.com/auth/contacts.readonly",
};

// All scopes needed for full Gmail functionality
export const ALL_GMAIL_SCOPES = [
  GMAIL_SCOPES.READ,
  GMAIL_SCOPES.SEND,
  GMAIL_SCOPES.MODIFY,
  GMAIL_SCOPES.CONTACTS,
];
```

### API Endpoints

| Endpoint                                 | Method | Description             |
| ---------------------------------------- | ------ | ----------------------- |
| `/api/integrations/gmail/connect`        | GET    | Initiate OAuth flow     |
| `/api/integrations/gmail/callback`       | GET    | OAuth callback handler  |
| `/api/integrations/gmail/disconnect`     | DELETE | Remove Gmail connection |
| `/api/integrations/gmail/sync`           | POST   | Trigger sync            |
| `/api/integrations/gmail/status`         | GET    | Get connection status   |
| `/api/integrations/gmail/contacts`       | POST   | Sync contacts           |
| `/api/integrations/gmail/drafts`         | POST   | Create draft            |
| `/api/integrations/gmail/send`           | POST   | Send email              |
| `/api/integrations/gmail/approvals`      | GET    | List pending approvals  |
| `/api/integrations/gmail/approvals/[id]` | POST   | Approve/reject email    |

### Integration Interface

```typescript
// src/integrations/gmail/index.ts
import { GmailClient, createGmailClient } from "@/integrations/gmail";

// Create a client with access token
const client = createGmailClient(accessToken, userId);

// Profile
const profile = await client.getProfile();

// Messages
const messages = await client.listMessages({ labelIds: ["INBOX"] });
const message = await client.getMessage(messageId);
await client.modifyMessage(messageId, { addLabelIds: ["STARRED"] });

// Threads
const threads = await client.listThreads({ maxResults: 50 });
const thread = await client.getThread(threadId);

// Labels
const labels = await client.listLabels();
await client.createLabel("Custom Label", { backgroundColor: "#ff0000" });

// History (for incremental sync)
const history = await client.listHistory({ startHistoryId });

// Drafts
const draft = await client.createDraft({ to, subject, body });
await client.updateDraft(draftId, { subject: "Updated" });
await client.sendDraft(draftId);

// Send directly
await client.sendMessage({ to, subject, body });

// Contacts
const contacts = await client.listContactsParsed({ pageSize: 100 });
```

### Sync Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GMAIL SYNC ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     FULL SYNC                              │   │
│  │  ─ Initial import of all emails (up to configurable max)  │   │
│  │  ─ Syncs labels first, then messages                      │   │
│  │  ─ Saves checkpoints for resumable sync                   │   │
│  │  ─ Queues embedding generation for each batch             │   │
│  │  ─ Captures current historyId for incremental sync        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                      │
│                            ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  INCREMENTAL SYNC                          │   │
│  │  ─ Uses Gmail History API for efficient delta sync        │   │
│  │  ─ Handles messageAdded, messageDeleted, labelsChanged    │   │
│  │  ─ Runs on 5-minute recurring schedule                    │   │
│  │  ─ Falls back to full sync if historyId expired (~30d)    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                            │                                      │
│                            ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  EMBEDDING GENERATION                      │   │
│  │  ─ Batched processing (configurable batch size)           │   │
│  │  ─ Includes subject, body preview, sender, recipients     │   │
│  │  ─ Metadata for filtering (date, labels, importance)      │   │
│  │  ─ Stored in vector database for semantic search          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Email Approval Workflow

For agent-initiated emails, Theo uses an approval workflow:

```typescript
// 1. Agent requests approval to send an email
import { requestApproval } from "@/integrations/gmail";

const result = await requestApproval(client, userId, {
  to: ["recipient@example.com"],
  subject: "Follow-up from our meeting",
  body: "Hi...",
  requestedBy: "theo-agent",
  expiresInMinutes: 60 * 24, // 24 hours
  metadata: {
    conversationId: "conv_123",
    context: "User asked to follow up after the meeting",
  },
});
// Returns { approval, draftId }

// 2. User reviews and approves/rejects
import { approveAndSend, rejectApproval } from "@/integrations/gmail";

// Approve and send
await approveAndSend(client, userId, approvalId, {
  notes: "Looks good, send it",
});

// Or reject
await rejectApproval(userId, approvalId, {
  reason: "Tone is too formal",
});

// 3. Expired approvals are automatically cleaned up
import { expireOverdueApprovals } from "@/integrations/gmail";
await expireOverdueApprovals(); // Run via scheduled job
```

### Content Extraction

Theo extracts structured data from emails:

```typescript
import { processEmailContent } from "@/integrations/gmail";

const result = await processEmailContent(email);

// Result includes:
// - people: Sender and recipients with extracted contact info
// - dates: Mentioned dates, deadlines, meeting times
// - actionItems: Tasks extracted from email body
// - topics: Categorized topics (work, personal, finance, etc.)
```

### Rate Limiting

The Gmail client includes built-in rate limiting:

```typescript
import { createRateLimiter, GMAIL_RATE_LIMITS } from "@/integrations/gmail";

// Rate limits are per-user and respect Gmail API quotas
// Default: 100 quota units/second, 250,000 units/day

// The client automatically:
// - Waits when approaching limits
// - Retries with exponential backoff on 429 errors
// - Tracks quota usage across operations
```

### Error Handling

```typescript
import {
  GmailError,
  GmailErrorCode,
  parseGoogleApiError,
  isRetryableError,
  needsTokenRefresh,
} from "@/integrations/gmail";

try {
  await client.getMessage(messageId);
} catch (error) {
  const gmailError = parseGoogleApiError(error);

  switch (gmailError.code) {
    case GmailErrorCode.UNAUTHORIZED:
      // Token expired - trigger refresh
      break;
    case GmailErrorCode.RATE_LIMITED:
      // Wait and retry
      await sleep(gmailError.retryAfterMs);
      break;
    case GmailErrorCode.NOT_FOUND:
      // Message was deleted
      break;
  }
}
```

### Email Processing

```typescript
interface ProcessEmailResult {
  people: Person[]; // New or updated contacts
  events: Event[]; // Calendar invites
  tasks: Task[]; // Action items extracted
  relationships: Relationship[];
}

async function processEmail(
  userId: string,
  email: GmailMessage
): Promise<ProcessEmailResult> {
  // Extract sender
  const sender = await extractPerson(email.from);

  // Extract recipients
  const recipients = await Promise.all([
    ...email.to.map(extractPerson),
    ...email.cc.map(extractPerson),
  ]);

  // Check for calendar invites
  const events = extractCalendarInvites(email);

  // Extract action items
  const tasks = await extractActionItems(email.body);

  return { people: [sender, ...recipients], events, tasks, relationships };
}
```

### Troubleshooting

For common issues and solutions, see the [Gmail Troubleshooting Guide](./services/GMAIL_TROUBLESHOOTING.md).

---

## Slack Integration

### Setup

```env
# .env.local
SLACK_CLIENT_ID="your-client-id"
SLACK_CLIENT_SECRET="your-client-secret"
SLACK_SIGNING_SECRET="your-signing-secret"
```

### Scopes Required

```typescript
const SLACK_SCOPES = [
  "channels:read",
  "channels:history",
  "users:read",
  "users:read.email",
  "chat:write",
  "im:read",
  "im:history",
];
```

### Integration Interface

```typescript
// src/integrations/slack/index.ts
export interface SlackIntegration {
  // Read operations
  listChannels(userId: string): Promise<Channel[]>;
  getChannelHistory(userId: string, channelId: string): Promise<Message[]>;
  getUsers(userId: string): Promise<SlackUser[]>;

  // Write operations
  sendMessage(
    userId: string,
    channelId: string,
    text: string
  ): Promise<Message>;
  sendDirectMessage(
    userId: string,
    slackUserId: string,
    text: string
  ): Promise<Message>;

  // Sync
  syncWorkspace(userId: string): Promise<SyncResult>;
}
```

---

## Building New Integrations

### Step 1: Define Types

```typescript
// src/integrations/myservice/types.ts
export interface MyServiceConfig {
  apiKey: string;
  baseUrl: string;
}

export interface MyServiceItem {
  id: string;
  name: string;
  // ...
}
```

### Step 2: Create Client

```typescript
// src/integrations/myservice/client.ts
export class MyServiceClient {
  constructor(private config: MyServiceConfig) {}

  async getItems(): Promise<MyServiceItem[]> {
    const response = await fetch(`${this.config.baseUrl}/items`, {
      headers: { Authorization: `Bearer ${this.config.apiKey}` },
    });
    return response.json();
  }

  async createItem(data: CreateItemInput): Promise<MyServiceItem> {
    // ...
  }
}
```

### Step 3: Implement Integration

```typescript
// src/integrations/myservice/index.ts
import { db } from "@/lib/db";
import { MyServiceClient } from "./client";

export async function syncMyService(userId: string): Promise<SyncResult> {
  // Get connected account
  const account = await db.connectedAccount.findFirst({
    where: { userId, provider: "myservice" },
  });

  if (!account) {
    throw new Error("MyService not connected");
  }

  // Create client
  const client = new MyServiceClient({
    apiKey: account.accessToken,
    baseUrl: "https://api.myservice.com",
  });

  // Sync items
  const items = await client.getItems();

  // Process and store
  for (const item of items) {
    await processItem(userId, item);
  }

  // Update sync timestamp
  await db.connectedAccount.update({
    where: { id: account.id },
    data: { lastSyncAt: new Date() },
  });

  return { synced: items.length };
}
```

### Step 4: Add OAuth Flow

```typescript
// src/app/api/integrations/myservice/connect/route.ts
export async function GET() {
  const authUrl = `https://myservice.com/oauth/authorize?${params}`;
  return Response.redirect(authUrl);
}

// src/app/api/integrations/myservice/callback/route.ts
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  // Exchange code for tokens
  const tokens = await exchangeCodeForTokens(code);

  // Store connected account
  await db.connectedAccount.create({
    data: {
      userId: session.user.id,
      provider: "myservice",
      providerAccountId: tokens.userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpires: tokens.expiresAt,
      scopes: tokens.scopes,
    },
  });

  return Response.redirect("/settings/integrations");
}
```

### Step 5: Add Background Sync

```typescript
// src/lib/queue/myservice-worker.ts
import { registerWorker } from "./workers";
import { QUEUE_NAMES } from "./index";
import { syncMyService } from "@/integrations/myservice";

export function initializeMyServiceWorker() {
  return registerWorker(
    QUEUE_NAMES.MYSERVICE_SYNC,
    async (job) => {
      const { userId } = job.data;
      await syncMyService(userId);
    },
    { concurrency: 5 }
  );
}
```

---

## Token Management

### Refresh Token Flow

```typescript
async function getValidToken(accountId: string): Promise<string> {
  const account = await db.connectedAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error("Account not found");
  }

  // Check if token is expired
  if (account.tokenExpires && account.tokenExpires < new Date()) {
    // Refresh token
    const newTokens = await refreshTokens(
      account.provider,
      account.refreshToken
    );

    await db.connectedAccount.update({
      where: { id: accountId },
      data: {
        accessToken: newTokens.accessToken,
        tokenExpires: newTokens.expiresAt,
        status: "active",
      },
    });

    return newTokens.accessToken;
  }

  return account.accessToken;
}
```

### Handle Token Errors

```typescript
async function makeApiCall(
  accountId: string,
  apiCall: () => Promise<Response>
) {
  try {
    return await apiCall();
  } catch (error) {
    if (isTokenExpiredError(error)) {
      // Mark account as expired
      await db.connectedAccount.update({
        where: { id: accountId },
        data: {
          status: "expired",
          errorMessage: "Token expired - re-authentication required",
        },
      });
    }
    throw error;
  }
}
```

---

## Sync Strategies

### Full Sync

Initial sync or recovery:

```typescript
async function fullSync(userId: string) {
  await db.connectedAccount.update({
    where: { userId_provider: { userId, provider: "gmail" } },
    data: { syncCursor: {} }, // Reset cursor
  });

  await addJob(QUEUE_NAMES.EMAIL_SYNC, "sync-gmail", {
    userId,
    syncType: "full",
  });
}
```

### Incremental Sync

Regular updates:

```typescript
async function incrementalSync(userId: string) {
  const account = await db.connectedAccount.findFirst({
    where: { userId, provider: "gmail" },
  });

  await addJob(QUEUE_NAMES.EMAIL_SYNC, "sync-gmail-incremental", {
    userId,
    cursor: account.syncCursor,
    syncType: "incremental",
  });
}
```

### Webhook-Triggered

Real-time updates:

```typescript
// Webhook endpoint
export async function POST(request: Request) {
  const payload = await request.json();

  // Verify webhook signature
  if (!verifySignature(request, payload)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Queue processing
  await addJob(QUEUE_NAMES.EMAIL_SYNC, "process-email", {
    userId: payload.userId,
    messageId: payload.messageId,
  });

  return Response.json({ ok: true });
}
```

---

## Best Practices

### 1. Always Refresh Tokens

```typescript
// ✅ Good - check and refresh
const token = await getValidToken(accountId);
await client.call(token);

// ❌ Bad - use stored token directly
await client.call(account.accessToken);
```

### 2. Handle Rate Limits

```typescript
async function syncWithRateLimiting(items: Item[]) {
  const BATCH_SIZE = 10;
  const DELAY_MS = 1000;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(processItem));
    await sleep(DELAY_MS);
  }
}
```

### 3. Store Sync State

```typescript
// Track progress for resumable syncs
await db.connectedAccount.update({
  where: { id: accountId },
  data: {
    syncCursor: {
      lastMessageId: message.id,
      lastSyncedAt: new Date(),
      page: 5,
    },
  },
});
```

### 4. Log Sync Activity

```typescript
await logAuditEntry({
  userId,
  actionType: "sync",
  actionCategory: "integration",
  entityType: "email",
  metadata: {
    provider: "gmail",
    count: emails.length,
    duration: syncDuration,
  },
});
```

---

## Related Documentation

- [AUTH_SECURITY.md](./AUTH_SECURITY.md) - OAuth configuration
- [QUEUE_WORKERS.md](./QUEUE_WORKERS.md) - Background sync jobs
- [services/CONTEXT_SERVICES.md](./services/CONTEXT_SERVICES.md) - Context storage
- [INTEGRATIONS.md](./INTEGRATIONS.md) - Original design spec
