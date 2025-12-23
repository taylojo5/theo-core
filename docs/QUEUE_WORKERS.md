# Queue & Workers Documentation

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [AI_EMBEDDINGS.md](./AI_EMBEDDINGS.md), [CACHING.md](./CACHING.md)

---

## Overview

Theo uses **BullMQ** for background job processing, backed by **Redis**. This enables asynchronous operations like embedding generation, email syncing, and notifications without blocking the main request flow.

---

## Technology Stack

| Component     | Technology      | Purpose                  |
| ------------- | --------------- | ------------------------ |
| Queue Library | BullMQ          | Job queue management     |
| Backend       | Redis (ioredis) | Job storage & pub/sub    |
| Processing    | Workers         | Concurrent job execution |

---

## Quick Start

### Environment Configuration

```env
# .env.local
REDIS_URL="redis://localhost:6379"
```

### Initialize Workers

Workers should be initialized on server startup:

```typescript
import { initializeEmbeddingWorker } from "@/lib/queue/embedding-worker";

// In your app initialization
initializeEmbeddingWorker();
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    QUEUE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      PRODUCERS                            │   │
│  │  API Routes │ Services │ Scheduled Jobs │ Webhooks        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    QUEUE MANAGER                          │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │ embeddings  │  │ email-sync  │  │notifications│      │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                       REDIS                               │   │
│  │  • Job Storage    • State Management   • Pub/Sub         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │                                       │
│                          ▼                                       │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      WORKERS                              │   │
│  │                                                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐      │   │
│  │  │ Embedding   │  │ Email Sync  │  │Notification │      │   │
│  │  │  Worker     │  │   Worker    │  │  Worker     │      │   │
│  │  │ (3 conc.)   │  │ (5 conc.)   │  │ (5 conc.)   │      │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘      │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Queue Names

```typescript
export const QUEUE_NAMES = {
  EMBEDDINGS: "embeddings",
  EMAIL_SYNC: "email-sync",
  NOTIFICATIONS: "notifications",
} as const;
```

---

## Queue Manager

### Creating/Getting Queues

```typescript
import { getQueue, QUEUE_NAMES } from "@/lib/queue";

// Get (or create) a queue by name
const embeddingsQueue = getQueue(QUEUE_NAMES.EMBEDDINGS);
```

### Adding Jobs

```typescript
import { addJob, QUEUE_NAMES } from "@/lib/queue";

// Add a job to a queue
await addJob(
  QUEUE_NAMES.EMBEDDINGS,
  "generate-embedding", // Job name
  {
    userId: "user-123",
    entityType: "person",
    entityId: "person-456",
    operation: "create",
  },
  {
    delay: 1000, // Optional: delay in ms
    priority: 1, // Optional: lower = higher priority
  }
);
```

### Default Job Options

All queues are created with these defaults:

```typescript
{
  attempts: 3,              // Retry up to 3 times
  backoff: {
    type: "exponential",
    delay: 1000,            // 1s, 2s, 4s...
  },
  removeOnComplete: 100,    // Keep last 100 completed jobs
  removeOnFail: 500,        // Keep last 500 failed jobs
}
```

### Queue Statistics

```typescript
import { getQueueStats, QUEUE_NAMES } from "@/lib/queue";

const stats = await getQueueStats(QUEUE_NAMES.EMBEDDINGS);
// {
//   waiting: 5,
//   active: 2,
//   completed: 150,
//   failed: 3,
//   delayed: 1,
// }
```

### Queue Control

```typescript
import { pauseQueue, resumeQueue, cleanQueue } from "@/lib/queue";

// Pause processing
await pauseQueue(QUEUE_NAMES.EMBEDDINGS);

// Resume processing
await resumeQueue(QUEUE_NAMES.EMBEDDINGS);

// Clean old jobs (older than 1 hour)
await cleanQueue(QUEUE_NAMES.EMBEDDINGS, 3600000);
```

### Graceful Shutdown

```typescript
import { closeQueues } from "@/lib/queue";

// On application shutdown
await closeQueues();
```

---

## Workers

### Registering Workers

```typescript
import { registerWorker } from "@/lib/queue/workers";
import { QUEUE_NAMES } from "@/lib/queue";

const worker = registerWorker<MyJobData>(
  QUEUE_NAMES.EMBEDDINGS,
  async (job) => {
    console.log(`Processing job ${job.id}:`, job.data);
    // Process the job...
  },
  { concurrency: 5 }
);
```

### Worker Events

Workers emit events for monitoring:

```typescript
worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on("failed", (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});

worker.on("error", (error) => {
  console.error("Worker error:", error);
});
```

### Worker Control

```typescript
import { pauseWorker, resumeWorker, getWorker } from "@/lib/queue/workers";

// Pause a specific worker
await pauseWorker(QUEUE_NAMES.EMBEDDINGS);

// Resume a worker
await resumeWorker(QUEUE_NAMES.EMBEDDINGS);

