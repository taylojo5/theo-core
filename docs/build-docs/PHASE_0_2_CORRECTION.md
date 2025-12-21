# Phase 0-2 Correction: Pre-Phase 3 Remediation Plan

> **Status**: Ready for Implementation  
> **Created**: December 19, 2024  
> **Target Duration**: 3-5 days  
> **Purpose**: Address all gaps, risks, and missing functionality before Phase 3 (Gmail Integration)

---

## Overview

This document outlines remediation work required before proceeding to Phase 3. The work addresses:

1. **Missing Functionality** from Phases 0-2 that was planned but not implemented
2. **High Priority Risks** that could cause significant issues
3. **Medium Priority Risks** that should be addressed for production readiness
4. **Infrastructure Setup** needed for Phase 3 (BullMQ, Redis integration)

### Why This Matters

Phase 3 (Gmail Integration) will introduce:

- OAuth token management with refresh flows
- Background sync workers
- High-volume API calls (rate limiting critical)
- Email content processing (error handling critical)

Without this remediation, Phase 3 will accumulate technical debt and potentially fail in production scenarios.

---

## Implementation Chunks

The work is divided into 8 chunks, organized by priority and dependency. Each chunk is designed to be completed in a single session.

| Chunk | Description                       | Priority | Est. Time | Dependencies |
| ----- | --------------------------------- | -------- | --------- | ------------ |
| 1     | Developer Experience: Git Hooks   | Medium   | 30min     | None         |
| 2     | Error Boundaries & Error Handling | High     | 2hr       | None         |
| 3     | API Rate Limiting                 | Medium   | 2hr       | None         |
| 4     | Input Validation Audit            | Medium   | 2hr       | None         |
| 5     | Redis Integration                 | Medium   | 1.5hr     | None         |
| 6     | BullMQ Job Queue Setup            | Medium   | 2hr       | Chunk 5      |
| 7     | Real-time Updates (SSE)           | High     | 3hr       | None         |
| 8     | OAuth Token Refresh & Testing     | High     | 2hr       | None         |

**Total Estimated Time**: 15-17 hours (3-4 days at focused pace)

---

## Chunk 1: Developer Experience - Git Hooks

**Priority**: Medium  
**Estimated Time**: 30 minutes  
**Dependencies**: None  
**Risk Addressed**: Code quality enforcement, prevent bad commits

### Description

Install and configure Husky and lint-staged to enforce code quality on every commit. This was planned in Phase 0 but not implemented.

### Tasks

1. Install dependencies
2. Initialize Husky
3. Configure lint-staged
4. Add pre-commit hooks
5. Test the setup

### Implementation

#### 1.1 Install Dependencies

```bash
npm install -D husky lint-staged
```

#### 1.2 Initialize Husky

```bash
npx husky init
```

This creates `.husky/` directory with a sample pre-commit hook.

#### 1.3 Configure lint-staged

Add to `package.json`:

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

#### 1.4 Update Pre-commit Hook

Replace `.husky/pre-commit` content:

```bash
npx lint-staged
```

#### 1.5 Add Commit Message Hook (Optional)

Create `.husky/commit-msg`:

```bash
# Enforce conventional commits (optional)
# npx --no -- commitlint --edit ${1}
```

### Files to Create/Modify

```
.husky/
├── pre-commit          # Run lint-staged
└── commit-msg          # Optional: conventional commits
package.json            # Add lint-staged config
```

### Acceptance Criteria

- [ ] `npm install` completes without errors
- [ ] Pre-commit hook runs on `git commit`
- [ ] Lint errors prevent commit
- [ ] Prettier formats staged files
- [ ] Clean commits still work normally

---

## Chunk 2: Error Boundaries & Error Handling

**Priority**: High  
**Estimated Time**: 2 hours  
**Dependencies**: None  
**Risk Addressed**: App crashes on component errors, poor error UX

### Description

Implement React Error Boundaries to gracefully handle runtime errors in the UI. Add global error handling for unhandled promise rejections and provide user-friendly error states.

### Tasks

1. Create ErrorBoundary component
2. Create error fallback UI component
3. Wrap dashboard layout with error boundary
4. Wrap chat page with error boundary
5. Add global error handler
6. Create error logging utility

### Implementation

#### 2.1 Error Boundary Component

Create `src/components/shared/error-boundary.tsx`:

```typescript
"use client";

import * as React from "react";
import { Button } from "@/components/ui";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onReset?: () => void;
}

export function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
        <h2 className="mb-2 text-lg font-semibold text-red-800 dark:text-red-200">
          Something went wrong
        </h2>
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
          {error?.message || "An unexpected error occurred"}
        </p>
        {onReset && (
          <Button variant="outline" onClick={onReset}>
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}
```

#### 2.2 Update Dashboard Layout

Modify `src/app/(dashboard)/layout.tsx`:

```typescript
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ErrorBoundary } from "@/components/shared/error-boundary";

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <ErrorBoundary>
      {children}
    </ErrorBoundary>
  );
}
```

#### 2.3 Global Error Handler

Create `src/lib/utils/error-handler.ts`:

```typescript
export interface AppError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: Date;
}

export function createAppError(
  code: string,
  message: string,
  details?: unknown
): AppError {
  return {
    code,
    message,
    details,
    timestamp: new Date(),
  };
}

export function logError(error: AppError | Error) {
  // In production, this would send to error tracking service (Sentry, etc.)
  console.error("[Error]", {
    ...(error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error),
    timestamp: new Date().toISOString(),
  });
}

// API error response helper
export function apiErrorResponse(
  code: string,
  message: string,
  status: number = 500
) {
  return Response.json({ error: { code, message } }, { status });
}
```

#### 2.4 Global Error Boundary Provider

Create `src/components/providers/error-provider.tsx`:

