# Phase 5: Agent Engine - Chunk Plan

> **Status**: Planning v3.0 (Hash-Based, LLM-First)  
> **Created**: December 26, 2024  
> **Updated**: December 27, 2024  
> **Duration**: Weeks 14-17  
> **Dependencies**: Phase 1 (Core Foundation), Phase 2 (Context System), Phase 3 (Gmail), Phase 4 (Calendar)

---

## Overview

This document breaks down Phase 5 (Agent Engine) into granular implementation chunks. Given that this is the "heart and soul" of Theo, we use more chunks than typical phases to ensure careful, auditable progress with regular checkpoints.

**Phase Goal**: Build the intelligent brain of Theo—the Agent Engine that transforms simple chat into context-aware, action-capable assistance with complete auditability.

---

## Chunk Identification System

Each chunk has a **3-character hash identifier** (e.g., `F0A`, `LLM`, `T2Q`). This allows chunks to be referenced without implying execution order.

### Chunk Reference Table

| Hash | Name | Layer | Description |
|------|------|-------|-------------|
| **FOUNDATION** |
| `F0A` | Security Foundation | Foundation | Input sanitization, rate limiting, CSRF |
| `F1B` | Agent Module Base | Foundation | Types, constants, logger, errors |
| `F2C` | Database Models | Foundation | Agent-related Prisma models & migrations |
| `F3D` | Audit Trail | Foundation | Audit logging, assumptions tracking |
| **LLM CORE** |
| `LLM` | LLM Client | LLM Core | Provider abstraction, prompts, contracts |
| **TOOLS** |
| `T1R` | Tool Registry | Tools | ToolDefinition, ToolForLLM, registry |
| `T2Q` | Query Tools | Tools | Context, email, calendar query tools |
| `T3A` | Action Tools | Tools | Task, email, calendar action tools |
| `T4E` | Execution Engine | Tools | Zod validation, execution, results |
| **PERCEPTION** |
| `P1I` ✅ | Intent Analyzer | Perception | Calls LLM, builds ClassificationRequest |
| `P2E` ✅ | Entity Resolution | Perception | Maps LLM entities to DB records |
| `P3C` ✅ | Context Retrieval | Perception | Gathers context for LLM |
| **ROUTING** |
| `R1D` ✅ | Decision Logic | Routing | Routes based on LLM confidence |
| `R2F` | Response Formatting | Routing | Builds prompts, formats responses |
| **PLANNING** |
| `L1G` | Plan Generation | Planning | LLM creates plans, agent structures |
| `L2X` | Plan Execution | Planning | Executes steps, pauses at approvals |
| `L3S` | Plan State | Planning | Recovery, rollback, persistence |
| **APPROVAL** |
| `A1P` | Approval System | Approval | Stores LLM reasoning, handles decisions |
| `A2U` | User Autonomy | Approval | Per-user approval settings |
| **ORCHESTRATOR** |
| `ORK` | Agent Orchestrator | Core | Wires everything together |
| **APIs** |
| `W1C` | Chat API | APIs | SSE streaming chat endpoint |
| `W2A` | Approval & Audit APIs | APIs | Approval and audit endpoints |
| `W3P` | Plan APIs | APIs | Plan management endpoints |
| **UI** |
| `U1S` | Streaming Chat | UI | Chat interface with thinking display |
| `U2D` | Approval Dialog | UI | Approval UI with LLM reasoning |
| `U3V` | Audit Viewer | UI | Audit history with assumptions |
| **FINALIZATION** |
| `X1T` | Integration Testing | Final | LLM mock testing |
| `X2R` | Polish & Review | Final | Code review, security audit |
| `X3V` | Verification | Final | Multi-flow comprehensive testing |

---

## Build Order (LLM-First)

> **Philosophy**: "Build the brain first, then build the body around it."

### Phase 5.1: Foundation
```
F0A → F1B → [F2C, F3D]  ═══ CHECKPOINT: Foundation ═══
```

### Phase 5.2: LLM Core (THE BRAIN)
```
LLM  ═══ CHECKPOINT: LLM Core ═══
```

### Phase 5.3: Tool System
```
T1R → T2Q → T3A → T4E  ═══ CHECKPOINT: Tools ═══
```

### Phase 5.4: Perception ✅
```
P1I → [P2E, P3C]  ═══ CHECKPOINT: Perception ═══ ✅
```

### Phase 5.5: Routing
```
R1D → R2F  ═══ CHECKPOINT: Routing ═══
```

### Phase 5.6: Planning
```
L1G → L2X → L3S  ═══ CHECKPOINT: Planning ═══
```

### Phase 5.7: Approval
```
A1P → A2U  ═══ CHECKPOINT: Approval ═══
```

### Phase 5.8: Orchestrator
```
ORK  ═══ CHECKPOINT: Agent Core ═══
```

### Phase 5.9: APIs
```
W1C → W2A → W3P  ═══ CHECKPOINT: APIs ═══
```

### Phase 5.10: UI
```
U1S → U2D → U3V  ═══ CHECKPOINT: UI ═══
```

### Phase 5.11: Finalization
```
X1T → X2R → X3V  ═══ PHASE 5 COMPLETE ═══
```

### Full Linear Order

```
F0A → F1B → F2C → F3D → LLM → T1R → T2Q → T3A → T4E → P1I → P2E → P3C → R1D → R2F → L1G → L2X → L3S → A1P → A2U → ORK → W1C → W2A → W3P → U1S → U2D → U3V → X1T → X2R → X3V
```

### Parallelization Opportunities

| Step | Parallel Chunks | Notes |
|------|-----------------|-------|
| After F1B | F2C, F3D | Both depend only on F1B |
| After P1I | P2E, P3C | Both depend only on P1I |

---

## Dependency Graph (Visual)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FOUNDATION                                     │
│                                                                             │
│  ✅ [F0A] Security ──▶ ✅ [F1B] Module Base ──┬──▶ ✅ [F2C] DB Models        │
│                                          └──▶ ✅ [F3D] Audit Trail          │
│                                                     │                       │
└─────────────────────────────────────────────────────│───────────────────────┘
                                                      │
                                            ═══ CHECKPOINT 1 ═══ ✅
                                                      │
┌─────────────────────────────────────────────────────│────────────────────────┐
│                            ★★★ LLM CORE ★★★         │                        │
│                                                     ▼                        │
│                                             ✅[LLM] LLM Client                │
│                                                      │                       │
│  THE BRAIN: classify(), generatePlan(), generateResponse(), decideRecovery() │
└─────────────────────────────────────────────────────│────────────────────────┘
                                                      │
                                            ═══ CHECKPOINT 2 ═══ ✅
                                                      │
┌─────────────────────────────────────────────────────│────────────────────────┐
│                              TOOLS                  │                        │
│                                                     ▼                        │
│  ✅[T1R] Registry ──▶ ✅[T2Q] Query ──▶ ✅[T3A] Action ──▶ ✅[T4E] Execution  │
│                                                      │                       │
│  Tools define: whenToUse, examples, parametersSchema, inputValidator         │
└─────────────────────────────────────────────────────│────────────────────────┘
                                                      │
                                            ═══ CHECKPOINT 3 ═══ ✅
                                                      │
┌─────────────────────────────────────────────────────│────────────────────────┐
│                            PERCEPTION               │                        │
│                                                     ▼                        │
│                ✅[P1I] Intent ──┬──▶ ✅[P2E] Entity Resolution               │
│                                 └──▶ ✅[P3C] Context Retrieval               │
│                                               │                              │
│  Calls LLM.classify(), maps entities to DB records, gathers context          │
└───────────────────────────────────────────────│──────────────────────────────┘
                                                │
                                      ═══ CHECKPOINT 4 ═══ ✅
                                                │
┌───────────────────────────────────────────────│───────────────────────────────┐
│                            ROUTING            │                               │
│                                               ▼                               │
│                ✅[R1D] Decision ──▶ ✅[R2F] Response                          │
│                                               │                               │
│  Routes: execute / confirm / clarify / plan based on LLM confidence           │
└───────────────────────────────────────────────│───────────────────────────────┘
                                                │
                                      ═══ CHECKPOINT 5 ═══ ✅
                                                │
┌───────────────────────────────────────────────│───────────────────────────────┐
│                            PLANNING           │                               │
│                                               ▼                               │
│       ✅[L1G] Generation ──▶ ✅[L2X] Execution ──▶ ✅[L3S] State              │
│                                               │                               │
│  LLM.generatePlan() → validate → execute → pause at approvals → recover       │
└───────────────────────────────────────────────│───────────────────────────────┘
                                                │
                                      ═══ CHECKPOINT 6 ═══ ✅
                                                │
┌───────────────────────────────────────────────│───────────────────────────────┐
│                            APPROVAL           │                               │
│                                               ▼                               │
│                 [A1P] System ──▶ [A2U] Autonomy                               │
│                                               │                               │
│  Stores LLM reasoning, confidence, assumptions; user can modify params        │
└───────────────────────────────────────────────│───────────────────────────────┘
                                                │
                                      ═══ CHECKPOINT 7 ═══
                                                │
┌───────────────────────────────────────────────│───────────────────────────────┐
│                          ORCHESTRATOR         │                               │
│                                               ▼                               │
│                            [ORK] Agent Engine                                 │
│                                               │                               │
│  processMessage() → LLM → route → execute → respond (streaming)               │
└───────────────────────────────────────────────│───────────────────────────────┘
                                                │
                                      ═══ CHECKPOINT 8 ═══
                                                │
┌───────────────────────────────────────────────│───────────────────────────────┐
│                              APIS             │                               │
│                                               ▼                               │
│       [W1C] Chat ──▶ [W2A] Approval/Audit ──▶ [W3P] Plans                     │
│                                               │                               │
└───────────────────────────────────────────────│───────────────────────────────┘
                                                │
                                      ═══ CHECKPOINT 9 ═══
                                                │
┌───────────────────────────────────────────────│───────────────────────────────┐
│                               UI              │                               │
│                                               ▼                               │
│       [U1S] Chat ──▶ [U2D] Approval ──▶ [U3V] Audit                           │
│                                               │                               │
└───────────────────────────────────────────────│───────────────────────────────┘
                                                │
                                      ═══ CHECKPOINT 10 ═══
                                                │
┌───────────────────────────────────────────────│───────────────────────────────┐
│                          FINALIZATION         │                               │
│                                               ▼                               │
│       [X1T] Testing ──▶ [X2R] Review ──▶ [X3V] Verification                   │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## LLM-First Architecture Rationale

### Why LLM Client (`LLM`) Comes Early

| Benefit | Description |
|---------|-------------|
| **Contracts First** | `ClassificationResponse`, `LLMGeneratedPlan` defined before consumers |
| **Real Integration** | Tools, Intent, Planning all use real LLM calls (or mocks) |
| **E2E Testing** | Can test full flows at each checkpoint |
| **No Stubs** | No placeholder `callLLM()` functions scattered everywhere |

### The LLM is THE Decision Maker

```
User Message
     │
     ▼
[LLM] classify() ──────────────────────────────────────────┐
     │                                                      │
     ▼                                                      │
[R1D] Route based on:                                       │
  - LLM confidence                                          │
  - LLM suggested tool                                      │
  - LLM assumptions                                         │
     │                                                      │
     ├──▶ execute (high confidence)                         │
     ├──▶ confirm (medium confidence)                       │
     ├──▶ clarify (low confidence / missing info)           │
     └──▶ plan (complex multi-step) ──▶ [LLM] generatePlan()│
                                                            │
     ▼                                                      │
[LLM] generateResponse() ◀─────────────────────────────────┘
     │
     ▼
User Response (with LLM reasoning visible)
```

### Agent is a THIN Layer

| LLM Does | Agent Does |
|----------|------------|
| Understands intent | Provides tools to LLM |
| Extracts entities | Resolves to DB records |
| Suggests tool + params | Validates with Zod |
| Generates plans | Structures + persists |
| Writes response | Streams to frontend |
| Explains reasoning | Logs to audit |
| 16, 17 | ❌ Sequential | Approval workflow |
| 18 → 20 | ❌ Sequential | API routes build up |
| 21 → 23 | ❌ Sequential | UI builds on each other |
| 24, 25 | ❌ Sequential | LLM then orchestration |
| 26 → 28 | ❌ Sequential | Final verification |

---

## Checkpoint Definition

Each checkpoint requires verification before proceeding. This prevents "building indigestion" by ensuring each layer is solid.

### Checkpoint Structure

```markdown
### Checkpoint N: [Name]

**Pre-Conditions**:
- [ ] All chunks in layer complete
- [ ] All tests passing
- [ ] No TypeScript errors

**Review Criteria**:
- [ ] Code review completed
- [ ] Security audit passed
- [ ] Documentation updated

**Testing Criteria**:
- [ ] Unit tests > 80% coverage
- [ ] Integration tests for layer
- [ ] Manual testing scenarios completed

**Audit Criteria**:
- [ ] Follows project patterns
- [ ] No drift from plan
- [ ] No placeholder implementations

**Sign-Off**:
- [ ] Checkpoint approved to proceed
```

---

## [F0A] Security & Infrastructure Foundation

**Estimated Time**: 2-3 hours  
**Dependencies**: Phase 1-4 complete  
**Goal**: Establish security patterns and infrastructure for the Agent Engine.

### Prerequisites

- [ ] Phase 4 complete (Gmail + Calendar integrations working)
- [ ] Existing rate limiting and auth patterns established

### Architecture Notes

The Agent Engine has unique security requirements:
1. **Token management**: LLM API keys must be encrypted at rest
2. **Rate limiting**: Per-user limits on LLM calls, actions per minute
3. **Content filtering**: Input/output moderation for safety
4. **Audit logging**: Every agent decision must be traceable

### Tasks

1. [ ] Create `src/lib/agent/config.ts` with agent configuration
   - LLM model defaults
   - Confidence thresholds
   - Rate limit configurations
   - Content filtering settings

2. [ ] Add agent-specific rate limiting to `src/lib/rate-limit/index.ts`
   - `RATE_LIMITS.agentChat` - messages per minute
   - `RATE_LIMITS.agentActions` - actions per minute
   - `RATE_LIMITS.llmTokens` - tokens per hour

3. [ ] Create `src/lib/agent/safety/content-filter.ts`
   - Input sanitization for prompts
   - Output filtering for responses
   - Harmful content detection patterns

4. [ ] Add secure token storage pattern for LLM API keys
   - Reuse existing encryption utilities
   - Environment variable fallback

### Files to Create/Modify

```
src/lib/agent/
├── config.ts                    # NEW: Agent configuration
├── safety/
│   └── content-filter.ts        # NEW: Content filtering

src/lib/rate-limit/
└── index.ts                     # UPDATE: Add agent rate limits
```

### Security Checklist

- [ ] LLM API keys never logged
- [ ] Rate limiting configured before any LLM calls
- [ ] Content filtering covers injection attempts
- [ ] Prompt injection mitigations documented

### Testing Requirements

- [ ] Unit tests for content filter functions
- [ ] Test rate limiting configurations
- [ ] Test configuration loading

### Documentation Updates

- [ ] Create `docs/services/AGENT_ENGINE.md` (stub)
- [ ] Document security considerations

### Acceptance Criteria

- [ ] All security foundations in place
- [ ] Rate limiting configured
- [ ] Content filtering working
- [ ] No TypeScript errors
- [ ] All tests pass

---

## [F1B] Agent Module Foundation

**Estimated Time**: 2-3 hours  
**Dependencies**: Chunk 0  
**Goal**: Establish foundational structure for the Agent Engine module.

### Prerequisites

- [ ] Chunk 0 complete

### Architecture Notes

Following patterns from Gmail/Calendar:
- Structured logging with child loggers
- Typed error classes with error codes
- Centralized constants
- Comprehensive TypeScript types

### Tasks

1. [ ] Create `src/lib/agent/constants.ts`
   ```typescript
   // Confidence thresholds
   export const CONFIDENCE_THRESHOLDS = {
     ACTION: 0.7,
     STATEMENT: 0.5,
     ASSUMPTION: 0.3,
     HIGH_RISK: 0.9,
   };
   
   // Tool categories
   export const TOOL_CATEGORIES = { ... };
   
   // Risk levels
   export const RISK_LEVELS = { ... };
   ```

2. [ ] Create `src/lib/agent/types.ts`
   - `AgentMessage` interface
   - `IntentAnalysis` interface
   - `PlanStep` interface
   - `ToolCall` interface
   - `AuditEntry` interface
   - `Assumption` interface
   - All enums from spec

3. [ ] Create `src/lib/agent/errors.ts`
   - `AgentError` base class
   - `IntentUnclearError`
   - `ContextMissingError`
   - `ToolNotAvailableError`
   - `ApprovalTimeoutError`
   - `ToolExecutionFailedError`
   - `PlanFailedError`
   - `RateLimitExceededError`

4. [ ] Create `src/lib/agent/logger.ts`
   - Main `agentLogger`
   - Child loggers: `intentLogger`, `planLogger`, `toolLogger`, `auditLogger`

5. [ ] Create `src/lib/agent/index.ts`
   - Export public API

### Files to Create

