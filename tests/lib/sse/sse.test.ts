// ═══════════════════════════════════════════════════════════════════════════
// SSE Utilities - Unit Tests
// Tests for Server-Sent Events stream creation and management
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  createSSEStream,
  sseResponse,
  registerConnection,
  unregisterConnection,
  broadcast,
  getConnectionCount,
  getConnectionKeys,
} from "@/lib/sse";

// ─────────────────────────────────────────────────────────────
// SSE Stream Tests
// ─────────────────────────────────────────────────────────────

describe("SSE Stream", () => {
  describe("createSSEStream", () => {
    it("should create a stream with send and close functions", () => {
      const { stream, send, close } = createSSEStream();

      expect(stream).toBeInstanceOf(ReadableStream);
      expect(typeof send).toBe("function");
      expect(typeof close).toBe("function");

      // Clean up
      close();
    });

    it("should format message correctly", async () => {
      const { stream, send, close } = createSSEStream();
      const reader = stream.getReader();

      // Send a message
      send({ event: "test", data: { hello: "world" } });

      // Read the message
      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      expect(text).toContain("event: test");
      expect(text).toContain('data: {"hello":"world"}');
      expect(text).toContain("\n\n"); // SSE message terminator

      // Clean up
      close();
      reader.releaseLock();
    });

    it("should include message id when provided", async () => {
      const { stream, send, close } = createSSEStream();
      const reader = stream.getReader();

      send({ event: "test", data: {}, id: "msg-123" });

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      expect(text).toContain("id: msg-123");

      close();
      reader.releaseLock();
    });

    it("should include retry when provided", async () => {
      const { stream, send, close } = createSSEStream();
      const reader = stream.getReader();

      send({ data: {}, retry: 5000 });

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      expect(text).toContain("retry: 5000");

      close();
      reader.releaseLock();
    });

    it("should handle data-only messages", async () => {
      const { stream, send, close } = createSSEStream();
      const reader = stream.getReader();

      send({ data: { status: "ok" } });

      const { value } = await reader.read();
      const text = new TextDecoder().decode(value);

      expect(text).not.toContain("event:");
      expect(text).toContain('data: {"status":"ok"}');

      close();
      reader.releaseLock();
    });
  });

  describe("sseResponse", () => {
    it("should create response with correct headers", () => {
      const { stream, close } = createSSEStream();
      const response = sseResponse(stream);

      expect(response.headers.get("Content-Type")).toBe("text/event-stream");
      expect(response.headers.get("Cache-Control")).toBe(
        "no-cache, no-transform"
      );
      expect(response.headers.get("Connection")).toBe("keep-alive");

      close();
    });

    it("should include nginx buffering header", () => {
      const { stream, close } = createSSEStream();
      const response = sseResponse(stream);

      expect(response.headers.get("X-Accel-Buffering")).toBe("no");

      close();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Connection Manager Tests
// ─────────────────────────────────────────────────────────────

describe("Connection Manager", () => {
  beforeEach(() => {
    // Note: There's no built-in clear function, so we work around it
    // by using unique keys per test
  });

  describe("registerConnection", () => {
    it("should register a new connection", () => {
      const send = vi.fn();
      const key = `user:${Date.now()}-1`;

      registerConnection(key, send);

      expect(getConnectionCount(key)).toBe(1);
    });

    it("should allow multiple connections for same key", () => {
      const send1 = vi.fn();
      const send2 = vi.fn();
      const key = `user:${Date.now()}-2`;

      registerConnection(key, send1);
      registerConnection(key, send2);

      expect(getConnectionCount(key)).toBe(2);
    });

    it("should isolate connections by key", () => {
      const send1 = vi.fn();
      const send2 = vi.fn();
      const key1 = `user:${Date.now()}-3a`;
      const key2 = `user:${Date.now()}-3b`;

      registerConnection(key1, send1);
      registerConnection(key2, send2);

      expect(getConnectionCount(key1)).toBe(1);
      expect(getConnectionCount(key2)).toBe(1);
    });
  });

  describe("unregisterConnection", () => {
    it("should remove a registered connection", () => {
      const send = vi.fn();
      const key = `user:${Date.now()}-4`;

      registerConnection(key, send);
      expect(getConnectionCount(key)).toBe(1);

      unregisterConnection(key, send);
      expect(getConnectionCount(key)).toBe(0);
    });

    it("should only remove the specified connection", () => {
      const send1 = vi.fn();
      const send2 = vi.fn();
      const key = `user:${Date.now()}-5`;

      registerConnection(key, send1);
      registerConnection(key, send2);

      unregisterConnection(key, send1);

      expect(getConnectionCount(key)).toBe(1);
    });

    it("should handle unregistering non-existent connection", () => {
      const send = vi.fn();
      const key = `nonexistent:${Date.now()}`;

      // Should not throw
      unregisterConnection(key, send);

      expect(getConnectionCount(key)).toBe(0);
    });
  });

  describe("broadcast", () => {
    it("should send message to all connections with key", () => {
      const send1 = vi.fn();
      const send2 = vi.fn();
      const key = `room:${Date.now()}-1`;

      registerConnection(key, send1);
      registerConnection(key, send2);

      broadcast(key, "message", { text: "hello" });

      expect(send1).toHaveBeenCalledWith({
        event: "message",
        data: { text: "hello" },
      });
      expect(send2).toHaveBeenCalledWith({
        event: "message",
        data: { text: "hello" },
      });
    });

    it("should not send to connections with different key", () => {
      const send1 = vi.fn();
      const send2 = vi.fn();
      const key1 = `room:${Date.now()}-2a`;
      const key2 = `room:${Date.now()}-2b`;

      registerConnection(key1, send1);
      registerConnection(key2, send2);

      broadcast(key1, "message", { text: "hello" });

      expect(send1).toHaveBeenCalled();
      expect(send2).not.toHaveBeenCalled();
    });

    it("should handle broadcast to non-existent key", () => {
      const key = `nonexistent:${Date.now()}-broadcast`;

      // Should not throw
      expect(() => broadcast(key, "test", {})).not.toThrow();
    });

    it("should handle send errors gracefully", () => {
      const sendError = vi.fn().mockImplementation(() => {
        throw new Error("Connection closed");
      });
      const sendOk = vi.fn();
      const key = `room:${Date.now()}-3`;

      registerConnection(key, sendError);
      registerConnection(key, sendOk);

      // Should not throw
      expect(() => broadcast(key, "message", {})).not.toThrow();

      // Working connection should still receive message
      expect(sendOk).toHaveBeenCalled();
    });
  });

  describe("getConnectionCount", () => {
    it("should return 0 for non-existent key", () => {
      const key = `nonexistent:${Date.now()}-count`;
      expect(getConnectionCount(key)).toBe(0);
    });

    it("should return correct count", () => {
      const send1 = vi.fn();
      const send2 = vi.fn();
      const send3 = vi.fn();
      const key = `room:${Date.now()}-count`;

      registerConnection(key, send1);
      registerConnection(key, send2);
      registerConnection(key, send3);

      expect(getConnectionCount(key)).toBe(3);
    });
  });

  describe("getConnectionKeys", () => {
    it("should return keys for registered connections", () => {
      const key1 = `unique:${Date.now()}-keys-1`;
      const key2 = `unique:${Date.now()}-keys-2`;

      registerConnection(key1, vi.fn());
      registerConnection(key2, vi.fn());

      const keys = getConnectionKeys();

      expect(keys).toContain(key1);
      expect(keys).toContain(key2);
    });
  });
});
