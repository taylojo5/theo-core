# Phase 3 Implementation Plan: Gmail Integration

> **Status**: Ready for Implementation  
> **Created**: December 20, 2024  
> **Target Duration**: 2-3 weeks  
> **Purpose**: Integrate Gmail for email context acquisition and basic email actions

---

## Overview

Phase 3 introduces Gmail integration, enabling Theo to:

- **Read**: Access user's email content and metadata
- **Sync**: Import contacts and email data into the context system
- **Search**: Enable semantic search across emails
- **Act**: Draft and send emails (with user approval)

### Prerequisites (from Phase 0-2 Correction)

Before starting Phase 3, verify these are complete:

- [ ] BullMQ job queue operational (for sync workers)
- [ ] Redis integration working (for rate limiting and caching)
- [ ] OAuth token refresh tested and working
- [ ] Rate limiting in place (protects against API abuse)
- [ ] SSE streaming functional (for real-time sync status)

### Key Metrics

| Metric                | Target                       |
| --------------------- | ---------------------------- |
| Email sync latency    | < 30 seconds for incremental |
| Contact import        | 100% of accessible contacts  |
| Search recall         | > 90% for recent emails      |
| Token refresh success | 99.9%                        |
| Test coverage         | > 80% for Gmail module       |

---

## Implementation Chunks

| Chunk | Description                  | Est. Time | Dependencies          |
| ----- | ---------------------------- | --------- | --------------------- |
| 1     | Gmail OAuth & Scopes         | 3hr       | Token refresh working |
| 2     | Gmail Client Library         | 4hr       | Chunk 1               |
| 3     | Email Database Models        | 2hr       | None                  |
| 4     | Contact Sync Pipeline        | 3hr       | Chunks 2, 3           |
| 5     | Email Sync Worker            | 5hr       | Chunks 2, 3, BullMQ   |
| 6     | Email Content Processing     | 4hr       | Chunk 5               |
| 7     | Email Search & Embeddings    | 4hr       | Chunk 6               |
| 8     | Email Actions (Draft/Send)   | 3hr       | Chunk 2               |
| 9     | Gmail Settings UI            | 3hr       | All prior chunks      |
| 10    | Integration Testing & Polish | 3hr       | All prior chunks      |

**Total Estimated Time**: ~34 hours (2-3 weeks at focused pace)

---

## Chunk 1: Gmail OAuth & Scopes

**Estimated Time**: 3 hours  
**Dependencies**: Token refresh utility from Phase 0-2 Correction  
**Goal**: Enable Gmail-specific OAuth with proper scopes

### Description

Extend the existing Google OAuth configuration to request Gmail-specific scopes. Implement a re-authentication flow for users who already have a basic Google connection but need to grant additional Gmail permissions.

### Tasks

1. Update Google OAuth provider configuration with Gmail scopes
2. Create scope upgrade flow for existing users
3. Add Gmail scope validation utility
4. Create connected accounts management API
5. Test OAuth flow with new scopes

### Implementation Details

#### 1.1 Update OAuth Configuration

Update `src/lib/auth/index.ts` to include Gmail scopes:

```typescript
// Gmail scopes to add
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/contacts.readonly",
];
```

#### 1.2 Scope Upgrade Flow

Create `src/lib/auth/scope-upgrade.ts`:

- Function to check if user has required scopes
- Function to generate re-auth URL with additional scopes
- Callback handler for scope upgrade

#### 1.3 Connected Accounts API

Create endpoints:

- `GET /api/integrations/status` - Check connected integrations
- `POST /api/integrations/gmail/connect` - Initiate Gmail connection
- `DELETE /api/integrations/gmail/disconnect` - Revoke Gmail access

### Files to Create/Modify

```
src/lib/auth/
├── index.ts                    # UPDATE: Add Gmail scopes option
├── scopes.ts                   # NEW: Scope definitions and utilities
└── scope-upgrade.ts            # NEW: Scope upgrade flow

src/app/api/integrations/
├── status/route.ts             # NEW: Integration status
└── gmail/
    ├── connect/route.ts        # NEW: Gmail connection flow
    └── disconnect/route.ts     # NEW: Gmail disconnection
```

### Acceptance Criteria

- [ ] Gmail scopes requested during OAuth
- [ ] Existing users can upgrade scopes
- [ ] Integration status API works
- [ ] Gmail connection/disconnection works
- [ ] Tokens stored with proper scopes

### Documentation Update

After completing this chunk:

- [ ] Update `docs/AUTH_SECURITY.md` with Gmail scopes section
- [ ] Create `docs/services/GMAIL_SERVICE.md` (initial version)

