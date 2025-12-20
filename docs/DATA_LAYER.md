# Data Layer Documentation

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) (original design), [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## Overview

Theo's data layer is built on **PostgreSQL** with **Prisma ORM** and **pgvector** for semantic search capabilities. This document covers the implementation details of the database layer, including client configuration, schema, migrations, and seeding.

---

## Technology Stack

| Component     | Technology          | Purpose                       |
| ------------- | ------------------- | ----------------------------- |
| Database      | PostgreSQL 15+      | Primary data store            |
| ORM           | Prisma              | Type-safe database access     |
| Vector Search | pgvector            | Semantic similarity search    |
| Migrations    | Prisma Migrate      | Schema version control        |
| Extensions    | uuid-ossp, pgcrypto | UUID generation, cryptography |

---

## Quick Start

### Prerequisites

```bash
# Ensure PostgreSQL is running (via Docker Compose)
docker-compose up -d postgres

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:push

# (Optional) Seed with sample data
npm run db:seed
```

### Environment Configuration

```env
# .env.local
DATABASE_URL="postgresql://theo:theo_dev_password@localhost:5432/theo_dev?schema=public"
```

---

## Prisma Client Setup

### Singleton Pattern

The Prisma client uses a singleton pattern to prevent connection pool exhaustion, especially important for:

- Next.js hot reloading in development
- Serverless function cold starts in production

```typescript:src/lib/db/index.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// Cache globally to prevent multiple instances
globalForPrisma.prisma = db;
```

### Usage

```typescript
import { db } from "@/lib/db";

// Query examples
const users = await db.user.findMany();
const person = await db.person.findUnique({ where: { id: "..." } });
```

### Logging Configuration

| Environment | Log Levels               |
| ----------- | ------------------------ |
| Development | `query`, `error`, `warn` |
| Production  | `error` only             |

---

## Database Schema

### PostgreSQL Extensions

Required extensions are enabled in the initial migration:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";  -- UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "vector";     -- pgvector for embeddings
```

### Model Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         THEO DATABASE                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  AUTHENTICATION          CHAT                  CONTEXT ENTITIES      │
│  ┌──────────┐           ┌──────────────┐      ┌──────────┐          │
│  │   User   │──────────▶│ Conversation │      │  Person  │          │
│  └──────────┘           └──────────────┘      ├──────────┤          │
│       │                        │              │  Place   │          │
│  ┌──────────┐           ┌──────────────┐      ├──────────┤          │
│  │ Account  │           │   Message    │      │  Event   │          │
│  └──────────┘           └──────────────┘      ├──────────┤          │
│  ┌──────────┐                                 │   Task   │          │
│  │ Session  │                                 ├──────────┤          │
│  └──────────┘                                 │ Deadline │          │
│                                               └──────────┘          │
│                                                                      │
│  RELATIONSHIPS           AUDIT                 INTEGRATIONS          │
│  ┌────────────────┐     ┌──────────────┐      ┌─────────────────┐   │
│  │EntityRelation- │     │  AuditLog    │      │ConnectedAccount │   │
│  │     ship       │     └──────────────┘      └─────────────────┘   │
│  └────────────────┘            │                                     │
│                         ┌──────────────┐                             │
│                         │   Agent      │                             │
│                         │  Assumption  │                             │
│                         └──────────────┘                             │
│                                                                      │
│  VECTOR STORE                                                        │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Embedding (with pgvector - 1536 dimensions for ada-002)      │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Models

### User & Authentication

#### User

Central user model with preferences and relationships to all user-owned data.

```prisma
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  emailVerified DateTime?
  preferences   Json      @default("{}")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  accounts      Account[]
  sessions      Session[]
  conversations Conversation[]
  people        Person[]
  places        Place[]
  events        Event[]
  tasks         Task[]
  deadlines     Deadline[]
  // ... more relations
}
```

**Preferences JSON Structure:**

```json
{
  "timezone": "America/New_York",
  "theme": "system",
  "workingHours": { "start": "09:00", "end": "17:00" },
  "notificationPrefs": { ... }
}
```

#### Account

OAuth provider accounts (NextAuth.js Prisma Adapter compatible).

```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String  // "google", etc.
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}
```

---

### Context Entities

All context entities share common patterns:

| Field            | Type      | Purpose                                      |
| ---------------- | --------- | -------------------------------------------- |
| `userId`         | String    | Owner isolation                              |
| `source`         | String    | Origin tracking (manual, gmail, slack, etc.) |
| `sourceId`       | String?   | External system ID                           |
| `sourceSyncedAt` | DateTime? | Last sync timestamp                          |
| `metadata`       | Json      | Extensible properties                        |
| `tags`           | String[]  | User-defined labels                          |
| `deletedAt`      | DateTime? | Soft delete support                          |

#### Person

```prisma
model Person {
  id         String  @id @default(cuid())
  userId     String
  name       String
  email      String?
  phone      String?
  type       String  @default("contact") // contact, colleague, friend, family, lead
  importance Int     @default(5)         // 1-10 scale
  company    String?
  title      String?
  notes      String? @db.Text
  source     String
  // ... standard fields

  @@unique([userId, email])
  @@unique([userId, source, sourceId])
  @@index([userId])
  @@index([email])
}
```

#### Place

```prisma
model Place {
  id        String   @id @default(cuid())
  userId    String
  name      String
  type      String   @default("location") // home, office, restaurant, venue
  address   String?
  city      String?
  state     String?
  country   String?
  latitude  Decimal? @db.Decimal(10, 8)
  longitude Decimal? @db.Decimal(11, 8)
  timezone  String?
  // ... standard fields

  events Event[]

  @@index([userId])
}
```

#### Event

```prisma
model Event {
  id          String   @id @default(cuid())
  userId      String
  title       String
  description String?  @db.Text
  type        String   @default("meeting") // meeting, call, travel, deadline
  startsAt    DateTime
  endsAt      DateTime?
  allDay      Boolean  @default(false)
  location    String?
  placeId     String?
  virtualUrl  String?
  status      String   @default("confirmed") // tentative, confirmed, cancelled
  visibility  String   @default("private")
  // ... standard fields

  place     Place?     @relation(fields: [placeId], references: [id])
  deadlines Deadline[]

  @@index([userId])
  @@index([startsAt])
}
```

#### Task

```prisma
model Task {
  id               String    @id @default(cuid())
  userId           String
  title            String
  description      String?   @db.Text
  parentId         String?              // Subtask hierarchy
  position         Int       @default(0)
  status           String    @default("pending")  // pending, in_progress, completed, cancelled, deferred
  priority         String    @default("medium")   // low, medium, high, urgent
  dueDate          DateTime?
  completedAt      DateTime?
  estimatedMinutes Int?
  actualMinutes    Int?
  assignedToId     String?
  // ... standard fields

  parent     Task?      @relation("TaskHierarchy", fields: [parentId], references: [id])
  subtasks   Task[]     @relation("TaskHierarchy")
  assignedTo Person?    @relation(fields: [assignedToId], references: [id])
  deadlines  Deadline[]

  @@index([userId])
  @@index([status])
  @@index([dueDate])
}
```

#### Deadline

```prisma
model Deadline {
  id           String    @id @default(cuid())
  userId       String
  title        String
  description  String?   @db.Text
  type         String    @default("deadline") // deadline, milestone, reminder
  dueAt        DateTime
  reminderAt   DateTime?
  status       String    @default("pending")  // pending, completed, missed, extended
  importance   Int       @default(5)
  taskId       String?
  eventId      String?
  consequences String?   @db.Text
  // ... standard fields

  task  Task?  @relation(fields: [taskId], references: [id])
  event Event? @relation(fields: [eventId], references: [id])

  @@index([userId])
  @@index([dueAt])
  @@index([status])
}
```

---

### Entity Relationships

Flexible many-to-many relationships between any entity types.

```prisma
model EntityRelationship {
  id            String  @id @default(cuid())
  userId        String
  sourceType    String  // person, place, event, task, deadline
  sourceId      String
  targetType    String
  targetId      String
  relationship  String  // works_with, manages, attends, located_at, etc.
  strength      Int     @default(5) // 1-10
  bidirectional Boolean @default(false)
  notes         String? @db.Text
  metadata      Json    @default("{}")
  // ... timestamps

  @@unique([userId, sourceType, sourceId, targetType, targetId, relationship])
  @@index([sourceType, sourceId])
  @@index([targetType, targetId])
}
```

**Common Relationship Types:**

| Source → Target | Relationships                                  |
| --------------- | ---------------------------------------------- |
| Person → Person | `works_with`, `manages`, `reports_to`, `knows` |
| Person → Place  | `works_at`, `lives_at`, `frequents`            |
| Person → Event  | `attends`, `organizes`, `declined`             |
| Person → Task   | `assigned_to`, `created_by`                    |
| Event → Place   | `located_at`                                   |
| Task → Event    | `scheduled_for`, `discussed_in`                |

---

### Chat & Conversations

```prisma
model Conversation {
  id        String   @id @default(cuid())
  userId    String
  title     String?
  summary   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User      @relation(...)
  messages Message[]
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // user, assistant, system, tool
  content        String   @db.Text
  toolCalls      Json?    // [{id, name, arguments}, ...]
  toolCallId     String?  // For tool response messages
  metadata       Json     @default("{}")
  createdAt      DateTime @default(now())

  conversation Conversation @relation(...)

  @@index([conversationId, createdAt])
}
```

---

### Audit Trail

Immutable logging of all agent actions.

```prisma
model AuditLog {
  id             String    @id @default(cuid())
  userId         String
  sessionId      String?
  conversationId String?
  actionType     String    // query, create, update, delete, send, analyze
  actionCategory String    // context, integration, agent, user
  entityType     String?
  entityId       String?
  entitySnapshot Json?
  intent         String?   @db.Text
  reasoning      String?   @db.Text
  confidence     Decimal?  @db.Decimal(3, 2)
  inputSummary   String?   @db.Text
  outputSummary  String?   @db.Text
  metadata       Json      @default("{}")
  status         String    @default("completed")
  errorMessage   String?
  startedAt      DateTime  @default(now())
  completedAt    DateTime?
  durationMs     Int?
  createdAt      DateTime  @default(now())

  assumptions AgentAssumption[]

  @@index([userId])
  @@index([sessionId])
  @@index([actionType])
  @@index([createdAt])
}