```typescript
"use client";

import * as React from "react";
import { ErrorBoundary } from "@/components/shared/error-boundary";

export function ErrorProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    // Global unhandled rejection handler
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error("[Unhandled Rejection]", event.reason);
      // In production: send to error tracking
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return <ErrorBoundary>{children}</ErrorBoundary>;
}
```

### Files to Create/Modify

```
src/components/shared/
├── error-boundary.tsx      # NEW: Error boundary component
└── index.ts                # NEW: Barrel exports

src/lib/utils/
└── error-handler.ts        # NEW: Error utilities

src/components/providers/
├── error-provider.tsx      # NEW: Global error provider
└── index.ts                # UPDATE: Add export

src/app/(dashboard)/
└── layout.tsx              # UPDATE: Wrap with ErrorBoundary

src/app/layout.tsx          # UPDATE: Add ErrorProvider
```

### Acceptance Criteria

- [ ] ErrorBoundary component catches React errors
- [ ] Fallback UI displays on error
- [ ] Reset button allows recovery
- [ ] Dashboard wrapped with error boundary
- [ ] Global unhandled rejection handler logs errors
- [ ] Error helper functions work correctly

---

## Chunk 3: API Rate Limiting

**Priority**: Medium  
**Estimated Time**: 2 hours  
**Dependencies**: None (uses in-memory for now, Redis in Chunk 5)  
**Risk Addressed**: API abuse, cost overruns on OpenAI calls

### Description

Implement rate limiting on API routes to prevent abuse. Start with in-memory rate limiting (sufficient for single-server deployment), with Redis upgrade path for Chunk 5.

### Tasks

1. Create rate limiter utility
2. Create rate limit middleware
3. Apply to sensitive routes (context, chat, search)
4. Add rate limit headers to responses
5. Handle rate limit exceeded gracefully

### Implementation

#### 3.1 Rate Limiter Utility

Create `src/lib/rate-limit/index.ts`:

```typescript
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Prefix for rate limit keys
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

// In-memory store (will be replaced with Redis in Chunk 5)
const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (value.resetAt < now) {
      store.delete(key);
    }
  }
}, 60000);

export function checkRateLimit(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;

  let entry = store.get(fullKey);

  // Reset if window expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
  }

  entry.count++;
  store.set(fullKey, entry);

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count <= config.maxRequests;

  return {
    allowed,
    remaining,
    resetAt: new Date(entry.resetAt),
    retryAfterMs: allowed ? undefined : entry.resetAt - now,
  };
}

// Common rate limit configs
export const RATE_LIMITS = {
  // Standard API routes: 100 requests per minute
  api: {
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: "api",
  } as RateLimitConfig,

  // Search/embedding routes: 30 requests per minute (OpenAI cost)
  search: {
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: "search",
  } as RateLimitConfig,

  // Auth routes: 10 requests per minute (prevent brute force)
  auth: {
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: "auth",
  } as RateLimitConfig,

  // Create operations: 50 per minute
  create: {
    windowMs: 60 * 1000,
    maxRequests: 50,
    keyPrefix: "create",
  } as RateLimitConfig,
};
```

#### 3.2 Rate Limit Middleware Helper

Create `src/lib/rate-limit/middleware.ts`:

```typescript
import { NextRequest } from "next/server";
import {
  checkRateLimit,
  type RateLimitConfig,
  type RateLimitResult,
} from "./index";
import { auth } from "@/lib/auth";

export async function withRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<{ result: RateLimitResult; userId: string | null }> {
  // Get user ID for rate limiting (or IP for unauthenticated)
  const session = await auth();
  const userId = session?.user?.id;

  // Use user ID if authenticated, otherwise use IP
  const key =
    userId ||
    request.ip ||
    request.headers.get("x-forwarded-for") ||
    "anonymous";

  const result = checkRateLimit(key, config);

  return { result, userId };
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.resetAt.toISOString(),
    ...(result.retryAfterMs && {
      "Retry-After": Math.ceil(result.retryAfterMs / 1000).toString(),
    }),
  };
}

export function rateLimitExceededResponse(result: RateLimitResult): Response {
  return Response.json(
    {
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please try again later.",
        retryAfterMs: result.retryAfterMs,
      },
    },
    {
      status: 429,
      headers: rateLimitHeaders(result),
    }
  );
}
```

#### 3.3 Apply to Search Route (Example)

Update `src/app/api/context/search/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  withRateLimit,
  rateLimitExceededResponse,
  rateLimitHeaders,
  RATE_LIMITS,
} from "@/lib/rate-limit";
import { searchContext } from "@/services/context";

export async function GET(request: NextRequest) {
  // Rate limit check
  const { result: rateLimit, userId } = await withRateLimit(
    request,
    RATE_LIMITS.search
  );

  if (!rateLimit.allowed) {
    return rateLimitExceededResponse(rateLimit);
  }

  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ... existing search logic ...

  return Response.json(results, {
    headers: rateLimitHeaders(rateLimit),
  });
}
```

### Files to Create/Modify

```
src/lib/rate-limit/
├── index.ts              # NEW: Rate limiter core
└── middleware.ts         # NEW: Request middleware helpers

src/app/api/context/
├── search/route.ts       # UPDATE: Add rate limiting
├── people/route.ts       # UPDATE: Add rate limiting
├── places/route.ts       # UPDATE: Add rate limiting
├── events/route.ts       # UPDATE: Add rate limiting
├── tasks/route.ts        # UPDATE: Add rate limiting
└── deadlines/route.ts    # UPDATE: Add rate limiting

src/app/api/chat/
└── conversations/route.ts # UPDATE: Add rate limiting
```

### Acceptance Criteria

- [ ] Rate limiter tracks requests per key
- [ ] Window expiration works correctly
- [ ] Rate limit headers returned on all responses
- [ ] 429 response when limit exceeded
- [ ] Retry-After header included
- [ ] Search routes have stricter limits (OpenAI cost protection)

