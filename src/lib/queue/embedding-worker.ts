// ═══════════════════════════════════════════════════════════════════════════
// Embedding Worker
// Background worker for generating and managing embeddings
// ═══════════════════════════════════════════════════════════════════════════

import { Job } from "bullmq";
import { registerWorker } from "./workers";
import { QUEUE_NAMES } from "./index";
import { type EmbeddingJobData, type BulkEmbedJobData } from "./jobs";
import {
  removeEntityEmbedding,
  buildEntityContent,
} from "@/services/context/embedding-integration";
import { db } from "@/lib/db";
import type { EntityType } from "@/services/context";
import { getEmbeddingService } from "@/lib/embeddings";

/**
 * Initialize the embedding worker
 * Call this on server startup to start processing embedding jobs
 */
export function initializeEmbeddingWorker() {
  return registerWorker<EmbeddingJobData | BulkEmbedJobData>(
    QUEUE_NAMES.EMBEDDINGS,
    async (job: Job<EmbeddingJobData | BulkEmbedJobData>) => {
      // Handle bulk embedding jobs
      if ("entityIds" in job.data) {
        await processBulkEmbedding(job.data);
        return;
      }

      // Handle single embedding jobs
      await processSingleEmbedding(job.data);
    },
    { concurrency: 3 }
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

/**
 * Process a bulk embedding job
 */
async function processBulkEmbedding(data: BulkEmbedJobData): Promise<void> {
  const { userId, entityType, entityIds } = data;

  console.log(
    `[EmbeddingWorker] Processing bulk embed for ${entityIds.length} ${entityType}s`
  );

  // Process in batches to avoid overwhelming the API
  const batchSize = 5;
  for (let i = 0; i < entityIds.length; i += batchSize) {
    const batch = entityIds.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (entityId) => {
        try {
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
        } catch (err) {
          console.error(
            `[EmbeddingWorker] Failed to embed ${entityType}:${entityId}:`,
            err
          );
        }
      })
    );
  }
}
