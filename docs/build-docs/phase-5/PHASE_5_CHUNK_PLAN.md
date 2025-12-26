# Phase 5: Agent Engine - Chunk Plan

> **Status**: Planning v1.0  
> **Created**: December 26, 2024  
> **Duration**: Weeks 14-17  
> **Dependencies**: Phase 1 (Core Foundation), Phase 2 (Context System), Phase 3 (Gmail), Phase 4 (Calendar)

---

## Overview

This document breaks down Phase 5 (Agent Engine) into granular implementation chunks. Given that this is the "heart and soul" of Theo, we use more chunks than typical phases to ensure careful, auditable progress with regular checkpoints.

**Phase Goal**: Build the intelligent brain of Theo—the Agent Engine that transforms simple chat into context-aware, action-capable assistance with complete auditability.

---

## Chunk Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              FOUNDATION LAYER (Chunks 0-3)                           │
│                                                                                      │
│  Chunk 0: Security & Infrastructure Foundation                                       │
│      │                                                                               │
│      ▼                                                                               │
│  Chunk 1: Agent Module Foundation (types, constants, logger, errors)                 │
│      │                                                                               │
│      ├────────────────────────┬──────────────────────────────────────────┐          │
│      ▼                        ▼                                          ▼          │
│  Chunk 2:                 Chunk 3:                                                   │
│  Database Models          Audit Trail                                               │
│  & Migrations             System                                                    │
│      │                        │                                                      │
│      └────────────┬───────────┘                                                      │
└───────────────────│──────────────────────────────────────────────────────────────────┘
                    │
            ═══════════════════
            ║ CHECKPOINT 1    ║
            ║ Foundation      ║
            ═══════════════════
                    │
┌───────────────────│──────────────────────────────────────────────────────────────────┐
│                   ▼                                                                   │
│                      PERCEPTION LAYER (Chunks 4-6)                                    │
│                                                                                       │
│  Chunk 4: Intent Analyzer                                                            │
│      │                                                                                │
│      ├────────────────────────┐                                                       │
│      ▼                        ▼                                                       │
│  Chunk 5:                 Chunk 6:                                                    │
│  Entity Extraction        Context Retrieval                                          │
│  & Resolution             Service                                                    │
│      │                        │                                                       │
│      └────────────┬───────────┘                                                       │
└───────────────────│───────────────────────────────────────────────────────────────────┘
                    │
            ═══════════════════
            ║ CHECKPOINT 2    ║
            ║ Perception      ║
            ═══════════════════
                    │
┌───────────────────│───────────────────────────────────────────────────────────────────┐
│                   ▼                                                                    │
│                      REASONING LAYER (Chunks 7-8)                                      │
│                                                                                        │
│  Chunk 7: Hypothesis Formation & Confidence Scoring                                    │
│      │                                                                                 │
│      ▼                                                                                 │
│  Chunk 8: Response Generation & Uncertainty Expression                                 │
│      │                                                                                 │
└──────│─────────────────────────────────────────────────────────────────────────────────┘
       │
            ═══════════════════
            ║ CHECKPOINT 3    ║
            ║ Reasoning       ║
            ═══════════════════
       │
┌──────│─────────────────────────────────────────────────────────────────────────────────┐
│      ▼                                                                                  │
│                         TOOL SYSTEM (Chunks 9-12)                                       │
│                                                                                         │
│  Chunk 9: Tool Registry & Type-Safe Definitions                                         │
│      │                                                                                  │
│      ▼                                                                                  │
│  Chunk 10: Core Query Tools (context, email, calendar)                                  │
│      │                                                                                  │
│      ▼                                                                                  │
│  Chunk 11: Core Action Tools (task, create, send)                                       │
│      │                                                                                  │
│      ▼                                                                                  │
│  Chunk 12: Tool Execution Engine                                                        │
│      │                                                                                  │
└──────│──────────────────────────────────────────────────────────────────────────────────┘
       │
            ═══════════════════
            ║ CHECKPOINT 4    ║
            ║ Tool System     ║
            ═══════════════════
       │
┌──────│──────────────────────────────────────────────────────────────────────────────────┐
│      ▼                                                                                   │
│                         PLANNING LAYER (Chunks 13-15)                                    │
│                                                                                          │
│  Chunk 13: Goal Decomposition & Step Sequencing                                          │
│      │                                                                                   │
│      ▼                                                                                   │
│  Chunk 14: Plan Execution Engine & Dependency Tracking                                   │
│      │                                                                                   │
│      ▼                                                                                   │
│  Chunk 15: Plan State Management & Recovery                                              │
│      │                                                                                   │
└──────│───────────────────────────────────────────────────────────────────────────────────┘
       │
            ═══════════════════
            ║ CHECKPOINT 5    ║
            ║ Planning        ║
            ═══════════════════
       │