model AgentAssumption {
  id         String    @id @default(cuid())
  auditLogId String
  assumption String    @db.Text
  category   String    // intent, context, preference, inference
  evidence   Json
  confidence Decimal   @db.Decimal(3, 2)
  verified   Boolean?
  verifiedAt DateTime?
  verifiedBy String?   // user, system, feedback
  correction String?   @db.Text
  createdAt  DateTime  @default(now())

  auditLog AuditLog @relation(...)

  @@index([auditLogId])
  @@index([category])
}
```

---

### Vector Embeddings

For semantic search using pgvector.

```prisma
model Embedding {
  id          String                        @id @default(cuid())
  userId      String
  entityType  String                        // person, event, task, message, etc.
  entityId    String
  chunkIndex  Int                           @default(0)
  content     String                        @db.Text
  contentHash String                        @db.VarChar(64)
  embedding   Unsupported("vector(1536)")?  // OpenAI ada-002 dimensions
  metadata    Json                          @default("{}")
  createdAt   DateTime                      @default(now())
  updatedAt   DateTime                      @updatedAt

  user User @relation(...)

  @@unique([userId, entityType, entityId, chunkIndex])
  @@index([userId])
  @@index([entityType, entityId])
}
```

**Note:** The `embedding` field uses Prisma's `Unsupported` type for the pgvector `vector(1536)` type. Raw SQL queries are required for vector operations.

---

### Connected Accounts

OAuth connections for external integrations.

```prisma
model ConnectedAccount {
  id                String    @id @default(cuid())
  userId            String
  provider          String    // google, slack, microsoft
  providerAccountId String
  accessToken       String    @db.Text
  refreshToken      String?   @db.Text
  tokenExpires      DateTime?
  scopes            String[]  @default([])
  lastSyncAt        DateTime?
  syncCursor        Json      @default("{}")
  syncEnabled       Boolean   @default(true)
  status            String    @default("active") // active, expired, revoked, error
  errorMessage      String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  @@unique([userId, provider, providerAccountId])
  @@index([userId])
  @@index([provider])
}
```

---

## Indexes

The schema includes strategic indexes for common query patterns:

### Query Pattern Indexes

| Model    | Index                       | Query Pattern            |
| -------- | --------------------------- | ------------------------ |
| Person   | `userId`                    | All "my people" queries  |
| Person   | `email`                     | Lookup by email          |
| Person   | `userId, email`             | Unique constraint        |
| Person   | `userId, source, sourceId`  | Deduplication from syncs |
| Event    | `startsAt`                  | Upcoming events          |
| Task     | `status`                    | Filter by status         |
| Task     | `dueDate`                   | Due date queries         |
| Deadline | `dueAt`                     | Approaching deadlines    |
| Message  | `conversationId, createdAt` | Message history          |
| AuditLog | `createdAt`                 | Recent actions           |

### Vector Index

For semantic search, create an IVFFlat index:

```sql
CREATE INDEX idx_embeddings_vector ON "Embedding"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

