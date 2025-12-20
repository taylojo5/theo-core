// ═══════════════════════════════════════════════════════════════════════════
// Redis Client
// Singleton Redis client for caching, rate limiting, and job queues
// ═══════════════════════════════════════════════════════════════════════════

import Redis from "ioredis";

// Prevent multiple instances in development
declare global {
  var redis: Redis | undefined;
}

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

/**
 * Create Redis client with optimized settings
 */
function createRedisClient(): Redis {
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy(times) {
      // Exponential backoff with max 30 seconds
      const delay = Math.min(times * 100, 30000);
      console.log(`[Redis] Retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
      return targetErrors.some((e) => err.message.includes(e));
    },
  });

  client.on("connect", () => {
    console.log("[Redis] Connected");
  });

  client.on("error", (err) => {
    console.error("[Redis] Error:", err.message);
  });

  client.on("close", () => {
    console.log("[Redis] Connection closed");
  });

  return client;
}

// Export singleton instance
export const redis = globalThis.redis ?? createRedisClient();

// Preserve instance across hot reloads in development
if (process.env.NODE_ENV !== "production") {
  globalThis.redis = redis;
}

// ─────────────────────────────────────────────────────────────
// Connection Management
// ─────────────────────────────────────────────────────────────

let connectionPromise: Promise<void> | null = null;

/**
 * Ensure Redis is connected before performing operations
 */
export async function ensureRedisConnection(): Promise<void> {
  if (redis.status === "ready") return;

  if (!connectionPromise) {
    connectionPromise = redis
      .connect()
      .then(() => {
        console.log("[Redis] Connection established");
      })
      .catch((err) => {
        console.error("[Redis] Connection failed:", err.message);
        connectionPromise = null;
        throw err;
      });
  }

  return connectionPromise;
}

/**
 * Check if Redis is healthy and responding
 */
export async function isRedisHealthy(): Promise<boolean> {
  try {
    if (redis.status !== "ready") {
      await ensureRedisConnection();
    }
    const result = await redis.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

/**
 * Gracefully close Redis connection
 */
export async function closeRedisConnection(): Promise<void> {
  try {
    await redis.quit();
    console.log("[Redis] Connection closed gracefully");
  } catch (err) {
    console.error("[Redis] Error closing connection:", err);
  }
}

/**
 * Check if Redis is available (non-blocking)
 */
export function isRedisConnected(): boolean {
  return redis.status === "ready";
}
