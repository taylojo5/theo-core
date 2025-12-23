# Phase 4: Google Calendar Integration - Chunk Plan

> **Status**: Planning v1.0  
> **Created**: December 22, 2024  
> **Duration**: Weeks 11-13  
> **Dependencies**: Phase 1 (Core Foundation), Phase 3 (Gmail Integration for OAuth patterns)

---

## Overview

This document breaks down Phase 4 (Google Calendar Integration) into manageable implementation chunks. Each chunk includes architecture notes, implementation guidance, testing requirements, and documentation tasks.

**Phase Goal**: Integrate Google Calendar to give Theo awareness of the user's schedule, enabling intelligent scheduling, event management, and time-aware decision making.

---

## Chunk Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            FOUNDATIONAL CHUNKS                                   │
│                                                                                 │
│  Chunk 0: Security & OAuth Foundation                                          │
│      │                                                                          │
│      ▼                                                                          │
│  Chunk 1: Module Foundation (types, constants, logger, errors)                  │
│      │                                                                          │
│      ├────────────────┬────────────────────────────────────────────────────┐   │
│      ▼                ▼                                                    ▼   │
│  Chunk 2:         Chunk 3:                                             Chunk 4:│
│  Database         Calendar                                             Calendar│
│  Models &         Client                                               Mappers │
│  Migrations       Library                                                      │
│      │                │                                                    │   │
│      └────────────────┴─────────────────┬──────────────────────────────────┘   │
└─────────────────────────────────────────│───────────────────────────────────────┘
                                          │
┌─────────────────────────────────────────│───────────────────────────────────────┐
│                         FEATURE CHUNKS  │                                        │
│                                         ▼                                        │
│                            Chunk 5: Calendar Repository                          │
│                                 │                                               │
│                    ┌────────────┴────────────┐                                  │
│                    ▼                         ▼                                  │
│               Chunk 6:                   Chunk 7:                               │
│               Full Sync                  Incremental Sync                       │
│               Pipeline                   & Webhooks                             │
│                    │                         │                                  │
│                    └───────────┬─────────────┘                                  │
│                                ▼                                                │
│                           Chunk 8:                                              │
│                           Event Actions &                                       │
│                           Approval Workflow                                     │
│                                │                                                │
│                    ┌───────────┴───────────┐                                    │
│                    ▼                       ▼                                    │
│               Chunk 9:                Chunk 10:                                 │
│               API Routes              Agent Integration                         │
│                    │                       │                                    │
│                    └───────────┬───────────┘                                    │
│                                ▼                                                │
│                           Chunk 11:                                             │
│                           Calendar UI                                           │
└─────────────────────────────────────────────────────────────────────────────────┘
                                          │
┌─────────────────────────────────────────│───────────────────────────────────────┐
│                        FINALIZATION     │                                        │
│                                         ▼                                        │
│                           Chunk 12: Integration Testing                          │
│                                         │                                        │
│                                         ▼                                        │
│                           Chunk 13: Polish & Review                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Parallelization Analysis

| Chunks | Can Run in Parallel? | Notes |
|--------|---------------------|-------|
| 0 → 1 | ❌ Sequential | 1 depends on 0 |
| 2, 3, 4 | ✅ Parallel | All depend only on Chunk 1 |
| 5 | ❌ Sequential | Depends on 2, 3, 4 |
| 6, 7 | ✅ Parallel | Both depend on 5 |
| 8 | ❌ Sequential | Depends on 6 + 7 |
| 9, 10 | ✅ Parallel | Both depend on 8 |
| 11 | ❌ Sequential | Depends on 9 |
| 12, 13 | ❌ Sequential | Final phases |

---

## Chunk 0: Security & OAuth Foundation

**Estimated Time**: 2-3 hours  
**Dependencies**: None (Phase 1 & 3 complete)  
**Goal**: Extend OAuth configuration to include Calendar scopes and prepare security utilities.

### Prerequisites

- [ ] Phase 3 complete (Gmail OAuth patterns established)
- [ ] OAuth consent screen configured in Google Cloud Console

### Architecture Notes

Google Calendar uses the same OAuth flow as Gmail. We need to:
1. Add Calendar scopes to the existing Google OAuth configuration
2. Implement scope detection utilities to check if user has Calendar access
3. Leverage existing scope upgrade flow from Phase 3

**Scope Strategy**:
- Start with read-only scope (`calendar.readonly`) for sync
- Request write scope (`calendar.events`) when user initiates event creation
- Use incremental authorization (request only when needed)

### Tasks

1. [ ] Add Calendar scopes to `src/lib/auth/config.ts`
   ```typescript
   CALENDAR_SCOPES: [
     'https://www.googleapis.com/auth/calendar.readonly',
     'https://www.googleapis.com/auth/calendar.events',
   ]
   ```

2. [ ] Create scope detection utility in `src/integrations/calendar/scopes.ts`
   - `hasCalendarReadScope(scopes: string[]): boolean`
   - `hasCalendarWriteScope(scopes: string[]): boolean`
   - `getRequiredCalendarScopes(action: 'read' | 'write'): string[]`

3. [ ] Add Calendar-specific rate limiting config
   - Calendar API has similar limits to Gmail (~100 QPS)
   - Reuse existing rate limiter pattern from Gmail

4. [ ] Create CSRF helper for Calendar state-changing endpoints
   - Reuse existing CSRF pattern from Gmail

### Files to Create/Modify

```
src/lib/auth/
├── config.ts                    # UPDATE: Add CALENDAR_SCOPES

src/integrations/calendar/
├── scopes.ts                    # NEW: Scope detection utilities
```

### Security Checklist

- [ ] Calendar scopes follow principle of least privilege
- [ ] Scope detection handles edge cases (missing scopes, expired tokens)
- [ ] Rate limiting configured before any API calls implemented

### Testing Requirements

- [ ] Unit tests for scope detection functions
- [ ] Test scope upgrade flow detection
- [ ] Test rate limiting configuration

### Documentation Updates

- [ ] Update `docs/AUTH_SECURITY.md` with Calendar scopes section
- [ ] Add OAuth scope reference to Phase 4 docs

### Acceptance Criteria

- [ ] All Calendar scopes defined and documented
- [ ] Scope detection utilities working
- [ ] Rate limiting config ready
- [ ] No TypeScript errors
- [ ] All tests pass

---

## Chunk 1: Module Foundation

