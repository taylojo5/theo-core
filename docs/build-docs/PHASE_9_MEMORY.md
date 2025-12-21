# Phase 9: Memory System

> **Status**: Draft v0.1  
> **Duration**: Weeks 27-30  
> **Dependencies**: Phase 5 (Agent Engine), Phase 2 (Context System)

---

## Overview

Enable Theo to remember user preferences and context in a way that is **explicit, inspectable, overrideable, and safe** — without relying on implicit model memory.

### Core Principles

| Principle        | Description                                                                |
| ---------------- | -------------------------------------------------------------------------- |
| **Explicit**     | Memory is stored and retrieved, never hidden in model state                |
| **Inspectable**  | Users can view everything Theo remembers                                   |
| **Overrideable** | Users can edit or delete any memory instantly                              |
| **Safe**         | Sensitive domains require explicit opt-in; phrasing respects user autonomy |
| **Cited**        | All actions cite the memory items that influenced them                     |

---

## Architecture

### System Flow

```
User Action / Message
        ↓
   Intent Detection
        ↓
   Memory Retrieval
   ├── Hard Memory (structured, deterministic)
   └── Soft Memory (contextual, semantic search)
        ↓
   Prompt Assembly
        ↓
   LLM Decision / Output
        ↓
   Execution (optional)
        ↓
   Memory Proposal (optional, requires confirmation)
```

### Memory Types

#### Hard Memory (Deterministic)

Explicit preferences or constraints treated as **rules**.

| Characteristic | Description                                      |
| -------------- | ------------------------------------------------ |
| Structure      | JSON key-value pairs or structured objects       |
| Authority      | Always overrides soft memory                     |
| Confirmation   | Requires user confirmation or explicit statement |
| Confidence     | High (0.8+), user-confirmed                      |

**Examples**:

```json
{ "domain": "schedule", "key": "no_meetings_after", "content": "16:00" }
{ "domain": "food", "key": "exclude_ingredients", "content": ["shellfish", "peanuts"] }
{ "domain": "shopping", "key": "preferred_store", "content": "Kroger" }
{ "domain": "communication", "key": "email_signature", "content": "Best, Jonathan" }
```

#### Soft Memory (Contextual)

Narrative context that improves judgment but is **never treated as rules**.

| Characteristic | Description                            |
| -------------- | -------------------------------------- |
| Structure      | Short text chunks (300-500 tokens)     |
| Authority      | Informs decisions but doesn't mandate  |
| Storage        | Vector-embedded for semantic retrieval |
| Decay          | Recency-weighted, can expire           |

**Examples**:

- "User is planning a wedding this month"
- "Prefers low-effort dinners during busy work weeks"
- "Currently onboarding a new team member named Alex"
- "Training for a marathon, watching protein intake"

---

## Database Schema

### Prisma Models

```prisma
// ─────────────────────────────────────────────────────────────
// Memory System
// ─────────────────────────────────────────────────────────────

model MemoryItem {
  id     String @id @default(cuid())
  userId String

  // Classification
  type   MemoryType @default(HARD)
  domain String     // schedule, food, shopping, communication, health, etc.
  key    String     // Structured key for hard memory (e.g., "no_meetings_after")

  // Content
  content     Json      // Flexible: string, array, or object
  contentText String?   @db.Text // Plain text representation for embedding

  // Confidence & Source
  confidence Float     @default(1.0) // 0.0-1.0
  source     MemorySource @default(USER_EXPLICIT)
  evidence   Json?     // Array of evidence items that support this memory

  // Status
  status          MemoryStatus @default(ACTIVE)
  requiresOptIn   Boolean @default(false) // For sensitive domains
  optedInAt       DateTime?

  // Confirmation tracking
  proposedAt      DateTime?
  confirmedAt     DateTime?
  lastConfirmedAt DateTime?

  // Expiration
  expiresAt DateTime?

  // Audit
  createdBy String? // "user", "agent", "system"
  metadata  Json    @default("{}")

  // Timestamps
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  deletedAt DateTime?

  // Relations
  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  usageLog   MemoryUsageLog[]
  embedding  MemoryEmbedding?

  @@unique([userId, domain, key, type])
  @@index([userId, status])
  @@index([userId, domain])
  @@index([userId, type, status])
  @@index([expiresAt])
}

model MemoryEmbedding {
  id           String @id @default(cuid())
  memoryItemId String @unique

  // Vector embedding (1536 dimensions for text-embedding-3-small)
  embedding    Unsupported("vector(1536)")?
  contentHash  String @db.VarChar(64)

  // Timestamps
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  memoryItem MemoryItem @relation(fields: [memoryItemId], references: [id], onDelete: Cascade)

  @@index([memoryItemId])
}

model MemoryUsageLog {
  id           String @id @default(cuid())
  memoryItemId String
  userId       String

  // Context
  conversationId String?
  messageId      String?
  auditLogId     String?

  // How it was used
  usageType  MemoryUsageType @default(RETRIEVED)
  influence  String?         @db.Text // How the memory influenced the action

  // Timestamps
  createdAt DateTime @default(now())

  memoryItem MemoryItem @relation(fields: [memoryItemId], references: [id], onDelete: Cascade)

  @@index([memoryItemId])
  @@index([userId, createdAt])
}

model MemoryDomain {
  id          String @id @default(cuid())
  name        String @unique // schedule, food, shopping, etc.
  displayName String
  description String?

  // Sensitivity
  isSensitive   Boolean @default(false)
  requiresOptIn Boolean @default(false)

  // Configuration
  defaultExpiration Int? // Days until soft memories expire (null = never)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// Enums
enum MemoryType {
  HARD
  SOFT
}

enum MemoryStatus {
  PROPOSED    // Suggested by agent, awaiting confirmation
  ACTIVE      // Confirmed and in use
  INACTIVE    // Deactivated by user (soft delete)
  EXPIRED     // Past expiration date
  SUPERSEDED  // Replaced by newer memory
}

enum MemorySource {
  USER_EXPLICIT   // User said "remember this"
  USER_INFERRED   // Inferred from user actions, confirmed
  AGENT_PROPOSED  // Agent suggested, user confirmed
  SYSTEM_DERIVED  // Derived from integration data
}

enum MemoryUsageType {
  RETRIEVED       // Fetched for context
  APPLIED         // Used in decision making
  CITED           // Explicitly cited in response
  CONFLICTED      // Conflicted with another memory
  OVERRIDDEN      // Was overridden by user in this instance
}
```

### Add to User Model

```prisma
model User {
  // ... existing fields ...

  // Memory relations
  memoryItems    MemoryItem[]
  memoryUsageLog MemoryUsageLog[]
}
```

### Migration Notes

