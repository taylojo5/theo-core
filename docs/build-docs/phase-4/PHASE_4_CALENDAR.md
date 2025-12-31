# Phase 4: Google Calendar Integration

> **Status**: Draft v0.1  
> **Duration**: Weeks 11-13  
> **Dependencies**: Phase 1 (Core Foundation), Phase 3 (Gmail Integration for OAuth patterns)

---

## Overview

Integrate Google Calendar to give Theo awareness of the user's schedule, enabling intelligent scheduling, event management, and time-aware decision making.

### Architecture Note

Design this integration as a **self-contained module** with clear boundaries (API contracts, message-based communication patterns) to enable extraction to a standalone microservice in the future. Follow the patterns established by the Gmail integration.

---

## Goals

- Google OAuth with Calendar scopes
- Calendar and event sync pipeline
- Event read/write actions with approval workflow
- Bi-directional sync (Theo → Google, Google → Theo)
- Integration with existing Event/Deadline context entities

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CalendarClient                               │
│  Thin wrapper over Google Calendar API with rate limiting           │
└─────────────────────────────────────────────────────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
┌──────────────────────┐ ┌──────────────┐ ┌──────────────────────┐
│   CalendarRepository │ │   Mappers    │ │   CalendarActions    │
│   CRUD for DB models │ │  API ↔ DB    │ │  Create/Update/Delete│
└──────────────────────┘ └──────────────┘ └──────────────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
┌──────────────────────┐ ┌──────────────┐ ┌──────────────────────┐
│     FullSync         │ │ Incremental  │ │   Event Approval     │
│  Initial calendar    │ │    Sync      │ │    Workflow          │
│     import           │ │  (webhooks)  │ │                      │
└──────────────────────┘ └──────────────┘ └──────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  Context System (Event, Deadline)                    │
│           Existing entities enriched with calendar data             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## OAuth Configuration

### Required Scopes

| Scope                                               | Purpose                          |
| --------------------------------------------------- | -------------------------------- |
| `https://www.googleapis.com/auth/calendar.readonly` | Read calendars and events        |
| `https://www.googleapis.com/auth/calendar.events`   | Create/modify/delete events      |
| `https://www.googleapis.com/auth/calendar`          | Full calendar access (if needed) |

### Scope Upgrade Flow

Users may initially grant read-only access. The system should:

1. Detect when write access is needed
2. Prompt user to upgrade scopes
3. Re-authenticate with expanded permissions
4. Continue interrupted action

---

## Data Model

### CalendarSyncState

Tracks sync progress per user (mirrors GmailSyncState pattern).

| Field              | Type      | Description                            |
| ------------------ | --------- | -------------------------------------- |
| id                 | string    | Unique identifier                      |
| userId             | string    | FK to User (unique)                    |
| syncToken          | string?   | Google sync token for incremental sync |
| syncTokenSetAt     | datetime? | When sync token was obtained           |
| lastSyncAt         | datetime? | Last successful sync                   |
| lastFullSyncAt     | datetime? | Last full sync                         |
| fullSyncPageToken  | string?   | Resume token for interrupted full sync |
| fullSyncProgress   | int       | Events processed in current full sync  |
| fullSyncStartedAt  | datetime? | When full sync started                 |
| syncStatus         | enum      | `idle`, `syncing`, `error`             |
| syncError          | string?   | Error message if failed                |
| eventCount         | int       | Total events synced                    |
| calendarCount      | int       | Total calendars synced                 |
| webhookChannelId   | string?   | Push notification channel ID           |
| webhookExpiration  | datetime? | When webhook expires                   |
| syncCalendarIds    | string[]  | Calendars to sync (empty = primary)    |
| excludeCalendarIds | string[]  | Calendars to exclude                   |
| createdAt          | datetime  |                                        |
| updatedAt          | datetime  |                                        |

### Calendar

Stores user's calendars for multi-calendar support.

| Field            | Type     | Description                                   |
| ---------------- | -------- | --------------------------------------------- |
| id               | string   | Unique identifier                             |
| userId           | string   | FK to User                                    |
| googleCalendarId | string   | Google's calendar ID                          |
| name             | string   | Display name                                  |
| description      | string?  | Calendar description                          |
| timeZone         | string   | Calendar timezone                             |
| isPrimary        | boolean  | Is user's primary calendar                    |
| isOwner          | boolean  | User owns this calendar                       |
| accessRole       | enum     | `owner`, `writer`, `reader`, `freeBusyReader` |
| backgroundColor  | string?  | Hex color                                     |
| foregroundColor  | string?  | Hex color                                     |
| isSelected       | boolean  | User wants to sync this calendar              |
| isHidden         | boolean  | Hidden from UI                                |
| createdAt        | datetime |                                               |
| updatedAt        | datetime |                                               |

