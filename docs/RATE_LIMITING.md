# Rate Limiting Documentation

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [CACHING.md](./CACHING.md), [API_REFERENCE.md](./API_REFERENCE.md)

---

## Overview

Theo implements rate limiting to prevent abuse and control costs. The system uses **Redis** for distributed rate limiting with an **in-memory fallback** when Redis is unavailable.

---

## Quick Start

```typescript
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit/middleware";

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const { response, userId, headers } = await applyRateLimit(
    request,
    RATE_LIMITS.api
  );

  // Return early if rate limited
  if (response) {
    return response;
  }

  // Continue with request handling...
  return NextResponse.json(result, { headers });
}
```

---

## Pre-defined Rate Limits

| Config   | Requests | Window   | Use Case                     |
| -------- | -------- | -------- | ---------------------------- |
| `api`    | 100      | 1 minute | Standard API routes          |
| `search` | 30       | 1 minute | Search/embedding (API costs) |
| `auth`   | 10       | 1 minute | Auth routes (brute force)    |
| `create` | 50       | 1 minute | Create operations            |
| `chat`   | 20       | 1 minute | Chat/LLM (API costs)         |

```typescript
import { RATE_LIMITS } from "@/lib/rate-limit";

// Use pre-defined limits
RATE_LIMITS.api; // { windowMs: 60000, maxRequests: 100, keyPrefix: "api" }
RATE_LIMITS.search; // { windowMs: 60000, maxRequests: 30, keyPrefix: "search" }
RATE_LIMITS.auth; // { windowMs: 60000, maxRequests: 10, keyPrefix: "auth" }
RATE_LIMITS.create; // { windowMs: 60000, maxRequests: 50, keyPrefix: "create" }
RATE_LIMITS.chat; // { windowMs: 60000, maxRequests: 20, keyPrefix: "chat" }
```

---

## Configuration

### Rate Limit Config

```typescript
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Prefix for rate limit keys
}
```

### Custom Rate Limit

```typescript
const customLimit: RateLimitConfig = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 requests
  keyPrefix: "my-limit",
};

const result = await checkRateLimitAsync("user-123", customLimit);
```

---

## Rate Limit Result

```typescript
interface RateLimitResult {
  allowed: boolean; // Whether request is allowed
  remaining: number; // Requests remaining in window
  resetAt: Date; // When the window resets
  retryAfterMs?: number; // Ms until retry (if blocked)
}
```

---

## API Reference

### Apply Rate Limit (Middleware Helper)

```typescript
const { response, userId, headers } = await applyRateLimit(
  request,
  RATE_LIMITS.api
);

if (response) {
  // Rate limited - return the 429 response
  return response;
}

// Proceed with handler, include rate limit headers
return NextResponse.json(data, { headers });
```

### Check Rate Limit (Async with Redis)

```typescript
import { checkRateLimitAsync } from "@/lib/rate-limit";

const result = await checkRateLimitAsync("user-123", {
  windowMs: 60000,
  maxRequests: 100,
  keyPrefix: "api",
});

if (!result.allowed) {
  // Handle rate limit exceeded
}
```

### Check Rate Limit (Sync with Memory)

```typescript
import { checkRateLimit } from "@/lib/rate-limit";

// Memory-only, synchronous
const result = checkRateLimit("user-123", config);
```

### Reset Rate Limit (Testing)

```typescript
import { resetRateLimit, clearAllRateLimits } from "@/lib/rate-limit";

// Reset specific key
await resetRateLimit("user-123", "api");

// Clear all (testing only)
clearAllRateLimits();
```

---

## Response Headers

Rate limited responses include:

| Header                  | Description                      |
| ----------------------- | -------------------------------- |
| `X-RateLimit-Remaining` | Requests remaining in window     |
| `X-RateLimit-Reset`     | ISO timestamp when window resets |
| `Retry-After`           | Seconds until retry allowed      |

### Example Response

```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-12-20T10:01:00.000Z
Retry-After: 45
Content-Type: application/json

{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "retryAfterMs": 45000,
    "resetAt": "2024-12-20T10:01:00.000Z"
  }
}
```