---

## Chunk 2: Gmail Client Library

**Estimated Time**: 4 hours  
**Dependencies**: Chunk 1  
**Goal**: Create a robust Gmail API wrapper with proper error handling

### Description

Build a Gmail client library that wraps the Google Gmail API. This client will handle authentication, rate limiting, error handling, and provide a clean interface for all Gmail operations.

### Tasks

1. Install Google APIs client library
2. Create GmailClient class
3. Implement message listing and fetching
4. Implement label operations
5. Implement contact fetching (via People API)
6. Add retry logic and rate limiting
7. Create comprehensive error types

### Implementation Details

#### 2.1 Install Dependencies

```bash
npm install googleapis
```

#### 2.2 Gmail Client Structure

```typescript
// src/integrations/gmail/client.ts
export class GmailClient {
  constructor(private accessToken: string) {}

  // Message operations
  async listMessages(options?: ListMessagesOptions): Promise<GmailMessageList>;
  async getMessage(
    id: string,
    format?: "full" | "metadata"
  ): Promise<GmailMessage>;
  async getThread(threadId: string): Promise<GmailThread>;

  // Label operations
  async listLabels(): Promise<GmailLabel[]>;
  async getLabel(id: string): Promise<GmailLabel>;

  // Send operations
  async sendMessage(params: SendMessageParams): Promise<GmailMessage>;
  async createDraft(params: CreateDraftParams): Promise<GmailDraft>;

  // Sync operations
  async getHistoryId(): Promise<string>;
  async listHistory(startHistoryId: string): Promise<GmailHistory>;

  // Contact operations (via People API)
  async listContacts(options?: ListContactsOptions): Promise<GoogleContact[]>;
}
```

#### 2.3 Error Handling

```typescript
// src/integrations/gmail/errors.ts
export class GmailError extends Error {
  constructor(
    public code: GmailErrorCode,
    message: string,
    public retryable: boolean,
    public retryAfterMs?: number
  ) {
    super(message);
  }
}

export enum GmailErrorCode {
  UNAUTHORIZED = "UNAUTHORIZED",
  RATE_LIMITED = "RATE_LIMITED",
  NOT_FOUND = "NOT_FOUND",
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED",
  NETWORK_ERROR = "NETWORK_ERROR",
  INVALID_REQUEST = "INVALID_REQUEST",
}
```

### Files to Create

```
src/integrations/gmail/
├── index.ts                    # NEW: Public API exports
├── client.ts                   # NEW: Gmail API client
├── errors.ts                   # NEW: Error types
├── types.ts                    # NEW: TypeScript types
├── rate-limiter.ts             # NEW: Gmail-specific rate limiting
└── utils.ts                    # NEW: Helper utilities
```

### Acceptance Criteria

- [ ] GmailClient connects with valid token
- [ ] Message listing works with pagination
- [ ] Message fetching returns full content
- [ ] Label listing works
- [ ] Contact listing works
- [ ] Rate limiting prevents API abuse
- [ ] Errors are properly typed and retryable

### Documentation Update

After completing this chunk:

- [ ] Update `docs/services/GMAIL_SERVICE.md` with client API reference
- [ ] Add usage examples and error handling guide

---

## Chunk 3: Email Database Models

**Estimated Time**: 2 hours  
**Dependencies**: None (can be done in parallel with Chunk 1-2)  
**Goal**: Create database schema for storing email data

### Description

Extend the Prisma schema to store email messages, threads, labels, and sync state. Design for efficient querying and minimal storage while supporting semantic search.

### Tasks

1. Design email storage schema
2. Create Prisma models
3. Run migrations
4. Create database access utilities
5. Add indexes for common queries

### Implementation Details

#### 3.1 Prisma Schema Additions

