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

> **Architecture Note**: Design this integration as a self-contained module with clear boundaries (API contracts, message-based communication patterns) to enable extraction to a standalone microservice in the future.

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
  search_emails: searchEmailsTool,
  create_calendar_event: createCalendarEventTool,
  list_calendar_events: listCalendarEventsTool,
  send_slack: sendSlackTool,
  search_products: searchProductsTool,
  add_to_cart: addToCartTool,
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

## Phase 6: Slack Integration (Weeks 18-20)

> **Architecture Note**: Design this integration as a self-contained module with clear boundaries (API contracts, message-based communication patterns) to enable extraction to a standalone microservice in the future.

### Goals

- Slack OAuth
- Workspace user import
- Channel message sync
- Message send action

### 6.1 Slack OAuth

```typescript
// src/integrations/slack/auth.ts
export async function getSlackAuthUrl(userId: string): Promise<string>;
export async function handleSlackCallback(
  code: string,
  userId: string
): Promise<void>;
```

### 6.2 Slack Client

```typescript
// src/integrations/slack/client.ts
export class SlackClient {
  constructor(accessToken: string);

  async listUsers(): Promise<SlackUser[]>;
  async listChannels(): Promise<SlackChannel[]>;
  async getChannelHistory(
    channelId: string,
    options?: HistoryOptions
  ): Promise<SlackMessage[]>;
  async sendMessage(params: SendMessageParams): Promise<void>;
}
```

### 6.3 Real-time Events (Optional)

Socket Mode for real-time message events.

### Deliverables

- [ ] Slack OAuth working
- [ ] User import working
- [ ] Channel list/read working
- [ ] Message history sync
- [ ] Message send working
- [ ] People created from Slack users

---

## Phase 7: Kroger Integration (Weeks 21-23)

> **Architecture Note**: Design this integration as a self-contained module with clear boundaries (API contracts, message-based communication patterns) to enable extraction to a standalone microservice in the future.

> **Rate Limit Note**: Kroger API has a limit of 10,000 calls/day. Implement aggressive caching: store product information in the database with a long TTL (7-30 days for stable product data). Always consult the local DB cache before making API calls.

### Goals

- Kroger OAuth authentication
- Product search and browsing with local caching
- Shopping list management with DB-first lookups
- Recipe and preference context for smart ingredient selection
- Order history access

### 7.1 Kroger OAuth

```typescript
// src/integrations/kroger/auth.ts
export async function getKrogerAuthUrl(userId: string): Promise<string>;
export async function handleKrogerCallback(
  code: string,
  userId: string
): Promise<void>;
export async function refreshKrogerToken(userId: string): Promise<void>;
```

### 7.2 Product Cache

```typescript
// src/integrations/kroger/cache.ts
export class KrogerProductCache {
  // TTL: 7-30 days for product data (rarely changes)
  private readonly PRODUCT_TTL_DAYS = 14;

  async getCachedProduct(productId: string): Promise<KrogerProduct | null>;
  async getCachedProducts(query: string): Promise<KrogerProduct[] | null>;
  async cacheProduct(product: KrogerProduct): Promise<void>;
  async cacheSearchResults(
    query: string,
    products: KrogerProduct[]
  ): Promise<void>;
  async invalidateProduct(productId: string): Promise<void>;
}
```

### 7.3 Kroger Client

```typescript
// src/integrations/kroger/client.ts
export class KrogerClient {
  constructor(accessToken: string, cache: KrogerProductCache);

  // DB-first: checks cache before API call
  async searchProducts(
    query: string,
    options?: SearchOptions
  ): Promise<KrogerProduct[]>;
  async getProduct(productId: string): Promise<KrogerProduct>;
  async getLocations(
    zipCode: string,
    options?: LocationOptions
  ): Promise<KrogerLocation[]>;
  async getCart(): Promise<CartItem[]>;
  async addToCart(productId: string, quantity: number): Promise<void>;
  async removeFromCart(productId: string): Promise<void>;
}
```

### 7.4 Recipe & Preference Context