---

## Chunk 4: Input Validation Audit

**Priority**: Medium  
**Estimated Time**: 2 hours  
**Dependencies**: None  
**Risk Addressed**: Invalid data entering database, security vulnerabilities

### Description

Audit all API routes for proper input validation using Zod. Add validation where missing and standardize error responses.

### Tasks

1. Create shared validation schemas
2. Create validation middleware helper
3. Audit and fix all context routes
4. Audit and fix all chat routes
5. Standardize validation error responses

### Implementation

#### 4.1 Shared Validation Schemas

Create `src/lib/validation/schemas.ts`:

```typescript
import { z } from "zod";

// ─────────────────────────────────────────────────────────────
// Common Schemas
// ─────────────────────────────────────────────────────────────

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().min(1, "ID is required"),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1, "Search query is required").max(500),
  types: z.string().optional(), // comma-separated entity types
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

// ─────────────────────────────────────────────────────────────
// Entity Schemas
// ─────────────────────────────────────────────────────────────

export const sourceSchema = z.enum(["manual", "gmail", "slack", "calendar"]);

export const createPersonSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  type: z.string().max(50).default("contact"),
  importance: z.number().int().min(1).max(10).default(5),
  company: z.string().max(255).optional().nullable(),
  title: z.string().max(255).optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  timezone: z.string().max(50).optional().nullable(),
  bio: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  source: sourceSchema.default("manual"),
  sourceId: z.string().max(255).optional().nullable(),
  tags: z.array(z.string().max(50)).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const updatePersonSchema = createPersonSchema.partial();

export const createPlaceSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().max(50).default("location"),
  address: z.string().optional().nullable(),
  city: z.string().max(100).optional().nullable(),
  state: z.string().max(100).optional().nullable(),
  country: z.string().max(100).optional().nullable(),
  postalCode: z.string().max(20).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
  timezone: z.string().max(50).optional().nullable(),
  notes: z.string().optional().nullable(),
  importance: z.number().int().min(1).max(10).default(5),
  source: sourceSchema.default("manual"),
  sourceId: z.string().max(255).optional().nullable(),
  tags: z.array(z.string().max(50)).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const updatePlaceSchema = createPlaceSchema.partial();

export const createEventSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  type: z.string().max(50).default("meeting"),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().default(false),
  timezone: z.string().max(50).optional().nullable(),
  location: z.string().optional().nullable(),
  placeId: z.string().optional().nullable(),
  virtualUrl: z.string().url().optional().nullable(),
  status: z.enum(["tentative", "confirmed", "cancelled"]).default("confirmed"),
  visibility: z.enum(["private", "public"]).default("private"),
  notes: z.string().optional().nullable(),
  importance: z.number().int().min(1).max(10).default(5),
  source: sourceSchema.default("manual"),
  sourceId: z.string().max(255).optional().nullable(),
  tags: z.array(z.string().max(50)).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const updateEventSchema = createEventSchema.partial();

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  status: z
    .enum(["pending", "in_progress", "completed", "cancelled", "deferred"])
    .default("pending"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  dueDate: z.string().datetime().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  estimatedMinutes: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  source: sourceSchema.default("manual"),
  sourceId: z.string().max(255).optional().nullable(),
  tags: z.array(z.string().max(50)).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const updateTaskSchema = createTaskSchema.partial();

export const createDeadlineSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  type: z.enum(["deadline", "milestone", "reminder"]).default("deadline"),
  dueAt: z.string().datetime(),
  reminderAt: z.string().datetime().optional().nullable(),
  status: z
    .enum(["pending", "completed", "missed", "extended"])
    .default("pending"),
  importance: z.number().int().min(1).max(10).default(5),
  taskId: z.string().optional().nullable(),
  eventId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  consequences: z.string().optional().nullable(),
  source: sourceSchema.default("manual"),
  sourceId: z.string().max(255).optional().nullable(),
  tags: z.array(z.string().max(50)).default([]),
  metadata: z.record(z.unknown()).default({}),
});

export const updateDeadlineSchema = createDeadlineSchema.partial();

export const createRelationshipSchema = z.object({
  sourceType: z.enum(["person", "place", "event", "task", "deadline"]),
  sourceId: z.string().min(1),
  targetType: z.enum(["person", "place", "event", "task", "deadline"]),
  targetId: z.string().min(1),
  relationship: z.string().min(1).max(100),
  strength: z.number().int().min(1).max(10).default(5),
  bidirectional: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  metadata: z.record(z.unknown()).default({}),
});

export const updateRelationshipSchema = createRelationshipSchema
  .partial()
  .omit({
    sourceType: true,
    sourceId: true,
    targetType: true,
    targetId: true,
  });

// ─────────────────────────────────────────────────────────────
// Chat Schemas
// ─────────────────────────────────────────────────────────────

export const createConversationSchema = z.object({
  title: z.string().max(255).optional(),
});

export const updateConversationSchema = z.object({
  title: z.string().max(255).optional(),
  summary: z.string().optional(),
});

export const createMessageSchema = z.object({
  content: z.string().min(1, "Message content is required"),
  role: z.enum(["user", "assistant", "system", "tool"]).default("user"),
  toolCalls: z.array(z.unknown()).optional(),
  toolCallId: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
```

#### 4.2 Validation Helper

Create `src/lib/validation/index.ts`:

```typescript
import { z, ZodError } from "zod";

export * from "./schemas";

export interface ValidationResult<T> {
  success: true;
  data: T;
} | {
  success: false;
  error: Response;
}

export function validateBody<T extends z.ZodSchema>(
  body: unknown,
  schema: T
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(body);

  if (!result.success) {
    return {
      success: false,
      error: validationErrorResponse(result.error),
    };
  }

  return { success: true, data: result.data };
}

export function validateQuery<T extends z.ZodSchema>(
  searchParams: URLSearchParams,
  schema: T
): ValidationResult<z.infer<T>> {
  const params = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(params);

  if (!result.success) {
    return {
      success: false,
      error: validationErrorResponse(result.error),
    };
  }

  return { success: true, data: result.data };
}

export function validationErrorResponse(error: ZodError): Response {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));

  return Response.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        issues,
      },
    },
    { status: 400 }
  );
}
```

