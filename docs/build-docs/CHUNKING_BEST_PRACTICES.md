# Chunking Best Practices

> **Purpose**: Lessons learned from Phase 3 implementation to improve future planning and execution  
> **Last Updated**: December 22, 2024 (v1.3)  
> **Based On**: Phase 3-1, Phase 3-2, Phase 3-3 Completion Analysis, and Phase 13 API Documentation  
> **Note**: CSRF protection is handled by Next Auth—do not implement custom CSRF token patterns

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

## Conclusion

Following these practices will:

1. **Reduce security gaps** by including security in every chunk
2. **Improve reliability** by planning lifecycle and initialization
3. **Increase test coverage** by testing behavior, not just types
4. **Prevent drift** by documenting as you go
5. **Enable faster remediation** by tracking technical debt explicitly
6. **Eliminate runtime errors** by verifying interface consistency
7. **Improve UX** by properly handling async loading states
8. **Keep APIs discoverable** by documenting routes with OpenAPI immediately _(New)_

Apply these lessons to all future phase implementations.

---

_Based on analysis of Phase 3 (Gmail Integration) and Phase 13 (API Documentation) implementation_  
_Document Version: 1.3_  
_Updated: December 22, 2024_
- _v1.3: Clarified CSRF protection handled by Next Auth - removed custom CSRF token patterns_
- _v1.2: Added OpenAPI documentation requirements from Phase 13_