┌──────│───────────────────────────────────────────────────────────────────────────────────┐
│      ▼                                                                                    │
│                        APPROVAL WORKFLOW (Chunks 16-17)                                   │
│                                                                                           │
│  Chunk 16: Action Approval Model & Pending Actions                                        │
│      │                                                                                    │
│      ▼                                                                                    │
│  Chunk 17: User Autonomy Settings & Approval Execution                                    │
│      │                                                                                    │
└──────│────────────────────────────────────────────────────────────────────────────────────┘
       │
            ═══════════════════
            ║ CHECKPOINT 6    ║
            ║ Approvals       ║
            ═══════════════════
       │
┌──────│────────────────────────────────────────────────────────────────────────────────────┐
│      ▼                                                                                     │
│                          API & STREAMING (Chunks 18-20)                                    │
│                                                                                            │
│  Chunk 18: Chat Message API with SSE Streaming                                             │
│      │                                                                                     │
│      ▼                                                                                     │
│  Chunk 19: Action & Audit API Routes                                                       │
│      │                                                                                     │
│      ▼                                                                                     │
│  Chunk 20: Plan Management API Routes                                                      │
│      │                                                                                     │
└──────│─────────────────────────────────────────────────────────────────────────────────────┘
       │
            ═══════════════════
            ║ CHECKPOINT 7    ║
            ║ APIs Complete   ║
            ═══════════════════
       │
┌──────│─────────────────────────────────────────────────────────────────────────────────────┐
│      ▼                                                                                      │
│                             UI INTEGRATION (Chunks 21-23)                                   │
│                                                                                             │
│  Chunk 21: Streaming Chat Interface                                                         │
│      │                                                                                      │
│      ▼                                                                                      │
│  Chunk 22: Approval Dialog & Action Preview                                                 │
│      │                                                                                      │
│      ▼                                                                                      │
│  Chunk 23: Audit Viewer & Reasoning Display                                                 │
│      │                                                                                      │
└──────│──────────────────────────────────────────────────────────────────────────────────────┘
       │
            ═══════════════════
            ║ CHECKPOINT 8    ║
            ║ UI Complete     ║
            ═══════════════════
       │
┌──────│──────────────────────────────────────────────────────────────────────────────────────┐
│      ▼                                                                                       │
│                            LLM INTEGRATION (Chunk 24)                                        │
│                                                                                              │
│  Chunk 24: LLM Provider Integration & Prompt Management                                      │
│      │                                                                                       │
└──────│───────────────────────────────────────────────────────────────────────────────────────┘
       │
┌──────│───────────────────────────────────────────────────────────────────────────────────────┐
│      ▼                                                                                        │
│                            AGENT CORE (Chunk 25)                                              │
│                                                                                               │
│  Chunk 25: Agent Engine Orchestrator - Wire Everything Together                              │
│      │                                                                                        │
└──────│────────────────────────────────────────────────────────────────────────────────────────┘
       │
            ═══════════════════
            ║ CHECKPOINT 9    ║
            ║ Agent Core      ║
            ═══════════════════
       │
┌──────│────────────────────────────────────────────────────────────────────────────────────────┐
│      ▼                                                                                         │
│                          FINALIZATION (Chunks 26-28)                                           │
│                                                                                                │
│  Chunk 26: Integration Testing                                                                 │
│      │                                                                                         │
│      ▼                                                                                         │
│  Chunk 27: Polish & Review                                                                     │
│      │                                                                                         │
│      ▼                                                                                         │
│  Chunk 28: COMPREHENSIVE VERIFICATION - Multi-Flow Testing                                     │
│                                                                                                │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Parallelization Analysis

| Chunks | Can Run in Parallel? | Notes |
|--------|---------------------|-------|
| 0 → 1 | ❌ Sequential | 1 depends on 0 |
| 2, 3 | ✅ Parallel | Both depend on Chunk 1 |
| 4 | ❌ Sequential | Foundation for perception |
| 5, 6 | ✅ Parallel | Both depend on Chunk 4 |
| 7, 8 | ❌ Sequential | Reasoning pipeline |
| 9 → 12 | ❌ Sequential | Tool system builds up |
| 13 → 15 | ❌ Sequential | Planning pipeline |
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

## Chunk 0: Security & Infrastructure Foundation

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

## Chunk 1: Agent Module Foundation

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

## Chunk 2: Database Models & Migrations

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

## Chunk 3: Audit Trail System

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
## CHECKPOINT 1: Foundation Layer
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