```typescript
// src/integrations/kroger/context.ts

// User preferences for product selection
export interface ProductPreferences {
  preferred: ProductPreference[]; // Brands/products user prefers
  avoided: ProductPreference[]; // Allergies, dislikes, dietary restrictions
  substitutions: SubstitutionRule[]; // e.g., "always use oat milk instead of dairy"
}

export interface ProductPreference {
  type: "brand" | "product" | "category" | "ingredient";
  value: string;
  reason?: string; // "allergy", "taste", "dietary", "budget"
}

export interface SubstitutionRule {
  original: string;
  substitute: string;
  context?: string; // When to apply: "always", "if_available", "for_recipe:X"
}

// Recipe context for smart ingredient lists
export interface Recipe {
  id: string;
  userId: string;
  name: string;
  source?: string; // URL, cookbook, custom
  ingredients: RecipeIngredient[];
  servings: number;
  notes?: string;
  preferredProducts?: string[]; // Specific product IDs user prefers for this recipe
}

export interface RecipeIngredient {
  name: string;
  quantity: number;
  unit: string;
  notes?: string; // "optional", "to taste", etc.
  productId?: string; // Cached Kroger product match
}
```

### 7.5 Shopping List Integration

```typescript
// src/integrations/kroger/shopping.ts
export class KrogerShoppingService {
  constructor(
    private cache: KrogerProductCache,
    private preferences: ProductPreferences
  );

  async syncShoppingList(userId: string): Promise<SyncResult>;

  async createShoppingListFromTasks(
    userId: string,
    taskIds: string[]
  ): Promise<ShoppingList>;

  // DB-first: consults cache and preferences before API
  async findProductsForIngredients(
    ingredients: string[],
    options?: { applyPreferences?: boolean; recipeId?: string }
  ): Promise<ProductMatch[]>;

  // Generate ingredient list from recipe with preference-aware product matching
  async createShoppingListFromRecipe(
    userId: string,
    recipeId: string,
    servingMultiplier?: number
  ): Promise<ShoppingList>;

  // Apply user preferences to filter/sort product results
  async applyPreferences(
    products: KrogerProduct[],
    userId: string
  ): Promise<RankedProduct[]>;
}
```

### Deliverables

- [ ] Kroger OAuth working
- [ ] Product cache with long TTL implemented
- [ ] DB-first product lookups working
- [ ] Product search working (cache → API fallback)
- [ ] Location finder working
- [ ] Cart management working
- [ ] Recipe context model created
- [ ] Product preferences (prefer/avoid) working
- [ ] Substitution rules implemented
- [ ] Shopping lists synced to context
- [ ] Agent can search products with preference awareness
- [ ] Agent can generate shopping lists from recipes

---

## Phase 8: Polish & Launch (Weeks 24-26)

### Goals

- UI polish
- Error handling
- Performance optimization
- Documentation
- Initial deployment

### 8.1 UI Improvements

- Loading states
- Error boundaries
- Responsive design
- Accessibility

### 8.2 Reliability

- Error handling
- Retry logic
- Rate limiting
- Health checks

### 8.3 Deployment

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

## Phase 9: Memory System (Weeks 27-30)

> **See**: [PHASE_9_MEMORY.md](./PHASE_9_MEMORY.md) for full specification

### Goals

- Enable Theo to remember user preferences and context
- Explicit, inspectable, overrideable, and safe memory system
- Hard memory (deterministic rules) and soft memory (contextual)
- Memory proposal workflow (agent suggests, user confirms)
- Full auditability of memory usage

### 9.1 Memory Types

- **Hard Memory**: Explicit preferences treated as rules (e.g., "no meetings after 4pm")
- **Soft Memory**: Narrative context for judgment (e.g., "currently planning a wedding")

### 9.2 Core Features

- Memory CRUD with domain categorization
- Semantic search for soft memory retrieval
- Agent memory middleware (mandatory context injection)
- Proposal → Confirmation workflow
- UI for viewing/editing/deleting memories

### 9.3 Safety & Privacy

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

## Success Criteria

### MVP (End of Phase 8)

- [ ] User can sign up and authenticate
- [ ] User can chat with Theo
- [ ] Gmail connected and syncing
- [ ] Google Calendar connected and syncing
- [ ] Slack connected and syncing
- [ ] Kroger connected for shopping with product caching
- [ ] Recipe and product preference context working
- [ ] Context entities created from integrations
- [ ] Agent can answer questions about context
- [ ] Agent can perform simple actions (draft email, create task, manage shopping)
- [ ] Agent can generate preference-aware shopping lists from recipes
- [ ] Full audit trail visible to user

### Enhanced MVP (End of Phase 9)

- [ ] User can view all memories Theo has stored
- [ ] User can edit or delete any memory
- [ ] Agent proposes memories, user confirms before saving
- [ ] Hard preferences are respected in all actions
- [ ] Soft context improves agent judgment
- [ ] Memory citations appear in relevant responses
- [ ] Sensitive domains require explicit opt-in
- [ ] Memory usage is fully audited
- [ ] > 80% of relevant actions cite memory items
- [ ] <10% of memories require correction on confirm

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