---

## Migrations

### Running Migrations

```bash
# Development: Push schema changes directly
npm run db:push

# Production: Create and apply migrations
npx prisma migrate dev --name description_of_changes
npx prisma migrate deploy
```

### Migration Files

Located in `prisma/migrations/`:

```
prisma/migrations/
├── 20251219192018_init/
│   └── migration.sql      # Initial schema
└── migration_lock.toml    # Provider lock
```

### Creating New Migrations

```bash
# Make schema changes in prisma/schema.prisma, then:
npx prisma migrate dev --name add_new_feature
```

---

## Seeding

### Development Seed Script

The seed script creates sample data for development:

```bash
npm run db:seed
```

**Created Data:**

- 1 demo user (`demo@theo.app`)
- 2 sample people (Sarah Chen, Mike Johnson)
- 3 sample tasks with varying priorities
- 1 conversation with welcome messages
- 1 audit log entry with assumption

### Custom Seeding

```typescript
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seed() {
  const user = await prisma.user.upsert({
    where: { email: "test@example.com" },
    update: {},
    create: {
      email: "test@example.com",
      name: "Test User",
    },
  });

  // Create related data...
}

seed().finally(() => prisma.$disconnect());
```

---

## Best Practices

### Query Patterns

**Always filter by userId for user data:**

