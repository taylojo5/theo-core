# Theo Database Schema Design

> **Status**: Draft v0.1  
> **Last Updated**: December 2024

## Overview

Theo's intelligence comes from context. This document defines the database schemas for storing and relating contextual information about people, places, events, tasks, deadlines, and more.

---

## Design Principles

### 1. Entities as First-Class Citizens

Each context type (Person, Place, Event, etc.) has its own table with rich metadata.

### 2. Relationships Are Explicit

A dedicated `relationships` table captures how entities connect (person ↔ person, person ↔ event, etc.).

### 3. Everything is Timestamped

`created_at`, `updated_at`, and `source_synced_at` track data freshness.

### 4. Source Attribution

Every record tracks where it came from (manual entry, Gmail sync, Slack import, etc.).

### 5. Soft Deletes

`deleted_at` enables recovery and audit trails.

### 6. Extensible Metadata

JSONB `metadata` columns allow schema evolution without migrations.

---

## Core Tables

### Users (Account Owner)

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(255),
    avatar_url      TEXT,
    preferences     JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

-- Preferences JSONB structure:
-- {
--   "timezone": "America/New_York",
--   "workingHours": { "start": "09:00", "end": "17:00" },
--   "notificationPrefs": { ... },
--   "privacySettings": { ... }
-- }
```

---

## Context Entities

### People

```sql
CREATE TABLE people (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    -- Identity
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255),
    phone           VARCHAR(50),
    avatar_url      TEXT,

    -- Classification
    type            VARCHAR(50) DEFAULT 'contact', -- contact, colleague, friend, family, lead, etc.
    importance      INTEGER DEFAULT 5, -- 1-10 scale

    -- Context
    company         VARCHAR(255),
    title           VARCHAR(255),
    location        VARCHAR(255),
    timezone        VARCHAR(50),

    -- Notes & Memory
    bio             TEXT,
    notes           TEXT,
    preferences     JSONB DEFAULT '{}', -- communication prefs, interests, etc.

    -- Source Tracking
    source          VARCHAR(50) NOT NULL, -- manual, gmail, slack, calendar, linkedin
    source_id       VARCHAR(255), -- External ID from source system
    source_synced_at TIMESTAMPTZ,

    -- Metadata
    metadata        JSONB DEFAULT '{}',
    tags            TEXT[] DEFAULT '{}',

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    UNIQUE(user_id, email),
    UNIQUE(user_id, source, source_id)
);

