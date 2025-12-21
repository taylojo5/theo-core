# Chunking Best Practices

> **Purpose**: Lessons learned from Phase 3 implementation to improve future planning and execution  
> **Last Updated**: December 21, 2024  
> **Based On**: Phase 3-1 and Phase 3-2 Completion Analysis

---

## Overview

This document captures best practices for chunking implementation work, derived from analysis of the Phase 3 (Gmail Integration) implementation. Following these practices will reduce drift from plan, minimize security gaps, and improve code quality.

---

## 1. Security-First Chunk Design

### 1.1 Include Security in Foundation Chunks

**Learning**: Security features (encryption, rate limiting, CSRF) were added as remediation, not as part of initial design.

**Best Practice**: Create a dedicated security foundation chunk early in any integration:

```markdown
## Chunk 0: Security Foundation (Before Feature Work)

### Tasks

1. Implement rate limiting middleware for new routes
2. Add CSRF protection helper for state-changing actions
3. Create encryption utilities for sensitive data storage
4. Define input sanitization patterns

### Acceptance Criteria

- [ ] Rate limit config for all planned endpoints
- [ ] CSRF validation utility with both header and body support
- [ ] Encryption/decryption functions for tokens and secrets
- [ ] Sanitizer for user-provided content (HTML, URLs)
```

### 1.2 Security Checklist Per Chunk

Include a security checklist in every chunk that adds API endpoints:

```markdown
### Security Checklist

- [ ] Rate limiting applied to all new routes
- [ ] CSRF protection on all state-changing endpoints (POST, PUT, PATCH, DELETE)
- [ ] Input validation with Zod schemas
- [ ] Sensitive data sanitized before logging
- [ ] Authentication verified before authorization
- [ ] Tokens/secrets encrypted before storage
```

### 1.3 Don't Split Security from Features

**Anti-pattern** (what went wrong):

```markdown
Chunk 8: Email Actions

- Create draft API ← No rate limiting planned
- Send email API ← No CSRF planned

Chunk 11: Security Polish (Later)

- Add rate limiting to all routes
- Add CSRF protection
```

**Better approach**:

```markdown
Chunk 8: Email Actions (with Security)

- Create draft API with rate limiting
- Send email API with CSRF protection
- Audit logging for all actions
```

---

## 2. UI + Backend Coordination

### 2.1 Plan Full-Stack Features Together

**Learning**: CSRF protection was implemented on backend but UI wasn't updated to send tokens.

**Best Practice**: Every feature chunk should specify both backend AND frontend changes:

```markdown
## Chunk: Email Approval Workflow

### Backend Tasks

- POST /api/approvals/[id] - Approve/reject endpoint
- CSRF validation middleware
- Audit logging

### Frontend Tasks

- Fetch CSRF token on page load
- Include token in all state-changing requests
- Handle 403 CSRF errors gracefully

### Integration Tests

- Test full flow: UI → API → Database
```

### 2.2 API Contract First

Before implementing, define the API contract including:

```typescript
// Document expected request format
interface ApprovalRequest {
  action: "approve" | "reject";
  notes?: string;
  _csrf: string; // ← Don't forget security tokens
}

// Document expected response format
interface ApprovalResponse {
  success: boolean;
  approval: Approval;
  sentMessageId?: string;
}

// Document error format
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

---

## 3. Lifecycle & Initialization

### 3.1 Plan Initialization Points

**Learning**: Approval expiration scheduler was created but nothing starts it.

**Best Practice**: Every background process needs explicit lifecycle planning:

```markdown
## Scheduler/Worker Chunk

### Tasks

1. Implement scheduler logic
2. Create start/stop functions
3. **Add to application startup** ← Often forgotten!
4. Add health check endpoint
5. Document manual activation if needed

### Lifecycle Integration

- [ ] Where is this started? (app startup, worker process, cron)
- [ ] How is it stopped gracefully?
- [ ] What happens on restart?
- [ ] How is it monitored?
```

### 3.2 Startup Hooks Checklist

Create a startup hooks file and track what needs initialization:

```typescript
// src/lib/startup/index.ts
export async function initializeServices(): Promise<void> {
  // Document each initialization
  await initializeCache(); // From Phase 1
  await initializeJobQueues(); // From Phase 2
  await startApprovalExpiration(); // From Phase 3 ← Easy to miss!
  await startHistoryIdMonitor(); // From Phase 3
}
```

---

## 4. Logging Strategy

### 4.1 Define Logging Upfront

**Learning**: Console.log spread across codebase, then retrofitted with structured logger.

**Best Practice**: Create logger in first chunk of any module:

```markdown
## Chunk 1: Module Foundation

### Tasks

