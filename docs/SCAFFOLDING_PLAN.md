# Theo Scaffolding Plan

> **Status**: Draft v0.1  
> **Last Updated**: December 2024

## Overview

This document provides a phased implementation plan for scaffolding the Theo platform, with clear milestones and deliverables.

---

## Phase 0: Project Setup (Week 1)

### Goals

- Establish development environment
- Create project structure
- Set up CI/CD foundation

### Tasks

#### 0.1 Initialize Next.js Project

```bash
pnpm create next-app@latest theo-core --typescript --tailwind --eslint --app --src-dir
```

#### 0.2 Project Structure

```
theo-core/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth routes
│   │   ├── (dashboard)/       # Protected routes
│   │   ├── api/               # API routes
│   │   └── layout.tsx
│   ├── components/            # React components
│   │   ├── ui/               # Base UI components
│   │   ├── chat/             # Chat interface
│   │   └── shared/           # Shared components
│   ├── lib/                   # Core libraries
│   │   ├── db/               # Database client & queries
│   │   ├── auth/             # Authentication
│   │   ├── agent/            # Agentic framework
│   │   └── utils/            # Utilities
│   ├── integrations/          # External integrations
│   │   ├── gmail/
│   │   ├── slack/
│   │   └── types.ts
│   ├── services/              # Business logic
│   │   ├── context/          # Context management
│   │   ├── audit/            # Audit logging
│   │   └── skills/           # Skill implementations
│   └── types/                 # TypeScript types
├── prisma/                    # Database schema
├── docs/                      # Documentation
├── tests/                     # Test files
└── scripts/                   # Utility scripts
```

#### 0.3 Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "@prisma/client": "^5.0.0",
    "next-auth": "^5.0.0-beta",
    "zod": "^3.22.0",
    "openai": "^4.0.0",
    "@anthropic-ai/sdk": "^0.10.0",
    "bullmq": "^5.0.0",
    "ioredis": "^5.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0",
    "@testing-library/react": "^14.0.0"
  }
}
```

#### 0.4 Environment Setup

```env
# .env.example
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."

# Auth
NEXTAUTH_SECRET=""
NEXTAUTH_URL="http://localhost:3000"

# Google OAuth
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""

# Slack OAuth
SLACK_CLIENT_ID=""
SLACK_CLIENT_SECRET=""

# AI
OPENAI_API_KEY=""
ANTHROPIC_API_KEY=""
```

### Deliverables

- [ ] Next.js project initialized
- [ ] Folder structure created
- [ ] Dependencies installed
- [ ] ESLint/Prettier configured
- [ ] Git hooks set up (husky)
- [ ] README updated with setup instructions

---

## Phase 1: Core Foundation (Weeks 2-4)

### Goals

- Database schema and migrations
- Authentication system
- Basic chat interface
- Audit logging foundation

### 1.1 Database Setup

#### Prisma Schema (Initial)

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  preferences   Json      @default("{}")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  sessions      Session[]
  conversations Conversation[]
  people        Person[]
  tasks         Task[]
  events        Event[]
  auditLogs     AuditLog[]
  connectedAccounts ConnectedAccount[]
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  status       String   @default("active")
  startedAt    DateTime @default(now())
  lastActivity DateTime @default(now())
  endedAt      DateTime?

  user User @relation(fields: [userId], references: [id])
}

model Conversation {
  id        String   @id @default(cuid())
  userId    String
  sessionId String?
  title     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user     User      @relation(fields: [userId], references: [id])
  messages Message[]
}

model Message {
  id             String   @id @default(cuid())
  conversationId String
  role           String   // user, assistant, system, tool
  content        String
  toolCalls      Json?
  toolCallId     String?
  metadata       Json     @default("{}")
  createdAt      DateTime @default(now())

  conversation Conversation @relation(fields: [conversationId], references: [id])
}
```

### 1.2 Authentication

```typescript
// src/lib/auth/config.ts
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      // Add user ID to session
      return session;
    },
  },
});
```

### 1.3 Basic Chat UI

- Message list component
- Input component with send button
- Conversation sidebar
- Real-time updates via SSE/WebSocket

### 1.4 Audit Logging Foundation