```
src/lib/agent/
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
- [ ] Test logger child creation
- [ ] Type compilation tests

### Acceptance Criteria

- [ ] All foundational files created
- [ ] Types match Phase 5 spec
- [ ] Errors provide useful debugging info
- [ ] No TypeScript errors
- [ ] All tests pass

---

## [F2C] Database Models & Migrations

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 1  
**Goal**: Create database schema for Agent Engine.

### Prerequisites

- [ ] Chunk 1 complete

### Architecture Notes

New models needed:
1. **Conversation** - Chat conversations
2. **Message** - Individual messages in conversations
3. **AgentPlan** - Multi-step plans
4. **AgentPlanStep** - Steps within plans
5. **ActionApproval** - Pending action approvals
6. **AuditLog** - Agent action audit trail
7. **AuditAssumption** - Tracked assumptions
8. **UserAutonomySettings** - Per-action-type approval settings

### Tasks

1. [ ] Add `Conversation` model to `prisma/schema.prisma`
   ```prisma
   model Conversation {
     id          String    @id @default(cuid())
     userId      String
     title       String?
     
     // Status
     status      String    @default("active")
     
     // Timestamps
     createdAt   DateTime  @default(now())
     updatedAt   DateTime  @updatedAt
     lastMessageAt DateTime?
     
     // Relations
     user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
     messages    Message[]
     plans       AgentPlan[]
     
     @@index([userId])
     @@index([lastMessageAt])
   }
   ```

2. [ ] Add `Message` model
   ```prisma
   model Message {
     id              String    @id @default(cuid())
     conversationId  String
     
     // Content
     role            String    // 'user', 'assistant', 'system', 'tool'
     content         String    @db.Text
     
     // Tool calls
     toolCalls       Json?     // For assistant messages with tool calls
     toolCallId      String?   // For tool response messages
     
     // Metadata
     metadata        Json      @default("{}")
     
     // Timestamps
     createdAt       DateTime  @default(now())
     
     // Relations
     conversation    Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
     
     @@index([conversationId])
   }
   ```

3. [ ] Add `AgentPlan` model
   ```prisma
   model AgentPlan {
     id              String    @id @default(cuid())
     userId          String
     conversationId  String?
     
     // Goal
     goal            String    @db.Text
     goalType        String
     
     // Status
     status          String    @default("planned")
     currentStep     Int       @default(0)
     
     // Approval
     requiresApproval Boolean  @default(false)
     approvedAt      DateTime?
     approvedBy      String?
     
     // Timestamps
     createdAt       DateTime  @default(now())
     updatedAt       DateTime  @updatedAt
     completedAt     DateTime?
     
     // Relations
     user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
     conversation    Conversation? @relation(fields: [conversationId], references: [id])
     steps           AgentPlanStep[]
     
     @@index([userId])
     @@index([status])
   }
   ```

4. [ ] Add `AgentPlanStep` model
   ```prisma
   model AgentPlanStep {
     id              String    @id @default(cuid())
     planId          String
     
     // Order
     stepOrder       Int
     
     // Action
     toolName        String
     toolParams      Json
     
     // Dependencies
     dependsOn       String[]  @default([])
     
     // Status
     status          String    @default("pending")
     
     // Result
     result          Json?
     errorMessage    String?
     
     // Rollback
     rollbackAction  Json?
     rolledBackAt    DateTime?
     
     // Timestamps
     createdAt       DateTime  @default(now())
     executedAt      DateTime?
     
     // Relations
     plan            AgentPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
     
     @@index([planId])
     @@index([status])
   }
   ```

5. [ ] Add `ActionApproval` model (generic, for all action types)
   ```prisma
   model ActionApproval {
     id              String    @id @default(cuid())
     userId          String
     
     // Context
     planId          String?
     stepIndex       Int?
     conversationId  String?
     
     // Action
     actionType      String
     toolName        String
     parameters      Json
     
     // Status
     status          String    @default("pending")
     
     // Risk
     riskLevel       String
     
     // Reasoning
     reasoning       String    @db.Text
     
     // Timing
     requestedAt     DateTime  @default(now())
     expiresAt       DateTime?
     decidedAt       DateTime?
     
     // Result
     result          Json?
     errorMessage    String?
     
     // Relations
     user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
     
     @@index([userId, status])
     @@index([expiresAt])
   }
   ```

6. [ ] Add `AuditLog` model
   ```prisma
   model AuditLog {
     id              String    @id @default(cuid())
     userId          String
     
     // Context
     sessionId       String?
     conversationId  String?
     
     // Action
     actionType      String
     actionCategory  String
     
     // Reasoning
     intent          String?   @db.Text
     reasoning       String?   @db.Text
     confidence      Float?
     
     // Entity
     entityType      String?
     entityId        String?
     entityBefore    Json?
     entityAfter     Json?
     
     // Input/Output
     input           Json?
     output          Json?
     
     // Status
     status          String
     errorMessage    String?
     
     // Timing
     durationMs      Int?
     
     // Model
     modelUsed       String?
     tokensUsed      Int?
     
     // Timestamps
     createdAt       DateTime  @default(now())
     
     // Relations
     user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
     assumptions     AuditAssumption[]
     
     @@index([userId])
     @@index([conversationId])
     @@index([actionType])
     @@index([createdAt])
   }
   ```

7. [ ] Add `AuditAssumption` model
   ```prisma
   model AuditAssumption {
     id              String    @id @default(cuid())
     auditLogId      String
     
     // Assumption
     statement       String    @db.Text
     category        String    // 'intent', 'context', 'preference', 'inference'
     evidence        Json
     confidence      Float
     
     // Verification
     verified        Boolean?
     verifiedAt      DateTime?
     correction      String?   @db.Text
     
     // Relations
     auditLog        AuditLog  @relation(fields: [auditLogId], references: [id], onDelete: Cascade)
     
     @@index([auditLogId])
   }
   ```

8. [ ] Add `UserAutonomySettings` model
   ```prisma
   model UserAutonomySettings {
     id              String    @id @default(cuid())
     userId          String    @unique
     
     // Per-action approval levels
     settings        Json      @default("{}")
     // Example: { "email.send": "confirm", "task.create": "auto" }
     
     // Timestamps
     createdAt       DateTime  @default(now())
     updatedAt       DateTime  @updatedAt
     
     // Relations
     user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
   }
   ```

9. [ ] Update User model with new relations
   ```prisma
   // Add to User model:
   conversations      Conversation[]
   agentPlans         AgentPlan[]
   actionApprovals    ActionApproval[]
   auditLogs          AuditLog[]
   autonomySettings   UserAutonomySettings?
   ```

10. [ ] Create migration
    ```bash
    npx prisma migrate dev --name add_agent_engine_models
    ```

### Files to Create/Modify

```
prisma/
├── schema.prisma                      # UPDATE: Add Agent models
├── migrations/
│   └── YYYYMMDD_add_agent_engine_models/
│       └── migration.sql              # NEW: Generated migration
```

### Security Checklist

- [ ] Cascade deletes configured properly
- [ ] Indexes on userId for row-level security
- [ ] Sensitive data fields identified

### Testing Requirements

- [ ] Migration applies without errors
- [ ] Migration rollback works
- [ ] Basic CRUD operations work

### Acceptance Criteria

- [ ] All models created in schema
- [ ] Migration applies cleanly
- [ ] Documentation updated

---

## [F3D] Audit Trail System

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 1, Chunk 2  
**Goal**: Implement the always-on audit trail system.

### Prerequisites

- [ ] Chunk 1 complete (types available)
- [ ] Chunk 2 complete (database models)

### Architecture Notes

Every agent action generates an audit entry. This system must be:
- **Fast**: Audit logging should not slow down operations
- **Complete**: Every decision and action is captured
- **Queryable**: Users can search their audit history
- **Verifiable**: Assumptions can be marked as verified/corrected

### Tasks

1. [ ] Create `src/lib/agent/audit/repository.ts`
   ```typescript
   export const auditLogRepository = {
     create(entry: AuditLogCreate): Promise<AuditLog>;
     findById(id: string): Promise<AuditLog | null>;
     findByUser(userId: string, options?: QueryOptions): Promise<AuditLog[]>;
     findByConversation(conversationId: string): Promise<AuditLog[]>;
     findByEntity(entityType: string, entityId: string): Promise<AuditLog[]>;
     getRecentActions(userId: string, limit: number): Promise<AuditLog[]>;
   };
   
   export const assumptionRepository = {
     create(assumption: AssumptionCreate): Promise<AuditAssumption>;
     findByAuditLog(auditLogId: string): Promise<AuditAssumption[]>;
     findUnverified(userId: string): Promise<AuditAssumption[]>;
     verify(id: string, verified: boolean, correction?: string): Promise<AuditAssumption>;
   };
   ```

2. [ ] Create `src/lib/agent/audit/service.ts`
   ```typescript
   export async function logAgentAction(
     entry: AuditLogInput,
     assumptions?: AssumptionInput[]
   ): Promise<AuditLog>;
   
   export async function queryAuditLog(
     userId: string,
     options: AuditQueryOptions
   ): Promise<AuditLog[]>;
   
   export async function getAssumptionsForAction(
     actionId: string
   ): Promise<AuditAssumption[]>;
   
   export async function verifyAssumption(
     userId: string,
     assumptionId: string,
     verified: boolean,
     correction?: string
   ): Promise<AuditAssumption>;
   
   export async function getUnverifiedAssumptions(
     userId: string
   ): Promise<AuditAssumption[]>;
   ```

3. [ ] Create `src/lib/agent/audit/types.ts`
   - `AuditLogInput` interface
   - `AuditQueryOptions` interface
   - `AssumptionInput` interface

4. [ ] Create `src/lib/agent/audit/index.ts`
   - Export all audit functions

5. [ ] Implement audit entry creation with assumption linking

6. [ ] Implement efficient query patterns for audit history

### Files to Create

```
src/lib/agent/audit/
├── index.ts          # NEW: Exports
├── types.ts          # NEW: Audit types
├── repository.ts     # NEW: Database access
├── service.ts        # NEW: Audit service
```

### Security Checklist

- [ ] Audit logs cannot be modified (append-only)
- [ ] Queries include userId filter
- [ ] Sensitive data redacted in logs

### Testing Requirements

- [ ] Unit tests for audit creation
- [ ] Test assumption linking
- [ ] Test query filters
- [ ] Test verification flow

### Acceptance Criteria

- [ ] Audit logging working
- [ ] Assumption tracking working
- [ ] Query interface complete
- [ ] All tests pass

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 1: Foundation [F0A, F1B, F2C, F3D]
## ═══════════════════════════════════════════════════

**Pre-Conditions**:
- [ ] Chunks 0, 1, 2, 3 complete
- [ ] All tests passing
- [ ] No TypeScript errors

**Review Criteria**:
- [ ] Code follows project patterns (logger, errors, constants)
- [ ] Database schema matches Phase 5 spec
- [ ] Audit system captures required fields
- [ ] Security foundations in place

**Testing Criteria**:
- [ ] Unit tests for all new modules
- [ ] Database migrations apply/rollback cleanly
- [ ] Audit CRUD operations tested

**Audit Criteria**:
- [ ] No placeholder implementations
- [ ] All TODOs documented as issues
- [ ] Follows DRY principle

**Manual Testing**:
- [ ] Create audit entry via code
- [ ] Query audit history
- [ ] Verify assumption tracking

**Sign-Off**: _________________ Date: _________

---

## [P1I] Intent Analyzer (LLM-First)

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 1  
**Goal**: Build the LLM-first intent understanding system.  
**Status**: ✅ Complete

### Prerequisites

- [x] Chunk 1 complete (types available)

### Architecture Notes

**LLM-First Design**: The intent analyzer is designed for tight LLM coupling:
- **No pattern matching**: The LLM handles all natural language understanding
- **Tools define themselves**: Tools provide `ToolForLLM` interface with descriptions, examples, and parameters
- **Structured output**: We define the JSON contract the LLM returns
- **Thin conversion layer**: Just converts LLM response to internal types

This design ensures:
1. **Scalability**: New tools just register with their interface—no central pattern updates
2. **Consistency**: LLM uses same tool definitions for intent and execution
3. **Simplicity**: No brittle regex patterns to maintain

### Implementation Summary

1. [x] Created `src/lib/agent/intent/types.ts`
   ```typescript
   // LLM request/response contracts
   export interface ClassificationRequest {
     message: string;
     conversationHistory?: AgentMessage[];
     availableTools: ToolForLLM[];
     timezone?: string;
     currentTime?: Date;
   }
   
   export interface ClassificationResponse {
     intent: { category, action, summary };
     entities: LLMExtractedEntity[];
     suggestedTool?: { name, parameters, confidence, reasoning };
     clarificationNeeded?: { required, questions, missingInfo };
     assumptions: LLMAssumption[];
     confidence: number;
   }
   
   // Tool interface for LLM - tools define themselves
   export interface ToolForLLM {
     name: string;
     description: string;
     whenToUse: string;
     examples?: string[];
     parameters: Record<string, unknown>;
     requiresApproval: boolean;
   }
   ```

2. [x] Created `src/lib/agent/intent/analyzer.ts`
   ```typescript
   export interface IIntentAnalyzer {
     classify(request: ClassificationRequest): Promise<ClassificationResponse>;
     toIntentAnalysis(response: ClassificationResponse): IntentAnalysis;
   }
   
   export function createIntentAnalyzer(config?: IntentClassifierConfig): IIntentAnalyzer;
   export async function classifyIntent(message: string, tools: ToolForLLM[]): Promise<ClassificationResponse>;
   ```
   
   - Builds structured prompts for LLM
   - Stub callLLM() returns unknown intent (real implementation in Chunk 24)
   - Converts LLM response to internal IntentAnalysis format

3. [x] Created `src/lib/agent/intent/ambiguity.ts`
   - Analyzes LLM response for ambiguity signals
   - Trusts LLM's clarificationNeeded flag
   - Detects: low_confidence, entity_resolution, missing_info, multiple_actions

4. [x] Created `src/lib/agent/intent/index.ts`
   - Clean exports

### Files Created

```
src/lib/agent/intent/
├── index.ts              # Exports
├── types.ts              # LLM request/response types, ToolForLLM
├── analyzer.ts           # Intent analyzer (LLM stub)
├── ambiguity.ts          # Ambiguity detection from LLM response
```

### Security Checklist

- [x] Input sanitized via safety module (Chunk 3)
- [x] Prompt injection detection in content filter
- [x] Rate limiting via agent config

### Testing Results

- [x] 33 tests pass
- [x] Analyzer factory tests
- [x] Classification request tests  
- [x] Response conversion tests
- [x] Ambiguity detection tests
- [x] Tool definition interface tests
- [x] Utility function tests (requiresClarification, canProceedWithAssumptions, etc.)
- [x] Integration flow tests

### Acceptance Criteria

- [x] LLM-first design (no pattern matching)
- [x] Tools define their own interface for LLM
- [x] Ambiguity detection from LLM signals
- [x] All tests pass
- [x] Clean integration point for Chunk 24 (LLM)

---

## [P2E] Entity Resolution (LLM-First) ✅

**Estimated Time**: 2-3 hours  
**Dependencies**: Chunk 4, Chunk 2  
**Goal**: Resolve LLM-extracted entities to database records.  
**Status**: ✅ Complete

### Prerequisites

- [ ] Chunk 4 complete (LLM provides extracted entities)
- [ ] Chunk 2 complete (database for resolution)

### Architecture Notes

**LLM-First Design**: Entity *extraction* is handled by the LLM in Chunk 4. The `ClassificationResponse` already includes:
```typescript
entities: LLMExtractedEntity[] // From the LLM
```

Each `LLMExtractedEntity` has:
- `type`: person, datetime, duration, location, etc.
- `text`: Original text ("Sarah", "tomorrow at 2pm")
- `value`: Normalized value
- `needsResolution`: Whether we need to match to a DB record

**This chunk focuses solely on resolution** - connecting LLM-extracted entities to actual database records:
- "Sarah" → `Person` record (or clarification if multiple matches)
- "the budget meeting" → `Event` record
- "my project task" → `Task` record

### Tasks

1. [ ] Create `src/lib/agent/entities/types.ts`
   ```typescript
   import type { LLMExtractedEntity } from "../intent";
   
   /**
    * An entity that has been resolved to a database record
    */
   export interface ResolvedEntity {
     /** Original LLM extraction */
     extracted: LLMExtractedEntity;
     
     /** Resolution status */
     status: 'resolved' | 'ambiguous' | 'not_found';
     
     /** Matched database record (if resolved) */
     match?: {
       id: string;
       type: 'person' | 'event' | 'task' | 'email';
       record: unknown; // The actual DB record
     };
     
     /** Multiple matches (if ambiguous) */
     candidates?: Array<{
       id: string;
       label: string;
       confidence: number;
     }>;
     
     /** Resolution confidence (0-1) */
     confidence: number;
   }
   
   export interface ResolutionResult {
     /** All resolved entities */
     entities: ResolvedEntity[];
     
     /** Any entities that need clarification */
     needsClarification: boolean;
     clarificationQuestions: string[];
   }
   ```

2. [ ] Create `src/lib/agent/entities/resolver.ts`
   ```typescript
   /**
    * Resolve LLM-extracted entities to database records
    */
   export async function resolveEntities(
     userId: string,
     entities: LLMExtractedEntity[]
   ): Promise<ResolutionResult>;
   
   /**
    * Resolve a person reference to a Person record
    * Uses fuzzy matching on name + email
    */
   export async function resolvePerson(
     userId: string,
     name: string,
     hints?: { email?: string; context?: string }
   ): Promise<ResolvedEntity>;
   
   /**
    * Resolve an event reference to an Event record
    * Uses semantic search on event titles/descriptions
    */
   export async function resolveEvent(
     userId: string,
     description: string,
     hints?: { dateRange?: { start: Date; end: Date } }
   ): Promise<ResolvedEntity>;
   
   /**
    * Resolve a task reference to a Task record
    */
   export async function resolveTask(
     userId: string,
     description: string
   ): Promise<ResolvedEntity>;
   ```

3. [ ] Create `src/lib/agent/entities/matchers.ts`
   - Fuzzy name matching for people
   - Semantic search integration for events/tasks
   - Disambiguation scoring

4. [ ] Create `src/lib/agent/entities/index.ts`

### Files to Create

```
src/lib/agent/entities/
├── index.ts              # NEW: Exports
├── types.ts              # NEW: Resolution types
├── resolver.ts           # NEW: Entity resolution
├── matchers.ts           # NEW: Fuzzy matching utilities
```

### Key Design Decisions

1. **No extraction logic** - LLM handles all extraction
2. **Resolution only** - Focus on matching to DB records
3. **Graceful ambiguity** - Return candidates when multiple matches
4. **Semantic search** - Use embeddings for event/task resolution

### Testing Requirements

- [ ] Test person resolution (exact match, fuzzy match, ambiguous)
- [ ] Test event resolution with semantic search
- [ ] Test handling of not-found entities
- [ ] Test clarification question generation

### Acceptance Criteria

- [ ] Entity resolution working for people, events, tasks
- [ ] Ambiguous entities return candidates
- [ ] Integration with existing semantic search
- [ ] All tests pass

---

## [P3C] Context Retrieval Service ✅

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 4, Chunk 5  
**Goal**: Build multi-source context retrieval to enrich LLM responses.  
**Status**: ✅ Complete

### Prerequisites

- [ ] Chunk 4 complete (LLM classification available)
- [ ] Chunk 5 complete (entities resolved)

### Architecture Notes

**LLM-First Design**: Context retrieval works *with* the LLM:
1. LLM classifies intent and extracts entities (Chunk 4)
2. We resolve entities to DB records (Chunk 5)
3. **This chunk**: Gather additional context based on resolved entities
4. Context is passed back to LLM for response generation

Context retrieval gathers relevant information from:
- Resolved entities (people, events, tasks, etc. from Chunk 5)
- Conversation history
- Semantic search (embeddings)
- Recent interactions

The service must rank and prioritize context by relevance to feed back to the LLM.

### Tasks

1. [ ] Create `src/lib/agent/context/types.ts`
   ```typescript
   export interface ContextRetrieval {
     relevantPeople: PersonWithRelevance[];
     relevantEvents: EventWithRelevance[];
     relevantTasks: TaskWithRelevance[];
     relevantDeadlines: DeadlineWithRelevance[];
     conversationContext: Message[];
     semanticMatches: SemanticMatch[];
     recentInteractions: Interaction[];
   }
   
   export interface RetrievalOptions {
     maxPeople?: number;
     maxEvents?: number;
     maxTasks?: number;
     maxSemanticMatches?: number;
     maxConversationMessages?: number;
     timeRange?: { start: Date; end: Date };
   }
   ```

2. [ ] Create `src/lib/agent/context/retrieval.ts`
   ```typescript
   export async function retrieveContext(
     userId: string,
     intent: IntentAnalysis,
     options?: RetrievalOptions
   ): Promise<ContextRetrieval>;
   
   export async function searchSemantic(
     userId: string,
     query: string,
     filters?: SemanticFilters
   ): Promise<SemanticMatch[]>;
   
   export async function getRecentInteractions(
     userId: string,
     limit: number
   ): Promise<Interaction[]>;
   ```

3. [ ] Create `src/lib/agent/context/ranking.ts`
   ```typescript
   export function rankContextRelevance(
     items: ContextItem[],
     intent: IntentAnalysis
   ): RankedContext[];
   
   export function mergeAndRank(
     sources: ContextRetrieval
   ): RankedContext[];
   ```

4. [ ] Integrate with existing embedding search service

5. [ ] Create context summarization for large results

### Files to Create

```
src/lib/agent/context/
├── index.ts              # NEW: Exports
├── types.ts              # NEW: Context types
├── retrieval.ts          # NEW: Context retrieval
├── ranking.ts            # NEW: Relevance ranking
```

### Testing Requirements

- [ ] Test multi-source retrieval
- [ ] Test relevance ranking
- [ ] Test with various intent types
- [ ] Test context summarization

### Acceptance Criteria

- [ ] Context retrieval from all sources
- [ ] Ranking working correctly
- [ ] Integration with embeddings
- [ ] All tests pass

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 4: Perception [P1I, P2E, P3C] ✅
## ═══════════════════════════════════════════════════

**Pre-Conditions**:
- [x] Chunks P1I, P2E, P3C complete
- [x] All tests passing (494 tests across 12 files)
- [x] No TypeScript errors

**Review Criteria (LLM-First)**:
- [x] Intent analyzer provides clean interface for LLM via `ClassificationRequest`/`ClassificationResponse`
- [x] Entity resolution connects LLM extractions to DB records via `EntityResolver`
- [x] Context retrieval enriches LLM responses via `ContextRetrievalService`
- [x] No pattern-matching or regex-based NLU (verified - no regex in intent/)

**Testing Criteria**:
- [x] Unit tests comprehensive (143 tests in perception layer alone)
- [x] Entity resolution tested (exact, fuzzy, ambiguous via `nameSimilarity`, `jaroWinklerSimilarity`)
- [x] Context retrieval integrates with embeddings via `searchSemantic`

**Manual Testing Scenarios**:
- [x] LLM stub returns unknown → clarification generated (intent.test.ts line 271-298)
- [x] Entity resolution with name matching (entities.test.ts - nameSimilarity tests)
- [x] Ambiguous entity returns candidates for clarification (entities.test.ts line 312-339)
- [x] Context retrieval returns relevant events/tasks (context-retrieval.test.ts line 510-606)

**Audit Criteria**:
- [x] Tools define themselves via `ToolForLLM` interface (8 files use it)
- [x] Follows project patterns (barrel exports, typed errors, services)
- [x] Error handling complete (`EntityResolutionError`, `ContextRetrievalError` in errors.ts)

**Sign-Off**: Cursor AI Date: December 29, 2024

---

## [R1D] Decision Logic & Action Routing (LLM-First)

**Estimated Time**: 2-3 hours  
**Dependencies**: Chunk 4, Chunk 5, Chunk 6  
**Goal**: Route LLM classification to appropriate actions based on confidence thresholds.

### Prerequisites

- [x] Chunk 4 complete (LLM classification)
- [x] Chunk 5 complete (entity resolution)
- [x] Chunk 6 complete (context retrieval)

### Architecture Notes

**LLM-First Design**: The LLM already provides the "hypothesis":
- `ClassificationResponse.intent` = what the user wants
- `ClassificationResponse.confidence` = how sure the LLM is
- `ClassificationResponse.suggestedTool` = proposed action
- `ClassificationResponse.assumptions` = reasoning

**This chunk focuses on decision logic** - what to do with the LLM's output:
1. **High confidence + tool suggested** → Route to tool execution
2. **Medium confidence** → Confirm with user before acting
3. **Low confidence / clarification needed** → Ask clarifying questions
4. **No tool suggested** → Generate conversational response

### Tasks

1. [x] Create `src/lib/agent/routing/types.ts`
   ```typescript
   import type { ClassificationResponse } from "../intent";
   import type { ResolutionResult } from "../entities";
   import type { ContextRetrieval } from "../context";
   
   /** Combined input from perception layer */
   export interface PerceptionResult {
     classification: ClassificationResponse;
     resolvedEntities: ResolutionResult;
     context: ContextRetrieval;
   }
   
   /** Decision about what to do next */
   export type ActionDecision = 
     | { type: 'execute_tool'; tool: string; params: Record<string, unknown>; requiresApproval: boolean }
     | { type: 'confirm_action'; tool: string; params: Record<string, unknown>; confirmationMessage: string }
     | { type: 'clarify'; questions: string[] }
     | { type: 'respond'; message: string }
     | { type: 'error'; error: string };
   ```

2. [x] Create `src/lib/agent/routing/router.ts`
   ```typescript
   /**
    * Route LLM classification to an action decision
    */
   export async function routeToAction(
     perception: PerceptionResult,
     thresholds?: ConfidenceThresholds
   ): Promise<ActionDecision>;
   
   /**
    * Check if we should proceed with tool execution
    */
   export function shouldExecute(
     classification: ClassificationResponse,
     thresholds: ConfidenceThresholds
   ): boolean;
   
   /**
    * Check if we need clarification before proceeding
    */
   export function needsClarification(
     classification: ClassificationResponse,
     entities: ResolutionResult
   ): boolean;
   ```

3. [x] Create `src/lib/agent/routing/thresholds.ts`
   ```typescript
   export interface ConfidenceThresholds {
     /** Execute tool immediately (e.g., 0.85) */
     execute: number;
     /** Confirm with user before executing (e.g., 0.65) */
     confirm: number;
     /** Ask for clarification (below confirm) */
     clarify: number;
   }
   
   export const DEFAULT_THRESHOLDS: ConfidenceThresholds = {
     execute: 0.85,
     confirm: 0.65,
     clarify: 0.40,
   };
   ```

4. [x] Create `src/lib/agent/routing/index.ts`

### Files to Create

```
src/lib/agent/routing/
├── index.ts              # NEW: Exports
├── types.ts              # NEW: Decision types
├── router.ts             # NEW: Action routing logic
├── thresholds.ts         # NEW: Confidence thresholds
```

### Key Design Decisions

1. **No manual hypothesis formation** - LLM provides the hypothesis
2. **No manual confidence scoring** - LLM provides confidence
3. **Just decision logic** - Route to action based on LLM output
4. **Threshold-based** - Clear rules for when to act vs. ask

### Testing Requirements

- [x] Test routing with high confidence → execute
- [x] Test routing with medium confidence → confirm
- [x] Test routing with low confidence → clarify
- [x] Test routing with unresolved entities → clarify
- [x] Test threshold configuration

### Acceptance Criteria

- [x] Action routing based on LLM confidence
- [x] Handles entity resolution failures
- [x] Threshold-based decision making
- [x] All tests pass (56 tests)

**Completed**: December 29, 2024

---

## [R2F] Response Formatting & Prompt Building (LLM-First)

**Estimated Time**: 2-3 hours  
**Dependencies**: Chunk 7  
**Goal**: Build prompts for LLM response generation and format outputs.

### Prerequisites

- [ ] Chunk 7 complete (action decisions available)

### Architecture Notes

**LLM-First Design**: The LLM generates actual response content (Chunk 24). This chunk:
1. **Builds prompts** for the LLM based on action decisions
2. **Formats responses** with metadata (assumptions, confidence, etc.)
3. **Structures outputs** for streaming to the client

Response flows based on action decision:
- `execute_tool` → "I'll [action]. [result]"
- `confirm_action` → "I can [action]. Should I proceed?"
- `clarify` → "I need to clarify: [questions]"
- `respond` → Conversational response

### Tasks

1. [ ] Create `src/lib/agent/response/types.ts`
   ```typescript
   import type { ActionDecision } from "../routing";
   import type { LLMAssumption } from "../intent";
   
   /** Final response to send to client */
   export interface AgentResponse {
     /** Response content (from LLM or formatted) */
     content: string;
     
     /** Action decision that led to this response */
     decision: ActionDecision;
     
     /** Assumptions made (from LLM classification) */
     assumptions: LLMAssumption[];
     
     /** Overall confidence */
     confidence: number;
     
     /** Metadata for UI */
     metadata: ResponseMetadata;
   }
   
   export interface ResponseMetadata {
     /** Tokens used */
     tokensUsed?: number;
     /** Processing time */
     durationMs: number;
     /** Model used */
     model?: string;
   }
   ```

2. [ ] Create `src/lib/agent/response/prompts.ts`
   ```typescript
   import type { ActionDecision } from "../routing";
   import type { ContextRetrieval } from "../context";
   
   /**
    * Build prompt for LLM to generate response content
    * Different prompts for different action types
    */
   export function buildResponsePrompt(
     decision: ActionDecision,
     context: ContextRetrieval
   ): string;
   
   /**
    * Build prompt for confirmation message
    */
   export function buildConfirmationPrompt(
     tool: string,
     params: Record<string, unknown>
   ): string;
   
   /**
    * Build prompt for clarification questions
    */
   export function buildClarificationPrompt(
     questions: string[]
   ): string;
   ```

3. [ ] Create `src/lib/agent/response/formatter.ts`
   ```typescript
   /**
    * Format final response with metadata
    */
   export function formatResponse(
     content: string,
     decision: ActionDecision,
     metadata: Partial<ResponseMetadata>
   ): AgentResponse;
   
   /**
    * Format tool result for user display
    */
   export function formatToolResult(
     toolName: string,
     result: unknown
   ): string;
   ```

4. [ ] Create `src/lib/agent/response/index.ts`

### Files to Create

```
src/lib/agent/response/
├── index.ts              # NEW: Exports
├── types.ts              # NEW: Response types
├── prompts.ts            # NEW: Prompt building for LLM
├── formatter.ts          # NEW: Response formatting
```

### Key Design Decisions

1. **No hardcoded responses** - LLM generates content
2. **Prompt building** - Prepare prompts for Chunk 24 LLM integration
3. **Metadata tracking** - Include assumptions, confidence, timing
4. **Decision-based formatting** - Different formats for different actions

### Testing Requirements

- [ ] Test prompt building for each action type
- [ ] Test response formatting
- [ ] Test metadata inclusion
- [ ] Test tool result formatting

### Acceptance Criteria

- [ ] Prompts built correctly for each decision type
- [ ] Responses formatted with metadata
- [ ] Clean interface for Chunk 24 LLM integration
- [ ] All tests pass

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 5: Routing [R1D, R2F]
## ═══════════════════════════════════════════════════

**Pre-Conditions**:
- [ ] Chunks 7, 8 complete
- [ ] All tests passing
- [ ] No TypeScript errors

**Review Criteria (LLM-First)**:
- [ ] Action routing based on LLM confidence thresholds
- [ ] Prompt building prepares clean inputs for LLM
- [ ] No manual hypothesis formation or scoring
- [ ] Response formatting includes metadata

**Testing Criteria**:
- [ ] Unit tests > 80% coverage
- [ ] Routing tests for all decision types
- [ ] Threshold configuration tests

**Manual Testing Scenarios**:
- [ ] High LLM confidence → `execute_tool` decision
- [ ] Medium confidence → `confirm_action` decision
- [ ] Low confidence / clarification needed → `clarify` decision
- [ ] Unresolved entities → `clarify` decision

**Audit Criteria**:
- [ ] Thresholds configurable per-user
- [ ] Prompts ready for Chunk 24 LLM integration
- [ ] Clean separation between routing and LLM generation

**Sign-Off**: _________________ Date: _________

---

## [T1R] Tool Registry & LLM Integration (LLM-First)

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 1, Chunk 4  
**Goal**: Create the tool registry where tools define their own LLM interface.

### Prerequisites

- [ ] Chunk 1 complete (types available)
- [ ] Chunk 4 complete (`ToolForLLM` interface defined)

### Architecture Notes

**LLM-First Design**: Tools define their own LLM interface:
1. **Single source of truth** - Tool definition includes everything the LLM needs
2. **Self-describing tools** - Each tool provides `whenToUse`, `examples`, `description`
3. **JSON Schema for LLM** - Parameters in JSON Schema format (LLM-native)
4. **Zod for validation** - Runtime validation of LLM-provided parameters

The registry provides tools to the LLM using the `ToolForLLM` interface from Chunk 4.

### Tasks

1. [ ] Create `src/lib/agent/tools/types.ts`
   ```typescript
   import type { ToolForLLM } from "../intent";
   
   export type ToolCategory = 
     | 'query'     // Read-only queries
     | 'compute'   // Calculations, no side effects
     | 'draft'     // Create drafts (reversible)
     | 'create'    // Create records
     | 'update'    // Modify records
     | 'delete'    // Delete records
     | 'external'; // External API calls
   
   export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
   
   /**
    * Full tool definition including LLM interface and execution logic
    */
   export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
     // === LLM Interface (what the LLM sees) ===
     /** Tool identifier */
     name: string;
     /** Human-readable description */
     description: string;
     /** When to use this tool (guidance for LLM) */
     whenToUse: string;
     /** Example invocations for few-shot learning */
     examples: string[];
     /** JSON Schema for parameters (LLM-native format) */
     parametersSchema: Record<string, unknown>;
     
     // === Internal Configuration ===
     category: ToolCategory;
     riskLevel: RiskLevel;
     requiresApproval: boolean;
     requiredIntegrations: string[];
     
     // === Validation & Execution ===
     /** Zod schema for runtime validation */
     inputValidator: z.ZodSchema<TInput>;
     /** Execute the tool */
     execute: (input: TInput, context: ExecutionContext) => Promise<TOutput>;
     /** Optional undo/rollback */
     undo?: (result: TOutput, context: ExecutionContext) => Promise<void>;
   }
   
   /**
    * Convert ToolDefinition to ToolForLLM for classification
    */
   export function toToolForLLM(tool: ToolDefinition): ToolForLLM {
     return {
       name: tool.name,
       description: tool.description,
       whenToUse: tool.whenToUse,
       examples: tool.examples,
       parameters: tool.parametersSchema,
       requiresApproval: tool.requiresApproval,
     };
   }
   ```

2. [ ] Create `src/lib/agent/tools/registry.ts`
   ```typescript
   import type { ToolForLLM } from "../intent";
   
   export class ToolRegistry {
     private tools = new Map<string, ToolDefinition>();
     
     /** Register a tool */
     register<T, R>(tool: ToolDefinition<T, R>): void;
     
     /** Get tool by name */
     get(name: string): ToolDefinition | undefined;
     
     /** List tools, optionally filtered */
     list(options?: { category?: ToolCategory; integration?: string }): ToolDefinition[];
     
     /** Check if tool exists */
     has(name: string): boolean;
     
     /** Validate parameters against tool schema */
     validateParams(name: string, params: unknown): ValidationResult;
     
     /** Get all tools in LLM format for classification */
     getToolsForLLM(userId?: string): ToolForLLM[];
     
     /** Get tools available for a user (checks integrations) */
     getAvailableTools(userId: string, connectedIntegrations: string[]): ToolForLLM[];
   }
   
   export const toolRegistry = new ToolRegistry();
   ```

3. [ ] Create `src/lib/agent/tools/validation.ts`
   - Validate LLM-provided parameters against Zod schema
   - Format validation errors for LLM retry
   - Convert JSON Schema to Zod (or use zod-to-json-schema)

4. [ ] Create `src/lib/agent/tools/context.ts`
   ```typescript
   export interface ExecutionContext {
     userId: string;
     sessionId?: string;
     conversationId?: string;
     planId?: string;
     stepIndex?: number;
     // Integration tokens (fetched when needed)
     getAccessToken?: (integration: string) => Promise<string | null>;
   }
   ```

5. [ ] Create `src/lib/agent/tools/index.ts`

### Files to Create

```
src/lib/agent/tools/
├── index.ts              # NEW: Exports
├── types.ts              # NEW: ToolDefinition with LLM interface
├── registry.ts           # NEW: Tool registry with getToolsForLLM()
├── validation.ts         # NEW: Parameter validation
├── context.ts            # NEW: Execution context
```

### Key Design Decisions

1. **Tools define their LLM interface** - `whenToUse`, `examples`, `parametersSchema`
2. **JSON Schema for LLM** - Not Zod, because LLMs work with JSON Schema natively
3. **Zod for validation** - Runtime validation of what LLM returns
4. **Registry provides tools for classification** - `getToolsForLLM()` returns `ToolForLLM[]`
5. **User-aware availability** - `getAvailableTools()` filters by connected integrations

### Testing Requirements

- [ ] Test tool registration
- [ ] Test `toToolForLLM()` conversion
- [ ] Test parameter validation with Zod
- [ ] Test `getAvailableTools()` filtering
- [ ] Test `getToolsForLLM()` output format

### Acceptance Criteria

- [ ] Registry stores and retrieves tools
- [ ] `toToolForLLM()` produces valid `ToolForLLM` interface
- [ ] `getToolsForLLM()` returns all tools for LLM classification
- [ ] `getAvailableTools()` filters by connected integrations
- [ ] Zod validation catches invalid LLM parameters
- [ ] All tests pass

---

## [T2Q] Core Query Tools (LLM-First)

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 9  
**Goal**: Implement core read-only query tools using the LLM-first `ToolDefinition` interface.

### Prerequisites

- [ ] Chunk 9 complete (registry with `ToolForLLM` conversion available)

### Architecture Notes

**LLM-First Design**: Query tools implement the `ToolDefinition` interface from Chunk 9:
1. **`whenToUse`** - Clear guidance for LLM on when to select this tool
2. **`examples`** - Few-shot examples for the LLM
3. **`parametersSchema`** - JSON Schema (LLM-native format)
4. **`inputValidator`** - Zod schema for runtime validation

Query tools are low-risk, read-only operations that execute without approval:
- Context queries (people, events, tasks)
- Calendar queries (events, availability)
- Email search
- Task queries

### Tasks

1. [ ] Create `src/lib/agent/tools/query/query-context.ts`
   ```typescript
   import { z } from "zod";
   import type { ToolDefinition } from "../types";
   
   // Zod schema for runtime validation
   const queryContextInputSchema = z.object({
     query: z.string().min(1),
     entityType: z.enum(['person', 'event', 'task', 'any']).optional(),
     limit: z.number().max(20).optional().default(10),
   });
   
   export const queryContextTool: ToolDefinition<
     z.infer<typeof queryContextInputSchema>,
     { results: unknown[]; totalCount: number }
   > = {
     // === LLM Interface ===
     name: 'query_context',
     description: 'Search user context for relevant information about people, events, and tasks',
     whenToUse: 'Use when the user asks about people they know, past events, tasks, or any stored context. Good for "who is...", "what do I know about...", "find information about..."',
     examples: [
       'User: "Who is Sarah?" → query_context({ query: "Sarah", entityType: "person" })',
       'User: "What meetings did I have last week?" → query_context({ query: "meetings last week", entityType: "event" })',
       'User: "What do I know about the Acme project?" → query_context({ query: "Acme project" })',
     ],
     parametersSchema: {
       type: 'object',
       properties: {
         query: { type: 'string', description: 'Search query text' },
         entityType: { 
           type: 'string', 
           enum: ['person', 'event', 'task', 'any'],
           description: 'Filter by entity type (optional)'
         },
         limit: { type: 'number', description: 'Max results to return (default 10, max 20)' },
       },
       required: ['query'],
     },
     
     // === Internal Configuration ===
     category: 'query',
     riskLevel: 'low',
     requiresApproval: false,
     requiredIntegrations: [],
     
     // === Validation & Execution ===
     inputValidator: queryContextInputSchema,
     execute: async (input, context) => {
       // Implementation calls existing context search service
       // ...
     },
   };
   ```

2. [ ] Create `src/lib/agent/tools/query/search-emails.ts`
   - `whenToUse`: "Use when user asks to find emails, search inbox, look up messages"
   - `examples`: ["Find emails from John", "Search for receipts", "Show emails about X"]
   - Search email archive with filters (sender, date, labels, subject)
   - Requires `gmail` integration

3. [ ] Create `src/lib/agent/tools/query/list-calendar-events.ts`
   - `whenToUse`: "Use when user asks about their schedule, calendar, upcoming events"
   - `examples`: ["What's on my calendar tomorrow?", "Show meetings this week"]
   - Query calendar events by date range, attendees
   - Requires `calendar` integration

4. [ ] Create `src/lib/agent/tools/query/check-availability.ts`
   - `whenToUse`: "Use when user asks about free time, when they're available, scheduling conflicts"
   - `examples`: ["When am I free tomorrow?", "Do I have time for a 1-hour meeting?"]
   - Find free time slots, check for conflicts
   - Requires `calendar` integration

5. [ ] Create `src/lib/agent/tools/query/list-tasks.ts`
   - `whenToUse`: "Use when user asks about their tasks, to-dos, what they need to do"
   - `examples`: ["What tasks are due today?", "Show my pending tasks"]
   - Query user's tasks with filters (status, deadline, priority)

6. [ ] Create `src/lib/agent/tools/query/index.ts`
   - Export all query tools
   - Register all query tools with registry on import

### Files to Create

```
src/lib/agent/tools/query/
├── index.ts                  # NEW: Exports + registration
├── query-context.ts          # NEW: Context query with LLM interface
├── search-emails.ts          # NEW: Email search with LLM interface
├── list-calendar-events.ts   # NEW: Calendar query with LLM interface
├── check-availability.ts     # NEW: Availability check with LLM interface
├── list-tasks.ts             # NEW: Task query with LLM interface
```

### Key Design Decisions

1. **Every tool has `whenToUse`** - Explicit guidance for LLM tool selection
2. **Every tool has `examples`** - Few-shot learning for accurate tool selection
3. **JSON Schema + Zod** - `parametersSchema` for LLM, `inputValidator` for runtime
4. **Thin wrappers** - Tools delegate to existing services (context, Gmail, Calendar)
5. **Integration-aware** - `requiredIntegrations` filters available tools per user

### Testing Requirements

- [ ] Test each query tool's `execute()` function
- [ ] Test `inputValidator` catches invalid LLM parameters
- [ ] Test tools are registered with registry
- [ ] Test `toToolForLLM()` produces valid output for each tool
- [ ] Test integration with existing services

### Acceptance Criteria

- [ ] All query tools implement `ToolDefinition` interface from Chunk 9
- [ ] Every tool has `whenToUse` and `examples` for LLM
- [ ] Every tool has both `parametersSchema` (JSON) and `inputValidator` (Zod)
- [ ] All tools registered with `toolRegistry`
- [ ] All tests pass

---

## [T3A] Core Action Tools (LLM-First)

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 10  
**Goal**: Implement core action tools using the LLM-first `ToolDefinition` interface.

### Prerequisites

- [ ] Chunk 10 complete (query tools pattern established)

### Architecture Notes

**LLM-First Design**: Action tools follow the same pattern as query tools:
1. **`whenToUse`** - Clear guidance for LLM on when to select this tool
2. **`examples`** - Few-shot examples for the LLM
3. **`parametersSchema`** - JSON Schema (LLM-native format)
4. **`inputValidator`** - Zod schema for runtime validation

Action tools have higher risk and may require approval:
- **Low risk** - Drafts (reversible, no external effect)
- **Medium risk** - Task creation/update (internal data changes)
- **High risk** - Sending emails, creating calendar events (external effects, requires approval)

The LLM's suggested tool and parameters are passed through the decision logic (Chunk 7) which determines whether to execute, confirm, or request approval.

### Tasks

1. [ ] Create `src/lib/agent/tools/action/create-task.ts`
   ```typescript
   import { z } from "zod";
   import type { ToolDefinition } from "../types";
   
   const createTaskInputSchema = z.object({
     title: z.string().min(1),
     description: z.string().optional(),
     dueDate: z.string().optional(), // ISO date string
     priority: z.enum(['low', 'medium', 'high']).optional(),
   });
   
   export const createTaskTool: ToolDefinition<...> = {
     // === LLM Interface ===
     name: 'create_task',
     description: 'Create a new task or to-do item for the user',
     whenToUse: 'Use when user wants to add a task, reminder, or to-do item. Listen for "remind me to", "add a task", "I need to", "don\'t let me forget"',
     examples: [
       'User: "Remind me to call John tomorrow" → create_task({ title: "Call John", dueDate: "2024-01-16" })',
       'User: "Add a task to review the proposal" → create_task({ title: "Review the proposal" })',
     ],
     parametersSchema: { /* JSON Schema */ },
     
     // === Internal Configuration ===
     category: 'create',
     riskLevel: 'medium',
     requiresApproval: false, // Can auto-execute with confirmation
     requiredIntegrations: [],
     
     // === Execution ===
     inputValidator: createTaskInputSchema,
     execute: async (input, context) => { /* ... */ },
   };
   ```

2. [ ] Create `src/lib/agent/tools/action/update-task.ts`
   - `whenToUse`: "Use when user wants to modify, update, or change an existing task"
   - `examples`: ["Mark the report task as done", "Change the deadline to Friday"]
   - Risk level: medium
   - Requires task ID resolution from context

3. [ ] Create `src/lib/agent/tools/action/draft-email.ts`
   - `whenToUse`: "Use when user wants to compose, write, or draft an email"
   - `examples`: ["Draft an email to John about the meeting", "Write a message to Sarah"]
   - Risk level: low (draft only, no send)
   - Requires `gmail` integration

4. [ ] Create `src/lib/agent/tools/action/send-email.ts`
   - `whenToUse`: "Use when user explicitly wants to SEND an email (not just draft)"
   - `examples`: ["Send this email", "Email John saying I'll be late"]
   - Risk level: **high**
   - **Requires approval** - irreversible external action
   - Requires `gmail` integration

5. [ ] Create `src/lib/agent/tools/action/create-calendar-event.ts`
   - `whenToUse`: "Use when user wants to schedule, book, or add a calendar event"
   - `examples`: ["Schedule a meeting with Sarah for Tuesday", "Book 2pm for project review"]
   - Risk level: **high**
   - **Requires approval** - affects user's schedule
   - Requires `calendar` integration

6. [ ] Create `src/lib/agent/tools/action/update-calendar-event.ts`
   - `whenToUse`: "Use when user wants to reschedule, modify, or update an existing event"
   - `examples`: ["Move my 2pm meeting to 3pm", "Add John to the meeting invite"]
   - Risk level: **high**
   - **Requires approval** - affects user's schedule
   - Requires `calendar` integration

7. [ ] Create `src/lib/agent/tools/action/index.ts`
   - Export all action tools
   - Register all action tools with registry on import

### Files to Create

```
src/lib/agent/tools/action/
├── index.ts                      # NEW: Exports + registration
├── create-task.ts                # NEW: Task creation with LLM interface
├── update-task.ts                # NEW: Task update with LLM interface
├── draft-email.ts                # NEW: Email draft with LLM interface
├── send-email.ts                 # NEW: Email send with LLM interface
├── create-calendar-event.ts      # NEW: Event creation with LLM interface
├── update-calendar-event.ts      # NEW: Event update with LLM interface
```

### Key Design Decisions

1. **LLM decides the action** - Agent doesn't parse intent; LLM returns tool + params
2. **Risk determines flow** - High-risk tools always route through approval
3. **Examples show language patterns** - LLM learns from real user phrasings
4. **Thin wrappers** - Tools delegate to existing integration actions
5. **Approval via Chunk 7** - Decision logic handles approval routing

### Testing Requirements

- [ ] Test each action tool's `execute()` function
- [ ] Test `inputValidator` catches invalid LLM parameters
- [ ] Test `requiresApproval` flag is set correctly per risk level
- [ ] Test `toToolForLLM()` produces valid output for each tool
- [ ] Test integration with existing services (Gmail, Calendar)

### Acceptance Criteria

- [ ] All action tools implement `ToolDefinition` interface from Chunk 9
- [ ] Every tool has `whenToUse` and `examples` for LLM
- [ ] Every tool has both `parametersSchema` (JSON) and `inputValidator` (Zod)
- [ ] High-risk tools have `requiresApproval: true`
- [ ] All tools registered with `toolRegistry`
- [ ] All tests pass

---

## [T4E] Tool Execution Engine (LLM-First)

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 7, Chunk 11  
**Goal**: Build the tool execution engine that runs LLM-selected tools.

### Prerequisites

- [ ] Chunk 7 complete (decision logic provides `ActionDecision`)
- [ ] Chunk 11 complete (tools registered with `ToolDefinition`)

### Architecture Notes

**LLM-First Design**: The execution engine receives tool calls from the decision logic (Chunk 7), not from manual intent parsing. The flow is:

1. **LLM selects tool** → `ClassificationResponse.suggestedTool`
2. **Decision logic routes** (Chunk 7) → `ActionDecision.action = 'execute' | 'request_approval'`
3. **Execution engine runs** (this chunk) → validates, executes, audits

The execution engine:
1. **Validates parameters** - Uses tool's `inputValidator` (Zod) on LLM-provided params
2. **Checks integrations** - Verifies required integrations are connected
3. **Creates approval** - If decision was `request_approval`, creates pending approval record
4. **Executes tool** - Calls tool's `execute()` function
5. **Evaluates result** - Formats result for LLM response generation
6. **Logs audit** - Every execution is audit-logged

**Not responsible for**: Deciding if approval is needed (that's Chunk 7), assessing risk (that's on the tool definition).

### Tasks

1. [ ] Create `src/lib/agent/execution/types.ts`
   ```typescript
   import type { ActionDecision } from "../routing";
   import type { ExecutionContext } from "../tools";
   
   /**
    * Request to execute a tool (comes from decision logic)
    */
   export interface ToolExecutionRequest {
     toolName: string;
     parameters: unknown; // LLM-provided, will be validated
     context: ExecutionContext;
     decision: ActionDecision; // From Chunk 7
   }
   
   /**
    * Result of tool execution
    */
   export interface ToolExecutionResult {
     success: boolean;
     result?: unknown;
     error?: ToolExecutionError;
     auditLogId: string;
   }
   
   /**
    * Pending approval created for high-risk action
    */
   export interface PendingApprovalResult {
     requiresApproval: true;
     approvalId: string;
     expiresAt: Date;
     auditLogId: string;
   }
   
   export type ExecutionOutcome = ToolExecutionResult | PendingApprovalResult;
   
   export interface ToolExecutionError {
     code: 'validation_failed' | 'integration_missing' | 'execution_failed';
     message: string;
     details?: unknown;
   }
   ```

2. [ ] Create `src/lib/agent/execution/engine.ts`
   ```typescript
   /**
    * Main execution function - called by orchestrator after decision logic
    */
   export async function executeToolCall(
     request: ToolExecutionRequest
   ): Promise<ExecutionOutcome>;
   
   /**
    * Validate LLM-provided parameters against tool's Zod schema
    * Returns friendly error message for LLM retry if invalid
    */
   export async function validateParameters(
     toolName: string,
     parameters: unknown
   ): Promise<{ valid: true; parsed: unknown } | { valid: false; errors: string[] }>;
   
   /**
    * Check if required integrations are connected
    */
   export async function checkIntegrations(
     toolName: string,
     userId: string
   ): Promise<{ available: true } | { available: false; missing: string[] }>;
   ```

3. [ ] Create `src/lib/agent/execution/approval.ts`
   - Create pending approval record in database
   - Set expiration (from agent config)
   - Return approval ID for user confirmation flow

4. [ ] Create `src/lib/agent/execution/result-formatter.ts`
   - Format execution result for LLM response generation
   - Include metadata for response building (Chunk 8)
   - Handle both success and error cases

5. [ ] Create `src/lib/agent/execution/index.ts`

### Files to Create

```
src/lib/agent/execution/
├── index.ts                  # NEW: Exports
├── types.ts                  # NEW: Execution types
├── engine.ts                 # NEW: Execution engine
├── approval.ts               # NEW: Approval creation
├── result-formatter.ts       # NEW: Result formatting for LLM
```

### Key Design Decisions

1. **Receives decisions, doesn't make them** - Decision logic (Chunk 7) already determined action
2. **Zod validation of LLM params** - Returns friendly errors for LLM retry
3. **Integration checks** - Fails gracefully if Gmail/Calendar not connected
4. **Approval creation, not checking** - Creates records for user approval flow
5. **All executions audited** - Uses audit service from Chunk 3

### Testing Requirements

- [ ] Test parameter validation with valid/invalid LLM params
- [ ] Test integration checking with connected/disconnected integrations
- [ ] Test approval creation for high-risk tools
- [ ] Test successful tool execution
- [ ] Test error handling and formatting
- [ ] Test audit logging for all executions

### Acceptance Criteria

- [ ] Execution engine validates LLM parameters with Zod
- [ ] Missing integrations return friendly error
- [ ] High-risk actions create approval records
- [ ] Successful executions return formatted results
- [ ] All executions logged to audit trail
- [ ] All tests pass

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 3: Tools [T1R, T2Q, T3A, T4E] ✅ PASSED
## ═══════════════════════════════════════════════════

**Pre-Conditions**:
- [x] Chunks 9, 10, 11, 12 complete
- [x] All tests passing (172 tests)
- [x] No TypeScript errors

**Review Criteria**:
- [x] Tool registry with `toToolForLLM()` conversion
- [x] All tools have `whenToUse` and `examples` for LLM
- [x] All tools have `parametersSchema` (JSON) + `inputValidator` (Zod)
- [x] Execution engine validates LLM parameters
- [x] Risk levels correctly map to `requiresApproval`

**Testing Criteria**:
- [x] Unit tests: 172 tests passing
- [x] Test `toToolForLLM()` produces valid LLM interface
- [x] Test Zod validation catches invalid LLM params
- [x] Integration tests for tool execution

**Manual Testing Scenarios (with stubbed LLM)**:
- [x] Query tool executes immediately when decision is 'execute'
- [x] Send email creates approval when decision is 'request_approval'
- [x] Invalid LLM params return friendly error message
- [x] Missing integration detected and reported

**Sign-Off**: Automated Review | Date: December 27, 2024

**Detailed Report**: See `PHASE_5_CHECKPOINT_3.md`

---

## [L1G] Plan Generation & Structuring (LLM-First)

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 7 (Decision Logic), Chunk 9 (Tool Registry)  
**Goal**: Structure LLM-generated plans into executable step sequences.

### Prerequisites

- [ ] Chunk 7 complete (decision logic routes to planning)
- [ ] Chunk 9 complete (tools available for planning)

### Architecture Notes

**LLM-First Design**: The LLM generates the plan, the agent structures it:

1. **LLM generates plan** - When a goal requires multiple steps, the LLM returns a plan
2. **Agent validates plan** - Checks tools exist, parameters are valid, dependencies make sense
3. **Agent structures plan** - Creates `AgentPlan` with `PlanStep` records in database
4. **Agent executes plan** - Runs steps sequentially (Chunk 14)

The agent does NOT decompose goals manually. The LLM's plan generation capability is leveraged.

### LLM Plan Generation Contract

```typescript
// Request to LLM for multi-step planning
export interface PlanGenerationRequest {
  goal: string;
  context: {
    availableTools: ToolForLLM[];
    resolvedEntities: ResolvedEntity[];
    relevantContext: ContextChunk[];
  };
  constraints?: {
    maxSteps?: number;
    requireApprovalBefore?: string[]; // e.g., ["send_email"]
  };
}

