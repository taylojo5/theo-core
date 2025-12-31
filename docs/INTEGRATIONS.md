# Theo Integrations Strategy

> **Status**: Draft v0.1  
> **Last Updated**: December 2024

## Overview

Integrations are how Theo connects to the user's digital life. They enable context acquisition (reading data) and action execution (writing/sending data). This document outlines the integration architecture and detailed plans for Gmail and Slack.

---

## Integration Architecture

### Core Principles

1. **Minimal Scope**: Request only the permissions needed for current features
2. **User Consent**: Explicit approval before any data access or action
3. **Graceful Degradation**: Theo works without integrations; they enhance, not require
4. **Audit Trail**: Every integration action is logged with full context
5. **Modularity**: Each integration is self-contained with clean interfaces

### Integration Interface

Every integration implements a standard interface:

```typescript
interface Integration {
  // Metadata
  id: string;
  name: string;
  description: string;
  category: "communication" | "productivity" | "storage" | "social";

  // OAuth
  getAuthUrl(scopes: string[]): Promise<string>;
  handleCallback(code: string): Promise<TokenSet>;
  refreshToken(refreshToken: string): Promise<TokenSet>;
  revokeAccess(userId: string): Promise<void>;

  // Capabilities
  capabilities: IntegrationCapability[];

  // Sync
  sync(userId: string, options: SyncOptions): Promise<SyncResult>;

  // Actions
  executeAction(action: IntegrationAction): Promise<ActionResult>;
}

interface IntegrationCapability {
  name: string;
  type: "read" | "write" | "both";
  requiredScopes: string[];
  description: string;
}
```

### Integration Lifecycle

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Connect    │ →  │   Consent    │ →  │    Sync      │ →  │    Active    │
│              │    │              │    │              │    │              │
│ User clicks  │    │ OAuth flow   │    │ Initial data │    │ Ongoing sync │
│ "Connect"    │    │ Scope review │    │ import       │    │ + actions    │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
                                                                   │
                                                                   ▼
                                                           ┌──────────────┐
                                                           │  Disconnect  │
                                                           │              │
                                                           │ Revoke token │
                                                           │ Clear data   │
                                                           └──────────────┘
```

---

## Gmail Integration

### Overview

Gmail is a critical integration for Theo. Email contains rich context about people, events, tasks, and deadlines.

### Capabilities

| Capability    | Type  | Description                       |
| ------------- | ----- | --------------------------------- |
| Read Emails   | Read  | Access email content and metadata |
| Search Emails | Read  | Search across user's mailbox      |
| Read Labels   | Read  | Access label/folder structure     |
| Send Email    | Write | Compose and send emails           |
| Create Draft  | Write | Save email drafts                 |
| Manage Labels | Write | Create/apply/remove labels        |
| Read Contacts | Read  | Access Google Contacts            |

### OAuth Scopes

```typescript
const GMAIL_SCOPES = {
  // Minimal read-only
  readonly: ["https://www.googleapis.com/auth/gmail.readonly"],

  // With send capability
  send: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
  ],

  // Full capability
  full: [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.labels",
    "https://www.googleapis.com/auth/gmail.modify",
  ],

  // Contacts (separate API)
  contacts: ["https://www.googleapis.com/auth/contacts.readonly"],
};
```

### Data Model Mapping

| Gmail Entity            | Theo Entity    | Notes                     |
| ----------------------- | -------------- | ------------------------- |
| Contact                 | Person         | Import name, email, phone |
| Email Sender/Recipient  | Person         | Auto-create if not exists |
| Email Thread            | (raw storage)  | Referenced in context     |
| Email with date         | Event/Deadline | Extract actionable dates  |
| Email with action items | Task           | AI extraction             |

### Sync Strategy

```typescript
interface GmailSyncConfig {
  // What to sync
  syncContacts: boolean;
  syncEmails: boolean;

  // Email filters
  emailLabels: string[]; // Only sync these labels
  emailMaxAge: number; // Days back to sync
  emailExcludeLabels: string[]; // e.g., ['SPAM', 'TRASH']

  // Frequency
  syncIntervalMinutes: number;