```prisma
// Add to prisma/schema.prisma

model Email {
  id              String    @id @default(cuid())
  userId          String
  gmailId         String    @unique
  threadId        String
  historyId       String?

  // Headers
  subject         String?
  fromEmail       String
  fromName        String?
  toEmails        String[]
  ccEmails        String[]
  bccEmails       String[]
  replyTo         String?

  // Content
  snippet         String?
  bodyText        String?
  bodyHtml        String?

  // Metadata
  labelIds        String[]
  isRead          Boolean   @default(false)
  isStarred       Boolean   @default(false)
  isImportant     Boolean   @default(false)
  isDraft         Boolean   @default(false)
  hasAttachments  Boolean   @default(false)

  // Timestamps
  internalDate    DateTime
  receivedAt      DateTime
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  // Relations
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  // Indexes
  @@index([userId, internalDate(sort: Desc)])
  @@index([userId, threadId])
  @@index([userId, fromEmail])
  @@index([gmailId])
}

model EmailLabel {
  id            String   @id @default(cuid())
  userId        String
  gmailId       String
  name          String
  type          String   // system, user
  messageCount  Int      @default(0)

  // Relations
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, gmailId])
}

model GmailSyncState {
  id              String    @id @default(cuid())
  userId          String    @unique
  historyId       String?
  lastSyncAt      DateTime?
  lastFullSyncAt  DateTime?
  syncStatus      String    @default("idle") // idle, syncing, error
  syncError       String?
  emailCount      Int       @default(0)

  // Relations
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

#### 3.2 Email Repository

```typescript
// src/integrations/gmail/repository.ts
export const emailRepository = {
  create: async (email: CreateEmailInput) => { ... },
  upsert: async (email: UpsertEmailInput) => { ... },
  findByGmailId: async (userId: string, gmailId: string) => { ... },
  findByThread: async (userId: string, threadId: string) => { ... },
  search: async (userId: string, query: EmailSearchQuery) => { ... },
  updateSyncState: async (userId: string, state: SyncStateUpdate) => { ... },
};
```

### Files to Create/Modify

```
prisma/
└── schema.prisma               # UPDATE: Add Email models

src/integrations/gmail/
├── repository.ts               # NEW: Database operations
└── mappers.ts                  # NEW: Gmail → DB mappers
```

### Acceptance Criteria

- [ ] Prisma schema compiles
- [ ] Migrations run successfully
- [ ] Email CRUD operations work
- [ ] Sync state tracking works
- [ ] Indexes support efficient queries

### Documentation Update

After completing this chunk:

- [ ] Update `docs/DATABASE_SCHEMA.md` with email tables
- [ ] Add ER diagram for email relationships

---

## Chunk 4: Contact Sync Pipeline

**Estimated Time**: 3 hours  
**Dependencies**: Chunks 2, 3  
**Goal**: Import Google Contacts as People entities

### Description

Create a pipeline to import Google Contacts into the Theo context system as Person entities. Handle deduplication, updates, and relationship creation between contacts.

### Tasks

1. Create contact sync worker job
2. Map Google Contact to Person entity
3. Implement deduplication logic
4. Handle contact photo import (optional)
5. Create sync UI status

### Implementation Details

#### 4.1 Contact Sync Job

```typescript
// src/integrations/gmail/sync/contacts.ts
export async function syncContacts(
  userId: string,
  accessToken: string
): Promise<ContactSyncResult> {
  const client = new GmailClient(accessToken);
  const contacts = await client.listContacts();

  const results = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  for (const contact of contacts) {
    // Map to Person entity
    // Check for existing by email
    // Create or update
  }

  return results;
}
```

#### 4.2 Contact to Person Mapping

```typescript
// src/integrations/gmail/mappers.ts
export function mapContactToPerson(
  contact: GoogleContact,
  userId: string
): CreatePersonInput {
  return {
    userId,
    name:
      contact.names?.[0]?.displayName ||
      contact.emailAddresses?.[0]?.value ||
      "Unknown",
    email: contact.emailAddresses?.[0]?.value,
    phone: contact.phoneNumbers?.[0]?.value,
    company: contact.organizations?.[0]?.name,
    title: contact.organizations?.[0]?.title,
    source: "gmail",
    sourceId: contact.resourceName,
    metadata: {
      googleContact: {
        resourceName: contact.resourceName,
        etag: contact.etag,
      },
    },
  };
}
```

### Files to Create

```
src/integrations/gmail/sync/
├── index.ts                    # NEW: Sync exports
├── contacts.ts                 # NEW: Contact sync logic
└── types.ts                    # NEW: Sync result types

src/app/api/integrations/gmail/
└── sync/
    └── contacts/route.ts       # NEW: Trigger contact sync
