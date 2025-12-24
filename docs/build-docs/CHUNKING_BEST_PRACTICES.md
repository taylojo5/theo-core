# Chunking Best Practices

> **Purpose**: Lessons learned from Phase 3, Phase 4, and Phase 4-2 implementation to improve future planning and execution  
> **Last Updated**: December 23, 2024 (v1.5)  
> **Based On**: Phase 3-1, Phase 3-2, Phase 3-3, Phase 4-1, Phase 4-2 Completion Analysis, and Phase 13 API Documentation  
> **Note**: CSRF protection is handled by Next Auth—do not implement custom CSRF token patterns

---

## Overview

This document captures best practices for chunking implementation work, derived from analysis of the Phase 3 (Gmail Integration), Phase 4 (Google Calendar Integration), and Phase 4-2 (Calendar Deep Analysis) implementations. Following these practices will reduce drift from plan, minimize security gaps, improve code quality, and ensure cross-integration consistency.

---

## 1. Security-First Chunk Design

### 1.1 Include Security in Foundation Chunks

**Learning**: Security features (encryption, rate limiting, CSRF) were added as remediation, not as part of initial design.

**Best Practice**: Create a dedicated security foundation chunk early in any integration:

```markdown
## Chunk 0: Security Foundation (Before Feature Work)

### Tasks

1. Implement rate limiting middleware for new routes
2. Verify Next Auth CSRF protection covers new state-changing routes
3. Create encryption utilities for sensitive data storage
4. Define input sanitization patterns

### Acceptance Criteria

- [ ] Rate limit config for all planned endpoints
- [ ] Next Auth CSRF protection verified for all state-changing routes
- [ ] Encryption/decryption functions for tokens and secrets
- [ ] Sanitizer for user-provided content (HTML, URLs)
```

> **Note on CSRF**: Next Auth provides built-in CSRF protection for authenticated routes. Do NOT implement custom CSRF token handling—rely on Next Auth's session-based protection instead.

### 1.2 Security Checklist Per Chunk

Include a security checklist in every chunk that adds API endpoints:

```markdown
### Security Checklist

- [ ] Rate limiting applied to all new routes
- [ ] Next Auth CSRF protection covers state-changing endpoints (POST, PUT, PATCH, DELETE)
- [ ] Input validation with Zod schemas
- [ ] Sensitive data sanitized before logging
- [ ] Authentication verified before authorization
- [ ] Tokens/secrets encrypted before storage
- [ ] OpenAPI security requirements documented
```

> **Important**: Next Auth handles CSRF automatically for authenticated sessions. Do not add custom CSRF token logic.

### 1.3 Don't Split Security from Features

**Anti-pattern** (what went wrong):

```markdown
Chunk 8: Email Actions

- Create draft API ← No rate limiting planned
- Send email API ← No authentication check planned

Chunk 11: Security Polish (Later)

- Add rate limiting to all routes
- Add authentication checks
```

**Better approach**:

```markdown
Chunk 8: Email Actions (with Security)

- Create draft API with rate limiting
- Send email API with authentication (Next Auth handles CSRF)
- Audit logging for all actions
```

---

## 2. UI + Backend Coordination

### 2.1 Plan Full-Stack Features Together

**Learning**: Backend and frontend features were implemented separately, causing integration issues.

**Best Practice**: Every feature chunk should specify both backend AND frontend changes:

```markdown
## Chunk: Email Approval Workflow

### Backend Tasks

- POST /api/approvals/[id] - Approve/reject endpoint
- Authentication check via Next Auth (CSRF handled automatically)
- Audit logging

### Frontend Tasks

- Implement approval/reject UI actions
- Handle loading states during async operations
- Handle error responses gracefully

### Integration Tests

- Test full flow: UI → API → Database
```

> **Note**: Next Auth provides CSRF protection for authenticated sessions automatically. No custom token handling needed in the frontend.

### 2.2 API Contract First

Before implementing, define the API contract including:

```typescript
// Document expected request format
interface ApprovalRequest {
  action: "approve" | "reject";
  notes?: string;
  // Note: CSRF protection handled by Next Auth session - no token needed in body
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
- [ ] **Add OpenAPI schemas and paths for new endpoints**
- [ ] **Update API_REFERENCE.md with new endpoints**
- [ ] **Update relevant service docs**
```