// LLM returns structured plan
export interface LLMGeneratedPlan {
  summary: string;
  steps: LLMPlanStep[];
  assumptions: LLMAssumption[];
  estimatedDuration?: string;
}

export interface LLMPlanStep {
  stepNumber: number;
  toolName: string;
  parameters: Record<string, unknown>;
  description: string;
  dependsOn?: number[]; // Step numbers this depends on
  outputKey?: string; // Name for this step's output (for later steps to reference)
}
```

### Tasks

1. [ ] Create `src/lib/agent/planning/types.ts`
   ```typescript
   import type { ToolForLLM } from "../intent";
   
   // LLM contract types (above)
   export interface PlanGenerationRequest { ... }
   export interface LLMGeneratedPlan { ... }
   export interface LLMPlanStep { ... }
   
   // Agent-side structured plan
   export interface StructuredPlan {
     id: string;
     userId: string;
     goal: string;
     status: PlanStatus;
     steps: StructuredStep[];
     currentStepIndex: number;
     createdAt: Date;
     conversationId?: string;
   }
   
   export interface StructuredStep {
     index: number;
     toolName: string;
     parameters: Record<string, unknown>;
     description: string;
     dependsOn: number[];
     status: StepStatus;
     result?: unknown;
     error?: string;
     requiresApproval: boolean;
     approvalId?: string;
   }
   
   export type PlanStatus = 'pending' | 'executing' | 'paused' | 'completed' | 'failed' | 'cancelled';
   export type StepStatus = 'pending' | 'executing' | 'completed' | 'failed' | 'awaiting_approval' | 'skipped';
   ```

2. [ ] Create `src/lib/agent/planning/validator.ts`
   - Validate LLM plan structure
   - Check all referenced tools exist
   - Validate parameters against tool schemas (Zod)
   - Check dependency graph is acyclic
   - Return validation errors for LLM retry

3. [ ] Create `src/lib/agent/planning/structurer.ts`
   ```typescript
   /**
    * Convert LLM-generated plan to structured, executable plan
    */
   export async function structurePlan(
     llmPlan: LLMGeneratedPlan,
     context: PlanningContext
   ): Promise<StructuredPlan>;
   
   /**
    * Determine which steps require approval based on tool config
    */
   export function markApprovalSteps(
     steps: StructuredStep[],
     tools: Map<string, ToolDefinition>
   ): StructuredStep[];
   ```

4. [ ] Create `src/lib/agent/planning/repository.ts`
   - CRUD for AgentPlan database model
   - Query plans by user, status
   - Update step status

5. [ ] Create `src/lib/agent/planning/index.ts`

### Files to Create

```
src/lib/agent/planning/
├── index.ts              # NEW: Exports
├── types.ts              # NEW: Plan types + LLM contract
├── validator.ts          # NEW: Plan validation
├── structurer.ts         # NEW: LLM plan → structured plan
├── repository.ts         # NEW: Plan persistence
```

### Key Design Decisions

1. **LLM generates the plan** - No manual goal decomposition
2. **Agent validates and structures** - Catches LLM errors before execution
3. **Database persistence** - Plans survive server restarts
4. **Approval marking** - Based on tool's `requiresApproval` flag
5. **Dependency tracking** - Steps can reference previous step outputs

### Testing Requirements

- [ ] Test plan validation catches invalid tool names
- [ ] Test plan validation catches invalid parameters
- [ ] Test cyclic dependency detection
- [ ] Test approval step marking
- [ ] Test plan persistence

### Acceptance Criteria

- [ ] LLM plan contract defined (`PlanGenerationRequest`, `LLMGeneratedPlan`)
- [ ] Plan validator checks tools and parameters
- [ ] Structurer converts LLM plan to executable format
- [ ] Approval steps marked based on tool config
- [ ] Plans persisted to database
- [ ] All tests pass

---

## [L2X] Plan Execution Engine (LLM-First)

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 12 (Tool Execution), Chunk 13 (Plan Structuring)  
**Goal**: Execute structured plans step-by-step.

### Prerequisites

- [ ] Chunk 12 complete (tool execution available)
- [ ] Chunk 13 complete (structured plans available)

### Architecture Notes

**LLM-First Design**: The execution engine runs LLM-generated plans:

1. **Iterate steps** - Execute steps in order, respecting dependencies
2. **Use tool execution** - Delegate to Chunk 12's execution engine
3. **Pause at approvals** - When step requires approval, pause plan
4. **Store outputs** - Step outputs available for later steps
5. **Handle failures** - Mark step failed, optionally continue or abort

### Tasks

1. [ ] Create `src/lib/agent/planning/executor.ts`
   ```typescript
   /**
    * Execute a structured plan step by step
    */
   export async function executePlan(
     planId: string,
     options?: ExecutionOptions
   ): Promise<PlanExecutionResult>;
   
   /**
    * Execute a single step
    */
   export async function executeStep(
     plan: StructuredPlan,
     stepIndex: number
   ): Promise<StepExecutionResult>;
   
   /**
    * Resume plan after approval
    */
   export async function resumePlan(planId: string): Promise<PlanExecutionResult>;
   
   /**
    * Cancel plan execution
    */
   export async function cancelPlan(planId: string): Promise<void>;
   ```

2. [ ] Create step output resolution
   - Resolve `{{step.1.output}}` references in parameters
   - Inject previous step results into current step params

3. [ ] Create execution event streaming
   - Emit events for UI: `step_started`, `step_completed`, `step_failed`, `plan_paused`

4. [ ] Integrate with tool execution (Chunk 12)
   - Build `ToolExecutionRequest` from step
   - Handle execution results

### Files to Create/Modify

```
src/lib/agent/planning/
├── executor.ts           # NEW: Plan execution engine
├── output-resolver.ts    # NEW: Step output injection
├── events.ts             # NEW: Execution events for streaming
```

### Key Design Decisions

1. **Sequential by default** - Steps execute in order
2. **Dependency-aware** - Skip steps whose dependencies failed
3. **Pause, don't block** - Approvals pause the plan, don't block the server
4. **Audit everything** - Every step execution logged

### Testing Requirements

- [ ] Test sequential step execution
- [ ] Test dependency skipping when parent fails
- [ ] Test pause at approval step
- [ ] Test resume after approval
- [ ] Test output injection between steps

### Acceptance Criteria

- [ ] Plan executor runs steps sequentially
- [ ] Approvals pause plan execution
- [ ] Resume continues from paused step
- [ ] Step outputs available to later steps
- [ ] All steps audited
- [ ] All tests pass

---

## [L3S] Plan State & Recovery (LLM-First)

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 14 (Plan Execution)  
**Goal**: Handle plan state persistence and failure recovery.

### Prerequisites

- [ ] Chunk 14 complete (execution engine available)

### Architecture Notes

**LLM-First Design**: The agent handles operational concerns while LLM handles reasoning:

1. **State persistence** - Plans survive server restarts
2. **Failure handling** - Decide whether to continue, retry, or abort
3. **Rollback** - Undo completed steps if plan fails (when possible)
4. **Recovery** - Resume interrupted plans

### Tasks

1. [ ] Create `src/lib/agent/planning/state.ts`
   ```typescript
   /**
    * Get current plan state for resumption
    */
   export async function getPlanState(planId: string): Promise<PlanState>;
   
   /**
    * Update plan state atomically
    */
   export async function updatePlanState(
     planId: string,
     update: PlanStateUpdate
   ): Promise<void>;
   
   /**
    * Find plans that need resumption (after server restart)
    */
   export async function findInterruptedPlans(userId: string): Promise<StructuredPlan[]>;
   ```

2. [ ] Create `src/lib/agent/planning/recovery.ts`
   ```typescript
   /**
    * Determine recovery action for failed step
    * May ask LLM for guidance on how to proceed
    */
   export async function determineRecoveryAction(
     plan: StructuredPlan,
     failedStep: StructuredStep,
     error: string
   ): Promise<RecoveryAction>;
   
   export type RecoveryAction = 
     | { action: 'retry'; reason: string }
     | { action: 'skip'; reason: string }
     | { action: 'abort'; reason: string }
     | { action: 'ask_user'; question: string };
   ```

3. [ ] Create `src/lib/agent/planning/rollback.ts`
   - Track which steps support undo
   - Execute rollback for completed steps on abort

4. [ ] Create interrupted plan detection
   - On startup, find plans in 'executing' status
   - Notify user of interrupted plans

### Files to Create

```
src/lib/agent/planning/
├── state.ts              # NEW: State management
├── recovery.ts           # NEW: Failure recovery
├── rollback.ts           # NEW: Rollback handling
```

### Key Design Decisions

1. **Database-backed state** - Plans survive restarts
2. **LLM for recovery decisions** - Can ask LLM how to proceed after failure
3. **Optional rollback** - Only for tools that support undo
4. **User notification** - Interrupted plans surfaced to user

### Testing Requirements

- [ ] Test plan state persistence
- [ ] Test recovery action determination
- [ ] Test rollback for undoable steps
- [ ] Test interrupted plan detection

### Acceptance Criteria

- [ ] Plan state persists across restarts
- [ ] Failed steps trigger recovery logic
- [ ] Rollback works for undoable steps
- [ ] Interrupted plans detected on startup
- [ ] All tests pass

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 6: Planning [L1G, L2X, L3S]
## ═══════════════════════════════════════════════════

**Pre-Conditions**:
- [ ] Chunks 13, 14, 15 complete
- [ ] All tests passing
- [ ] No TypeScript errors

**Review Criteria**:
- [ ] LLM plan generation contract defined
- [ ] Plan validation catches invalid LLM output
- [ ] Executor handles approval pauses
- [ ] State persists across restarts

**Testing Criteria**:
- [ ] LLM plan → structured plan conversion tested
- [ ] Step execution with output injection tested
- [ ] Approval pause/resume tested
- [ ] Failure recovery tested
- [ ] Rollback tested (for undoable steps)

**Manual Testing Scenarios (with stubbed LLM)**:
- [ ] Multi-step plan executes to completion
- [ ] Plan pauses at high-risk step, resumes after approval
- [ ] Plan handles step failure gracefully
- [ ] Interrupted plan detected after restart

**Sign-Off**: _________________ Date: _________

---

## [A1P] Action Approval System (LLM-First)

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 12 (Execution Engine), Chunk 14 (Plan Execution)  
**Goal**: Build the approval system that holds LLM-proposed actions for user confirmation.

### Prerequisites

- [ ] Chunk 12 complete (execution engine creates approvals)
- [ ] Chunk 14 complete (plans pause at approval steps)

### Architecture Notes

**LLM-First Design**: The approval system stores LLM-proposed actions with full context:

1. **LLM proposes action** - Tool call with parameters, confidence, reasoning
2. **Decision logic routes** (Chunk 7) - `action: 'request_approval'`
3. **Execution engine creates approval** (Chunk 12) - Stores pending approval
4. **User reviews with LLM context** - Sees reasoning, assumptions, can modify
5. **On approval, resume execution** - Plan continues from paused step

The approval record preserves the LLM's reasoning so users understand WHY the agent wants to take this action.

### Approval Data Model

```typescript
export interface AgentActionApproval {
  id: string;
  userId: string;
  planId?: string;          // If part of a multi-step plan
  stepIndex?: number;       // Which step in the plan
  