```

### Acceptance Criteria

- [ ] Contacts imported as Person entities
- [ ] Deduplication works (by email)
- [ ] Existing persons updated from contacts
- [ ] Source tracking maintained
- [ ] Sync status reported

### Documentation Update

After completing this chunk:

- [ ] Update `docs/services/GMAIL_SERVICE.md` with contact sync section
- [ ] Add contact sync flow diagram

---

## Chunk 5: Email Sync Worker

**Estimated Time**: 5 hours  
**Dependencies**: Chunks 2, 3, BullMQ setup  
**Goal**: Background sync of Gmail messages

### Description

Create a robust email sync pipeline using BullMQ. Implement both full sync (initial import) and incremental sync (delta updates) using Gmail's History API.

### Tasks

1. Create email sync job types
2. Implement full sync (initial import)
3. Implement incremental sync (history API)
4. Handle sync state management
5. Add sync retry and error handling
6. Create sync status API

### Implementation Details

#### 5.1 Sync Job Types

```typescript
// src/integrations/gmail/sync/jobs.ts
export interface FullSyncJobData {
  userId: string;
  accountId: string;
  maxResults?: number;
  labelIds?: string[];
}

export interface IncrementalSyncJobData {
  userId: string;
  accountId: string;
  startHistoryId: string;
}
```

#### 5.2 Full Sync Worker

```typescript
// src/integrations/gmail/sync/full-sync.ts
export async function fullSync(
  userId: string,
  accessToken: string,
  options: FullSyncOptions
): Promise<FullSyncResult> {
  const client = new GmailClient(accessToken);

  // 1. Get current historyId
  // 2. Fetch all messages (paginated)
  // 3. Store in database
  // 4. Update sync state with historyId
  // 5. Queue embedding generation jobs

  return { messagesImported, historyId };
}
```

#### 5.3 Incremental Sync Worker

```typescript
// src/integrations/gmail/sync/incremental-sync.ts
export async function incrementalSync(
  userId: string,
  accessToken: string,
  startHistoryId: string
): Promise<IncrementalSyncResult> {
  const client = new GmailClient(accessToken);

  // 1. Fetch history since historyId
  // 2. Process added/deleted messages
  // 3. Update database
  // 4. Update historyId

  return { messagesAdded, messagesDeleted, newHistoryId };
}
```

#### 5.4 Sync Scheduler

```typescript
// src/integrations/gmail/sync/scheduler.ts
export async function scheduleSync(userId: string) {
  // Schedule incremental sync every 5 minutes
  await addJob(
    QUEUE_NAMES.EMAIL_SYNC,
    JOB_NAMES.SYNC_GMAIL_INCREMENTAL,
    { userId },
    {
      repeat: { every: 5 * 60 * 1000 },
      jobId: `gmail-sync-${userId}`,
    }
  );
}
```

### Files to Create

```
src/integrations/gmail/sync/
├── full-sync.ts                # NEW: Full sync logic
├── incremental-sync.ts         # NEW: Incremental sync logic
├── scheduler.ts                # NEW: Sync scheduling
├── worker.ts                   # NEW: BullMQ worker
└── jobs.ts                     # NEW: Job type definitions

src/app/api/integrations/gmail/sync/
├── route.ts                    # NEW: Trigger sync
└── status/route.ts             # NEW: Sync status
```

### Acceptance Criteria

- [ ] Full sync imports all emails
- [ ] Incremental sync catches new emails
- [ ] Deleted emails marked appropriately
- [ ] History ID tracked correctly
- [ ] Sync status reported in real-time
- [ ] Rate limiting prevents quota issues
- [ ] Retry logic handles transient failures

### Documentation Update

After completing this chunk:

- [ ] Update `docs/services/GMAIL_SERVICE.md` with sync pipeline details
- [ ] Update `docs/QUEUE_WORKERS.md` with Gmail sync worker
- [ ] Add sync architecture diagram

---

## Chunk 6: Email Content Processing

**Estimated Time**: 4 hours  
**Dependencies**: Chunk 5  
**Goal**: Extract structured data from email content

### Description

Process email content to extract actionable information: mentions of people, dates/deadlines, action items, and topics. This enriches the context system with structured data from unstructured email content.

### Tasks

1. Create email content parser
2. Extract people mentions (link to Person entities)
3. Extract dates and potential deadlines
4. Extract action items (potential Tasks)
5. Categorize email topics
6. Store extracted context

### Implementation Details

#### 6.1 Email Processor

```typescript
// src/integrations/gmail/extraction/processor.ts
export interface EmailProcessingResult {
  people: ExtractedPerson[];
  dates: ExtractedDate[];
  actionItems: ExtractedActionItem[];
  topics: string[];
  summary: string;
}