  // Processing
  extractPeople: boolean; // Create Person records from senders
  extractEvents: boolean; // Parse dates from content
  extractTasks: boolean; // AI-extract action items
}
```

### Email Processing Pipeline

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Fetch New  │ →  │   Store     │ →  │   Extract   │ →  │   Index     │
│   Emails    │    │    Raw      │    │   Context   │    │   Embed     │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
      │                   │                  │                  │
      ▼                   ▼                  ▼                  ▼
 Gmail API          Raw Storage         AI Processing      Vector Store
 - History ID       - Thread ID         - People            - Semantic
 - Delta sync       - Message ID        - Dates              search
                    - Headers           - Tasks
                    - Body              - Topics
```

### Implementation Structure

```
src/integrations/gmail/
├── index.ts                 # Public API
├── auth.ts                  # OAuth flow
├── client.ts                # Gmail API wrapper
├── sync/
│   ├── messages.ts          # Email sync logic
│   ├── contacts.ts          # Contacts sync
│   └── scheduler.ts         # Background sync jobs
├── actions/
│   ├── send.ts              # Send email action
│   ├── draft.ts             # Create draft action
│   └── labels.ts            # Label management
├── extraction/
│   ├── people.ts            # Extract person info
│   ├── dates.ts             # Extract dates/deadlines
│   └── tasks.ts             # Extract action items
└── types.ts                 # TypeScript types
```

### Example Actions

```typescript
// Send email
await gmail.actions.send({
  to: ["sarah@example.com"],
  subject: "Following up on our conversation",
  body: "Hi Sarah, ...",
  threadId: "optional-thread-to-reply-to",
});

// Create draft for user review
await gmail.actions.createDraft({
  to: ["team@example.com"],
  subject: "Weekly Update",
  body: "...",
  requiresApproval: true, // User must approve before send
});

// Search emails
const results = await gmail.search({
  query: "from:sarah@example.com project update",
  maxResults: 10,
});
```

---

## Slack Integration

### Overview

Slack integration enables Theo to understand team communication context and interact on behalf of the user.

### Capabilities

| Capability    | Type  | Description                                 |
| ------------- | ----- | ------------------------------------------- |
| Read Messages | Read  | Access messages in channels user belongs to |
| Read DMs      | Read  | Access direct messages                      |
| Read Channels | Read  | List channels and membership                |
| Read Users    | Read  | Access workspace user directory             |
| Send Message  | Write | Post messages to channels/DMs               |
| React         | Write | Add emoji reactions                         |
| Update Status | Write | Set user's status                           |

### OAuth Scopes

```typescript
const SLACK_SCOPES = {
  // User token scopes (act as user)
  user: [
    "channels:history",
    "channels:read",
    "groups:history",
    "groups:read",
    "im:history",
    "im:read",
    "mpim:history",
    "mpim:read",
    "users:read",
    "users:read.email",
    "chat:write",
    "reactions:write",
    "users.profile:write",
  ],

  // Bot token scopes (separate bot identity)
  bot: [
    "app_mentions:read",
    "channels:history",
    "channels:read",
    "chat:write",
    "im:history",
    "im:read",
    "reactions:write",
    "users:read",
  ],
};
```

### Data Model Mapping

| Slack Entity        | Theo Entity    | Notes                 |
| ------------------- | -------------- | --------------------- |
| User                | Person         | Import from workspace |
| Channel             | (tag/context)  | Used for filtering    |
| Message mention     | Relationship   | Person ↔ Person       |
| Message with date   | Event/Deadline | Parse from content    |
| Message with action | Task           | AI extraction         |

### Sync Strategy

```typescript
interface SlackSyncConfig {
  // What to sync
  syncUsers: boolean;
  syncMessages: boolean;

  // Message filters
  channelTypes: ("public" | "private" | "dm" | "group_dm")[];
  channelFilter: string[]; // Specific channels to sync
  messageMaxAge: number; // Days back to sync

  // Frequency
  syncIntervalMinutes: number;
  realTimeEnabled: boolean; // WebSocket for live updates

  // Processing
  extractMentions: boolean; // Track who mentions who
  extractTasks: boolean; // AI-extract action items
}
```

### Real-Time Events

Slack offers Socket Mode for real-time events:

```typescript
interface SlackEventHandler {
  // Message events
  onMessage(event: MessageEvent): Promise<void>;
  onMessageChanged(event: MessageChangedEvent): Promise<void>;
  onMessageDeleted(event: MessageDeletedEvent): Promise<void>;

  // Mention events
  onAppMention(event: AppMentionEvent): Promise<void>;

  // Reaction events
  onReactionAdded(event: ReactionEvent): Promise<void>;

  // User events
  onUserChange(event: UserChangeEvent): Promise<void>;
}
```

