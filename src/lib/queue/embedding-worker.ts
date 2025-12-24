// ═══════════════════════════════════════════════════════════════════════════
// Embedding Worker
// Background worker for generating and managing embeddings
// Uses discriminated unions for type-safe job routing
// ═══════════════════════════════════════════════════════════════════════════

import { Job } from "bullmq";
import { registerWorker } from "./workers";
import { QUEUE_NAMES } from "./index";
import {
  EMBEDDING_JOB_TYPES,
  type AnyEmbeddingJobData,
  type EntityEmbeddingJobData,
  type BulkEntityEmbedJobData,
  type EmailEmbeddingJobData,
  type BulkEmailEmbedJobData,
  type CalendarEventEmbeddingJobData,
  type BulkCalendarEventEmbedJobData,
} from "./jobs";
import {
  removeEntityEmbedding,
  buildEntityContent,
} from "@/services/context/embedding-integration";
import { db } from "@/lib/db";
import type { EntityType } from "@/services/context";
import { getEmbeddingService, storeEmbedding } from "@/lib/embeddings";
import {
  generateEmailEmbeddingById,
  deleteEmailEmbedding,
  generateEmailEmbeddings,
} from "@/integrations/gmail/embeddings";

/** Delay between embedding API calls to avoid rate limits */
const EMBEDDING_THROTTLE_MS = 1500;

/**
 * Initialize the embedding worker
 * Call this on server startup to start processing embedding jobs
 *
 * Note: Concurrency is set to 1 to prevent rate limiting from OpenAI.
 * Each job processes items sequentially with delays between API calls.
 */
export function initializeEmbeddingWorker() {
  return registerWorker<AnyEmbeddingJobData>(
    QUEUE_NAMES.EMBEDDINGS,
    async (job: Job<AnyEmbeddingJobData>) => {
      await processEmbeddingJob(job.data);
    },
    { concurrency: 1 }
  );
}

// ─────────────────────────────────────────────────────────────
// Job Routing
// ─────────────────────────────────────────────────────────────

/**
 * Process embedding jobs using discriminated union routing
 * Type-safe and extensible - add new embedding types here
 */
async function processEmbeddingJob(data: AnyEmbeddingJobData): Promise<void> {
  switch (data.type) {
    case EMBEDDING_JOB_TYPES.ENTITY:
      await processEntityEmbedding(data);
      break;

    case EMBEDDING_JOB_TYPES.ENTITY_BULK:
      await processBulkEntityEmbedding(data);
      break;

    case EMBEDDING_JOB_TYPES.EMAIL:
      await processEmailEmbedding(data);
      break;

    case EMBEDDING_JOB_TYPES.EMAIL_BULK:
      await processBulkEmailEmbedding(data);
      break;

    case EMBEDDING_JOB_TYPES.CALENDAR_EVENT:
      await processCalendarEventEmbedding(data);
      break;

    case EMBEDDING_JOB_TYPES.CALENDAR_EVENT_BULK:
      await processBulkCalendarEventEmbedding(data);
      break;

    default:
      // TypeScript will catch missing cases at compile time
      const _exhaustive: never = data;
      throw new Error(
        `Unknown embedding job type: ${(_exhaustive as { type: string }).type}`
      );
  }
}

// ─────────────────────────────────────────────────────────────
// Entity Embedding Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process a single entity embedding job
 */
async function processEntityEmbedding(
  data: EntityEmbeddingJobData
): Promise<void> {
  const { userId, entityType, entityId, operation } = data;

  console.log(
    `[EmbeddingWorker] Processing ${operation} for ${entityType}:${entityId}`
  );

  if (operation === "delete") {
    await removeEntityEmbedding(userId, entityType, entityId);
    return;
  }

  const entity = await fetchEntity(entityType, entityId, userId);
  if (!entity) {
    console.warn(
      `[EmbeddingWorker] Entity ${entityType}:${entityId} not found, skipping`
    );
    return;
  }

  const content = buildEntityContent(entityType, entity);
  const embeddingService = getEmbeddingService();
  await embeddingService.storeEntityEmbedding(
    userId,
    entityType,
    entityId,
    content
  );
}

/**
 * Process a bulk entity embedding job
 */