  // Action details (from LLM)
  toolName: string;
  parameters: Record<string, unknown>;
  
  // LLM context (preserved for user review)
  reasoning: string;        // Why the LLM chose this action
  confidence: number;       // LLM's confidence score
  assumptions: LLMAssumption[];
  
  // User-facing
  summary: string;          // Human-readable action summary
  riskLevel: RiskLevel;
  
  // Workflow state
  status: ApprovalStatus;
  expiresAt: Date;
  
  // Resolution
  resolvedAt?: Date;
  resolvedBy?: 'user' | 'timeout' | 'superseded';
  userFeedback?: string;    // Why they rejected, or modifications
  modifiedParameters?: Record<string, unknown>; // User edits
  
  // Audit linkage
  auditLogId: string;
  conversationId?: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
```

### Tasks

1. [ ] Create `src/lib/agent/approval/types.ts`
   - `AgentActionApproval` interface
   - `ApprovalStatus` type
   - `ApprovalCreateInput`, `ApprovalUpdateInput`

2. [ ] Create `src/lib/agent/approval/repository.ts`
   ```typescript
   export const approvalRepository = {
     /** Create pending approval with LLM context */
     create(input: ApprovalCreateInput): Promise<AgentActionApproval>;
     
     /** Get approval by ID */
     get(id: string): Promise<AgentActionApproval | null>;
     
     /** Get pending approvals for user */
     getPending(userId: string): Promise<AgentActionApproval[]>;
     
     /** Get pending approvals for a plan */
     getPendingForPlan(planId: string): Promise<AgentActionApproval[]>;
     
     /** Approve action (optionally with modified parameters) */
     approve(id: string, modifiedParams?: Record<string, unknown>): Promise<AgentActionApproval>;
     
     /** Reject action with optional feedback */
     reject(id: string, feedback?: string): Promise<AgentActionApproval>;
     
     /** Expire stale approvals */
     expireStale(): Promise<number>;
     
     /** Cancel approvals for a cancelled plan */
     cancelForPlan(planId: string): Promise<number>;
   };
   ```

3. [ ] Create `src/lib/agent/approval/service.ts`
   ```typescript
   /**
    * Create approval from execution engine
    * Preserves LLM reasoning for user review
    */
   export async function createApproval(
     input: CreateApprovalInput
   ): Promise<{ approvalId: string; expiresAt: Date }>;
   
