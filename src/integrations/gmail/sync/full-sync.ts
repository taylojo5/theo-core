// ═══════════════════════════════════════════════════════════════════════════
// Gmail Full Sync
// Initial import of all emails from Gmail with checkpoint-based resumption
// ═══════════════════════════════════════════════════════════════════════════

import { createGmailClient, GmailClient } from "../client";
import {
  emailRepository,
  labelRepository,
  syncStateRepository,
} from "../repository";
import {
  mapGmailMessageToEmail,
  mapGmailLabelsToEmailLabels,
} from "../mappers";
import { GmailError, GmailErrorCode } from "../errors";
import { syncLogger } from "../logger";
import { FULL_SYNC_MAX_PAGES, MESSAGE_FETCH_CONCURRENCY } from "../constants";
import { queueFullSyncEmbeddings } from "./utils";
import { logAuditEntry } from "@/services/audit";
import { db } from "@/lib/db";
import type { ParsedGmailMessage, GmailLabel } from "../types";
import type {
  EmailSyncResult,
  EmailSyncError,
  FullSyncOptions,
  FullSyncCheckpoint,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Default Options
// ─────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Omit<Required<FullSyncOptions>, "afterDate"> & {
  afterDate?: Date;
} = {
  maxEmails: 1000,
  labelIds: [],
  afterDate: undefined,
  pageSize: 100,
  resumeFromCheckpoint: false,
};

// ─────────────────────────────────────────────────────────────
// Full Sync Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Perform a full sync of Gmail emails
 *
 * This function:
 * 1. Syncs all labels from Gmail
 * 2. Gets the current history ID
 * 3. Fetches all messages (paginated)
 * 4. Stores emails in the database
 * 5. Saves checkpoints for resumption
 * 6. Updates sync state with new history ID
 *
 * @param userId - The user ID to sync for
 * @param accessToken - OAuth2 access token
 * @param options - Sync options
 * @param onProgress - Optional progress callback
 * @returns Full sync result with statistics
 */