CREATE INDEX idx_people_user_id ON people(user_id);
CREATE INDEX idx_people_email ON people(email);
CREATE INDEX idx_people_name ON people USING gin(to_tsvector('english', name));
CREATE INDEX idx_people_tags ON people USING gin(tags);
```

### Places

```sql
CREATE TABLE places (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    -- Identity
    name            VARCHAR(255) NOT NULL,
    type            VARCHAR(50) DEFAULT 'location', -- home, office, restaurant, venue, city, etc.

    -- Location Data
    address         TEXT,
    city            VARCHAR(100),
    state           VARCHAR(100),
    country         VARCHAR(100),
    postal_code     VARCHAR(20),
    latitude        DECIMAL(10, 8),
    longitude       DECIMAL(11, 8),
    timezone        VARCHAR(50),

    -- Context
    notes           TEXT,
    importance      INTEGER DEFAULT 5,

    -- Source Tracking
    source          VARCHAR(50) NOT NULL,
    source_id       VARCHAR(255),
    source_synced_at TIMESTAMPTZ,

    -- Metadata
    metadata        JSONB DEFAULT '{}', -- hours, contact info, etc.
    tags            TEXT[] DEFAULT '{}',

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_places_user_id ON places(user_id);
CREATE INDEX idx_places_name ON places USING gin(to_tsvector('english', name));
CREATE INDEX idx_places_location ON places USING gist(
    ll_to_earth(latitude, longitude)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
```

### Events

```sql
CREATE TABLE events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    -- Identity
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    type            VARCHAR(50) DEFAULT 'meeting', -- meeting, call, travel, deadline, reminder, etc.

    -- Timing
    starts_at       TIMESTAMPTZ NOT NULL,
    ends_at         TIMESTAMPTZ,
    all_day         BOOLEAN DEFAULT FALSE,
    timezone        VARCHAR(50),

    -- Recurrence
    recurrence_rule TEXT, -- RRULE format
    recurrence_id   UUID REFERENCES events(id), -- Parent event for recurring

    -- Location
    location        TEXT,
    place_id        UUID REFERENCES places(id),
    virtual_url     TEXT, -- Zoom/Meet/Teams link

    -- Status
    status          VARCHAR(20) DEFAULT 'confirmed', -- tentative, confirmed, cancelled
    visibility      VARCHAR(20) DEFAULT 'private', -- private, public

    -- Context
    notes           TEXT,
    importance      INTEGER DEFAULT 5,

    -- Source Tracking
    source          VARCHAR(50) NOT NULL,
    source_id       VARCHAR(255),
    source_synced_at TIMESTAMPTZ,

    -- Metadata
    metadata        JSONB DEFAULT '{}', -- attendees status, reminders, etc.
    tags            TEXT[] DEFAULT '{}',

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_starts_at ON events(starts_at);
CREATE INDEX idx_events_ends_at ON events(ends_at);
CREATE INDEX idx_events_source ON events(source, source_id);
```

### Tasks

```sql
CREATE TABLE tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    -- Identity
    title           VARCHAR(500) NOT NULL,
    description     TEXT,

    -- Hierarchy
    parent_id       UUID REFERENCES tasks(id),
    project_id      UUID, -- Future: REFERENCES projects(id)
    position        INTEGER DEFAULT 0, -- For ordering

    -- Status
    status          VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, cancelled, deferred
    priority        VARCHAR(20) DEFAULT 'medium', -- low, medium, high, urgent

    -- Timing
    due_date        TIMESTAMPTZ,
    due_time        TIME,
    start_date      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,

    -- Estimation
    estimated_minutes INTEGER,
    actual_minutes  INTEGER,

    -- Context
    notes           TEXT,

    -- Assignments
    assigned_to     UUID REFERENCES people(id), -- Can assign to a contact

    -- Source Tracking
    source          VARCHAR(50) NOT NULL,
    source_id       VARCHAR(255),
    source_synced_at TIMESTAMPTZ,

    -- Metadata
    metadata        JSONB DEFAULT '{}', -- subtasks, checklists, etc.
    tags            TEXT[] DEFAULT '{}',

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
```

### Deadlines

```sql
CREATE TABLE deadlines (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    -- Identity
    title           VARCHAR(500) NOT NULL,
    description     TEXT,
    type            VARCHAR(50) DEFAULT 'deadline', -- deadline, milestone, reminder

    -- Timing
    due_at          TIMESTAMPTZ NOT NULL,
    reminder_at     TIMESTAMPTZ,

    -- Status
    status          VARCHAR(20) DEFAULT 'pending', -- pending, completed, missed, extended
    importance      INTEGER DEFAULT 5, -- 1-10

    -- Associations (can link to various entities)
    task_id         UUID REFERENCES tasks(id),
    event_id        UUID REFERENCES events(id),

    -- Context
    notes           TEXT,
    consequences    TEXT, -- What happens if missed

    -- Source Tracking
    source          VARCHAR(50) NOT NULL,
    source_id       VARCHAR(255),
    source_synced_at TIMESTAMPTZ,

    -- Metadata
    metadata        JSONB DEFAULT '{}',
    tags            TEXT[] DEFAULT '{}',

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ
);

CREATE INDEX idx_deadlines_user_id ON deadlines(user_id);
CREATE INDEX idx_deadlines_due_at ON deadlines(due_at);
CREATE INDEX idx_deadlines_status ON deadlines(status);
```

---

## Relationship System

### Entity Relationships

```sql
CREATE TABLE entity_relationships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    -- Source Entity
    source_type     VARCHAR(50) NOT NULL, -- person, place, event, task, deadline
    source_id       UUID NOT NULL,

    -- Target Entity
    target_type     VARCHAR(50) NOT NULL,
    target_id       UUID NOT NULL,

    -- Relationship
    relationship    VARCHAR(100) NOT NULL, -- works_with, manages, attends, located_at, etc.
    strength        INTEGER DEFAULT 5, -- 1-10
    bidirectional   BOOLEAN DEFAULT FALSE,

    -- Context
    notes           TEXT,

    -- Metadata
    metadata        JSONB DEFAULT '{}',

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    UNIQUE(user_id, source_type, source_id, target_type, target_id, relationship)
);

CREATE INDEX idx_relationships_source ON entity_relationships(source_type, source_id);
CREATE INDEX idx_relationships_target ON entity_relationships(target_type, target_id);
CREATE INDEX idx_relationships_type ON entity_relationships(relationship);
```

### Common Relationship Types

| Source → Target | Relationship Types                                              |
| --------------- | --------------------------------------------------------------- |
| Person → Person | `works_with`, `manages`, `reports_to`, `knows`, `introduced_by` |
| Person → Place  | `works_at`, `lives_at`, `frequents`                             |
| Person → Event  | `attends`, `organizes`, `declined`                              |
| Person → Task   | `assigned_to`, `created_by`, `mentioned_in`                     |
| Event → Place   | `located_at`                                                    |
| Task → Event    | `scheduled_for`, `discussed_in`                                 |

---

## Audit Trail

### Agent Actions Log

```sql
CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    -- Session Context
    session_id      UUID NOT NULL,
    conversation_id UUID,

    -- Action Details
    action_type     VARCHAR(100) NOT NULL, -- query, create, update, delete, send, analyze, etc.
    action_category VARCHAR(50) NOT NULL, -- context, integration, agent, user

    -- What was affected
    entity_type     VARCHAR(50), -- person, task, email, message, etc.
    entity_id       UUID,
    entity_snapshot JSONB, -- State at time of action

    -- Agent Reasoning
    intent          TEXT, -- What the agent understood
    reasoning       TEXT, -- Why the agent took this action
    confidence      DECIMAL(3, 2), -- 0.00 - 1.00

    -- Input/Output
    input_summary   TEXT, -- User input or trigger
    output_summary  TEXT, -- What was produced

    -- Metadata
    metadata        JSONB DEFAULT '{}', -- tokens used, model, latency, etc.

    -- Status
    status          VARCHAR(20) DEFAULT 'completed', -- pending, completed, failed, rolled_back
    error_message   TEXT,

    -- Timing
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,

    -- Immutability (no updated_at, no deleted_at)
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Partition by month for efficient querying and archival
-- CREATE TABLE audit_log_y2024m12 PARTITION OF audit_log
--     FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

CREATE INDEX idx_audit_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_session_id ON audit_log(session_id);
CREATE INDEX idx_audit_action_type ON audit_log(action_type);
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_created_at ON audit_log(created_at);
```

### Agent Assumptions Log

```sql
CREATE TABLE agent_assumptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    audit_log_id    UUID REFERENCES audit_log(id),

    -- The Assumption
    assumption      TEXT NOT NULL,
    category        VARCHAR(50) NOT NULL, -- intent, context, preference, inference

    -- Evidence
    evidence        JSONB NOT NULL, -- What supported this assumption
    confidence      DECIMAL(3, 2) NOT NULL, -- 0.00 - 1.00

    -- Verification
    verified        BOOLEAN,
    verified_at     TIMESTAMPTZ,
    verified_by     VARCHAR(50), -- user, system, feedback

    -- If wrong, what was correct
    correction      TEXT,

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_assumptions_audit ON agent_assumptions(audit_log_id);
CREATE INDEX idx_assumptions_category ON agent_assumptions(category);
```

---

## Conversation & Session State

### Sessions

```sql
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    -- Session State
    status          VARCHAR(20) DEFAULT 'active', -- active, completed, abandoned

    -- Context
    context_snapshot JSONB DEFAULT '{}', -- Relevant context at session start

    -- Timestamps
    started_at      TIMESTAMPTZ DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at        TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_status ON sessions(status);
```

### Conversations

```sql
CREATE TABLE conversations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    session_id      UUID REFERENCES sessions(id),

    -- Conversation Metadata
    title           VARCHAR(255),
    summary         TEXT,

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_session_id ON conversations(session_id);
```

### Messages

```sql
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id),

    -- Message Content
    role            VARCHAR(20) NOT NULL, -- user, assistant, system, tool
    content         TEXT NOT NULL,

    -- Tool Calls (for assistant messages)
    tool_calls      JSONB, -- [{id, name, arguments}, ...]
    tool_call_id    VARCHAR(255), -- For tool response messages

    -- Metadata
    metadata        JSONB DEFAULT '{}', -- tokens, model, latency

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
```

---

## Vector Store (Embeddings)

### Embeddings Table

```sql
-- Requires: CREATE EXTENSION vector;

