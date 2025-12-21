// ═══════════════════════════════════════════════════════════════════════════
// Queue Manager
// BullMQ queue creation and management for background jobs
// ═══════════════════════════════════════════════════════════════════════════

import { Queue, Job } from "bullmq";
import { redis } from "@/lib/redis";

// Queue registry
const queues = new Map<string, Queue>();

// ─────────────────────────────────────────────────────────────
// Queue Names
// ─────────────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  EMBEDDINGS: "embeddings",
  EMAIL_SYNC: "email-sync",
  NOTIFICATIONS: "notifications",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

// ─────────────────────────────────────────────────────────────
// Queue Management
// ─────────────────────────────────────────────────────────────

/**
 * Get or create a queue by name
 */
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

/**
 * Add a job to a queue
 */
export async function addJob<T>(
  queueName: QueueName,
  jobName: string,
  data: T,
  options: { delay?: number; priority?: number } = {}
): Promise<Job<T>> {
  const queue = getQueue(queueName);
  return queue.add(jobName, data, options);
}

/**
 * Get queue statistics
 */
export async function getQueueStats(queueName: QueueName) {
  const queue = getQueue(queueName);
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
  ]);

  return { waiting, active, completed, failed, delayed };
}

/**
 * Pause a queue
 */
export async function pauseQueue(queueName: QueueName): Promise<void> {
  const queue = getQueue(queueName);
  await queue.pause();
}

/**
 * Resume a queue
 */
export async function resumeQueue(queueName: QueueName): Promise<void> {
  const queue = getQueue(queueName);
  await queue.resume();
}

/**
 * Clean old jobs from a queue
 */
export async function cleanQueue(
  queueName: QueueName,
  grace: number = 3600000 // 1 hour
): Promise<void> {
  const queue = getQueue(queueName);
  await queue.clean(grace, 100, "completed");
  await queue.clean(grace, 100, "failed");
}

/**
 * Close all queues gracefully
 */
export async function closeQueues(): Promise<void> {
  await Promise.all(Array.from(queues.values()).map((q) => q.close()));
  queues.clear();
}

// Register shutdown handler (only in Node.js runtime, not Edge)
// Note: This code only executes in Node.js; Edge runtime will skip it
if (process.env.NEXT_RUNTIME === "nodejs") {
  const shutdown = async () => {
    console.log("[Queue] Shutting down...");
    await closeQueues();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