---

## Key Generation

Rate limit keys are generated as:

```
ratelimit:{prefix}:{identifier}
```

**Identifier Priority:**

1. User ID (if authenticated)
2. `X-Forwarded-For` header (first IP)
3. `X-Real-IP` header
4. `"anonymous"` (fallback)

---

## Redis Implementation

Uses Redis INCR with PTTL for atomic counting:

```typescript
// Atomic increment and TTL check
const multi = redis.multi();
multi.incr(key);
multi.pttl(key);
const results = await multi.exec();

const count = results[0][1];
let ttl = results[1][1];

// Set expiry on first request in window
if (ttl === -1) {
  await redis.pexpire(key, windowMs);
  ttl = windowMs;
}
```

---

## Memory Fallback

When Redis is unavailable:

```typescript
const memoryStore = new Map<string, { count: number; resetAt: number }>();

// Automatic cleanup every 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of memoryStore.entries()) {
    if (value.resetAt < now) {
      memoryStore.delete(key);
    }
  }
}, 60000);
```

**Note:** Memory fallback is per-instance, not distributed. In multi-instance deployments, each instance tracks separately.

---

## Usage Patterns

### Protect API Route

```typescript
export async function POST(request: NextRequest) {
  const { response, userId } = await applyRateLimit(request, RATE_LIMITS.api);
  if (response) return response;

  // Handle request...
}
```

### Protect Expensive Operations

```typescript
export async function POST(request: NextRequest) {
  // Stricter limit for AI/LLM calls
  const { response } = await applyRateLimit(request, RATE_LIMITS.chat);
  if (response) return response;

  const completion = await openai.chat.completions.create(...);
  // ...
}
```

### Custom Limits per Route

```typescript
const uploadLimit: RateLimitConfig = {
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 uploads per hour
  keyPrefix: "upload",
};

export async function POST(request: NextRequest) {
  const { response } = await applyRateLimit(request, uploadLimit);
  if (response) return response;

  // Handle upload...
}
```

---

## Best Practices

### 1. Apply Early in Handler

```typescript
export async function POST(request: NextRequest) {
  // ✅ Rate limit first
  const { response } = await applyRateLimit(request, RATE_LIMITS.api);
  if (response) return response;

  // Then auth, validation, etc.
  const session = await auth();
  // ...
}
```

### 2. Use Appropriate Limits

```typescript
// ✅ Match limit to cost
RATE_LIMITS.chat; // 20/min for expensive LLM calls
RATE_LIMITS.api; // 100/min for regular API calls
```

### 3. Include Headers in Response

```typescript
const { headers } = await applyRateLimit(request, config);

// ✅ Include headers even on success
return NextResponse.json(data, { headers });
```

### 4. Handle Gracefully on Client

```typescript
async function fetchData() {
  const response = await fetch("/api/data");

  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    await sleep(parseInt(retryAfter) * 1000);
    return fetchData(); // Retry
  }

  return response.json();
}
```

---

## Testing

### Mock Rate Limiting

```typescript
import { vi } from "vitest";
import * as rateLimit from "@/lib/rate-limit";

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimitAsync: vi.fn().mockResolvedValue({
    allowed: true,
    remaining: 99,
    resetAt: new Date(),
  }),
}));
```

### Test Rate Limit Enforcement

```typescript
describe("Rate Limiting", () => {
  beforeEach(() => {
    clearAllRateLimits();
  });

  it("should block after limit exceeded", async () => {
    const config = { windowMs: 60000, maxRequests: 2 };

    await checkRateLimitAsync("user", config); // 1
    await checkRateLimitAsync("user", config); // 2
    const result = await checkRateLimitAsync("user", config); // 3

    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeDefined();
  });
});
```

---

## Related Documentation

- [CACHING.md](./CACHING.md) - Redis client
- [API_REFERENCE.md](./API_REFERENCE.md) - API endpoint limits
- [AUTH_SECURITY.md](./AUTH_SECURITY.md) - Auth-based identification