export async function processEmailContent(
  email: Email
): Promise<EmailProcessingResult> {
  // 1. Clean and parse email body
  // 2. Extract email addresses → link to People
  // 3. Parse dates using natural language
  // 4. Identify action items (AI-assisted)
  // 5. Categorize topics
  // 6. Generate summary
}
```

#### 6.2 People Extraction

```typescript
// src/integrations/gmail/extraction/people.ts
export async function extractPeople(
  email: Email,
  userId: string
): Promise<ExtractedPerson[]> {
  // Extract from: to, cc, bcc, mentioned emails in body
  // Match to existing Person entities
  // Create relationships (emailedWith, etc.)
}
```

#### 6.3 Date Extraction

```typescript
// src/integrations/gmail/extraction/dates.ts
export function extractDates(text: string): ExtractedDate[] {
  // Use chrono-node for natural language date parsing
  // Return dates with context (deadline, meeting, etc.)
}
```

### Files to Create

```
src/integrations/gmail/extraction/
├── index.ts                    # NEW: Exports
├── processor.ts                # NEW: Main processor
├── people.ts                   # NEW: People extraction
├── dates.ts                    # NEW: Date extraction
├── action-items.ts             # NEW: Action item extraction
└── topics.ts                   # NEW: Topic categorization

package.json                    # UPDATE: Add chrono-node
```

### Acceptance Criteria

- [ ] Email addresses extracted and linked to People
- [ ] Dates parsed from natural language
- [ ] Action items identified
- [ ] Topics categorized
- [ ] Processing is efficient (< 500ms per email)

### Documentation Update

After completing this chunk:

- [ ] Update `docs/services/GMAIL_SERVICE.md` with extraction details
- [ ] Document extraction accuracy expectations

---

## Chunk 7: Email Search & Embeddings

**Estimated Time**: 4 hours  
**Dependencies**: Chunk 6  
**Goal**: Enable semantic search across emails

### Description

Generate vector embeddings for emails and enable semantic search. Integrate with the existing search infrastructure to provide a unified search experience.

### Tasks

1. Create email embedding generation
2. Store embeddings in vector store
3. Integrate with unified search
4. Add email-specific search filters
5. Test search recall and relevance

### Implementation Details

#### 7.1 Email Embedding

```typescript
// src/integrations/gmail/embeddings.ts
export async function generateEmailEmbedding(email: Email): Promise<void> {
  // Create searchable text from email
  const text = [
    email.subject,
    email.fromName,
    email.snippet,
    email.bodyText?.slice(0, 2000), // Limit for token count
  ]
    .filter(Boolean)
    .join(" ");

  // Generate embedding
  const embedding = await generateEmbedding(text);

  // Store with metadata
  await storeEmbedding({
    userId: email.userId,
    entityType: "email",
    entityId: email.id,
    content: text,
    embedding,
    metadata: {
      subject: email.subject,
      from: email.fromEmail,
      date: email.internalDate,
      threadId: email.threadId,
    },
  });
}
```

#### 7.2 Email Search Integration

```typescript
// src/services/search/email-search.ts
export async function searchEmails(
  userId: string,
  query: string,
  options: EmailSearchOptions
): Promise<EmailSearchResult[]> {
  // 1. Generate query embedding
  // 2. Search vector store for emails
  // 3. Apply filters (date range, labels, etc.)
  // 4. Return ranked results
}
```

### Files to Create/Modify

```
src/integrations/gmail/
└── embeddings.ts               # NEW: Email embedding logic

src/services/search/
├── index.ts                    # UPDATE: Add email search
└── email-search.ts             # NEW: Email-specific search

src/app/api/search/
└── emails/route.ts             # NEW: Email search endpoint
```

### Acceptance Criteria

- [ ] Email embeddings generated correctly
- [ ] Semantic search returns relevant emails
- [ ] Filters work (date, label, sender)
- [ ] Search performance < 500ms
- [ ] Integrates with unified search

### Documentation Update

After completing this chunk:

- [ ] Update `docs/services/SEARCH_SERVICES.md` with email search
- [ ] Add search query examples

---

## Chunk 8: Email Actions (Draft/Send)

**Estimated Time**: 3 hours  
**Dependencies**: Chunk 2  
**Goal**: Enable drafting and sending emails with approval

### Description

Implement email composition actions with mandatory user approval. These are high-stakes actions that Theo can prepare but the user must approve.

### Tasks

1. Create draft composition utility
2. Implement draft creation via API
3. Implement send with approval
4. Add email preview component
5. Create approval workflow
6. Audit log all email actions

### Implementation Details

#### 8.1 Email Composer

```typescript
// src/integrations/gmail/actions/compose.ts
export interface ComposeEmailParams {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  threadId?: string; // For replies
  inReplyTo?: string;
}

export async function createDraft(
  accessToken: string,
  params: ComposeEmailParams
): Promise<GmailDraft> {
  const client = new GmailClient(accessToken);
  return client.createDraft(params);
}