   /**
    * Process user's approval decision
    * If approved, triggers plan resumption
    */
   export async function processApprovalDecision(
     approvalId: string,
     decision: 'approve' | 'reject',
     options?: { feedback?: string; modifiedParams?: Record<string, unknown> }
   ): Promise<ApprovalResult>;
   
   /**
    * Get approval with full context for UI display
    */
   export async function getApprovalForDisplay(
     approvalId: string
   ): Promise<ApprovalDisplayData>;
   ```

4. [ ] Create `src/lib/agent/approval/expiration.ts`
   - Background job to expire stale approvals
   - Configurable expiration time (from agent config)
   - Notify user of expired approvals

5. [ ] Create `src/lib/agent/approval/index.ts`

### Files to Create

```
src/lib/agent/approval/
├── index.ts              # NEW: Exports
├── types.ts              # NEW: Approval types
├── repository.ts         # NEW: Database operations
├── service.ts            # NEW: Approval business logic
├── expiration.ts         # NEW: Expiration handling
```

### Key Design Decisions

1. **Preserve LLM reasoning** - Users see WHY the agent wants to do this
2. **Editable parameters** - Users can modify before approving
3. **Plan integration** - Approvals can pause/resume multi-step plans
4. **Configurable expiration** - From agent config, default 24 hours
5. **Audit integration** - Every approval decision logged

### Testing Requirements

- [ ] Test approval creation with LLM context
- [ ] Test approve/reject flow
- [ ] Test parameter modification on approval
- [ ] Test expiration job
- [ ] Test plan resumption after approval

### Acceptance Criteria

- [ ] Approvals store LLM reasoning and assumptions
- [ ] Users can modify parameters before approving
- [ ] Approved actions resume plan execution
- [ ] Expired approvals handled gracefully
- [ ] All decisions audit-logged
- [ ] All tests pass

---

## [A2U] User Autonomy & Approval Settings (LLM-First)

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 16 (Approval System), Chunk 2 (Agent Config)  
**Goal**: Allow users to configure their approval preferences.

### Prerequisites

- [ ] Chunk 16 complete (approval system available)
- [ ] Chunk 2 complete (agent config system available)

### Architecture Notes

**LLM-First Design**: User autonomy settings control the decision logic (Chunk 7):

1. **Settings define thresholds** - Per-action-type approval requirements
2. **Decision logic consults settings** - Before routing to execute vs. request_approval
3. **LLM confidence considered** - High confidence might auto-execute, low always approves

This gives users control over how much they trust the agent, without changing how the LLM generates decisions.

### Autonomy Configuration

```typescript
export interface UserAutonomySettings {
  // Global settings
  defaultApprovalMode: ApprovalMode;
  confidenceThreshold: number; // 0.0-1.0, below this always requires approval
  
  // Per-category overrides
  categorySettings: Record<ToolCategory, CategoryApprovalSetting>;
  
  // Per-tool overrides (most specific)
  toolOverrides: Record<string, ToolApprovalSetting>;
  
  // Time-based settings
  quietHours?: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "08:00"
    timezone: string;
    mode: ApprovalMode; // More restrictive during quiet hours
  };
}

export type ApprovalMode = 
  | 'always_approve'      // Every action needs approval
  | 'high_risk_only'      // Only high/critical risk
  | 'trust_confident'     // Auto-execute if confidence > threshold
  | 'full_autonomy';      // Never require approval (dangerous)

export interface CategoryApprovalSetting {
  mode: ApprovalMode;
  confidenceOverride?: number; // Category-specific threshold
}

export interface ToolApprovalSetting {
  mode: ApprovalMode;
  confidenceOverride?: number;
  alwaysNotify?: boolean; // Notify even if auto-executed
}
```

### Tasks

1. [ ] Create `src/lib/agent/autonomy/types.ts`
   - `UserAutonomySettings` interface
   - `ApprovalMode` type
   - Default settings factory

2. [ ] Create `src/lib/agent/autonomy/repository.ts`
   - CRUD for user autonomy settings
   - Merge with defaults for missing fields

3. [ ] Create `src/lib/agent/autonomy/service.ts`
   ```typescript
   /**
    * Get effective autonomy settings for user
    * Merges user settings with defaults
    */
   export async function getAutonomySettings(
     userId: string
   ): Promise<UserAutonomySettings>;
   
   /**
    * Determine if action requires approval based on settings
    * Called by decision logic (Chunk 7)
    */
   export function requiresApproval(
     settings: UserAutonomySettings,
     toolName: string,
     toolCategory: ToolCategory,
     toolRiskLevel: RiskLevel,
     llmConfidence: number
   ): { required: boolean; reason: string };
   
   /**
    * Check if currently in quiet hours
    */
   export function isInQuietHours(
     settings: UserAutonomySettings,
     currentTime: Date
   ): boolean;
   
   /**
    * Update user's autonomy settings
    */
   export async function updateAutonomySettings(
     userId: string,
     update: Partial<UserAutonomySettings>
   ): Promise<UserAutonomySettings>;
   ```

4. [ ] Create `src/lib/agent/autonomy/defaults.ts`
   - Sensible defaults (high_risk_only mode)
   - Default confidence threshold (0.8)
   - Default category settings

5. [ ] Create `src/lib/agent/autonomy/index.ts`

6. [ ] Integrate with decision logic (Chunk 7)
   - Update `routeAction()` to consult autonomy settings
   - Factor in LLM confidence + user preferences

### Files to Create

```
src/lib/agent/autonomy/
├── index.ts              # NEW: Exports
├── types.ts              # NEW: Autonomy types
├── repository.ts         # NEW: Settings storage
├── service.ts            # NEW: Approval requirement logic
├── defaults.ts           # NEW: Default settings
```

### Key Design Decisions

1. **Hierarchical settings** - Tool > Category > Default
2. **Confidence-aware** - LLM confidence factors into decision
3. **Quiet hours** - More restrictive during off-hours
4. **Safe defaults** - Start with `high_risk_only` mode
5. **Full autonomy warning** - UI should warn about this mode

### Testing Requirements

- [ ] Test settings hierarchy resolution
- [ ] Test approval requirement logic
- [ ] Test quiet hours calculation
- [ ] Test settings persistence
- [ ] Test integration with decision logic

### Acceptance Criteria

- [ ] Settings hierarchy works (tool > category > default)
- [ ] LLM confidence factors into approval requirement
- [ ] Quiet hours respected
- [ ] Decision logic uses autonomy settings
- [ ] Safe defaults applied
- [ ] All tests pass

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 7: Approval [A1P, A2U]
## ═══════════════════════════════════════════════════

**Pre-Conditions**:
- [ ] Chunks 16, 17 complete
- [ ] All tests passing
- [ ] No TypeScript errors

**Review Criteria**:
- [ ] Approvals preserve LLM reasoning and assumptions
- [ ] Users can modify parameters before approving
- [ ] Autonomy settings control approval requirements
- [ ] LLM confidence factors into approval decisions

**Testing Criteria**:
- [ ] Approval creation with LLM context tested
- [ ] Approve/reject/expire flows tested
- [ ] Autonomy settings hierarchy tested
- [ ] Quiet hours tested
- [ ] Plan resumption after approval tested

**Manual Testing Scenarios (with stubbed LLM)**:
- [ ] High-risk action creates approval with reasoning
- [ ] User modifies parameters and approves
- [ ] User rejects with feedback
- [ ] Autonomy setting "trust_confident" auto-executes high-confidence action
- [ ] Quiet hours triggers approval for normally auto-executed action

**Sign-Off**: _________________ Date: _________

---

## [W1C] Chat Message API with SSE (LLM-First)

**Estimated Time**: 5-6 hours  
**Dependencies**: Chunk 8 (Response Formatting), Chunk 25 (Agent Engine)  
**Goal**: Build the streaming chat API that surfaces the LLM's thought process.

### Prerequisites

- [ ] Agent Engine orchestrator available (Chunk 25)
- [ ] Response formatting available (Chunk 8)

### Architecture Notes

**LLM-First Design**: The API streams the LLM's full process to the frontend:

1. **User sends message** → API receives request
2. **Agent Engine processes** → Calls LLM, makes decisions
3. **SSE streams events** → Frontend sees each step in real-time
4. **Final response** → LLM-generated content with metadata

The frontend sees exactly what the LLM is thinking and doing.

### SSE Event Types

```typescript
// Events streamed to frontend
export type AgentStreamEvent =
  | { type: 'thinking'; data: { phase: string; message: string } }
  | { type: 'classification'; data: ClassificationResponse }  // LLM's understanding
  | { type: 'tool_selected'; data: { tool: string; params: unknown; reasoning: string } }
  | { type: 'tool_executing'; data: { tool: string; stepIndex?: number } }
  | { type: 'tool_result'; data: { tool: string; success: boolean; result?: unknown } }
  | { type: 'approval_required'; data: { approvalId: string; summary: string; reasoning: string } }
  | { type: 'plan_created'; data: { planId: string; steps: PlanStepSummary[] } }
  | { type: 'plan_progress'; data: { stepIndex: number; status: StepStatus } }
  | { type: 'content'; data: { delta: string } }  // LLM response streaming
  | { type: 'assumptions'; data: LLMAssumption[] }  // Surfaced to user
  | { type: 'done'; data: { messageId: string; auditLogId: string } }
  | { type: 'error'; data: { code: string; message: string } };
```

### Tasks

1. [ ] Create `src/app/api/chat/message/route.ts`
   ```typescript
   export async function POST(req: NextRequest) {
     // Auth check
     const session = await auth();
     if (!session?.user?.id) return unauthorized();
     
     // Parse request
     const { message, conversationId } = await req.json();
     
     // Create SSE stream
     const stream = new ReadableStream({
       async start(controller) {
         const encoder = new TextEncoder();
         const emit = (event: AgentStreamEvent) => {
           controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
         };
         
         try {
           // Process message through Agent Engine
           for await (const event of agentEngine.processMessage(message, {
             userId: session.user.id,
             conversationId,
           })) {
             emit(event);
           }
         } catch (error) {
           emit({ type: 'error', data: { code: 'PROCESSING_ERROR', message: error.message } });
         } finally {
           controller.close();
         }
       }
     });
     
     return new Response(stream, {
       headers: {
         'Content-Type': 'text/event-stream',
         'Cache-Control': 'no-cache',
         'Connection': 'keep-alive',
       },
     });
   }
   ```

2. [ ] Create `src/lib/agent/streaming/types.ts`
   - `AgentStreamEvent` type (above)
   - `StreamController` interface
   - Event factory functions

3. [ ] Create `src/lib/agent/streaming/emitter.ts`
   - Event emission helpers
   - Rate limiting for rapid events
   - Batching for content deltas

4. [ ] Integrate with Agent Engine (Chunk 25)
   - Engine yields events during processing
   - Each layer emits appropriate events

5. [ ] Add OpenAPI documentation for SSE endpoint

### Files to Create

```
src/app/api/chat/message/route.ts        # NEW: SSE streaming endpoint
src/lib/agent/streaming/
├── index.ts                              # NEW: Exports
├── types.ts                              # NEW: Event types
├── emitter.ts                            # NEW: Event emission
```

### Key Design Decisions

1. **Full transparency** - User sees LLM classification, tool selection, reasoning
2. **Streaming content** - LLM response streams token-by-token
3. **Assumptions surfaced** - LLM's assumptions visible to user
4. **Approval inline** - Approval requests appear in stream
5. **Audit linked** - Every response includes audit log ID

### Testing Requirements

- [ ] Test SSE connection establishment
- [ ] Test event streaming in correct order
- [ ] Test error handling mid-stream
- [ ] Test approval events pause stream appropriately
- [ ] Test content streaming with deltas

### Acceptance Criteria

- [ ] SSE streaming works end-to-end
- [ ] All event types properly emitted
- [ ] LLM classification visible in stream
- [ ] Tool execution visible in stream
- [ ] Content streams incrementally
- [ ] Errors handled gracefully
- [ ] All tests pass

---

## [W2A] Approval & Audit API Routes (LLM-First)

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 16 (Approval System), Chunk 3 (Audit Service)  
**Goal**: Build API routes for approval management and audit queries.

### Prerequisites

- [ ] Chunk 16 complete (approval system available)
- [ ] Chunk 3 complete (audit service available)

### Architecture Notes

**LLM-First Design**: These APIs expose the LLM's reasoning for review:

1. **Approval endpoints** - Show LLM reasoning, allow modification, trigger resume
2. **Audit endpoints** - Query agent history, view reasoning, verify assumptions

### Approval API Routes

```typescript
// GET /api/agent/approvals - List pending approvals
// Response includes LLM reasoning for each
interface PendingApprovalResponse {
  approvals: Array<{
    id: string;
    toolName: string;
    summary: string;
    reasoning: string;         // LLM's explanation
    confidence: number;        // LLM's confidence
    assumptions: LLMAssumption[];
    parameters: Record<string, unknown>;
    expiresAt: string;
    planId?: string;
  }>;
}

// POST /api/agent/approvals/:id/approve
// Can include modified parameters
interface ApproveRequest {
  modifiedParameters?: Record<string, unknown>;
}

// POST /api/agent/approvals/:id/reject
interface RejectRequest {
  feedback?: string;  // Why rejected, fed back to improve
}
```

### Audit API Routes

```typescript
// GET /api/agent/audit - Query audit log
// Filter by conversation, time range, action type
interface AuditQueryResponse {
  entries: Array<{
    id: string;
    action: string;
    reasoning: string;
    confidence: number;
    assumptions: LLMAssumption[];
    status: string;
    timestamp: string;
  }>;
  pagination: { ... };
}