## Chunk 4: Intent Analyzer

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 1  
**Goal**: Build the intent understanding system.

### Prerequisites

- [ ] Chunk 1 complete (types available)

### Architecture Notes

The Intent Analyzer extracts structured understanding from natural language:
- Primary intent classification
- Confidence scoring
- Entity extraction (deferred to Chunk 5)
- Ambiguity detection
- Clarification generation

This chunk focuses on the intent analysis structure without LLM integration (that comes in Chunk 24).

### Tasks

1. [ ] Create `src/lib/agent/intent/types.ts`
   ```typescript
   export interface IntentAnalysis {
     intent: string;           // e.g., 'schedule_meeting', 'send_email'
     confidence: number;       // 0.0 - 1.0
     entities: EntityReference[];
     impliedNeeds: string[];
     clarificationNeeded: boolean;
     clarificationQuestions: string[];
     assumptions: Assumption[];
   }
   
   export interface EntityReference {
     type: EntityType;
     value: string;
     resolved?: ResolvedEntity;
     confidence: number;
   }
   
   export type IntentCategory = 
     | 'query'        // Information retrieval
     | 'schedule'     // Calendar operations
     | 'communicate'  // Email/Slack
     | 'task'         // Task management
     | 'remind'       // Reminders
     | 'summarize'    // Summaries
     | 'search'       // Search operations
     | 'unknown';     // Unclear intent
   ```

2. [ ] Create `src/lib/agent/intent/analyzer.ts`
   ```typescript
   export interface IntentAnalyzer {
     analyze(message: string, history: Message[]): Promise<IntentAnalysis>;
     detectAmbiguity(intent: IntentAnalysis): AmbiguityInfo;
     generateClarification(ambiguity: AmbiguityInfo): string[];
   }
   
   export function createIntentAnalyzer(
     config: IntentAnalyzerConfig
   ): IntentAnalyzer;
   ```

3. [ ] Create `src/lib/agent/intent/ambiguity.ts`
   - Ambiguity detection logic
   - Clarification question generation
   - Confidence thresholds

4. [ ] Create `src/lib/agent/intent/intent-patterns.ts`
   - Pattern matching for common intents
   - Fallback heuristics when LLM unavailable

5. [ ] Create `src/lib/agent/intent/index.ts`
   - Export all intent functions

### Files to Create

```
src/lib/agent/intent/
├── index.ts              # NEW: Exports
├── types.ts              # NEW: Intent types
├── analyzer.ts           # NEW: Intent analyzer
├── ambiguity.ts          # NEW: Ambiguity detection
├── intent-patterns.ts    # NEW: Pattern matching
```

### Security Checklist

- [ ] Input sanitized before analysis
- [ ] No prompt injection vulnerabilities
- [ ] Rate limiting considered

### Testing Requirements

- [ ] Test intent classification
- [ ] Test ambiguity detection
- [ ] Test clarification generation
- [ ] Test with edge cases

### Acceptance Criteria

- [ ] Intent analysis structure complete
- [ ] Ambiguity detection working
- [ ] Pattern matching fallbacks
- [ ] All tests pass

---

## Chunk 5: Entity Extraction & Resolution

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 4, Chunk 2  
**Goal**: Extract and resolve entities mentioned in messages.

### Prerequisites

- [ ] Chunk 4 complete (intent types available)
- [ ] Chunk 2 complete (database for resolution)

### Architecture Notes

Entity extraction identifies references to:
- People (names → Person records)
- Dates/Times (natural language → Date objects)
- Places/Locations
- Events (references → Event records)
- Tasks

Resolution connects mentions to actual database records.

### Tasks

1. [ ] Create `src/lib/agent/entities/types.ts`
   ```typescript
   export type EntityType = 
     | 'person'
     | 'date'
     | 'time'
     | 'datetime'
     | 'duration'
     | 'location'
     | 'event'
     | 'task'
     | 'email'
     | 'unknown';
   
   export interface ExtractedEntity {
     type: EntityType;
     text: string;          // Original text
     value: unknown;        // Parsed value
     confidence: number;
     startIndex: number;
     endIndex: number;
   }
   
   export interface ResolvedEntity extends ExtractedEntity {
     resolved: true;
     entityId: string;
     entityType: string;
     metadata: Record<string, unknown>;
   }
   ```

2. [ ] Create `src/lib/agent/entities/extractor.ts`
   ```typescript
   export async function extractEntities(
     text: string
   ): Promise<ExtractedEntity[]>;
   
   export function extractDates(text: string): ExtractedEntity[];
   export function extractPeople(text: string): ExtractedEntity[];
   export function extractLocations(text: string): ExtractedEntity[];
   ```

