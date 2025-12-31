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
│   │   ├── calendar/
│   │   ├── slack/
│   │   ├── kroger/
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

# Kroger OAuth
KROGER_CLIENT_ID=""
KROGER_CLIENT_SECRET=""

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

> **Architecture Note**: Design this integration as a self-contained module with clear boundaries (API contracts, message-based communication patterns) to enable extraction to a standalone microservice in the future.

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

> **See**: [PHASE_4_CALENDAR.md](./phase-4/PHASE_4_CALENDAR.md) for full specification

### Goals

- Google OAuth with Calendar scopes
- Calendar and event sync pipeline
- Event read/write actions with approval workflow
- Bi-directional sync (Theo → Google, Google → Theo)
- Integration with existing Event/Deadline context entities

### 4.1 Core Components

- **CalendarClient**: Thin wrapper over Google Calendar API with rate limiting
- **CalendarRepository**: Database operations for calendar data
- **CalendarSyncService**: Full sync, incremental sync, webhook handling
- **CalendarActions**: Agent-facing actions with approval workflow

### 4.2 Sync Strategy

- **Full Sync**: Initial import with resume support
- **Incremental Sync**: Delta updates using sync tokens
- **Push Notifications**: Real-time updates via Google webhooks

### 4.3 Agent Integration

- Calendar query tools (list events, check availability)
- Event management tools (create, update, delete with approval)
- Conflict detection and resolution
- Context injection for schedule awareness

### Deliverables

- [ ] Calendar OAuth with scope upgrade flow
- [ ] CalendarSyncState and Calendar tables
- [ ] Event model extended with calendar fields
- [ ] EventApproval table and workflow
- [ ] Full sync with resume support
- [ ] Incremental sync with sync tokens
- [ ] Webhook handler for push notifications
- [ ] Agent tools for calendar operations
- [ ] Approval UI components
- [ ] Events/Deadlines processed into context

---

## Phase 5: Agent Engine (Weeks 14-17)

> **See**: [PHASE_5_AGENT_ENGINE.md](./phase-5/PHASE_5_AGENT_ENGINE.md) for full specification  
> **See also**: [AGENTIC_FRAMEWORK.md](../AGENTIC_FRAMEWORK.md) for architectural concepts

### Goals

- Intent understanding from natural language
- Context-aware response generation
- Tool execution framework with type-safe definitions
- Multi-step planning for complex requests
- Action approval workflow for user control
- Full audit trail for transparency

### 5.1 Core Components

- **Agent Engine**: Main orchestrator for message processing
- **Intent Analyzer**: Extract intent, entities, and assumptions
- **Context Retrieval Service**: Multi-source context gathering
- **Planner**: Goal decomposition and step sequencing
- **Tool Registry**: Type-safe tool definitions and execution

### 5.2 Tool System

Core tools across categories:

- **Query**: `query_context`, `search_emails`, `list_calendar_events`, `check_availability`
- **Action**: `create_task`, `update_task`, `send_email`, `create_calendar_event`
- **External**: Integration-specific tools with approval requirements

### 5.3 Approval Workflow

- User-configurable autonomy levels per action type
- Approval states: `pending`, `approved`, `rejected`, `expired`, `executed`
- SSE streaming for real-time approval requests

### Deliverables

- [ ] Agent engine with message processing pipeline
- [ ] Intent analyzer with entity extraction
- [ ] Context retrieval from all sources
- [ ] Tool registry with core tools
- [ ] Multi-step plan generation and execution
- [ ] Action approval workflow with UI
- [ ] Full audit trail with assumption tracking
- [ ] SSE streaming for responses
- [ ] Confidence thresholds and safety guardrails

---

## Phase 6: Memory System (Weeks 18-20)

> **See**: [PHASE_6_MEMORY.md](./phase-6/PHASE_6_MEMORY.md) for full specification

### Goals

- Enable Theo to remember user preferences and context
- Explicit, inspectable, overrideable, and safe memory system
- Hard memory (deterministic rules) and soft memory (contextual)
- Memory proposal workflow (agent suggests, user confirms)
- Full auditability of memory usage

### 6.1 Memory Types

- **Hard Memory**: Explicit preferences treated as rules (e.g., "no meetings after 4pm")
- **Soft Memory**: Narrative context for judgment (e.g., "currently planning a wedding")

### 6.2 Core Features

- Memory CRUD with domain categorization
- Semantic search for soft memory retrieval
- Agent memory middleware (mandatory context injection)
- Proposal → Confirmation workflow
- UI for viewing/editing/deleting memories

### 6.3 Safety & Privacy