### 7.2 Documentation Checklist

After each chunk, verify:

```markdown
### Documentation Updates

- [ ] API endpoints documented (request/response format)
- [ ] OpenAPI schemas added to src/openapi/components/schemas/
- [ ] OpenAPI paths registered in src/openapi/paths/
- [ ] Configuration options documented
- [ ] Error codes and handling documented
- [ ] Usage examples added
- [ ] Architecture diagrams updated (if applicable)
```

### 7.3 OpenAPI Documentation for API Routes _(New from Phase 13)_

**Learning**: API routes were created without corresponding OpenAPI documentation, making the `/docs` page incomplete.

**Best Practice**: Every API route chunk MUST include OpenAPI documentation:

```markdown
## Chunk N: [Feature] API Routes

### API Documentation Tasks

1. Create Zod schemas in `src/openapi/components/schemas/{feature}.ts`
2. Register path operations in `src/openapi/paths/{feature}.ts`
3. Export from `src/openapi/paths/index.ts`
4. Verify endpoint appears in `/docs` page

### Files to Create/Modify

src/openapi/
├── components/schemas/{feature}.ts  # NEW: Request/response schemas
├── paths/{feature}.ts               # NEW: Path operations
└── paths/index.ts                   # UPDATE: Export new paths
```

**Example** - Adding a new endpoint:

```typescript
// 1. Define schemas (src/openapi/components/schemas/widget.ts)
import { z } from "zod";

export const WidgetSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
}).openapi("Widget");

export const CreateWidgetSchema = z.object({
  name: z.string().min(1),
}).openapi("CreateWidgetInput");

// 2. Register paths (src/openapi/paths/widget.ts)
import { registry } from "../index";
import { WidgetSchema, CreateWidgetSchema } from "../components/schemas/widget";

registry.registerPath({
  method: "post",
  path: "/api/widgets",
  tags: ["Widgets"],
  summary: "Create a widget",
  request: {
    body: {
      content: { "application/json": { schema: CreateWidgetSchema } },
    },
  },
  responses: {
    201: {
      description: "Widget created",
      content: { "application/json": { schema: WidgetSchema } },
    },
  },
});

// 3. Export from paths/index.ts
export * from "./widget";
```

### 7.4 OpenAPI Verification Checklist

Before marking any chunk with API routes complete:

```markdown
### OpenAPI Verification

- [ ] All new routes have corresponding path registrations
- [ ] Request body schemas match actual validation (Zod schemas)
- [ ] Response schemas match actual API responses
- [ ] Error responses (400, 401, 403, 404, 500) are documented
- [ ] Path parameters and query parameters are defined
- [ ] Security requirements (auth) are specified
- [ ] Endpoint is visible and testable at /docs
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
- [ ] Authentication via Next Auth (CSRF protection included)
- [ ] Input validation
- [ ] Sensitive data handling

### Testing Requirements

- [ ] Unit tests for new functions
- [ ] Integration tests for workflows
- [ ] Error scenario coverage

### Documentation Updates

- [ ] API reference
- [ ] OpenAPI schemas and paths (if adding routes)
- [ ] Verify new endpoints appear in /docs
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

### 11.6 "Inconsistent Method Naming" _(New from Phase 3-3)_

❌ **Don't**: Use different method names across files for the same operation
✅ **Do**: Verify method calls match actual interface definitions

**Example** (what went wrong):

```typescript
// Repository defines:
get: async (userId: string): Promise<GmailSyncState> => { ... }

// But consumer calls:
const syncState = await syncStateRepository.getOrCreate(userId); // ← Runtime error!
```

**Lesson**: Always grep for method usage after renaming or creating methods.

### 11.7 "Catch Block Variable Scope Errors" _(New from Phase 3-3)_

❌ **Don't**: Reference variables in catch blocks that may not be defined
✅ **Do**: Declare variables before try block or use optional chaining

**Anti-pattern**:

```typescript
try {
  const session = await auth();
  const userId = session.user.id;
  // ...
} catch (error) {
  logger.error("Failed", { userId }); // userId may be undefined!
}
```

**Better approach**:

```typescript
let userId: string | undefined;
try {
  const session = await auth();
  userId = session?.user?.id;
  if (!userId) throw new Error("Unauthorized");
  // ...
} catch (error) {
  logger.error("Failed", { userId }); // Safe - userId is in scope
}
```

### 11.8 "Undocumented API Routes" _(New from Phase 13)_

❌ **Don't**: Create API routes without OpenAPI documentation
✅ **Do**: Add OpenAPI schemas and paths in the same chunk as route implementation

**Anti-pattern**:

```markdown
Chunk 5: User Settings API