CREATE TABLE embeddings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    -- Source Reference
    entity_type     VARCHAR(50) NOT NULL, -- person, event, task, message, email, note
    entity_id       UUID NOT NULL,
    chunk_index     INTEGER DEFAULT 0, -- For long content split into chunks

    -- Content
    content         TEXT NOT NULL,
    content_hash    VARCHAR(64) NOT NULL, -- SHA256 for deduplication

    -- Vector
    embedding       vector(1536), -- OpenAI ada-002 dimension

    -- Metadata
    metadata        JSONB DEFAULT '{}',

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, entity_type, entity_id, chunk_index)
);

CREATE INDEX idx_embeddings_entity ON embeddings(entity_type, entity_id);
CREATE INDEX idx_embeddings_user ON embeddings(user_id);

-- Vector similarity search index
CREATE INDEX idx_embeddings_vector ON embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
```

---

## Integration State

### Connected Accounts

```sql
CREATE TABLE connected_accounts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),

    -- Provider
    provider        VARCHAR(50) NOT NULL, -- google, slack, microsoft, etc.
    provider_account_id VARCHAR(255) NOT NULL,

    -- Tokens (encrypted at rest)
    access_token    TEXT NOT NULL,
    refresh_token   TEXT,
    token_expires_at TIMESTAMPTZ,

    -- Scopes
    scopes          TEXT[] DEFAULT '{}',

    -- Sync State
    last_sync_at    TIMESTAMPTZ,
    sync_cursor     JSONB DEFAULT '{}', -- Provider-specific pagination state
    sync_enabled    BOOLEAN DEFAULT TRUE,

    -- Status
    status          VARCHAR(20) DEFAULT 'active', -- active, expired, revoked, error
    error_message   TEXT,

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, provider, provider_account_id)
);