1. Create module directory structure
2. **Create structured logger** ← Do this first!
3. Define error types
4. Create TypeScript types
```

### 4.2 Logger Template

Every integration module should have:

```typescript
// src/integrations/{module}/logger.ts
import { createLogger } from "@/lib/logging";

export const moduleLogger = createLogger("ModuleName");
export const syncLogger = moduleLogger.child("Sync");
export const workerLogger = moduleLogger.child("Worker");
export const actionsLogger = moduleLogger.child("Actions");
```

Then enforce usage in code review - no `console.log` in production code.

---

## 5. Constants & Configuration

### 5.1 Extract Constants Early

**Learning**: Magic numbers scattered across files, extracted later.

**Best Practice**: Create constants file in Chunk 1:

```markdown
## Chunk 1: Module Foundation

### Files to Create

- src/integrations/{module}/constants.ts ← Always include!
- src/integrations/{module}/types.ts
- src/integrations/{module}/errors.ts
- src/integrations/{module}/logger.ts
```

### 5.2 Constants Categories

Organize constants by category:

```typescript
// constants.ts

// ─────────────────────────────────────────────────────────────
// Sync Configuration
// ─────────────────────────────────────────────────────────────
export const FULL_SYNC_MAX_PAGES = 100;
export const INCREMENTAL_SYNC_MAX_ENTRIES = 500;

// ─────────────────────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────────────────────
export const API_QUOTA_PER_SECOND = 100;
export const API_QUOTA_PER_MINUTE = 15000;

// ─────────────────────────────────────────────────────────────
// Timeouts
// ─────────────────────────────────────────────────────────────
export const REQUEST_TIMEOUT_MS = 30000;
export const RETRY_DELAY_MS = 1000;
```

---

## 6. Testing Strategy

### 6.1 Test Behavior, Not Types

**Learning**: Tests verified constants and types but missed actual behavior bugs.

**Anti-pattern**:

```typescript
describe("Sync Jobs", () => {
  it("should have correct job names", () => {
    expect(JOB_NAMES.FULL_SYNC).toBe("gmail-full-sync");
  });
});
```

**Better approach**:

```typescript
describe("Sync Jobs", () => {
  it("should create job with correct data", async () => {
    await scheduleFullSync("user-123");

    const job = await queue.getJob("gmail-full-sync");
    expect(job.data.userId).toBe("user-123");
  });

  it("should handle sync failure gracefully", async () => {
    mockGmailApi.listMessages.mockRejectedValue(new Error("API Error"));

    const result = await fullSync("user-123", "token");

    expect(result.errors).toHaveLength(1);
    expect(syncState.status).toBe("error");
  });
});
```

### 6.2 Mock Strategy Per Chunk

Each chunk with external dependencies should include:

```markdown
### Mock Requirements

- [ ] Mock factory functions for test data
- [ ] Mock client for external API
- [ ] Mock database operations (if needed)
- [ ] Fixtures for realistic test scenarios
```

### 6.3 Integration Test Chunk

Plan a dedicated testing chunk BEFORE polish:

```markdown
## Chunk N-1: Integration Testing (Before Polish)

### Tasks

1. Create mock factories for all external services
2. Write happy-path integration tests
3. Write error scenario tests
4. Write edge case tests
5. Measure and document test coverage

### Acceptance Criteria

- [ ] > 80% code coverage
- [ ] All critical paths tested
- [ ] Error handling verified
- [ ] Performance benchmarks established
```

---

## 7. Documentation Integration

### 7.1 Document as You Go

**Learning**: Documentation updates deferred to end, never completed.

**Best Practice**: Include documentation tasks in EVERY chunk:

```markdown
## Chunk N: Feature Implementation

### Tasks

- [ ] Implement feature X
- [ ] Add tests for feature X
- [ ] **Update API_REFERENCE.md with new endpoints**
- [ ] **Update relevant service docs**
```

### 7.2 Documentation Checklist

After each chunk, verify:

```markdown
### Documentation Updates

- [ ] API endpoints documented (request/response format)
- [ ] Configuration options documented
- [ ] Error codes and handling documented
- [ ] Usage examples added
- [ ] Architecture diagrams updated (if applicable)
```

---

## 8. Chunk Sizing

### 8.1 Right-Size Chunks

**Ideal chunk size**: 2-4 hours of focused work

**Signs a chunk is too big**:

- More than 10 files to create/modify
- Multiple unrelated concerns
- Dependencies on other incomplete chunks
- Estimated time > 6 hours

**Signs a chunk is too small**:

- Can be completed in < 1 hour
- Creates incomplete functionality
- Requires immediate follow-up chunk

### 8.2 Chunk Dependency Graph

Map dependencies explicitly:

```markdown
## Dependency Graph