3. [ ] Create `src/lib/agent/entities/resolver.ts`
   ```typescript
   export async function resolveEntities(
     userId: string,
     entities: ExtractedEntity[]
   ): Promise<ResolvedEntity[]>;
   
   export async function resolvePerson(
     userId: string,
     name: string
   ): Promise<Person | null>;
   
   export async function resolveEvent(
     userId: string,
     description: string
   ): Promise<Event | null>;
   ```

4. [ ] Integrate date parsing library (chrono-node or similar)

5. [ ] Create `src/lib/agent/entities/index.ts`

### Files to Create

```
src/lib/agent/entities/
├── index.ts              # NEW: Exports
├── types.ts              # NEW: Entity types
├── extractor.ts          # NEW: Entity extraction
├── resolver.ts           # NEW: Entity resolution
```

### Testing Requirements

- [ ] Test date extraction (various formats)
- [ ] Test person name extraction
- [ ] Test entity resolution to DB records
- [ ] Test ambiguous entity handling

### Acceptance Criteria

- [ ] Entity extraction working
- [ ] Entity resolution working
- [ ] Date parsing handles natural language
- [ ] All tests pass

---

## Chunk 6: Context Retrieval Service

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 4, Chunk 5  
**Goal**: Build multi-source context retrieval for intent understanding.

### Prerequisites

- [ ] Chunk 4 complete (intent available)
- [ ] Chunk 5 complete (entities resolved)

### Architecture Notes

Context retrieval gathers relevant information from:
- Structured data (people, events, tasks)
- Conversation history
- Semantic search (embeddings)
- Recent interactions

The service must rank and prioritize context by relevance.

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
## CHECKPOINT 2: Perception Layer
## ═══════════════════════════════════════════════════

**Pre-Conditions**:
- [ ] Chunks 4, 5, 6 complete
- [ ] All tests passing
- [ ] No TypeScript errors

**Review Criteria**:
- [ ] Intent analysis structure complete
- [ ] Entity extraction handles edge cases
- [ ] Context retrieval integrates all sources
- [ ] Relevance ranking appropriate

**Testing Criteria**:
- [ ] Unit tests > 80% coverage
- [ ] Integration tests for perception pipeline
- [ ] Test with realistic user messages

**Manual Testing Scenarios**:
- [ ] "Schedule a meeting with Sarah next Tuesday" → extracts person, date
- [ ] "What's on my calendar?" → query intent detected
- [ ] "Send an email to the team" → ambiguous "team" detected

**Audit Criteria**:
- [ ] No hardcoded values
- [ ] Follows project patterns
- [ ] Error handling complete

**Sign-Off**: _________________ Date: _________

---

## Chunk 7: Hypothesis Formation & Confidence Scoring

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 6  
**Goal**: Form hypotheses about user needs with confidence scores.

### Prerequisites

- [ ] Chunk 6 complete (context available)

### Architecture Notes

Based on intent + context, the agent forms hypotheses:
- Multiple possible interpretations
- Confidence scoring for each
- Evidence tracking (what supports/contradicts)
- Suggested actions per hypothesis

### Tasks

1. [ ] Create `src/lib/agent/reasoning/types.ts`
   ```typescript
   export interface Hypothesis {
     id: string;
     statement: string;
     confidence: number;
     supportingEvidence: Evidence[];
     contradictingEvidence: Evidence[];
     suggestedActions: Action[];
   }
   
   export interface Evidence {
     source: 'user_input' | 'context' | 'inference' | 'history';
     content: string;
     weight: number;
   }
   ```

2. [ ] Create `src/lib/agent/reasoning/hypothesis.ts`
   ```typescript
   export async function formHypotheses(
     intent: IntentAnalysis,
     context: ContextRetrieval
   ): Promise<Hypothesis[]>;
   
   export function scoreConfidence(
     hypothesis: Hypothesis
   ): number;
   
   export function selectBestHypothesis(
     hypotheses: Hypothesis[]
   ): Hypothesis;
   ```

3. [ ] Create `src/lib/agent/reasoning/confidence.ts`
   - Confidence scoring algorithms
   - Evidence weighting
   - Threshold enforcement

4. [ ] Create `src/lib/agent/reasoning/index.ts`

### Files to Create

```
src/lib/agent/reasoning/
├── index.ts              # NEW: Exports
├── types.ts              # NEW: Reasoning types
├── hypothesis.ts         # NEW: Hypothesis formation
├── confidence.ts         # NEW: Confidence scoring
```

### Testing Requirements

- [ ] Test hypothesis formation
- [ ] Test confidence scoring
- [ ] Test evidence weighting
- [ ] Test best hypothesis selection

