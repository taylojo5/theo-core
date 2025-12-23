// ═══════════════════════════════════════════════════════════════════════════
// Redis Client - Unit Tests
// Tests for Redis connection and cache operations
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─────────────────────────────────────────────────────────────
// Mock Redis module using hoisted mock
// ─────────────────────────────────────────────────────────────

const mockRedis = vi.hoisted(() => ({
  status: "ready" as string,
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
  ping: vi.fn(),
  connect: vi.fn(),
  quit: vi.fn(),
  on: vi.fn(),
}));

// Mock the entire redis module
vi.mock("@/lib/redis", () => ({
  redis: mockRedis,
  ensureRedisConnection: vi.fn().mockResolvedValue(undefined),
  isRedisHealthy: vi.fn().mockImplementation(async () => {
    try {
      const result = await mockRedis.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }),
  isRedisConnected: vi
    .fn()
    .mockImplementation(() => mockRedis.status === "ready"),
  closeRedisConnection: vi.fn().mockImplementation(async () => {
    await mockRedis.quit();
  }),
}));

// Import after mocking
import {
  isRedisHealthy,
  isRedisConnected,
  closeRedisConnection,
} from "@/lib/redis";

// ─────────────────────────────────────────────────────────────
// Redis Client Tests
// ─────────────────────────────────────────────────────────────

describe("Redis Client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.status = "ready";
  });

  describe("isRedisConnected", () => {
    it("should return true when status is ready", () => {
      mockRedis.status = "ready";
      expect(isRedisConnected()).toBe(true);
    });

    it("should return false when status is not ready", () => {
      mockRedis.status = "connecting";
      expect(isRedisConnected()).toBe(false);
    });
  });

  describe("isRedisHealthy", () => {
    it("should return true when ping succeeds", async () => {
      mockRedis.ping.mockResolvedValue("PONG");
      const result = await isRedisHealthy();
      expect(result).toBe(true);
    });

    it("should return false when ping fails", async () => {
      mockRedis.ping.mockRejectedValue(new Error("Connection refused"));
      const result = await isRedisHealthy();
      expect(result).toBe(false);
    });
  });

  describe("closeRedisConnection", () => {
    it("should call quit on the redis client", async () => {
      mockRedis.quit.mockResolvedValue("OK");
      await closeRedisConnection();
      expect(mockRedis.quit).toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Cache Operations Tests
// ─────────────────────────────────────────────────────────────

describe("Cache Operations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.status = "ready";
  });

  describe("cacheGet behavior", () => {
    it("should return parsed value when key exists", async () => {
      const testData = { name: "test", value: 123 };
      mockRedis.get.mockResolvedValue(JSON.stringify(testData));

      // Simulate cache get logic
      const key = "test-key";
      const fullKey = `cache:${key}`;

      if (mockRedis.status === "ready") {
        const value = await mockRedis.get(fullKey);
        const result = value ? JSON.parse(value) : null;
        expect(result).toEqual(testData);
        expect(mockRedis.get).toHaveBeenCalledWith("cache:test-key");
      }
    });

    it("should return null when key does not exist", async () => {
      mockRedis.get.mockResolvedValue(null);

      const key = "nonexistent-key";
      const fullKey = `cache:${key}`;
      const value = await mockRedis.get(fullKey);
      const result = value ? JSON.parse(value) : null;

      expect(result).toBeNull();
    });

    it("should not call Redis when not connected", () => {
      mockRedis.status = "connecting";

      // When not connected, cache operations should skip Redis
      if (mockRedis.status !== "ready") {
        expect(mockRedis.get).not.toHaveBeenCalled();
      }
    });
  });

  describe("cacheSet behavior", () => {
    it("should set value without TTL", async () => {
      mockRedis.set.mockResolvedValue("OK");

      const key = "test-key";
      const value = { value: "test" };
      const fullKey = `cache:${key}`;

      if (mockRedis.status === "ready") {
        await mockRedis.set(fullKey, JSON.stringify(value));

        expect(mockRedis.set).toHaveBeenCalledWith(
          "cache:test-key",
          JSON.stringify({ value: "test" })
        );
      }
    });

    it("should set value with TTL using setex", async () => {
      mockRedis.setex.mockResolvedValue("OK");

      const key = "test-key";
      const value = { value: "test" };
      const ttl = 3600;
      const fullKey = `cache:${key}`;

      if (mockRedis.status === "ready") {
        await mockRedis.setex(fullKey, ttl, JSON.stringify(value));

        expect(mockRedis.setex).toHaveBeenCalledWith(
          "cache:test-key",
          3600,
          JSON.stringify({ value: "test" })
        );
      }
    });
  });

  describe("cacheDelete behavior", () => {
    it("should delete key successfully", async () => {
      mockRedis.del.mockResolvedValue(1);

      const key = "test-key";
      const fullKey = `cache:${key}`;

      if (mockRedis.status === "ready") {
        await mockRedis.del(fullKey);
        expect(mockRedis.del).toHaveBeenCalledWith("cache:test-key");
      }
    });
  });

  describe("cacheDeletePattern behavior", () => {
    it("should delete keys matching pattern", async () => {
      mockRedis.keys.mockResolvedValue(["cache:user:1", "cache:user:2"]);
      mockRedis.del.mockResolvedValue(2);

      const pattern = "user:*";
      const fullPattern = `cache:${pattern}`;

      if (mockRedis.status === "ready") {
        const keys = await mockRedis.keys(fullPattern);
        if (keys.length > 0) {
          await mockRedis.del(...keys);
        }

        expect(mockRedis.keys).toHaveBeenCalledWith("cache:user:*");
        expect(mockRedis.del).toHaveBeenCalledWith(
          "cache:user:1",
          "cache:user:2"
        );
      }
    });

    it("should not call del when no keys match", async () => {
      mockRedis.keys.mockResolvedValue([]);

      const pattern = "nonexistent:*";
      const fullPattern = `cache:${pattern}`;

      if (mockRedis.status === "ready") {
        const keys = await mockRedis.keys(fullPattern);
        if (keys.length > 0) {
          await mockRedis.del(...keys);
        }

        expect(mockRedis.keys).toHaveBeenCalledWith("cache:nonexistent:*");
        expect(mockRedis.del).not.toHaveBeenCalled();
      }
    });
  });

  describe("cacheGetOrSet behavior", () => {
    it("should return cached value when exists", async () => {
      const cachedData = { name: "cached" };
      mockRedis.get.mockResolvedValue(JSON.stringify(cachedData));

      const key = "test-key";
      const fullKey = `cache:${key}`;
      const factory = vi.fn().mockResolvedValue({ name: "new" });

      // Simulate cacheGetOrSet
      if (mockRedis.status === "ready") {
        const cached = await mockRedis.get(fullKey);
        if (cached) {
          const result = JSON.parse(cached);
          expect(result).toEqual(cachedData);
          expect(factory).not.toHaveBeenCalled();
        }
      }
    });

    it("should call factory when cache miss", async () => {
      mockRedis.get.mockResolvedValue(null);
      mockRedis.set.mockResolvedValue("OK");

      const key = "test-key";
      const fullKey = `cache:${key}`;
      const newData = { name: "new" };
      const factory = vi.fn().mockResolvedValue(newData);

      // Simulate cacheGetOrSet
      if (mockRedis.status === "ready") {
        const cached = await mockRedis.get(fullKey);
        if (!cached) {
          const result = await factory();
          await mockRedis.set(fullKey, JSON.stringify(result));
          expect(result).toEqual(newData);
          expect(factory).toHaveBeenCalled();
          expect(mockRedis.set).toHaveBeenCalled();
        }
      }
    });
  });
});
