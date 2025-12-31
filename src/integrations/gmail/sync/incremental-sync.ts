// ═══════════════════════════════════════════════════════════════════════════
// Gmail Incremental Sync
// Delta updates using Gmail History API
// ═══════════════════════════════════════════════════════════════════════════

import { createGmailClient, GmailClient } from "../client";
import { emailRepository, syncStateRepository } from "../repository";
import { mapGmailMessageToEmail } from "../mappers";
import { GmailError, GmailErrorCode } from "../errors";
import { syncLogger } from "../logger";
import { MESSAGE_FETCH_CONCURRENCY } from "../constants";
import { queueIncrementalSyncEmbeddings } from "./utils";
import { deleteEmailEmbeddings } from "../embeddings";
import { logAuditEntry } from "@/services/audit";
import type { ParsedGmailMessage, GmailHistory } from "../types";
import type {
  EmailSyncResult,
  EmailSyncError,
  IncrementalSyncOptions,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Default Options
// ─────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<IncrementalSyncOptions> = {
  startHistoryId: "",
  labelIds: [],
  maxHistoryEntries: 500,
};

// ─────────────────────────────────────────────────────────────
// Incremental Sync Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Perform an incremental sync using Gmail History API
 *
 * This function:
 * 1. Gets the stored history ID from sync state
 * 2. Fetches history changes since that ID
 * 3. Processes added, deleted, and label-changed messages
 * 4. Updates the database accordingly
 * 5. Stores the new history ID
 *
 * @param userId - The user ID to sync for
 * @param accessToken - OAuth2 access token
 * @param options - Sync options
 * @param onProgress - Optional progress callback
 * @returns Incremental sync result with statistics
 */