### Files to Create/Modify

```
src/lib/validation/
├── index.ts              # NEW: Validation utilities
└── schemas.ts            # NEW: Zod schemas

src/app/api/context/*/
├── route.ts              # UPDATE: Use validation
└── [id]/route.ts         # UPDATE: Use validation

src/app/api/chat/
├── conversations/route.ts          # UPDATE: Use validation
├── conversations/[id]/route.ts     # UPDATE: Use validation
└── conversations/[id]/messages/route.ts  # UPDATE: Use validation
```

### Acceptance Criteria

- [ ] All create/update routes use Zod validation
- [ ] Validation errors return 400 with detailed issues
- [ ] Query parameters validated for list/search routes
- [ ] Path parameters (IDs) validated
- [ ] Consistent error response format across all routes

---

## Chunk 5: Redis Integration

**Priority**: Medium  
**Estimated Time**: 1.5 hours  
**Dependencies**: None (Redis already in Docker Compose)  
**Risk Addressed**: Foundation for rate limiting, caching, job queues

### Description

Integrate Redis client for production-ready rate limiting, caching, and as foundation for BullMQ job queues in Chunk 6.

### Tasks

1. Install ioredis
2. Create Redis client singleton
3. Upgrade rate limiter to use Redis
4. Add cache utilities
5. Add health check for Redis

### Implementation

#### 5.1 Install Dependency

```bash
npm install ioredis
npm install -D @types/ioredis
```

#### 5.2 Redis Client Singleton

Create `src/lib/redis/index.ts`:

```typescript
import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var redis: Redis | undefined;
}

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

export const redis =
  globalThis.redis ??
  new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.redis = redis;
}

// Connect on first use
let connectionPromise: Promise<void> | null = null;

export async function ensureRedisConnection(): Promise<void> {
  if (redis.status === "ready") return;

  if (!connectionPromise) {
    connectionPromise = redis
      .connect()
      .then(() => {
        console.log("[Redis] Connected");
      })
      .catch((err) => {
        console.error("[Redis] Connection failed:", err);
        throw err;
      });
  }

  return connectionPromise;
}

export async function isRedisHealthy(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}
```

#### 5.3 Upgrade Rate Limiter

Update `src/lib/rate-limit/index.ts`:

```typescript
import { redis, ensureRedisConnection } from "@/lib/redis";

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  retryAfterMs?: number;
}

// Fallback in-memory store (used if Redis unavailable)
const memoryStore = new Map<string, { count: number; resetAt: number }>();

export async function checkRateLimit(
  key: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const now = Date.now();
  const fullKey = `ratelimit:${config.keyPrefix || "default"}:${key}`;
  const windowEnd = now + config.windowMs;

  try {
    await ensureRedisConnection();

    // Use Redis sliding window
    const multi = redis.multi();
    multi.incr(fullKey);
    multi.pttl(fullKey);

    const results = await multi.exec();

    if (!results) throw new Error("Redis transaction failed");

    const count = results[0][1] as number;
    let ttl = results[1][1] as number;

    // Set expiry on first request in window
    if (ttl === -1) {
      await redis.pexpire(fullKey, config.windowMs);
      ttl = config.windowMs;
    }

    const remaining = Math.max(0, config.maxRequests - count);
    const allowed = count <= config.maxRequests;
    const resetAt = new Date(now + ttl);

    return {
      allowed,
      remaining,
      resetAt,
      retryAfterMs: allowed ? undefined : ttl,
    };
  } catch (error) {
    console.warn(
      "[RateLimit] Redis unavailable, using memory fallback:",
      error
    );
    return checkRateLimitMemory(key, config);
  }
}

// Memory fallback (same as before)
function checkRateLimitMemory(
  key: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const fullKey = config.keyPrefix ? `${config.keyPrefix}:${key}` : key;

  let entry = memoryStore.get(fullKey);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + config.windowMs };
  }

  entry.count++;
  memoryStore.set(fullKey, entry);

  const remaining = Math.max(0, config.maxRequests - entry.count);
  const allowed = entry.count <= config.maxRequests;

  return {
    allowed,
    remaining,
    resetAt: new Date(entry.resetAt),
    retryAfterMs: allowed ? undefined : entry.resetAt - now,
  };
}

// Configs (unchanged)
export const RATE_LIMITS = {
  api: { windowMs: 60_000, maxRequests: 100, keyPrefix: "api" },
  search: { windowMs: 60_000, maxRequests: 30, keyPrefix: "search" },
  auth: { windowMs: 60_000, maxRequests: 10, keyPrefix: "auth" },
  create: { windowMs: 60_000, maxRequests: 50, keyPrefix: "create" },
} as const;
```

#### 5.4 Cache Utilities

Create `src/lib/redis/cache.ts`:

```typescript
import { redis, ensureRedisConnection } from "./index";

export interface CacheOptions {
  ttlSeconds?: number;
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    await ensureRedisConnection();
    const value = await redis.get(`cache:${key}`);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<boolean> {
  try {
    await ensureRedisConnection();
    const serialized = JSON.stringify(value);

    if (options.ttlSeconds) {
      await redis.setex(`cache:${key}`, options.ttlSeconds, serialized);
    } else {
      await redis.set(`cache:${key}`, serialized);
    }

    return true;
  } catch {
    return false;
  }
}

export async function cacheDelete(key: string): Promise<boolean> {
  try {
    await ensureRedisConnection();
    await redis.del(`cache:${key}`);
    return true;
  } catch {
    return false;
  }
}

export async function cacheDeletePattern(pattern: string): Promise<boolean> {
  try {
    await ensureRedisConnection();
    const keys = await redis.keys(`cache:${pattern}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return true;
  } catch {
    return false;
  }
}
```

#### 5.5 Update Health Check

Update `src/app/api/health/route.ts`:

```typescript
import { db } from "@/lib/db";
import { isRedisHealthy } from "@/lib/redis";