Chunk 1: Foundation
↓
Chunk 2: Client Library ← Chunk 3: Database Models (parallel)
↓ ↓
└───────────┬───────────────┘
↓
Chunk 4: Sync
↓
Chunk 5: Actions
↓
Chunk 6: UI (depends on Chunk 4 + 5)
↓
Chunk 7: Testing (after all features)
```

---

## 9. Remediation Patterns

### 9.1 Track Technical Debt

Create explicit remediation tasks when cutting corners:

```markdown
## Known Shortcuts (TODO)

- [ ] Replace console.log with structured logging (#123)
- [ ] Add input validation to admin routes (#124)
- [ ] Extract shared utility from sync functions (#125)
```

### 9.2 Scheduled Remediation

Don't let technical debt accumulate:

```markdown
## Phase X Polish Chunk

Every N chunks, schedule remediation:

- Lint/type error cleanup
- Console.log removal
- Test coverage improvement
- Documentation updates
```

---

## 10. Chunk Template

Use this template for consistent chunk planning:

```markdown
## Chunk N: [Feature Name]

**Estimated Time**: X hours  
**Dependencies**: Chunks X, Y, Z  
**Goal**: One-sentence description

### Prerequisites

- [ ] Previous chunk completed
- [ ] Required services available
- [ ] Test environment ready

### Tasks

1. [ ] Task 1 (with acceptance criteria)
2. [ ] Task 2 (with acceptance criteria)
3. [ ] Task 3 (with acceptance criteria)

### Files to Create/Modify

src/
├── new-file.ts # NEW: Description
├── existing-file.ts # UPDATE: What's changing
└── test-file.test.ts # NEW: Test coverage

### Security Checklist

- [ ] Rate limiting applied
- [ ] CSRF protection (if state-changing)
- [ ] Input validation
- [ ] Sensitive data handling

### Testing Requirements

- [ ] Unit tests for new functions
- [ ] Integration tests for workflows
- [ ] Error scenario coverage

### Documentation Updates

- [ ] API reference
- [ ] Architecture docs (if applicable)
- [ ] README updates (if user-facing)

### Acceptance Criteria

- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] No new lint warnings
- [ ] Documentation updated
- [ ] Code reviewed

### Lifecycle Considerations

- [ ] What starts this? (if background process)
- [ ] What stops this?
- [ ] How is it monitored?
```

---

## 11. Anti-Patterns to Avoid

### 11.1 "Polish Later" Trap

❌ **Don't**: Defer quality work to a final "polish" chunk
✅ **Do**: Include quality work in each feature chunk

### 11.2 "Security as Afterthought"

❌ **Don't**: Plan security as a separate phase
✅ **Do**: Include security requirements in every chunk

### 11.3 "Scaffolding Without Wiring"

❌ **Don't**: Create functions without connecting them to lifecycle
✅ **Do**: Verify every function has a caller, every scheduler has a starter

### 11.4 "Backend-Only Features"

❌ **Don't**: Implement backend feature without UI integration plan
✅ **Do**: Plan full-stack delivery for each user-facing feature

### 11.5 "Type-Only Tests"

❌ **Don't**: Write tests that only verify types and constants exist
✅ **Do**: Write tests that verify behavior and catch regressions

---

## 12. Quick Reference Checklist

Before marking any chunk as complete:

```markdown
### Chunk Completion Checklist

**Code Quality**

- [ ] No console.log (use structured logger)
- [ ] No magic numbers (use constants)
- [ ] No unsafe type assertions (use type guards/Zod)
- [ ] No duplicate code (extract to shared utilities)

**Security**

- [ ] Rate limiting on new endpoints
- [ ] CSRF on state-changing endpoints
- [ ] Input validation with Zod
- [ ] Sensitive data encrypted/redacted

**Testing**

- [ ] Behavior tests (not just type tests)
- [ ] Error scenarios covered
- [ ] Edge cases handled

**Integration**

- [ ] Backend + frontend coordinated
- [ ] Lifecycle hooks connected
- [ ] Startup initialization verified

**Documentation**

- [ ] API endpoints documented
- [ ] Configuration documented
- [ ] Errors documented
```

---

## Conclusion

Following these practices will:

1. **Reduce security gaps** by including security in every chunk
2. **Improve reliability** by planning lifecycle and initialization
3. **Increase test coverage** by testing behavior, not just types
4. **Prevent drift** by documenting as you go
5. **Enable faster remediation** by tracking technical debt explicitly

Apply these lessons to all future phase implementations.

---

_Based on analysis of Phase 3 (Gmail Integration) implementation_  
_Document Version: 1.0_