export async function incrementalSync(
  userId: string,
  accessToken: string,
  options: IncrementalSyncOptions = {},
  onProgress?: (progress: IncrementalSyncProgress) => void
): Promise<EmailSyncResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const result: EmailSyncResult = {
    syncType: "incremental",
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

  try {
    // Mark sync as in progress
    await syncStateRepository.startSync(userId);

    // Create Gmail client
    const client = createGmailClient(accessToken, userId);

    // Get sync state (contains history ID and sync configuration)
    const syncState = await syncStateRepository.get(userId);
    const startHistoryId = opts.startHistoryId || syncState.historyId || "";

    if (!startHistoryId) {
      // No history ID means we need a full sync first
      throw new GmailError(
        GmailErrorCode.INVALID_REQUEST,
        "No history ID found. A full sync is required first.",
        false
      );
    }

    // Verify sync is configured (opt-in model - labels must be selected)
    if (!syncState.syncConfigured) {
      syncLogger.info("Skipping incremental sync - sync not configured", {
        userId,
      });

      // Return empty result - no emails should sync
      result.durationMs = Date.now() - startTime;
      result.unchanged = 1;
      return result;
    }

    // If no labels are selected, skip syncing new emails
    if (!syncState.syncLabels || syncState.syncLabels.length === 0) {
      syncLogger.info("Skipping incremental sync - no labels selected", {
        userId,
      });

      result.durationMs = Date.now() - startTime;
      result.unchanged = 1;
      return result;
    }

    // Build sync config from sync state
    const syncConfig: SyncConfig = {
      syncLabels: syncState.syncLabels,
      excludeLabels: syncState.excludeLabels,
      maxEmailAgeDays: syncState.maxEmailAgeDays,
    };

    onProgress?.({
      phase: "fetching-history",
      changesProcessed: 0,
      messagesAdded: 0,
      messagesDeleted: 0,
      labelsChanged: 0,
    });

    // Fetch history changes
    const { history, newHistoryId, hasMore } = await fetchHistory(
      client,
      startHistoryId,
      opts.maxHistoryEntries
    );

    result.historyId = newHistoryId;
    result.hasMore = hasMore;

    if (history.length === 0) {
      // No changes since last sync
      await syncStateRepository.completeSync(userId, newHistoryId, false);
      result.durationMs = Date.now() - startTime;
      result.unchanged = 1; // Indicate we checked but found nothing

      onProgress?.({
        phase: "complete",
        changesProcessed: 0,
        messagesAdded: 0,
        messagesDeleted: 0,
        labelsChanged: 0,
      });

      return result;
    }

    onProgress?.({
      phase: "processing-changes",
      changesProcessed: 0,
      changesTotal: history.length,
      messagesAdded: 0,
      messagesDeleted: 0,
      labelsChanged: 0,
    });

    // Process history changes (with sync config for filtering)
    const processResult = await processHistoryChanges(
      client,
      userId,
      history,
      result.errors,
      syncConfig
    );

    result.added = processResult.added;
    result.updated = processResult.updated;
    result.deleted = processResult.deleted;
    result.total =
      processResult.added + processResult.updated + processResult.deleted;

    // Complete sync
    await syncStateRepository.completeSync(userId, newHistoryId, false);

    // Log audit entry
    await logAuditEntry({
      userId,
      actionType: "update",
      actionCategory: "integration",
      entityType: "email",
      outputSummary: `Incremental sync: +${result.added} -${result.deleted} ~${result.updated}`,
      metadata: {
        source: "gmail",
        syncType: "incremental",
        stats: {
          added: result.added,
          updated: result.updated,
          deleted: result.deleted,
          historyEntries: history.length,
          errors: result.errors.length,
        },
        startHistoryId,
        newHistoryId,
      },
    });

    result.durationMs = Date.now() - startTime;

    onProgress?.({
      phase: "complete",
      changesProcessed: history.length,
      messagesAdded: result.added,
      messagesDeleted: result.deleted,
      labelsChanged: result.updated,
    });

    return result;
  } catch (error) {
    result.durationMs = Date.now() - startTime;

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    // Check for history expired error
    if (
      error instanceof GmailError &&
      (error.code === GmailErrorCode.INVALID_REQUEST ||
        errorMessage.includes("historyId"))
    ) {
      // History has expired, need a full sync
      await syncStateRepository.failSync(
        userId,
        "History expired. Full sync required."
      );

      throw new GmailError(
        GmailErrorCode.INVALID_REQUEST,
        "Gmail history has expired. A full sync is required.",
        false
      );
    }

    // Mark sync as failed
    await syncStateRepository.failSync(userId, errorMessage);

    // Re-throw Gmail errors
    if (error instanceof GmailError) {
      throw error;
    }

    throw new GmailError(
      GmailErrorCode.UNKNOWN,
      `Incremental sync failed: ${errorMessage}`,
      false
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Progress Type
// ─────────────────────────────────────────────────────────────

export interface IncrementalSyncProgress {
  phase: "fetching-history" | "processing-changes" | "complete";
  changesProcessed: number;
  changesTotal?: number;
  messagesAdded: number;
  messagesDeleted: number;
  labelsChanged: number;
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Fetch history changes from Gmail
 */
async function fetchHistory(
  client: GmailClient,
  startHistoryId: string,
  maxEntries: number
): Promise<{
  history: GmailHistory[];
  newHistoryId: string;
  hasMore: boolean;
}> {
  const allHistory: GmailHistory[] = [];
  let pageToken: string | undefined;
  let newHistoryId = startHistoryId;
  let hasMore = false;

  try {
    do {
      const response = await client.listHistory({
        startHistoryId,
        pageToken,
        maxResults: 100,
        historyTypes: [
          "messageAdded",
          "messageDeleted",
          "labelAdded",
          "labelRemoved",
        ],
      });

      if (response.history) {
        allHistory.push(...response.history);
      }

      if (response.historyId) {
        newHistoryId = response.historyId;
      }

      pageToken = response.nextPageToken;

      // Check if we've hit the limit
      if (allHistory.length >= maxEntries) {
        hasMore = !!pageToken;
        break;
      }
    } while (pageToken);

    return { history: allHistory, newHistoryId, hasMore };
  } catch (error) {
    // If history is not found (expired), throw a specific error
    if (
      error instanceof Error &&
      (error.message.includes("404") || error.message.includes("historyId"))
    ) {
      throw new GmailError(
        GmailErrorCode.INVALID_REQUEST,
        "Gmail history not found. It may have expired.",
        false
      );
    }
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────
// History Change Types
// ─────────────────────────────────────────────────────────────

/**
 * Categorized message IDs from history entries
 */
interface CategorizedChanges {
  messagesToAdd: Set<string>;
  messagesToDelete: Set<string>;
  messagesToUpdate: Set<string>;
}

/**
 * Result of processing a category of changes
 */
interface ProcessingResult {
  count: number;
  emailIds: string[];
}

// ─────────────────────────────────────────────────────────────
// History Processing - Main Entry Point
// ─────────────────────────────────────────────────────────────

/**
 * Process history changes and update database
 *
 * Orchestrates the processing of Gmail history changes:
 * 1. Categorizes changes (add/delete/update)
 * 2. Processes deletions (and cleans up embeddings)
 * 3. Processes additions (and queues embeddings)
 * 4. Processes label updates
 */
async function processHistoryChanges(
  client: GmailClient,
  userId: string,
  history: GmailHistory[],
  errors: EmailSyncError[],
  syncConfig?: SyncConfig
): Promise<{
  added: number;
  updated: number;
  deleted: number;
}> {
  // Step 1: Categorize changes from history
  const changes = categorizeHistoryChanges(history);

  // Step 2: Process deletions
  const deleteResult = await processDeletions(
    userId,
    changes.messagesToDelete,
    errors
  );

  // Step 3: Process additions (with sync config filtering)
  const addResult = await processAdditions(
    client,
    userId,
    changes.messagesToAdd,
    errors,
    syncConfig
  );

  // Step 4: Process updates (label changes)
  const updateResult = await processUpdates(
    client,
    userId,
    changes.messagesToUpdate,
    errors
  );

  // Step 5: Queue embeddings for new emails
  if (addResult.emailIds.length > 0) {
    await safeQueueEmbeddings(userId, addResult.emailIds);
  }

  return {
    added: addResult.count,
    updated: updateResult.count,
    deleted: deleteResult.count,
  };
}

// ─────────────────────────────────────────────────────────────
// History Processing - Categorization
// ─────────────────────────────────────────────────────────────

/**
 * Categorize history changes into add/delete/update sets
 *
 * Handles deduplication and conflict resolution:
 * - If a message is added then deleted, it's only deleted
 * - If a message is deleted then added, it's only added
 * - Label changes on new messages are ignored (handled by add)
 */
function categorizeHistoryChanges(history: GmailHistory[]): CategorizedChanges {
  const messagesToAdd = new Set<string>();
  const messagesToDelete = new Set<string>();
  const messagesToUpdate = new Set<string>();

  for (const entry of history) {
    // Process added messages
    if (entry.messagesAdded) {
      for (const item of entry.messagesAdded) {
        if (item.message?.id) {
          messagesToAdd.add(item.message.id);
          // Remove from delete set if it was re-added
          messagesToDelete.delete(item.message.id);
        }
      }
    }

    // Process deleted messages
    if (entry.messagesDeleted) {
      for (const item of entry.messagesDeleted) {
        if (item.message?.id) {
          messagesToDelete.add(item.message.id);
          // Remove from add set if it was deleted
          messagesToAdd.delete(item.message.id);
        }
      }
    }

    // Process label additions (only for existing messages)
    if (entry.labelsAdded) {
      for (const item of entry.labelsAdded) {
        if (item.message?.id && !messagesToAdd.has(item.message.id)) {
          messagesToUpdate.add(item.message.id);
        }
      }
    }

    // Process label removals (only for existing messages)
    if (entry.labelsRemoved) {
      for (const item of entry.labelsRemoved) {
        if (item.message?.id && !messagesToAdd.has(item.message.id)) {
          messagesToUpdate.add(item.message.id);
        }
      }
    }
  }

  // Remove updates for messages that will be deleted
  for (const id of messagesToDelete) {
    messagesToUpdate.delete(id);
  }

  return { messagesToAdd, messagesToDelete, messagesToUpdate };
}

// ─────────────────────────────────────────────────────────────
// History Processing - Deletions
// ─────────────────────────────────────────────────────────────

/**
 * Process message deletions
 *
 * 1. Looks up internal email IDs for embedding cleanup
 * 2. Deletes emails from database
 * 3. Cleans up associated embeddings
 */
async function processDeletions(
  userId: string,
  messagesToDelete: Set<string>,
  _errors: EmailSyncError[]
): Promise<ProcessingResult> {
  if (messagesToDelete.size === 0) {
    return { count: 0, emailIds: [] };
  }

  const deletedEmailIds: string[] = [];

  // Get internal email IDs for embedding cleanup
  for (const gmailId of messagesToDelete) {
    const email = await emailRepository.findByGmailId(gmailId);
    if (email) {
      deletedEmailIds.push(email.id);
    }
  }

  // Delete from database
  const deletedCount = await emailRepository.deleteMany(
    Array.from(messagesToDelete)
  );

  // Clean up embeddings
  if (deletedEmailIds.length > 0) {
    try {
      await deleteEmailEmbeddings(userId, deletedEmailIds);
    } catch (error) {
      syncLogger.warn("Failed to delete embeddings for removed emails", {
        userId,
        emailCount: deletedEmailIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { count: deletedCount, emailIds: deletedEmailIds };
}

// ─────────────────────────────────────────────────────────────
// History Processing - Additions
// ─────────────────────────────────────────────────────────────

/**
 * Process new message additions
 *
 * 1. Fetches full message details from Gmail
 * 2. Creates new email records in database
 * 3. Falls back to upsert on unique constraint errors
 */
interface SyncConfig {
  syncLabels?: string[];
  excludeLabels?: string[];
  maxEmailAgeDays?: number | null;
}

/**
 * Check if a message should be included based on sync configuration
 */
function shouldIncludeMessage(
  message: ParsedGmailMessage,
  config?: SyncConfig
): boolean {
  if (!config) return true;

  const labelIds = message.labelIds || [];

  // Filter by syncLabels - if specified, message must have at least one
  if (config.syncLabels && config.syncLabels.length > 0) {
    const hasRequiredLabel = config.syncLabels.some((l) =>
      labelIds.includes(l)
    );
    if (!hasRequiredLabel) return false;
  }

  // Filter by excludeLabels - message must not have any
  if (config.excludeLabels && config.excludeLabels.length > 0) {
    const hasExcludedLabel = config.excludeLabels.some((l) =>
      labelIds.includes(l)
    );
    if (hasExcludedLabel) return false;
  }

  // Filter by maxEmailAgeDays
  if (
    config.maxEmailAgeDays &&
    config.maxEmailAgeDays > 0 &&
    message.internalDate
  ) {
    const messageDate = new Date(message.internalDate);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.maxEmailAgeDays);
    if (messageDate < cutoffDate) return false;
  }

  return true;
}

async function processAdditions(
  client: GmailClient,
  userId: string,
  messagesToAdd: Set<string>,
  errors: EmailSyncError[],
  syncConfig?: SyncConfig
): Promise<ProcessingResult> {
  if (messagesToAdd.size === 0) {
    return { count: 0, emailIds: [] };
  }

  const newEmailIds: string[] = [];
  let addedCount = 0;

  // Fetch full message details
  const messages = await fetchMessageBatch(
    client,
    Array.from(messagesToAdd),
    errors
  );

  // Store each message (after filtering by sync config)
  for (const message of messages) {
    // Skip messages that don't match sync configuration
    if (!shouldIncludeMessage(message, syncConfig)) {
      continue;
    }

    try {
      const input = mapGmailMessageToEmail(message, userId);
      const email = await emailRepository.create(input);
      addedCount++;
      newEmailIds.push(email.id);
    } catch (error) {
      // Handle unique constraint (race condition or duplicate)
      if (
        error instanceof Error &&
        error.message.includes("Unique constraint")
      ) {
        const input = mapGmailMessageToEmail(message, userId);
        await emailRepository.upsert(input);
        // Don't count as added since it already existed
      } else {
        errors.push({
          messageId: message.id,
          threadId: message.threadId,
          message: error instanceof Error ? error.message : "Unknown error",
          code: "ADD_ERROR",
          retryable: false,
        });
      }
    }
  }

  return { count: addedCount, emailIds: newEmailIds };
}

// ─────────────────────────────────────────────────────────────
// History Processing - Updates
// ─────────────────────────────────────────────────────────────

/**
 * Process label updates for existing messages
 *
 * 1. Fetches fresh message details from Gmail
 * 2. Upserts the updated data to database
 */
async function processUpdates(
  client: GmailClient,
  userId: string,
  messagesToUpdate: Set<string>,
  errors: EmailSyncError[]
): Promise<ProcessingResult> {
  if (messagesToUpdate.size === 0) {
    return { count: 0, emailIds: [] };
  }

  let updatedCount = 0;

  // Fetch fresh message details
  const messages = await fetchMessageBatch(
    client,
    Array.from(messagesToUpdate),
    errors
  );

  // Update each message
  for (const message of messages) {
    try {
      const input = mapGmailMessageToEmail(message, userId);
      await emailRepository.upsert(input);
      updatedCount++;
    } catch (error) {
      errors.push({
        messageId: message.id,
        threadId: message.threadId,
        message: error instanceof Error ? error.message : "Unknown error",
        code: "UPDATE_ERROR",
        retryable: false,
      });
    }
  }

  return { count: updatedCount, emailIds: [] };
}

// ─────────────────────────────────────────────────────────────
// History Processing - Embedding Queue
// ─────────────────────────────────────────────────────────────

/**
 * Safely queue embeddings for new emails (non-throwing)
 */
async function safeQueueEmbeddings(
  userId: string,
  emailIds: string[]
): Promise<void> {
  try {
    await queueIncrementalSyncEmbeddings(userId, emailIds);
  } catch (error) {
    syncLogger.warn("Failed to queue embeddings for new emails", {
      userId,
      emailCount: emailIds.length,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Fetch full message details for a batch of message IDs
 */
async function fetchMessageBatch(
  client: GmailClient,
  messageIds: string[],
  errors: EmailSyncError[]
): Promise<ParsedGmailMessage[]> {
  const messages: ParsedGmailMessage[] = [];

  for (let i = 0; i < messageIds.length; i += MESSAGE_FETCH_CONCURRENCY) {
    const batch = messageIds.slice(i, i + MESSAGE_FETCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map((id) =>
        client.getMessage(id, { format: "full" }).catch((error) => {
          errors.push({
            messageId: id,
            message: error instanceof Error ? error.message : "Fetch failed",
            code: "FETCH_ERROR",
            retryable: true,
          });
          return null;
        })
      )
    );

    messages.push(
      ...results.filter((m): m is ParsedGmailMessage => m !== null)
    );
  }

  return messages;
}