export async function GET() {
  const checks = {
    database: false,
    redis: false,
  };

  // Check database
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // Check Redis
  checks.redis = await isRedisHealthy();

  const healthy = checks.database && checks.redis;

  return Response.json(
    {
      status: healthy ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
```

### Files to Create/Modify

```
src/lib/redis/
├── index.ts              # NEW: Redis client singleton
└── cache.ts              # NEW: Cache utilities

src/lib/rate-limit/
└── index.ts              # UPDATE: Use Redis

src/app/api/health/
└── route.ts              # UPDATE: Check Redis health
```

### Acceptance Criteria

- [ ] Redis client connects successfully
- [ ] Rate limiting uses Redis when available
- [ ] Fallback to in-memory when Redis unavailable
- [ ] Cache utilities work correctly
- [ ] Health check includes Redis status

---

## Chunk 6: BullMQ Job Queue Setup

**Priority**: Medium  
**Estimated Time**: 2 hours  
**Dependencies**: Chunk 5 (Redis)  
**Risk Addressed**: Foundation for background jobs, required for Phase 3 sync workers

### Description

Set up BullMQ for background job processing. This is required for Phase 3 Gmail sync workers and will be used for embedding generation, email processing, and scheduled tasks.

### Tasks

1. Install BullMQ
2. Create queue manager
3. Create worker manager
4. Define job types
5. Create example embedding job
6. Add admin UI for monitoring (optional)

### Implementation

#### 6.1 Install Dependency

```bash
npm install bullmq
```

#### 6.2 Queue Manager

Create `src/lib/queue/index.ts`:

```typescript
import { Queue, Worker, Job } from "bullmq";
import { redis } from "@/lib/redis";

// Queue registry
const queues = new Map<string, Queue>();
const workers = new Map<string, Worker>();

export const QUEUE_NAMES = {
  EMBEDDINGS: "embeddings",
  EMAIL_SYNC: "email-sync",
  NOTIFICATIONS: "notifications",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export function getQueue(name: QueueName): Queue {
  if (!queues.has(name)) {
    queues.set(
      name,
      new Queue(name, {
        connection: redis,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      })
    );
  }
  return queues.get(name)!;
}

export async function addJob<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  options: { delay?: number; priority?: number } = {}
): Promise<Job<T>> {
  const queue = getQueue(queueName);
  return queue.add(jobName, data, options);
}

export async function getQueueStats(queueName: QueueName) {
  const queue = getQueue(queueName);
  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return { waiting, active, completed, failed };
}

// Graceful shutdown
export async function closeQueues(): Promise<void> {
  await Promise.all([
    ...Array.from(queues.values()).map((q) => q.close()),
    ...Array.from(workers.values()).map((w) => w.close()),
  ]);
}

// Register shutdown handler
if (typeof process !== "undefined") {
  process.on("SIGTERM", async () => {
    console.log("[Queue] Shutting down...");
    await closeQueues();
  });
}
```

#### 6.3 Worker Manager

Create `src/lib/queue/workers.ts`:

```typescript
import { Worker, Job } from "bullmq";
import { redis } from "@/lib/redis";
import { QUEUE_NAMES, type QueueName } from "./index";

type JobProcessor<T> = (job: Job<T>) => Promise<void>;

const workers = new Map<string, Worker>();

export function registerWorker<T>(
  queueName: QueueName,
  processor: JobProcessor<T>,
  options: { concurrency?: number } = {}
): Worker {
  if (workers.has(queueName)) {
    console.warn(`[Worker] Worker for ${queueName} already registered`);
    return workers.get(queueName)!;
  }

  const worker = new Worker(queueName, processor, {
    connection: redis,
    concurrency: options.concurrency ?? 5,
  });

  worker.on("completed", (job) => {
    console.log(`[Worker:${queueName}] Job ${job.id} completed`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[Worker:${queueName}] Job ${job?.id} failed:`, error);
  });

  worker.on("error", (error) => {
    console.error(`[Worker:${queueName}] Worker error:`, error);
  });

  workers.set(queueName, worker);
  return worker;
}

export function getWorker(queueName: QueueName): Worker | undefined {
  return workers.get(queueName);
}
```

#### 6.4 Job Types

Create `src/lib/queue/jobs.ts`:

```typescript
import { EntityType } from "@/services/context";

// ─────────────────────────────────────────────────────────────
// Embedding Jobs
// ─────────────────────────────────────────────────────────────

export interface EmbeddingJobData {
  userId: string;
  entityType: EntityType;
  entityId: string;
  operation: "create" | "update" | "delete";
}

export const JOB_NAMES = {
  GENERATE_EMBEDDING: "generate-embedding",
  DELETE_EMBEDDING: "delete-embedding",
  SYNC_GMAIL: "sync-gmail",
  SYNC_SLACK: "sync-slack",
  SEND_NOTIFICATION: "send-notification",
} as const;

// ─────────────────────────────────────────────────────────────
// Email Sync Jobs (for Phase 3)
// ─────────────────────────────────────────────────────────────

export interface EmailSyncJobData {
  userId: string;
  accountId: string;
  syncType: "full" | "incremental";
  cursor?: string;
}

// ─────────────────────────────────────────────────────────────
// Notification Jobs
// ─────────────────────────────────────────────────────────────

export interface NotificationJobData {
  userId: string;
  type: "deadline" | "reminder" | "sync-complete";
  data: Record<string, unknown>;
}
```

#### 6.5 Embedding Worker (Example)

Create `src/lib/queue/embedding-worker.ts`:

```typescript
import { Job } from "bullmq";
import { registerWorker } from "./workers";
import { QUEUE_NAMES } from "./index";
import { JOB_NAMES, type EmbeddingJobData } from "./jobs";
import {
  storeEntityEmbedding,
  deleteEntityEmbedding,
} from "@/services/context/embedding-integration";

export function initializeEmbeddingWorker() {
  return registerWorker<EmbeddingJobData>(
    QUEUE_NAMES.EMBEDDINGS,
    async (job: Job<EmbeddingJobData>) => {
      const { userId, entityType, entityId, operation } = job.data;

      console.log(
        `[EmbeddingWorker] Processing ${operation} for ${entityType}:${entityId}`
      );

      if (operation === "delete") {
        await deleteEntityEmbedding(userId, entityType, entityId);
      } else {
        // For create/update, we need to fetch the entity and generate embedding
        // This will be handled by the actual entity services
        await storeEntityEmbedding(userId, entityType, entityId);
      }
    },
    { concurrency: 3 }
  );
}
```

#### 6.6 Queue API Route (Admin)

Create `src/app/api/admin/queues/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { QUEUE_NAMES, getQueueStats } from "@/lib/queue";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Add admin role check

  const stats = await Promise.all(
    Object.values(QUEUE_NAMES).map(async (name) => ({
      name,
      ...(await getQueueStats(name)),
    }))
  );

  return Response.json({ queues: stats });
}
```

### Files to Create

```
src/lib/queue/
├── index.ts              # NEW: Queue manager
├── workers.ts            # NEW: Worker manager
├── jobs.ts               # NEW: Job type definitions
└── embedding-worker.ts   # NEW: Example worker

src/app/api/admin/
└── queues/
    └── route.ts          # NEW: Queue stats API
```

### Acceptance Criteria

- [ ] Queues can be created and accessed
- [ ] Jobs can be added to queues
- [ ] Workers process jobs
- [ ] Retry logic works (3 attempts with backoff)
- [ ] Queue stats available via API
- [ ] Graceful shutdown works

---

## Chunk 7: Real-time Updates (SSE)

**Priority**: High  
**Estimated Time**: 3 hours  
**Dependencies**: None  
**Risk Addressed**: Poor UX during AI processing, no streaming support

### Description

Implement Server-Sent Events (SSE) for real-time updates in the chat interface. This will enable streaming AI responses and status updates.

### Tasks

1. Create SSE utility functions
2. Create SSE endpoint for chat
3. Update chat page to use SSE
4. Add connection status indicator
5. Implement reconnection logic

### Implementation

#### 7.1 SSE Utilities

Create `src/lib/sse/index.ts`:

```typescript
export interface SSEMessage {
  event?: string;
  data: unknown;
  id?: string;
  retry?: number;
}

export function createSSEStream(): {
  stream: ReadableStream;
  send: (message: SSEMessage) => void;
  close: () => void;
} {
  let controller: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
    cancel() {
      // Client disconnected
    },
  });

  const encoder = new TextEncoder();

  function send(message: SSEMessage) {
    let text = "";

    if (message.event) {
      text += `event: ${message.event}\n`;
    }
    if (message.id) {
      text += `id: ${message.id}\n`;
    }
    if (message.retry !== undefined) {
      text += `retry: ${message.retry}\n`;
    }

    text += `data: ${JSON.stringify(message.data)}\n\n`;

    try {
      controller.enqueue(encoder.encode(text));
    } catch {
      // Stream closed
    }
  }

  function close() {
    try {
      controller.close();
    } catch {
      // Already closed
    }
  }

  return { stream, send, close };
}

export function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

#### 7.2 Chat SSE Endpoint

Create `src/app/api/chat/conversations/[id]/stream/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { createSSEStream, sseResponse } from "@/lib/sse";
import { getConversation } from "@/services/chat";

// Store active connections per user/conversation
const connections = new Map<string, Set<(message: unknown) => void>>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: conversationId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  // Verify conversation ownership
  const conversation = await getConversation(userId, conversationId);
  if (!conversation) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const { stream, send, close } = createSSEStream();

  // Send initial connection message
  send({ event: "connected", data: { conversationId } });

  // Register this connection
  const connectionKey = `${userId}:${conversationId}`;
  if (!connections.has(connectionKey)) {
    connections.set(connectionKey, new Set());
  }
  connections.get(connectionKey)!.add(send);

  // Handle disconnect
  request.signal.addEventListener("abort", () => {
    connections.get(connectionKey)?.delete(send);
    if (connections.get(connectionKey)?.size === 0) {
      connections.delete(connectionKey);
    }
    close();
  });

  // Keep-alive ping every 30 seconds
  const keepAlive = setInterval(() => {
    try {
      send({ event: "ping", data: { timestamp: Date.now() } });
    } catch {
      clearInterval(keepAlive);
    }
  }, 30000);

  request.signal.addEventListener("abort", () => clearInterval(keepAlive));

  return sseResponse(stream);
}

// Helper to broadcast to a conversation
export function broadcastToConversation(
  userId: string,
  conversationId: string,
  event: string,
  data: unknown
) {
  const connectionKey = `${userId}:${conversationId}`;
  const senders = connections.get(connectionKey);

  if (senders) {
    for (const send of senders) {
      try {
        send({ event, data });
      } catch {
        // Connection closed
      }
    }
  }
}
```

#### 7.3 Client-side SSE Hook

Create `src/hooks/use-event-source.ts`:

```typescript
"use client";

import * as React from "react";

interface EventSourceOptions {
  onMessage?: (event: MessageEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  eventHandlers?: Record<string, (data: unknown) => void>;
}

export function useEventSource(
  url: string | null,
  options: EventSourceOptions = {}
) {
  const [isConnected, setIsConnected] = React.useState(false);
  const [lastEvent, setLastEvent] = React.useState<MessageEvent | null>(null);
  const eventSourceRef = React.useRef<EventSource | null>(null);

  React.useEffect(() => {
    if (!url) {
      setIsConnected(false);
      return;
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsConnected(true);
      options.onOpen?.();
    };

    eventSource.onerror = (error) => {
      setIsConnected(false);
      options.onError?.(error);

      // Auto-reconnect after 5 seconds
      setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          eventSource.close();
        }
      }, 5000);
    };

    eventSource.onmessage = (event) => {
      setLastEvent(event);
      options.onMessage?.(event);
    };

    // Register custom event handlers
    if (options.eventHandlers) {
      for (const [eventName, handler] of Object.entries(
        options.eventHandlers
      )) {
        eventSource.addEventListener(eventName, (event) => {
          try {
            const data = JSON.parse((event as MessageEvent).data);
            handler(data);
          } catch {
            // Ignore parse errors
          }
        });
      }
    }

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [url]);

  const close = React.useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsConnected(false);
  }, []);

  return { isConnected, lastEvent, close };
}
```

#### 7.4 Connection Status Component

Create `src/components/shared/connection-status.tsx`:

```typescript
"use client";

import { cn } from "@/lib/utils";

interface ConnectionStatusProps {
  isConnected: boolean;
  className?: string;
}

export function ConnectionStatus({ isConnected, className }: ConnectionStatusProps) {
  return (
    <div className={cn("flex items-center gap-2 text-xs", className)}>
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          isConnected ? "bg-green-500" : "bg-red-500"
        )}
      />
      <span className="text-muted-foreground">
        {isConnected ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}
```

### Files to Create

```
src/lib/sse/
└── index.ts                        # NEW: SSE utilities

src/app/api/chat/conversations/[id]/
└── stream/route.ts                 # NEW: SSE endpoint

src/hooks/
└── use-event-source.ts             # NEW: SSE client hook

src/components/shared/
├── connection-status.tsx           # NEW: Connection indicator
└── index.ts                        # UPDATE: Add exports
```

### Acceptance Criteria

- [ ] SSE endpoint accepts connections
- [ ] Clients receive real-time events
- [ ] Keep-alive prevents timeout
- [ ] Reconnection works after disconnect
- [ ] Connection status displayed in UI
- [ ] Multiple clients can subscribe to same conversation

---

## Chunk 8: OAuth Token Refresh & Testing

**Priority**: High  
**Estimated Time**: 2 hours  
**Dependencies**: None  
**Risk Addressed**: Gmail integration will fail when tokens expire

### Description

Ensure OAuth token refresh works correctly and create test utilities to verify the flow before Phase 3 (Gmail Integration).

### Tasks

1. Audit current token storage
2. Implement token refresh logic
3. Create token refresh utility
4. Add token expiry check to auth callbacks
5. Create integration test script
6. Document OAuth setup requirements

### Implementation

#### 8.1 Token Refresh Utility

Create `src/lib/auth/token-refresh.ts`:

```typescript
import { db } from "@/lib/db";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

interface TokenRefreshResult {
  success: boolean;
  accessToken?: string;
  expiresAt?: number;
  error?: string;
}

export async function refreshGoogleToken(
  refreshToken: string
): Promise<TokenRefreshResult> {
  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        success: false,
        error: error.error_description || "Token refresh failed",
      };
    }

    const data = await response.json();

    return {
      success: true,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getValidAccessToken(
  userId: string
): Promise<string | null> {
  // Get the user's Google account
  const account = await db.account.findFirst({
    where: {
      userId,
      provider: "google",
    },
  });

  if (!account) {
    console.log("[TokenRefresh] No Google account found for user");
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = account.expires_at || 0;

  // If token is still valid (with 5 min buffer), return it
  if (expiresAt > now + 300 && account.access_token) {
    return account.access_token;
  }

  // Token expired or expiring soon - refresh it
  if (!account.refresh_token) {
    console.log("[TokenRefresh] No refresh token available");
    return null;
  }

  console.log("[TokenRefresh] Refreshing expired token");
  const result = await refreshGoogleToken(account.refresh_token);

  if (!result.success) {
    console.error("[TokenRefresh] Refresh failed:", result.error);
    return null;
  }

  // Update the account with new tokens
  await db.account.update({
    where: { id: account.id },
    data: {
      access_token: result.accessToken,
      expires_at: result.expiresAt,
    },
  });

  return result.accessToken || null;
}

export async function checkTokenHealth(userId: string): Promise<{
  hasAccount: boolean;
  hasRefreshToken: boolean;
  isExpired: boolean;
  expiresIn?: number;
}> {
  const account = await db.account.findFirst({
    where: { userId, provider: "google" },
    select: {
      refresh_token: true,
      expires_at: true,
    },
  });

  if (!account) {
    return { hasAccount: false, hasRefreshToken: false, isExpired: true };
  }

  const now = Math.floor(Date.now() / 1000);
  const expiresAt = account.expires_at || 0;
  const isExpired = expiresAt < now;
  const expiresIn = isExpired ? 0 : expiresAt - now;

  return {
    hasAccount: true,
    hasRefreshToken: !!account.refresh_token,
    isExpired,
    expiresIn,
  };
}
```

#### 8.2 Token Status API

Create `src/app/api/auth/token-status/route.ts`:

```typescript
import { auth } from "@/lib/auth";
import {
  checkTokenHealth,
  getValidAccessToken,
} from "@/lib/auth/token-refresh";

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const health = await checkTokenHealth(session.user.id);

  return Response.json({
    ...health,
    expiresInHuman: health.expiresIn
      ? `${Math.floor(health.expiresIn / 60)} minutes`
      : null,
  });
}

export async function POST() {
  const session = await auth();

  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = await getValidAccessToken(session.user.id);

  if (!accessToken) {
    return Response.json({ error: "Failed to refresh token" }, { status: 500 });
  }

  return Response.json({ success: true });
}
```

#### 8.3 Test Script

Create `scripts/test-token-refresh.ts`:

```typescript
import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "@/lib/db";
import {
  checkTokenHealth,
  getValidAccessToken,
} from "@/lib/auth/token-refresh";

async function testTokenRefresh() {
  console.log("=== OAuth Token Refresh Test ===\n");

  // Get first user with a Google account
  const account = await db.account.findFirst({
    where: { provider: "google" },
    include: { user: true },
  });

  if (!account) {
    console.log("❌ No Google accounts found in database");
    console.log("   Please sign in with Google first.\n");
    return;
  }

  console.log(`Testing with user: ${account.user.email}\n`);

  // Check token health
  console.log("1. Checking token health...");
  const health = await checkTokenHealth(account.userId);
  console.log(`   - Has account: ${health.hasAccount}`);
  console.log(`   - Has refresh token: ${health.hasRefreshToken}`);
  console.log(`   - Is expired: ${health.isExpired}`);
  if (health.expiresIn) {
    console.log(
      `   - Expires in: ${Math.floor(health.expiresIn / 60)} minutes`
    );
  }
  console.log();

  if (!health.hasRefreshToken) {
    console.log("❌ No refresh token available");
    console.log("   Make sure access_type=offline is set in OAuth config.\n");
    return;
  }

  // Try to get valid token (will refresh if needed)
  console.log("2. Getting valid access token...");
  const accessToken = await getValidAccessToken(account.userId);

  if (accessToken) {
    console.log(
      `   ✅ Got valid access token (first 20 chars): ${accessToken.substring(0, 20)}...`
    );
  } else {
    console.log("   ❌ Failed to get access token");
  }

  console.log("\n=== Test Complete ===\n");
}

testTokenRefresh()
  .catch(console.error)
  .finally(() => process.exit(0));
```

#### 8.4 Documentation Update

Update `docs/PHASE_3_PREREQS.md` (new file):

````markdown
# Phase 3 Prerequisites

Before starting Phase 3 (Gmail Integration), ensure the following:

## 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. Enable the Gmail API:
   - APIs & Services → Enable APIs → Search "Gmail" → Enable
4. Configure OAuth consent screen:
   - User Type: External (for testing) or Internal (workspace)
   - Add scopes: `gmail.readonly`, `gmail.send`, `gmail.labels`
5. Create OAuth credentials:
   - APIs & Services → Credentials → Create Credentials → OAuth Client ID
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
6. Copy Client ID and Client Secret to `.env.local`

## 2. Environment Variables

Ensure these are set in `.env.local`:

```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
```
````

## 3. Test Token Refresh

Run the test script:

```bash
npm run db:token-test
```

Expected output:

- ✅ Has refresh token: true
- ✅ Got valid access token

## 4. Gmail Scopes

Phase 3 will add these scopes to the OAuth config:

- `https://www.googleapis.com/auth/gmail.readonly`
- `https://www.googleapis.com/auth/gmail.send`
- `https://www.googleapis.com/auth/gmail.labels`

Users will need to re-authenticate after scope changes.

```

### Files to Create/Modify

```

src/lib/auth/
├── index.ts # EXISTING: Main auth config
└── token-refresh.ts # NEW: Token refresh utilities

src/app/api/auth/
└── token-status/
└── route.ts # NEW: Token health API

scripts/
└── test-token-refresh.ts # NEW: Test script

docs/
└── PHASE_3_PREREQS.md # NEW: Phase 3 prerequisites

package.json # UPDATE: Add db:token-test script

```

### Acceptance Criteria

- [ ] Token refresh utility works
- [ ] Expired tokens are automatically refreshed
- [ ] Token health check API returns accurate status
- [ ] Test script runs successfully
- [ ] Prerequisites documented for Phase 3

---

## Implementation Order

The recommended order for maximum efficiency:

```

Day 1 (4-5 hours):
├── Chunk 1: Git Hooks (30min)
├── Chunk 2: Error Boundaries (2hr)
└── Chunk 4: Input Validation (2hr)

Day 2 (4-5 hours):
├── Chunk 3: Rate Limiting (2hr)
├── Chunk 5: Redis Integration (1.5hr)
└── Chunk 8: OAuth Token Refresh (2hr)

Day 3 (5 hours):
├── Chunk 6: BullMQ Setup (2hr)
└── Chunk 7: Real-time Updates (3hr)

````

---

## Post-Remediation Verification

Run these checks after all chunks are complete:

```bash
# All tests pass
npm test

# No TypeScript errors
npm run type-check

# No ESLint errors
npm run lint

# Build succeeds
npm run build

# Health check works
curl http://localhost:3000/api/health

# Token refresh works
npm run db:token-test
````

---

## Success Criteria

Phase 0-2 Correction is complete when:

- [ ] Husky + lint-staged configured and working
- [ ] Error boundaries wrap all dashboard routes
- [ ] Rate limiting active on all API routes
- [ ] All routes use Zod validation
- [ ] Redis connected and used for rate limiting
- [ ] BullMQ queues ready for Phase 3 workers
- [ ] SSE streaming works for chat
- [ ] OAuth token refresh tested and working
- [ ] All tests pass
- [ ] Zero TypeScript errors
- [ ] Zero ESLint errors
- [ ] Build succeeds

---

## Notes for Agents

- Each chunk is self-contained with clear files to create/modify
- Run tests after each chunk to ensure nothing breaks
- Chunks 1-4 can be done in any order (no dependencies)
- Chunk 6 requires Chunk 5 (Redis)
- All other chunks are independent
- If time is limited, prioritize: Chunk 2 → Chunk 8 → Chunk 5 → Chunk 6 (core Phase 3 blockers)
