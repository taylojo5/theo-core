# Phase 6: Memory System

> **Status**: Draft v0.1  
> **Duration**: Weeks 18-20  
> **Dependencies**: Phase 5 (Agent Engine), Phase 2 (Context System)

---

## Overview

Enable Theo to remember user preferences and context in a way that is **explicit, inspectable, overrideable, and safe** — without relying on implicit model memory.

### Core Principles

| Principle | Description |
| --- | --- |
| **Explicit** | Memory is stored and retrieved, never hidden in model state |
| **Inspectable** | Users can view everything Theo remembers |
| **Overrideable** | Users can edit or delete any memory instantly |
| **Safe** | Sensitive domains require explicit opt-in; phrasing respects user autonomy |
| **Cited** | All actions cite the memory items that influenced them |

---

## Architecture Overview

```
User Action / Message
        ↓
   Intent Detection
        ↓
   Memory Retrieval
   ├── Hard Memory (structured, deterministic)
   └── Soft Memory (contextual, semantic search)
        ↓
   Prompt Assembly (memory injected into context)
        ↓
   LLM Decision / Output
        ↓
   Execution (optional)
        ↓
   Memory Proposal (optional, requires confirmation)
```

---

## Memory Types

### Hard Memory (Deterministic)

Explicit preferences or constraints treated as **rules**.

| Characteristic | Description |
| --- | --- |
| Structure | JSON key-value pairs or structured objects |
| Authority | Always overrides soft memory |
| Confirmation | Requires user confirmation or explicit statement |
| Confidence | High (0.8+), user-confirmed |

**Examples:**

```json
{ "domain": "schedule", "key": "no_meetings_after", "content": "16:00" }
{ "domain": "food", "key": "exclude_ingredients", "content": ["shellfish", "peanuts"] }
{ "domain": "shopping", "key": "preferred_store", "content": "Kroger" }
{ "domain": "communication", "key": "email_signature", "content": "Best, Jonathan" }
```

### Soft Memory (Contextual)

Narrative context that improves judgment but is **never treated as rules**.

| Characteristic | Description |
| --- | --- |
| Structure | Short text chunks (300-500 tokens) |
| Authority | Informs decisions but doesn't mandate |
| Storage | Vector-embedded for semantic retrieval |
| Decay | Recency-weighted, can expire |

**Examples:**

- "User is planning a wedding this month"
- "Prefers low-effort dinners during busy work weeks"
- "Currently onboarding a new team member named Alex"
- "Training for a marathon, watching protein intake"

---

## Data Model (Conceptual)

### MemoryItem

| Field | Type | Description |
| --- | --- | --- |
| id | string | Unique identifier |
| userId | string | Owner |
| type | enum | `HARD` or `SOFT` |
| domain | string | Category (schedule, food, shopping, etc.) |
| key | string | Structured key for lookup |
| content | json | Flexible: string, array, or object |
| contentText | string | Plain text for embedding/search |
| confidence | float | 0.0-1.0 |
| source | enum | `USER_EXPLICIT`, `USER_INFERRED`, `AGENT_PROPOSED`, `SYSTEM_DERIVED` |
| evidence | json | Array of evidence supporting this memory |
| status | enum | `PROPOSED`, `ACTIVE`, `INACTIVE`, `EXPIRED`, `SUPERSEDED` |
| requiresOptIn | boolean | For sensitive domains |
| expiresAt | datetime? | Optional expiration |
| createdAt | datetime | |
| confirmedAt | datetime? | When user confirmed |
| lastConfirmedAt | datetime? | Most recent confirmation |

### MemoryEmbedding

| Field | Type | Description |
| --- | --- | --- |
| id | string | Unique identifier |
| memoryItemId | string | FK to MemoryItem |
| embedding | vector(1536) | Vector embedding for semantic search |
| contentHash | string | Hash for change detection |

### MemoryUsageLog

| Field | Type | Description |
| --- | --- | --- |
| id | string | Unique identifier |
| memoryItemId | string | FK to MemoryItem |
| userId | string | Owner |
| conversationId | string? | Context |
| usageType | enum | `RETRIEVED`, `APPLIED`, `CITED`, `CONFLICTED`, `OVERRIDDEN` |
| influence | string | How memory influenced the action |
| createdAt | datetime | |

### MemoryDomain

| Field | Type | Description |
| --- | --- | --- |
| id | string | Unique identifier |
| name | string | Unique key (schedule, food, etc.) |
| displayName | string | Human-readable name |
| isSensitive | boolean | Requires careful handling |
| requiresOptIn | boolean | User must explicitly enable |
| defaultExpiration | int? | Days until soft memories expire |

