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
```

### Scopes Required

```typescript
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
];
```

### Integration Interface

```typescript
// src/integrations/gmail/index.ts
export interface GmailIntegration {
  // Sync operations
  syncEmails(userId: string, options?: SyncOptions): Promise<SyncResult>;

  // Read operations
  listThreads(userId: string, options?: ListOptions): Promise<Thread[]>;
  getThread(userId: string, threadId: string): Promise<Thread>;
  searchEmails(userId: string, query: string): Promise<Email[]>;

  // Write operations
  sendEmail(userId: string, email: SendEmailInput): Promise<Email>;
  replyToThread(
    userId: string,
    threadId: string,
    reply: ReplyInput
  ): Promise<Email>;

  // Draft operations
  createDraft(userId: string, draft: DraftInput): Promise<Draft>;
  updateDraft(
    userId: string,
    draftId: string,
    draft: DraftInput
  ): Promise<Draft>;
}
```

### Sync Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    GMAIL SYNC FLOW                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Get ConnectedAccount for user                           │
│  2. Refresh token if expired                                │
│  3. Fetch new emails since lastSyncAt                       │
│  4. For each email:                                         │
│     a. Extract people (from, to, cc)                        │
│     b. Extract events (if invitation)                       │
│     c. Extract tasks (if action required)                   │
│     d. Store relationships                                  │
│  5. Update syncCursor and lastSyncAt                       │
│  6. Queue embedding generation                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
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