**Estimated Time**: 2-3 hours  
**Dependencies**: Chunk 0  
**Goal**: Establish the foundational structure for the Calendar integration module.

### Prerequisites

- [ ] Chunk 0 complete

### Architecture Notes

Following the pattern established in Gmail integration:
- Structured logging with child loggers
- Typed error classes with error codes
- Centralized constants file
- Comprehensive TypeScript types

**Module Structure**:
```
src/integrations/calendar/
├── index.ts          # Public exports
├── constants.ts      # Configuration constants
├── types.ts          # TypeScript types
├── errors.ts         # Typed error classes
├── logger.ts         # Structured logging
```

### Tasks

1. [ ] Create `src/integrations/calendar/constants.ts`
   - Sync configuration (batch sizes, timeouts)
   - Rate limiting constants
   - Default values for calendar settings
   - Webhook configuration

2. [ ] Create `src/integrations/calendar/types.ts`
   - `GoogleCalendar` interface (API response mapping)
   - `GoogleEvent` interface (API response mapping)
   - `CalendarSyncOptions` type
   - `EventActionType` enum
   - `CalendarAccessRole` enum

3. [ ] Create `src/integrations/calendar/errors.ts`
   - `CalendarError` base class
   - `CalendarAuthError` - token/scope issues
   - `CalendarSyncError` - sync failures
   - `CalendarApiError` - API errors with status codes
   - `CalendarConflictError` - scheduling conflicts

4. [ ] Create `src/integrations/calendar/logger.ts`
   - Main `calendarLogger` 
   - Child loggers: `syncLogger`, `clientLogger`, `actionsLogger`, `webhookLogger`

5. [ ] Create `src/integrations/calendar/index.ts`
   - Export public API

### Files to Create

```
src/integrations/calendar/
├── index.ts          # NEW: Public exports
├── constants.ts      # NEW: Configuration constants
├── types.ts          # NEW: TypeScript types
├── errors.ts         # NEW: Typed error classes
├── logger.ts         # NEW: Structured logging
```

### Security Checklist

- [ ] Error messages don't leak sensitive information
- [ ] Logger configured to redact sensitive fields

### Testing Requirements

- [ ] Unit tests for error class instantiation
- [ ] Test error code extraction from API errors
- [ ] Test logger child creation

### Documentation Updates

- [ ] Create `docs/services/CALENDAR_SERVICE.md` (stub for now)

### Acceptance Criteria

- [ ] All foundational files created
- [ ] Types comprehensive for Calendar API
- [ ] Constants follow Gmail pattern
- [ ] Errors provide useful debugging info
- [ ] Logger properly structured
- [ ] No TypeScript errors
- [ ] All tests pass

---

## Chunk 2: Database Models & Migrations

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 1  
**Goal**: Create database schema for Calendar integration.

### Prerequisites

- [ ] Chunk 1 complete

### Architecture Notes

Three new models needed:
1. **CalendarSyncState** - Tracks sync progress per user (mirrors GmailSyncState)
2. **Calendar** - Stores user's calendars for multi-calendar support
3. **CalendarApproval** - For agent-initiated event actions

**Extending Event Model**:
The existing `Event` model needs Calendar-specific fields. Rather than creating a separate model, we extend `Event` with optional calendar fields. This allows:
- Existing events to coexist with synced calendar events
- Unified event queries across sources
- Gradual migration if needed

### Tasks

1. [ ] Add `CalendarSyncState` model to `prisma/schema.prisma`
   ```prisma
   model CalendarSyncState {
     id     String @id @default(cuid())
     userId String @unique
     
     // Sync tokens
     syncToken           String?
     syncTokenSetAt      DateTime?
     lastSyncAt          DateTime?
     lastFullSyncAt      DateTime?
     
     // Full sync checkpoint
     fullSyncPageToken   String?
     fullSyncProgress    Int       @default(0)
     fullSyncStartedAt   DateTime?
     
     // Status
     syncStatus          String    @default("idle")
     syncError           String?
     
     // Statistics
     eventCount          Int       @default(0)
     calendarCount       Int       @default(0)
     
     // Webhook
     webhookChannelId    String?
     webhookResourceId   String?
     webhookExpiration   DateTime?
     
     // Configuration
     syncCalendarIds     String[]  @default([])
     excludeCalendarIds  String[]  @default([])
     
     // Timestamps
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     
     user User @relation(fields: [userId], references: [id], onDelete: Cascade)
   }
   ```

2. [ ] Add `Calendar` model to `prisma/schema.prisma`
   ```prisma
   model Calendar {
     id               String  @id @default(cuid())
     userId           String
     googleCalendarId String
     
     // Display
     name             String
     description      String?
     timeZone         String?
     
     // Classification
     isPrimary        Boolean @default(false)
     isOwner          Boolean @default(false)
     accessRole       String  // owner, writer, reader, freeBusyReader
     
     // Appearance
     backgroundColor  String?
     foregroundColor  String?
     
     // User preferences
     isSelected       Boolean @default(true)
     isHidden         Boolean @default(false)
     
     // Timestamps
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     
     user User @relation(fields: [userId], references: [id], onDelete: Cascade)
     
     @@unique([userId, googleCalendarId])
     @@index([userId])
   }
   ```

3. [ ] Add `CalendarApproval` model to `prisma/schema.prisma`
   ```prisma
   model CalendarApproval {
     id          String  @id @default(cuid())
     userId      String
     
     // Action
     actionType  String  // create, update, delete, respond
     calendarId  String
     eventId     String? // For update/delete
     
     // Snapshot
     eventSnapshot Json
     
     // Status
     status      String  @default("pending")
     
     // Timing
     requestedAt DateTime  @default(now())
     requestedBy String?
     expiresAt   DateTime?
     decidedAt   DateTime?
     decidedBy   String?
     
     // Result
     resultEventId String?
     errorMessage  String?
     notes         String?  @db.Text
     
     // Metadata
     metadata    Json      @default("{}")
     
     // Timestamps
     createdAt   DateTime  @default(now())
     updatedAt   DateTime  @updatedAt
     
     user User @relation(fields: [userId], references: [id], onDelete: Cascade)
     
     @@index([userId, status])
     @@index([expiresAt])
   }
   ```