```sql
-- Enable required extensions (should already exist from Phase 2)
CREATE EXTENSION IF NOT EXISTS vector;

-- Create memory tables
-- (Prisma will generate this)

-- Create vector index for soft memory search
CREATE INDEX memory_embedding_vector_idx ON "MemoryEmbedding"
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Seed default domains
INSERT INTO "MemoryDomain" (id, name, "displayName", description, "isSensitive", "requiresOptIn", "defaultExpiration")
VALUES
  (gen_random_uuid(), 'schedule', 'Schedule', 'Meeting preferences, availability, time zones', false, false, null),
  (gen_random_uuid(), 'food', 'Food & Dining', 'Dietary restrictions, preferences, allergies', false, false, null),
  (gen_random_uuid(), 'shopping', 'Shopping', 'Store preferences, brands, budget', false, false, null),
  (gen_random_uuid(), 'communication', 'Communication', 'Email preferences, writing style, signatures', false, false, null),
  (gen_random_uuid(), 'travel', 'Travel', 'Airline, hotel, and transportation preferences', false, false, null),
  (gen_random_uuid(), 'health', 'Health & Wellness', 'Fitness goals, medical considerations', true, true, null),
  (gen_random_uuid(), 'finance', 'Finance', 'Budget preferences, spending patterns', true, true, null),
  (gen_random_uuid(), 'work', 'Work', 'Professional context, projects, deadlines', false, false, 90),
  (gen_random_uuid(), 'personal', 'Personal', 'General personal context', false, false, 60),
  (gen_random_uuid(), 'relationships', 'Relationships', 'People context, social preferences', false, false, null);
```

---

## Types

### `src/services/memory/types.ts`

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Memory Service Types
// Type definitions for the Theo memory system
// ═══════════════════════════════════════════════════════════════════════════

import type {
  MemoryItem,
  MemoryType,
  MemoryStatus,
  MemorySource,
} from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Domain Types
// ─────────────────────────────────────────────────────────────

/** Predefined memory domains */
export type MemoryDomain =
  | "schedule"
  | "food"
  | "shopping"
  | "communication"
  | "travel"
  | "health"
  | "finance"
  | "work"
  | "personal"
  | "relationships";

/** Configuration for sensitive domains */
export interface DomainConfig {
  name: MemoryDomain;
  displayName: string;
  isSensitive: boolean;
  requiresOptIn: boolean;
  defaultExpirationDays?: number;
}

// ─────────────────────────────────────────────────────────────
// Memory DTOs
// ─────────────────────────────────────────────────────────────

/** Input for creating a memory item */
export interface CreateMemoryInput {
  type: "HARD" | "SOFT";
  domain: MemoryDomain | string;
  key: string;
  content: unknown; // Can be string, array, or object
  confidence?: number;
  source?: MemorySource;
  evidence?: Evidence[];
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/** Input for proposing a memory (agent-initiated) */
export interface ProposeMemoryInput {
  type: "HARD" | "SOFT";
  domain: MemoryDomain | string;
  key: string;
  content: unknown;
  confidence: number;
  evidence: Evidence[];
  reasoning?: string;
}

/** Input for confirming a proposed memory */
export interface ConfirmMemoryInput {
  memoryId: string;
  confirm: boolean;
  editedContent?: unknown;
  notes?: string;
}

/** Evidence supporting a memory */
export interface Evidence {
  type: "conversation" | "email" | "calendar" | "pattern" | "explicit";
  description: string;
  sourceId?: string;
  timestamp?: Date;
}

// ─────────────────────────────────────────────────────────────
// Memory Retrieval
// ─────────────────────────────────────────────────────────────

/** Parameters for memory retrieval */
export interface MemoryRetrievalParams {
  userId: string;
  domains?: MemoryDomain[];
  query?: string;
  maxSoftItems?: number;
  minConfidence?: number;
  includeExpired?: boolean;
}

/** Retrieved memory context for prompt injection */
export interface MemoryContext {
  hard: RetrievedMemory[];
  soft: RetrievedMemory[];
  retrievedAt: Date;
}

/** Memory item with retrieval metadata */
export interface RetrievedMemory {
  id: string;
  type: MemoryType;
  domain: string;
  key: string;
  content: unknown;
  confidence: number;
  source: MemorySource;
  lastConfirmedAt?: Date;
  similarity?: number; // For soft memory semantic search
}

// ─────────────────────────────────────────────────────────────
// Prompt Injection
// ─────────────────────────────────────────────────────────────

/** Formatted memory block for prompt injection */
export interface FormattedMemoryBlock {
  text: string;
  tokenEstimate: number;
  memories: RetrievedMemory[];
}

// ─────────────────────────────────────────────────────────────
// Memory Operations
// ─────────────────────────────────────────────────────────────

/** Options for listing memories */
export interface ListMemoriesOptions {
  type?: MemoryType;
  domain?: MemoryDomain | string;
  status?: MemoryStatus;
  search?: string;
  limit?: number;
  cursor?: string;
}

/** Result of memory operations */
export interface MemoryOperationResult {
  success: boolean;
  memory?: MemoryItem;
  error?: string;
  citationId?: string; // For audit trail
}

// ─────────────────────────────────────────────────────────────
// Memory Usage Tracking
// ─────────────────────────────────────────────────────────────

/** Parameters for logging memory usage */
export interface LogMemoryUsageParams {
  memoryId: string;
  userId: string;
  conversationId?: string;
  messageId?: string;
  auditLogId?: string;
  usageType: "RETRIEVED" | "APPLIED" | "CITED" | "CONFLICTED" | "OVERRIDDEN";
  influence?: string;
}

// ─────────────────────────────────────────────────────────────
// Memory Analytics
// ─────────────────────────────────────────────────────────────

/** Memory usage statistics */
export interface MemoryStats {
  totalMemories: number;
  hardMemories: number;
  softMemories: number;
  proposedMemories: number;
  memoriesByDomain: Record<string, number>;
  proposalAcceptanceRate: number;
  correctionRate: number;
  avgConfidence: number;
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

/** Memory service interface */
export interface IMemoryService {
  // CRUD
  create(userId: string, input: CreateMemoryInput): Promise<MemoryItem>;
  update(
    userId: string,
    id: string,
    input: Partial<CreateMemoryInput>
  ): Promise<MemoryItem>;
  delete(userId: string, id: string): Promise<void>;
  get(userId: string, id: string): Promise<MemoryItem | null>;
  list(userId: string, options?: ListMemoriesOptions): Promise<MemoryItem[]>;

  // Proposals
  propose(userId: string, input: ProposeMemoryInput): Promise<MemoryItem>;
  confirm(userId: string, input: ConfirmMemoryInput): Promise<MemoryItem>;
  getPendingProposals(userId: string): Promise<MemoryItem[]>;

  // Retrieval
  retrieve(params: MemoryRetrievalParams): Promise<MemoryContext>;
  formatForPrompt(context: MemoryContext): FormattedMemoryBlock;

  // Usage
  logUsage(params: LogMemoryUsageParams): Promise<void>;
  getStats(userId: string): Promise<MemoryStats>;