- Create GET /api/settings endpoint
- Create PATCH /api/settings endpoint
- Add validation

Chunk 12: Documentation (Later)

- Document all the API endpoints
```

**Better approach**:

```markdown
Chunk 5: User Settings API (with Documentation)

- Create GET /api/settings endpoint
- Create PATCH /api/settings endpoint
- Add validation
- Add OpenAPI schemas for settings
- Register paths in OpenAPI
- Verify endpoints appear in /docs
```

**Why this matters**: Undocumented APIs become invisible technical debt. Consumers can't discover or test them. Treating documentation as a separate phase means it never gets done.

### 11.9 "Async Hook State Initialization" _(New from Phase 3-3)_

❌ **Don't**: Initialize loading state as `false` when async fetch happens on mount
✅ **Do**: Initialize loading state as `true` and set to `false` after fetch completes

**Anti-pattern**:

```typescript
function useUserData() {
  const [data, setData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false); // Wrong!

  useEffect(() => {
    setIsLoading(true);
    fetchUserData().finally(() => setIsLoading(false));
  }, []);
}
// User can interact with incomplete UI before data loads
```

**Better approach**:

```typescript
function useUserData() {
  const [data, setData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start as true

  useEffect(() => {
    fetchUserData()
      .then(setData)
      .finally(() => setIsLoading(false));
  }, []);
}
// UI shows loading state until data is ready
```

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
- [ ] Method calls match actual interface definitions
- [ ] Error handler variable scope is correct

**Security**

- [ ] Rate limiting on new endpoints
- [ ] Authentication via Next Auth (CSRF protection included)
- [ ] Input validation with Zod
- [ ] Sensitive data encrypted/redacted

**Testing**

- [ ] Behavior tests (not just type tests)
- [ ] Error scenarios covered
- [ ] Edge cases handled
- [ ] Runtime error scenarios tested

**Integration**

- [ ] Backend + frontend coordinated
- [ ] Lifecycle hooks connected
- [ ] Startup initialization verified
- [ ] Loading states handle async operations

**Documentation**

- [ ] API endpoints documented
- [ ] OpenAPI schemas added (if new routes)
- [ ] OpenAPI paths registered (if new routes)
- [ ] New endpoints visible in /docs
- [ ] Configuration documented
- [ ] Errors documented
```

---

## 13. API Consistency Patterns _(New from Phase 3-3)_

### 13.1 Standardize Error Response Format

**Learning**: Error responses were inconsistent - some returned `{ error: string }`, others returned `{ error: { code, message } }`.

**Best Practice**: Define a standard error response format at project start:

```typescript
// src/types/api.ts
export interface APIErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Use helper function
export function createErrorResponse(
  code: string,
  message: string,
  status: number,
  headers?: HeadersInit
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status, headers });
}
```

### 13.2 Consistent Error Handling in Route Handlers

**Best Practice**: Always capture variables before try blocks for error logging:

```typescript
export async function POST(request: NextRequest) {
  // Capture identifiers before try block
  let userId: string | undefined;
  let resourceId: string | undefined;

  try {
    const session = await auth();
    userId = session?.user?.id;
    if (!userId) return createErrorResponse("UNAUTHORIZED", "...", 401);

    resourceId = (await request.json()).resourceId;
    // ... business logic
  } catch (error) {
    // Safe to use - variables are in scope
    logger.error("Operation failed", { userId, resourceId }, error);
    return createErrorResponse("INTERNAL_ERROR", "...", 500);
  }
}
```

---

## 14. React Hook Patterns _(New from Phase 3-3)_

### 14.1 Async Data Hooks

**Best Practice**: Hooks that fetch data on mount should initialize loading as `true`:

```typescript
export function useData() {
  const [data, setData] = useState<Data | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start true
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, []);

  return { data, isLoading, error };
}
```

### 14.2 Authenticated Fetch Patterns

**Best Practice**: When creating hooks for authenticated requests, Next Auth handles session and CSRF automatically:

```typescript
export function useAuthenticatedFetch() {
  const { data: session, status } = useSession();
  const isReady = status === "authenticated";

  const authenticatedFetch = useCallback(
    async (url: string, options?: RequestInit) => {
      if (!isReady) throw new Error("Not authenticated");
      // Next Auth session cookie is sent automatically
      // CSRF protection is handled by Next Auth
      return fetch(url, {
        ...options,
        credentials: "include", // Ensure cookies are sent
      });
    },
    [isReady]
  );

  return { authenticatedFetch, isReady };
}
```

> **Note**: No custom CSRF token handling needed. Next Auth provides CSRF protection for authenticated sessions automatically.

### 14.3 Button Loading States

**Best Practice**: Disable buttons during async operations:

```typescript
function ActionButton({ onAction }: { onAction: () => Promise<void> }) {
  const [isLoading, setIsLoading] = useState(false);
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";

  return (
    <Button
      disabled={!isAuthenticated || isLoading}
      onClick={async () => {
        setIsLoading(true);
        try {
          await onAction();
        } finally {
          setIsLoading(false);
        }
      }}
    >
      {isLoading ? <Spinner /> : "Submit"}
    </Button>
  );
}
```

---

## 15. Interface Verification Checklist _(New from Phase 3-3)_

### 15.1 Before Finalizing Any Chunk

Add this verification step to every chunk completion:

```markdown
### Interface Verification

- [ ] All imported functions/methods exist in source files
- [ ] All method signatures match between call sites and definitions
- [ ] All variable references in catch blocks are in scope
- [ ] All async hook states properly initialize loading
- [ ] Error response formats are consistent with project standard
- [ ] All new API routes have OpenAPI documentation
- [ ] OpenAPI schemas match actual request/response types
```

### 15.2 Quick Grep Verification

After renaming or creating new methods, verify usage:

```bash
# Find all usages of a repository method
grep -r "syncStateRepository\." src/

# Verify method exists
grep "export const syncStateRepository" src/integrations/gmail/repository.ts
```

---

## 16. Rate Limiter Design Patterns _(New from Phase 4)_

### 16.1 Unit-Aware Rate Limiting

**Learning**: Calendar API operations have different quota costs. A naive rate limiter that counts requests equally leads to quota exhaustion.

**Best Practice**: Define quota units per operation type:

```typescript
// src/integrations/{module}/types.ts
export const QUOTA_UNITS = {
  "calendars.list": 1,
  "calendars.get": 1,
  "events.list": 1,
  "events.get": 1,
  "events.insert": 3,
  "events.update": 3,
  "events.delete": 2,
  "channels.stop": 1,
} as const;
```

### 16.2 Atomic Quota Consumption for Multi-Step Operations

**Learning**: Operations like `updateEvent` that require multiple API calls (get + update) need atomic quota checking.

**Best Practice**: Use `additionalUnits` parameter to reserve quota for the entire operation:

```typescript
// Good: Reserve quota for entire operation atomically
async updateEvent(params: UpdateEventParams): Promise<Event> {
  return this.execute(
    "events.update",
    async () => {
      const current = await this.calendar.events.get({ ... });
      return this.calendar.events.update({ ... });
    },
    { additionalUnits: 1 } // Account for the get + update
  );
}
```

### 16.3 Peek-Before-Consume Pattern

**Learning**: Consuming quota tokens before checking availability leads to wasted tokens on concurrent requests.

**Best Practice**: Implement peek + check pattern:

```typescript
// Wait for quota without consuming
await rateLimiter.waitForQuotaUnits(userId, totalUnits);

// Peek again immediately before consumption (double-check)
const canProceed = await rateLimiter.peekUnits(userId, totalUnits);
if (!canProceed) {
  throw new Error("Rate limit exceeded");
}

// Now consume atomically
const result = await rateLimiter.checkUnits(userId, totalUnits);
```

---

## 17. Data Mapper Patterns _(New from Phase 4)_

### 17.1 Round-Trip Verification

**Learning**: Mappers that convert between API and DB formats must be verified for round-trip consistency.

**Best Practice**: Add round-trip tests for all bidirectional mappers:

```typescript
describe("Event Mappers", () => {
  it("should round-trip event data correctly", () => {
    const original = createMockGoogleEvent();
    const dbModel = mapGoogleEventToDb(original);
    const backToGoogle = mapDbEventToGoogleInput(dbModel);
    
    // Core fields should survive round-trip
    expect(backToGoogle.summary).toBe(original.summary);
    expect(backToGoogle.start).toEqual(original.start);
    expect(backToGoogle.end).toEqual(original.end);
  });
});
```

### 17.2 Edge Case Documentation

**Best Practice**: Document edge cases in mapper code with comments:

```typescript
export function parseEventDateTime(dateTime: EventDateTime): Date {
  // All-day events: Google sends { date: "2024-01-15" } without timezone
  // We convert to midnight UTC for consistent storage
  if (dateTime.date) {
    return new Date(`${dateTime.date}T00:00:00Z`);
  }
  
  // Timed events: Google sends { dateTime: "...", timeZone: "..." }
  return new Date(dateTime.dateTime!);
}
```

### 17.3 Defensive Null Handling

**Learning**: External APIs return inconsistent data—null, undefined, or missing fields.

**Best Practice**: Use defensive accessors with clear defaults:

```typescript
// Good: Defensive with meaningful defaults
const attendees = event.attendees?.map(normalizeAttendee) ?? [];
const description = event.description ?? "";
const location = event.location ?? null;

// Bad: Trusting API to always provide data
const attendees = event.attendees.map(normalizeAttendee); // May throw!
```

---

## 18. Scheduler Lifecycle Integration _(New from Phase 4)_

### 18.1 Instrumentation File Pattern

**Learning**: Calendar schedulers were created but not connected to application startup in `instrumentation.ts`.

**Best Practice**: Every new integration with background processes MUST update `instrumentation.ts`:

```typescript
// instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initializeGmailSync } = await import("@/integrations/gmail/jobs/scheduler");
    const { initializeSchedulers: initializeCalendarSchedulers } = await import("@/integrations/calendar/sync/scheduler");
    const { initializeEmbeddingWorker } = await import("@/lib/embeddings/worker");
    
    await Promise.all([
      initializeGmailSync(),
      initializeCalendarSchedulers(), // ← Don't forget new integrations!
      initializeEmbeddingWorker(),
    ]);
  }
}
```

### 18.2 Scheduler Checklist

Add this to every chunk that creates background jobs:

```markdown
### Scheduler Integration

- [ ] Scheduler start function created
- [ ] Scheduler stop function created (for graceful shutdown)
- [ ] **instrumentation.ts updated to call start function**
- [ ] Scheduler logs startup and shutdown
- [ ] Health check endpoint added (optional)
```

---

## 19. Cross-Integration Code Sharing _(New from Phase 4)_

### 19.1 Identify WET Patterns Early

**Learning**: Gmail and Calendar integrations have nearly identical approval workflow patterns, scopes utilities, and job queue abstractions.

**Best Practice**: Before implementing a similar integration, grep for reusable patterns:

```bash
# Find approval-related code
grep -r "approval" src/integrations/gmail/
grep -r "Approval" src/integrations/gmail/

# If patterns are similar, extract to shared location
# src/lib/integrations/approval-workflow.ts
# src/lib/integrations/scope-utils.ts
```

### 19.2 Shared Integration Utilities

When multiple integrations need similar functionality, create shared utilities:

```typescript
// src/lib/integrations/approval-workflow.ts
export interface ApprovalWorkflowConfig<T> {
  getApproval: (id: string) => Promise<T | null>;
  updateStatus: (id: string, status: ApprovalStatus) => Promise<T>;
  executeAction: (approval: T) => Promise<void>;
  auditLogger: AuditLogger;
}

export function createApprovalWorkflow<T>(config: ApprovalWorkflowConfig<T>) {
  return {
    approve: async (id: string) => { /* shared logic */ },
    reject: async (id: string) => { /* shared logic */ },
    expire: async () => { /* shared logic */ },
  };
}
```

### 19.3 Pattern Extraction Trigger

**Heuristic**: If you're copying more than 50 lines from one integration to another, extract to a shared utility.

---

## 20. Database Update Patterns _(New from Phase 4)_

### 20.1 Undefined vs Null Handling

**Learning**: Prisma treats `undefined` as "don't update" and `null` as "set to null". This distinction is critical for partial updates.

**Best Practice**: Use helper functions to strip undefined values:

```typescript
// src/lib/db/utils.ts
export function omitUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined)
  ) as Partial<T>;
}

// Usage in repository
async update(id: string, data: Partial<EventInput>): Promise<Event> {
  return prisma.event.update({
    where: { id },
    data: omitUndefined(data), // Only update defined fields
  });
}
```

### 20.2 Upsert Best Practices

**Best Practice**: Use consistent upsert patterns with explicit conflict handling:

```typescript
async upsertEvent(googleId: string, data: EventInput): Promise<Event> {
  return prisma.event.upsert({
    where: { 
      googleId,
      deletedAt: null, // Don't resurrect soft-deleted events
    },
    create: { googleId, ...data },
    update: omitUndefined(data),
  });
}
```

### 20.3 Batch Upsert Transactions

**Best Practice**: Use interactive transactions for batch upserts:

```typescript
async upsertMany(events: EventInput[]): Promise<Event[]> {
  return prisma.$transaction(async (tx) => {
    const results: Event[] = [];
    for (const event of events) {
      const result = await tx.event.upsert({ ... });
      results.push(result);
    }
    return results;
  });
}
```

---

## 21. UI State Management Patterns _(New from Phase 4)_

### 21.1 Consolidated Loading States

**Learning**: Managing individual loading states for each data fetch creates boilerplate and inconsistency.

**Best Practice**: Use a consolidated loading state object or custom hook:

```typescript
// Good: Consolidated loading states
const [loadingStates, setLoadingStates] = useState({
  connection: true,
  calendars: false,
  sync: false,
  approvals: false,
});

const setLoading = (key: keyof typeof loadingStates, value: boolean) => {
  setLoadingStates((prev) => ({ ...prev, [key]: value }));
};

// Better: Custom hook abstraction
function useAsyncData<T>(fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setData(await fetcher());
    } catch (e) {
      setError(e as Error);
    } finally {
      setIsLoading(false);
    }
  }, [fetcher]);

  return { data, isLoading, error, refresh };
}
```

### 21.2 OAuth Connection Pattern Abstraction

**Learning**: OAuth connection logic (signIn with scopes, disconnect) is duplicated across integrations.

**Best Practice**: Create a reusable OAuth connection component:

```typescript
// src/components/integrations/OAuthConnectionCard.tsx
interface OAuthConnectionCardProps {
  provider: "google" | "microsoft" | "slack";
  scopes: string[];
  isConnected: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export function OAuthConnectionCard({ ... }: OAuthConnectionCardProps) {
  // Shared connection UI and logic
}
```

---

## 22. Anti-Patterns from Phase 4 _(New)_

### 22.1 "Scheduler Without Startup"

❌ **Don't**: Create scheduler functions without connecting to application lifecycle
✅ **Do**: Update `instrumentation.ts` in the same chunk that creates the scheduler

**What went wrong**:

```typescript
// scheduler.ts created with:
export async function initializeSchedulers() { ... }

// But instrumentation.ts was never updated to call it!
// Schedulers never start in production
```

### 22.2 "Duplicated Approval Logic"

❌ **Don't**: Copy approval workflow logic between integrations
✅ **Do**: Extract shared approval workflow to a reusable utility

**What went wrong**:

```typescript
// Gmail approval: ~200 lines
// Calendar approval: ~200 lines (nearly identical)
// Should have been: shared approval utility + 50 lines per integration
```

### 22.3 "Incomplete Mapper Tests"

❌ **Don't**: Test mappers only for happy path
✅ **Do**: Test round-trip consistency, edge cases, and timezone handling

**What went wrong**:

```typescript
// Tests only verified one direction:
it("maps Google event to DB", () => { ... });

// Missing:
it("maps DB event back to Google format", () => { ... });
it("handles all-day events correctly", () => { ... });
it("preserves timezone information", () => { ... });
```

### 22.4 "Inconsistent Connection Status Endpoints"

❌ **Don't**: Use different patterns for similar endpoints across integrations
✅ **Do**: Standardize integration status endpoints

**What went wrong**:

```typescript
// Gmail: GET /api/integrations/gmail/status
// Calendar: GET /api/integrations/calendar/connection
// Should be consistent: /api/integrations/{provider}/status
```

### 22.5 "Placeholder Implementation in Production Code" _(New from Phase 4-2)_

❌ **Don't**: Leave placeholder implementations that log but don't act
✅ **Do**: Either implement fully or throw a clear "NotImplemented" error

**What went wrong**:

```typescript
// This placeholder was deployed and appeared to work:
const triggerSync = async (_userId: string): Promise<void> => {
  logger.info("Incremental sync triggered for user", { userId: _userId });
  // In production: await scheduleIncrementalSync(queue, userId)  ← NOT IMPLEMENTED!
};

// Webhooks appeared to work but sync never happened
```

**Better approach**:

```typescript
// Option 1: Full implementation
const triggerSync = async (userId: string): Promise<void> => {
  const queue = getQueue(QUEUE_NAMES.CALENDAR_SYNC);
  await scheduleIncrementalSync(queue, userId);
};

// Option 2: Clear failure if not ready
const triggerSync = async (_userId: string): Promise<void> => {
  throw new Error("NOT_IMPLEMENTED: triggerSync requires queue adapter");
};
```

### 22.6 "Missing Auto-Start Behaviors Between Integrations" _(New from Phase 4-2)_

❌ **Don't**: Implement auto-start behavior in one integration but forget it in another
✅ **Do**: Create a checklist of "on connect" behaviors that all integrations should implement

**What went wrong**:

```typescript
// Gmail connect endpoint starts recurring sync for returning users:
if (scopeCheck.hasRequiredScopes && !body.force) {
  const hasRecurring = await hasRecurringSync(userId);
  if (!hasRecurring) {
    await startRecurringSync(userId);  // ✅ Gmail does this
    await triggerSync(userId);
  }
}

// Calendar connect was missing this entirely!
if (scopeCheck.hasRequiredScopes && !body.force) {
  return NextResponse.json({  // ❌ No auto-sync logic
    success: true,
    alreadyConnected: true,
  });
}
```

**Best Practice**: Create a "Connect Behavior Checklist" for all integrations:

```markdown
### On Connect (already authorized) Checklist

- [ ] Check if recurring sync is running
- [ ] Start recurring sync if not running
- [ ] Trigger immediate sync for fresh data
- [ ] Log successful auto-start
- [ ] Handle errors gracefully (don't fail connect)
```

---

## 23. Cross-Integration Pattern Verification _(New from Phase 4-2)_

### 23.1 Extraction-Ready vs Shared Code Decision

> **Critical Architectural Decision**: Are integrations designed for future extraction into separate clusters/microservices?

**If YES (extraction-ready)**:
- **Intentional duplication is correct** - Each integration should be self-contained
- **Avoid shared utilities between integrations** - This creates extraction-blocking coupling
- **Pattern consistency via documentation** - Document conventions, don't enforce via imports
- **Share only infrastructure** - Auth, rate limiting, queue primitives in core

**If NO (monolith)**:
- Extract shared patterns when implementing similar logic for the second time
- Create `src/lib/integrations/shared-*.ts` utilities

### 23.2 Integration Comparison Checklist (Documentation-Focused)

After implementing a new integration, compare patterns and **document divergence** (don't necessarily fix it):

```markdown
### Cross-Integration Pattern Documentation

Compare new integration with existing similar integration(s):

- [ ] Document any intentional differences in connect behavior
- [ ] Document status value semantics (e.g., "executed" vs "sent")
- [ ] Verify consistent behaviors are implemented (auto-sync start)
- [ ] Test file structure follows conventions
- [ ] OpenAPI paths registered for all endpoints

Note: Pattern differences are acceptable if semantically meaningful.
Integrations can evolve independently for future extraction.
```

### 23.3 When to Share Code (Infrastructure Only)

Only share code that would live in cluster infrastructure after extraction:

```typescript
// ✅ OK to share (infrastructure)
import { auth } from "@/lib/auth";
import { applyRateLimit } from "@/lib/rate-limit";
import { getQueue } from "@/lib/queue";
import { db } from "@/lib/db";
import { logAuditEntry } from "@/services/audit";

// ❌ DON'T share (integration-specific)
import { approvalWorkflow } from "@/lib/integrations/approval-workflow";
import { connectHandler } from "@/lib/integrations/connect-handler";
```

---

## 24. Test File Verification _(New from Phase 4-2)_

### 24.1 Test File Checklist

Every chunk plan that mentions testing should include explicit test file verification:

```markdown
### Test File Verification

Before marking chunk complete, verify these files exist:

- [ ] `tests/integrations/{module}/actions.test.ts`
- [ ] `tests/integrations/{module}/sync.test.ts`
- [ ] `tests/integrations/{module}/api.test.ts`  ← Often forgotten!
- [ ] `tests/integrations/{module}/webhook.test.ts`
- [ ] `tests/integrations/{module}/mocks/index.ts`
```

### 24.2 "Polish" Chunk Test Verification

In the final Polish chunk, add this explicit verification step:

```markdown
### Polish Chunk - Test Verification

- [ ] Compare test file list with chunk plan
- [ ] Identify any missing test files from plan
- [ ] Create missing test files or document why they're not needed
- [ ] Run coverage report and document gaps
```

---

## 25. OpenAPI Coverage Verification _(New from Phase 4-2)_

### 25.1 Route-to-OpenAPI Mapping

Before marking API route chunks complete, verify every route has OpenAPI documentation:

```bash
# Find all route files
find src/app/api -name "route.ts" | sort

# Compare with OpenAPI registrations
grep -r "registerPath" src/openapi/paths/ | grep "{integration}"

# Any route file not covered by OpenAPI = missing documentation
```

### 25.2 OpenAPI Polish Checklist

Add to Chunk 12 (Polish & Review):

```markdown
### OpenAPI Coverage Verification

- [ ] List all route.ts files in src/app/api/integrations/{module}/
- [ ] Verify each route has corresponding registerPath() call
- [ ] Check all HTTP methods are documented (GET, POST, PATCH, DELETE)
- [ ] Visit /docs and manually verify endpoints appear
- [ ] Test at least one endpoint via Swagger UI
```

---

## Conclusion

Following these practices will:

1. **Reduce security gaps** by including security in every chunk
2. **Improve reliability** by planning lifecycle and initialization
3. **Increase test coverage** by testing behavior, not just types
4. **Prevent drift** by documenting as you go
5. **Enable faster remediation** by tracking technical debt explicitly
6. **Eliminate runtime errors** by verifying interface consistency
7. **Improve UX** by properly handling async loading states
8. **Keep APIs discoverable** by documenting routes with OpenAPI immediately
9. **Prevent quota exhaustion** by using unit-aware rate limiting _(Phase 4)_
10. **Ensure background processes start** by updating instrumentation.ts _(Phase 4)_
11. **Catch placeholder code** by using explicit errors instead of logging stubs _(Phase 4-2)_
12. **Support future extraction** by keeping integrations self-contained _(Phase 4-2)_
13. **Document pattern divergence** instead of forcing consistency where semantics differ _(Phase 4-2)_
14. **Verify test coverage** by explicitly checking test file existence in Polish chunks _(Phase 4-2)_

Apply these lessons to all future phase implementations.

---

_Based on analysis of Phase 3 (Gmail), Phase 4 & 4-2 (Calendar), and Phase 13 (API Docs) implementations_  
_Document Version: 1.5_  
_Updated: December 23, 2024_
- _v1.5: Added Phase 4-2 deep analysis learnings - extraction-ready architecture, placeholder detection, documentation-focused pattern verification_
- _v1.4: Added Phase 4 (Calendar) learnings - rate limiting, mappers, schedulers, cross-integration patterns_
- _v1.3: Clarified CSRF protection handled by Next Auth - removed custom CSRF token patterns_
- _v1.2: Added OpenAPI documentation requirements from Phase 13_