// Get worker instance
const worker = getWorker(QUEUE_NAMES.EMBEDDINGS);
```

### Graceful Shutdown

```typescript
import { closeWorkers } from "@/lib/queue/workers";

// On application shutdown
await closeWorkers();
```

---

## Job Types

### Job Names

```typescript
export const JOB_NAMES = {
  // Embedding jobs
  GENERATE_EMBEDDING: "generate-embedding",
  DELETE_EMBEDDING: "delete-embedding",
  BULK_EMBED: "bulk-embed",

  // Email sync jobs
  SYNC_GMAIL: "sync-gmail",
  SYNC_GMAIL_INCREMENTAL: "sync-gmail-incremental",
  PROCESS_EMAIL: "process-email",

  // Notification jobs
  SEND_NOTIFICATION: "send-notification",
  DEADLINE_REMINDER: "deadline-reminder",

  // Maintenance jobs
  CLEANUP_EMBEDDINGS: "cleanup-embeddings",
  REFRESH_TOKEN: "refresh-token",
} as const;
```

### Embedding Job Data

```typescript
interface EmbeddingJobData {
  userId: string;
  entityType: EntityType;
  entityId: string;
  operation: "create" | "update" | "delete";
}

interface BulkEmbedJobData {
  userId: string;
  entityType: EntityType;
  entityIds: string[];
}
```

### Email Sync Job Data

```typescript
interface EmailSyncJobData {
  userId: string;
  accountId: string;
  syncType: "full" | "incremental";
  cursor?: string;
}