```typescript
// ✅ Good
const people = await db.person.findMany({
  where: { userId: session.user.id },
});

// ❌ Bad - security issue
const people = await db.person.findMany();
```

**Use transactions for related operations:**

```typescript
await db.$transaction(async (tx) => {
  const task = await tx.task.create({ data: {...} });
  await tx.auditLog.create({
    data: { entityId: task.id, ... }
  });
});
```

**Include soft delete filter:**

```typescript
const activePeople = await db.person.findMany({
  where: {
    userId,
    deletedAt: null, // Exclude soft-deleted
  },
});
```

### Connection Management

The singleton pattern handles connection pooling automatically. For serverless deployments, Prisma's connection pooling is enabled by default.

### Raw Queries for Vector Operations

```typescript
// Semantic search requires raw SQL
const results = await db.$queryRaw`
  SELECT id, content, 
    1 - (embedding <=> ${vectorString}::vector) as similarity
  FROM "Embedding"
  WHERE "userId" = ${userId}
  ORDER BY embedding <=> ${vectorString}::vector
  LIMIT 10
`;
```

---

## Docker Configuration

The `docker-compose.yml` includes PostgreSQL with pgvector:

```yaml
postgres:
  image: pgvector/pgvector:pg16
  environment:
    POSTGRES_USER: theo
    POSTGRES_PASSWORD: theo_dev_password
    POSTGRES_DB: theo_dev
  ports:
    - "5432:5432"
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql
```

---

## Related Documentation

- [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) - Original schema design
- [AI_EMBEDDINGS.md](./AI_EMBEDDINGS.md) - Vector embedding details
- [services/CONTEXT_SERVICES.md](./services/CONTEXT_SERVICES.md) - Service layer using this data
- [AUTH_SECURITY.md](./AUTH_SECURITY.md) - Authentication models
