# Theo Build Log

> Historical record of implementation progress and decisions made during development.

---

## Phase 0: Project Setup

**Completed**: December 2024  
**Duration**: ~1 session

### Goals
- Establish development environment
- Create project structure
- Set up CI/CD foundation
- Docker-based local development

### What Was Built

#### 1. Next.js Application
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **Styling**: Tailwind CSS v4
- **Build**: Standalone output for Docker deployment

#### 2. Docker Compose Stack

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| PostgreSQL | pgvector/pgvector:pg16 | 5432 | Primary database with vector search |
| Redis | redis:7-alpine | 6379 | Cache, sessions, job queues |
| pgAdmin | dpage/pgadmin4 | 5050 | Database GUI (optional) |
| Redis Commander | rediscommander | 8081 | Redis GUI (optional) |
| LocalStack | localstack | 4566 | AWS emulation (optional) |
| Mailpit | axllent/mailpit | 8025 | Email testing (optional) |

#### 3. Database Schema (Prisma)

**Core Entities Created**:
- `User` - Account owner with preferences
- `Account` / `Session` / `VerificationToken` - NextAuth.js tables
- `Conversation` / `Message` - Chat history
- `Person` - Contact/relationship tracking
- `Place` - Location context
- `Event` - Calendar events
- `Task` - Task management
- `Deadline` - Time-sensitive items
- `EntityRelationship` - Connections between entities
- `ConnectedAccount` - Integration tokens
- `AuditLog` / `AgentAssumption` - Full audit trail

**Extensions Enabled**:
- `uuid-ossp` - UUID generation
- `pgcrypto` - Cryptographic functions
- `vector` - pgvector for embeddings

#### 4. Project Structure

```
theo-core/
├── src/
│   ├── app/                    # Next.js App Router
│   │   └── api/health/         # Health check endpoint
│   ├── components/
│   │   ├── ui/                 # Base UI (empty)
│   │   ├── chat/               # Chat interface (empty)
│   │   └── shared/             # Shared components (empty)
│   ├── lib/
│   │   ├── db/                 # Prisma client singleton
│   │   ├── auth/               # Authentication (empty)
│   │   ├── agent/              # Agent engine (empty)
│   │   └── utils/              # Utility functions
│   ├── integrations/
│   │   ├── gmail/              # Gmail client stub
│   │   ├── slack/              # Slack client stub
│   │   └── types.ts            # Integration interfaces
│   ├── services/
│   │   ├── audit/              # Audit logging service
│   │   ├── context/            # Context service (empty)
│   │   └── skills/             # Skills (empty)
│   └── types/                  # Core TypeScript types
├── prisma/
│   └── schema.prisma           # Complete database schema
├── scripts/
│   ├── init-db.sql             # PostgreSQL initialization
│   └── seed.ts                 # Sample data seeder
├── docs/                       # Documentation
└── tests/                      # Test directory
```