- Sensitive domains (health, finance) require opt-in
- Proper phrasing enforcement ("You told me..." not "You believe...")
- Full audit trail for memory usage

### Deliverables

- [ ] MemoryItem + MemoryEmbedding database tables
- [ ] MemoryService (CRUD, proposals, confirmations)
- [ ] MemoryRetrievalService (semantic search)
- [ ] Memory API routes
- [ ] Agent memory middleware
- [ ] Memory tools (propose_memory, query_memory)
- [ ] Memory UI panel
- [ ] Sensitive domain opt-in flow
- [ ] Memory usage logging

---

## Phase 7: Continuous Learning (Weeks 21-23)

> **See**: [PHASE_7_CONTINUOUS_LEARNING.md](./phase-7/PHASE_7_CONTINUOUS_LEARNING.md) for full specification

### Goals

- Open Questions system for disambiguation and preference discovery
- Learning from user interactions and corrections
- Memory reinforcement (promotion and decay)
- Intelligent question timing and throttling

### 7.1 Core Concepts

- **Open Questions**: Questions Theo generates when uncertain
- **Learning Detector**: Identifies learning opportunities from interactions
- **Question Backlog**: Prioritized queue of questions to ask
- **Memory Reinforcement**: Strengthen or weaken memories based on usage

### 7.2 Question Types

| Type                | Description                               |
| ------------------- | ----------------------------------------- |
| Disambiguation      | Multiple interpretations possible         |
| Preference Proposal | Theo infers a preference, asks to confirm |
| Reconfirmation      | Outdated memory needs refresh             |
| Missing Context     | Cannot proceed without information        |

### 7.3 UX Patterns

- Micro-confirmations for low-friction learning
- Smart timing (after successful actions)
- Throttling (max questions per session)
- Snooze and dismissal options

### Deliverables

- [ ] OpenQuestion model and Question Backlog
- [ ] Learning Detector service
- [ ] Question Orchestrator (timing, throttling)
- [ ] Answer Interpreter
- [ ] Memory Reinforcement Engine
- [ ] Question UI components
- [ ] Agent integration for question generation
- [ ] Analytics for learning effectiveness

---

## Phase 8: Slack Integration (Weeks 24-26)

> **See**: [PHASE_8_SLACK.md](./phase-8/PHASE_8_SLACK.md) for full specification

### Goals

- Slack OAuth (user token and/or bot token)
- Workspace user import to People context
- Channel and DM message sync (selective, importance-based)
- Message send action with approval workflow
- Real-time event handling (optional Socket Mode)

### 8.1 Core Components

- **SlackClient**: Wrapper over Slack Web API with rate limiting
- **SlackRepository**: Database operations for Slack data
- **SlackSyncService**: User, channel, and message sync
- **SlackActions**: Agent-facing actions with approval workflow

### 8.2 Sync Strategy

- **Full Sync**: Import users, channels, recent messages
- **Selective Message Sync**: Prioritize mentions, replies, reactions
- **Person Linking**: Match Slack users to existing Person entities
- **Socket Mode**: Optional real-time event handling

### 8.3 Agent Integration

- Message search and channel listing tools
- Send message and reply tools (with approval)
- Context enrichment (mentions, active threads, frequent contacts)

### Deliverables

- [ ] Slack OAuth with user token flow
- [ ] SlackWorkspace, SlackChannel, SlackMessage, SlackUser tables
- [ ] SlackMessageApproval table and workflow
- [ ] Full sync with selective message import
- [ ] Person entity linking from Slack users
- [ ] Agent tools for Slack operations
- [ ] Approval UI components
- [ ] Socket Mode for real-time events (optional)

---

## Phase 9: Kroger Integration (Weeks 27-29)

> **See**: [PHASE_9_KROGER.md](./phase-9/PHASE_9_KROGER.md) for full specification  
> **See also**: [Grocery Integration Contract](./ideas/[IDEA]%20-%20grocery-integration-contract.md) for universal constraints

### Core Principle

> **Theo builds the cart. The user places the order.**

Terminal state is always `CART_READY_FOR_REVIEW`. No checkout endpoints are implemented.

### Goals

- Kroger OAuth authentication
- Product search with aggressive local caching (10K API calls/day limit)
- Recipe and meal planning context
- User preferences (brands, dietary restrictions, substitutions)
- Shopping list generation from recipes
- Cart building via Kroger API

### 9.1 Core Components

