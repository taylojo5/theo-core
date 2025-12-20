// ═══════════════════════════════════════════════════════════════════════════
// Queue Manager - Unit Tests
// Tests for BullMQ queue creation and job management
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Queue class
const mockQueue = {
  add: vi.fn(),
  getWaitingCount: vi.fn(),
  getActiveCount: vi.fn(),
  getCompletedCount: vi.fn(),
  getFailedCount: vi.fn(),
  getDelayedCount: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  clean: vi.fn(),
  close: vi.fn(),
};

vi.mock("bullmq", () => ({
  Queue: vi.fn(() => mockQueue),
  Worker: vi.fn(() => ({
    on: vi.fn(),
    close: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  })),
  Job: vi.fn(),
}));

// Mock Redis
vi.mock("@/lib/redis", () => ({
  redis: {},
}));

// Import after mocking
import {
  getQueue,
  addJob,
  getQueueStats,
  pauseQueue,
  resumeQueue,
  cleanQueue,
  closeQueues,
  QUEUE_NAMES,
} from "@/lib/queue";

// ─────────────────────────────────────────────────────────────
// Queue Manager Tests
// ─────────────────────────────────────────────────────────────

describe("Queue Manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("QUEUE_NAMES", () => {
    it("should define embeddings queue", () => {
      expect(QUEUE_NAMES.EMBEDDINGS).toBe("embeddings");
    });

    it("should define email-sync queue", () => {
      expect(QUEUE_NAMES.EMAIL_SYNC).toBe("email-sync");
    });

    it("should define notifications queue", () => {
      expect(QUEUE_NAMES.NOTIFICATIONS).toBe("notifications");
    });
  });

  describe("getQueue", () => {
    it("should return a queue instance", () => {
      const queue = getQueue(QUEUE_NAMES.EMBEDDINGS);
      expect(queue).toBeDefined();
    });

    it("should return same instance for same queue name", () => {
      const queue1 = getQueue(QUEUE_NAMES.EMBEDDINGS);
      const queue2 = getQueue(QUEUE_NAMES.EMBEDDINGS);
      expect(queue1).toBe(queue2);
    });
  });

  describe("addJob", () => {
    it("should add job to queue", async () => {
      const jobData = { userId: "user-123", entityType: "person" };
      mockQueue.add.mockResolvedValue({ id: "job-1", data: jobData });

      const job = await addJob(QUEUE_NAMES.EMBEDDINGS, "test-job", jobData);

      expect(mockQueue.add).toHaveBeenCalledWith("test-job", jobData, {});
      expect(job).toBeDefined();
    });

    it("should add job with options", async () => {
      const jobData = { userId: "user-123" };
      const options = { delay: 1000, priority: 1 };
      mockQueue.add.mockResolvedValue({ id: "job-2", data: jobData });

      await addJob(QUEUE_NAMES.EMBEDDINGS, "test-job", jobData, options);

      expect(mockQueue.add).toHaveBeenCalledWith("test-job", jobData, options);
    });
  });

  describe("getQueueStats", () => {
    it("should return queue statistics", async () => {
      mockQueue.getWaitingCount.mockResolvedValue(5);
      mockQueue.getActiveCount.mockResolvedValue(2);
      mockQueue.getCompletedCount.mockResolvedValue(100);
      mockQueue.getFailedCount.mockResolvedValue(3);
      mockQueue.getDelayedCount.mockResolvedValue(1);

      const stats = await getQueueStats(QUEUE_NAMES.EMBEDDINGS);

      expect(stats).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      });
    });
  });

  describe("pauseQueue", () => {
    it("should pause the queue", async () => {
      mockQueue.pause.mockResolvedValue(undefined);

      await pauseQueue(QUEUE_NAMES.EMBEDDINGS);

      expect(mockQueue.pause).toHaveBeenCalled();
    });
  });

  describe("resumeQueue", () => {
    it("should resume the queue", async () => {
      mockQueue.resume.mockResolvedValue(undefined);

      await resumeQueue(QUEUE_NAMES.EMBEDDINGS);

      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe("cleanQueue", () => {
    it("should clean completed and failed jobs", async () => {
      mockQueue.clean.mockResolvedValue([]);

      await cleanQueue(QUEUE_NAMES.EMBEDDINGS, 3600000);

      expect(mockQueue.clean).toHaveBeenCalledWith(3600000, 100, "completed");
      expect(mockQueue.clean).toHaveBeenCalledWith(3600000, 100, "failed");
    });

    it("should use default grace period", async () => {
      mockQueue.clean.mockResolvedValue([]);

      await cleanQueue(QUEUE_NAMES.EMBEDDINGS);

      expect(mockQueue.clean).toHaveBeenCalledWith(3600000, 100, "completed");
    });
  });

  describe("closeQueues", () => {
    it("should close all queues", async () => {
      mockQueue.close.mockResolvedValue(undefined);

      // Ensure queue exists
      getQueue(QUEUE_NAMES.EMBEDDINGS);

      await closeQueues();

      expect(mockQueue.close).toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Job Types Tests
// ─────────────────────────────────────────────────────────────

describe("Job Types", () => {
  it("should import JOB_NAMES", async () => {
    const { JOB_NAMES } = await import("@/lib/queue/jobs");

    expect(JOB_NAMES.GENERATE_EMBEDDING).toBeDefined();
    expect(JOB_NAMES.DELETE_EMBEDDING).toBeDefined();
    expect(JOB_NAMES.SYNC_GMAIL).toBeDefined();
    expect(JOB_NAMES.SEND_NOTIFICATION).toBeDefined();
  });
});