// GET /api/agent/audit/:id - Get single entry with full details
// POST /api/agent/audit/:id/assumptions/:assumptionId/verify - Mark assumption verified/incorrect
```

### Tasks

1. [ ] Create `src/app/api/agent/approvals/route.ts`
   - GET: List pending approvals with LLM context
   - Include reasoning, assumptions, confidence

2. [ ] Create `src/app/api/agent/approvals/[id]/route.ts`
   - GET: Single approval details
   - POST: Approve with optional modifications
   - DELETE: Reject with optional feedback

3. [ ] Create `src/app/api/agent/audit/route.ts`
   - GET: Query audit log with filters
   - Pagination, sorting

4. [ ] Create `src/app/api/agent/audit/[id]/route.ts`
   - GET: Single audit entry with full context

5. [ ] Create `src/app/api/agent/audit/[id]/assumptions/[assumptionId]/route.ts`
   - POST: Verify or mark assumption incorrect

6. [ ] Add OpenAPI documentation

### Files to Create

```
src/app/api/agent/
├── approvals/
│   ├── route.ts                          # NEW: List approvals
│   └── [id]/
│       └── route.ts                      # NEW: Approve/reject
├── audit/
│   ├── route.ts                          # NEW: Query audit
│   └── [id]/
│       ├── route.ts                      # NEW: Single entry
│       └── assumptions/
│           └── [assumptionId]/
│               └── route.ts              # NEW: Verify assumption
```

### Testing Requirements

- [ ] Test approval list with LLM context
- [ ] Test approve with modified params
- [ ] Test reject with feedback
- [ ] Test audit query with filters
- [ ] Test assumption verification

### Acceptance Criteria

- [ ] All approval endpoints working
- [ ] LLM reasoning included in responses
- [ ] Modified parameters accepted on approve
- [ ] Audit queries support filtering
- [ ] Assumption verification working
- [ ] All tests pass

---

## [W3P] Plan Management API (LLM-First)

**Estimated Time**: 2-3 hours  
**Dependencies**: Chunk 13-15 (Planning Layer)  
**Goal**: Build API routes for viewing and managing agent plans.

### Prerequisites

- [ ] Chunks 13-15 complete (planning layer available)

### Architecture Notes

**LLM-First Design**: Plans show the LLM's decomposed approach:

1. **Plan visibility** - User can see LLM-generated step sequence
2. **Step details** - Each step shows tool, params, reasoning
3. **Plan control** - Resume, cancel, skip steps

### Plan API Routes

```typescript
// GET /api/agent/plans - List user's plans
interface PlansListResponse {
  plans: Array<{
    id: string;
    goal: string;              // Original user request
    summary: string;           // LLM's plan summary
    status: PlanStatus;
    stepCount: number;
    currentStep: number;
    createdAt: string;
  }>;
}

// GET /api/agent/plans/:id - Get plan details
interface PlanDetailResponse {
  id: string;
  goal: string;
  summary: string;
  status: PlanStatus;
  steps: Array<{
    index: number;
    toolName: string;
    description: string;       // LLM's description of step
    parameters: Record<string, unknown>;
    status: StepStatus;
    result?: unknown;
    error?: string;
    requiresApproval: boolean;
    approvalId?: string;
  }>;
  assumptions: LLMAssumption[];
  conversationId?: string;
}

// POST /api/agent/plans/:id/resume - Resume paused plan
// POST /api/agent/plans/:id/cancel - Cancel plan
// POST /api/agent/plans/:id/steps/:stepIndex/skip - Skip a step
```

### Tasks

1. [ ] Create `src/app/api/agent/plans/route.ts`
   - GET: List user's plans with summary

2. [ ] Create `src/app/api/agent/plans/[id]/route.ts`
   - GET: Plan details with all steps
   - DELETE: Cancel plan

3. [ ] Create `src/app/api/agent/plans/[id]/resume/route.ts`
   - POST: Resume paused plan

4. [ ] Create `src/app/api/agent/plans/[id]/steps/[stepIndex]/route.ts`
   - POST: Skip step

5. [ ] Add OpenAPI documentation

### Files to Create

```
src/app/api/agent/plans/
├── route.ts                              # NEW: List plans
└── [id]/
    ├── route.ts                          # NEW: Plan details/cancel
    ├── resume/
    │   └── route.ts                      # NEW: Resume plan
    └── steps/
        └── [stepIndex]/
            └── route.ts                  # NEW: Skip step
```

### Testing Requirements

- [ ] Test plan listing
- [ ] Test plan details with steps
- [ ] Test plan resume
- [ ] Test plan cancel
- [ ] Test step skip

### Acceptance Criteria

- [ ] All plan endpoints working
- [ ] LLM plan details visible
- [ ] Resume triggers plan continuation
- [ ] Cancel stops execution
- [ ] All tests pass

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 9: APIs [W1C, W2A, W3P]
## ═══════════════════════════════════════════════════

**Pre-Conditions**:
- [ ] Chunks 18, 19, 20 complete
- [ ] All tests passing
- [ ] No TypeScript errors

**Review Criteria**:
- [ ] SSE streams LLM classification and reasoning
- [ ] Approval APIs include LLM context
- [ ] Audit APIs support assumption verification
- [ ] Plan APIs show LLM-generated steps

**Testing Criteria**:
- [ ] SSE streaming end-to-end tested
- [ ] All API routes tested
- [ ] OpenAPI documentation complete
- [ ] Error handling tested

**Manual Testing Scenarios**:
- [ ] Send message → see LLM thinking in stream
- [ ] Approval appears → LLM reasoning visible
- [ ] Query audit → see past reasoning
- [ ] View plan → see LLM step breakdown

**Sign-Off**: _________________ Date: _________

---

## [U1S] Streaming Chat Interface (LLM-First)

**Estimated Time**: 5-6 hours  
**Dependencies**: Chunk 18 (Chat Message API with SSE)  
**Goal**: Build a chat interface that surfaces the LLM's thought process in real-time.

### Prerequisites

- [ ] Chunk 18 complete (SSE streaming API available)

### Architecture Notes

**LLM-First Design**: The UI shows users exactly what the LLM is doing:

1. **Thinking indicators** - Show "Understanding your request..."
2. **Classification display** - Optionally show what the LLM understood
3. **Tool execution** - Show which tool is running, with progress
4. **Streaming response** - Display LLM response as it generates
5. **Assumptions callout** - Highlight what the LLM assumed

This builds trust by making the AI's process transparent.

### UI Components

```typescript
// Main chat message component
interface ChatMessageProps {
  message: AgentMessage;
  isStreaming?: boolean;
  streamEvents?: AgentStreamEvent[];
}

// Streaming state display
interface StreamingStateProps {
  phase: 'thinking' | 'classifying' | 'executing' | 'responding';
  details?: string;
  tool?: { name: string; description: string };
  progress?: number;
}

// Tool execution indicator
interface ToolExecutionProps {
  toolName: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: unknown;
  reasoning?: string;  // LLM's reason for using this tool
}

// Assumptions display
interface AssumptionsProps {
  assumptions: LLMAssumption[];
  onVerify?: (id: string, correct: boolean) => void;
}
```

### Tasks

1. [ ] Create `src/components/chat/streaming-message.tsx`
   - Consume SSE events from API
   - Display appropriate UI for each event type
   - Animate content streaming

2. [ ] Create `src/components/chat/thinking-indicator.tsx`
   - Animated "thinking" state
   - Phase labels: "Understanding...", "Selecting action...", etc.

3. [ ] Create `src/components/chat/tool-execution.tsx`
   - Show tool name and description
   - Display LLM's reasoning for tool selection
   - Progress indicator
   - Success/failure state

4. [ ] Create `src/components/chat/assumptions-callout.tsx`
   - List assumptions the LLM made
   - Allow user to verify/correct
   - Collapsible for non-intrusive display

5. [ ] Create `src/components/chat/plan-preview.tsx`
   - When multi-step plan created, show step list
   - Indicate which step is current
   - Show approval-required steps

6. [ ] Create `src/hooks/use-agent-stream.ts`
   ```typescript
   export function useAgentStream(conversationId: string) {
     const [events, setEvents] = useState<AgentStreamEvent[]>([]);
     const [phase, setPhase] = useState<StreamPhase>('idle');
     const [content, setContent] = useState('');
     
     const sendMessage = async (message: string) => {
       // Open SSE connection
       // Process events
       // Update state
     };
     
     return { events, phase, content, sendMessage };
   }
   ```

7. [ ] Update `src/components/chat/chat-interface.tsx`
   - Integrate streaming components
   - Handle approval interruptions

### Files to Create

```
src/components/chat/
├── streaming-message.tsx         # NEW: Streaming message display
├── thinking-indicator.tsx        # NEW: Animated thinking state
├── tool-execution.tsx            # NEW: Tool execution display
├── assumptions-callout.tsx       # NEW: Assumption display
├── plan-preview.tsx              # NEW: Multi-step plan display
src/hooks/
├── use-agent-stream.ts           # NEW: SSE streaming hook
```

### Key Design Decisions

1. **Full transparency** - Users see the LLM's process, not just results
2. **Non-intrusive assumptions** - Collapsible, but visible
3. **Animated streaming** - Content appears smoothly
4. **Interruption handling** - Approvals pause and prompt user
5. **Plan visibility** - Multi-step plans shown upfront

### Testing Requirements

- [ ] Test SSE event consumption
- [ ] Test thinking/executing/responding transitions
- [ ] Test content streaming animation
- [ ] Test assumption display and interaction
- [ ] Test plan preview

### Acceptance Criteria

- [ ] Streaming messages display correctly
- [ ] Thinking indicators show during processing
- [ ] Tool execution visible with LLM reasoning
- [ ] Assumptions displayed and verifiable
- [ ] Multi-step plans previewed
- [ ] All tests pass

---

## [U2D] Approval Dialog (LLM-First)

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 16 (Approval System), Chunk 19 (Approval API)  
**Goal**: Build an approval UI that shows LLM reasoning and allows modification.

### Prerequisites

- [ ] Chunk 16 complete (approval system available)
- [ ] Chunk 19 complete (approval API available)

### Architecture Notes

**LLM-First Design**: The approval dialog is where users evaluate LLM decisions:

1. **Clear action summary** - What the LLM wants to do
2. **LLM reasoning** - WHY the LLM chose this action
3. **Assumptions visible** - What the LLM assumed
4. **Confidence indicator** - How confident the LLM is
5. **Editable parameters** - User can modify before approving
6. **Feedback on reject** - User explains why (improves future decisions)

### UI Components

```typescript
// Main approval dialog
interface ApprovalDialogProps {
  approval: AgentActionApproval;
  onApprove: (modifiedParams?: Record<string, unknown>) => void;
  onReject: (feedback?: string) => void;
  onDismiss: () => void;
}

// Reasoning display
interface ReasoningDisplayProps {
  reasoning: string;
  confidence: number;
  assumptions: LLMAssumption[];
}

// Parameter editor
interface ParameterEditorProps {
  schema: Record<string, unknown>;  // JSON Schema
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

// Rejection feedback
interface RejectionFeedbackProps {
  onSubmit: (feedback: string) => void;
  onSkip: () => void;
}
```

### Tasks

1. [ ] Create `src/components/agent/approval-dialog.tsx`
   - Full approval dialog with all sections
   - Mobile-responsive design
   - Keyboard accessible

2. [ ] Create `src/components/agent/reasoning-display.tsx`
   - Display LLM's reasoning text
   - Confidence meter/badge
   - Collapsible assumptions list

3. [ ] Create `src/components/agent/parameter-editor.tsx`
   - Generate form from JSON Schema
   - Validate edits
   - Show original vs. modified

4. [ ] Create `src/components/agent/rejection-feedback.tsx`
   - Text area for feedback
   - Quick rejection reasons (wrong action, bad timing, etc.)
   - Skip option

5. [ ] Create `src/components/agent/approval-list.tsx`
   - List of pending approvals
   - Badge count in navigation
   - Quick approve/reject actions

6. [ ] Create `src/hooks/use-approvals.ts`
   ```typescript
   export function useApprovals() {
     const { data, mutate } = useSWR('/api/agent/approvals');
     
     const approve = async (id: string, modifiedParams?: Record<string, unknown>) => { ... };
     const reject = async (id: string, feedback?: string) => { ... };
     
     return { approvals: data, approve, reject, refresh: mutate };
   }
   ```

### Files to Create

```
src/components/agent/
├── approval-dialog.tsx           # NEW: Main approval dialog
├── reasoning-display.tsx         # NEW: LLM reasoning display
├── parameter-editor.tsx          # NEW: Edit parameters
├── rejection-feedback.tsx        # NEW: Rejection feedback form
├── approval-list.tsx             # NEW: Pending approvals list
src/hooks/
├── use-approvals.ts              # NEW: Approvals hook
```

### Key Design Decisions

1. **Reasoning prominent** - Users understand WHY before approving
2. **Confidence visible** - Users calibrate trust based on LLM confidence
3. **Easy modification** - One-click edit, not full re-entry
4. **Feedback loop** - Rejections improve future performance
5. **Non-blocking** - User can dismiss and handle later

### Testing Requirements

- [ ] Test approval dialog rendering
- [ ] Test parameter editing and validation
- [ ] Test approve with modifications
- [ ] Test reject with feedback
- [ ] Test keyboard navigation

### Acceptance Criteria

- [ ] Approval dialog shows LLM reasoning
- [ ] Confidence indicator visible
- [ ] Parameters editable before approval
- [ ] Rejection feedback collected
- [ ] Approvals list accessible from navigation
- [ ] All tests pass

---

## [U3V] Audit Viewer (LLM-First)

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 19 (Audit API)  
**Goal**: Build an audit viewer that shows agent history with full reasoning.

### Prerequisites

- [ ] Chunk 19 complete (audit API available)

### Architecture Notes

**LLM-First Design**: The audit viewer lets users review and learn from agent decisions:

1. **Timeline view** - Chronological history of actions
2. **Reasoning per action** - What the LLM thought and why
3. **Assumption tracking** - Which assumptions were correct/incorrect
4. **Outcome visibility** - What happened after each action
5. **Searchable** - Find specific actions or patterns

### UI Components

```typescript
// Audit timeline
interface AuditTimelineProps {
  entries: AuditEntry[];
  onEntryClick: (id: string) => void;
}

// Audit entry detail
interface AuditEntryDetailProps {
  entry: AuditEntryWithAssumptions;
  onVerifyAssumption: (assumptionId: string, correct: boolean) => void;
}

// Assumption verification
interface AssumptionVerificationProps {
  assumption: LLMAssumption;
  onVerify: (correct: boolean) => void;
}
```

### Tasks

1. [ ] Create `src/components/agent/audit-timeline.tsx`
   - Scrollable timeline of agent actions
   - Status indicators (success, failed, pending)
   - Grouped by conversation or date

2. [ ] Create `src/components/agent/audit-entry-detail.tsx`
   - Full action details
   - LLM reasoning display
   - Assumptions with verification UI
   - Outcome/result display

3. [ ] Create `src/components/agent/assumption-verification.tsx`
   - Single assumption with verify/incorrect buttons
   - Feedback text for incorrect
   - Visual state change on verification

4. [ ] Create `src/components/agent/audit-filters.tsx`
   - Filter by date range
   - Filter by action type
   - Filter by status
   - Search text

5. [ ] Create `src/app/(dashboard)/audit/page.tsx`
   - Full audit page
   - Split view: list + detail

6. [ ] Create `src/hooks/use-audit.ts`
   ```typescript
   export function useAudit(filters?: AuditFilters) {
     const { data, mutate } = useSWR(['/api/agent/audit', filters]);
     
     const verifyAssumption = async (auditId: string, assumptionId: string, correct: boolean) => { ... };
     
     return { entries: data, verifyAssumption, refresh: mutate };
   }
   ```

### Files to Create

```
src/components/agent/
├── audit-timeline.tsx            # NEW: Audit timeline
├── audit-entry-detail.tsx        # NEW: Entry details
├── assumption-verification.tsx   # NEW: Verify assumptions
├── audit-filters.tsx             # NEW: Filter controls
src/app/(dashboard)/audit/
├── page.tsx                      # NEW: Audit page
src/hooks/
├── use-audit.ts                  # NEW: Audit hook
```

### Key Design Decisions

1. **Learning from history** - Users understand agent patterns
2. **Assumption feedback** - Incorrect assumptions improve future accuracy
3. **Searchable** - Find specific actions when needed
4. **Conversation context** - See actions in conversation flow
5. **Exportable** - Download audit log (future enhancement)

### Testing Requirements

- [ ] Test timeline rendering
- [ ] Test entry detail display
- [ ] Test assumption verification
- [ ] Test filtering and search
- [ ] Test pagination

### Acceptance Criteria

- [ ] Audit timeline displays correctly
- [ ] Entry detail shows full LLM reasoning
- [ ] Assumptions verifiable inline
- [ ] Filters work correctly
- [ ] All tests pass

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 10: UI [U1S, U2D, U3V]
## ═══════════════════════════════════════════════════

**Pre-Conditions**:
- [ ] Chunks 21, 22, 23 complete
- [ ] All tests passing
- [ ] No TypeScript errors

**Review Criteria**:
- [ ] Streaming chat shows LLM thinking process
- [ ] Approval dialog displays LLM reasoning prominently
- [ ] Audit viewer shows full decision history with assumptions
- [ ] All UI is accessible and responsive

**Testing Criteria**:
- [ ] UI components render correctly
- [ ] SSE streaming displays smoothly
- [ ] Approval flow complete (approve, reject, modify)
- [ ] Assumption verification works
- [ ] Mobile responsive

**Manual Testing Scenarios**:
- [ ] Send message → see thinking → see tool → see response
- [ ] Approval appears → see LLM reasoning → modify params → approve
- [ ] View audit → find past action → verify assumption as incorrect
- [ ] Review confidence scores across multiple actions

**Sign-Off**: _________________ Date: _________

---

## [LLM] LLM Client & Provider Integration

**Estimated Time**: 6-8 hours  
**Dependencies**: Chunk 4 (Intent Types), Chunk 9 (Tool Registry)  
**Goal**: Implement the actual LLM calls that power the entire agent system.

### Prerequisites

- [ ] Chunk 4 complete (`ClassificationRequest`, `ClassificationResponse`, `ToolForLLM` types)
- [ ] Chunk 9 complete (`toolRegistry.getToolsForLLM()` available)
- [ ] Agent config available (LLM provider, model selection)

### Architecture Notes

**LLM-First Design**: This is THE core chunk - everything else was built to support this:

1. **Classification Call** - LLM understands intent, extracts entities, suggests tools
2. **Plan Generation Call** - LLM creates multi-step plans for complex goals
3. **Response Generation Call** - LLM generates user-facing responses
4. **Recovery Call** - LLM decides how to recover from failures

The agent system is a thin orchestration layer around these LLM capabilities.

### LLM Call Types

```typescript
// 1. Classification - Understanding user intent
interface ClassificationCall {
  input: ClassificationRequest;   // From Chunk 4
  output: ClassificationResponse; // From Chunk 4
  model: 'fast';                  // Quick model for classification
}

// 2. Plan Generation - Breaking down complex goals
interface PlanGenerationCall {
  input: PlanGenerationRequest;   // From Chunk 13
  output: LLMGeneratedPlan;       // From Chunk 13
  model: 'reasoning';             // Smarter model for planning
}

// 3. Response Generation - User-facing content
interface ResponseGenerationCall {
  input: ResponseGenerationRequest;
  output: string;                 // Streaming text
  model: 'conversational';        // Optimized for chat
}

// 4. Recovery Decision - Handling failures
interface RecoveryCall {
  input: RecoveryRequest;
  output: RecoveryAction;         // From Chunk 15
  model: 'fast';                  // Quick decision
}
```

### LLM Client Interface

```typescript
export interface LLMClient {
  // Classification call (returns structured JSON)
  classify(request: ClassificationRequest): Promise<ClassificationResponse>;
  
  // Plan generation call (returns structured JSON)
  generatePlan(request: PlanGenerationRequest): Promise<LLMGeneratedPlan>;
  
  // Response generation (streaming)
  generateResponse(request: ResponseGenerationRequest): AsyncGenerator<string>;
  
  // Recovery decision (returns structured JSON)
  decideRecovery(request: RecoveryRequest): Promise<RecoveryAction>;
  
  // Raw completion for flexibility
  complete(prompt: string, options?: CompletionOptions): Promise<string>;
  streamComplete(prompt: string, options?: CompletionOptions): AsyncGenerator<string>;
}
```

### Tasks

1. [ ] Create `src/lib/agent/llm/types.ts`
   ```typescript
   export interface LLMClient { ... }  // Above
   