- **KrogerClient**: API wrapper with rate limiting
- **KrogerProductCache**: DB-first product lookups with 7-30 day TTL
- **RecipeService**: Recipe and ingredient management
- **ProductResolutionService**: Ingredient-to-product matching
- **ShoppingListService**: List generation from recipes
- **CartBuilderService**: Build Kroger cart with user intervention points

### 9.2 Key Constraints

- **Rate Limit**: 10,000 API calls/day — cache aggressively
- **No Checkout**: Never place orders, select time slots, or handle payment
- **Store-Scoped**: Catalog and pricing vary by store location
- **User Control**: Pause for confirmation on ambiguous matches

### 9.3 Agent Integration

- Product search and resolution tools
- Recipe creation and shopping list generation
- Cart building with handoff link
- Preference-aware product matching

### Deliverables

- [ ] Kroger OAuth with store selection
- [ ] Product cache with long TTL (7-30 days)
- [ ] DB-first product lookups
- [ ] Recipe CRUD and ingredient normalization
- [ ] Product preferences (prefer/avoid/substitute)
- [ ] Shopping list generation from recipes
- [ ] Cart building with ambiguity handling
- [ ] Strict no-checkout guardrails
- [ ] Agent tools for grocery operations

---

## Phase 10: Walmart Integration (Weeks 30-32)

> **See**: [PHASE_10_WALMART.md](./phase-10/PHASE_10_WALMART.md) for full specification  
> **See also**: [Grocery Integration Contract](./ideas/[IDEA]%20-%20grocery-integration-contract.md) for universal constraints

### Core Principle

> **Theo builds the cart. The user places the order.**

Unlike Kroger (API-based), Walmart requires **browser automation** because they do not expose a public API for cart operations.

### Goals

- Browser automation via Playwright (headful)
- URL-first product resolution
- Cookie/session-based authentication (no credentials stored)
- Store/ZIP context management
- Strict checkout prevention guardrails
- CAPTCHA and intervention handling

### 10.1 Core Components

- **WalmartSessionManager**: Login flow, cookie management
- **WalmartCartRunner**: Browser automation for cart ops
- **WalmartSafetyGuard**: Checkout prevention enforcement
- **WalmartProductResolver**: URL lookup + on-site search

### 10.2 Safety Guardrails

- **Allowlist**: Only permitted actions (add to cart, quantity, search)
- **Blocklist**: Halt on checkout-related text
- **URL Guard**: Stop if navigation enters `/checkout` paths

### 10.3 Key Differences from Kroger

| Aspect      | Kroger (Phase 9) | Walmart (Phase 10)      |
| ----------- | ---------------- | ----------------------- |
| Type        | API-based        | Browser automation      |
| Auth        | OAuth            | Cookie/session          |
| Reliability | High             | Best-effort             |
| Maintenance | Stable           | Selector updates needed |

### Deliverables

- [ ] Headful Playwright session management
- [ ] Manual login flow (no credential storage)
- [ ] Cookie encryption and session persistence
- [ ] Safety guards (allowlist, blocklist, URL path)
- [ ] WalmartSession, SavedProductLink, WalmartCartRun tables
- [ ] Cart runner with URL-first navigation
- [ ] On-site search fallback
- [ ] CAPTCHA detection and user intervention
- [ ] Observability (logs, screenshots, DOM hashing)
- [ ] Agent tools for Walmart operations

---

## Phase 11: SMS Integration (Weeks 33-35)

> **See**: [PHASE_11_SMS.md](./phase-11/PHASE_11_SMS.md) for full specification

### Core Principle

> **Theo should feel like texting a real human assistant.**

Enable users to communicate with Theo via SMS, and allow Theo to proactively reach out when important events happen.

### Goals

- Receive and respond to inbound text messages
- Send proactive notifications for important events
- Maintain conversation context across SMS sessions
- Respect user preferences (quiet hours, throttling)
- Handle opt-in, opt-out, and phone verification

### 11.1 Core Components

- **SmsGatewayService**: Twilio integration, webhook handling
- **SmsInboundProcessor**: Parse messages, route to agent
- **SmsOutboundProcessor**: Queue, format, and send messages
- **SmsNotificationEngine**: Triggers, quiet hours, throttling

### 11.2 Key Features

| Feature                 | Description                                   |
| ----------------------- | --------------------------------------------- |
| Inbound SMS             | User texts Theo, gets response                |
| Proactive notifications | Calendar reminders, urgent emails, cart ready |
| Confirmation workflow   | YES/NO replies for approvals                  |
| Quiet hours             | Respect user's do-not-disturb times           |
| System commands         | STOP, HELP, YES, NO handling                  |

### 11.3 Notification Categories