### CalendarEvent (extends existing Event model)

Add calendar-specific fields to the existing Event model:

| Field            | Type    | Description                           |
| ---------------- | ------- | ------------------------------------- |
| googleEventId    | string? | Google's event ID                     |
| googleCalendarId | string? | Which calendar this belongs to        |
| calendarId       | string? | FK to Calendar                        |
| recurringEventId | string? | Parent recurring event ID             |
| recurrence       | json?   | Recurrence rules (RRULE)              |
| attendees        | json    | Array of attendees with status        |
| organizer        | json?   | Event organizer info                  |
| creator          | json?   | Event creator info                    |
| conferenceData   | json?   | Video call info (Meet, Zoom)          |
| reminders        | json?   | Custom reminders                      |
| iCalUID          | string? | iCal UID for external sync            |
| sequence         | int     | Event version for conflict resolution |
| etag             | string? | For optimistic concurrency            |
| htmlLink         | string? | Link to Google Calendar UI            |
| hangoutLink      | string? | Google Meet link                      |

### EventApproval

For agent-initiated event actions (mirrors EmailApproval pattern).

| Field         | Type      | Description                                  |
| ------------- | --------- | -------------------------------------------- |
| id            | string    | Unique identifier                            |
| userId        | string    | FK to User                                   |
| actionType    | enum      | `create`, `update`, `delete`, `respond`      |
| calendarId    | string    | Target calendar                              |
| eventId       | string?   | Existing event (for update/delete)           |
| eventSnapshot | json      | Full event data                              |
| status        | enum      | `pending`, `approved`, `rejected`, `expired` |
| requestedAt   | datetime  | When requested                               |
| requestedBy   | string?   | Agent action ID                              |
| expiresAt     | datetime? | Auto-expiration                              |
| decidedAt     | datetime? | When user decided                            |
| resultEventId | string?   | Created/updated event ID                     |
| errorMessage  | string?   | Error if failed                              |
| notes         | string?   | User notes                                   |
| metadata      | json      | Additional context                           |
| createdAt     | datetime  |                                              |
| updatedAt     | datetime  |                                              |

---

## Core Services

### CalendarClient

Thin wrapper over Google Calendar API with rate limiting.

| Method                                          | Description               |
| ----------------------------------------------- | ------------------------- |
| `listCalendars()`                               | List all user calendars   |
| `getCalendar(id)`                               | Get calendar details      |
| `listEvents(calendarId, options)`               | List events with filters  |
| `getEvent(calendarId, eventId)`                 | Get single event          |
| `createEvent(calendarId, event)`                | Create new event          |
| `updateEvent(calendarId, eventId, event)`       | Update existing event     |
| `deleteEvent(calendarId, eventId)`              | Delete event              |
| `respondToEvent(calendarId, eventId, response)` | Accept/decline/tentative  |
| `watchCalendar(calendarId, webhookUrl)`         | Set up push notifications |
| `stopWatching(channelId, resourceId)`           | Stop push notifications   |

### CalendarRepository

Database operations for calendar data.

| Method                                      | Description                |
| ------------------------------------------- | -------------------------- |
| `upsertCalendar(input)`                     | Create or update calendar  |
| `upsertEvent(input)`                        | Create or update event     |
| `deleteEvent(eventId)`                      | Soft delete event          |
| `findEvents(query)`                         | Query events with filters  |
| `findEventByGoogleId(googleEventId)`        | Lookup by Google ID        |
| `findUpcomingEvents(userId, hours)`         | Get events in next N hours |
| `findConflictingEvents(userId, start, end)` | Find schedule conflicts    |

### CalendarSyncService

Handles sync operations.

| Method                                   | Description                  |
| ---------------------------------------- | ---------------------------- |
| `fullSync(userId, options)`              | Full calendar import         |
| `incrementalSync(userId)`                | Delta sync using syncToken   |
| `resumeFullSync(userId)`                 | Resume interrupted full sync |
| `processCalendarWebhook(payload)`        | Handle push notifications    |
| `syncSingleCalendar(userId, calendarId)` | Sync specific calendar       |