#### 5. Development Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start Next.js dev server |
| `npm run dev:all` | Docker + Next.js together |
| `npm run db:start` | Start PostgreSQL + Redis |
| `npm run db:push` | Push Prisma schema |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:seed` | Seed sample data |
| `npm run db:reset` | Reset database (destructive) |
| `npm run docker:clean` | Remove all containers/volumes |

#### 6. Configuration Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Local services definition |
| `Dockerfile` | Production multi-stage build |
| `.dockerignore` | Docker build exclusions |
| `.env.example` | Environment variable template |
| `.prettierrc` | Code formatting rules |
| `next.config.ts` | Next.js configuration |

### Services Implemented

#### Audit Service (`src/services/audit/`)

Full audit logging with:
- `logAuditEntry()` - Log completed actions
- `startAuditEntry()` - Start pending actions
- `completeAuditEntry()` - Complete pending actions
- `logAssumption()` - Track agent assumptions
- `verifyAssumption()` - User/system verification
- `queryAuditLog()` - Query audit history
- `getEntityAuditTrail()` - Entity-specific history

#### Integration Stubs

**Gmail** (`src/integrations/gmail/`):
- Scope definitions (readonly, send, full)
- `GmailClient` class with method stubs
- Type definitions for messages

**Slack** (`src/integrations/slack/`):
- Scope definitions (user, bot)
- `SlackClient` class with method stubs
- Type definitions for users, channels, messages

### Build Verification

| Check | Result |
|-------|--------|
| TypeScript | ✅ No errors |
| ESLint | ✅ 0 errors, 13 warnings (stub methods) |
| Build | ✅ Successful |
| Prisma Generate | ✅ Client generated |

### Decisions Made

1. **npm over pnpm**: Used npm for broader compatibility
2. **Prisma over raw SQL**: Better type safety and migrations
3. **pgvector in PostgreSQL**: Single database for relational + vector data
4. **Standalone build**: Required for Docker deployment
5. **Optional Docker profiles**: Core services always, tools on demand

### Dependencies Added

**Production**:
- `@prisma/client` - Database ORM
- `clsx` - Conditional class names
- `tailwind-merge` - Tailwind class merging
- `zod` - Schema validation

**Development**:
- `prisma` - Schema management and migrations
- `prettier` - Code formatting
- `prettier-plugin-tailwindcss` - Tailwind class sorting
- `tsx` - TypeScript execution for scripts
- `vitest` - Testing framework

### Files Created

```
Created/Modified:
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
├── .env.example
├── .prettierrc
├── .prettierignore
├── next.config.ts
├── package.json (updated)
├── README.md (updated)
├── prisma/schema.prisma
├── scripts/init-db.sql
├── scripts/seed.ts
├── src/app/api/health/route.ts
├── src/lib/db/index.ts
├── src/lib/utils/index.ts
├── src/types/index.ts
├── src/services/audit/index.ts
├── src/integrations/gmail/index.ts
├── src/integrations/slack/index.ts
└── src/integrations/types.ts
```

### Quick Start (Post Phase 0)

```bash
# Start databases
docker compose up -d

# Push schema to database
npm run db:push

# (Optional) Seed sample data
npm run db:seed