export async function sendEmail(
  accessToken: string,
  draftId: string
): Promise<GmailMessage> {
  const client = new GmailClient(accessToken);
  return client.sendDraft(draftId);
}
```

#### 8.2 Approval Workflow

```typescript
// src/integrations/gmail/actions/approval.ts
export interface EmailApproval {
  id: string;
  userId: string;
  draftId: string;
  status: "pending" | "approved" | "rejected";
  params: ComposeEmailParams;
  createdAt: Date;
  decidedAt?: Date;
}

export async function requestApproval(
  userId: string,
  params: ComposeEmailParams
): Promise<EmailApproval> {
  // 1. Create draft in Gmail
  // 2. Create approval record
  // 3. Notify user (via SSE)
}

export async function approveAndSend(approvalId: string): Promise<void> {
  // 1. Validate approval exists and is pending
  // 2. Send the draft
  // 3. Update approval status
  // 4. Log to audit
}
```

### Files to Create

```
src/integrations/gmail/actions/
├── index.ts                    # NEW: Exports
├── compose.ts                  # NEW: Email composition
├── approval.ts                 # NEW: Approval workflow
└── send.ts                     # NEW: Send logic

src/app/api/integrations/gmail/
├── drafts/route.ts             # NEW: Draft management
├── send/route.ts               # NEW: Send with approval
└── approvals/
    ├── route.ts                # NEW: List approvals
    └── [id]/route.ts           # NEW: Approve/reject

src/components/email/
├── email-preview.tsx           # NEW: Email preview
└── approval-dialog.tsx         # NEW: Approval UI
```

### Acceptance Criteria

- [ ] Drafts created in user's Gmail
- [ ] Approval required before send
- [ ] User can preview and edit
- [ ] User can approve or reject
- [ ] All actions audit logged
- [ ] SSE notifications for new approvals

### Documentation Update

After completing this chunk:

- [ ] Update `docs/services/GMAIL_SERVICE.md` with actions API
- [ ] Document approval workflow
- [ ] Add security considerations

---

## Chunk 9: Gmail Settings UI

**Estimated Time**: 3 hours  
**Dependencies**: All prior chunks  
**Goal**: User interface for Gmail configuration

### Description

Create a settings page for Gmail integration management. Allow users to connect/disconnect, configure sync settings, view sync status, and manage approvals.

### Tasks

1. Create Gmail settings page
2. Add connection status component
3. Add sync configuration options
4. Show sync history and status
5. List pending approvals
6. Add email statistics display

### Implementation Details

#### 9.1 Settings Page

```typescript
// src/app/(dashboard)/settings/integrations/gmail/page.tsx
export default async function GmailSettingsPage() {
  return (
    <div>
      <h1>Gmail Integration</h1>
      <GmailConnectionStatus />
      <GmailSyncSettings />
      <GmailSyncHistory />
      <GmailPendingApprovals />
      <GmailStatistics />
    </div>
  );
}
```

#### 9.2 Component Structure

```
src/components/integrations/gmail/
├── connection-status.tsx       # Connection state and actions
├── sync-settings.tsx           # Sync configuration form
├── sync-history.tsx            # Recent sync activity
├── pending-approvals.tsx       # Approval queue
└── statistics.tsx              # Email counts, etc.
```

### Files to Create

```
src/app/(dashboard)/settings/
└── integrations/
    └── gmail/
        └── page.tsx            # NEW: Gmail settings page