### CalendarActions

Agent-facing actions with approval workflow.

| Method                                    | Description                  |
| ----------------------------------------- | ---------------------------- |
| `requestEventCreation(params)`            | Request to create event      |
| `requestEventUpdate(eventId, changes)`    | Request to modify event      |
| `requestEventDeletion(eventId, reason)`   | Request to delete event      |
| `requestEventResponse(eventId, response)` | Request to respond to invite |
| `approveAction(approvalId)`               | User approves action         |
| `rejectAction(approvalId, notes)`         | User rejects action          |
| `executeApprovedAction(approvalId)`       | Execute after approval       |

---

## Sync Strategy

### Full Sync

Initial import of calendar data.

```
1. Fetch all calendars user has access to
2. Store calendars, mark primary
3. For each selected calendar:
   a. Fetch events (paginated, max 2500 per request)
   b. Store page token for resume
   c. Map events to Event model
   d. Store sync token for future incremental sync
4. Generate embeddings for events (batched)
5. Extract deadlines from events
6. Link events to existing People entities
```

**Resume Handling:**

- Store `fullSyncPageToken` after each page
- On failure, resume from last successful page
- Track `fullSyncProgress` for UI feedback

### Incremental Sync

Efficient delta updates using sync tokens.

```
1. Call events.list with syncToken
2. Process changes:
   - Added events → create in DB
   - Updated events → update in DB
   - Deleted events → soft delete in DB
3. Store new syncToken
4. Update embeddings for changed events
```

**Sync Token Expiration:**

- Google sync tokens expire after ~7 days of inactivity
- Detect `410 Gone` response → trigger full sync
- Store `syncTokenSetAt` to proactively refresh

### Push Notifications (Webhooks)

Real-time updates via Google Calendar API webhooks.

```
1. Register webhook channel per calendar
2. Receive push notification on changes
3. Trigger incremental sync
4. Re-register before expiration (max 7 days)
```

**Webhook Endpoint:**