### Predefined Domains

| Domain | Sensitive | Opt-in | Expiration |
| --- | --- | --- | --- |
| schedule | No | No | Never |
| food | No | No | Never |
| shopping | No | No | Never |
| communication | No | No | Never |
| travel | No | No | Never |
| health | Yes | Yes | Never |
| finance | Yes | Yes | Never |
| work | No | No | 90 days |
| personal | No | No | 60 days |
| relationships | No | No | Never |

---

## Core Services

### MemoryService

CRUD operations and memory lifecycle management.

| Method | Description |
| --- | --- |
| `create(userId, input)` | Create a new confirmed memory |
| `propose(userId, input)` | Create a proposed memory (requires confirmation) |
| `confirm(userId, input)` | Confirm or reject a proposed memory |
| `update(userId, id, input)` | Update an existing memory |
| `delete(userId, id)` | Soft-delete a memory |
| `get(userId, id)` | Retrieve single memory |
| `list(userId, options)` | List memories with filtering |
| `getPendingProposals(userId)` | Get unconfirmed proposals |
| `logUsage(params)` | Log memory usage for audit |
| `getStats(userId)` | Get memory analytics |

### MemoryRetrievalService

Retrieves relevant memories for prompt context.

| Method | Description |
| --- | --- |
| `retrieve(params)` | Get relevant hard + soft memories |
| `detectDomains(text)` | Identify relevant domains from message |

**Retrieval Logic:**

1. **Hard memories**: Fetch all active memories for detected domains
2. **Soft memories**: Semantic search using query embedding, ranked by similarity
3. Filter by confidence threshold and expiration
4. Return combined context

### MemoryFormatter

Formats memories for LLM prompt injection.

**Output Format:**

```
### User Memory Context

**Hard Preferences** (must be respected):
- [schedule] no_meetings_after: 16:00 (confidence: high, confirmed: 2025-01-10)
- [food] exclude_ingredients: shellfish, peanuts (confidence: high)

**Context** (for judgment, not rules):
- Planning a wedding this month (relevance: 92%)
- Prefers low-effort dinners during busy work weeks (relevance: 78%)

**Rules**:
- Hard preferences must be respected unless user explicitly overrides
- If there is conflict or uncertainty, ask before acting
- Always cite memory items when relevant: "You previously told me..."
- Never phrase as: "You believe..." or "You think..."
```

---

## API Surface

### Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/memory` | List memories with optional filters |
| POST | `/api/memory` | Create a new memory |
| GET | `/api/memory/:id` | Get single memory |
| PATCH | `/api/memory/:id` | Update memory |
| DELETE | `/api/memory/:id` | Delete memory |
| POST | `/api/memory/propose` | Agent proposes a memory |
| POST | `/api/memory/:id/confirm` | Confirm or reject proposal |
| POST | `/api/memory/retrieve` | Retrieve memories for context |

### Query Parameters (List)

| Param | Type | Description |
| --- | --- | --- |
| type | enum | Filter by HARD or SOFT |
| domain | string | Filter by domain |
| status | enum | Filter by status |
| search | string | Text search |
| limit | number | Max results (default: 50) |
| cursor | string | Pagination cursor |

---

## Agent Integration

### Memory Middleware

Every agent request passes through memory middleware:

1. Detect relevant domains from user message
2. Retrieve hard + soft memories
3. Format for prompt injection
4. Inject into system prompt
5. Track which memories were used

### Agent Tools

| Tool | Description |
| --- | --- |
| `propose_memory` | Propose a new preference or context to remember |
| `query_memory` | Search user's saved memories |

**Proposal Flow:**

1. Agent notices preference or pattern
2. Agent calls `propose_memory` with evidence
3. Memory created with status `PROPOSED`
4. User sees confirmation prompt in UI
5. User confirms, edits, or rejects
6. Memory activated or discarded

---

## UI Components

### MemoryPanel

Main view for managing memories.

- Tabbed view: Preferences (hard) | Context (soft)
- Shows pending proposals at top
- Count badges for each category
- Empty states with helpful prompts

### MemoryItem

Individual memory display.

- Domain badge
- Key and content display
- Last confirmed date
- Delete action

### MemoryProposalCard

Confirmation UI for proposed memories.

- Shows what Theo wants to remember
- Displays reasoning/evidence
- Actions: Confirm, Edit, Reject
- Inline editing support

---

## Safety & Privacy

### Sensitive Domains

| Domain | Sensitivity | Opt-in Required | Reason |
| --- | --- | --- | --- |
| health | High | Yes | Medical information, fitness data |
| finance | High | Yes | Budget, spending patterns |
| relationships | Medium | No | But careful phrasing required |
| work | Low | No | Professional context |