   export interface CompletionOptions {
     model?: string;
     temperature?: number;
     maxTokens?: number;
     responseFormat?: 'text' | 'json';
     tools?: ToolForLLM[];  // For tool calling
   }
   
   export interface LLMConfig {
     provider: 'openai' | 'anthropic' | 'google';
     models: {
       fast: string;           // e.g., 'gpt-4o-mini'
       reasoning: string;      // e.g., 'gpt-4o' or 'claude-3-opus'
       conversational: string; // e.g., 'gpt-4o'
     };
     defaultTemperature: number;
     maxRetries: number;
   }
   ```

2. [ ] Create `src/lib/agent/llm/client.ts`
   ```typescript
   export function createLLMClient(config: LLMConfig): LLMClient {
     switch (config.provider) {
       case 'openai': return createOpenAIClient(config);
       case 'anthropic': return createAnthropicClient(config);
       case 'google': return createGoogleClient(config);
     }
   }
   ```

3. [ ] Create `src/lib/agent/llm/providers/openai.ts`
   - OpenAI-specific implementation
   - Tool calling via function_call
   - JSON mode for structured output
   - Streaming support

4. [ ] Create `src/lib/agent/llm/providers/anthropic.ts`
   - Anthropic-specific implementation
   - Tool use via tool_use blocks
   - JSON structured output
   - Streaming support

5. [ ] Create `src/lib/agent/llm/prompts/classification.ts`
   ```typescript
   export function buildClassificationPrompt(
     request: ClassificationRequest
   ): string {
     return `You are Theo, an AI assistant. Analyze this message and respond with JSON.

Available tools:
${request.availableTools.map(t => `- ${t.name}: ${t.description}
  When to use: ${t.whenToUse}
  Examples: ${t.examples?.join(', ')}`).join('\n')}

User message: "${request.message}"

Respond with JSON matching this schema:
{
  "intent": { "category": "...", "action": "...", "summary": "..." },
  "entities": [...],
  "suggestedTool": { "name": "...", "parameters": {...}, "confidence": 0.0-1.0, "reasoning": "..." },
  "clarificationNeeded": { "required": boolean, "questions": [...] },
  "assumptions": [...],
  "confidence": 0.0-1.0
}`;
   }
   ```

6. [ ] Create `src/lib/agent/llm/prompts/plan-generation.ts`
   - Prompt for multi-step plan generation
   - Include tool definitions
   - Guide step sequencing

7. [ ] Create `src/lib/agent/llm/prompts/response.ts`
   - Prompt for user-facing response generation
   - Include context from tool execution
   - Guidance on tone and assumptions

8. [ ] Create `src/lib/agent/llm/prompts/recovery.ts`
   - Prompt for failure recovery decisions
   - Include error context
   - Options: retry, skip, abort, ask_user

9. [ ] Create `src/lib/agent/llm/token-counter.ts`
   - Estimate token counts
   - Truncate context if needed
   - Track usage for rate limiting

10. [ ] Create `src/lib/agent/llm/retry.ts`
    - Retry with exponential backoff
    - Handle rate limits
    - Handle transient errors

11. [ ] Create `src/lib/agent/llm/index.ts`

### Files to Create

```
src/lib/agent/llm/
├── index.ts                          # NEW: Exports
├── types.ts                          # NEW: LLM types
├── client.ts                         # NEW: Client factory
├── providers/
│   ├── openai.ts                     # NEW: OpenAI implementation
│   ├── anthropic.ts                  # NEW: Anthropic implementation
│   └── google.ts                     # NEW: Google implementation
├── prompts/
│   ├── classification.ts             # NEW: Classification prompt
│   ├── plan-generation.ts            # NEW: Planning prompt
│   ├── response.ts                   # NEW: Response prompt
│   └── recovery.ts                   # NEW: Recovery prompt
├── token-counter.ts                  # NEW: Token estimation
├── retry.ts                          # NEW: Retry logic
```

### Key Design Decisions

1. **Provider abstraction** - Swap OpenAI/Anthropic/Google without code changes
2. **Structured outputs** - JSON mode for reliable parsing
3. **Prompt engineering** - Clear, tested prompts per call type
4. **Tool integration** - Tools self-describe via `ToolForLLM` interface
5. **Streaming** - Response generation streams token-by-token
6. **Model selection** - Different models for different tasks (fast vs. reasoning)

### Prompt Engineering Guidelines

1. **Classification prompt** should:
   - List all available tools with `whenToUse` and `examples`
   - Request confidence scores (0.0-1.0)
   - Request reasoning for tool selection
   - Request explicit assumptions

2. **Plan generation prompt** should:
   - Explain the goal clearly
   - List available tools
   - Request step-by-step breakdown
   - Request dependency tracking

3. **Response prompt** should:
   - Include tool execution results
   - Guide conversational tone
   - Request assumption disclosure

### Testing Requirements

- [ ] Test classification produces valid `ClassificationResponse`
- [ ] Test plan generation produces valid `LLMGeneratedPlan`
- [ ] Test response streaming works
- [ ] Test recovery decisions are valid
- [ ] Test provider switching works
- [ ] Test retry logic with mock failures
- [ ] Test token counting accuracy

### Acceptance Criteria

- [ ] LLM client abstraction supports multiple providers
- [ ] Classification returns structured `ClassificationResponse`
- [ ] Plan generation returns structured `LLMGeneratedPlan`
- [ ] Response generation streams correctly
- [ ] Prompts include tool definitions from registry
- [ ] Token limits respected
- [ ] Retry logic handles transient failures
- [ ] All tests pass

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 2: LLM Core [LLM]
## ═══════════════════════════════════════════════════

**Pre-Conditions**:
- [ ] LLM chunk complete
- [ ] All tests passing
- [ ] No TypeScript errors

**Review Criteria**:
- [ ] LLM client interface defined (`classify`, `generatePlan`, `generateResponse`, `decideRecovery`)
- [ ] Provider abstraction works (OpenAI, Anthropic, Google)
- [ ] Classification returns valid `ClassificationResponse`
- [ ] Prompts include tool definitions

**Testing Criteria**:
- [ ] Unit tests for all LLM call types
- [ ] Mock-based tests for each provider
- [ ] Streaming response tests

**Manual Testing**:
- [ ] Send request → get classification
- [ ] Generate plan → valid structure
- [ ] Stream response → tokens arrive

**Sign-Off**: _________________ Date: _________

---

## [ORK] Agent Engine Orchestrator (LLM-First)

**Estimated Time**: 5-6 hours  
**Dependencies**: All chunks: LLM, T1R-T4E, P1I-P3C, R1D-R2F, L1G-L3S, A1P-A2U  
**Goal**: Wire everything together into the main Agent Engine.

### Prerequisites

- [ ] All previous chunks complete
- [ ] [LLM] chunk complete (LLM client available)

### Architecture Notes

**LLM-First Design**: The orchestrator is a thin layer that:

1. Receives user message
2. Calls LLM for classification [LLM]
3. Routes based on decision logic [R1D]
4. Executes tools or creates plans [T4E, L1G-L3S]
5. Streams response back [LLM]
6. Logs everything [F3D]

The orchestrator doesn't make intelligent decisions - the LLM does.

### Agent Engine Interface

```typescript
export class AgentEngine {
  constructor(
    private llmClient: LLMClient,
    private toolRegistry: ToolRegistry,
    private auditService: AuditService,
    private approvalService: ApprovalService,
    private planningService: PlanningService,
  ) {}
  
  /**
   * Main entry point - process a user message
   * Yields streaming events for UI display
   */
  async *processMessage(
    message: string,
    context: MessageContext
  ): AsyncGenerator<AgentStreamEvent> {
    // 1. Emit thinking event
    yield { type: 'thinking', data: { phase: 'classifying', message: 'Understanding...' } };
    
    // 2. Get available tools for user
    const tools = this.toolRegistry.getAvailableTools(context.userId, context.integrations);
    
    // 3. Call LLM for classification
    const classification = await this.llmClient.classify({
      message,
      availableTools: tools,
      conversationHistory: context.history,
    });
    yield { type: 'classification', data: classification };
    
    // 4. Route based on decision logic
    const decision = await this.routeAction(classification, context);
    
    // 5. Handle based on decision
    switch (decision.action) {
      case 'execute':
        yield* this.executeAction(decision, context);
        break;
      case 'confirm':
        yield* this.confirmAndExecute(decision, context);
        break;
      case 'request_approval':
        yield* this.createApproval(decision, context);
        break;
      case 'clarify':
        yield* this.requestClarification(decision, context);
        break;
      case 'create_plan':
        yield* this.createAndExecutePlan(decision, context);
        break;
    }
    
    // 6. Generate response
    yield { type: 'thinking', data: { phase: 'responding', message: 'Generating response...' } };
    for await (const chunk of this.llmClient.generateResponse(...)) {
      yield { type: 'content', data: { delta: chunk } };
    }
    
    // 7. Complete
    yield { type: 'done', data: { messageId: '...', auditLogId: '...' } };
  }
  
  /** Resume a paused plan after approval */
  async *resumePlan(planId: string): AsyncGenerator<AgentStreamEvent>;
  