### Implementation Structure

```
src/integrations/slack/
├── index.ts                 # Public API
├── auth.ts                  # OAuth flow
├── client.ts                # Slack API wrapper
├── sync/
│   ├── users.ts             # User sync logic
│   ├── channels.ts          # Channel metadata sync
│   ├── messages.ts          # Message history sync
│   └── scheduler.ts         # Background sync jobs
├── realtime/
│   ├── socket.ts            # Socket Mode connection
│   └── handlers.ts          # Event handlers
├── actions/
│   ├── message.ts           # Send message action
│   ├── reaction.ts          # Add reaction action
│   └── status.ts            # Update status action
├── extraction/
│   ├── mentions.ts          # Extract @ mentions
│   ├── links.ts             # Extract shared links
│   └── tasks.ts             # Extract action items
└── types.ts                 # TypeScript types
```

### Example Actions

```typescript
// Send message
await slack.actions.sendMessage({
  channel: "C01234567", // or '@username' for DM
  text: "Here is the update you requested...",
  threadTs: "optional-thread-timestamp",
});

// React to message
await slack.actions.addReaction({
  channel: "C01234567",
  timestamp: "1234567890.123456",
  emoji: "thumbsup",
});

// Update user status
await slack.actions.setStatus({
  text: "In a meeting",
  emoji: ":calendar:",
  expiresAt: new Date("2024-12-19T15:00:00Z"),
});

// Search messages
const results = await slack.search({
  query: "project deadline",
  channels: ["C01234567"],
  maxResults: 20,
});
```

---

## Future Integrations Roadmap

### Priority 1 (Near-term)

| Integration           | Purpose                          |
| --------------------- | -------------------------------- |
| **Google Calendar**   | Events, availability, scheduling |
| **Microsoft Outlook** | Alternative email/calendar       |
| **Notion**            | Notes, docs, wikis               |

### Priority 2 (Mid-term)

| Integration     | Purpose                            |
| --------------- | ---------------------------------- |
| **Linear**      | Issue tracking, project management |
| **GitHub**      | Code context, PRs, issues          |
| **Zoom**        | Meeting context, recordings        |
| **Google Meet** | Meeting context                    |

### Priority 3 (Long-term)

| Integration    | Purpose              |
| -------------- | -------------------- |
| **Twitter/X**  | Social context       |
| **LinkedIn**   | Professional network |
| **Salesforce** | CRM data             |
| **HubSpot**    | CRM data             |

---

## Integration Security

### Token Storage

```typescript
// Tokens are encrypted before storage
interface EncryptedToken {
  encryptedData: string; // AES-256-GCM encrypted
  iv: string; // Initialization vector
  authTag: string; // Authentication tag
  keyVersion: number; // For key rotation
}

// Encryption key hierarchy
// Master Key (HSM/KMS) → User Key → Token Encryption
```

### Scope Minimization

```typescript
// Request scopes progressively
const scopeProgression = {
  // Initial connection
  initial: ["gmail.readonly"],

  // When user wants to send email
  sendEmail: ["gmail.readonly", "gmail.send"],

  // When user wants label management
  fullAccess: ["gmail.readonly", "gmail.send", "gmail.labels"],
};
```

### Rate Limiting

```typescript
interface RateLimitConfig {
  gmail: {
    quotaUnitsPerDay: 1_000_000_000; // Google's quota
    requestsPerSecond: 10;
    batchSize: 100;
  };
  slack: {
    requestsPerMinute: 50; // Tier 2 methods
    burstLimit: 5;
  };
}
```

### Error Handling

```typescript
class IntegrationError extends Error {
  constructor(
    public integration: string,
    public code: string,
    public message: string,
    public retryable: boolean,
    public retryAfter?: number
  ) {
    super(message);
  }
}

// Automatic retry with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T>;
```

---

## Testing Strategy

### Unit Tests

- Mock API responses
- Test data transformation
- Test error handling

### Integration Tests

- Use sandbox/test accounts
- Test OAuth flows
- Test sync operations

### E2E Tests

- Full user flows
- Cross-integration scenarios
- Performance benchmarks

---

## Monitoring & Observability

### Metrics

- Sync success/failure rates
- API latency percentiles
- Token refresh frequency
- Rate limit utilization

### Alerts

- Token expiration warnings
- Sync failures
- Rate limit approaching
- Error rate spikes

### Logs

- All API calls logged
- Token refresh events
- Sync operations with duration
- User actions via integrations
