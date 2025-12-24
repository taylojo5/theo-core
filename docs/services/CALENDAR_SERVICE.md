# Calendar Integration Service

> **Status**: Phase 4 - Complete ✅  
> **Last Updated**: December 2024  
> **Related**: [AUTH_SECURITY.md](../AUTH_SECURITY.md), [INTEGRATIONS_GUIDE.md](../INTEGRATIONS_GUIDE.md)

---

## Overview

The Calendar integration enables Theo to:

- **Read**: Access user's calendar events and metadata
- **Sync**: Import events from Google Calendar into the context system
- **Search**: Enable semantic search across calendar events
- **Act**: Create, update, and delete events (with user approval)

---

## Implementation Status

| Chunk | Description                  | Status      |
| ----- | ---------------------------- | ----------- |
| 0     | Security & OAuth Foundation  | ✅ Complete |
| 1     | Module Foundation            | ✅ Complete |
| 2     | Database Models & Migrations | ✅ Complete |
| 3     | Calendar Client Library      | ✅ Complete |
| 4     | Calendar Mappers             | ✅ Complete |
| 5     | Calendar Repository          | ✅ Complete |
| 6     | Full Sync Pipeline           | ✅ Complete |
| 7     | Incremental Sync & Webhooks  | ✅ Complete |
| 8     | Event Actions & Approval     | ✅ Complete |
| 9     | API Routes                   | ✅ Complete |
| 10    | Calendar UI                  | ✅ Complete |
| 11    | Integration Testing          | ✅ Complete |
| 12    | Polish & Review              | ✅ Complete |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CALENDAR INTEGRATION                          │
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
│  │                   Calendar Client                         │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │  Calendars  │  │   Events     │  │   Webhooks     │  │   │
│  │  │  List/Get   │  │  CRUD Ops    │  │  Registration  │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Sync Workers                           │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │ Full Sync   │  │ Incremental  │  │ Webhook        │  │   │
│  │  │             │  │ Sync         │  │ Processing     │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Storage Layer                           │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │  Calendars  │  │   Events     │  │  Embeddings    │  │   │
│  │  │  (Prisma)   │  │  (Prisma)    │  │   (pgvector)   │  │   │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## OAuth & Scopes

### Required Scopes

| Scope                                                  | Purpose             |
| ------------------------------------------------------ | ------------------- |
| `https://www.googleapis.com/auth/calendar.readonly`    | Read calendar data  |
| `https://www.googleapis.com/auth/calendar.events`      | Manage events       |
| `https://www.googleapis.com/auth/calendar.settings.readonly` | Read settings |

### Scope Management

```typescript
import {
  CALENDAR_SCOPES,
  ALL_CALENDAR_SCOPES,
  hasCalendarReadAccess,
  hasCalendarWriteAccess,
  getCalendarScopeStatus,
} from "@/integrations/calendar";

// Check individual capabilities
const scopes = parseScopes(account.scope);
const canRead = hasCalendarReadAccess(scopes);
const canWrite = hasCalendarWriteAccess(scopes);

// Get full scope status
const status = getCalendarScopeStatus(scopes);
// {
//   hasRead: true,
//   hasWrite: true,
//   hasSettings: false,
//   missingScopes: [...],
// }
```

### Scope Upgrade Flow