4. [ ] Extend `Event` model with Calendar fields
   ```prisma
   // Add to existing Event model:
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
   
   // Add relation
   calendar Calendar? @relation(fields: [calendarId], references: [id])
   
   // Add indexes
   @@index([googleEventId])
   @@index([googleCalendarId])
   ```

5. [ ] Add User relations
   ```prisma
   // In User model, add:
   calendars         Calendar[]
   calendarSyncState CalendarSyncState?
   calendarApprovals CalendarApproval[]
   ```

6. [ ] Create migration
   ```bash
   npx prisma migrate dev --name add_calendar_models
   ```

7. [ ] Verify migration applies cleanly

### Files to Create/Modify

```
prisma/
├── schema.prisma                      # UPDATE: Add Calendar models
├── migrations/
│   └── YYYYMMDD_add_calendar_models/
│       └── migration.sql              # NEW: Generated migration
```

### Security Checklist

- [ ] Cascade deletes configured (user deletion cleans up calendar data)
- [ ] Indexes on userId for row-level security queries
- [ ] No sensitive data stored unencrypted

### Testing Requirements

- [ ] Migration applies without errors
- [ ] Migration rollback works
- [ ] Basic CRUD operations work via Prisma client

### Documentation Updates

- [ ] Update `docs/DATABASE_SCHEMA.md` with new models

### Acceptance Criteria

- [ ] All models created in schema
- [ ] Migration generates successfully
- [ ] Migration applies to dev database
- [ ] No Prisma validation errors
- [ ] Documentation updated

---

## Chunk 3: Calendar Client Library

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 1  
**Goal**: Create a thin wrapper around Google Calendar API with rate limiting.

### Prerequisites

- [ ] Chunk 1 complete (types, errors, logger available)

### Architecture Notes

The Calendar Client follows the same pattern as Gmail Client:
- Thin wrapper over Google API
- Automatic token refresh
- Rate limiting with exponential backoff
- Typed responses
- Retry logic for transient failures

**Key API Endpoints**:
- `CalendarList.list()` - List user's calendars
- `Events.list()` - List events with filtering
- `Events.get()` - Get single event
- `Events.insert()` - Create event
- `Events.update()` - Update event
- `Events.delete()` - Delete event
- `Events.watch()` - Set up push notifications

### Tasks

1. [ ] Create `src/integrations/calendar/client.ts`
   
   ```typescript
   export class CalendarClient {
     constructor(accessToken: string);
     
     // Calendar operations
     listCalendars(): Promise<GoogleCalendar[]>;
     getCalendar(calendarId: string): Promise<GoogleCalendar>;
     
     // Event operations
     listEvents(calendarId: string, options?: ListEventsOptions): Promise<EventListResponse>;
     getEvent(calendarId: string, eventId: string): Promise<GoogleEvent>;
     createEvent(calendarId: string, event: EventInput): Promise<GoogleEvent>;
     updateEvent(calendarId: string, eventId: string, event: EventUpdate): Promise<GoogleEvent>;
     deleteEvent(calendarId: string, eventId: string): Promise<void>;
     
     // Event response
     respondToEvent(calendarId: string, eventId: string, response: ResponseStatus): Promise<GoogleEvent>;
     
     // Webhooks
     watchCalendar(calendarId: string, channelId: string, webhookUrl: string, expiration?: Date): Promise<WatchResponse>;
     stopWatching(channelId: string, resourceId: string): Promise<void>;
   }
   ```

2. [ ] Implement calendar listing with pagination
   - Handle `nextPageToken` for large calendar lists
   - Map API response to typed interface

3. [ ] Implement event listing with sync token support
   - Support `syncToken` for incremental sync
   - Handle `pageToken` for pagination
   - Filter by `timeMin`, `timeMax`, `updatedMin`
   - Handle recurring events expansion

4. [ ] Implement event CRUD operations
   - Create with automatic Meet link generation (optional)
   - Update with `etag` for conflict detection
   - Delete with proper cleanup

5. [ ] Implement webhook registration
   - Generate unique channel IDs
   - Set appropriate expiration (max 7 days)
   - Handle renewal before expiration

6. [ ] Add rate limiting
   - Use token bucket algorithm
   - Share quota pool with Gmail if needed
   - Implement exponential backoff on 429

7. [ ] Add retry logic
   - Retry on 5xx errors
   - Retry on network timeouts
   - Don't retry on 4xx (except 429)

### Files to Create

```
src/integrations/calendar/
├── client.ts                    # NEW: Calendar API client
├── rate-limiter.ts              # NEW: Rate limiting (may extend Gmail's)
```

### Security Checklist

- [ ] Access token not logged
- [ ] API errors don't leak tokens
- [ ] Webhook URLs use HTTPS only

### Testing Requirements

- [ ] Unit tests for all client methods with mocked responses
- [ ] Test pagination handling
- [ ] Test sync token handling
- [ ] Test rate limiting behavior
- [ ] Test retry logic
- [ ] Test error handling for each error type

### Documentation Updates

- [ ] Add Calendar API patterns to service docs
- [ ] Document rate limiting strategy

### Acceptance Criteria

- [ ] All client methods implemented
- [ ] Rate limiting working
- [ ] Retry logic tested
- [ ] Comprehensive error handling
- [ ] All tests pass
- [ ] No TypeScript errors

---

## Chunk 4: Calendar Mappers

**Estimated Time**: 2-3 hours  
**Dependencies**: Chunk 1, Chunk 2  
**Goal**: Create bidirectional mappers between Google Calendar API and database models.

### Prerequisites

- [ ] Chunk 1 complete (types available)
- [ ] Chunk 2 complete (database models defined)

### Architecture Notes

Mappers serve two purposes:
1. **API → DB**: Convert Google Calendar API responses to Prisma models
2. **DB → API**: Convert Prisma models to Google Calendar API format (for creates/updates)

**Key Considerations**:
- Handle timezone conversions properly
- Preserve all attendee metadata
- Map recurrence rules correctly
- Handle all-day events (date vs datetime)

### Tasks

1. [ ] Create `src/integrations/calendar/mappers.ts`

2. [ ] Implement Calendar mappers
   ```typescript
   export function mapGoogleCalendarToDb(
     calendar: GoogleCalendar,
     userId: string
   ): Prisma.CalendarCreateInput;
   
   export function mapDbCalendarToGoogle(
     calendar: Calendar
   ): Partial<GoogleCalendar>;
   ```

