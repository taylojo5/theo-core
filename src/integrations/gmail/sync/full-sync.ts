// ═══════════════════════════════════════════════════════════════════════════
// Gmail Full Sync
// Initial import of all emails from Gmail
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
import { logAuditEntry } from "@/services/audit";
import type { ParsedGmailMessage, GmailLabel } from "../types";
import type { EmailSyncResult, EmailSyncError, FullSyncOptions } from "./types";

// ─────────────────────────────────────────────────────────────
// Default Options
// ─────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<FullSyncOptions> = {
  maxEmails: 1000,
  labelIds: [],
  afterDate: undefined as unknown as Date,
  pageSize: 100,
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
 * 5. Updates sync state with new history ID
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

  try {
    // Mark sync as in progress
    await syncStateRepository.startSync(userId);

    // Create Gmail client
    const client = createGmailClient(accessToken, userId);

    // Step 1: Get current history ID first (before fetching messages)
    const historyId = await client.getHistoryId();
    result.historyId = historyId;

    // Step 2: Sync labels
    await syncLabels(client, userId);

    // Step 3: Build query for message fetching
    const query = buildSyncQuery(opts);

    // Step 4: Fetch and store messages in batches
    let pageToken: string | undefined;
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

      // Check if we've hit the max emails limit
      if (opts.maxEmails && result.total >= opts.maxEmails) {
        result.hasMore = !!listResult.nextPageToken;
        break;
      }

      pageToken = listResult.nextPageToken;
      page++;

      // Safety limit to prevent infinite loops
      if (page > 100) {
        console.warn(`[FullSync] Safety limit reached after ${page} pages`);
        result.hasMore = true;
        break;
      }
    } while (pageToken);

    // Step 5: Complete sync
    await syncStateRepository.completeSync(userId, historyId, true);

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

    // Mark sync as failed
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
function buildSyncQuery(
  options: Required<FullSyncOptions>
): string | undefined {
  const parts: string[] = [];

  // Filter by date if specified
  if (options.afterDate) {
    const dateStr = formatGmailDate(options.afterDate);
    parts.push(`after:${dateStr}`);
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
  // Fetch messages in parallel with concurrency limit
  const concurrency = 10;
  const messages: ParsedGmailMessage[] = [];

  for (let i = 0; i < messageIds.length; i += concurrency) {
    const batch = messageIds.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map((id) =>
        client.getMessage(id, { format: "full" }).catch((error) => {
          console.warn(
            `[FullSync] Failed to fetch message ${id}:`,
            error.message
          );
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
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  // Map messages to email inputs
  const emailInputs = messages.map((msg) =>
    mapGmailMessageToEmail(msg, userId)
  );

  for (const input of emailInputs) {
    try {
      // Attempt create first (optimistic - assumes most messages are new)
      await emailRepository.create(input);
      created++;
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

  return { created, updated };
}

// ─────────────────────────────────────────────────────────────
// Resume Full Sync
// ─────────────────────────────────────────────────────────────

/**
 * Resume a full sync from a specific page token
 * Used when a sync was interrupted
 */
export async function resumeFullSync(
  userId: string,
  accessToken: string,
  pageToken: string,
  options: FullSyncOptions = {}
): Promise<EmailSyncResult> {
  // For now, we don't support true resumption
  // We'll restart the sync with the page token
  // A more robust implementation would track sync progress in the database
  console.log(
    `[FullSync] Resuming sync for user ${userId} from page ${pageToken}`
  );

  return fullSync(userId, accessToken, options);
}
