# Theo Architecture Overview

> **Status**: Draft v0.1  
> **Last Updated**: December 2024

## Vision

Theo is a **context-aware, agentic personal assistant** that learns and grows with you. Unlike traditional assistants that respond to commands, Theo understands your world—your people, places, events, tasks, and deadlines—and proactively helps you take the next right step.

---

## Core Architectural Principles

### 1. Context is King
Every interaction builds Theo's understanding. Context isn't just stored—it's the foundation for intelligent, personalized assistance.

### 2. Agentic by Design
Theo isn't just reactive. It observes, reasons, plans, and acts autonomously within defined boundaries.

### 3. Auditable Everything
Every assumption, decision, and action is logged with full traceability. You can always understand *why* Theo did something.

### 4. Expansion-First Architecture
Built for growth: new integrations, skills, and context sources plug in cleanly without disrupting the core.

### 5. Privacy by Default
Data minimization, least privilege, and user control at every layer.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              THEO PLATFORM                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         FRONTEND LAYER                               │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │    │
│  │  │   Web App    │  │  Mobile PWA  │  │   CLI Tool   │              │    │
│  │  │  (Next.js)   │  │   (Future)   │  │   (Future)   │              │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                          API GATEWAY                                 │    │
│  │         (Next.js API Routes → Future: Dedicated Gateway)            │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│           ┌────────────────────────┼────────────────────────┐               │
│           ▼                        ▼                        ▼               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │  CORE SERVICES  │    │  AGENT ENGINE   │    │  INTEGRATIONS   │         │
│  │                 │    │                 │    │                 │         │
│  │ • Chat Handler  │    │ • Reasoning     │    │ • Gmail         │         │
│  │ • Context Mgr   │    │ • Planning      │    │ • Slack         │         │
│  │ • Action Router │    │ • Execution     │    │ • Calendar      │         │
│  │ • Audit Logger  │    │ • Learning      │    │ • (Expandable)  │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│           │                        │                        │               │
│           └────────────────────────┼────────────────────────┘               │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         DATA LAYER                                   │    │
│  │                                                                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │    │
│  │  │  People  │  │  Places  │  │  Events  │  │  Tasks   │           │    │
│  │  │    DB    │  │    DB    │  │    DB    │  │    DB    │           │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │    │
│  │                                                                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │    │
│  │  │ Deadlines│  │  Audit   │  │ Sessions │  │  Skills  │           │    │
│  │  │    DB    │  │  Trail   │  │  /Chat   │  │ Registry │           │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘           │    │
│  │                                                                      │    │
│  │                    ┌──────────────────┐                             │    │
│  │                    │   Vector Store   │                             │    │
│  │                    │  (Embeddings)    │                             │    │
│  │                    └──────────────────┘                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      BACKGROUND SERVICES                             │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │    │
│  │  │   Sync     │  │  Indexer   │  │  Scheduler │  │   Event    │    │    │
│  │  │  Workers   │  │  Service   │  │  (Cron)    │  │    Bus     │    │    │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Deep Dive

### Frontend Layer
- **Next.js Web App**: Primary interface for chat, dashboards, and settings
- **Responsive Design**: Works on desktop and mobile browsers
- **Real-time Updates**: WebSocket/SSE for live agent status and notifications

### API Gateway
- **Initial**: Next.js API Routes (simple, monolithic)
- **Future**: Dedicated gateway for rate limiting, auth, and routing to microservices

### Core Services

| Service | Responsibility |
|---------|---------------|
| **Chat Handler** | Processes user messages, orchestrates responses |
| **Context Manager** | CRUD operations across all context DBs, relationship mapping |
| **Action Router** | Routes intents to appropriate skills or integrations |
| **Audit Logger** | Records every action, assumption, and decision |

### Agent Engine
The brain of Theo. See [AGENTIC_FRAMEWORK.md](./AGENTIC_FRAMEWORK.md) for details.

- **Reasoning**: Understands intent, evaluates context, forms hypotheses
- **Planning**: Breaks down goals into actionable steps
- **Execution**: Runs plans using skills and integrations
- **Learning**: Updates context based on outcomes

### Integrations Layer
Modular connectors to external services. See [INTEGRATIONS.md](./INTEGRATIONS.md).

- **Gmail**: Email read/send, label management, search
- **Slack**: Message read/send, channel awareness, thread context
- **Calendar**: Event management, availability, reminders
- **Expandable**: Clean interface for adding new integrations

### Data Layer
PostgreSQL-based with logical separation. See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md).

- **Context DBs**: People, Places, Events, Tasks, Deadlines
- **Audit Trail**: Immutable log of all agent actions
- **Vector Store**: Embeddings for semantic search and retrieval
- **Sessions**: Conversation history and state

### Background Services
- **Sync Workers**: Pull data from integrations on schedule
- **Indexer**: Generates embeddings, updates search indices
- **Scheduler**: Cron-based triggers for proactive actions
- **Event Bus**: Internal pub/sub for decoupled communication

---

## Technology Choices

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | Next.js 14+ (App Router) | SSR, React Server Components, great DX |
| API | Next.js API Routes → tRPC | Type safety, incremental complexity |
| Database | PostgreSQL | Robust, relational, excellent JSON support |
| Cache | Redis | Sessions, rate limiting, job queues |
| Vector DB | pgvector (extension) | Keep stack simple, PostgreSQL native |
| Queue | BullMQ (Redis-based) | Background jobs, retries, scheduling |
| Auth | NextAuth.js | OAuth flows for integrations |
| AI/LLM | OpenAI / Anthropic | Primary reasoning engine |
| Embeddings | OpenAI / Local model | Semantic search and retrieval |

---

## Data Flow Example: User Asks About a Person

```
User: "What's my relationship with Sarah Chen?"

1. Chat Handler receives message
2. Context Manager queries People DB for "Sarah Chen"
3. Agent Engine:
   - Retrieves person record, relationships, interaction history
   - Queries Events DB for shared events
   - Queries Audit Trail for past conversations about Sarah
   - Synthesizes response with reasoning
4. Audit Logger records: query intent, data accessed, response generated
5. Response returned to user with confidence indicators
```

---

## Security Model

### Authentication
- User authentication via NextAuth.js
- OAuth 2.0 for integration connections (Gmail, Slack, etc.)
- Token encryption at rest

### Authorization
- Least privilege: Integrations request minimal scopes
- User approval for sensitive actions
- Rate limiting on all endpoints

### Data Protection
- Encryption at rest (database-level)
- Encryption in transit (TLS)
- User-owned encryption keys (future)

### Audit Trail
- Immutable append-only log
- Every action tied to: user, timestamp, context, rationale
- Exportable for user transparency

---

## Scaling Considerations

### Phase 1: Monolith (MVP)
- All services in Next.js app
- Single PostgreSQL database
- Good for: 1-1000 users

### Phase 2: Service Extraction
- Extract heavy integrations to microservices
- Add Redis for caching and queues
- Good for: 1000-10000 users

### Phase 3: Full Platform
- Dedicated API gateway
- Independent scaling of services
- Multi-region deployment
- Good for: 10000+ users

---

## Next Steps

1. Review [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for data model details
2. Review [AGENTIC_FRAMEWORK.md](./AGENTIC_FRAMEWORK.md) for agent behavior design
3. Review [INTEGRATIONS.md](./INTEGRATIONS.md) for Gmail/Slack strategy
4. Review [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) for AWS deployment and local Docker setup
5. Review [SCAFFOLDING_PLAN.md](./SCAFFOLDING_PLAN.md) for implementation roadmap
6. Review [BUILD_LOG.md](./BUILD_LOG.md) for implementation history and decisions