3. [ ] Implement Event mappers
   ```typescript
   export function mapGoogleEventToDb(
     event: GoogleEvent,
     userId: string,
     calendarId: string
   ): Prisma.EventCreateInput;
   
   export function mapDbEventToGoogle(
     event: Event
   ): GoogleEventInput;
   
   export function mapEventUpdateToGoogle(
     updates: Partial<Event>
   ): Partial<GoogleEventInput>;
   ```

4. [ ] Implement attendee mapping
   ```typescript
   export function mapAttendees(
     attendees: GoogleAttendee[]
   ): EventAttendee[];
   
   export function mapAttendeesToGoogle(
     attendees: EventAttendee[]
   ): GoogleAttendee[];
   ```

5. [ ] Implement recurrence mapping
   ```typescript
   export function parseRecurrenceRules(
     recurrence: string[]
   ): RecurrenceInfo;
   
   export function formatRecurrenceRules(
     info: RecurrenceInfo
   ): string[];
   ```

6. [ ] Handle timezone conversions
   ```typescript
   export function normalizeEventTime(
     dateTime: GoogleDateTime,
     userTimezone: string
   ): Date;
   
   export function formatEventTime(
     date: Date,
     timezone: string,
     allDay: boolean
   ): GoogleDateTime;
   ```

### Files to Create

```
src/integrations/calendar/
├── mappers.ts                   # NEW: Data mappers
```

### Security Checklist

- [ ] Attendee emails sanitized
- [ ] External links validated

### Testing Requirements

- [ ] Unit tests for each mapper function
- [ ] Test timezone edge cases
- [ ] Test all-day event handling
- [ ] Test recurring event mapping
- [ ] Test attendee status mapping
- [ ] Round-trip tests (API → DB → API)

### Documentation Updates

- [ ] Document mapping conventions

### Acceptance Criteria

- [ ] All mappers implemented
- [ ] Timezone handling correct
- [ ] Recurrence parsing works
- [ ] All tests pass
- [ ] No TypeScript errors

---

## Chunk 5: Calendar Repository

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunks 2, 3, 4  
**Goal**: Create database access layer for Calendar operations.

### Prerequisites

- [ ] Chunks 2, 3, 4 complete

### Architecture Notes

Repository pattern following Gmail integration:
- Clean separation of database logic from business logic
- Typed queries and mutations
- Support for batch operations
- Soft delete support (using existing Event pattern)

### Tasks

1. [ ] Create `src/integrations/calendar/repository.ts`

2. [ ] Implement SyncState repository
   ```typescript
   export const calendarSyncStateRepository = {
     get(userId: string): Promise<CalendarSyncState | null>;
     getOrCreate(userId: string): Promise<CalendarSyncState>;
     update(userId: string, data: CalendarSyncStateUpdate): Promise<CalendarSyncState>;
     updateSyncToken(userId: string, token: string): Promise<void>;
     clearSyncToken(userId: string): Promise<void>;
     setError(userId: string, error: string): Promise<void>;
     clearError(userId: string): Promise<void>;
   };
   ```

3. [ ] Implement Calendar repository
   ```typescript
   export const calendarRepository = {
     upsert(input: CalendarUpsertInput): Promise<Calendar>;
     upsertMany(inputs: CalendarUpsertInput[]): Promise<number>;
     findByUser(userId: string): Promise<Calendar[]>;
     findByGoogleId(userId: string, googleCalendarId: string): Promise<Calendar | null>;
     updateSelection(userId: string, calendarId: string, isSelected: boolean): Promise<void>;
     delete(userId: string, calendarId: string): Promise<void>;
   };
   ```

4. [ ] Implement Event repository (extend existing)
   ```typescript
   export const calendarEventRepository = {
     upsert(input: EventUpsertInput): Promise<Event>;
     upsertMany(inputs: EventUpsertInput[]): Promise<number>;
     findByGoogleId(googleEventId: string): Promise<Event | null>;
     findByCalendar(userId: string, calendarId: string, options?: FindOptions): Promise<Event[]>;
     findUpcoming(userId: string, hours: number): Promise<Event[]>;
     findInRange(userId: string, start: Date, end: Date): Promise<Event[]>;
     findConflicts(userId: string, start: Date, end: Date, excludeEventId?: string): Promise<Event[]>;
     delete(eventId: string): Promise<void>;
     softDelete(eventId: string): Promise<void>;
   };
   ```

5. [ ] Implement Approval repository
   ```typescript
   export const calendarApprovalRepository = {
     create(input: ApprovalCreateInput): Promise<CalendarApproval>;
     findById(id: string): Promise<CalendarApproval | null>;
     findPending(userId: string): Promise<CalendarApproval[]>;
     findExpired(): Promise<CalendarApproval[]>;
     update(id: string, data: ApprovalUpdateInput): Promise<CalendarApproval>;
     approve(id: string): Promise<CalendarApproval>;
     reject(id: string, notes?: string): Promise<CalendarApproval>;
     expire(id: string): Promise<CalendarApproval>;
   };
   ```

### Files to Create

```
src/integrations/calendar/
├── repository.ts                # NEW: Database access layer
```

### Security Checklist

- [ ] All queries include userId filter
- [ ] No SQL injection vulnerabilities
- [ ] Audit logging for mutations

### Testing Requirements

- [ ] Unit tests for all repository methods
- [ ] Test batch operations
- [ ] Test conflict detection queries
- [ ] Test soft delete behavior
- [ ] Test approval state transitions

### Documentation Updates

- [ ] Document repository patterns

### Acceptance Criteria

- [ ] All repository methods implemented
- [ ] Queries performant (use indexes)
- [ ] All tests pass
- [ ] No TypeScript errors

---

## Chunk 6: Full Sync Pipeline

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 5  
**Goal**: Implement full calendar sync with resume support.

### Prerequisites

- [ ] Chunk 5 complete

### Architecture Notes

Full sync imports all calendar data:
1. Fetch all calendars user has access to
2. Store calendars, mark primary
3. For each selected calendar, fetch all events (paginated)
4. Store events with embeddings scheduled
5. Store sync token for future incremental sync

**Resume Strategy** (from Gmail learnings):
- Store `fullSyncPageToken` after each page
- Track `fullSyncProgress` for UI feedback
- On failure, resume from last successful page

### Tasks