### Acceptance Criteria

- [ ] Hypotheses formed correctly
- [ ] Confidence scoring working
- [ ] Evidence tracked properly
- [ ] All tests pass

---

## Chunk 8: Response Generation & Uncertainty Expression

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 7  
**Goal**: Generate responses with appropriate uncertainty expression.

### Prerequisites

- [ ] Chunk 7 complete (hypotheses available)

### Architecture Notes

Response generation must:
- Express confidence appropriately
- Ask clarification when uncertain
- State assumptions explicitly
- Provide actionable responses

### Tasks

1. [ ] Create `src/lib/agent/response/types.ts`
   ```typescript
   export interface AgentResponse {
     content: string;
     confidence: number;
     clarificationNeeded: boolean;
     clarifications?: string[];
     assumptions: Assumption[];
     suggestedActions?: ActionSuggestion[];
     metadata: ResponseMetadata;
   }
   ```

2. [ ] Create `src/lib/agent/response/generator.ts`
   ```typescript
   export async function generateResponse(
     hypothesis: Hypothesis,
     context: ContextRetrieval
   ): Promise<AgentResponse>;
   
   export function expressUncertainty(
     confidence: number,
     content: string
   ): string;
   
   export function formatClarificationRequest(
     questions: string[]
   ): string;
   ```

3. [ ] Create `src/lib/agent/response/uncertainty.ts`
   - Uncertainty language patterns
   - Confidence → language mapping
   - Hedging strategies

4. [ ] Create `src/lib/agent/response/index.ts`

### Files to Create

```
src/lib/agent/response/
├── index.ts              # NEW: Exports
├── types.ts              # NEW: Response types
├── generator.ts          # NEW: Response generation
├── uncertainty.ts        # NEW: Uncertainty expression
```

### Testing Requirements

- [ ] Test response generation
- [ ] Test uncertainty expression
- [ ] Test clarification formatting
- [ ] Test assumption listing

### Acceptance Criteria

- [ ] Responses generated correctly
- [ ] Uncertainty expressed appropriately
- [ ] Clarifications formatted well
- [ ] All tests pass

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 3: Reasoning Layer
## ═══════════════════════════════════════════════════

**Pre-Conditions**:
- [ ] Chunks 7, 8 complete
- [ ] All tests passing
- [ ] No TypeScript errors

**Review Criteria**:
- [ ] Hypothesis formation logical
- [ ] Confidence scoring calibrated
- [ ] Uncertainty expression natural
- [ ] Assumptions tracked

**Testing Criteria**:
- [ ] Unit tests > 80% coverage
- [ ] Integration tests for reasoning pipeline
- [ ] Edge case handling

**Manual Testing Scenarios**:
- [ ] Low confidence → "I'm not sure, but..."
- [ ] High confidence → Direct statement
- [ ] Ambiguous → Asks clarification

**Sign-Off**: _________________ Date: _________

---

## Chunk 9: Tool Registry & Type-Safe Definitions

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 1  
**Goal**: Create the type-safe tool registry system.

### Prerequisites

- [ ] Chunk 1 complete (types available)

### Architecture Notes

The Tool Registry is the foundation for all agent actions:
- Type-safe tool definitions with Zod schemas
- Category classification (query, create, update, delete, external)
- Risk level assessment
- Required integrations tracking
- Approval requirements

### Tasks

1. [ ] Create `src/lib/agent/tools/types.ts`
   ```typescript
   export type ToolCategory = 
     | 'query'
     | 'compute'
     | 'draft'
     | 'create'
     | 'update'
     | 'delete'
     | 'external';
   
   export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
   
   export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
     name: string;
     description: string;
     category: ToolCategory;
     inputSchema: z.ZodSchema<TInput>;
     outputSchema: z.ZodSchema<TOutput>;
     requiredIntegrations: string[];
     riskLevel: RiskLevel;
     requiresApproval: boolean;
     execute: (input: TInput, context: ExecutionContext) => Promise<TOutput>;
     undo?: (result: TOutput, context: ExecutionContext) => Promise<void>;
   }
   ```

2. [ ] Create `src/lib/agent/tools/registry.ts`
   ```typescript
   export class ToolRegistry {
     register<T, R>(tool: ToolDefinition<T, R>): void;
     get(name: string): ToolDefinition | undefined;
     list(category?: ToolCategory): ToolDefinition[];
     has(name: string): boolean;
     validateCall(name: string, params: unknown): ValidationResult;
     getForLLM(): ToolDescriptionForLLM[];
   }
   
   export const toolRegistry = new ToolRegistry();
   ```