Calendar uses the same scope upgrade flow as Gmail. See [GMAIL_SERVICE.md](./GMAIL_SERVICE.md#scope-upgrade-flow) for details.

---

## Calendar Client Library

The Calendar client provides a type-safe wrapper around the Google Calendar API with built-in rate limiting, retry logic, and error handling.

### Basic Usage

```typescript
import { CalendarClient, createCalendarClient } from "@/integrations/calendar";

// Create a client
const client = createCalendarClient(accessToken, userId);

// Or with custom config
const client = new CalendarClient({
  accessToken,
  userId,
  enableRateLimiting: true,
  maxRetries: 3,
  timeoutMs: 30000,
});
```

### Calendar Operations

```typescript
// List calendars
const calendars = await client.listCalendars();

// Get specific calendar
const calendar = await client.getCalendar(calendarId);
```

### Event Operations

```typescript
// List events
const { events, nextPageToken, nextSyncToken } = await client.listEvents(
  calendarId,
  {
    timeMin: new Date(),
    timeMax: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    maxResults: 100,
    singleEvents: true, // Expand recurring events
  }
);

// Get single event
const event = await client.getEvent(calendarId, eventId);

// Create event
const created = await client.createEvent(calendarId, {
  summary: "Team Meeting",
  start: { dateTime: "2024-12-25T10:00:00", timeZone: "America/New_York" },
  end: { dateTime: "2024-12-25T11:00:00", timeZone: "America/New_York" },
  attendees: [{ email: "colleague@example.com" }],
  conferenceData: {
    createRequest: { requestId: "unique-id" },
  },
});

// Update event
await client.updateEvent(calendarId, eventId, {
  summary: "Updated Meeting Title",
});

// Delete event
await client.deleteEvent(calendarId, eventId);

// Respond to event invitation
await client.respondToEvent(calendarId, eventId, "accepted");
```

### Webhook Operations

```typescript
// Register webhook for calendar changes
const webhook = await client.watchCalendar(calendarId, {
  channelId: "unique-channel-id",
  webhookUrl: "https://your-app.com/api/integrations/calendar/webhook",
  expirationMs: 7 * 24 * 60 * 60 * 1000, // 7 days max
});

// Stop watching
await client.stopChannel(channelId, resourceId);
```

### Error Handling

```typescript
import {
  CalendarError,
  CalendarErrorCode,
  isCalendarError,
  isRetryableError,
  needsTokenRefresh,
  needsScopeUpgrade,
  isSyncTokenExpired,
} from "@/integrations/calendar";

try {
  await client.getEvent(calendarId, eventId);
} catch (error) {
  if (isCalendarError(error)) {
    switch (error.code) {
      case CalendarErrorCode.UNAUTHORIZED:
        // Token expired, need refresh
        break;
      case CalendarErrorCode.RATE_LIMITED:
        // Wait and retry
        console.log(`Retry after ${error.retryAfterMs}ms`);
        break;
      case CalendarErrorCode.NOT_FOUND:
        // Event doesn't exist
        break;
      case CalendarErrorCode.SYNC_TOKEN_EXPIRED:
        // Need full sync
        break;
    }
  }
}
```

### Rate Limiting

```typescript
import {
  CalendarRateLimiter,
  createCalendarRateLimiter,
  CALENDAR_RATE_LIMITS,
  CALENDAR_QUOTA_UNITS,
} from "@/integrations/calendar";

// Create a rate limiter
const limiter = createCalendarRateLimiter(userId);

// Check if operation is allowed
const result = await limiter.check("events.list");
if (result.allowed) {
  // Proceed with operation
} else {
  console.log(`Wait ${result.waitMs}ms`);
}
```

---

## Sync Pipeline

### Full Sync

The full sync imports all calendar data:

1. Fetch all calendars user has access to
2. Store calendars, mark primary
3. For each selected calendar, fetch all events (paginated)
4. Store events with embeddings scheduled
5. Store sync token for future incremental sync

```typescript
import { fullCalendarSync } from "@/integrations/calendar";

const result = await fullCalendarSync(userId, {
  forceRefresh: false, // Use cached data if available
  calendarIds: undefined, // Sync all selected calendars
});

console.log(`Synced ${result.eventsProcessed} events`);
console.log(`Calendars: ${result.calendarsProcessed}`);
```

### Incremental Sync

Uses sync tokens for efficient delta updates:

```typescript
import { incrementalCalendarSync } from "@/integrations/calendar";

const result = await incrementalCalendarSync(userId);

console.log(`Added: ${result.eventsAdded}`);
console.log(`Updated: ${result.eventsUpdated}`);
console.log(`Deleted: ${result.eventsDeleted}`);
```

### Webhook-Based Real-Time Updates

Webhooks notify Theo of calendar changes in real-time:

```typescript
import {
  registerWebhook,
  processWebhookNotification,
  renewExpiringWebhooks,
} from "@/integrations/calendar";

// Register webhook for user's primary calendar
await registerWebhook(userId, calendarId);

// Process incoming webhook (called by API route)
await processWebhookNotification(channelId, resourceId);

// Renew expiring webhooks (called by scheduler)
await renewExpiringWebhooks();
```

---

## Event Actions & Approval Workflow

All event modifications require approval (following Gmail pattern):

1. Agent requests action (create, update, delete, respond)
2. Approval record created with event snapshot
3. User approves or rejects
4. On approval, action executed against Google API
5. Result synced back to local DB

### Create Event

```typescript
import {
  requestEventCreation,
  executeEventCreation,
} from "@/integrations/calendar";

// Request approval for new event
const approval = await requestEventCreation(userId, {
  calendarId: "primary",
  summary: "Project Kickoff",
  start: { dateTime: "2024-12-25T14:00:00" },
  end: { dateTime: "2024-12-25T15:00:00" },
  attendees: [{ email: "team@example.com" }],
});

console.log(`Approval ID: ${approval.id}`);

// After user approves
const event = await executeEventCreation(approval.id);
```

### Update Event

```typescript
import {
  requestEventUpdate,
  executeEventUpdate,
} from "@/integrations/calendar";

const approval = await requestEventUpdate(userId, eventId, {
  summary: "Updated Meeting Title",
  start: { dateTime: "2024-12-25T15:00:00" },
});

// After user approves
const updated = await executeEventUpdate(approval.id);
```

### Delete Event

```typescript
import {
  requestEventDeletion,
  executeEventDeletion,
} from "@/integrations/calendar";

const approval = await requestEventDeletion(userId, eventId, "Meeting cancelled");

// After user approves
await executeEventDeletion(approval.id);
```

### Respond to Event

```typescript
import {
  requestEventResponse,
  executeEventResponse,
} from "@/integrations/calendar";

const approval = await requestEventResponse(userId, eventId, "accepted");

// After user approves
await executeEventResponse(approval.id);
```

### Approval Management

```typescript
import {
  approveCalendarAction,
  rejectCalendarAction,
  getPendingApprovals,
  expireOldApprovals,
} from "@/integrations/calendar";

// Get pending approvals
const pending = await getPendingApprovals(userId);

// Approve
await approveCalendarAction(userId, approvalId);

// Reject with notes
await rejectCalendarAction(userId, approvalId, "Changed my mind");

// Expire old approvals (called by scheduler)
await expireOldApprovals();
```

### Conflict Detection

```typescript
import {
  detectConflicts,
  hasHighSeverityConflicts,
  formatConflictForDisplay,
} from "@/integrations/calendar";

const conflicts = await detectConflicts(userId, startTime, endTime, {
  excludeEventId: editingEventId,
});

if (hasHighSeverityConflicts(conflicts)) {
  console.log("High severity conflicts detected:");
  conflicts.forEach((c) => console.log(formatConflictForDisplay(c)));
}
```

---

## API Endpoints

### Calendars

```
GET /api/integrations/calendar/calendars
```

Returns list of user's calendars.

```
PATCH /api/integrations/calendar/calendars/[id]
```

Update calendar settings (isSelected, isHidden).

### Sync

```
GET /api/integrations/calendar/sync
```

Get sync status.

```
POST /api/integrations/calendar/sync
```

Trigger sync (full or incremental).

Request:
```json
{
  "type": "full",
  "force": false
}
```

### Events

```
GET /api/integrations/calendar/events
```

List events with filters.

Query parameters:
- `startDate` - Filter events starting after this date
- `endDate` - Filter events ending before this date
- `calendarId` - Filter by calendar
- `limit` - Max results (default: 50)
- `offset` - Pagination offset

```
POST /api/integrations/calendar/events
```

Request event creation (with approval).

```
GET /api/integrations/calendar/events/[id]
```

Get event details.

```
PATCH /api/integrations/calendar/events/[id]
```

Request event update (with approval).

```
DELETE /api/integrations/calendar/events/[id]
```

Request event deletion (with approval).

### Approvals

```
GET /api/integrations/calendar/approvals
```

List pending approvals.

```
GET /api/integrations/calendar/approvals/[id]
```

Get approval details.

```
POST /api/integrations/calendar/approvals/[id]
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
  "notes": "Scheduling conflict"
}
```

### Webhooks

```
POST /api/integrations/calendar/webhook
```

Handle Google push notifications. This endpoint is called by Google when calendar changes occur.

---

## Database Models

### Calendar

Stores user's calendar list with preferences:

```prisma
model Calendar {
  id               String  @id @default(cuid())
  userId           String
  googleCalendarId String
  
  name             String
  description      String?
  timeZone         String?
  
  isPrimary        Boolean @default(false)
  isOwner          Boolean @default(false)
  accessRole       String
  
  backgroundColor  String?
  foregroundColor  String?
  
  isSelected       Boolean @default(true)
  isHidden         Boolean @default(false)
  
  user   User    @relation(...)
  events Event[]
  
  @@unique([userId, googleCalendarId])
}
```

### CalendarSyncState

Tracks sync progress and webhook configuration:

```prisma
model CalendarSyncState {
  id     String @id @default(cuid())
  userId String @unique
  
  syncToken           String?
  syncTokenSetAt      DateTime?
  lastSyncAt          DateTime?
  lastFullSyncAt      DateTime?
  
  fullSyncPageToken   String?
  fullSyncProgress    Int       @default(0)
  fullSyncStartedAt   DateTime?
  
  syncStatus          String    @default("idle")
  syncError           String?
  
  eventCount          Int       @default(0)
  calendarCount       Int       @default(0)
  
  webhookChannelId    String?
  webhookResourceId   String?
  webhookExpiration   DateTime?
  
  syncCalendarIds     String[]  @default([])
  excludeCalendarIds  String[]  @default([])
  
  user User @relation(...)
}
```

### CalendarApproval

Stores event action approval requests:

```prisma
model CalendarApproval {
  id          String  @id @default(cuid())
  userId      String
  
  actionType  String  // create, update, delete, respond
  calendarId  String
  eventId     String?
  
  eventSnapshot Json
  
  status      String  @default("pending")
  
  requestedAt DateTime  @default(now())
  requestedBy String?
  expiresAt   DateTime?
  decidedAt   DateTime?
  decidedBy   String?
  
  resultEventId String?
  errorMessage  String?
  notes         String?  @db.Text
  metadata      Json     @default("{}")
  
  user User @relation(...)
  
  @@index([userId, status])
  @@index([expiresAt])
}
```

### Event (Calendar Fields)

The existing Event model is extended with Calendar-specific fields:

```prisma
model Event {
  // ... existing fields ...
  
  // Google Calendar fields
  googleEventId     String?
  googleCalendarId  String?
  calendarId        String?
  recurringEventId  String?
  
  recurrence        Json?
  attendees         Json?
  organizer         Json?
  creator           Json?
  conferenceData    Json?
  reminders         Json?
  
  iCalUID           String?
  sequence          Int       @default(0)
  etag              String?
  htmlLink          String?
  hangoutLink       String?
  
  calendar Calendar? @relation(...)
  
  @@index([googleEventId])
  @@index([googleCalendarId])
}
```

---

## Schedulers & Lifecycle

The Calendar integration runs several background schedulers:

### Webhook Renewal Scheduler

Renews webhooks before they expire (max 7 days lifetime):

```typescript
// Started automatically on server startup via instrumentation.ts
// Runs every 6 hours to check for expiring webhooks
```

### Approval Expiration Scheduler

Expires old approval requests:

```typescript
// Started automatically on server startup via instrumentation.ts
// Runs every 15 minutes to expire old approvals
```

### Initialization

Calendar schedulers are initialized in `instrumentation.ts`:

```typescript
import { initializeCalendarSync } from "@/integrations/calendar";

await initializeCalendarSync();
```

---

## File Structure

```
src/integrations/calendar/
├── index.ts                     # Public exports
├── constants.ts                 # Configuration constants
├── types.ts                     # TypeScript types
├── errors.ts                    # Typed error classes
├── logger.ts                    # Structured logging
├── scopes.ts                    # OAuth scope utilities
├── client.ts                    # Google Calendar API client
├── rate-limiter.ts              # Rate limiting
├── mappers.ts                   # API ↔ DB mappers
├── repository.ts                # Database access
├── actions/
│   ├── index.ts                 # Action exports
│   ├── types.ts                 # Action types
│   ├── create.ts                # Event creation
│   ├── update.ts                # Event updates
│   ├── delete.ts                # Event deletion
│   ├── respond.ts               # Event responses
│   ├── approval.ts              # Approval workflow
│   └── conflicts.ts             # Conflict detection
└── sync/
    ├── index.ts                 # Sync exports
    ├── types.ts                 # Sync types
    ├── full-sync.ts             # Full sync
    ├── incremental-sync.ts      # Incremental sync
    ├── webhook.ts               # Webhook handling
    ├── jobs.ts                  # Job definitions
    ├── scheduler.ts             # Scheduled jobs
    └── utils.ts                 # Sync utilities

src/app/api/integrations/calendar/
├── calendars/
│   ├── route.ts
│   └── [id]/route.ts
├── sync/route.ts
├── events/
│   ├── route.ts
│   └── [id]/route.ts
├── approvals/
│   ├── route.ts
│   └── [id]/route.ts
├── connect/route.ts
├── disconnect/route.ts
└── webhook/route.ts

src/components/integrations/calendar/
├── index.ts
├── CalendarSettings.tsx
├── CalendarList.tsx
├── CalendarApprovals.tsx
└── CalendarSyncStatus.tsx

tests/integrations/calendar/
├── mocks/
│   ├── index.ts
│   ├── mock-client.ts
│   └── mock-factories.ts
├── mappers.test.ts
├── actions.test.ts
├── sync.test.ts
└── webhook.test.ts
```

---

## Security Considerations

### Rate Limiting

Calendar API has quotas that must be respected:

| Limit Type              | Value                |
| ----------------------- | -------------------- |
| Per-user per second     | 100 quota units      |
| Per-user per minute     | 1500 quota units     |

Different operations consume different quota units:

| Operation         | Quota Units |
| ----------------- | ----------- |
| calendarList.list | 1           |
| events.list       | 1           |
| events.get        | 1           |
| events.insert     | 3           |
| events.update     | 3           |
| events.delete     | 2           |
| events.watch      | 1           |

### Approval Required

All event modifications from the agent require user approval. This ensures users maintain control over their calendar.

### Audit Logging

All calendar actions are logged:

```typescript
await logAuditEntry({
  userId,
  actionType: "create",
  actionCategory: "integration",
  entityType: "calendar_event",
  inputSummary: "Created meeting: Team Standup",
});
```

---

## Testing

### Test Files

| File                 | Description              | Tests |
| -------------------- | ------------------------ | ----- |
| `mappers.test.ts`    | Data mapping functions   | ~80   |
| `actions.test.ts`    | Event CRUD operations    | ~50   |
| `sync.test.ts`       | Sync pipeline tests      | ~40   |
| `webhook.test.ts`    | Webhook handling         | ~30   |
| **Total**            |                          | ~200  |

### Running Tests

```bash
# Run all Calendar tests
npm test -- tests/integrations/calendar/

# Run specific test file
npm test -- tests/integrations/calendar/mappers.test.ts

# Run with coverage
npm test -- tests/integrations/calendar/ --coverage
```

---

## Performance Considerations

### Sync Performance

| Metric               | Target       | Actual      |
| -------------------- | ------------ | ----------- |
| Full sync (500 events) | < 2 minutes | ~90 seconds |
| Incremental sync     | < 30 seconds | ~10 seconds |
| Webhook processing   | < 5 seconds  | ~2 seconds  |

### Optimizations Applied

1. **Batch operations** - Events upserted in batches
2. **Checkpoint resume** - Full sync can resume from interruption
3. **Sync tokens** - Incremental sync fetches only changes
4. **Webhook debouncing** - Multiple notifications coalesced
5. **Rate limit awareness** - Built-in delays to respect quotas

---

## Related Documentation

- [AUTH_SECURITY.md](../AUTH_SECURITY.md) - OAuth and token management
- [INTEGRATIONS_GUIDE.md](../INTEGRATIONS_GUIDE.md) - General integration patterns
- [DATABASE_SCHEMA.md](../DATABASE_SCHEMA.md) - Database models
- [GMAIL_SERVICE.md](./GMAIL_SERVICE.md) - Gmail integration (similar patterns)