1. [ ] Create `src/integrations/calendar/sync/full-sync.ts`
   ```typescript
   export async function fullCalendarSync(
     userId: string,
     options?: FullSyncOptions
   ): Promise<FullSyncResult>;
   
   export async function resumeFullSync(
     userId: string
   ): Promise<FullSyncResult>;
   ```

2. [ ] Implement calendar list sync
   - Fetch all calendars
   - Mark primary calendar
   - Determine access role
   - Store in database

3. [ ] Implement event pagination
   - Batch size from constants
   - Store page token after each batch
   - Track progress count

4. [ ] Implement event processing
   - Map Google events to DB format
   - Batch upsert for performance
   - Handle recurring events (expand instances)

5. [ ] Implement embedding scheduling
   - Queue embedding jobs for synced events
   - Use existing embedding service pattern

6. [ ] Add sync state management
   - Update progress during sync
   - Store sync token on completion
   - Handle errors gracefully

7. [ ] Create `src/integrations/calendar/sync/jobs.ts`
   - Define BullMQ job types
   - Job data interfaces
   - Job scheduling functions

### Files to Create

```
src/integrations/calendar/sync/
├── full-sync.ts                 # NEW: Full sync implementation
├── jobs.ts                      # NEW: Job definitions
├── types.ts                     # NEW: Sync-specific types
├── index.ts                     # NEW: Exports
```

### Security Checklist

- [ ] Token refresh handled during long syncs
- [ ] Progress not exposed externally
- [ ] Error details sanitized before storage

### Testing Requirements

- [ ] Unit tests with mocked API responses
- [ ] Test pagination handling
- [ ] Test resume after failure
- [ ] Test sync token storage
- [ ] Test recurring event handling
- [ ] Integration test for full sync flow

### Documentation Updates

- [ ] Document sync architecture
- [ ] Document resume strategy

### Acceptance Criteria

- [ ] Full sync completes for typical calendar
- [ ] Resume works after interruption
- [ ] Progress tracked correctly
- [ ] Sync token stored for incremental
- [ ] All tests pass

---

## Chunk 7: Incremental Sync & Webhooks

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 5, Chunk 6  
**Goal**: Implement incremental sync using sync tokens and real-time updates via webhooks.

### Prerequisites

- [ ] Chunk 5 complete
- [ ] Chunk 6 complete (sync token from full sync)

### Architecture Notes

**Incremental Sync**:
- Use `syncToken` from previous sync
- Only returns changed events
- Handle `410 Gone` (sync token expired) → trigger full sync

**Webhooks (Push Notifications)**:
- Google sends notifications when calendar changes
- We respond by triggering incremental sync
- Webhooks expire after 7 days max
- Need renewal scheduler

### Tasks

1. [ ] Create `src/integrations/calendar/sync/incremental-sync.ts`
   ```typescript
   export async function incrementalCalendarSync(
     userId: string
   ): Promise<IncrementalSyncResult>;
   
   export async function processEventChanges(
     userId: string,
     changes: EventChange[]
   ): Promise<void>;
   ```

2. [ ] Implement sync token flow
   - Call Events.list with syncToken
   - Process changes (added, updated, deleted)
   - Store new sync token

3. [ ] Handle sync token expiration
   - Detect 410 Gone response
   - Clear sync token
   - Trigger full sync

4. [ ] Create `src/integrations/calendar/sync/webhook.ts`
   ```typescript
   export async function registerWebhook(
     userId: string,
     calendarId: string
   ): Promise<WebhookRegistration>;
   
   export async function processWebhookNotification(
     channelId: string,
     resourceId: string
   ): Promise<void>;
   
   export async function renewExpiredWebhooks(): Promise<void>;
   ```

5. [ ] Implement webhook verification
   - Verify channel ID and resource ID
   - Verify request comes from Google
   - Rate limit webhook processing

6. [ ] Create webhook renewal scheduler
   - Check for expiring webhooks
   - Renew before expiration
   - Handle renewal failures

7. [ ] Add scheduled sync job
   - Fallback if webhooks fail
   - Configurable interval
   - Only sync if no recent webhook activity

### Files to Create

```
src/integrations/calendar/sync/
├── incremental-sync.ts          # NEW: Incremental sync
├── webhook.ts                   # NEW: Webhook handling
├── scheduler.ts                 # NEW: Scheduled jobs
```

### Security Checklist

- [ ] Webhook endpoint validates Google headers
- [ ] Channel IDs are unpredictable
- [ ] Rate limiting on webhook endpoint
- [ ] No sync triggered for invalid webhooks

### Testing Requirements

- [ ] Test incremental sync with various change types
- [ ] Test sync token expiration handling
- [ ] Test webhook registration
- [ ] Test webhook notification processing
- [ ] Test renewal scheduler
- [ ] Integration test for webhook flow

### Documentation Updates

- [ ] Document webhook setup requirements
- [ ] Document sync scheduling

### Acceptance Criteria

- [ ] Incremental sync works with sync token
- [ ] Sync token expiration handled
- [ ] Webhooks registered successfully
- [ ] Webhook notifications processed
- [ ] Renewal scheduler working
- [ ] All tests pass

---

## Chunk 8: Event Actions & Approval Workflow

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunks 6, 7  
**Goal**: Implement event CRUD actions with approval workflow.

### Prerequisites

- [ ] Chunk 6 complete (sync working)
- [ ] Chunk 7 complete (incremental sync working)

### Architecture Notes

All event modifications require approval (following Gmail pattern):
1. Agent requests action (create, update, delete, respond)
2. Approval record created with event snapshot
3. User approves or rejects
4. On approval, action executed against Google API
5. Result synced back to local DB

**Conflict Detection**:
- Check for overlapping events before create/update
- Include conflict info in approval request
- Suggest alternative times

### Tasks

1. [ ] Create `src/integrations/calendar/actions/index.ts`
   - Export all action functions

2. [ ] Create `src/integrations/calendar/actions/types.ts`
   - Action request types
   - Action result types
   - Conflict information types

3. [ ] Create `src/integrations/calendar/actions/create.ts`
   ```typescript
   export async function requestEventCreation(
     userId: string,
     event: EventCreateInput,
     requestedBy?: string
   ): Promise<ApprovalResult>;
   
   export async function executeEventCreation(
     approvalId: string
   ): Promise<Event>;
   ```