3. [ ] Create `src/lib/agent/tools/validation.ts`
   - Parameter validation with Zod
   - Error formatting
   - Type-safe call creation

4. [ ] Create `src/lib/agent/tools/context.ts`
   ```typescript
   export interface ExecutionContext {
     userId: string;
     sessionId?: string;
     conversationId?: string;
     planId?: string;
     stepIndex?: number;
     accessToken?: string;
   }
   ```

5. [ ] Create `src/lib/agent/tools/index.ts`

### Files to Create

```
src/lib/agent/tools/
├── index.ts              # NEW: Exports
├── types.ts              # NEW: Tool types
├── registry.ts           # NEW: Tool registry
├── validation.ts         # NEW: Parameter validation
├── context.ts            # NEW: Execution context
```

### Testing Requirements

- [ ] Test tool registration
- [ ] Test tool retrieval
- [ ] Test parameter validation
- [ ] Test category filtering

### Acceptance Criteria

- [ ] Registry working
- [ ] Type-safe definitions
- [ ] Validation working
- [ ] All tests pass

---

## Chunk 10: Core Query Tools

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 9  
**Goal**: Implement core read-only query tools.

### Prerequisites

- [ ] Chunk 9 complete (registry available)

### Architecture Notes

Query tools are low-risk, read-only operations:
- Context queries
- Calendar queries
- Email search
- Task queries

These can execute without approval.

### Tasks

1. [ ] Create `src/lib/agent/tools/query/query-context.ts`
   ```typescript
   export const queryContextTool: ToolDefinition = {
     name: 'query_context',
     description: 'Search user context for relevant information',
     category: 'query',
     riskLevel: 'low',
     requiresApproval: false,
     inputSchema: z.object({
       query: z.string(),
       entityType: z.enum(['person', 'event', 'task', 'any']).optional(),
       limit: z.number().max(20).optional(),
     }),
     outputSchema: z.object({
       results: z.array(ContextResultSchema),
       totalCount: z.number(),
     }),
     requiredIntegrations: [],
     execute: async (input, context) => { ... },
   };
   ```

2. [ ] Create `src/lib/agent/tools/query/search-emails.ts`
   - Search email archive
   - Filter by sender, date, labels

3. [ ] Create `src/lib/agent/tools/query/list-calendar-events.ts`
   - Query calendar events
   - Filter by date range, attendees

4. [ ] Create `src/lib/agent/tools/query/check-availability.ts`
   - Find free time slots
   - Check conflicts

5. [ ] Create `src/lib/agent/tools/query/list-tasks.ts`
   - Query user's tasks
   - Filter by status, deadline

6. [ ] Register all query tools with registry

### Files to Create

```
src/lib/agent/tools/query/
├── index.ts                  # NEW: Exports
├── query-context.ts          # NEW: Context query
├── search-emails.ts          # NEW: Email search
├── list-calendar-events.ts   # NEW: Calendar query
├── check-availability.ts     # NEW: Availability check
├── list-tasks.ts             # NEW: Task query
```

### Testing Requirements

- [ ] Test each query tool
- [ ] Test with valid/invalid params
- [ ] Test integration with existing services

### Acceptance Criteria

- [ ] All query tools implemented
- [ ] Registered with registry
- [ ] All tests pass

---

## Chunk 11: Core Action Tools

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 10  
**Goal**: Implement core action tools (create, update, delete, send).

### Prerequisites

- [ ] Chunk 10 complete

### Architecture Notes

Action tools have higher risk and may require approval:
- Task creation/update
- Email drafts
- Calendar event creation
- Email sending (requires approval)

### Tasks

1. [ ] Create `src/lib/agent/tools/action/create-task.ts`
   - Create task with approval optional
   - Risk level: medium

2. [ ] Create `src/lib/agent/tools/action/update-task.ts`
   - Update task with approval optional
   - Risk level: medium

3. [ ] Create `src/lib/agent/tools/action/draft-email.ts`
   - Create email draft
   - Risk level: low (draft only)

4. [ ] Create `src/lib/agent/tools/action/send-email.ts`
   - Send email via Gmail
   - Risk level: high
   - Requires approval

5. [ ] Create `src/lib/agent/tools/action/create-calendar-event.ts`
   - Create calendar event
   - Risk level: high
   - Requires approval

6. [ ] Create `src/lib/agent/tools/action/update-calendar-event.ts`
   - Update calendar event
   - Risk level: high
   - Requires approval

7. [ ] Register all action tools with registry

### Files to Create