  // Domain management
  getDomains(): Promise<DomainConfig[]>;
  optInToDomain(userId: string, domain: string): Promise<void>;
  optOutOfDomain(userId: string, domain: string): Promise<void>;
}

// Re-export Prisma types
export type { MemoryItem, MemoryType, MemoryStatus, MemorySource };
```

---

## Service Implementation

### `src/services/memory/index.ts`

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Memory Service
// Main service for managing user memories
// ═══════════════════════════════════════════════════════════════════════════

export * from "./types";
export * from "./memory-service";
export * from "./memory-retrieval";
export * from "./memory-formatter";
```

### `src/services/memory/memory-service.ts`

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Memory Service Implementation
// CRUD operations and memory management
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { getEmbeddingService } from "@/lib/embeddings";
import { createHash } from "crypto";
import type {
  CreateMemoryInput,
  ProposeMemoryInput,
  ConfirmMemoryInput,
  ListMemoriesOptions,
  MemoryItem,
  MemoryOperationResult,
  MemoryStats,
  DomainConfig,
  LogMemoryUsageParams,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Memory Service Class
// ─────────────────────────────────────────────────────────────

export class MemoryService {
  /**
   * Create a new memory item
   */
  async create(userId: string, input: CreateMemoryInput): Promise<MemoryItem> {
    const contentText = this.extractTextContent(input.content);
    const contentHash = this.hashContent(contentText);

    const memory = await db.memoryItem.create({
      data: {
        userId,
        type: input.type,
        domain: input.domain,
        key: input.key,
        content: input.content as object,
        contentText,
        confidence: input.confidence ?? 1.0,
        source: input.source ?? "USER_EXPLICIT",
        evidence: input.evidence as object[] | undefined,
        status: "ACTIVE",
        confirmedAt: new Date(),
        lastConfirmedAt: new Date(),
        expiresAt: input.expiresAt,
        metadata: input.metadata ?? {},
        createdBy: "user",
      },
    });

    // Generate embedding for soft memories
    if (input.type === "SOFT" && contentText) {
      await this.generateMemoryEmbedding(memory.id, contentText, contentHash);
    }

    return memory;
  }

  /**
   * Propose a new memory (agent-initiated)
   */
  async propose(
    userId: string,
    input: ProposeMemoryInput
  ): Promise<MemoryItem> {
    const contentText = this.extractTextContent(input.content);

    return db.memoryItem.create({
      data: {
        userId,
        type: input.type,
        domain: input.domain,
        key: input.key,
        content: input.content as object,
        contentText,
        confidence: input.confidence,
        source: "AGENT_PROPOSED",
        evidence: input.evidence as object[],
        status: "PROPOSED",
        proposedAt: new Date(),
        metadata: { reasoning: input.reasoning },
        createdBy: "agent",
      },
    });
  }

  /**
   * Confirm or reject a proposed memory
   */
  async confirm(
    userId: string,
    input: ConfirmMemoryInput
  ): Promise<MemoryItem> {
    const memory = await db.memoryItem.findFirst({
      where: {
        id: input.memoryId,
        userId,
        status: "PROPOSED",
      },
    });

    if (!memory) {
      throw new Error("Memory not found or not in proposed state");
    }

    if (!input.confirm) {
      // Reject: mark as inactive
      return db.memoryItem.update({
        where: { id: memory.id },
        data: {
          status: "INACTIVE",
          metadata: {
            ...(memory.metadata as object),
            rejectionNotes: input.notes,
            rejectedAt: new Date().toISOString(),
          },
        },
      });
    }

    // Confirm: activate the memory
    const finalContent = input.editedContent ?? memory.content;
    const contentText = this.extractTextContent(finalContent);
    const contentHash = this.hashContent(contentText);

    const updated = await db.memoryItem.update({
      where: { id: memory.id },
      data: {
        content: finalContent as object,
        contentText,
        status: "ACTIVE",
        confirmedAt: new Date(),
        lastConfirmedAt: new Date(),
        confidence: memory.confidence < 0.8 ? 0.9 : memory.confidence, // Boost confidence on confirm
        metadata: {
          ...(memory.metadata as object),
          editedOnConfirm: !!input.editedContent,
        },
      },
    });

    // Generate embedding for soft memories
    if (updated.type === "SOFT" && contentText) {
      await this.generateMemoryEmbedding(updated.id, contentText, contentHash);
    }

    return updated;
  }

  /**
   * Update an existing memory
   */
  async update(
    userId: string,
    id: string,
    input: Partial<CreateMemoryInput>
  ): Promise<MemoryItem> {
    const existing = await db.memoryItem.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new Error("Memory not found");
    }

    const contentText = input.content
      ? this.extractTextContent(input.content)
      : existing.contentText;

    const updated = await db.memoryItem.update({
      where: { id },
      data: {
        ...(input.domain && { domain: input.domain }),
        ...(input.key && { key: input.key }),
        ...(input.content && { content: input.content as object }),
        ...(contentText && { contentText }),
        ...(input.confidence && { confidence: input.confidence }),
        ...(input.expiresAt && { expiresAt: input.expiresAt }),
        ...(input.metadata && { metadata: input.metadata }),
        lastConfirmedAt: new Date(),
      },
    });

    // Re-embed if content changed
    if (input.content && updated.type === "SOFT" && contentText) {
      const contentHash = this.hashContent(contentText);
      await this.generateMemoryEmbedding(updated.id, contentText, contentHash);
    }

    return updated;
  }

  /**
   * Soft-delete a memory
   */
  async delete(userId: string, id: string): Promise<void> {
    await db.memoryItem.update({
      where: { id },
      data: {
        status: "INACTIVE",
        deletedAt: new Date(),
      },
    });

    // Remove embedding
    await db.memoryEmbedding.deleteMany({
      where: { memoryItemId: id },
    });
  }

  /**
   * Get a single memory
   */
  async get(userId: string, id: string): Promise<MemoryItem | null> {
    return db.memoryItem.findFirst({
      where: { id, userId },
    });
  }

  /**
   * List memories with filtering
   */
  async list(
    userId: string,
    options: ListMemoriesOptions = {}
  ): Promise<MemoryItem[]> {
    const { type, domain, status, search, limit = 50, cursor } = options;

    return db.memoryItem.findMany({
      where: {
        userId,
        ...(type && { type }),
        ...(domain && { domain }),
        ...(status && { status }),
        ...(!status && { status: { not: "INACTIVE" } }),
        ...(search && {
          OR: [
            { key: { contains: search, mode: "insensitive" } },
            { contentText: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { updatedAt: "desc" },
      take: limit,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });
  }

  /**
   * Get pending proposals
   */
  async getPendingProposals(userId: string): Promise<MemoryItem[]> {
    return db.memoryItem.findMany({
      where: {
        userId,
        status: "PROPOSED",
      },
      orderBy: { proposedAt: "desc" },
    });
  }

  /**
   * Log memory usage
   */
  async logUsage(params: LogMemoryUsageParams): Promise<void> {
    await db.memoryUsageLog.create({
      data: {
        memoryItemId: params.memoryId,
        userId: params.userId,
        conversationId: params.conversationId,
        messageId: params.messageId,
        auditLogId: params.auditLogId,
        usageType: params.usageType,
        influence: params.influence,
      },
    });
  }

  /**
   * Get memory statistics
   */
  async getStats(userId: string): Promise<MemoryStats> {
    const [totals, domains, proposalStats] = await Promise.all([
      db.memoryItem.groupBy({
        by: ["type"],
        where: { userId, status: "ACTIVE" },
        _count: true,
      }),
      db.memoryItem.groupBy({
        by: ["domain"],
        where: { userId, status: "ACTIVE" },
        _count: true,
      }),
      db.memoryItem.groupBy({
        by: ["status"],
        where: { userId, source: "AGENT_PROPOSED" },
        _count: true,
      }),
    ]);

    const hardCount = totals.find((t) => t.type === "HARD")?._count ?? 0;
    const softCount = totals.find((t) => t.type === "SOFT")?._count ?? 0;
    const proposedCount =
      proposalStats.find((p) => p.status === "PROPOSED")?._count ?? 0;
    const acceptedCount =
      proposalStats.find((p) => p.status === "ACTIVE")?._count ?? 0;
    const rejectedCount =
      proposalStats.find((p) => p.status === "INACTIVE")?._count ?? 0;

    const totalProposals = acceptedCount + rejectedCount;

    return {
      totalMemories: hardCount + softCount,
      hardMemories: hardCount,
      softMemories: softCount,
      proposedMemories: proposedCount,
      memoriesByDomain: Object.fromEntries(
        domains.map((d) => [d.domain, d._count])
      ),
      proposalAcceptanceRate:
        totalProposals > 0 ? acceptedCount / totalProposals : 0,
      correctionRate: 0, // TODO: Track edits on confirm
      avgConfidence: 0.85, // TODO: Calculate from data
    };
  }

  /**
   * Get available domains
   */
  async getDomains(): Promise<DomainConfig[]> {
    const domains = await db.memoryDomain.findMany({
      orderBy: { name: "asc" },
    });

    return domains.map((d) => ({
      name: d.name as any,
      displayName: d.displayName,
      isSensitive: d.isSensitive,
      requiresOptIn: d.requiresOptIn,
      defaultExpirationDays: d.defaultExpiration ?? undefined,
    }));
  }

  /**
   * Opt-in to a sensitive domain
   */
  async optInToDomain(userId: string, domain: string): Promise<void> {
    await db.memoryItem.updateMany({
      where: {
        userId,
        domain,
        requiresOptIn: true,
      },
      data: {
        optedInAt: new Date(),
      },
    });
  }

  /**
   * Opt-out of a sensitive domain
   */
  async optOutOfDomain(userId: string, domain: string): Promise<void> {
    await db.memoryItem.updateMany({
      where: {
        userId,
        domain,
      },
      data: {
        status: "INACTIVE",
        optedInAt: null,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Private Helpers
  // ─────────────────────────────────────────────────────────────

  private extractTextContent(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.join(", ");
    if (typeof content === "object" && content !== null) {
      return JSON.stringify(content);
    }
    return String(content);
  }

  private hashContent(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  private async generateMemoryEmbedding(
    memoryId: string,
    content: string,
    contentHash: string
  ): Promise<void> {
    const embeddingService = getEmbeddingService();
    const embedding = await embeddingService.generateEmbedding(content);
    const vectorString = `[${embedding.join(",")}]`;

    // Upsert embedding
    await db.$executeRaw`
      INSERT INTO "MemoryEmbedding" (id, "memoryItemId", embedding, "contentHash", "createdAt", "updatedAt")
      VALUES (gen_random_uuid(), ${memoryId}, ${vectorString}::vector, ${contentHash}, NOW(), NOW())
      ON CONFLICT ("memoryItemId") 
      DO UPDATE SET embedding = ${vectorString}::vector, "contentHash" = ${contentHash}, "updatedAt" = NOW()
    `;
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let defaultService: MemoryService | null = null;

export function getMemoryService(): MemoryService {
  if (!defaultService) {
    defaultService = new MemoryService();
  }
  return defaultService;
}
```

### `src/services/memory/memory-retrieval.ts`

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Memory Retrieval Service
// Retrieves relevant memories for prompt context
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { getEmbeddingService } from "@/lib/embeddings";
import type {
  MemoryRetrievalParams,
  MemoryContext,
  RetrievedMemory,
  MemoryDomain,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const DEFAULT_MAX_SOFT_ITEMS = 10;
const DEFAULT_MIN_CONFIDENCE = 0.5;
const DEFAULT_MIN_SIMILARITY = 0.6;

// ─────────────────────────────────────────────────────────────
// Raw Query Types
// ─────────────────────────────────────────────────────────────

interface RawSoftMemoryResult {
  id: string;
  domain: string;
  key: string;
  content: unknown;
  confidence: number;
  source: string;
  last_confirmed_at: Date | null;
  similarity: number;
}

// ─────────────────────────────────────────────────────────────
// Memory Retrieval Service
// ─────────────────────────────────────────────────────────────

export class MemoryRetrievalService {
  /**
   * Retrieve relevant memories for a given context
   */
  async retrieve(params: MemoryRetrievalParams): Promise<MemoryContext> {
    const {
      userId,
      domains,
      query,
      maxSoftItems = DEFAULT_MAX_SOFT_ITEMS,
      minConfidence = DEFAULT_MIN_CONFIDENCE,
      includeExpired = false,
    } = params;

    // Parallel retrieval of hard and soft memories
    const [hardMemories, softMemories] = await Promise.all([
      this.retrieveHardMemories(userId, domains, minConfidence, includeExpired),
      this.retrieveSoftMemories(
        userId,
        domains,
        query,
        maxSoftItems,
        minConfidence,
        includeExpired
      ),
    ]);

    return {
      hard: hardMemories,
      soft: softMemories,
      retrievedAt: new Date(),
    };
  }

  /**
   * Retrieve all active hard memories for specified domains
   */
  private async retrieveHardMemories(
    userId: string,
    domains: MemoryDomain[] | undefined,
    minConfidence: number,
    includeExpired: boolean
  ): Promise<RetrievedMemory[]> {
    const memories = await db.memoryItem.findMany({
      where: {
        userId,
        type: "HARD",
        status: "ACTIVE",
        confidence: { gte: minConfidence },
        ...(domains && { domain: { in: domains } }),
        ...(!includeExpired && {
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        }),
      },
      orderBy: [{ domain: "asc" }, { confidence: "desc" }],
    });

    return memories.map((m) => ({
      id: m.id,
      type: m.type,
      domain: m.domain,
      key: m.key,
      content: m.content,
      confidence: m.confidence,
      source: m.source,
      lastConfirmedAt: m.lastConfirmedAt ?? undefined,
    }));
  }

  /**
   * Retrieve relevant soft memories using semantic search
   */
  private async retrieveSoftMemories(
    userId: string,
    domains: MemoryDomain[] | undefined,
    query: string | undefined,
    maxItems: number,
    minConfidence: number,
    includeExpired: boolean
  ): Promise<RetrievedMemory[]> {
    // If no query, return recent soft memories
    if (!query) {
      const memories = await db.memoryItem.findMany({
        where: {
          userId,
          type: "SOFT",
          status: "ACTIVE",
          confidence: { gte: minConfidence },
          ...(domains && { domain: { in: domains } }),
          ...(!includeExpired && {
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          }),
        },
        orderBy: { lastConfirmedAt: "desc" },
        take: maxItems,
      });

      return memories.map((m) => ({
        id: m.id,
        type: m.type,
        domain: m.domain,
        key: m.key,
        content: m.content,
        confidence: m.confidence,
        source: m.source,
        lastConfirmedAt: m.lastConfirmedAt ?? undefined,
      }));
    }

    // Use semantic search for query-based retrieval
    const embeddingService = getEmbeddingService();
    const queryEmbedding = await embeddingService.generateEmbedding(query);
    const vectorString = `[${queryEmbedding.join(",")}]`;

    const domainFilter = domains ? `AND m.domain = ANY($3::text[])` : "";
    const expiryFilter = includeExpired
      ? ""
      : `AND (m."expiresAt" IS NULL OR m."expiresAt" > NOW())`;

    const results = await db.$queryRaw<RawSoftMemoryResult[]>`
      SELECT 
        m.id,
        m.domain,
        m.key,
        m.content,
        m.confidence,
        m.source,
        m."lastConfirmedAt" as last_confirmed_at,
        1 - (e.embedding <=> ${vectorString}::vector) as similarity
      FROM "MemoryItem" m
      JOIN "MemoryEmbedding" e ON e."memoryItemId" = m.id
      WHERE m."userId" = ${userId}
        AND m.type = 'SOFT'
        AND m.status = 'ACTIVE'
        AND m.confidence >= ${minConfidence}
        AND e.embedding IS NOT NULL
        AND 1 - (e.embedding <=> ${vectorString}::vector) >= ${DEFAULT_MIN_SIMILARITY}
        ${domains ? `AND m.domain = ANY(${domains}::text[])` : ""}
        ${!includeExpired ? `AND (m."expiresAt" IS NULL OR m."expiresAt" > NOW())` : ""}
      ORDER BY similarity DESC
      LIMIT ${maxItems}
    `;

    return results.map((r) => ({
      id: r.id,
      type: "SOFT" as const,
      domain: r.domain,
      key: r.key,
      content: r.content,
      confidence: r.confidence,
      source: r.source as any,
      lastConfirmedAt: r.last_confirmed_at ?? undefined,
      similarity: Number(r.similarity),
    }));
  }

  /**
   * Detect relevant domains from a query or message
   */
  async detectDomains(text: string): Promise<MemoryDomain[]> {
    const domainKeywords: Record<MemoryDomain, string[]> = {
      schedule: [
        "meeting",
        "calendar",
        "schedule",
        "time",
        "appointment",
        "available",
      ],
      food: [
        "eat",
        "food",
        "dinner",
        "lunch",
        "breakfast",
        "restaurant",
        "cook",
        "recipe",
        "diet",
      ],
      shopping: [
        "buy",
        "shop",
        "order",
        "cart",
        "grocery",
        "store",
        "purchase",
      ],
      communication: ["email", "message", "call", "contact", "reply", "send"],
      travel: [
        "flight",
        "hotel",
        "trip",
        "travel",
        "book",
        "airline",
        "vacation",
      ],
      health: ["exercise", "workout", "health", "fitness", "sleep", "medicine"],
      finance: ["budget", "money", "expense", "cost", "pay", "price"],
      work: ["project", "deadline", "work", "task", "meeting", "team"],
      personal: ["prefer", "like", "want", "need", "always", "never"],
      relationships: ["friend", "family", "colleague", "team", "person"],
    };

    const lowerText = text.toLowerCase();
    const detected: MemoryDomain[] = [];

    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some((kw) => lowerText.includes(kw))) {
        detected.push(domain as MemoryDomain);
      }
    }

    return detected.length > 0 ? detected : ["personal", "work"];
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let defaultService: MemoryRetrievalService | null = null;

export function getMemoryRetrievalService(): MemoryRetrievalService {
  if (!defaultService) {
    defaultService = new MemoryRetrievalService();
  }
  return defaultService;
}

/**
 * Convenience function for memory retrieval
 */
export async function retrieveMemory(
  params: MemoryRetrievalParams
): Promise<MemoryContext> {
  return getMemoryRetrievalService().retrieve(params);
}
```

### `src/services/memory/memory-formatter.ts`

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Memory Formatter
// Formats memories for LLM prompt injection
// ═══════════════════════════════════════════════════════════════════════════

import type {
  MemoryContext,
  RetrievedMemory,
  FormattedMemoryBlock,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Approximate tokens per character */
const TOKENS_PER_CHAR = 0.25;

/** Maximum tokens for memory context */
const MAX_MEMORY_TOKENS = 1500;

// ─────────────────────────────────────────────────────────────
// Memory Formatter
// ─────────────────────────────────────────────────────────────

export class MemoryFormatter {
  /**
   * Format memory context for prompt injection
   */
  formatForPrompt(context: MemoryContext): FormattedMemoryBlock {
    const lines: string[] = ["### User Memory Context"];
    const includedMemories: RetrievedMemory[] = [];

    // Format hard memories (always include)
    if (context.hard.length > 0) {
      lines.push("");
      lines.push("**Hard Preferences** (must be respected):");

      for (const memory of context.hard) {
        const line = this.formatHardMemory(memory);
        lines.push(line);
        includedMemories.push(memory);
      }
    }

    // Format soft memories (include until token limit)
    if (context.soft.length > 0) {
      lines.push("");
      lines.push("**Context** (for judgment, not rules):");

      for (const memory of context.soft) {
        const line = this.formatSoftMemory(memory);
        const currentTokens = this.estimateTokens(lines.join("\n"));
        const lineTokens = this.estimateTokens(line);

        if (currentTokens + lineTokens < MAX_MEMORY_TOKENS) {
          lines.push(line);
          includedMemories.push(memory);
        }
      }
    }

    // Add rules footer
    lines.push("");
    lines.push("**Rules**:");
    lines.push(
      "- Hard preferences must be respected unless user explicitly overrides"
    );
    lines.push("- If there is conflict or uncertainty, ask before acting");
    lines.push(
      '- Always cite memory items when relevant: "You previously told me..."'
    );
    lines.push('- Never phrase as: "You believe..." or "You think..."');

    const text = lines.join("\n");

    return {
      text,
      tokenEstimate: this.estimateTokens(text),
      memories: includedMemories,
    };
  }

  /**
   * Format a single hard memory
   */
  private formatHardMemory(memory: RetrievedMemory): string {
    const content = this.formatContent(memory.content);
    const confidence = memory.confidence >= 0.9 ? "high" : "medium";
    const confirmed = memory.lastConfirmedAt
      ? `, confirmed: ${memory.lastConfirmedAt.toISOString().split("T")[0]}`
      : "";

    return `- [${memory.domain}] ${memory.key}: ${content} (confidence: ${confidence}${confirmed})`;
  }

  /**
   * Format a single soft memory
   */
  private formatSoftMemory(memory: RetrievedMemory): string {
    const content = this.formatContent(memory.content);
    const similarity = memory.similarity
      ? ` (relevance: ${Math.round(memory.similarity * 100)}%)`
      : "";

    return `- ${content}${similarity}`;
  }

  /**
   * Format memory content to string
   */
  private formatContent(content: unknown): string {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.join(", ");
    if (typeof content === "object" && content !== null) {
      return JSON.stringify(content);
    }
    return String(content);
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length * TOKENS_PER_CHAR);
  }
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

let defaultFormatter: MemoryFormatter | null = null;

export function getMemoryFormatter(): MemoryFormatter {
  if (!defaultFormatter) {
    defaultFormatter = new MemoryFormatter();
  }
  return defaultFormatter;
}

/**
 * Convenience function for formatting memory
 */
export function formatMemoryForPrompt(
  context: MemoryContext
): FormattedMemoryBlock {
  return getMemoryFormatter().formatForPrompt(context);
}
```

---

## API Routes

### `src/app/api/memory/route.ts`

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Memory API Routes
// CRUD endpoints for memory management
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMemoryService } from "@/services/memory";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────────

const createMemorySchema = z.object({
  type: z.enum(["HARD", "SOFT"]),
  domain: z.string().min(1),
  key: z.string().min(1),
  content: z.unknown(),
  confidence: z.number().min(0).max(1).optional(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const listQuerySchema = z.object({
  type: z.enum(["HARD", "SOFT"]).optional(),
  domain: z.string().optional(),
  status: z.enum(["PROPOSED", "ACTIVE", "INACTIVE", "EXPIRED"]).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

// ─────────────────────────────────────────────────────────────
// GET /api/memory
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = Object.fromEntries(request.nextUrl.searchParams);
  const query = listQuerySchema.parse(searchParams);

  const memoryService = getMemoryService();
  const memories = await memoryService.list(session.user.id, query);

  return NextResponse.json({ memories });
}

// ─────────────────────────────────────────────────────────────
// POST /api/memory
// ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const input = createMemorySchema.parse(body);

  const memoryService = getMemoryService();
  const memory = await memoryService.create(session.user.id, {
    ...input,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
  });

  return NextResponse.json({ memory }, { status: 201 });
}
```

### `src/app/api/memory/[id]/route.ts`

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Memory Item API Routes
// Single memory item operations
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMemoryService } from "@/services/memory";
import { z } from "zod";

const updateMemorySchema = z.object({
  key: z.string().min(1).optional(),
  content: z.unknown().optional(),
  confidence: z.number().min(0).max(1).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

interface RouteParams {
  params: { id: string };
}

// ─────────────────────────────────────────────────────────────
// GET /api/memory/:id
// ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memoryService = getMemoryService();
  const memory = await memoryService.get(session.user.id, params.id);

  if (!memory) {
    return NextResponse.json({ error: "Memory not found" }, { status: 404 });
  }

  return NextResponse.json({ memory });
}

// ─────────────────────────────────────────────────────────────
// PATCH /api/memory/:id
// ─────────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const input = updateMemorySchema.parse(body);

  const memoryService = getMemoryService();
  const memory = await memoryService.update(session.user.id, params.id, {
    ...input,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
  });

  return NextResponse.json({ memory });
}

// ─────────────────────────────────────────────────────────────
// DELETE /api/memory/:id
// ─────────────────────────────────────────────────────────────

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memoryService = getMemoryService();
  await memoryService.delete(session.user.id, params.id);

  return NextResponse.json({ success: true });
}
```

### `src/app/api/memory/propose/route.ts`

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Memory Proposal API
// Agent-initiated memory suggestions
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMemoryService, type Evidence } from "@/services/memory";
import { z } from "zod";

const proposeMemorySchema = z.object({
  type: z.enum(["HARD", "SOFT"]),
  domain: z.string().min(1),
  key: z.string().min(1),
  content: z.unknown(),
  confidence: z.number().min(0).max(1),
  evidence: z.array(
    z.object({
      type: z.enum([
        "conversation",
        "email",
        "calendar",
        "pattern",
        "explicit",
      ]),
      description: z.string(),
      sourceId: z.string().optional(),
      timestamp: z.string().datetime().optional(),
    })
  ),
  reasoning: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const input = proposeMemorySchema.parse(body);

  const memoryService = getMemoryService();
  const memory = await memoryService.propose(session.user.id, {
    ...input,
    evidence: input.evidence.map((e) => ({
      ...e,
      timestamp: e.timestamp ? new Date(e.timestamp) : undefined,
    })) as Evidence[],
  });

  return NextResponse.json(
    { memory, requiresConfirmation: true },
    { status: 201 }
  );
}
```

### `src/app/api/memory/[id]/confirm/route.ts`

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Memory Confirmation API
// Confirm or reject proposed memories
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMemoryService } from "@/services/memory";
import { z } from "zod";

const confirmSchema = z.object({
  confirm: z.boolean(),
  editedContent: z.unknown().optional(),
  notes: z.string().optional(),
});

interface RouteParams {
  params: { id: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const input = confirmSchema.parse(body);

  const memoryService = getMemoryService();
  const memory = await memoryService.confirm(session.user.id, {
    memoryId: params.id,
    ...input,
  });

  return NextResponse.json({ memory });
}
```

### `src/app/api/memory/retrieve/route.ts`

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// Memory Retrieval API
// Internal API for retrieving relevant memories
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getMemoryRetrievalService,
  getMemoryFormatter,
  type MemoryDomain,
} from "@/services/memory";
import { z } from "zod";

const retrieveSchema = z.object({
  domains: z.array(z.string()).optional(),
  query: z.string().optional(),
  maxSoftItems: z.number().min(1).max(50).optional(),
  minConfidence: z.number().min(0).max(1).optional(),
  format: z.enum(["raw", "prompt"]).default("raw"),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const input = retrieveSchema.parse(body);

  const retrievalService = getMemoryRetrievalService();
  const context = await retrievalService.retrieve({
    userId: session.user.id,
    domains: input.domains as MemoryDomain[],
    query: input.query,
    maxSoftItems: input.maxSoftItems,
    minConfidence: input.minConfidence,
  });

  if (input.format === "prompt") {
    const formatter = getMemoryFormatter();
    const formatted = formatter.formatForPrompt(context);
    return NextResponse.json({ formatted, context });
  }

  return NextResponse.json({ context });
}
```

---

## Agent Integration

### Memory Middleware

The agent engine should use memory retrieval as mandatory middleware:

```typescript
// src/lib/agent/middleware/memory-middleware.ts

import {
  getMemoryRetrievalService,
  getMemoryFormatter,
} from "@/services/memory";
import type { AgentContext } from "../types";

/**
 * Middleware that retrieves and injects relevant memories into agent context
 */
export async function memoryMiddleware(
  context: AgentContext,
  message: string
): Promise<AgentContext> {
  const retrievalService = getMemoryRetrievalService();
  const formatter = getMemoryFormatter();

  // Detect relevant domains from the message
  const domains = await retrievalService.detectDomains(message);

  // Retrieve memories
  const memoryContext = await retrievalService.retrieve({
    userId: context.userId,
    domains,
    query: message,
    maxSoftItems: 10,
    minConfidence: 0.5,
  });

  // Format for prompt
  const formatted = formatter.formatForPrompt(memoryContext);

  // Inject into context
  return {
    ...context,
    memoryContext,
    systemPromptAdditions: [
      ...(context.systemPromptAdditions ?? []),
      formatted.text,
    ],
    memoryIds: formatted.memories.map((m) => m.id),
  };
}
```

### Memory Proposal Tool

The agent should have a tool to propose new memories:

```typescript
// src/lib/agent/tools/memory-tools.ts

import { getMemoryService } from "@/services/memory";
import type { AgentTool } from "../types";

export const proposeMemoryTool: AgentTool = {
  name: "propose_memory",
  description: `Propose a new memory about the user's preferences or context. 
Use this when the user shares explicit preferences or you notice a pattern.
The user must confirm before the memory is saved.`,
  parameters: {
    type: "object",
    properties: {
      type: {
        type: "string",
        enum: ["HARD", "SOFT"],
        description:
          "HARD for explicit rules/preferences, SOFT for contextual information",
      },
      domain: {
        type: "string",
        description:
          "Category: schedule, food, shopping, communication, travel, health, work, personal",
      },
      key: {
        type: "string",
        description:
          "Short identifier for this preference (e.g., 'no_meetings_after')",
      },
      content: {
        type: "string",
        description: "The preference or context to remember",
      },
      confidence: {
        type: "number",
        description: "Confidence level 0-1 (use 0.9+ for explicit statements)",
      },
      reasoning: {
        type: "string",
        description: "Why you're suggesting this memory",
      },
    },
    required: ["type", "domain", "key", "content", "confidence", "reasoning"],
  },
  async execute({ userId, conversationId }, params) {
    const memoryService = getMemoryService();

    const memory = await memoryService.propose(userId, {
      type: params.type,
      domain: params.domain,
      key: params.key,
      content: params.content,
      confidence: params.confidence,
      evidence: [
        {
          type: "conversation",
          description: params.reasoning,
          sourceId: conversationId,
          timestamp: new Date(),
        },
      ],
      reasoning: params.reasoning,
    });

    return {
      success: true,
      memoryId: memory.id,
      message: `I'd like to remember: "${params.content}". Would you like me to save this?`,
      requiresConfirmation: true,
    };
  },
};

export const queryMemoryTool: AgentTool = {
  name: "query_memory",
  description: "Search the user's saved memories and preferences",
  parameters: {
    type: "object",
    properties: {
      domain: {
        type: "string",
        description: "Filter by domain",
      },
      search: {
        type: "string",
        description: "Search query",
      },
    },
  },
  async execute({ userId }, params) {
    const memoryService = getMemoryService();
    const memories = await memoryService.list(userId, {
      domain: params.domain,
      search: params.search,
      limit: 20,
    });

    return {
      memories: memories.map((m) => ({
        id: m.id,
        type: m.type,
        domain: m.domain,
        key: m.key,
        content: m.content,
        confidence: m.confidence,
      })),
    };
  },
};
```

---

## UI Components

### `src/components/memory/memory-panel.tsx`

```typescript
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemoryItem } from "./memory-item";
import { MemoryProposalCard } from "./memory-proposal-card";
import type { MemoryItem as MemoryItemType } from "@/services/memory";

export function MemoryPanel() {
  const [memories, setMemories] = useState<MemoryItemType[]>([]);
  const [proposals, setProposals] = useState<MemoryItemType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMemories();
  }, []);

  async function loadMemories() {
    setLoading(true);
    const [memRes, propRes] = await Promise.all([
      fetch("/api/memory?status=ACTIVE"),
      fetch("/api/memory?status=PROPOSED"),
    ]);
    const [memData, propData] = await Promise.all([memRes.json(), propRes.json()]);
    setMemories(memData.memories);
    setProposals(propData.memories);
    setLoading(false);
  }

  const hardMemories = memories.filter((m) => m.type === "HARD");
  const softMemories = memories.filter((m) => m.type === "SOFT");

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>What Theo Remembers</span>
          {proposals.length > 0 && (
            <Badge variant="secondary">{proposals.length} pending</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Pending Proposals */}
        {proposals.length > 0 && (
          <div className="mb-6 space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">
              Pending Confirmations
            </h3>
            {proposals.map((proposal) => (
              <MemoryProposalCard
                key={proposal.id}
                memory={proposal}
                onConfirm={loadMemories}
              />
            ))}
          </div>
        )}

        <Tabs defaultValue="preferences">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preferences">
              Preferences ({hardMemories.length})
            </TabsTrigger>
            <TabsTrigger value="context">
              Context ({softMemories.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="preferences" className="space-y-2 mt-4">
            {hardMemories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No preferences saved yet. Tell Theo what you prefer!
              </p>
            ) : (
              hardMemories.map((memory) => (
                <MemoryItem
                  key={memory.id}
                  memory={memory}
                  onDelete={loadMemories}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="context" className="space-y-2 mt-4">
            {softMemories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No context saved yet.
              </p>
            ) : (
              softMemories.map((memory) => (
                <MemoryItem
                  key={memory.id}
                  memory={memory}
                  onDelete={loadMemories}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

### `src/components/memory/memory-item.tsx`

```typescript
"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Edit, Check, X } from "lucide-react";
import type { MemoryItem as MemoryItemType } from "@/services/memory";

interface MemoryItemProps {
  memory: MemoryItemType;
  onDelete: () => void;
}

export function MemoryItem({ memory, onDelete }: MemoryItemProps) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/memory/${memory.id}`, { method: "DELETE" });
    onDelete();
  }

  const formatContent = (content: unknown): string => {
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.join(", ");
    return JSON.stringify(content);
  };

  return (
    <div className="flex items-start justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant="outline" className="text-xs">
            {memory.domain}
          </Badge>
          {memory.type === "HARD" && (
            <Badge variant="secondary" className="text-xs">
              Rule
            </Badge>
          )}
        </div>
        <p className="text-sm font-medium">{memory.key}</p>
        <p className="text-sm text-muted-foreground">{formatContent(memory.content)}</p>
        {memory.lastConfirmedAt && (
          <p className="text-xs text-muted-foreground mt-1">
            Confirmed {new Date(memory.lastConfirmedAt).toLocaleDateString()}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
        disabled={deleting}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

### `src/components/memory/memory-proposal-card.tsx`

```typescript
"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Edit } from "lucide-react";
import type { MemoryItem } from "@/services/memory";

interface MemoryProposalCardProps {
  memory: MemoryItem;
  onConfirm: () => void;
}

export function MemoryProposalCard({ memory, onConfirm }: MemoryProposalCardProps) {
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(
    typeof memory.content === "string" ? memory.content : JSON.stringify(memory.content)
  );
  const [processing, setProcessing] = useState(false);

  async function handleConfirm(confirm: boolean) {
    setProcessing(true);
    await fetch(`/api/memory/${memory.id}/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirm,
        editedContent: editing ? editedContent : undefined,
      }),
    });
    onConfirm();
  }

  const reasoning = (memory.metadata as Record<string, unknown>)?.reasoning as string;

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{memory.domain}</Badge>
              <Badge variant="secondary">Proposed</Badge>
            </div>
            <p className="text-sm font-medium mb-1">
              Theo wants to remember: <span className="font-normal">{memory.key}</span>
            </p>
            {editing ? (
              <Input
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="mt-2"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {typeof memory.content === "string"
                  ? memory.content
                  : JSON.stringify(memory.content)}
              </p>
            )}
            {reasoning && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                Reason: {reasoning}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setEditing(!editing)}
              disabled={processing}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={() => handleConfirm(false)}
              disabled={processing}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-green-600"
              onClick={() => handleConfirm(true)}
              disabled={processing}
            >
              <Check className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Testing

### `tests/services/memory/memory-service.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryService } from "@/services/memory/memory-service";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    memoryItem: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      groupBy: vi.fn(),
    },
    memoryEmbedding: {
      deleteMany: vi.fn(),
    },
    memoryDomain: {
      findMany: vi.fn(),
    },
    memoryUsageLog: {
      create: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
}));

vi.mock("@/lib/embeddings", () => ({
  getEmbeddingService: () => ({
    generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  }),
}));

describe("MemoryService", () => {
  let service: MemoryService;

  beforeEach(() => {
    service = new MemoryService();
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create a hard memory", async () => {
      const { db } = await import("@/lib/db");
      const mockMemory = {
        id: "mem_1",
        userId: "user_1",
        type: "HARD",
        domain: "schedule",
        key: "no_meetings_after",
        content: "16:00",
        confidence: 1.0,
        status: "ACTIVE",
      };

      vi.mocked(db.memoryItem.create).mockResolvedValue(mockMemory as any);

      const result = await service.create("user_1", {
        type: "HARD",
        domain: "schedule",
        key: "no_meetings_after",
        content: "16:00",
      });

      expect(result.type).toBe("HARD");
      expect(result.domain).toBe("schedule");
    });

    it("should generate embedding for soft memory", async () => {
      const { db } = await import("@/lib/db");
      const mockMemory = {
        id: "mem_2",
        userId: "user_1",
        type: "SOFT",
        domain: "personal",
        key: "current_context",
        content: "Planning a wedding this month",
        confidence: 0.8,
        status: "ACTIVE",
      };

      vi.mocked(db.memoryItem.create).mockResolvedValue(mockMemory as any);

      await service.create("user_1", {
        type: "SOFT",
        domain: "personal",
        key: "current_context",
        content: "Planning a wedding this month",
      });

      expect(db.$executeRaw).toHaveBeenCalled();
    });
  });

  describe("propose", () => {
    it("should create a proposed memory", async () => {
      const { db } = await import("@/lib/db");
      const mockProposal = {
        id: "mem_3",
        status: "PROPOSED",
        source: "AGENT_PROPOSED",
      };

      vi.mocked(db.memoryItem.create).mockResolvedValue(mockProposal as any);

      const result = await service.propose("user_1", {
        type: "HARD",
        domain: "food",
        key: "exclude_ingredients",
        content: ["shellfish"],
        confidence: 0.7,
        evidence: [
          { type: "conversation", description: "User mentioned allergy" },
        ],
      });

      expect(result.status).toBe("PROPOSED");
    });
  });

  describe("confirm", () => {
    it("should activate a proposed memory on confirm", async () => {
      const { db } = await import("@/lib/db");
      const mockProposed = {
        id: "mem_4",
        userId: "user_1",
        type: "HARD",
        status: "PROPOSED",
        content: "test",
        confidence: 0.7,
        metadata: {},
      };

      vi.mocked(db.memoryItem.findFirst).mockResolvedValue(mockProposed as any);
      vi.mocked(db.memoryItem.update).mockResolvedValue({
        ...mockProposed,
        status: "ACTIVE",
        confidence: 0.9,
      } as any);

      const result = await service.confirm("user_1", {
        memoryId: "mem_4",
        confirm: true,
      });

      expect(result.status).toBe("ACTIVE");
      expect(result.confidence).toBe(0.9);
    });

    it("should deactivate a proposed memory on reject", async () => {
      const { db } = await import("@/lib/db");
      const mockProposed = {
        id: "mem_5",
        userId: "user_1",
        status: "PROPOSED",
        metadata: {},
      };

      vi.mocked(db.memoryItem.findFirst).mockResolvedValue(mockProposed as any);
      vi.mocked(db.memoryItem.update).mockResolvedValue({
        ...mockProposed,
        status: "INACTIVE",
      } as any);

      const result = await service.confirm("user_1", {
        memoryId: "mem_5",
        confirm: false,
        notes: "Not accurate",
      });

      expect(result.status).toBe("INACTIVE");
    });
  });
});
```

---

## Safety & Privacy

### Sensitive Domains

Domains marked as sensitive require explicit opt-in:

| Domain        | Sensitivity | Opt-in Required | Reason                            |
| ------------- | ----------- | --------------- | --------------------------------- |
| health        | High        | Yes             | Medical information, fitness data |
| finance       | High        | Yes             | Budget, spending patterns         |
| relationships | Medium      | No              | But careful phrasing required     |
| work          | Low         | No              | Professional context              |

### Phrasing Rules

The agent must follow these phrasing rules when referencing memories:

| ✅ Allowed                        | ❌ Forbidden                        |
| --------------------------------- | ----------------------------------- |
| "You previously told me..."       | "You believe..."                    |
| "Based on your preference for..." | "You think that..."                 |
| "You mentioned that..."           | "You are the type of person who..." |
| "I remember you said..."          | "Your personality suggests..."      |

### Data Retention

- **Hard memories**: No automatic expiration unless user-set
- **Soft memories**: Configurable expiration per domain (default: domain-specific)
- **Usage logs**: 90 days retention for analytics
- **Deleted memories**: Immediately removed, no soft-delete recovery

---

## Deliverables

### Phase 9 Checklist

- [ ] **Database**
  - [ ] MemoryItem table created
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

| Metric                         | Target | Measurement                            |
| ------------------------------ | ------ | -------------------------------------- |
| Memory citation rate           | >80%   | % of relevant actions that cite memory |
| Proposal acceptance            | >70%   | % of proposed memories confirmed       |
| Memory correction rate         | <10%   | % of memories edited on confirm        |
| "Why did you do this?" queries | <5%    | Reduction after memory explanations    |
| User satisfaction with memory  | >4.5/5 | Post-interaction survey                |

---

## Future Enhancements (V2+)

- **Memory clusters**: Group related memories automatically
- **Memory conflicts**: Detect and resolve contradicting memories
- **Temporal awareness**: "You used to prefer X, but recently you've chosen Y"
- **Cross-session learning**: Learn patterns across conversations
- **Memory export/import**: User data portability
- **Memory sharing**: Opt-in sharing between family accounts

---

## Appendix: API Quick Reference

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

### Common Operations

```bash
# List all active memories
GET /api/memory

# Create a memory
POST /api/memory
{ "type": "HARD", "domain": "food", "key": "exclude", "content": ["shellfish"] }

# Propose a memory (agent)
POST /api/memory/propose
{ "type": "HARD", "domain": "shopping", "key": "store", "content": "Kroger", "confidence": 0.6, "evidence": [...] }

# Confirm a proposal
POST /api/memory/:id/confirm
{ "confirm": true }

# Delete a memory
DELETE /api/memory/:id

# Retrieve for context
POST /api/memory/retrieve
{ "domains": ["food", "schedule"], "query": "plan meals for next week" }
```