```typescript
// src/services/audit/logger.ts
export interface AuditLogEntry {
  userId: string;
  sessionId: string;
  actionType: string;
  actionCategory: string;
  intent?: string;
  reasoning?: string;
  confidence?: number;
  entityType?: string;
  entityId?: string;
  input?: unknown;
  output?: unknown;
  status: "pending" | "completed" | "failed";
  errorMessage?: string;
  durationMs?: number;
}

export async function logAuditEntry(entry: AuditLogEntry): Promise<void>;
export async function getAuditHistory(
  userId: string,
  options?: AuditQueryOptions
): Promise<AuditLog[]>;
```

### Deliverables

- [ ] Prisma schema for core tables
- [ ] Database migrations
- [ ] NextAuth.js configured
- [ ] Google OAuth working
- [ ] Basic chat UI functional
- [ ] Messages stored in DB
- [ ] Audit log table created
- [ ] Basic audit logging working

---

## Phase 2: Context System (Weeks 5-7)

### Goals

- Context entity tables (People, Places, Events, Tasks, Deadlines)
- Relationship system
- Context retrieval API
- Vector embeddings for semantic search

### 2.1 Context Entity Models

Add to Prisma schema:

- `Person` model with all fields
- `Place` model
- `Event` model
- `Task` model
- `Deadline` model
- `EntityRelationship` model

### 2.2 Context Service

```typescript
// src/services/context/index.ts
export interface ContextService {
  // People
  createPerson(data: CreatePersonInput): Promise<Person>;
  updatePerson(id: string, data: UpdatePersonInput): Promise<Person>;
  findPeople(query: PersonQuery): Promise<Person[]>;

  // Relationships
  createRelationship(
    data: CreateRelationshipInput
  ): Promise<EntityRelationship>;
  getRelatedEntities(
    entityType: string,
    entityId: string
  ): Promise<RelatedEntity[]>;

  // Semantic search
  searchContext(
    query: string,
    options?: SearchOptions
  ): Promise<ContextSearchResult[]>;
}
```

### 2.3 Vector Store Setup

```typescript
// src/lib/embeddings/index.ts
export async function generateEmbedding(text: string): Promise<number[]>;
export async function storeEmbedding(
  params: StoreEmbeddingParams
): Promise<void>;
export async function searchSimilar(
  query: string,
  options: SearchOptions
): Promise<SimilarityResult[]>;
```

### Deliverables

- [ ] All context entity tables created
- [ ] Relationship table and queries
- [ ] Context CRUD API routes
- [ ] pgvector extension enabled
- [ ] Embedding generation working
- [ ] Semantic search functional

---

## Phase 3: Gmail Integration (Weeks 8-10)

### Goals

- Google OAuth with Gmail scopes
- Email sync pipeline
- Contact import
- Basic email actions (read, send)

### 3.1 OAuth Enhancement

Add Gmail scopes to Google OAuth config:

```typescript
authorization: {
  params: {
    scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly",
    access_type: "offline",
    prompt: "consent",
  },
}
```

### 3.2 Gmail Client

```typescript
// src/integrations/gmail/client.ts
export class GmailClient {
  constructor(accessToken: string);

  async listMessages(options?: ListOptions): Promise<GmailMessage[]>;
  async getMessage(id: string): Promise<GmailMessage>;
  async sendMessage(params: SendMessageParams): Promise<void>;
  async getContacts(): Promise<GoogleContact[]>;
}
```

### 3.3 Sync Worker

```typescript
// src/integrations/gmail/sync/worker.ts
export class GmailSyncWorker {
  async syncMessages(
    userId: string,
    options?: SyncOptions
  ): Promise<SyncResult>;
  async syncContacts(userId: string): Promise<SyncResult>;
  async processEmail(email: GmailMessage): Promise<ProcessedEmail>;
}
```

### Deliverables

- [ ] Gmail OAuth working
- [ ] Token refresh implemented
- [ ] Email list/read working
- [ ] Contact sync working
- [ ] Email send working (with approval)
- [ ] Sync runs on schedule
- [ ] Emails processed into context

---

## Phase 4: Google Calendar Integration (Weeks 11-13)

### Goals

- Google OAuth with Calendar scopes
- Event sync pipeline
- Calendar read/write actions
- Event creation and updates

### 4.1 OAuth Enhancement

Add Calendar scopes to Google OAuth config:

```typescript
authorization: {
  params: {
    scope: "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/calendar",
    access_type: "offline",
    prompt: "consent",
  },
}
```

