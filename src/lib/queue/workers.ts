// ═══════════════════════════════════════════════════════════════════════════
// Worker Manager
// BullMQ worker registration and management
// ═══════════════════════════════════════════════════════════════════════════

import { Worker, Job } from "bullmq";
import { redis } from "@/lib/redis";
import { type QueueName } from "./index";

type JobProcessor<T> = (job: Job<T>) => Promise<void>;

const workers = new Map<string, Worker>();

/**
 * Register a worker for a queue
 */
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
  console.log(`[Worker:${queueName}] Worker registered`);
  return worker;
}

/**
 * Get a registered worker
 */
export function getWorker(queueName: QueueName): Worker | undefined {
  return workers.get(queueName);
}

/**
 * Close all workers gracefully
 */
export async function closeWorkers(): Promise<void> {
  await Promise.all(Array.from(workers.values()).map((w) => w.close()));
  workers.clear();
}

/**
 * Pause a specific worker
 */
export async function pauseWorker(queueName: QueueName): Promise<void> {
  const worker = workers.get(queueName);
  if (worker) {
    await worker.pause();
  }
}

/**
 * Resume a specific worker
 */
export async function resumeWorker(queueName: QueueName): Promise<void> {
  const worker = workers.get(queueName);
  if (worker) {
    worker.resume();
  }
}

// Register shutdown handler
if (typeof process !== "undefined") {
  const shutdown = async () => {
    console.log("[Workers] Shutting down...");
    await closeWorkers();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