CREATE INDEX idx_connected_accounts_user ON connected_accounts(user_id);
CREATE INDEX idx_connected_accounts_provider ON connected_accounts(provider);
```

---

## Gmail Integration

### Emails

```sql
CREATE TABLE emails (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gmail_id        TEXT NOT NULL UNIQUE,
    thread_id       TEXT NOT NULL,

    -- History tracking for incremental sync
    history_id      TEXT,

    -- Headers
    subject         TEXT,
    from_email      TEXT NOT NULL,
    from_name       TEXT,
    to_emails       TEXT[] DEFAULT '{}',
    cc_emails       TEXT[] DEFAULT '{}',
    bcc_emails      TEXT[] DEFAULT '{}',
    reply_to        TEXT,

    -- Content
    snippet         TEXT,
    body_text       TEXT,
    body_html       TEXT,

    -- Metadata
    label_ids       TEXT[] DEFAULT '{}',
    is_read         BOOLEAN DEFAULT FALSE,
    is_starred      BOOLEAN DEFAULT FALSE,
    is_important    BOOLEAN DEFAULT FALSE,
    is_draft        BOOLEAN DEFAULT FALSE,
    has_attachments BOOLEAN DEFAULT FALSE,

    -- Attachment info as JSON
    attachments     JSONB DEFAULT '[]',

    -- Timestamps
    internal_date   TIMESTAMPTZ NOT NULL, -- Gmail's internal date
    received_at     TIMESTAMPTZ NOT NULL, -- When email was received
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);

-- Primary query patterns
CREATE INDEX idx_emails_user_date ON emails(user_id, internal_date DESC);
CREATE INDEX idx_emails_user_thread ON emails(user_id, thread_id);
CREATE INDEX idx_emails_user_from ON emails(user_id, from_email);
CREATE INDEX idx_emails_user_read ON emails(user_id, is_read);
CREATE INDEX idx_emails_gmail_id ON emails(gmail_id);
```

### Email Labels

```sql
CREATE TABLE email_labels (
    id                      TEXT PRIMARY KEY,
    user_id                 TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gmail_id                TEXT NOT NULL,
    name                    TEXT NOT NULL,
    type                    TEXT NOT NULL, -- 'system' or 'user'

    -- Visibility settings
    color                   JSONB, -- { textColor, backgroundColor }
    message_list_visibility TEXT, -- show, hide
    label_list_visibility   TEXT, -- labelShow, labelShowIfUnread, labelHide

    -- Statistics
    message_count           INTEGER DEFAULT 0,
    unread_count            INTEGER DEFAULT 0,

    -- Timestamps
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    updated_at              TIMESTAMPTZ,

    UNIQUE(user_id, gmail_id)
);