export async function fullSync(
  userId: string,
  accessToken: string,
  options: FullSyncOptions = {},
  onProgress?: (progress: FullSyncProgress) => void
): Promise<EmailSyncResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const result: EmailSyncResult = {
    syncType: "full",
    added: 0,
    updated: 0,
    deleted: 0,
    unchanged: 0,
    total: 0,
    historyId: "",
    hasMore: false,
    durationMs: 0,
    errors: [],
  };

  // Check for existing checkpoint if resuming
  let startPageToken: string | undefined;
  let startProgress = 0;

  if (opts.resumeFromCheckpoint) {
    const checkpoint = await getCheckpoint(userId);
    if (checkpoint) {
      startPageToken = checkpoint.pageToken;
      startProgress = checkpoint.progress;
      result.total = startProgress;

      syncLogger.info("Resuming full sync from checkpoint", {
        userId,
        pageToken: startPageToken
          ? `${startPageToken.slice(0, 20)}...`
          : "none",
        progress: startProgress,
        startedAt: checkpoint.startedAt,
      });
    }
  }

  try {
    // Mark sync as in progress
    await syncStateRepository.startSync(userId);

    // Create Gmail client
    const client = createGmailClient(accessToken, userId);

    // Step 1: Get current history ID first (before fetching messages)
    const historyId = await client.getHistoryId();
    result.historyId = historyId;

    // Step 2: Sync labels (only on fresh start)
    if (!startPageToken) {
      await syncLabels(client, userId);

      // Initialize checkpoint
      await saveCheckpoint(userId, {
        pageToken: undefined,
        progress: 0,
        startedAt: new Date(),
      });
    }

    // Step 3: Load sync configuration and build query for message fetching
    const syncState = await syncStateRepository.getOrCreate(userId);
    const syncConfig: SyncConfig = {
      syncLabels: syncState.syncLabels,
      excludeLabels: syncState.excludeLabels,
      maxEmailAgeDays: syncState.maxEmailAgeDays,
    };
    const query = buildSyncQuery(opts, syncConfig);

    // Step 4: Fetch and store messages in batches
    let pageToken: string | undefined = startPageToken;
    let page = 0;

    do {
      onProgress?.({
        phase: "fetching",
        messagesProcessed: result.total,
        currentPage: page + 1,
      });

      // Fetch a page of message IDs
      const listResult = await client.listMessages({
        query,
        maxResults: opts.pageSize,
        pageToken,
        labelIds: opts.labelIds.length > 0 ? opts.labelIds : undefined,
      });

      if (listResult.messages.length === 0) {
        break;
      }

      onProgress?.({
        phase: "storing",
        messagesProcessed: result.total,
        currentPage: page + 1,
      });

      // Fetch full details for each message
      const messages = await fetchMessageBatch(
        client,
        listResult.messages.map((m) => m.id)
      );

      // Store messages in database
      const storeResult = await storeMessages(messages, userId, result.errors);

      result.added += storeResult.created;
      result.updated += storeResult.updated;
      result.total += messages.length;

      // Save checkpoint after each page
      await saveCheckpoint(userId, {
        pageToken: listResult.nextPageToken,
        progress: result.total,
        startedAt: new Date(startTime),
      });

      // Check if we've hit the max emails limit
      if (opts.maxEmails && result.total >= opts.maxEmails) {
        result.hasMore = !!listResult.nextPageToken;
        result.nextPageToken = listResult.nextPageToken;
        break;
      }

      pageToken = listResult.nextPageToken;
      page++;

      // Safety limit to prevent infinite loops
      if (page > FULL_SYNC_MAX_PAGES) {
        syncLogger.warn("Full sync safety limit reached", {
          userId,
          pages: page,
          totalProcessed: result.total,
        });
        result.hasMore = true;
        result.nextPageToken = pageToken;
        break;
      }
    } while (pageToken);

    // Step 5: Complete sync and clear checkpoint
    await syncStateRepository.completeSync(userId, historyId, true);
    await clearCheckpoint(userId);

    // Log audit entry
    await logAuditEntry({
      userId,
      actionType: "create",
      actionCategory: "integration",
      entityType: "email",
      outputSummary: `Full sync completed: ${result.added} added, ${result.updated} updated, ${result.total} total`,
      metadata: {
        source: "gmail",
        syncType: "full",
        resumed: !!startPageToken,
        stats: {
          added: result.added,
          updated: result.updated,
          total: result.total,
          errors: result.errors.length,
        },
        historyId,
      },
    });

    result.durationMs = Date.now() - startTime;

    onProgress?.({
      phase: "complete",
      messagesProcessed: result.total,
      currentPage: page,
    });

    return result;
  } catch (error) {
    result.durationMs = Date.now() - startTime;

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Mark sync as failed but preserve checkpoint for resumption
    await syncStateRepository.failSync(userId, errorMessage);

    // Log error to audit
    await logAuditEntry({
      userId,
      actionType: "create",
      actionCategory: "integration",
      entityType: "email",
      outputSummary: `Full sync failed: ${errorMessage}`,
      status: "failed",
      errorMessage,
      metadata: {
        source: "gmail",
        syncType: "full",
        checkpointSaved: true,
        partialStats: {
          added: result.added,
          updated: result.updated,
          total: result.total,
        },
      },
    });

    // Re-throw Gmail errors
    if (error instanceof GmailError) {
      throw error;
    }

    throw new GmailError(
      GmailErrorCode.UNKNOWN,
      `Full sync failed: ${errorMessage}`,
      false
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: Progress Type
// ─────────────────────────────────────────────────────────────

export interface FullSyncProgress {
  phase: "fetching" | "storing" | "complete";
  messagesProcessed: number;
  messagesTotal?: number;
  currentPage: number;
  pagesTotal?: number;
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Sync Gmail labels to database
 */
async function syncLabels(client: GmailClient, userId: string): Promise<void> {
  const labels = await client.listLabels();
  const labelInputs = mapGmailLabelsToEmailLabels(
    labels as GmailLabel[],
    userId
  );
  await labelRepository.upsertMany(labelInputs);
}

/**
 * Build Gmail search query from options
 */
interface SyncConfig {
  syncLabels?: string[];
  excludeLabels?: string[];
  maxEmailAgeDays?: number | null;
}

function buildSyncQuery(
  options: Omit<Required<FullSyncOptions>, "afterDate"> & { afterDate?: Date },
  config?: SyncConfig
): string | undefined {
  const parts: string[] = [];

  // Filter by date if specified in options
  if (options.afterDate) {
    const dateStr = formatGmailDate(options.afterDate);
    parts.push(`after:${dateStr}`);
  }
  // Or use maxEmailAgeDays from sync config
  else if (config?.maxEmailAgeDays && config.maxEmailAgeDays > 0) {
    const afterDate = new Date();
    afterDate.setDate(afterDate.getDate() - config.maxEmailAgeDays);
    const dateStr = formatGmailDate(afterDate);
    parts.push(`after:${dateStr}`);
  }

  // Include only specific labels if configured
  if (config?.syncLabels && config.syncLabels.length > 0) {
    const labelParts = config.syncLabels.map((l) => `label:${l}`);
    parts.push(`(${labelParts.join(" OR ")})`);
  }

  // Exclude specific labels if configured
  if (config?.excludeLabels && config.excludeLabels.length > 0) {
    config.excludeLabels.forEach((l) => {
      parts.push(`-label:${l}`);
    });
  }

  // Exclude drafts by default (they're handled separately)
  parts.push("-in:drafts");

  return parts.length > 0 ? parts.join(" ") : undefined;
}

/**
 * Format a date for Gmail search query
 */
function formatGmailDate(date: Date): string {
  return date.toISOString().split("T")[0].replace(/-/g, "/");
}

/**
 * Fetch full message details for a batch of message IDs
 */
async function fetchMessageBatch(
  client: GmailClient,
  messageIds: string[]
): Promise<ParsedGmailMessage[]> {
  const messages: ParsedGmailMessage[] = [];

  for (let i = 0; i < messageIds.length; i += MESSAGE_FETCH_CONCURRENCY) {
    const batch = messageIds.slice(i, i + MESSAGE_FETCH_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((id) =>
        client.getMessage(id, { format: "full" }).catch((error) => {
          syncLogger.warn("Failed to fetch message", {
            messageId: id,
            error: error instanceof Error ? error.message : String(error),
          });
          return null;
        })
      )
    );

    messages.push(
      ...batchResults.filter((m): m is ParsedGmailMessage => m !== null)
    );
  }

  return messages;
}

/**
 * Store messages in the database
 *
 * Uses optimistic create-first pattern: attempt to create, fall back to upsert
 * on unique constraint error. This handles race conditions when concurrent syncs
 * try to store the same message simultaneously.
 */
async function storeMessages(
  messages: ParsedGmailMessage[],
  userId: string,
  errors: EmailSyncError[]
): Promise<{ created: number; updated: number; emailIds: string[] }> {
  let created = 0;
  let updated = 0;
  const newEmailIds: string[] = [];

  // Map messages to email inputs
  const emailInputs = messages.map((msg) =>
    mapGmailMessageToEmail(msg, userId)
  );

  for (const input of emailInputs) {
    try {
      // Attempt create first (optimistic - assumes most messages are new)
      const email = await emailRepository.create(input);
      created++;
      newEmailIds.push(email.id);
    } catch (error) {
      // If email already exists (unique constraint), upsert instead
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        try {
          await emailRepository.upsert(input);
          updated++;
        } catch (upsertError) {
          const errorMessage =
            upsertError instanceof Error
              ? upsertError.message
              : "Unknown error";
          errors.push({
            messageId: input.gmailId,
            threadId: input.threadId,
            message: errorMessage,
            code: "STORE_ERROR",
            retryable: false,
          });
        }
      } else {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        errors.push({
          messageId: input.gmailId,
          threadId: input.threadId,
          message: errorMessage,
          code: "STORE_ERROR",
          retryable: false,
        });
      }
    }
  }

  // Queue embedding generation for new emails (in batches)
  if (newEmailIds.length > 0) {
    try {
      await queueFullSyncEmbeddings(userId, newEmailIds);
    } catch (error) {
      syncLogger.warn("Failed to queue embeddings", {
        userId,
        emailCount: newEmailIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail the sync if embedding queue fails
    }
  }

  return { created, updated, emailIds: newEmailIds };
}

// ─────────────────────────────────────────────────────────────
// Checkpoint Management
// ─────────────────────────────────────────────────────────────

/**
 * Get the current checkpoint for a user's full sync
 */
export async function getCheckpoint(
  userId: string
): Promise<FullSyncCheckpoint | null> {
  const syncState = await db.gmailSyncState.findUnique({
    where: { userId },
    select: {
      fullSyncPageToken: true,
      fullSyncProgress: true,
      fullSyncStartedAt: true,
    },
  });

  if (!syncState?.fullSyncStartedAt) {
    return null;
  }

  return {
    pageToken: syncState.fullSyncPageToken ?? undefined,
    progress: syncState.fullSyncProgress,
    startedAt: syncState.fullSyncStartedAt,
  };
}

/**
 * Save a checkpoint for resumable full sync
 */
export async function saveCheckpoint(
  userId: string,
  checkpoint: FullSyncCheckpoint
): Promise<void> {
  await db.gmailSyncState.upsert({
    where: { userId },
    create: {
      user: { connect: { id: userId } },
      fullSyncPageToken: checkpoint.pageToken,
      fullSyncProgress: checkpoint.progress,
      fullSyncStartedAt: checkpoint.startedAt,
    },
    update: {
      fullSyncPageToken: checkpoint.pageToken,
      fullSyncProgress: checkpoint.progress,
      fullSyncStartedAt: checkpoint.startedAt,
    },
  });
}

/**
 * Clear the checkpoint after successful sync completion
 */
export async function clearCheckpoint(userId: string): Promise<void> {
  await db.gmailSyncState.update({
    where: { userId },
    data: {
      fullSyncPageToken: null,
      fullSyncProgress: 0,
      fullSyncStartedAt: null,
    },
  });
}

/**
 * Check if a user has a pending checkpoint
 */
export async function hasCheckpoint(userId: string): Promise<boolean> {
  const checkpoint = await getCheckpoint(userId);
  return checkpoint !== null && checkpoint.pageToken !== undefined;
}

// ─────────────────────────────────────────────────────────────
// Resume Full Sync
// ─────────────────────────────────────────────────────────────

/**
 * Resume a full sync from a saved checkpoint
 * Used when a sync was interrupted
 */
export async function resumeFullSync(
  userId: string,
  accessToken: string,
  options: FullSyncOptions = {}
): Promise<EmailSyncResult> {
  syncLogger.info("Resuming full sync from checkpoint", { userId });

  return fullSync(userId, accessToken, {
    ...options,
    resumeFromCheckpoint: true,
  });
}

/**
 * Resume a full sync from a specific page token (explicit)
 * Used when manually resuming with a known page token
 */
export async function resumeFullSyncFromToken(
  userId: string,
  accessToken: string,
  pageToken: string,
  options: FullSyncOptions = {}
): Promise<EmailSyncResult> {
  syncLogger.info("Resuming full sync from explicit page token", {
    userId,
    pageToken: pageToken.slice(0, 20) + "...",
  });

  // Save the page token as a checkpoint first
  await saveCheckpoint(userId, {
    pageToken,
    progress: 0, // Unknown progress when explicitly providing token
    startedAt: new Date(),
  });

  return fullSync(userId, accessToken, {
    ...options,
    resumeFromCheckpoint: true,
  });
}