- Calendar reminders
- Task due dates
- Urgent emails from VIPs
- Shopping cart ready
- Pending approvals
- Daily briefings (optional)

### 11.4 Compliance

- TCPA compliance (US)
- Opt-in consent required
- STOP command support
- Message identification

### Deliverables

- [ ] Phone number registration and verification
- [ ] Twilio webhook integration (inbound/outbound)
- [ ] SmsPhoneNumber, SmsConversation, SmsMessage tables
- [ ] SmsNotificationPreference, SmsNotificationTrigger tables
- [ ] System command handling (STOP, HELP, YES, NO)
- [ ] Agent integration with SMS-optimized responses
- [ ] Notification engine with triggers and quiet hours
- [ ] Confirmation workflow for approvals via SMS
- [ ] Throttling and cost management
- [ ] Preferences UI for phone and notifications

---

## Phase 12: Polish & Launch (Weeks 36-38)

> **See**: [PHASE_12_POLISH_LAUNCH.md](./phase-12/PHASE_12_POLISH_LAUNCH.md) for full specification

### Goals

- UI polish and accessibility (WCAG 2.1 AA)
- Comprehensive error handling and recovery
- Performance optimization (Core Web Vitals)
- Production deployment infrastructure
- Monitoring and observability

### 12.1 UI Polish

- Loading states for all async operations
- Empty states with helpful guidance
- Responsive design (mobile, tablet, desktop)
- Accessibility audit and fixes

### 12.2 Reliability & Error Handling

- Error boundaries at app/page/component levels
- Retry logic with exponential backoff
- Circuit breakers for external services
- Graceful degradation when services unavailable
- Health check endpoints

### 12.3 Performance

- Core Web Vitals targets (LCP <2.5s, CLS <0.1)
- Code splitting and lazy loading
- Caching strategy (API, assets, embeddings)
- Database query optimization

### 12.4 Deployment & Monitoring

- Vercel production deployment
- Database (Neon/Supabase) and Redis (Upstash) hosting
- Sentry error tracking
- Uptime monitoring and alerting
- Security headers and rate limiting

### Deliverables

- [ ] Loading states, empty states, responsive design
- [ ] WCAG 2.1 AA accessibility compliance
- [ ] Error boundaries and retry logic
- [ ] Circuit breakers and graceful degradation
- [ ] Health check endpoints
- [ ] Core Web Vitals targets met
- [ ] Production deployment with monitoring
- [ ] Security hardening (headers, rate limits)
- [ ] User documentation (getting started, integrations)

---

## Success Criteria

### Core AI MVP (End of Phase 7)

- [ ] User can sign up and authenticate
- [ ] User can chat with Theo
- [ ] Gmail connected and syncing
- [ ] Google Calendar connected and syncing
- [ ] Agent engine with intent understanding and tool execution
- [ ] Memory system with proposal workflow
- [ ] Continuous learning with Open Questions
- [ ] Full audit trail visible to user
- [ ] > 80% of relevant actions cite memory items
- [ ] <10% of memories require correction on confirm

### Full Integration MVP (End of Phase 11)

- [ ] Slack connected and syncing
- [ ] Kroger connected for shopping with product caching
- [ ] Walmart connected via browser automation
- [ ] SMS integration for text messaging
- [ ] Recipe and product preference context working
- [ ] Context entities created from all integrations
- [ ] Agent can perform actions across all channels
- [ ] Memory and learning inform all agent decisions

### Production Ready (End of Phase 12)

- [ ] UI polished and accessible (WCAG 2.1 AA)
- [ ] All error handling comprehensive
- [ ] Performance targets met
- [ ] Deployed to production with monitoring
- [ ] User documentation complete

---

## Risk Mitigation

| Risk                    | Mitigation                                   |
| ----------------------- | -------------------------------------------- |
| OAuth token expiration  | Implement robust refresh flow                |
| API rate limits         | Queue-based processing with backoff          |
| LLM cost overruns       | Token budgets, caching, local models         |
| Data privacy concerns   | Encryption, minimal retention, user controls |
| Integration API changes | Abstraction layers, version pinning          |
| Memory hallucination    | Explicit confirmation, no auto-save          |
| Sensitive data leakage  | Domain opt-in, careful phrasing rules        |
| Memory staleness        | Recency weighting, expiration policies       |
| User trust erosion      | Full transparency, easy deletion, citations  |

---

## Next Steps

1. **Approve this plan** - Review with stakeholders
2. **Set up development environment** - Phase 0 tasks
3. **Create GitHub issues** - Break phases into trackable work
4. **Begin Phase 1** - Core foundation development