CREATE INDEX idx_email_labels_user ON email_labels(user_id);
```

### Gmail Sync State

Tracks synchronization state for incremental syncing using Gmail's History API:

```sql
CREATE TABLE gmail_sync_state (
    id              TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- Sync tracking
    history_id      TEXT,         -- Gmail history ID for incremental sync
    last_sync_at    TIMESTAMPTZ,
    last_full_sync_at TIMESTAMPTZ,

    -- Status
    sync_status     TEXT DEFAULT 'idle', -- idle, syncing, error
    sync_error      TEXT,

    -- Statistics
    email_count     INTEGER DEFAULT 0,
    label_count     INTEGER DEFAULT 0,
    contact_count   INTEGER DEFAULT 0,

    -- Sync configuration
    sync_labels     TEXT[] DEFAULT '{}', -- Labels to sync (empty = all)
    exclude_labels  TEXT[] DEFAULT '{}', -- Labels to exclude
    max_email_age_days INTEGER,          -- Only sync emails from last N days
    sync_attachments BOOLEAN DEFAULT FALSE,

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ
);
```

### Email ER Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           Gmail Integration                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐       ┌───────────────┐       ┌─────────────────┐     │
│  │     User     │──1:N──│     Email     │       │   EmailLabel    │     │
│  ├──────────────┤       ├───────────────┤       ├─────────────────┤     │
│  │ id           │       │ id            │       │ id              │     │
│  │ email        │       │ userId ────────┼──────│ userId ──────────     │
│  │ ...          │       │ gmailId       │       │ gmailId         │     │
│  └──────────────┘       │ threadId      │       │ name            │     │
│         │               │ subject       │       │ type            │     │
│         │               │ fromEmail     │       │ messageCount    │     │
│         │               │ labelIds[] ────┼─refs─│ unreadCount     │     │
│         │               │ bodyText      │       └─────────────────┘     │
│         │               │ ...           │                               │
│         │               └───────────────┘                               │
│         │                                                               │
│         │               ┌─────────────────┐                             │
│         └──────1:1──────│ GmailSyncState  │                             │
│                         ├─────────────────┤                             │
│                         │ id              │                             │
│                         │ userId          │                             │
│                         │ historyId       │                             │
│                         │ syncStatus      │                             │
│                         │ lastSyncAt      │                             │
│                         │ emailCount      │                             │
│                         └─────────────────┘                             │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Sync Flow

1. **Full Sync** (initial import):
   - Get current `historyId` from Gmail profile
   - Fetch all messages (paginated)
   - Store in database
   - Save `historyId` for incremental sync

2. **Incremental Sync** (delta updates):
   - Call Gmail History API with stored `historyId`
   - Process added/deleted messages
   - Update local database
   - Update `historyId`

---

## Skills Registry

### Skills

```sql
CREATE TABLE skills (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identity
    name            VARCHAR(100) NOT NULL UNIQUE,
    display_name    VARCHAR(255) NOT NULL,
    description     TEXT,
    version         VARCHAR(20) DEFAULT '1.0.0',

    -- Classification
    category        VARCHAR(50) NOT NULL, -- communication, productivity, analysis, etc.

    -- Configuration
    config_schema   JSONB, -- JSON Schema for skill configuration
    default_config  JSONB DEFAULT '{}',

    -- Requirements
    required_integrations TEXT[] DEFAULT '{}', -- ['gmail', 'slack']
    required_permissions TEXT[] DEFAULT '{}',

    -- Status
    status          VARCHAR(20) DEFAULT 'active', -- active, deprecated, disabled

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_skill_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    skill_id        UUID NOT NULL REFERENCES skills(id),

    -- User's config overrides
    config          JSONB DEFAULT '{}',
    enabled         BOOLEAN DEFAULT TRUE,

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, skill_id)
);
```

---

## Migration Strategy

### Initial Setup Order

1. Enable extensions: `uuid-ossp`, `pgcrypto`, `vector`
2. Create `users` table
3. Create context entities: `people`, `places`, `events`, `tasks`, `deadlines`
4. Create `entity_relationships`
5. Create audit tables: `audit_log`, `agent_assumptions`
6. Create session tables: `sessions`, `conversations`, `messages`
7. Create `embeddings`
8. Create `connected_accounts`
9. Create `skills` and `user_skill_settings`
10. Create Gmail tables: `emails`, `email_labels`, `gmail_sync_state`

### Indexing Strategy

- B-tree indexes for exact matches and ranges
- GIN indexes for full-text search and arrays
- GiST indexes for geospatial queries
- IVFFlat indexes for vector similarity

---

## Future Considerations

### Partitioning

- Partition `audit_log` by month
- Partition `messages` by user_id
- Partition `embeddings` by user_id

### Archival

- Move old audit logs to cold storage
- Compress embeddings for inactive users

### Multi-tenancy

- Row-level security policies
- User isolation via `user_id` foreign keys