interface ProcessEmailJobData {
  userId: string;
  accountId: string;
  messageId: string;
  threadId: string;
}
```

### Notification Job Data

```typescript
interface NotificationJobData {
  userId: string;
  type: "deadline" | "reminder" | "sync-complete" | "error";
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

interface DeadlineReminderJobData {
  userId: string;
  deadlineId: string;
  reminderMinutesBefore: number;
}
```

---

## Embedding Worker

The embedding worker handles all embedding operations:

### Initialization

```typescript
import { initializeEmbeddingWorker } from "@/lib/queue/embedding-worker";

// Call on server startup
initializeEmbeddingWorker();
```

### Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│                 EMBEDDING WORKER FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Job Received                                                │
│       │                                                      │
│       ▼                                                      │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Is bulk job? (has entityIds array)                   │    │
│  └─────────────────────────────────────────────────────┘    │
│       │                      │                               │
│      YES                    NO                               │
│       │                      │                               │
│       ▼                      ▼                               │
│  ┌──────────────┐    ┌───────────────────────────┐         │
│  │Process batch │    │ Check operation type       │         │
│  │(5 at a time) │    └───────────────────────────┘         │
│  └──────────────┘            │                              │
│                    ┌─────────┼─────────┐                    │
│                    │         │         │                    │
│                 DELETE    CREATE    UPDATE                  │
│                    │         │         │                    │
│                    ▼         ▼         ▼                    │
│             ┌──────────┐ ┌───────────────────────────┐     │
│             │ Remove   │ │ 1. Fetch entity            │     │
│             │ embedding│ │ 2. Build content           │     │
│             └──────────┘ │ 3. Generate embedding      │     │
│                          │ 4. Store in database       │     │
│                          └───────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Queueing Embedding Jobs

```typescript
import { addJob, QUEUE_NAMES } from "@/lib/queue";
import { JOB_NAMES } from "@/lib/queue/jobs";

// Single entity embedding
await addJob(QUEUE_NAMES.EMBEDDINGS, JOB_NAMES.GENERATE_EMBEDDING, {
  userId: "user-123",
  entityType: "person",
  entityId: "person-456",
  operation: "create",
});

// Bulk embedding
await addJob(QUEUE_NAMES.EMBEDDINGS, JOB_NAMES.BULK_EMBED, {
  userId: "user-123",
  entityType: "person",
  entityIds: ["person-1", "person-2", "person-3"],
});

// Delete embedding
await addJob(QUEUE_NAMES.EMBEDDINGS, JOB_NAMES.DELETE_EMBEDDING, {
  userId: "user-123",
  entityType: "person",
  entityId: "person-456",
  operation: "delete",
});
```

---

## Admin API

### Queue Statistics Endpoint

```
GET /api/admin/queues
```

Returns statistics for all queues:

```json
{
  "queues": {
    "embeddings": {
      "waiting": 5,
      "active": 2,
      "completed": 150,
      "failed": 3,
      "delayed": 1
    },
    "email-sync": { ... },
    "notifications": { ... }
  }
}
```

---

## Best Practices

### 1. Idempotent Jobs

Design jobs to be safely re-runnable:

```typescript
async function processEmbedding(data: EmbeddingJobData) {
  // Check if already processed
  const existing = await db.embedding.findFirst({
    where: {
      userId: data.userId,
      entityType: data.entityType,
      entityId: data.entityId,
    },
  });

  if (existing && data.operation === "create") {
    // Already exists, update instead
    // ...
  }
}
```

### 2. Handle Failures Gracefully

```typescript
async function processJob(job: Job<MyData>) {
  try {
    await doWork(job.data);
  } catch (error) {
    // Log the error
    console.error(`Job ${job.id} failed:`, error);

    // Optionally, check if retryable
    if (isRetryableError(error)) {
      throw error; // BullMQ will retry
    }

    // Non-retryable: mark as failed without retry
    throw new Error(`Non-retryable: ${error.message}`);
  }
}
```

### 3. Use Appropriate Concurrency

```typescript
// CPU-bound work: lower concurrency
registerWorker(QUEUE_NAMES.EMBEDDINGS, processor, { concurrency: 3 });

// I/O-bound work: higher concurrency
registerWorker(QUEUE_NAMES.NOTIFICATIONS, processor, { concurrency: 10 });
```

### 4. Progress Reporting

```typescript
async function processBulkJob(job: Job<BulkData>) {
  const total = job.data.items.length;

  for (let i = 0; i < total; i++) {
    await processItem(job.data.items[i]);
    await job.updateProgress(((i + 1) / total) * 100);
  }
}
```

### 5. Cleanup Old Jobs

```typescript
// Periodically clean old completed/failed jobs
setInterval(
  async () => {
    await cleanQueue(QUEUE_NAMES.EMBEDDINGS, 24 * 60 * 60 * 1000); // 24 hours
  },
  60 * 60 * 1000
); // Every hour
```

---

## Error Handling

### Retry Logic

BullMQ automatically retries failed jobs with exponential backoff:

- Attempt 1: Immediately
- Attempt 2: After 1 second
- Attempt 3: After 2 seconds
- Attempt 4: After 4 seconds (if configured)

### Failed Job Handling

```typescript
worker.on("failed", async (job, error) => {
  // Log to monitoring service
  logError({
    jobId: job?.id,
    queue: QUEUE_NAMES.EMBEDDINGS,
    error: error.message,
    data: job?.data,
  });

  // Optionally notify
  if (job?.attemptsMade >= 3) {
    await notifyAdmin(`Job ${job.id} failed permanently`);
  }
});
```

### Dead Letter Queue

For jobs that fail all retries:

```typescript
const queue = getQueue(QUEUE_NAMES.EMBEDDINGS);

// Get failed jobs
const failedJobs = await queue.getFailed(0, 100);

// Retry a specific failed job
await failedJobs[0].retry();

// Remove failed job
await failedJobs[0].remove();
```

---

## Monitoring

### Job Lifecycle

```
WAITING → ACTIVE → COMPLETED
              ↓
           FAILED → (retry) → ACTIVE
              ↓
         FAILED (no more retries)
```

### Health Check

```typescript
import { getQueueStats, QUEUE_NAMES } from "@/lib/queue";

async function checkQueueHealth() {
  const stats = await getQueueStats(QUEUE_NAMES.EMBEDDINGS);

  return {
    healthy: stats.failed < 100 && stats.waiting < 1000,
    stats,
  };
}
```

### Metrics to Monitor

| Metric       | Warning Threshold  | Critical Threshold |
| ------------ | ------------------ | ------------------ |
| Waiting jobs | > 100              | > 1000             |
| Failed jobs  | > 10               | > 100              |
| Active jobs  | > concurrency \* 2 | > concurrency \* 5 |
| Delayed jobs | > 50               | > 500              |

---

## Testing

### Mocking Queues

```typescript
import { vi } from "vitest";
import * as queue from "@/lib/queue";

vi.mock("@/lib/queue", () => ({
  addJob: vi.fn().mockResolvedValue({ id: "test-job-id" }),
  getQueueStats: vi.fn().mockResolvedValue({
    waiting: 0,
    active: 0,
    completed: 0,
    failed: 0,
    delayed: 0,
  }),
}));
```

### Testing Workers

```typescript
import { initializeEmbeddingWorker } from "@/lib/queue/embedding-worker";

describe("Embedding Worker", () => {
  beforeAll(() => {
    initializeEmbeddingWorker();
  });

  it("should process embedding job", async () => {
    await addJob(QUEUE_NAMES.EMBEDDINGS, "generate-embedding", {
      userId: testUserId,
      entityType: "person",
      entityId: testPersonId,
      operation: "create",
    });

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Verify embedding was created
    const embedding = await db.embedding.findFirst({
      where: { entityId: testPersonId },
    });
    expect(embedding).toBeTruthy();
  });
});
```

---

## Related Documentation

- [CACHING.md](./CACHING.md) - Redis configuration
- [AI_EMBEDDINGS.md](./AI_EMBEDDINGS.md) - Embedding generation
- [services/CONTEXT_SERVICES.md](./services/CONTEXT_SERVICES.md) - Entity lifecycle hooks
- [BullMQ Documentation](https://docs.bullmq.io/)
