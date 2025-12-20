# Caching Documentation

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [QUEUE_WORKERS.md](./QUEUE_WORKERS.md), [RATE_LIMITING.md](./RATE_LIMITING.md)

---

## Overview

Theo uses **Redis** for caching, rate limiting, and job queues. The system is designed with graceful fallbacks when Redis is unavailable.

---

## Technology Stack

| Component     | Technology     | Purpose            |
| ------------- | -------------- | ------------------ |
| Client        | ioredis        | Redis connection   |
| Caching       | Redis SET/GET  | Data caching       |
| Rate Limiting | Redis INCR     | Request throttling |
| Job Queue     | BullMQ + Redis | Background jobs    |

---

## Quick Start

### Environment Configuration

```env
# .env.local
REDIS_URL="redis://localhost:6379"
```

### Basic Usage

```typescript
import { cacheGet, cacheSet, cacheGetOrSet } from "@/lib/redis/cache";

// Get cached value
const cached = await cacheGet<User>("user:123");

// Set with TTL
await cacheSet("user:123", user, { ttlSeconds: 3600 });

// Get or compute
const user = await cacheGetOrSet(
  "user:123",
  async () => await fetchUserFromDb("123"),
  { ttlSeconds: 3600 }
);
```

---

## Redis Client

### Singleton Pattern

```typescript
import { redis } from "@/lib/redis";

// Direct Redis commands
await redis.set("key", "value");
const value = await redis.get("key");
```

### Connection Management

```typescript
import {
  ensureRedisConnection,
  isRedisConnected,
  isRedisHealthy,
  closeRedisConnection,
} from "@/lib/redis";

// Check connection status
if (isRedisConnected()) {
  // Redis is ready
}

// Ensure connected before operations
await ensureRedisConnection();

// Health check (with ping)
const healthy = await isRedisHealthy();

// Graceful shutdown
await closeRedisConnection();
```

### Configuration

```typescript
const client = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
  retryStrategy(times) {
    return Math.min(times * 100, 30000); // Exponential backoff, max 30s
  },
  reconnectOnError(err) {
    return ["READONLY", "ECONNRESET", "ETIMEDOUT"].some((e) =>
      err.message.includes(e)
    );
  },
});
```

---

## Cache Operations

### Get

```typescript
const value = await cacheGet<MyType>("my-key");
// Returns null if not found or Redis unavailable
```

### Set

```typescript
const success = await cacheSet("my-key", value, {
  ttlSeconds: 3600, // Optional TTL
});
// Returns false if Redis unavailable
```

### Delete

```typescript
await cacheDelete("my-key");
```

### Delete by Pattern

```typescript
await cacheDeletePattern("user:123:*");
```

### Get or Set

```typescript
const value = await cacheGetOrSet(
  "expensive-query",
  async () => {
    // Only called if cache miss
    return await expensiveComputation();
  },
  { ttlSeconds: 300 }
);
```

---

## Cache Key Patterns

### Recommended Key Format

```
{namespace}:{entity-type}:{entity-id}:{optional-suffix}
```

### Examples

| Pattern | Example               | Purpose          |
| ------- | --------------------- | ---------------- |
| Entity  | `user:123`            | Single entity    |
| List    | `user:123:tasks`      | Related list     |
| Derived | `user:123:task-count` | Computed value   |
| Scoped  | `cache:search:abc123` | Namespaced cache |

---

## Entity Cache Helpers

### Invalidate Entity

```typescript
import { invalidateEntityCache } from "@/lib/redis/cache";

await invalidateEntityCache("person", personId);
// Deletes: person:123*
```

### Invalidate User Data

```typescript
import { invalidateUserCache } from "@/lib/redis/cache";

await invalidateUserCache(userId);
// Deletes: user:456:*
```

---

## Graceful Degradation

All cache operations gracefully handle Redis unavailability:

```typescript
export async function cacheGet<T>(key: string): Promise<T | null> {
  if (!isRedisConnected()) {
    return null; // Graceful fallback
  }

  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("[Cache] Get error:", error);
    return null; // Silent failure
  }
}
```

---

## Cache Strategies

### Cache-Aside

```typescript
async function getUser(id: string) {
  // 1. Check cache
  const cached = await cacheGet<User>(`user:${id}`);
  if (cached) return cached;

  // 2. Load from database
  const user = await db.user.findUnique({ where: { id } });

  // 3. Update cache
  if (user) {
    await cacheSet(`user:${id}`, user, { ttlSeconds: 3600 });
  }

  return user;
}
```

### Write-Through

```typescript
async function updateUser(id: string, data: UpdateUserInput) {
  // 1. Update database
  const user = await db.user.update({
    where: { id },
    data,
  });

  // 2. Update cache
  await cacheSet(`user:${id}`, user, { ttlSeconds: 3600 });

  return user;
}
```

### Invalidation

```typescript
async function deleteUser(id: string) {
  // 1. Delete from database
  await db.user.delete({ where: { id } });

  // 2. Invalidate cache
  await cacheDelete(`user:${id}`);
  await invalidateUserCache(id);
}
```

---

## Development vs Production

### Development

- Redis via Docker Compose
- Console logging for connections
- Preserved across hot reloads

```typescript
if (process.env.NODE_ENV !== "production") {
  globalThis.redis = redis;
}
```

### Production

- Redis via managed service (ElastiCache, etc.)
- Automatic reconnection
- Health checks for load balancers

---

## Health Endpoint

The `/api/health` endpoint checks Redis:

```typescript
const health = {
  status: "healthy",
  checks: {
    database: true,
    redis: await isRedisHealthy(),
  },
};
```

**Status Values:**

- `healthy`: All systems up
- `degraded`: Database up, Redis down
- `unhealthy`: Database down

---

## Best Practices

### 1. Always Set TTL

```typescript
// ✅ Good - explicit TTL
await cacheSet("key", value, { ttlSeconds: 3600 });

// ❌ Bad - no TTL (persists forever)
await cacheSet("key", value);
```

### 2. Use Namespaced Keys

```typescript
// ✅ Good - namespaced
const key = `user:${userId}:settings`;

// ❌ Bad - collision risk
const key = userId;
```

### 3. Handle Cache Miss Gracefully

```typescript
const cached = await cacheGet("key");
if (!cached) {
  // Fetch from database, don't fail
}
```

### 4. Invalidate on Mutations

```typescript
await db.person.update(...);
await invalidateEntityCache("person", personId);
```

---

## Docker Configuration

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 10s
    timeout: 5s
    retries: 5
```

---

## Related Documentation

- [RATE_LIMITING.md](./RATE_LIMITING.md) - Redis-backed rate limiting
- [QUEUE_WORKERS.md](./QUEUE_WORKERS.md) - Redis-backed job queues
- [INFRASTRUCTURE.md](./INFRASTRUCTURE.md) - Redis deployment