4. [ ] Create `src/integrations/calendar/actions/update.ts`
   ```typescript
   export async function requestEventUpdate(
     userId: string,
     eventId: string,
     updates: EventUpdateInput,
     requestedBy?: string
   ): Promise<ApprovalResult>;
   
   export async function executeEventUpdate(
     approvalId: string
   ): Promise<Event>;
   ```

5. [ ] Create `src/integrations/calendar/actions/delete.ts`
   ```typescript
   export async function requestEventDeletion(
     userId: string,
     eventId: string,
     reason?: string,
     requestedBy?: string
   ): Promise<ApprovalResult>;
   
   export async function executeEventDeletion(
     approvalId: string
   ): Promise<void>;
   ```

6. [ ] Create `src/integrations/calendar/actions/respond.ts`
   ```typescript
   export async function requestEventResponse(
     userId: string,
     eventId: string,
     response: 'accepted' | 'declined' | 'tentative',
     requestedBy?: string
   ): Promise<ApprovalResult>;
   
   export async function executeEventResponse(
     approvalId: string
   ): Promise<Event>;
   ```

7. [ ] Create `src/integrations/calendar/actions/approval.ts`
   ```typescript
   export async function approveCalendarAction(
     userId: string,
     approvalId: string
   ): Promise<ApprovalResult>;
   
   export async function rejectCalendarAction(
     userId: string,
     approvalId: string,
     notes?: string
   ): Promise<ApprovalResult>;
   
   export async function expireOldApprovals(): Promise<number>;
   ```

8. [ ] Implement conflict detection
   ```typescript
   export async function detectConflicts(
     userId: string,
     start: Date,
     end: Date,
     excludeEventId?: string
   ): Promise<ConflictInfo[]>;
   ```

9. [ ] Add approval expiration scheduler
   - Run periodically (e.g., every 15 minutes)
   - Expire approvals past expiresAt
   - Notify user of expired approvals (optional)

### Files to Create

```
src/integrations/calendar/actions/
├── index.ts                     # NEW: Exports
├── types.ts                     # NEW: Action types
├── create.ts                    # NEW: Event creation
├── update.ts                    # NEW: Event updates
├── delete.ts                    # NEW: Event deletion
├── respond.ts                   # NEW: Event responses
├── approval.ts                  # NEW: Approval workflow
├── conflicts.ts                 # NEW: Conflict detection
```

### Security Checklist

- [ ] All actions verify user ownership
- [ ] Approval IDs not guessable
- [ ] Rate limiting on action endpoints
- [ ] Audit logging for all actions

### Testing Requirements

- [ ] Test each action type
- [ ] Test approval flow (request → approve → execute)
- [ ] Test rejection flow
- [ ] Test expiration
- [ ] Test conflict detection
- [ ] Test concurrent approval handling
- [ ] Integration tests for full action flow

### Documentation Updates

- [ ] Document approval workflow
- [ ] Document conflict detection

### Acceptance Criteria

- [ ] All action types implemented
- [ ] Approval workflow complete
- [ ] Conflict detection working
- [ ] Expiration scheduler running
- [ ] All tests pass

---

## Chunk 9: API Routes

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 8  
**Goal**: Create REST API endpoints for Calendar operations.

### Prerequisites

- [ ] Chunk 8 complete

### Architecture Notes

Following existing API patterns:
- RESTful endpoints under `/api/integrations/calendar/`
- CSRF protection on all state-changing endpoints
- Rate limiting per user
- OpenAPI documentation

### Tasks

1. [ ] Create `src/app/api/integrations/calendar/calendars/route.ts`
   - GET: List user's calendars
   - Response includes selection status

2. [ ] Create `src/app/api/integrations/calendar/calendars/[id]/route.ts`
   - PATCH: Update calendar settings (isSelected, isHidden)

3. [ ] Create `src/app/api/integrations/calendar/sync/route.ts`
   - POST: Trigger sync (full or incremental)
   - GET: Get sync status

4. [ ] Create `src/app/api/integrations/calendar/events/route.ts`
   - GET: List events with filters
   - POST: Request event creation (with approval)

5. [ ] Create `src/app/api/integrations/calendar/events/[id]/route.ts`
   - GET: Get event details
   - PATCH: Request event update (with approval)
   - DELETE: Request event deletion (with approval)

6. [ ] Create `src/app/api/integrations/calendar/approvals/route.ts`
   - GET: List pending approvals

7. [ ] Create `src/app/api/integrations/calendar/approvals/[id]/route.ts`
   - GET: Get approval details
   - POST: Approve or reject (action in body)

8. [ ] Create `src/app/api/integrations/calendar/webhook/route.ts`
   - POST: Handle Google push notifications

9. [ ] Add OpenAPI schemas
   - `src/openapi/components/schemas/calendar.ts`
   - Request/response schemas for all endpoints

10. [ ] Register OpenAPI paths
    - `src/openapi/paths/calendar.ts`
    - All endpoint operations

### Files to Create

```
src/app/api/integrations/calendar/
├── calendars/
│   ├── route.ts                 # NEW: List calendars
│   └── [id]/
│       └── route.ts             # NEW: Update calendar
├── sync/
│   └── route.ts                 # NEW: Sync operations
├── events/
│   ├── route.ts                 # NEW: List/create events
│   └── [id]/
│       └── route.ts             # NEW: Event CRUD
├── approvals/
│   ├── route.ts                 # NEW: List approvals
│   └── [id]/
│       └── route.ts             # NEW: Approve/reject
├── webhook/
│   └── route.ts                 # NEW: Webhook handler

src/openapi/
├── components/schemas/
│   └── calendar.ts              # NEW: Calendar schemas
├── paths/
│   └── calendar.ts              # NEW: Calendar paths
│   └── index.ts                 # UPDATE: Export calendar paths
```

### Security Checklist

- [ ] Rate limiting on all routes
- [ ] CSRF protection on POST/PATCH/DELETE via Next Auth
- [ ] Input validation with Zod
- [ ] Webhook endpoint validates Google headers
- [ ] All routes verify user authentication
- [ ] OpenAPI security requirements documented

### Testing Requirements

- [ ] Unit tests for each route handler
- [ ] Test authentication checks
- [ ] Test input validation
- [ ] Test rate limiting
- [ ] Test CSRF protection
- [ ] Integration tests for API flows

### Documentation Updates

- [ ] Update `docs/API_REFERENCE.md` with Calendar endpoints
- [ ] Verify all endpoints appear in `/docs`