### 4.2 Calendar Client

```typescript
// src/integrations/calendar/client.ts
export class CalendarClient {
  constructor(accessToken: string);

  async listCalendars(): Promise<Calendar[]>;
  async listEvents(
    calendarId: string,
    options?: ListOptions
  ): Promise<CalendarEvent[]>;
  async getEvent(calendarId: string, eventId: string): Promise<CalendarEvent>;
  async createEvent(
    calendarId: string,
    event: CreateEventInput
  ): Promise<CalendarEvent>;
  async updateEvent(
    calendarId: string,
    eventId: string,
    event: UpdateEventInput
  ): Promise<CalendarEvent>;
  async deleteEvent(calendarId: string, eventId: string): Promise<void>;
}
```

### 4.3 Sync Worker

```typescript
// src/integrations/calendar/sync/worker.ts
export class CalendarSyncWorker {
  async syncEvents(userId: string, options?: SyncOptions): Promise<SyncResult>;
  async processEvent(event: CalendarEvent): Promise<ProcessedEvent>;
}
```

### Deliverables

- [ ] Calendar OAuth working
- [ ] Token refresh implemented
- [ ] Calendar list working
- [ ] Event list/read working
- [ ] Event create/update working
- [ ] Sync runs on schedule
- [ ] Events processed into context (Event entities, Deadlines)

---

## Phase 5: Agent Engine (Weeks 14-17)

### Goals

- Intent understanding
- Context-aware responses
- Multi-step planning
- Tool execution

### 5.1 Agent Core

```typescript
// src/lib/agent/engine.ts
export class AgentEngine {
  async processMessage(
    message: string,
    context: AgentContext
  ): Promise<AgentResponse>;
  async executePlan(plan: Plan): Promise<PlanResult>;
}
```

### 5.2 Tool System

```typescript
// src/lib/agent/tools/index.ts
export const tools = {
  query_context: queryContextTool,
  create_task: createTaskTool,
  send_email: sendEmailTool,
  send_slack: sendSlackTool,
  search_emails: searchEmailsTool,
};
```

### 5.3 Planning System

```typescript
// src/lib/agent/planner.ts
export class Planner {
  async createPlan(goal: Goal, context: PlanningContext): Promise<Plan>;
  async validatePlan(plan: Plan): Promise<ValidationResult>;
}
```

### Deliverables

- [ ] Intent understanding working
- [ ] Context retrieval for responses
- [ ] Tool execution framework
- [ ] Multi-step planning
- [ ] Action approval workflow
- [ ] Full audit trail for agent actions

---

## Phase 6: Polish & Launch (Weeks 18-20)

### Goals

- UI polish
- Error handling
- Performance optimization
- Documentation
- Initial deployment

### 6.1 UI Improvements

- Loading states
- Error boundaries
- Responsive design
- Accessibility

### 6.2 Reliability

- Error handling
- Retry logic
- Rate limiting
- Health checks

### 6.3 Deployment

- Vercel/Railway setup
- Database hosting
- Redis hosting
- Monitoring (Sentry)

### Deliverables

- [ ] Polished UI
- [ ] Comprehensive error handling
- [ ] Performance optimized
- [ ] Deployed to production
- [ ] Monitoring configured
- [ ] User documentation

---

## Success Criteria

### MVP (End of Phase 6)

- [ ] User can sign up and authenticate
- [ ] User can chat with Theo
- [ ] Gmail connected and syncing
- [ ] Slack connected and syncing
- [ ] Context entities created from integrations
- [ ] Agent can answer questions about context
- [ ] Agent can perform simple actions (draft email, create task)
- [ ] Full audit trail visible to user

---

## Risk Mitigation

| Risk                    | Mitigation                                   |
| ----------------------- | -------------------------------------------- |
| OAuth token expiration  | Implement robust refresh flow                |
| API rate limits         | Queue-based processing with backoff          |
| LLM cost overruns       | Token budgets, caching, local models         |
| Data privacy concerns   | Encryption, minimal retention, user controls |
| Integration API changes | Abstraction layers, version pinning          |

---

## Next Steps

1. **Approve this plan** - Review with stakeholders
2. **Set up development environment** - Phase 0 tasks
3. **Create GitHub issues** - Break phases into trackable work
4. **Begin Phase 1** - Core foundation development