async function processBulkEntityEmbedding(
  data: BulkEntityEmbedJobData
): Promise<void> {
  const { userId, entityType, entityIds } = data;

  console.log(
    `[EmbeddingWorker] Processing bulk embed for ${entityIds.length} ${entityType}s`
  );

  for (let i = 0; i < entityIds.length; i++) {
    const entityId = entityIds[i];

    try {
      const entity = await fetchEntity(entityType, entityId, userId);
      if (!entity) {
        console.warn(
          `[EmbeddingWorker] Entity ${entityType}:${entityId} not found, skipping`
        );
        continue;
      }

      const content = buildEntityContent(entityType, entity);
      const embeddingService = getEmbeddingService();
      await embeddingService.storeEntityEmbedding(
        userId,
        entityType,
        entityId,
        content
      );
    } catch (err) {
      console.error(
        `[EmbeddingWorker] Failed to embed ${entityType}:${entityId}:`,
        err
      );
    }

    if (i < entityIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, EMBEDDING_THROTTLE_MS));
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Email Embedding Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process a single email embedding job
 */
async function processEmailEmbedding(
  data: EmailEmbeddingJobData
): Promise<void> {
  const { userId, emailId, operation } = data;

  console.log(
    `[EmbeddingWorker] Processing email ${operation} for email:${emailId}`
  );

  if (operation === "delete") {
    await deleteEmailEmbedding(userId, emailId);
    return;
  }

  const result = await generateEmailEmbeddingById(userId, emailId);
  if (!result.success) {
    console.warn(
      `[EmbeddingWorker] Email embedding failed for ${emailId}: ${result.error}`
    );
  }
}

/**
 * Process a bulk email embedding job
 */
async function processBulkEmailEmbedding(
  data: BulkEmailEmbedJobData
): Promise<void> {
  const { userId, emailIds } = data;

  console.log(
    `[EmbeddingWorker] Processing bulk email embed for ${emailIds.length} emails`
  );

  const emails = await db.email.findMany({
    where: { id: { in: emailIds }, userId },
  });

  if (emails.length === 0) {
    console.warn("[EmbeddingWorker] No emails found for bulk embedding");
    return;
  }

  const result = await generateEmailEmbeddings(emails);
  console.log(
    `[EmbeddingWorker] Bulk email embed complete: ${result.succeeded}/${result.total} succeeded`
  );
}

// ─────────────────────────────────────────────────────────────
// Calendar Event Embedding Processing
// ─────────────────────────────────────────────────────────────

/**
 * Process a single calendar event embedding job
 */
async function processCalendarEventEmbedding(
  data: CalendarEventEmbeddingJobData
): Promise<void> {
  const { userId, eventId, operation } = data;

  console.log(
    `[EmbeddingWorker] Processing calendar event ${operation} for event:${eventId}`
  );

  if (operation === "delete") {
    try {
      const embeddingService = getEmbeddingService();
      await embeddingService.deleteEmbeddings(userId, "calendar_event", eventId);
    } catch (err) {
      console.error(
        `[EmbeddingWorker] Failed to delete calendar event embedding:`,
        err
      );
    }
    return;
  }

  const event = await db.event.findFirst({
    where: { id: eventId, userId },
  });

  if (!event) {
    console.warn(
      `[EmbeddingWorker] Calendar event ${eventId} not found, skipping`
    );
    return;
  }

  const embeddingText = buildCalendarEventEmbeddingText(event);
  if (!embeddingText.trim()) {
    console.debug(
      `[EmbeddingWorker] Skipping calendar event with no content: ${eventId}`
    );
    return;
  }

  await storeEmbedding({
    userId,
    entityType: "calendar_event",
    entityId: eventId,
    content: embeddingText,
  });
}

/**
 * Process a bulk calendar event embedding job
 */
async function processBulkCalendarEventEmbedding(
  data: BulkCalendarEventEmbedJobData
): Promise<void> {
  const { userId, eventIds } = data;

  console.log(
    `[EmbeddingWorker] Processing bulk calendar event embed for ${eventIds.length} events`
  );

  let processed = 0;
  let failed = 0;

  for (let i = 0; i < eventIds.length; i++) {
    const eventId = eventIds[i];

    try {
      const event = await db.event.findFirst({
        where: { id: eventId, userId },
      });

      if (!event) {
        console.warn(
          `[EmbeddingWorker] Calendar event ${eventId} not found, skipping`
        );
        failed++;
        continue;
      }

      const embeddingText = buildCalendarEventEmbeddingText(event);
      if (!embeddingText.trim()) {
        continue;
      }

      await storeEmbedding({
        userId,
        entityType: "calendar_event",
        entityId: eventId,
        content: embeddingText,
      });

      processed++;
    } catch (err) {
      console.error(
        `[EmbeddingWorker] Failed to embed calendar event ${eventId}:`,
        err
      );
      failed++;
    }

    if (i < eventIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, EMBEDDING_THROTTLE_MS));
    }
  }

  console.log(
    `[EmbeddingWorker] Bulk calendar event embed complete: ${processed}/${eventIds.length} succeeded, ${failed} failed`
  );
}

/**
 * Build embedding text from a calendar event
 */
function buildCalendarEventEmbeddingText(event: {
  title: string | null;
  description: string | null;
  location: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  allDay: boolean | null;
}): string {
  const parts: string[] = [];

  if (event.title) {
    parts.push(`Event: ${event.title}`);
  }

  if (event.startsAt) {
    if (event.allDay) {
      parts.push(`Date: ${event.startsAt.toLocaleDateString()}`);
    } else {
      parts.push(`Time: ${event.startsAt.toLocaleString()}`);
      if (event.endsAt) {
        parts.push(`Until: ${event.endsAt.toLocaleString()}`);
      }
    }
  }

  if (event.location) {
    parts.push(`Location: ${event.location}`);
  }

  if (event.description) {
    const maxLength = 1500;
    parts.push(event.description.slice(0, maxLength));
  }

  return parts.join("\n");
}

// ─────────────────────────────────────────────────────────────
// Shared Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Fetch entity from database
 */
async function fetchEntity(
  entityType: EntityType,
  entityId: string,
  userId: string
) {
  switch (entityType) {
    case "person":
      return db.person.findFirst({
        where: { id: entityId, userId, deletedAt: null },
      });
    case "place":
      return db.place.findFirst({
        where: { id: entityId, userId, deletedAt: null },
      });
    case "event":
      return db.event.findFirst({
        where: { id: entityId, userId, deletedAt: null },
      });
    case "task":
      return db.task.findFirst({
        where: { id: entityId, userId, deletedAt: null },
      });
    case "deadline":
      return db.deadline.findFirst({
        where: { id: entityId, userId, deletedAt: null },
      });
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}