# Start development server
npm run dev
```

---

## Phase 1: Core Foundation

**Status**: In Progress  
**Started**: December 2024

### Goals
- Authentication system with Google OAuth
- Basic chat interface
- Message storage in database
- Audit logging foundation

### What Was Built

#### 1. Authentication (NextAuth.js v5)

**Files Created**:
- `src/lib/auth/index.ts` - NextAuth configuration with Google OAuth
- `src/app/api/auth/[...nextauth]/route.ts` - Auth API handlers
- `src/types/next-auth.d.ts` - TypeScript module augmentation
- `middleware.ts` - Route protection middleware
- `src/components/providers/session-provider.tsx` - Client session provider

**Features**:
- Google OAuth with offline access (refresh tokens)
- JWT session strategy (30-day sessions)
- User ID exposed in session for client components
- Protected routes: `/chat/*`, `/settings/*`
- Custom login page at `/login`

#### 2. UI Component Library (shadcn/ui)

**Decision**: Adopted shadcn/ui as the component library.

**Why shadcn/ui**:
- Full code ownership - components live in codebase
- Built on Radix UI (excellent accessibility)
- Tailwind CSS native - perfect stack alignment
- Highly customizable without fighting the library
- Modern, clean aesthetic fits Theo's personal assistant character
- Massive community adoption for Next.js projects

**Alternatives Considered**:
- Material UI - Too opinionated, large bundle, not Tailwind-native
- Chakra UI - Different styling paradigm, mixing with Tailwind awkward
- Radix + DIY - More work, no pre-built styles
- Headless UI - Too limited component set

### Dependencies Added

**Production**:
- `next-auth@beta` - Authentication (v5)
- `@auth/prisma-adapter` - Prisma adapter for NextAuth

**Development** (via shadcn):
- Radix UI primitives (added per-component)
- `class-variance-authority` - Variant styling
- `lucide-react` - Icons

#### 3. Authentication UI & Flow

**Files Created**:
- `src/app/(auth)/layout.tsx` - Auth layout with session redirect
- `src/app/(auth)/login/page.tsx` - Google OAuth login page
- `src/components/user-dropdown.tsx` - User avatar dropdown with sign out
- `src/components/ui/index.ts` - Barrel exports for UI components

**shadcn/ui Components Added**:
- `button` - Primary button component
- `avatar` - User avatar with image/fallback
- `dropdown-menu` - Accessible dropdown menus
- `card` - Card container for login form
- `input` - Text input component

**Features**:
- Clean login UI with Google OAuth button
- Session-aware layout (redirects authenticated users)
- User dropdown with avatar, name, email, and sign out
- Loading states and error handling
- Suspense boundary for search params

#### 4. Database Migrations

**Migration Created**: `20251219192018_init`

Formalized the database schema with proper Prisma migrations:

**PostgreSQL Extensions**:
- `pgcrypto` - Cryptographic functions
- `uuid-ossp` - UUID generation
- `vector` - pgvector for embeddings (1536 dimensions)

**Tables Created** (16 total):
- `User`, `Account`, `Session`, `VerificationToken` - Authentication
- `Conversation`, `Message` - Chat history
- `Person`, `Place`, `Event`, `Task`, `Deadline` - Context entities
- `EntityRelationship` - Entity connections
- `ConnectedAccount` - Integration OAuth tokens
- `AuditLog`, `AgentAssumption` - Audit trail
- `Embedding` - Vector store

**Indexes Created**:
- User email (unique)
- Message by conversation + timestamp
- Person by userId, email, source
- Event by startsAt
- Task by status, dueDate
- Deadline by dueAt, status
- AuditLog by sessionId, actionType, createdAt
- Embedding by entityType + entityId

**Foreign Keys**:
- Cascade deletes for user-owned data
- SetNull for optional relationships (place, task, person assignments)

### Decisions Made

1. **NextAuth v5 over v4**: Better Edge runtime support, cleaner API
2. **JWT over Database sessions**: Works with Edge middleware, simpler
3. **shadcn/ui over other libraries**: Full ownership, Tailwind-native, accessible
4. **Prisma migrations over db:push**: Proper migration history for production deployments

#### 5. Chat Services

**Files Created**:
- `src/services/chat/index.ts` - Service barrel exports
- `src/services/chat/types.ts` - TypeScript interfaces and DTOs
- `src/services/chat/conversation.ts` - Conversation CRUD operations
- `src/services/chat/message.ts` - Message operations

**ConversationService Functions**:
- `createConversation()` - Create new conversation with optional title
- `getConversation()` - Get by ID with optional messages
- `listConversations()` - Paginated list with cursor-based pagination
- `updateConversation()` - Update title/summary
- `deleteConversation()` - Delete with cascade to messages
- `generateTitleFromContent()` - Auto-generate title from first message

**MessageService Functions**:
- `createMessage()` - Create message with role (user/assistant/system/tool)
- `listMessages()` - Paginated message history with bi-directional pagination
- `getMessagesForContext()` - Get messages for AI context window

**Features**:
- Full audit logging for all CRUD operations
- Automatic title generation from first user message
- Cursor-based pagination for infinite scroll
- Ownership verification (users can only access their data)
- Tool call support for AI agent interactions
- Metadata tracking (tokens, latency, model info)

#### 6. Chat API Routes

**Files Created**:
- `src/app/api/chat/conversations/route.ts` - List and create conversations
- `src/app/api/chat/conversations/[id]/route.ts` - Get, update, delete conversation
- `src/app/api/chat/conversations/[id]/messages/route.ts` - List and create messages

**API Endpoints**:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat/conversations` | Create new conversation |
| `GET` | `/api/chat/conversations` | List user's conversations (paginated) |
| `GET` | `/api/chat/conversations/[id]` | Get conversation with messages |
| `PATCH` | `/api/chat/conversations/[id]` | Update conversation title/summary |
| `DELETE` | `/api/chat/conversations/[id]` | Delete conversation and messages |
| `POST` | `/api/chat/conversations/[id]/messages` | Create message in conversation |
| `GET` | `/api/chat/conversations/[id]/messages` | List messages (paginated) |

**Features**:
- Full authentication on all routes (via `auth()`)
- User ownership verification (users can only access their data)
- Request validation with helpful error messages
- Cursor-based pagination with configurable limits
- Query parameters for include options (messages, messageLimit)
- Proper HTTP status codes (201 Created, 404 Not Found, etc.)
- Consistent error response format

### Decisions Made

1. **NextAuth v5 over v4**: Better Edge runtime support, cleaner API
2. **JWT over Database sessions**: Works with Edge middleware, simpler
3. **shadcn/ui over other libraries**: Full ownership, Tailwind-native, accessible
4. **Prisma migrations over db:push**: Proper migration history for production deployments
5. **Cursor-based pagination over offset**: Better performance for large datasets, infinite scroll friendly

### Files Created (Phase 1)

```
Created/Modified:
├── src/lib/auth/index.ts
├── src/app/api/auth/[...nextauth]/route.ts
├── src/types/next-auth.d.ts
├── middleware.ts
├── src/components/providers/session-provider.tsx
├── src/components/providers/index.ts
├── src/app/(auth)/layout.tsx
├── src/app/(auth)/login/page.tsx
├── src/components/user-dropdown.tsx
├── src/components/ui/button.tsx
├── src/components/ui/avatar.tsx
├── src/components/ui/dropdown-menu.tsx
├── src/components/ui/card.tsx
├── src/components/ui/input.tsx
├── src/components/ui/index.ts
├── src/lib/utils.ts (consolidated)
├── components.json (shadcn config)
├── prisma/migrations/20251219192018_init/migration.sql
├── src/services/chat/index.ts
├── src/services/chat/types.ts
├── src/services/chat/conversation.ts
├── src/services/chat/message.ts
├── src/app/api/chat/conversations/route.ts
├── src/app/api/chat/conversations/[id]/route.ts
└── src/app/api/chat/conversations/[id]/messages/route.ts
```

---

## Phase 2: Context System

**Status**: Complete  
**Completed**: December 2024  
**Plan**: See [PHASE_2_IMPLEMENTATION.md](./PHASE_2_IMPLEMENTATION.md) for detailed chunked plan

### What Was Built

#### Chunk 1: Foundation & Types
- `src/services/context/types.ts` - Comprehensive type definitions for all context entities
- `src/services/context/utils.ts` - Shared utilities (soft delete, pagination, email normalization, content hashing, date helpers)
- Full barrel exports in `src/services/context/index.ts`

#### Chunk 2: People Service
- `src/services/context/people/` - Full CRUD operations for Person entities
- Create, read, update, soft-delete, restore operations
- Find by email, find by source, text search
- Upsert from external sources (for integration sync)
- Full audit logging on all mutations

#### Chunk 3: Remaining Entity Services
- `src/services/context/places/` - Places with geocoding stub, city/nearby search
- `src/services/context/events/` - Events with time range queries, status transitions
- `src/services/context/tasks/` - Tasks with hierarchy support, status workflow
- `src/services/context/deadlines/` - Deadlines with urgency calculation

#### Chunk 4: Relationships Service
- `src/services/context/relationships/` - Bidirectional relationship management
- Create/update/delete relationships between any entity types
- Query relationships from either direction
- Resolve related entities (get actual Person/Place/etc., not just IDs)
- Sync relationships for integration imports

#### Chunk 5: Context API Routes
- `src/app/api/context/people/` - Person CRUD endpoints
- `src/app/api/context/places/` - Place CRUD endpoints
- `src/app/api/context/events/` - Event CRUD endpoints
- `src/app/api/context/tasks/` - Task CRUD endpoints
- `src/app/api/context/deadlines/` - Deadline CRUD endpoints
- `src/app/api/context/relationships/` - Relationship endpoints
- `src/app/api/context/search/` - Unified search endpoint

#### Chunk 6: Embedding Service Foundation
- `src/lib/embeddings/types.ts` - Embedding types and configuration
- `src/lib/embeddings/openai-provider.ts` - OpenAI embedding provider with rate limiting
- `src/lib/embeddings/embedding-service.ts` - Core embedding generation and storage
- Content chunking for long text with configurable overlap
- Content hash deduplication to avoid redundant API calls

#### Chunk 7: Semantic Search
- `src/lib/embeddings/search-service.ts` - Vector similarity search using pgvector
- `src/services/context/context-search.ts` - Unified context search (text + semantic)
- Support for filtering by entity type
- Configurable similarity threshold and result limits

#### Chunk 8: Entity Embedding Integration
- `src/services/context/embedding-integration.ts` - Embedding lifecycle hooks
- Content builders for each entity type (Person, Place, Event, Task, Deadline)
- Automatic embedding generation on entity create/update
- Automatic embedding deletion on entity delete
- Fire-and-forget pattern - embedding errors don't fail main operations

### Files Created/Modified

```
src/services/context/
├── index.ts                      # Updated with all exports
├── types.ts                      # Comprehensive type definitions
├── utils.ts                      # Shared utilities
├── context-search.ts             # Unified search service
├── embedding-integration.ts      # NEW: Entity embedding lifecycle
├── people/
│   ├── index.ts
│   ├── types.ts
│   └── people-service.ts         # Updated with embedding hooks
├── places/
│   ├── index.ts
│   ├── types.ts
│   └── places-service.ts         # Updated with embedding hooks
├── events/
│   ├── index.ts
│   ├── types.ts
│   └── events-service.ts         # Updated with embedding hooks
├── tasks/
│   ├── index.ts
│   ├── types.ts
│   └── tasks-service.ts          # Updated with embedding hooks
├── deadlines/
│   ├── index.ts
│   ├── types.ts
│   └── deadlines-service.ts      # Updated with embedding hooks
└── relationships/
    ├── index.ts
    ├── types.ts
    └── relationships-service.ts

src/lib/embeddings/
├── index.ts
├── types.ts
├── openai-provider.ts
├── embedding-service.ts
└── search-service.ts

tests/services/context/
├── utils.test.ts
├── people-service.test.ts
├── places-service.test.ts
├── events-service.test.ts
├── tasks-service.test.ts
├── deadlines-service.test.ts
├── relationships-service.test.ts
├── context-search.test.ts
└── embedding-integration.test.ts  # NEW: 21 tests for embedding integration

tests/lib/embeddings/
├── embedding-service.test.ts
└── search-service.test.ts
```

### Test Coverage

| Test File | Tests |
|-----------|-------|
| utils.test.ts | 44 |
| people-service.test.ts | 47 |
| places-service.test.ts | 43 |
| events-service.test.ts | 55 |
| tasks-service.test.ts | 51 |
| deadlines-service.test.ts | 57 |
| relationships-service.test.ts | 68 |
| context-search.test.ts | 21 |
| embedding-service.test.ts | 30 |
| search-service.test.ts | ~20 |
| embedding-integration.test.ts | 21 |
| **Total** | **437 tests** |

### Key Design Decisions

1. **Fire-and-forget embeddings**: Embedding generation runs asynchronously and errors are logged but don't fail the main entity operation. This ensures embedding issues don't break core functionality.

2. **Content builders per entity**: Each entity type has a specialized content builder that creates searchable text from relevant fields (name, description, tags, dates, etc.).

3. **Soft deletes everywhere**: All entities use soft deletes (`deletedAt`) for safety and audit trail.

4. **Unified context search**: Single service combines text search (database) with semantic search (embeddings) for comprehensive results.

5. **Cursor-based pagination**: All list operations use cursor-based pagination for consistent performance with large datasets.

### Acceptance Criteria Met

- ✅ All 5 entity types have full CRUD services
- ✅ Relationship service works bidirectionally
- ✅ All API endpoints implemented and tested
- ✅ Semantic search returns relevant results
- ✅ Embeddings auto-generated on entity create/update
- ✅ All audit logging in place
- ✅ Tests pass (437 tests), build succeeds
- ✅ No TypeScript errors

---

## Phase 3: Gmail Integration

**Status**: Not Started  
**Planned**: OAuth, Email Sync, Contact Import

---

## Phase 4: Slack Integration

**Status**: Not Started  
**Planned**: OAuth, User Import, Message Sync

---

## Phase 5: Agent Engine

**Status**: Not Started  
**Planned**: Intent Understanding, Planning, Tool Execution

---

## Phase 6: Polish & Launch

**Status**: Not Started  
**Planned**: UI Polish, Error Handling, Deployment

