// ═══════════════════════════════════════════════════════════════════════════
// Embedding Worker
// Background worker for generating and managing embeddings
// ═══════════════════════════════════════════════════════════════════════════

import { Job } from "bullmq";
import { registerWorker } from "./workers";
import { QUEUE_NAMES } from "./index";
import {
  type EmbeddingJobData,
  type BulkEmbedJobData,
  type EmailEmbeddingJobData,
  type BulkEmailEmbedJobData,
} from "./jobs";
import {
  removeEntityEmbedding,
  buildEntityContent,
} from "@/services/context/embedding-integration";
import { db } from "@/lib/db";
import type { EntityType } from "@/services/context";
import { getEmbeddingService } from "@/lib/embeddings";
import {
  generateEmailEmbeddingById,
  deleteEmailEmbedding,
  generateEmailEmbeddings,
} from "@/integrations/gmail/embeddings";

/** All embedding job data types */
type AnyEmbeddingJobData =
  | EmbeddingJobData
  | BulkEmbedJobData
  | EmailEmbeddingJobData
  | BulkEmailEmbedJobData;

/**
 * Initialize the embedding worker
 * Call this on server startup to start processing embedding jobs
 * 
 * Note: Concurrency is set to 1 to prevent rate limiting from OpenAI.
 * Each job processes emails sequentially with delays between API calls.
 */
export function initializeEmbeddingWorker() {
  return registerWorker<AnyEmbeddingJobData>(
    QUEUE_NAMES.EMBEDDINGS,
    async (job: Job<AnyEmbeddingJobData>) => {
      const data = job.data;
      
      // Handle bulk email embedding jobs
      if ("emailIds" in data) {
        await processBulkEmailEmbedding(data as BulkEmailEmbedJobData);
        return;
      }

      // Handle single email embedding jobs
      if ("emailId" in data) {
        await processSingleEmailEmbedding(data as EmailEmbeddingJobData);
        return;
      }

      // Handle bulk entity embedding jobs
      if ("entityIds" in data) {
        await processBulkEmbedding(data as BulkEmbedJobData);
        return;
      }

      // Handle single entity embedding jobs
      await processSingleEmbedding(data as EmbeddingJobData);
    },
    { concurrency: 1 } // Single job at a time to prevent OpenAI rate limits
  );
}

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

/**
 * Process a single embedding job
 */
async function processSingleEmbedding(data: EmbeddingJobData): Promise<void> {
  const { userId, entityType, entityId, operation } = data;

  console.log(
    `[EmbeddingWorker] Processing ${operation} for ${entityType}:${entityId}`
  );

  if (operation === "delete") {
    await removeEntityEmbedding(userId, entityType, entityId);
    return;
  }

  // For create/update, fetch the entity and generate embedding
  const entity = await fetchEntity(entityType, entityId, userId);
  if (!entity) {
    console.warn(
      `[EmbeddingWorker] Entity ${entityType}:${entityId} not found, skipping`
    );
    return;
  }

  // Build content and store embedding
  const content = buildEntityContent(entityType, entity);
  const embeddingService = getEmbeddingService();
  await embeddingService.storeEntityEmbedding(
    userId,
    entityType,
    entityId,
    content
  );
}

/** Delay between embedding API calls to avoid rate limits */
const EMBEDDING_THROTTLE_MS = 1500;

/**
 * Process a bulk embedding job
 * Processes entities sequentially with delays to avoid OpenAI rate limits
 */
async function processBulkEmbedding(data: BulkEmbedJobData): Promise<void> {
  const { userId, entityType, entityIds } = data;

  console.log(
    `[EmbeddingWorker] Processing bulk embed for ${entityIds.length} ${entityType}s`
  );

  // Process entities sequentially with throttling to avoid rate limits
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

    // Throttle between API calls to stay under rate limits
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
async function processSingleEmailEmbedding(
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

  // For create/update, generate the embedding
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

  // Fetch all emails in one query
  const emails = await db.email.findMany({
    where: {
      id: { in: emailIds },
      userId,
    },
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