- `POST /api/integrations/calendar/webhook`
- Verify `X-Goog-Resource-ID` and `X-Goog-Channel-ID` headers
- Queue sync job (don't process inline)

---

## API Routes

### Calendar Management

| Method | Path                                       | Description              |
| ------ | ------------------------------------------ | ------------------------ |
| GET    | `/api/integrations/calendar/calendars`     | List user's calendars    |
| PATCH  | `/api/integrations/calendar/calendars/:id` | Update calendar settings |
| POST   | `/api/integrations/calendar/sync`          | Trigger sync             |
| GET    | `/api/integrations/calendar/status`        | Get sync status          |

### Event Management

| Method | Path                                    | Description                  |
| ------ | --------------------------------------- | ---------------------------- |
| GET    | `/api/integrations/calendar/events`     | List events                  |
| GET    | `/api/integrations/calendar/events/:id` | Get event details            |
| POST   | `/api/integrations/calendar/events`     | Create event (with approval) |
| PATCH  | `/api/integrations/calendar/events/:id` | Update event (with approval) |
| DELETE | `/api/integrations/calendar/events/:id` | Delete event (with approval) |

### Approval Workflow

| Method | Path                                               | Description            |
| ------ | -------------------------------------------------- | ---------------------- |
| GET    | `/api/integrations/calendar/approvals`             | List pending approvals |
| GET    | `/api/integrations/calendar/approvals/:id`         | Get approval details   |
| POST   | `/api/integrations/calendar/approvals/:id/approve` | Approve action         |
| POST   | `/api/integrations/calendar/approvals/:id/reject`  | Reject action          |

### Webhooks

| Method | Path                                 | Description               |
| ------ | ------------------------------------ | ------------------------- |
| POST   | `/api/integrations/calendar/webhook` | Google push notifications |

---

## Agent Integration

### Agent Tools

| Tool                    | Description                                   |
| ----------------------- | --------------------------------------------- |
| `list_calendar_events`  | Query user's schedule                         |
| `get_event_details`     | Get specific event info                       |
| `check_availability`    | Find free time slots                          |
| `create_calendar_event` | Schedule new event (requires approval)        |
| `update_calendar_event` | Modify event (requires approval)              |
| `delete_calendar_event` | Cancel event (requires approval)              |
| `respond_to_invite`     | Accept/decline invitation (requires approval) |
| `find_meeting_time`     | Find mutually available times                 |

### Context Enrichment

Calendar data enriches agent context:

- **Upcoming Events**: Next 24-48 hours of schedule
- **Recent Events**: What just happened for context
- **Recurring Patterns**: User's typical schedule
- **Availability**: Free/busy information
- **People Context**: Who user meets with regularly

### Example Prompt Injection

```
### Calendar Context

**Today's Schedule** (Dec 22, 2025):
- 9:00 AM - Standup (recurring, 30 min)
- 10:30 AM - 1:1 with Sarah (Google Meet)
- 2:00 PM - Design Review (conf room A)

**Tomorrow**:
- 9:00 AM - Standup (recurring)
- 11:00 AM - Interview: Alex Chen
- 3:00 PM - Sprint Planning (2 hours)

**Availability Today**:
- 8:00-9:00 AM: Free
- 9:30-10:30 AM: Free
- 12:00-2:00 PM: Free
- 4:00-6:00 PM: Free
```

---

## Conflict Detection

### Types of Conflicts

| Conflict       | Detection                  | Resolution                      |
| -------------- | -------------------------- | ------------------------------- |
| Double-booking | Time overlap check         | Warn user, suggest alternatives |
| Travel time    | Location distance analysis | Suggest buffer time             |
| Focus time     | User preference (memory)   | Respect blocked focus hours     |
| Outside hours  | User preference (memory)   | Warn about after-hours meetings |

### Conflict Resolution Flow

```
1. Agent proposes new event
2. Check for conflicts:
   - Query events in proposed time range
   - Check user's hard preferences (memory)
   - Calculate travel time if locations differ
3. If conflict:
   - Include conflict details in approval request
   - Suggest alternative times
4. User reviews and decides
```

---

## Recurring Events

### Handling Recurrence

| Scenario               | Approach                            |
| ---------------------- | ----------------------------------- |
| Sync recurring series  | Store master event + instances      |
| Modify single instance | Create exception, preserve master   |
| Modify entire series   | Update master, regenerate instances |
| Delete single instance | Mark instance as cancelled          |
| Delete entire series   | Delete master + all instances       |

### Recurrence Storage

```json
{
  "recurrence": ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"],
  "recurringEventId": "event123",
  "originalStartTime": "2025-12-22T09:00:00Z"
}
```

---

## Error Handling

### Error Types

| Error                   | Cause                    | Recovery               |
| ----------------------- | ------------------------ | ---------------------- |
| `401 Unauthorized`      | Token expired            | Refresh token, retry   |
| `403 Forbidden`         | Insufficient scopes      | Prompt scope upgrade   |
| `404 Not Found`         | Event deleted externally | Remove from local DB   |
| `409 Conflict`          | Concurrent modification  | Refetch, merge changes |
| `410 Gone`              | Sync token expired       | Trigger full sync      |
| `429 Too Many Requests` | Rate limit               | Exponential backoff    |

### Rate Limiting

Google Calendar API limits:

- 1,000,000 queries/day (free tier)
- ~10 queries/second sustained

Implementation:

- Token bucket rate limiter (shared with Gmail)
- Exponential backoff on 429
- Queue non-urgent syncs during high load

---

## Deliverables

### Phase 4 Checklist

- [ ] **OAuth & Scopes**
  - [ ] Calendar scopes added to Google OAuth
  - [ ] Scope detection utilities
  - [ ] Scope upgrade flow

- [ ] **Database**
  - [ ] CalendarSyncState table
  - [ ] Calendar table
  - [ ] Event model extended with calendar fields
  - [ ] EventApproval table
  - [ ] Migrations applied

- [ ] **CalendarClient**
  - [ ] List/get calendars
  - [ ] List/get/create/update/delete events
  - [ ] Event response handling
  - [ ] Webhook registration
  - [ ] Rate limiting

- [ ] **Sync System**
  - [ ] Full sync with resume support
  - [ ] Incremental sync with sync tokens
  - [ ] Push notification webhook handler
  - [ ] Scheduled sync jobs

- [ ] **Repository & Mappers**
  - [ ] CalendarRepository (CRUD)
  - [ ] Google API ↔ DB mappers
  - [ ] Context entity enrichment

- [ ] **Actions & Approvals**
  - [ ] Create/update/delete with approval
  - [ ] Response to invites with approval
  - [ ] Approval UI components
  - [ ] Expiration handling

- [ ] **Agent Integration**
  - [ ] Calendar query tools
  - [ ] Availability checking
  - [ ] Event creation tools
  - [ ] Context injection middleware

- [ ] **API Routes**
  - [ ] Calendar management endpoints
  - [ ] Event CRUD endpoints
  - [ ] Approval workflow endpoints
  - [ ] Webhook endpoint

---

## Success Metrics

| Metric             | Target | Description                             |
| ------------------ | ------ | --------------------------------------- |
| Sync latency       | <30s   | Time from Google change to local update |
| Full sync time     | <2 min | For typical calendar (500 events)       |
| API reliability    | >99%   | Successful API calls                    |
| Conflict detection | >95%   | Correctly identified conflicts          |
| Webhook uptime     | >99.5% | Webhook channel availability            |
| Event accuracy     | 100%   | No data loss or corruption              |

---

## Security Considerations

- **Token Storage**: Encrypted at rest (existing pattern)
- **Webhook Verification**: Validate Google headers
- **Approval Expiration**: Auto-expire after 24 hours
- **Audit Trail**: Log all calendar modifications
- **Scope Minimization**: Request only needed scopes

---

## Future Enhancements (V2+)

- **Multi-calendar Sync**: Sync all calendars, not just primary
- **Calendar Sharing**: Handle shared calendar permissions
- **Room Resources**: Meeting room booking integration
- **External Calendars**: iCal/CalDAV import
- **Smart Scheduling**: ML-based optimal meeting time suggestions
- **Travel Time**: Automatic travel buffer calculation
- **Focus Time**: Automatic focus time blocking
- **Meeting Prep**: Pre-meeting context summaries

---

## Appendix: Type Examples

### Calendar Event Object

```json
{
  "id": "evt_abc123",
  "userId": "user_123",
  "title": "1:1 with Sarah",
  "description": "Weekly sync to discuss project progress",
  "type": "meeting",
  "startsAt": "2025-12-22T10:30:00Z",
  "endsAt": "2025-12-22T11:00:00Z",
  "allDay": false,
  "timezone": "America/Chicago",
  "location": null,
  "virtualUrl": "https://meet.google.com/abc-defg-hij",
  "status": "confirmed",
  "googleEventId": "abcdef123456",
  "googleCalendarId": "primary",
  "attendees": [
    {
      "email": "sarah@example.com",
      "displayName": "Sarah",
      "responseStatus": "accepted"
    },
    {
      "email": "user@example.com",
      "displayName": "User",
      "responseStatus": "accepted",
      "self": true
    }
  ],
  "organizer": { "email": "user@example.com", "self": true },
  "conferenceData": {
    "conferenceId": "abc-defg-hij",
    "conferenceSolution": { "name": "Google Meet" },
    "entryPoints": [{ "uri": "https://meet.google.com/abc-defg-hij" }]
  },
  "reminders": {
    "useDefault": false,
    "overrides": [{ "method": "popup", "minutes": 10 }]
  },
  "source": "google_calendar",
  "sourceId": "abcdef123456"
}
```

### Event Approval Object

```json
{
  "id": "apr_xyz789",
  "userId": "user_123",
  "actionType": "create",
  "calendarId": "primary",
  "eventSnapshot": {
    "title": "Team Lunch",
    "startsAt": "2025-12-23T12:00:00Z",
    "endsAt": "2025-12-23T13:00:00Z",
    "location": "Cafe Milano",
    "attendees": ["sarah@example.com", "alex@example.com"]
  },
  "status": "pending",
  "requestedAt": "2025-12-22T15:30:00Z",
  "requestedBy": "agent_action_456",
  "expiresAt": "2025-12-23T15:30:00Z"
}
```

### Agent Tool Call Example

```json
{
  "tool": "create_calendar_event",
  "parameters": {
    "title": "Team Lunch",
    "startTime": "2025-12-23T12:00:00",
    "endTime": "2025-12-23T13:00:00",
    "location": "Cafe Milano",
    "attendees": ["sarah@example.com", "alex@example.com"],
    "description": "End of year team celebration"
  }
}
```

**Response:**

```json
{
  "success": true,
  "requiresApproval": true,
  "approvalId": "apr_xyz789",
  "message": "I've drafted a calendar event for Team Lunch. Please review and approve."
}
```