src/components/integrations/gmail/
├── index.ts                    # NEW: Exports
├── connection-status.tsx       # NEW
├── sync-settings.tsx           # NEW
├── sync-history.tsx            # NEW
├── pending-approvals.tsx       # NEW
└── statistics.tsx              # NEW
```

### Acceptance Criteria

- [ ] Settings page loads correctly
- [ ] Connection status accurate
- [ ] Sync can be triggered manually
- [ ] Sync settings configurable
- [ ] Pending approvals displayed
- [ ] Statistics show email counts

### Documentation Update

After completing this chunk:

- [ ] Update `docs/FRONTEND.md` with Gmail settings
- [ ] Add screenshots to documentation

---

## Chunk 10: Integration Testing & Polish

**Estimated Time**: 3 hours  
**Dependencies**: All prior chunks  
**Goal**: Comprehensive testing and production readiness

### Description

Create integration tests for the Gmail module, fix any edge cases, optimize performance, and prepare for production deployment.

### Tasks

1. Create integration test suite
2. Test OAuth flow end-to-end
3. Test sync pipeline
4. Test email actions
5. Performance optimization
6. Error handling audit
7. Security review

### Implementation Details

#### 10.1 Test Suite

```typescript
// src/integrations/gmail/__tests__/gmail.integration.test.ts
describe("Gmail Integration", () => {
  describe("OAuth", () => {
    test("should connect with valid credentials");
    test("should refresh expired tokens");
    test("should handle revoked access");
  });

  describe("Sync", () => {
    test("should perform full sync");
    test("should perform incremental sync");
    test("should handle sync errors");
  });

  describe("Actions", () => {
    test("should create draft");
    test("should require approval for send");
    test("should send after approval");
  });

  describe("Search", () => {
    test("should return relevant results");
    test("should filter by date");
    test("should filter by label");
  });
});
```

#### 10.2 Performance Optimization

- Batch embedding generation
- Optimize database queries
- Add caching for frequently accessed data
- Profile and optimize hot paths

#### 10.3 Security Review Checklist

- [ ] Tokens encrypted at rest
- [ ] Minimal scope requests
- [ ] All actions audit logged
- [ ] Rate limiting enforced
- [ ] Input validation complete
- [ ] No sensitive data in logs

### Files to Create

```
src/integrations/gmail/__tests__/
├── gmail.integration.test.ts   # NEW: Integration tests
├── client.test.ts              # NEW: Client unit tests
├── sync.test.ts                # NEW: Sync unit tests
└── fixtures/                   # NEW: Test fixtures
    ├── messages.json
    └── contacts.json
```

### Acceptance Criteria

- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Build succeeds
- [ ] Performance meets targets
- [ ] Security checklist complete

### Documentation Update

After completing this chunk:

- [ ] Finalize `docs/services/GMAIL_SERVICE.md`
- [ ] Update `docs/INTEGRATIONS_GUIDE.md`
- [ ] Update main `README.md` with Gmail feature
- [ ] Create troubleshooting guide
- [ ] Update `docs/BUILD_LOG.md` with Phase 3 completion

---

## Implementation Order

The recommended order for efficient development:

```
Week 1 (Foundation):
├── Day 1-2: Chunk 1 (OAuth) + Chunk 3 (Database - parallel)
├── Day 3-4: Chunk 2 (Client Library)
└── Day 5: Chunk 4 (Contact Sync)

Week 2 (Core Sync):
├── Day 1-2: Chunk 5 (Email Sync Worker)
├── Day 3: Chunk 6 (Content Processing)
└── Day 4-5: Chunk 7 (Search & Embeddings)

Week 3 (Actions & Polish):
├── Day 1: Chunk 8 (Email Actions)
├── Day 2: Chunk 9 (Settings UI)
└── Day 3-4: Chunk 10 (Testing & Polish)
```

---

## Risk Mitigation

| Risk                   | Mitigation                                     |
| ---------------------- | ---------------------------------------------- |
| OAuth token expiration | Robust refresh flow (Chunk 1)                  |
| Gmail API rate limits  | Per-user rate limiting, exponential backoff    |
| Large mailboxes        | Pagination, background sync, progress tracking |
| Token revocation       | Graceful degradation, re-auth flow             |
| API quota exceeded     | Monitoring, alerts, quota management           |
| Privacy concerns       | Minimal data retention, encryption, audit logs |

---

## Success Criteria

Phase 3 is complete when:

- [ ] Gmail OAuth with proper scopes works
- [ ] Contacts import as Person entities
- [ ] Emails sync in background
- [ ] Semantic search returns relevant emails
- [ ] Draft/send with approval works
- [ ] Settings UI allows configuration
- [ ] All tests pass (> 80% coverage)
- [ ] Documentation complete
- [ ] Zero critical bugs
- [ ] Performance meets targets

---

## Post-Phase 3 Considerations

After Phase 3, consider:

1. **Google Calendar Integration** (natural extension)
2. **Email Templates** (common responses)
3. **Smart Categorization** (AI-powered labels)
4. **Email Analytics** (response time, volume trends)
5. **Scheduled Sending** (delay send)

These would make good additions in a Phase 3.5 or as part of Phase 6 polish.

---

## Future Service Extraction Considerations

### Why We're Building In-App First

The Gmail integration is being built directly into the theo-core monolith rather than as a separate microservice. This is intentional for the current stage:

| Approach               | Pros                                                         | Cons                                                   |
| ---------------------- | ------------------------------------------------------------ | ------------------------------------------------------ |
| **Monolith (current)** | Faster development, shared infrastructure, simpler debugging | Coupling risk, shared resources                        |
| **Microservice**       | Independent scaling, failure isolation                       | IPC overhead, operational complexity, slower iteration |

**At pre-launch stage, development velocity and simplicity outweigh isolation benefits.**

### Design for Extraction

The Gmail module is designed with clean boundaries to enable future extraction if needed:

```
src/integrations/gmail/
├── index.ts              ← Public API (the future service contract)
├── client.ts             ← Could become standalone package
├── repository.ts         ← Data access layer (abstracts Prisma)
├── types.ts              ← Could become shared types package
├── sync/
│   └── worker.ts         ← Already runs in BullMQ (process isolation)
└── actions/
    └── approval.ts       ← Defines cross-service workflow