### OpenAPI Verification

- [ ] All routes have corresponding path registrations
- [ ] Request body schemas match validation
- [ ] Response schemas match actual responses
- [ ] Error responses documented
- [ ] Endpoints visible in /docs

### Acceptance Criteria

- [ ] All endpoints implemented
- [ ] Security measures in place
- [ ] OpenAPI documentation complete
- [ ] All tests pass

---

## Chunk 10: Agent Integration

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 8  
**Goal**: Create agent tools for calendar operations.

### Prerequisites

- [ ] Chunk 8 complete

### Architecture Notes

Agent tools enable the AI to:
- Query user's schedule
- Check availability
- Create/modify events (with approval)
- Provide schedule context

**Context Injection**:
- Include upcoming events in agent context
- Include availability windows
- Include recent event activity

### Tasks

1. [ ] Create `src/services/skills/calendar/index.ts`
   - Export all calendar tools

2. [ ] Implement `list_calendar_events` tool
   ```typescript
   export const listCalendarEventsTool = {
     name: 'list_calendar_events',
     description: 'Query user calendar for events',
     parameters: z.object({
       startDate: z.string().optional(),
       endDate: z.string().optional(),
       limit: z.number().optional(),
     }),
     execute: async (params, context) => { ... }
   };
   ```

3. [ ] Implement `check_availability` tool
   ```typescript
   export const checkAvailabilityTool = {
     name: 'check_availability',
     description: 'Find free time slots',
     parameters: z.object({
       date: z.string(),
       duration: z.number(), // minutes
     }),
     execute: async (params, context) => { ... }
   };
   ```

4. [ ] Implement `create_calendar_event` tool
   ```typescript
   export const createCalendarEventTool = {
     name: 'create_calendar_event',
     description: 'Schedule new event (requires approval)',
     parameters: z.object({
       title: z.string(),
       startTime: z.string(),
       endTime: z.string(),
       description: z.string().optional(),
       location: z.string().optional(),
       attendees: z.array(z.string()).optional(),
     }),
     execute: async (params, context) => { ... }
   };
   ```

5. [ ] Implement `update_calendar_event` tool
   - Find event by ID or description
   - Request update with approval

6. [ ] Implement `respond_to_invite` tool
   - Find invite event
   - Request response with approval

7. [ ] Create context injection middleware
   ```typescript
   export async function getCalendarContext(
     userId: string,
     options?: ContextOptions
   ): Promise<CalendarContext>;
   ```

8. [ ] Register tools with agent system
   - Add to tool registry
   - Configure permissions

### Files to Create

```
src/services/skills/calendar/
├── index.ts                     # NEW: Exports
├── tools.ts                     # NEW: Tool definitions
├── context.ts                   # NEW: Context injection
```

### Security Checklist

- [ ] Tools verify user context
- [ ] Approval required for mutations
- [ ] Context limited to user's data

### Testing Requirements

- [ ] Unit tests for each tool
- [ ] Test tool parameter validation
- [ ] Test approval flow integration
- [ ] Test context injection
- [ ] Integration tests for agent workflows

### Documentation Updates

- [ ] Document available calendar tools
- [ ] Document context injection format

### Acceptance Criteria

- [ ] All tools implemented
- [ ] Tools registered with agent
- [ ] Context injection working
- [ ] All tests pass

---

## Chunk 11: Calendar UI

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 9, Chunk 10  
**Goal**: Create UI components for Calendar settings and approvals.

### Prerequisites

- [ ] Chunk 9 complete (API routes available)
- [ ] Chunk 10 complete (context available)

### Architecture Notes

UI Components needed:
1. Calendar connection status in settings
2. Calendar list with selection toggles
3. Pending approvals panel
4. Sync controls and status display

**Following Gmail UI patterns**:
- Use existing UI components where possible
- Consistent styling with Gmail settings
- Loading states and error handling

### Tasks

1. [ ] Create `src/components/integrations/calendar/CalendarSettings.tsx`
   - Connection status
   - Sync controls
   - Calendar list
   - Sync statistics

2. [ ] Create `src/components/integrations/calendar/CalendarList.tsx`
   - List of user's calendars
   - Toggle selection
   - Show access level

3. [ ] Create `src/components/integrations/calendar/CalendarApprovals.tsx`
   - List pending approvals
   - Approval detail modal
   - Approve/reject actions
   - Conflict warnings

4. [ ] Create `src/components/integrations/calendar/CalendarSyncStatus.tsx`
   - Sync progress indicator
   - Last sync time
   - Error display

5. [ ] Create `src/components/integrations/calendar/index.ts`
   - Export all components

6. [ ] Add Calendar section to settings page
   - Integrate CalendarSettings component
   - Add to existing integrations tabs

7. [ ] Add loading states
   - Initialize loading as `true` for async hooks
   - Disable buttons during operations
   - Show spinners appropriately

### Files to Create

```
src/components/integrations/calendar/
├── index.ts                     # NEW: Exports
├── CalendarSettings.tsx         # NEW: Main settings component
├── CalendarList.tsx             # NEW: Calendar list
├── CalendarApprovals.tsx        # NEW: Approvals panel
├── CalendarSyncStatus.tsx       # NEW: Sync status

src/app/(dashboard)/settings/
└── page.tsx                     # UPDATE: Add Calendar section
```

### Security Checklist

- [ ] Loading states prevent double-submits
- [ ] Error messages don't leak sensitive info

### Testing Requirements

- [ ] Component unit tests
- [ ] Test loading states
- [ ] Test error handling
- [ ] Test approval flow UI
- [ ] E2E test for settings flow (optional)

### Documentation Updates

- [ ] Update `docs/FRONTEND.md` with Calendar components

### Acceptance Criteria

- [ ] All components rendered correctly
- [ ] CSRF protection working
- [ ] Loading states correct
- [ ] Approval flow works end-to-end
- [ ] No console errors
- [ ] All tests pass

---

## Chunk 12: Integration Testing

**Estimated Time**: 4-5 hours  
**Dependencies**: All previous chunks  
**Goal**: Comprehensive integration tests for Calendar functionality.

### Prerequisites

- [ ] All feature chunks complete (1-11)

### Architecture Notes

Integration tests should cover:
1. Full sync flow (API → DB → Embeddings)
2. Incremental sync flow
3. Webhook notification flow
4. Action approval flow (request → approve → execute)
5. Agent tool execution
6. Error scenarios and recovery