### Phrasing Rules

The agent must follow these phrasing rules when referencing memories:

| ✅ Allowed | ❌ Forbidden |
| --- | --- |
| "You previously told me..." | "You believe..." |
| "Based on your preference for..." | "You think that..." |
| "You mentioned that..." | "You are the type of person who..." |
| "I remember you said..." | "Your personality suggests..." |

### Data Retention

- **Hard memories**: No automatic expiration unless user-set
- **Soft memories**: Configurable expiration per domain
- **Usage logs**: 90 days retention for analytics
- **Deleted memories**: Immediately removed

---

## Deliverables

### Phase 9 Checklist

- [ ] **Database**
  - [ ] MemoryItem table with indices
  - [ ] MemoryEmbedding table with vector index
  - [ ] MemoryUsageLog table
  - [ ] MemoryDomain table with seed data
  - [ ] Migrations applied

- [ ] **Service Layer**
  - [ ] MemoryService (CRUD, proposals, confirmations)
  - [ ] MemoryRetrievalService (semantic search, domain detection)
  - [ ] MemoryFormatter (prompt injection)
  - [ ] Unit tests for all services

- [ ] **API Routes**
  - [ ] GET/POST /api/memory
  - [ ] GET/PATCH/DELETE /api/memory/:id
  - [ ] POST /api/memory/propose
  - [ ] POST /api/memory/:id/confirm
  - [ ] POST /api/memory/retrieve

- [ ] **Agent Integration**
  - [ ] Memory middleware for agent context
  - [ ] propose_memory tool
  - [ ] query_memory tool
  - [ ] Memory citation in responses

- [ ] **UI Components**
  - [ ] MemoryPanel (main view)
  - [ ] MemoryItem (display/delete)
  - [ ] MemoryProposalCard (confirm/reject/edit)
  - [ ] Integration with chat interface

- [ ] **Safety & Privacy**
  - [ ] Sensitive domain opt-in flow
  - [ ] Proper phrasing enforcement
  - [ ] Audit logging for memory usage

---

## Success Metrics

| Metric | Target | Description |
| --- | --- | --- |
| Memory citation rate | >80% | % of relevant actions that cite memory |
| Proposal acceptance | >70% | % of proposed memories confirmed |
| Memory correction rate | <10% | % of memories edited on confirm |
| "Why did you do this?" queries | <5% | Reduction after memory explanations |
| User satisfaction | >4.5/5 | Post-interaction survey |

---

## Future Enhancements (V2+)

- **Memory clusters**: Group related memories automatically
- **Memory conflicts**: Detect and resolve contradicting memories
- **Temporal awareness**: "You used to prefer X, but recently you've chosen Y"
- **Cross-session learning**: Learn patterns across conversations
- **Memory export/import**: User data portability
- **Memory sharing**: Opt-in sharing between family accounts

---

## Appendix: Examples

### Memory Object

```json
{
  "id": "mem_abc123",
  "type": "HARD",
  "domain": "schedule",
  "key": "no_meetings_after",
  "content": "16:00",
  "confidence": 0.95,
  "source": "USER_EXPLICIT",
  "status": "ACTIVE",
  "lastConfirmedAt": "2025-01-10T18:00:00Z",
  "createdAt": "2025-01-10T18:00:00Z"
}
```

### API Examples

```bash
# List all active memories
GET /api/memory

# Create a memory
POST /api/memory
{ "type": "HARD", "domain": "food", "key": "exclude", "content": ["shellfish"] }

# Propose a memory (agent)
POST /api/memory/propose
{ 
  "type": "HARD", 
  "domain": "shopping", 
  "key": "store", 
  "content": "Kroger", 
  "confidence": 0.6, 
  "evidence": [{ "type": "pattern", "description": "Last 5 orders were Kroger" }],
  "reasoning": "User has consistently chosen Kroger"
}

# Confirm a proposal
POST /api/memory/:id/confirm
{ "confirm": true }

# Retrieve for context
POST /api/memory/retrieve
{ "domains": ["food", "schedule"], "query": "plan meals for next week" }
```

### Prompt Injection Example

When user asks "Schedule a meeting with Alex tomorrow":

```
### User Memory Context

**Hard Preferences** (must be respected):
- [schedule] no_meetings_after: 16:00 (confidence: high)
- [schedule] preferred_meeting_length: 30 (confidence: high)

**Context** (for judgment, not rules):
- Currently onboarding a new team member named Alex (relevance: 95%)
- Prefers morning meetings when possible (relevance: 72%)
```
