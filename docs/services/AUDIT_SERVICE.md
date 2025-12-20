# Audit Service Documentation

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [DATA_LAYER.md](../DATA_LAYER.md), [CONTEXT_SERVICES.md](./CONTEXT_SERVICES.md)

---

## Overview

The Audit Service logs all agent actions and assumptions for full traceability. Every operation that modifies data or makes decisions is recorded with context about intent, reasoning, and confidence.

---

## Core Principles

1. **Complete Traceability**: Every action can be traced back to its trigger
2. **Agent Transparency**: All AI reasoning and assumptions are recorded
3. **Immutability**: Audit logs are append-only, never modified
4. **Assumption Verification**: Assumptions can be verified and corrected

---

## Quick Start

```typescript
import {
  logAuditEntry,
  startAuditEntry,
  completeAuditEntry,
  logAssumption,
  verifyAssumption,
  queryAuditLog,
  getEntityAuditTrail,
} from "@/services/audit";

// Log a completed action
await logAuditEntry({
  userId: "user-123",
  sessionId: "session-456",
  actionType: "create",
  actionCategory: "context",
  entityType: "person",
  entityId: "person-789",
  intent: "User wanted to add a new contact",
  reasoning: "User provided name and email",
  confidence: 0.95,
  outputSummary: "Created person: Sarah Chen",
});
```

---

## Audit Entry Structure

```typescript
interface AuditEntry {
  userId: string; // Owner of this action
  sessionId?: string; // Current session
  conversationId?: string; // Related conversation

  // Action details
  actionType: ActionType; // What was done
  actionCategory: ActionCategory; // Category of action

  // What was affected
  entityType?: string; // person, task, message, etc.
  entityId?: string; // Entity ID
  entitySnapshot?: object; // State at time of action

  // Agent reasoning
  intent?: string; // What the agent understood
  reasoning?: string; // Why this action was taken
  confidence?: number; // 0.00 - 1.00

  // Input/Output
  inputSummary?: string; // User input or trigger
  outputSummary?: string; // What was produced

  // Status
  status?: "pending" | "completed" | "failed" | "rolled_back";
  errorMessage?: string;

  metadata?: Record<string, unknown>;
}
```

### Action Types

| Type      | Description            |
| --------- | ---------------------- |
| `query`   | Read operation         |
| `create`  | Entity created         |
| `update`  | Entity modified        |
| `delete`  | Entity deleted         |
| `send`    | Outbound communication |
| `analyze` | Analysis performed     |

### Action Categories

| Category      | Description                 |
| ------------- | --------------------------- |
| `context`     | Context entity operations   |
| `integration` | External service operations |
| `agent`       | AI/LLM operations           |
| `user`        | Direct user actions         |

---

## API Reference

### Log Completed Action

For actions that complete quickly:

```typescript
const entry = await logAuditEntry({
  userId: "user-123",
  actionType: "create",
  actionCategory: "context",
  entityType: "task",
  entityId: "task-456",
  outputSummary: "Created task: Review roadmap",
});
```

### Long-Running Operations

For operations that take time:

```typescript
// Start the operation
const entry = await startAuditEntry({
  userId: "user-123",
  actionType: "send",
  actionCategory: "integration",
  entityType: "email",
  intent: "Send email to Sarah",
});

try {
  // Perform the operation
  await sendEmail(...);

  // Complete successfully
  await completeAuditEntry(entry.id, {
    status: "completed",
    reasoning: "Email sent successfully",
    outputSummary: "Email delivered to sarah@example.com",
  });
} catch (error) {
  // Complete with failure
  await completeAuditEntry(entry.id, {
    status: "failed",
    errorMessage: error.message,
  });
}
```

### Log Assumptions

Record AI assumptions for verification:

```typescript
await logAssumption(auditLogId, {
  assumption: "User wants to track this person as a work contact",
  category: "intent",
  evidence: { context: "User mentioned 'colleague'" },
  confidence: 0.9,
});
```

**Assumption Categories:**

| Category     | Description                     |
| ------------ | ------------------------------- |
| `intent`     | What the user wants             |
| `context`    | Background information inferred |
| `preference` | User preference inferred        |
| `inference`  | Logical deduction made          |

### Verify Assumptions

After user feedback:

```typescript
await verifyAssumption(assumptionId, {
  verified: true,
  verifiedBy: "user",
});

// Or with correction
await verifyAssumption(assumptionId, {
  verified: false,
  verifiedBy: "user",
  correction: "Actually a personal friend, not work contact",
});
```

### Query Audit Log

```typescript
const logs = await queryAuditLog({
  userId: "user-123",
  sessionId: "session-456",
  actionTypes: ["create", "update"],
  actionCategories: ["context"],
  entityType: "person",
  dateRange: {
    start: new Date("2024-12-01"),
    end: new Date("2024-12-31"),
  },
  limit: 50,
  offset: 0,
});
```

### Get Entity Audit Trail

Get all actions related to an entity:

```typescript
const trail = await getEntityAuditTrail(userId, "person", personId);

for (const entry of trail) {
  console.log(`${entry.actionType} at ${entry.createdAt}`);
  console.log(`  Reasoning: ${entry.reasoning}`);
  console.log(`  Assumptions: ${entry.assumptions.length}`);
}
```

---

## Integration with Services

Context services automatically create audit logs:

```typescript
// This automatically logs the action
const person = await createPerson(userId, data, {
  userId,
  sessionId,
});

// Audit entry created:
// {
//   actionType: "create",
//   actionCategory: "context",
//   entityType: "person",
//   entityId: person.id,
//   ...
// }
```

---

## Database Schema

```prisma
model AuditLog {
  id             String    @id
  userId         String
  sessionId      String?
  conversationId String?
  actionType     String
  actionCategory String
  entityType     String?
  entityId       String?
  entitySnapshot Json?
  intent         String?
  reasoning      String?
  confidence     Decimal?
  inputSummary   String?
  outputSummary  String?
  metadata       Json
  status         String    @default("completed")
  errorMessage   String?
  startedAt      DateTime
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
  id         String
  auditLogId String
  assumption String
  category   String
  evidence   Json
  confidence Decimal
  verified   Boolean?
  verifiedAt DateTime?
  verifiedBy String?
  correction String?
  createdAt  DateTime

  auditLog AuditLog @relation(...)
}
```

---

## Best Practices

### 1. Always Log with Context

```typescript
// ✅ Good - full context
await logAuditEntry({
  userId,
  sessionId,
  conversationId,
  actionType: "create",
  ...
});

// ❌ Missing context
await logAuditEntry({
  userId,
  actionType: "create",
});
```

### 2. Include Reasoning for AI Actions

```typescript
// ✅ Good - explains why
await logAuditEntry({
  ...
  intent: "User asked about upcoming meetings",
  reasoning: "Queried calendar for next 7 days based on 'upcoming' keyword",
  confidence: 0.85,
});
```

### 3. Log Assumptions Separately

```typescript
// Log the action
const entry = await logAuditEntry({...});

// Log each assumption
await logAssumption(entry.id, {
  assumption: "User meant business meetings only",
  category: "inference",
  evidence: { context: "User is in work mode" },
  confidence: 0.7,
});
```

---

## Related Documentation

- [DATA_LAYER.md](../DATA_LAYER.md) - AuditLog schema
- [CONTEXT_SERVICES.md](./CONTEXT_SERVICES.md) - Service integration
- [AGENTIC_FRAMEWORK.md](../AGENTIC_FRAMEWORK.md) - Agent behavior