### Tasks

1. [ ] Create mock factories
   - `tests/integrations/calendar/factories.ts`
   - Mock Google Calendar API responses
   - Mock events, calendars, attendees

2. [ ] Create `tests/integrations/calendar/full-sync.test.ts`
   - Test complete sync flow
   - Test pagination handling
   - Test resume after failure
   - Test error recovery

3. [ ] Create `tests/integrations/calendar/incremental-sync.test.ts`
   - Test sync token usage
   - Test change processing
   - Test sync token expiration

4. [ ] Create `tests/integrations/calendar/webhook.test.ts`
   - Test webhook registration
   - Test notification processing
   - Test invalid webhook rejection

5. [ ] Create `tests/integrations/calendar/actions.test.ts`
   - Test each action type
   - Test approval workflow
   - Test conflict detection
   - Test concurrent operations

6. [ ] Create `tests/integrations/calendar/api.test.ts`
   - Test API routes
   - Test authentication
   - Test input validation
   - Test rate limiting

7. [ ] Create `tests/integrations/calendar/agent.test.ts`
   - Test agent tools
   - Test context injection
   - Test approval integration

8. [ ] Measure test coverage
   - Target: >80% for Calendar module
   - Document coverage gaps

### Files to Create

```
tests/integrations/calendar/
├── factories.ts                 # NEW: Mock factories
├── full-sync.test.ts            # NEW: Full sync tests
├── incremental-sync.test.ts     # NEW: Incremental sync tests
├── webhook.test.ts              # NEW: Webhook tests
├── actions.test.ts              # NEW: Action tests
├── api.test.ts                  # NEW: API route tests
├── agent.test.ts                # NEW: Agent tool tests
```

### Testing Requirements

- [ ] All critical paths covered
- [ ] Error scenarios tested
- [ ] Edge cases handled
- [ ] Performance acceptable

### Acceptance Criteria

- [ ] >80% code coverage for Calendar module
- [ ] All integration tests pass
- [ ] No flaky tests
- [ ] Coverage report generated

---

## Chunk 13: Polish & Review

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 12  
**Goal**: Final polish, review, and documentation completion.

### Prerequisites

- [ ] Chunk 12 complete

### Tasks

1. [ ] Code Review
   - [ ] No console.log statements (use logger)
   - [ ] No magic numbers (use constants)
   - [ ] No TODO comments left
   - [ ] Consistent naming conventions
   - [ ] No unsafe type assertions

2. [ ] Lint/Type Cleanup
   - [ ] No TypeScript errors
   - [ ] No ESLint warnings
   - [ ] No Prettier issues

3. [ ] Security Audit
   - [ ] Rate limiting verified on all endpoints
   - [ ] CSRF protection verified
   - [ ] Input validation complete
   - [ ] Sensitive data handling verified
   - [ ] Audit logging in place

4. [ ] Performance Review
   - [ ] Database queries optimized
   - [ ] Appropriate indexes in place
   - [ ] Batch operations used where applicable
   - [ ] No N+1 query issues

5. [ ] Documentation Completion
   - [ ] `docs/services/CALENDAR_SERVICE.md` complete
   - [ ] `docs/API_REFERENCE.md` updated
   - [ ] `docs/DATABASE_SCHEMA.md` updated
   - [ ] `docs/ARCHITECTURE.md` updated (if needed)
   - [ ] OpenAPI documentation complete
   - [ ] All endpoints visible in /docs

6. [ ] Lifecycle Verification
   - [ ] Sync schedulers start on app initialization
   - [ ] Webhook renewal scheduled
   - [ ] Approval expiration scheduled
   - [ ] Graceful shutdown handled

7. [ ] Create Progress Report
   - [ ] `docs/progress-reports/PROGRESS_REPORT_PHASE_4.md`
   - [ ] Summary of accomplishments
   - [ ] Metrics and coverage
   - [ ] Known issues/limitations
   - [ ] Recommendations for future

### Acceptance Criteria

- [ ] All code review items addressed
- [ ] No lint/type errors
- [ ] Security audit passed
- [ ] Documentation complete
- [ ] Lifecycle hooks verified
- [ ] Progress report created

---

## Appendix: File Structure Summary

After Phase 4 completion, the Calendar integration structure should be:

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
    └── scheduler.ts             # Scheduled jobs

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
└── webhook/route.ts

src/components/integrations/calendar/
├── index.ts
├── CalendarSettings.tsx
├── CalendarList.tsx
├── CalendarApprovals.tsx
└── CalendarSyncStatus.tsx

src/services/skills/calendar/
├── index.ts
├── tools.ts
└── context.ts

tests/integrations/calendar/
├── factories.ts
├── full-sync.test.ts
├── incremental-sync.test.ts
├── webhook.test.ts
├── actions.test.ts
├── api.test.ts
└── agent.test.ts
```

---

## Estimated Timeline

| Chunk | Estimated Hours | Parallel With |
|-------|-----------------|---------------|
| 0: Security & OAuth | 2-3 | - |
| 1: Module Foundation | 2-3 | - |
| 2: Database Models | 3-4 | 3, 4 |
| 3: Calendar Client | 4-5 | 2, 4 |
| 4: Calendar Mappers | 2-3 | 2, 3 |
| 5: Repository | 3-4 | - |
| 6: Full Sync | 4-5 | 7 |
| 7: Incremental Sync | 4-5 | 6 |
| 8: Actions & Approval | 4-5 | - |
| 9: API Routes | 4-5 | 10 |
| 10: Agent Integration | 3-4 | 9 |
| 11: Calendar UI | 4-5 | - |
| 12: Integration Testing | 4-5 | - |
| 13: Polish & Review | 3-4 | - |

**Total Estimated Hours**: 48-60 hours  
**With Parallelization**: ~35-45 hours

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Sync latency | <30s from Google change to local update |
| Full sync time | <2 min for typical calendar (500 events) |
| API reliability | >99% successful API calls |
| Conflict detection | >95% correctly identified conflicts |
| Webhook uptime | >99.5% webhook channel availability |
| Test coverage | >80% for Calendar module |
| Event accuracy | 100% no data loss or corruption |

---

*Document Version: 1.0*  
*Created: December 22, 2024*  
*Based on: PHASE_4_CALENDAR.md, CHUNKING_BEST_PRACTICES.md*