```

### Extraction-Ready Patterns

#### 1. Interface-Driven Design

All external interactions go through `GmailClient`:

```typescript
// This interface IS the service contract
export interface IGmailClient {
  listMessages(options?: ListOptions): Promise<GmailMessage[]>;
  getMessage(id: string): Promise<GmailMessage>;
  sendMessage(params: SendParams): Promise<GmailMessage>;
  // ...
}
```

If extracted, consumers would call the same interface via HTTP/gRPC instead of direct import.

#### 2. Repository Abstraction

Data access is abstracted through the repository pattern:

```typescript
// Current: Direct Prisma calls
export const emailRepository = {
  create: (data) => db.email.create({ data }),
  // ...
};

// Future: Could become API calls to email service
export const emailRepository = {
  create: (data) => fetch("/api/email-service/emails", { body: data }),
  // ...
};
```

#### 3. BullMQ Worker Isolation

Sync workers already run out-of-process via BullMQ:

```typescript
// This worker could run in a separate service with no code changes
registerWorker(QUEUE_NAMES.EMAIL_SYNC, async (job) => {
  await syncEmails(job.data.userId);
});
```

#### 4. No Framework Coupling

Integration code does NOT import:

- Next.js specific APIs (`next/server`, etc.)
- React components
- App router utilities

This means the Gmail module can be extracted without rewriting.

### When to Extract

Consider extracting Gmail to a separate service when:

| Signal                             | Threshold                       |
| ---------------------------------- | ------------------------------- |
| Sync workers overwhelming main app | CPU > 80% during sync           |
| Need independent deployment        | Gmail changes > 2x/week         |
| Team scaling                       | Dedicated integration team      |
| Multi-product usage                | Second product needs Gmail      |
| Failure isolation critical         | Gmail downtime affects core app |

### Extraction Checklist

When the time comes to extract, here's the path:

1. **Create new service repository**

   ```
   theo-gmail-service/
   ├── src/
   │   ├── client.ts       # Copy from integrations/gmail/
   │   ├── sync/           # Copy workers
   │   └── api/            # New HTTP/gRPC endpoints
   └── package.json
   ```

2. **Create shared types package**

   ```
   @theo/gmail-types/
   ├── src/
   │   ├── messages.ts
   │   ├── contacts.ts
   │   └── events.ts
   └── package.json
   ```

3. **Update theo-core to consume service**

   ```typescript
   // Before: Direct import
   import { GmailClient } from "@/integrations/gmail";

   // After: HTTP client
   import { GmailServiceClient } from "@theo/gmail-service-client";
   ```

4. **Migrate BullMQ workers**
   - Deploy workers in new service
   - Update queue consumers
   - Deprecate in-app workers

5. **Database considerations**
   - Email tables could stay in main DB (simpler)
   - Or migrate to service-owned DB (cleaner separation)

### What Stays in theo-core

Even after extraction, these remain in the main app:

- **Integration settings UI** - Part of dashboard
- **OAuth callback handlers** - NextAuth integration
- **User preferences** - Stored with user record
- **Audit logs** - Central audit system
- **Search integration** - Unified search calls Gmail service

### Cost-Benefit Analysis

| Extraction Effort          | Estimated Time |
| -------------------------- | -------------- |
| Create service scaffolding | 2-3 days       |
| Extract and adapt code     | 3-5 days       |
| Create service client      | 1-2 days       |
| Update theo-core consumers | 2-3 days       |
| Testing and deployment     | 2-3 days       |
| **Total**                  | **10-16 days** |

This investment makes sense only when the signals above are clearly present.

---

### Summary

**Current approach:** Build Gmail integration in-app with clean module boundaries.

**Future option:** Extract to microservice using the documented patterns when scaling demands it.

**Key principle:** Design for extraction, but don't extract prematurely.