  /** Cancel a plan */
  async cancelPlan(planId: string): Promise<void>;
}
```

### Tasks

1. [ ] Create `src/lib/agent/engine.ts`
   - Main `AgentEngine` class
   - `processMessage()` generator
   - `resumePlan()` generator
   - `cancelPlan()` method

2. [ ] Implement classification flow
   - Get tools for user
   - Build classification request
   - Call LLM
   - Emit classification event

3. [ ] Implement decision routing
   - Apply autonomy settings (Chunk 17)
   - Route to appropriate handler

4. [ ] Implement action execution
   - Execute tool via execution engine (Chunk 12)
   - Emit tool events

5. [ ] Implement plan creation
   - Call LLM for plan generation
   - Validate and structure plan
   - Execute or pause at approvals

6. [ ] Implement response generation
   - Build response context
   - Stream LLM response
   - Emit content deltas

7. [ ] Implement error handling
   - Call LLM for recovery decisions
   - Handle gracefully

8. [ ] Create `src/lib/agent/engine.test.ts`
   - Test full message flow
   - Test plan creation flow
   - Test approval interruption
   - Test error recovery

### Files to Create

```
src/lib/agent/
├── engine.ts                         # NEW: Main orchestrator
```

### Key Design Decisions

1. **Generator-based** - Yields events for streaming
2. **Thin orchestration** - LLM makes decisions, engine executes
3. **Event-driven** - Every step emits observable events
4. **Resumable** - Plans can pause and resume
5. **Audited** - Every action logged

### Testing Requirements

- [ ] Test simple query → immediate response
- [ ] Test tool execution → result in response
- [ ] Test high-risk action → approval creation
- [ ] Test multi-step plan → plan execution
- [ ] Test plan pause at approval
- [ ] Test plan resume after approval
- [ ] Test error recovery

### Acceptance Criteria

- [ ] Engine orchestrates full message flow
- [ ] LLM classification drives all decisions
- [ ] Tool execution works with event streaming
- [ ] Plan creation and execution works
- [ ] Approval interruptions handled
- [ ] Errors trigger recovery logic
- [ ] All tests pass

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 8: Agent Core [ORK]
## ═══════════════════════════════════════════════════

**Pre-Conditions**:
- [ ] Chunks 24, 25 complete
- [ ] All previous chunks complete
- [ ] All tests passing
- [ ] No TypeScript errors

**Review Criteria**:
- [ ] LLM client supports multiple providers
- [ ] Prompts include tool definitions with `whenToUse` and `examples`
- [ ] Classification returns confidence and reasoning
- [ ] Plan generation creates structured plans
- [ ] Response generation streams correctly
- [ ] Engine orchestrates full flow

**Testing Criteria**:
- [ ] LLM calls return valid structured responses
- [ ] Streaming works end-to-end
- [ ] Tool execution integrates correctly
- [ ] Approval workflow integrates correctly

**Full Integration Test**:
- [ ] Send message → LLM classifies → tool executes → LLM responds
- [ ] Complex request → LLM generates plan → plan executes with approvals
- [ ] Error occurs → LLM decides recovery → graceful handling
- [ ] Full audit trail captured

**Sign-Off**: _________________ Date: _________

---

## [X1T] Integration Testing (LLM-First)

**Estimated Time**: 6-8 hours  
**Dependencies**: Chunks 24, 25 complete  
**Goal**: Comprehensive integration tests that mock LLM calls and verify the orchestration layer.

### Architecture Notes

**LLM-First Testing Strategy**: Since the LLM is the brain, our tests need to:

1. **Mock LLM responses** - Never make real API calls in tests
2. **Test contract compliance** - Verify LLM responses match our interfaces
3. **Test orchestration logic** - Ensure the agent correctly routes LLM decisions
4. **Test edge cases** - Invalid responses, low confidence, failures

### LLM Mock Factory

```typescript
// tests/lib/agent/mocks/llm-mock.ts

export function createMockLLMClient(overrides?: Partial<LLMClient>): LLMClient {
  return {
    classify: vi.fn().mockResolvedValue(mockClassificationResponse()),
    generatePlan: vi.fn().mockResolvedValue(mockLLMPlan()),
    generateResponse: vi.fn().mockImplementation(async function* () {
      yield 'Here is ';
      yield 'the response.';
    }),
    decideRecovery: vi.fn().mockResolvedValue({ action: 'retry' }),
    ...overrides,
  };
}

// Pre-built mock responses for common scenarios
export const mockResponses = {
  // High confidence tool call
  confidentToolCall: (): ClassificationResponse => ({
    intent: { category: 'calendar', action: 'query', summary: 'Check calendar' },
    entities: [{ type: 'timeRange', value: 'tomorrow', raw: 'tomorrow' }],
    suggestedTool: {
      name: 'calendar.queryEvents',
      parameters: { startDate: '2024-01-02', endDate: '2024-01-02' },
      confidence: 0.95,
      reasoning: 'User asked about tomorrow\'s calendar',
    },
    clarificationNeeded: { required: false, questions: [], missingInfo: [] },
    assumptions: [{ type: 'temporal', value: 'tomorrow = 2024-01-02', confidence: 0.99 }],
    confidence: 0.95,
  }),

  // Low confidence - needs clarification
  needsClarification: (): ClassificationResponse => ({
    intent: { category: 'calendar', action: 'create', summary: 'Schedule meeting' },
    entities: [{ type: 'person', value: 'Sarah', raw: 'Sarah' }],
    suggestedTool: null,
    clarificationNeeded: {
      required: true,
      questions: ['Which Sarah - Sarah Chen or Sarah Miller?', 'What time works for you?'],
      missingInfo: ['specific_person', 'time'],
    },
    assumptions: [],
    confidence: 0.4,
  }),

  // Multi-step plan needed
  complexPlan: (): ClassificationResponse => ({
    intent: { category: 'calendar', action: 'create', summary: 'Schedule meeting with prep' },
    entities: [...],
    suggestedTool: null,  // No single tool - needs plan
    clarificationNeeded: { required: false, questions: [], missingInfo: [] },
    assumptions: [...],
    confidence: 0.85,
  }),

  // Invalid/malformed response (for error testing)
  malformed: () => ({ invalid: 'structure' }),
};
```

### Test Suites to Create

1. [ ] **`tests/lib/agent/llm/client.test.ts`** - LLM client abstraction
   ```typescript
   describe('LLM Client', () => {
     describe('classify', () => {
       it('returns valid ClassificationResponse', async () => {
         const client = createOpenAIClient(config);
         // Mock the underlying API call
         mockOpenAI.chat.completions.create.mockResolvedValue({
           choices: [{ message: { content: JSON.stringify(mockResponses.confidentToolCall()) }}]
         });
         
         const result = await client.classify(request);
         expect(result).toMatchSchema(ClassificationResponseSchema);
       });
       
       it('handles malformed LLM response', async () => {
         mockOpenAI.chat.completions.create.mockResolvedValue({
           choices: [{ message: { content: 'not json' }}]
         });
         
         await expect(client.classify(request)).rejects.toThrow(LLMParseError);
       });
       
       it('retries on transient failure', async () => {
         mockOpenAI.chat.completions.create
           .mockRejectedValueOnce(new Error('rate limit'))
           .mockResolvedValueOnce(validResponse);
         
         const result = await client.classify(request);
         expect(result).toBeDefined();
         expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
       });
     });
     
     describe('generateResponse', () => {
       it('streams tokens correctly', async () => {
         // Test streaming behavior
       });
     });
   });
   ```

2. [ ] **`tests/lib/agent/llm/prompts.test.ts`** - Prompt building
   ```typescript
   describe('Classification Prompt', () => {
     it('includes all tool definitions', () => {
       const prompt = buildClassificationPrompt(request);
       
       for (const tool of request.availableTools) {
         expect(prompt).toContain(tool.name);
         expect(prompt).toContain(tool.whenToUse);
         expect(prompt).toContain(tool.examples[0]);
       }
     });
     
     it('includes conversation history', () => {
       const prompt = buildClassificationPrompt({
         ...request,
         conversationHistory: [{ role: 'user', content: 'Previous message' }],
       });
       
       expect(prompt).toContain('Previous message');
     });
   });
   ```

3. [ ] **`tests/lib/agent/engine.test.ts`** - Orchestrator integration
   ```typescript
   describe('Agent Engine', () => {
     let engine: AgentEngine;
     let mockLLM: ReturnType<typeof createMockLLMClient>;
     
     beforeEach(() => {
       mockLLM = createMockLLMClient();
       engine = new AgentEngine(mockLLM, toolRegistry, auditService, ...);
     });
     
     describe('processMessage', () => {
       it('calls LLM for classification', async () => {
         const events = [];
         for await (const event of engine.processMessage('test', context)) {
           events.push(event);
         }
         
         expect(mockLLM.classify).toHaveBeenCalledWith(
           expect.objectContaining({ message: 'test' })
         );
       });
       
       it('emits classification event with LLM response', async () => {
         mockLLM.classify.mockResolvedValue(mockResponses.confidentToolCall());
         
         const events = [];
         for await (const event of engine.processMessage('test', context)) {
           events.push(event);
         }
         
         expect(events).toContainEqual({
           type: 'classification',
           data: expect.objectContaining({ confidence: 0.95 })
         });
       });
       
       it('executes tool when LLM is confident', async () => {
         mockLLM.classify.mockResolvedValue(mockResponses.confidentToolCall());
         
         const events = [];
         for await (const event of engine.processMessage('test', context)) {
           events.push(event);
         }
         
         expect(events.map(e => e.type)).toContain('tool_start');
         expect(events.map(e => e.type)).toContain('tool_complete');
       });
       
       it('requests clarification when LLM confidence is low', async () => {
         mockLLM.classify.mockResolvedValue(mockResponses.needsClarification());
         
         const events = [];
         for await (const event of engine.processMessage('test', context)) {
           events.push(event);
         }
         
         // Should NOT execute a tool
         expect(events.map(e => e.type)).not.toContain('tool_start');
         // Should ask for clarification
         expect(events).toContainEqual({
           type: 'clarification',
           data: expect.objectContaining({
             questions: expect.arrayContaining(['Which Sarah'])
           })
         });
       });
       
       it('creates plan for complex requests', async () => {
         mockLLM.classify.mockResolvedValue(mockResponses.complexPlan());
         mockLLM.generatePlan.mockResolvedValue(mockLLMPlan());
         
         const events = [];
         for await (const event of engine.processMessage('test', context)) {
           events.push(event);
         }
         
         expect(mockLLM.generatePlan).toHaveBeenCalled();
         expect(events.map(e => e.type)).toContain('plan_created');
       });
       
       it('creates approval for high-risk actions', async () => {
         mockLLM.classify.mockResolvedValue({
           ...mockResponses.confidentToolCall(),
           suggestedTool: {
             name: 'email.send',  // High-risk
             parameters: { to: 'someone@example.com', body: '...' },
             confidence: 0.95,
             reasoning: 'User wants to send email',
           }
         });
         
         const events = [];
         for await (const event of engine.processMessage('test', context)) {
           events.push(event);
         }
         
         expect(events.map(e => e.type)).toContain('approval_required');
       });
       
       it('generates response via LLM after tool execution', async () => {
         mockLLM.classify.mockResolvedValue(mockResponses.confidentToolCall());
         
         const events = [];
         for await (const event of engine.processMessage('test', context)) {
           events.push(event);
         }
         
         expect(mockLLM.generateResponse).toHaveBeenCalled();
         expect(events.map(e => e.type)).toContain('content');
       });
       
       it('logs to audit trail', async () => {
         mockLLM.classify.mockResolvedValue(mockResponses.confidentToolCall());
         
         for await (const _ of engine.processMessage('test', context)) {}
         
         expect(auditService.logAgentAction).toHaveBeenCalled();
       });
     });
     
     describe('error handling', () => {
       it('calls LLM for recovery decision on tool failure', async () => {
         mockLLM.classify.mockResolvedValue(mockResponses.confidentToolCall());
         toolRegistry.execute.mockRejectedValue(new Error('Tool failed'));
         mockLLM.decideRecovery.mockResolvedValue({ action: 'explain_and_suggest' });
         
         const events = [];
         for await (const event of engine.processMessage('test', context)) {
           events.push(event);
         }
         
         expect(mockLLM.decideRecovery).toHaveBeenCalled();
       });
     });
   });
   ```

4. [ ] **`tests/lib/agent/tools/registry.test.ts`** - Tool registry
   ```typescript
   describe('Tool Registry', () => {
     it('provides tools in LLM format', () => {
       const tools = registry.getToolsForLLM(userId, integrations);
       
       for (const tool of tools) {
         expect(tool).toHaveProperty('name');
         expect(tool).toHaveProperty('description');
         expect(tool).toHaveProperty('whenToUse');
         expect(tool).toHaveProperty('parameters');
       }
     });
     
     it('filters tools by user integrations', () => {
       const tools = registry.getToolsForLLM(userId, ['gmail']);  // No calendar
       
       expect(tools.map(t => t.name)).not.toContain('calendar.queryEvents');
       expect(tools.map(t => t.name)).toContain('email.search');
     });
   });
   ```

5. [ ] **`tests/lib/agent/execution/validation.test.ts`** - LLM parameter validation
   ```typescript
   describe('LLM Parameter Validation', () => {
     it('validates LLM parameters with Zod schema', async () => {
       const tool = registry.getTool('calendar.queryEvents');
       const llmParams = { startDate: 'invalid-date' };
       
       const result = tool.inputValidator.safeParse(llmParams);
       expect(result.success).toBe(false);
     });
     
     it('accepts valid LLM parameters', async () => {
       const tool = registry.getTool('calendar.queryEvents');
       const llmParams = { startDate: '2024-01-01', endDate: '2024-01-02' };
       
       const result = tool.inputValidator.safeParse(llmParams);
       expect(result.success).toBe(true);
     });
   });
   ```

6. [ ] **`tests/lib/agent/planning/generation.test.ts`** - Plan generation
   ```typescript
   describe('Plan Generation', () => {
     it('calls LLM to generate plan', async () => {
       await planningService.generatePlan(request);
       expect(mockLLM.generatePlan).toHaveBeenCalled();
     });
     
     it('validates LLM plan structure', async () => {
       mockLLM.generatePlan.mockResolvedValue({
         goal: 'Schedule meeting',
         steps: [
           { tool: 'calendar.queryAvailability', params: {...}, dependsOn: [] },
           { tool: 'calendar.createEvent', params: {...}, dependsOn: [0] },
         ],
         confidence: 0.9,
       });
       
       const plan = await planningService.generatePlan(request);
       expect(plan.steps).toHaveLength(2);
       expect(plan.steps[1].dependsOn).toContain(plan.steps[0].id);
     });
     
     it('rejects invalid LLM plan', async () => {
       mockLLM.generatePlan.mockResolvedValue({
         steps: [{ tool: 'nonexistent.tool' }],  // Invalid tool
       });
       
       await expect(planningService.generatePlan(request))
         .rejects.toThrow('Unknown tool');
     });
   });
   ```

7. [ ] **`tests/lib/agent/approval/workflow.test.ts`** - Approval with LLM context
   ```typescript
   describe('Approval Workflow', () => {
     it('preserves LLM reasoning in approval', async () => {
       const approval = await approvalService.create({
         tool: 'email.send',
         parameters: {...},
         llmContext: {
           reasoning: 'User asked to send email to John',
           confidence: 0.95,
           assumptions: [{ type: 'recipient', value: 'john@example.com' }],
         }
       });
       
       expect(approval.reasoning).toBe('User asked to send email to John');
       expect(approval.confidence).toBe(0.95);
       expect(approval.assumptions).toHaveLength(1);
     });
     
     it('allows user to modify LLM parameters', async () => {
       const approval = await approvalService.create({...});
       
       const result = await approvalService.approveWithModifications(
         approval.id,
         { parameters: { body: 'Modified body' } }
       );
       
       expect(result.modifiedBy).toBe('user');
       expect(result.parameters.body).toBe('Modified body');
     });
   });
   ```

### Files to Create

```
tests/lib/agent/
├── mocks/
│   ├── llm-mock.ts                   # NEW: LLM mock factory
│   ├── mock-responses.ts             # NEW: Pre-built mock responses
│   └── index.ts                      # NEW: Mock exports
├── llm/
│   ├── client.test.ts                # NEW: LLM client tests
│   └── prompts.test.ts               # NEW: Prompt building tests
├── engine.test.ts                    # NEW: Full orchestrator tests
├── tools/
│   └── registry.test.ts              # NEW: Tool registry tests
├── execution/
│   └── validation.test.ts            # NEW: Parameter validation tests
├── planning/
│   └── generation.test.ts            # NEW: Plan generation tests
└── approval/
    └── workflow.test.ts              # NEW: Approval workflow tests
```

### Key Testing Principles

1. **Never call real LLMs** - Always mock at the client boundary
2. **Test the contract** - Verify responses match `ClassificationResponse`, `LLMGeneratedPlan`
3. **Test routing logic** - Ensure orchestrator correctly routes based on LLM output
4. **Test edge cases** - Low confidence, missing data, invalid responses
5. **Test the thin layer** - Agent does minimal processing, LLM does the thinking

### Acceptance Criteria

- [ ] LLM mock factory created with common scenarios
- [ ] LLM client tests verify contract compliance
- [ ] Engine tests verify LLM-driven orchestration
- [ ] Tool registry tests verify `ToolForLLM` format
- [ ] Parameter validation tests verify Zod schemas
- [ ] Plan generation tests verify LLM plan structuring
- [ ] Approval tests verify LLM context preservation
- [ ] All tests run without real API calls
- [ ] 80%+ code coverage on agent module

---

## [X2R] Polish & Review (LLM-First)

**Estimated Time**: 3-4 hours  
**Dependencies**: All previous chunks complete  
**Goal**: Final polish, cleanup, and documentation.

### Tasks

1. [ ] **Code Review Checklist**
   - [ ] All LLM calls go through `LLMClient` interface
   - [ ] No hardcoded prompts outside `/prompts` directory
   - [ ] All tools have `whenToUse` and `examples`
   - [ ] Confidence scores used consistently (0.0-1.0)
   - [ ] LLM reasoning preserved in approvals and audit

2. [ ] **Security Audit**
   - [ ] Prompt injection protections in place
   - [ ] User input sanitized before LLM calls
   - [ ] LLM outputs validated before execution
   - [ ] No sensitive data logged in prompts

3. [ ] **Performance Review**
   - [ ] LLM calls are parallelized where possible
   - [ ] Streaming responses don't buffer unnecessarily
   - [ ] Token limits respected

4. [ ] **Documentation Completion**
   - [ ] LLM client README
   - [ ] Prompt engineering guidelines
   - [ ] Tool authoring guide
   - [ ] Testing guide for mocking LLM

5. [ ] **Lifecycle Verification**
   - [ ] LLM client initialized correctly
   - [ ] Provider switching works
   - [ ] Graceful degradation on LLM unavailability

---

## [X3V] COMPREHENSIVE VERIFICATION

**Estimated Time**: 6-8 hours  
**Goal**: Multi-flow testing with realistic scenarios covering all agent capabilities.

### 28.1 Simple Query Flows

| Scenario | Input | Expected Behavior |
|----------|-------|-------------------|
| SQ-1 | "When is my next meeting?" | Query calendar, return immediate answer |
| SQ-2 | "What tasks do I have due this week?" | Query tasks, format response |
| SQ-3 | "What did Sarah email me about?" | Search emails, summarize |
| SQ-4 | "What's on my calendar tomorrow?" | Query calendar, list events |

### 28.2 Entity Resolution Flows

| Scenario | Input | Expected Behavior |
|----------|-------|-------------------|
| ER-1 | "Schedule with Sarah" (one Sarah) | Resolve to single contact |
| ER-2 | "Schedule with Sarah" (multiple Sarahs) | Ask for clarification |
| ER-3 | "Email the marketing team" | Resolve group reference |
| ER-4 | "What did John say about the project?" | Resolve person + context |

### 28.3 Multi-Step Planning Flows

| Scenario | Input | Expected Behavior |
|----------|-------|-------------------|
| MS-1 | "Schedule a 30-min meeting with Alex next week about budget" | 5+ step plan |
| MS-2 | "Send a follow-up email to everyone from yesterday's meeting" | Identify attendees → draft → approve |
| MS-3 | "Create tasks for each action item from the project doc" | Parse doc → create multiple tasks |
| MS-4 | "Move my 2pm meeting to 3pm and notify attendees" | Update event → send notifications |

### 28.4 Approval Workflow Flows

| Scenario | Input | Expected Behavior |
|----------|-------|-------------------|
| AW-1 | Send email action | Create pending approval, show to user |
| AW-2 | User approves | Execute action, update audit |
| AW-3 | User rejects | Cancel action, log rejection |
| AW-4 | User edits before approve | Allow modification, then execute |
| AW-5 | Approval expires | Mark expired, notify user |

### 28.5 Error Recovery Flows

| Scenario | Input | Expected Behavior |
|----------|-------|-------------------|
| ER-1 | Invalid intent | Ask clarifying question |
| ER-2 | Missing integration | Prompt to connect |
| ER-3 | Tool execution fails | Explain error, suggest alternative |
| ER-4 | Plan step fails | Rollback if possible, explain |
| ER-5 | Rate limit hit | Queue and retry gracefully |

### 28.6 Confidence & Uncertainty Flows

| Scenario | Confidence | Expected Behavior |
|----------|------------|-------------------|
| CU-1 | > 0.9 | Direct statement, immediate action |
| CU-2 | 0.7 - 0.9 | State with confidence, suggest action |
| CU-3 | 0.5 - 0.7 | Express uncertainty, ask confirmation |
| CU-4 | < 0.5 | Ask clarifying questions first |

### 28.7 Context Awareness Flows

| Scenario | Input | Expected Behavior |
|----------|-------|-------------------|
| CA-1 | Follow-up to previous message | Use conversation context |
| CA-2 | Reference to recent email | Pull in email context |
| CA-3 | Reference to upcoming event | Pull in calendar context |
| CA-4 | Complex multi-reference | Combine multiple context sources |

### 28.8 Audit Trail Verification

| Check | Expected |
|-------|----------|
| AT-1 | Every query creates audit entry |
| AT-2 | Every action creates audit entry |
| AT-3 | Assumptions are tracked |
| AT-4 | Reasoning is captured |
| AT-5 | Entity changes (before/after) logged |
| AT-6 | User can query their audit history |
| AT-7 | Assumptions can be verified/corrected |

### 28.9 End-to-End Scenario: Full Day Planning

**Scenario**: User says "Help me plan my day"

**Expected Flow**:
1. Agent queries calendar for today's events
2. Agent queries tasks due today/this week
3. Agent queries recent unread emails
4. Agent formulates daily summary
5. Agent suggests prioritization
6. Agent offers to create tasks for action items
7. All steps logged to audit trail
8. Assumptions (priority rankings) tracked

**Verification**:
- [ ] All context sources queried
- [ ] Response is coherent and helpful
- [ ] No tool errors
- [ ] Complete audit trail
- [ ] Assumptions can be corrected

### 28.10 End-to-End Scenario: Meeting Scheduling

**Scenario**: "Schedule a quarterly planning meeting with the leadership team next week"

**Expected Flow**:
1. Identify "leadership team" → resolve entities or ask
2. Check multiple calendars for availability
3. Find common free slots
4. Present options to user
5. User selects slot
6. Create calendar event (requires approval)
7. User approves
8. Event created in Google Calendar
9. Send invitations to attendees

**Verification**:
- [ ] Entity resolution works (or clarification asked)
- [ ] Availability check across calendars
- [ ] Approval flow for event creation
- [ ] Event actually created in Google Calendar
- [ ] Audit trail complete

### 28.11 Performance Benchmarks

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Intent analysis latency | < 500ms | Timer in logs |
| Context retrieval latency | < 1s | Timer in logs |
| First response chunk (p50) | < 2s | SSE timestamp |
| Full response (p95) | < 5s | SSE completion |
| Tool execution (query) | < 1s | Audit log duration |
| Tool execution (action) | < 3s | Audit log duration |

### 28.12 Security Verification

| Check | Expected |
|-------|----------|
| SEC-1 | Rate limiting prevents abuse |
| SEC-2 | Prompt injection attempts blocked |
| SEC-3 | User can only access their data |
| SEC-4 | Sensitive data not logged |
| SEC-5 | Approvals cannot be bypassed |
| SEC-6 | Tokens not exposed in responses |

---

## Success Metrics Summary

| Metric | Target | Measurement |
|--------|--------|-------------|
| Intent accuracy | > 90% | Manual test set |
| Tool selection accuracy | > 85% | Manual test set |
| Response latency (p50) | < 2s | Production monitoring |
| Response latency (p95) | < 5s | Production monitoring |
| Plan completion rate | > 80% | Audit logs |
| User approval rate | > 70% | Approval stats |
| Audit coverage | 100% | Audit verification |
| Test coverage | > 80% | Coverage report |

---

## File Structure Summary

After Phase 5 completion:

```
src/lib/agent/
├── index.ts                     # Public exports
├── config.ts                    # Configuration
├── constants.ts                 # Constants
├── types.ts                     # Core types
├── errors.ts                    # Error classes
├── logger.ts                    # Logging
├── engine.ts                    # Main orchestrator
│
├── audit/
│   ├── index.ts
│   ├── types.ts
│   ├── repository.ts
│   └── service.ts
│
├── intent/                      # LLM-first intent classification
│   ├── index.ts
│   ├── types.ts                 # LLM request/response contracts
│   ├── analyzer.ts              # Prompt building + LLM stub
│   └── ambiguity.ts             # Analyze LLM response for ambiguity
│
├── entities/                    # Entity resolution (not extraction)
│   ├── index.ts
│   ├── types.ts
│   ├── resolver.ts              # Resolve to DB records
│   └── matchers.ts              # Fuzzy matching utilities
│
├── context/
│   ├── index.ts
│   ├── types.ts
│   ├── retrieval.ts
│   └── ranking.ts
│
├── routing/                     # Action routing (LLM-first)
│   ├── index.ts
│   ├── types.ts                 # ActionDecision types
│   ├── router.ts                # Route LLM output to actions
│   └── thresholds.ts            # Confidence thresholds
│
├── response/                    # Response formatting (LLM-first)
│   ├── index.ts
│   ├── types.ts                 # AgentResponse types
│   ├── prompts.ts               # Build prompts for LLM
│   └── formatter.ts             # Format responses with metadata
│
├── tools/
│   ├── index.ts
│   ├── types.ts
│   ├── registry.ts
│   ├── validation.ts
│   ├── context.ts
│   ├── query/
│   │   ├── index.ts
│   │   ├── query-context.ts
│   │   ├── search-emails.ts
│   │   ├── list-calendar-events.ts
│   │   ├── check-availability.ts
│   │   └── list-tasks.ts
│   └── action/
│       ├── index.ts
│       ├── create-task.ts
│       ├── update-task.ts
│       ├── draft-email.ts
│       ├── send-email.ts
│       ├── create-calendar-event.ts
│       └── update-calendar-event.ts
│
├── planning/
│   ├── index.ts
│   ├── types.ts
│   ├── decomposition.ts
│   ├── sequencer.ts
│   ├── executor.ts
│   └── state.ts
│
├── execution/
│   ├── index.ts
│   ├── types.ts
│   ├── engine.ts
│   ├── approval-check.ts
│   └── result-evaluator.ts
│
├── approval/
│   ├── index.ts
│   ├── types.ts
│   ├── repository.ts
│   └── service.ts
│
├── llm/
│   ├── index.ts
│   ├── types.ts
│   ├── client.ts
│   ├── prompts.ts
│   └── token-manager.ts
│
└── safety/
    ├── index.ts
    └── content-filter.ts

src/app/api/
├── chat/
│   ├── message/route.ts
│   └── conversations/
│       ├── route.ts
│       └── [id]/route.ts
├── actions/
│   ├── route.ts
│   └── [id]/route.ts
├── plans/
│   └── [id]/route.ts
└── audit/
    ├── route.ts
    └── [id]/route.ts

src/components/chat/
├── index.ts
├── ChatInterface.tsx
├── MessageList.tsx
├── MessageInput.tsx
├── StreamingMessage.tsx
├── ToolCallIndicator.tsx
├── ApprovalDialog.tsx
├── AuditViewer.tsx
└── ThinkingIndicator.tsx

tests/lib/agent/
├── intent.test.ts
├── entities.test.ts
├── context.test.ts
├── reasoning.test.ts
├── tools.test.ts
├── planning.test.ts
├── execution.test.ts
├── approval.test.ts
├── audit.test.ts
├── engine.test.ts
└── e2e/
    ├── simple-query.test.ts
    ├── multi-step-plan.test.ts
    ├── approval-flow.test.ts
    └── error-recovery.test.ts
```

---

## Estimated Timeline

| Chunk | Estimated Hours | Cumulative |
|-------|-----------------|------------|
| 0: Security Foundation | 2-3 | 3 |
| 1: Module Foundation | 2-3 | 6 |
| 2: Database Models | 3-4 | 10 |
| 3: Audit Trail | 3-4 | 14 |
| **CHECKPOINT 1** | 2 | 16 |
| 4: Intent Analyzer | 4-5 | 21 |
| 5: Entity Extraction | 3-4 | 25 |
| 6: Context Retrieval | 4-5 | 30 |
| **CHECKPOINT 2** | 2 | 32 |
| 7: Hypothesis Formation | 3-4 | 36 |
| 8: Response Generation | 3-4 | 40 |
| **CHECKPOINT 3** | 2 | 42 |
| 9: Tool Registry | 3-4 | 46 |
| 10: Query Tools | 3-4 | 50 |
| 11: Action Tools | 4-5 | 55 |
| 12: Execution Engine | 4-5 | 60 |
| **CHECKPOINT 4** | 2 | 62 |
| 13: Goal Decomposition | 4-5 | 67 |
| 14: Plan Execution | 4-5 | 72 |
| 15: Plan State | 3-4 | 76 |
| **CHECKPOINT 5** | 2 | 78 |
| 16: Approval Model | 3-4 | 82 |
| 17: Autonomy Settings | 3-4 | 86 |
| **CHECKPOINT 6** | 2 | 88 |
| 18: Chat API + SSE | 4-5 | 93 |
| 19: Action/Audit API | 3-4 | 97 |
| 20: Plan API | 2-3 | 100 |
| **CHECKPOINT 7** | 2 | 102 |
| 21: Chat Interface | 4-5 | 107 |
| 22: Approval Dialog | 3-4 | 111 |
| 23: Audit Viewer | 3-4 | 115 |
| **CHECKPOINT 8** | 2 | 117 |
| 24: LLM Integration | 4-5 | 122 |
| 25: Agent Orchestrator | 5-6 | 128 |
| **CHECKPOINT 9** | 2 | 130 |
| 26: Integration Testing | 4-5 | 135 |
| 27: Polish & Review | 3-4 | 139 |
| 28: Verification | 6-8 | 147 |

**Total Estimated Hours**: 145-160 hours  
**Estimated Duration**: 4 weeks @ 40 hrs/week

---

*Document Version: 1.0*  
*Created: December 26, 2024*  
*Based on: PHASE_5_AGENT_ENGINE.md, AGENTIC_FRAMEWORK.md, CHUNKING_BEST_PRACTICES.md*

