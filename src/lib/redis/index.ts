// ═══════════════════════════════════════════════════════════════════════════
// Redis Client
// Singleton Redis client for caching, rate limiting, and job queues
// ═══════════════════════════════════════════════════════════════════════════

import Redis from "ioredis";

// Prevent multiple instances in development
declare global {
  var redis: Redis | undefined;
  var bullmqRedis: Redis | undefined;
}

const redisCacheUrl = process.env.REDIS_CACHE_URL || process.env.REDIS_URL || "redis://localhost:6381";
const redisBullmqUrl = process.env.REDIS_BULLMQ_URL || "redis://localhost:6380";

/**
 * Create Redis client with optimized settings (for caching, rate limiting, sessions)
 */
function createRedisClient(): Redis {
  const client = new Redis(redisCacheUrl, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
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

/**
 * Create Redis client for BullMQ (job queues)
 * BullMQ requires maxRetriesPerRequest: null because it handles retries internally
 */
function createBullMQRedisClient(): Redis {
  const client = new Redis(redisBullmqUrl, {
    maxRetriesPerRequest: null, // Required by BullMQ
    lazyConnect: true,
    retryStrategy(times) {
      const delay = Math.min(times * 100, 30000);
      console.log(`[Redis:BullMQ] Retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ["READONLY", "ECONNRESET", "ETIMEDOUT"];
      return targetErrors.some((e) => err.message.includes(e));
    },
  });

  client.on("connect", () => {
    console.log("[Redis:BullMQ] Connected");
  });

  client.on("error", (err) => {
    console.error("[Redis:BullMQ] Error:", err.message);
  });

  return client;
}

// Export singleton instances
export const redis = createRedisClient();

/** Redis client configured for BullMQ (maxRetriesPerRequest: null) */
export const bullmqRedis = createBullMQRedisClient();

// Preserve instances across hot reloads in development
if (process.env.NODE_ENV !== "production") {
  globalThis.redis = redis;
  globalThis.bullmqRedis = bullmqRedis;
}

// ─────────────────────────────────────────────────────────────
// Connection Management
// ─────────────────────────────────────────────────────────────

let connectionPromise: Promise<void> | null = null;

/**
 * Ensure Redis is connected before performing operations
 * Waits for the 'ready' state, not just 'connect'
 */
export async function ensureRedisConnection(): Promise<void> {
  if (redis.status === "ready") return;

  if (!connectionPromise) {
    connectionPromise = new Promise<void>((resolve, reject) => {
      // If already connecting, wait for ready event
      if (redis.status === "connect" || redis.status === "connecting") {
        const onReady = () => {
          redis.off("error", onError);
          resolve();
        };
        const onError = (err: Error) => {
          redis.off("ready", onReady);
          connectionPromise = null;
          reject(err);
        };
        redis.once("ready", onReady);
        redis.once("error", onError);
      } else if (redis.status === "wait") {
        // Not connected yet, initiate connection
        redis
          .connect()
          .then(() => resolve())
          .catch((err) => {
            connectionPromise = null;
            reject(err);
          });
      } else {
        // Already ready or reconnecting
        resolve();
      }
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
  console.log("[Redis] Connection status:", redis.status);
  console.log("[Redis] Connection ready:", redis.status === "ready");
  return redis.status === "ready";
}