```
src/lib/agent/tools/action/
├── index.ts                      # NEW: Exports
├── create-task.ts                # NEW: Task creation
├── update-task.ts                # NEW: Task update
├── draft-email.ts                # NEW: Email draft
├── send-email.ts                 # NEW: Email send
├── create-calendar-event.ts      # NEW: Event creation
├── update-calendar-event.ts      # NEW: Event update
```

### Testing Requirements

- [ ] Test each action tool
- [ ] Test approval requirements
- [ ] Test with existing integrations

### Acceptance Criteria

- [ ] All action tools implemented
- [ ] Proper risk levels assigned
- [ ] Registered with registry
- [ ] All tests pass

---

## Chunk 12: Tool Execution Engine

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 11  
**Goal**: Build the tool execution engine with approval checking.

### Prerequisites

- [ ] Chunk 11 complete (tools registered)

### Architecture Notes

The execution engine:
1. Validates tool parameters
2. Checks required integrations
3. Assesses risk level
4. Routes to approval if needed
5. Executes tool
6. Evaluates result
7. Logs to audit trail

### Tasks

1. [ ] Create `src/lib/agent/execution/types.ts`
   ```typescript
   export interface ToolCallRequest {
     toolName: string;
     parameters: unknown;
     context: ExecutionContext;
   }
   
   export interface ToolCallResult {
     success: boolean;
     result?: unknown;
     error?: string;
     requiresApproval?: boolean;
     approvalId?: string;
     auditLogId: string;
   }
   ```

2. [ ] Create `src/lib/agent/execution/engine.ts`
   ```typescript
   export async function executeTool(
     request: ToolCallRequest
   ): Promise<ToolCallResult>;
   
   export async function validateToolCall(
     request: ToolCallRequest
   ): Promise<ValidationResult>;
   
   export async function checkIntegrations(
     toolName: string,
     userId: string
   ): Promise<IntegrationCheck>;
   
   export async function assessRisk(
     request: ToolCallRequest
   ): Promise<RiskAssessment>;
   ```

3. [ ] Create `src/lib/agent/execution/approval-check.ts`
   - Check if approval required
   - Consider user autonomy settings
   - Create pending approval if needed

4. [ ] Create `src/lib/agent/execution/result-evaluator.ts`
   - Evaluate execution result
   - Determine success/failure
   - Format for response

5. [ ] Create `src/lib/agent/execution/index.ts`

### Files to Create

```
src/lib/agent/execution/
├── index.ts                  # NEW: Exports
├── types.ts                  # NEW: Execution types
├── engine.ts                 # NEW: Execution engine
├── approval-check.ts         # NEW: Approval checking
├── result-evaluator.ts       # NEW: Result evaluation
```

### Testing Requirements

- [ ] Test full execution flow
- [ ] Test approval routing
- [ ] Test integration checking
- [ ] Test error handling

### Acceptance Criteria

- [ ] Execution engine working
- [ ] Approval flow working
- [ ] Audit logging integrated
- [ ] All tests pass

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 4: Tool System
## ═══════════════════════════════════════════════════

**Pre-Conditions**:
- [ ] Chunks 9, 10, 11, 12 complete
- [ ] All tests passing
- [ ] No TypeScript errors

**Review Criteria**:
- [ ] Tool registry type-safe
- [ ] All core tools implemented
- [ ] Risk levels appropriate
- [ ] Execution engine complete

**Testing Criteria**:
- [ ] Unit tests > 80% coverage
- [ ] Integration tests for tool execution
- [ ] Test approval routing

**Manual Testing Scenarios**:
- [ ] Query tool executes immediately
- [ ] Send email routes to approval
- [ ] Invalid params rejected
- [ ] Missing integration detected

**Sign-Off**: _________________ Date: _________

---

## Chunks 13-15: Planning Layer

