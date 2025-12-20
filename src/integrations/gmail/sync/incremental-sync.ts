// ═══════════════════════════════════════════════════════════════════════════
// Gmail Incremental Sync
// Delta updates using Gmail History API
// ═══════════════════════════════════════════════════════════════════════════

import { createGmailClient, GmailClient } from "../client";
import { emailRepository, syncStateRepository } from "../repository";
import { mapGmailMessageToEmail } from "../mappers";
import { GmailError, GmailErrorCode } from "../errors";
import { logAuditEntry } from "@/services/audit";
import { addJob, QUEUE_NAMES } from "@/lib/queue";
import { JOB_NAMES } from "@/lib/queue/jobs";
import { deleteEmailEmbeddings } from "../embeddings";
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

    // Get starting history ID
    let startHistoryId = opts.startHistoryId;
    if (!startHistoryId) {
      const syncState = await syncStateRepository.get(userId);
      startHistoryId = syncState.historyId || "";

      if (!startHistoryId) {
        // No history ID means we need a full sync first
        throw new GmailError(
          GmailErrorCode.INVALID_REQUEST,
          "No history ID found. A full sync is required first.",
          false
        );
      }
    }

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

    // Process history changes
    const processResult = await processHistoryChanges(
      client,
      userId,
      history,
      result.errors
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

/**
 * Process history changes and update database
 */
async function processHistoryChanges(
  client: GmailClient,
  userId: string,
  history: GmailHistory[],
  errors: EmailSyncError[]
): Promise<{
  added: number;
  updated: number;
  deleted: number;
}> {
  const stats = { added: 0, updated: 0, deleted: 0 };
  const newEmailIds: string[] = [];
  const deletedEmailIds: string[] = [];

  // Collect unique message IDs for each operation type
  const messagesToAdd = new Set<string>();
  const messagesToDelete = new Set<string>();
  const messagesToUpdate = new Set<string>();

  for (const entry of history) {
    // Messages added
    if (entry.messagesAdded) {
      for (const item of entry.messagesAdded) {
        if (item.message?.id) {
          messagesToAdd.add(item.message.id);
          // Remove from delete set if it was added back
          messagesToDelete.delete(item.message.id);
        }
      }
    }

    // Messages deleted
    if (entry.messagesDeleted) {
      for (const item of entry.messagesDeleted) {
        if (item.message?.id) {
          messagesToDelete.add(item.message.id);
          // Remove from add set if it was deleted
          messagesToAdd.delete(item.message.id);
        }
      }
    }

    // Labels added/removed (updates)
    if (entry.labelsAdded) {
      for (const item of entry.labelsAdded) {
        if (item.message?.id && !messagesToAdd.has(item.message.id)) {
          messagesToUpdate.add(item.message.id);
        }
      }
    }

    if (entry.labelsRemoved) {
      for (const item of entry.labelsRemoved) {
        if (item.message?.id && !messagesToAdd.has(item.message.id)) {
          messagesToUpdate.add(item.message.id);
        }
      }
    }
  }

  // Process deletions (need to get email IDs before deleting)
  if (messagesToDelete.size > 0) {
    // First, get the internal email IDs for embedding cleanup
    for (const gmailId of messagesToDelete) {
      const email = await emailRepository.findByGmailId(gmailId);
      if (email) {
        deletedEmailIds.push(email.id);
      }
    }

    stats.deleted = await emailRepository.deleteMany(
      Array.from(messagesToDelete)
    );

    // Delete embeddings for removed emails
    if (deletedEmailIds.length > 0) {
      try {
        await deleteEmailEmbeddings(userId, deletedEmailIds);
      } catch (error) {
        console.warn(
          `[IncrementalSync] Failed to delete embeddings for ${deletedEmailIds.length} emails:`,
          error
        );
      }
    }
  }

  // Process additions
  if (messagesToAdd.size > 0) {
    const messages = await fetchMessageBatch(
      client,
      Array.from(messagesToAdd),
      errors
    );

    for (const message of messages) {
      try {
        const input = mapGmailMessageToEmail(message, userId);
        const email = await emailRepository.create(input);
        stats.added++;
        newEmailIds.push(email.id);
      } catch (error) {
        // If email already exists, update instead
        if (
          error instanceof Error &&
          error.message.includes("Unique constraint")
        ) {
          const input = mapGmailMessageToEmail(message, userId);
          await emailRepository.upsert(input);
          stats.updated++;
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
  }

  // Process updates (fetch fresh data and update)
  if (messagesToUpdate.size > 0) {
    const messages = await fetchMessageBatch(
      client,
      Array.from(messagesToUpdate),
      errors
    );

    for (const message of messages) {
      try {
        const input = mapGmailMessageToEmail(message, userId);
        await emailRepository.upsert(input);
        stats.updated++;
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
  }

  // Queue embedding generation for new emails
  if (newEmailIds.length > 0) {
    try {
      await queueEmailEmbeddings(userId, newEmailIds);
    } catch (error) {
      console.warn(
        `[IncrementalSync] Failed to queue embeddings for ${newEmailIds.length} emails:`,
        error
      );
    }
  }

  return stats;
}

/**
 * Queue embedding generation jobs for emails
 */
async function queueEmailEmbeddings(
  userId: string,
  emailIds: string[]
): Promise<void> {
  // For incremental sync, we typically have fewer emails
  // so we can queue individual jobs or smaller batches
  const batchSize = 10;

  for (let i = 0; i < emailIds.length; i += batchSize) {
    const batch = emailIds.slice(i, i + batchSize);

    await addJob(
      QUEUE_NAMES.EMBEDDINGS,
      JOB_NAMES.BULK_EMAIL_EMBED,
      { userId, emailIds: batch },
      {
        priority: 5, // Slightly higher priority for incremental
      }
    );
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
  const concurrency = 10;

  for (let i = 0; i < messageIds.length; i += concurrency) {
    const batch = messageIds.slice(i, i + concurrency);
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
