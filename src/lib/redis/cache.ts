// ═══════════════════════════════════════════════════════════════════════════
// Redis Cache Utilities
// Simple cache operations with JSON serialization
// ═══════════════════════════════════════════════════════════════════════════

import { redis, ensureRedisConnection } from "./index";

export interface CacheOptions {
  /** Time-to-live in seconds */
  ttlSeconds?: number;
}

const CACHE_PREFIX = "cache:";

/**
 * Get a cached value
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    await ensureRedisConnection();
    const value = await redis.get(`${CACHE_PREFIX}${key}`);
    return value ? (JSON.parse(value) as T) : null;
  } catch (error) {
    console.error("[Cache] Get error:", error);
    return null;
  }
}

/**
 * Set a cached value
 */
export async function cacheSet<T>(
  key: string,
  value: T,
  options: CacheOptions = {}
): Promise<boolean> {
  try {
    await ensureRedisConnection();
    const serialized = JSON.stringify(value);
    const fullKey = `${CACHE_PREFIX}${key}`;

    if (options.ttlSeconds) {
      await redis.setex(fullKey, options.ttlSeconds, serialized);
    } else {
      await redis.set(fullKey, serialized);
    }

    return true;
  } catch (error) {
    console.error("[Cache] Set error:", error);
    return false;
  }
}

/**
 * Delete a cached value
 */
export async function cacheDelete(key: string): Promise<boolean> {
  try {
    await ensureRedisConnection();
    await redis.del(`${CACHE_PREFIX}${key}`);
    return true;
  } catch (error) {
    console.error("[Cache] Delete error:", error);
    return false;
  }
}

/**
 * Delete all cached values matching a pattern
 */
export async function cacheDeletePattern(pattern: string): Promise<boolean> {
  try {
    await ensureRedisConnection();
    const keys = await redis.keys(`${CACHE_PREFIX}${pattern}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return true;
  } catch (error) {
    console.error("[Cache] Delete pattern error:", error);
    return false;
  }
}

/**
 * Get or set a cached value with a factory function
 */
export async function cacheGetOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Try to get from cache first
  const cached = await cacheGet<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Generate the value
  const value = await factory();

  // Cache it (fire and forget)
  cacheSet(key, value, options).catch(() => {
    // Ignore cache set errors
  });

  return value;
}

/**
 * Invalidate cache for a specific entity type and ID
 */
export async function invalidateEntityCache(
  entityType: string,
  entityId: string
): Promise<void> {
  await cacheDeletePattern(`${entityType}:${entityId}*`);
}

/**
 * Invalidate all cache for a user
 */
export async function invalidateUserCache(userId: string): Promise<void> {
  await cacheDeletePattern(`user:${userId}:*`);
}