[Due to length, I'm summarizing - full details in document]

### Chunk 13: Goal Decomposition & Step Sequencing
- Break complex goals into atomic steps
- Create dependency graph
- Sequence for execution

### Chunk 14: Plan Execution Engine
- Execute plan steps in order
- Handle dependencies
- Manage plan state

### Chunk 15: Plan State Management & Recovery
- Save/restore plan state
- Handle failures and rollbacks
- Resume after approval

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 5: Planning Layer
## ═══════════════════════════════════════════════════

**Pre-Conditions**:
- [ ] Chunks 13, 14, 15 complete
- [ ] All tests passing

**Testing Criteria**:
- [ ] Multi-step plan creation tested
- [ ] Dependency handling tested
- [ ] Failure recovery tested

**Manual Testing Scenarios**:
- [ ] "Schedule meeting with Sarah" → multi-step plan
- [ ] Plan pauses at approval step
- [ ] Plan resumes after approval

---

## Chunks 16-17: Approval Workflow

### Chunk 16: Action Approval Model
- Repository for action approvals
- Pending action queries
- Expiration handling

### Chunk 17: User Autonomy Settings
- Per-action-type approval levels
- Default settings
- Approval execution flow

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 6: Approval Workflow
## ═══════════════════════════════════════════════════

**Testing Criteria**:
- [ ] Approval creation tested
- [ ] User settings applied correctly
- [ ] Expiration working

---

## Chunks 18-20: API & Streaming

### Chunk 18: Chat Message API with SSE
- POST `/api/chat/message`
- SSE streaming for responses
- Event types: thinking, tool_call, content, done

### Chunk 19: Action & Audit API Routes
- Action approval endpoints
- Audit query endpoints

### Chunk 20: Plan Management API
- Plan status endpoints
- Continue/cancel operations

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 7: APIs Complete
## ═══════════════════════════════════════════════════

**Testing Criteria**:
- [ ] All API routes tested
- [ ] SSE streaming working
- [ ] OpenAPI documentation complete

---

## Chunks 21-23: UI Integration

### Chunk 21: Streaming Chat Interface
- Real-time message display
- Tool execution indicators
- Typing indicators

### Chunk 22: Approval Dialog
- Pending action display
- Approve/reject UI
- Edit before approve

### Chunk 23: Audit Viewer
- Audit history timeline
- Reasoning display
- Assumption verification UI

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 8: UI Complete
## ═══════════════════════════════════════════════════

**Testing Criteria**:
- [ ] UI components rendering
- [ ] Streaming working
- [ ] Approval flow complete

---

## Chunk 24: LLM Integration

**Estimated Time**: 4-5 hours  
**Goal**: Integrate LLM provider for intent analysis and response generation.

### Tasks

1. [ ] Create LLM client abstraction
2. [ ] Implement prompt templates
3. [ ] Add tool calling format
4. [ ] Implement token management
5. [ ] Add model selection logic

---

## Chunk 25: Agent Engine Orchestrator

**Estimated Time**: 5-6 hours  
**Goal**: Wire everything together into the main Agent Engine.

### Tasks

1. [ ] Create `src/lib/agent/engine.ts`
   ```typescript
   export class AgentEngine {
     async processMessage(
       message: string,
       context: MessageContext
     ): Promise<AsyncGenerator<AgentEvent>>;
     
     async executePlan(planId: string): Promise<PlanResult>;
     async continueExecution(planId: string): Promise<void>;
     async cancelExecution(planId: string): Promise<void>;
   }
   ```

2. [ ] Wire all layers together
3. [ ] Implement main processing loop
4. [ ] Add error handling and recovery

---

## ═══════════════════════════════════════════════════
## CHECKPOINT 9: Agent Core Complete
## ═══════════════════════════════════════════════════

**Full Integration Test**:
- [ ] Send message → get streaming response
- [ ] Tool call executes correctly
- [ ] Approval workflow works
- [ ] Audit trail complete

---

## Chunk 26: Integration Testing

**Estimated Time**: 4-5 hours  
**Goal**: Comprehensive integration tests for all agent flows.

### Test Suites to Create

1. [ ] `tests/lib/agent/intent.test.ts`
2. [ ] `tests/lib/agent/context.test.ts`
3. [ ] `tests/lib/agent/tools.test.ts`
4. [ ] `tests/lib/agent/planning.test.ts`
5. [ ] `tests/lib/agent/execution.test.ts`
6. [ ] `tests/lib/agent/approval.test.ts`
7. [ ] `tests/lib/agent/engine.test.ts`

---

## Chunk 27: Polish & Review

**Estimated Time**: 3-4 hours  
**Goal**: Final polish, cleanup, and documentation.

### Tasks

1. [ ] Code review checklist
2. [ ] Security audit
3. [ ] Performance review
4. [ ] Documentation completion
5. [ ] Lifecycle verification

---

## Chunk 28: COMPREHENSIVE VERIFICATION

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
├── intent/
│   ├── index.ts
│   ├── types.ts
│   ├── analyzer.ts
│   ├── ambiguity.ts
│   └── intent-patterns.ts
│
├── entities/
│   ├── index.ts
│   ├── types.ts
│   ├── extractor.ts
│   └── resolver.ts
│
├── context/
│   ├── index.ts
│   ├── types.ts
│   ├── retrieval.ts
│   └── ranking.ts
│
├── reasoning/
│   ├── index.ts
│   ├── types.ts
│   ├── hypothesis.ts
│   └── confidence.ts
│
├── response/
│   ├── index.ts
│   ├── types.ts
│   ├── generator.ts
│   └── uncertainty.ts
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

