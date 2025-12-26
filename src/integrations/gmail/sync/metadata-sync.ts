// ═══════════════════════════════════════════════════════════════════════════
// Gmail Metadata Sync
// Sync labels and contacts without syncing emails
// Used during initial connection to gather metadata before user configures sync
// ═══════════════════════════════════════════════════════════════════════════

import { createGmailClient } from "../client";
import { labelRepository, syncStateRepository } from "../repository";
import { mapGmailLabelsToEmailLabels } from "../mappers";
import { syncLogger } from "../logger";
import { syncContacts } from "./contacts";
import { logAuditEntry } from "@/services/audit";
import type { GmailLabel } from "../types";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface MetadataSyncResult {
  labels: {
    count: number;
    synced: boolean;
  };
  contacts: {
    created: number;
    updated: number;
    total: number;
    synced: boolean;
  };
  durationMs: number;
  error?: string;
}

export interface MetadataSyncProgress {
  phase: "syncing-labels" | "syncing-contacts" | "complete";
  labelsCount?: number;
  contactsProcessed?: number;
}

// ─────────────────────────────────────────────────────────────
// Metadata Sync Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Sync Gmail metadata (labels and contacts) without syncing emails
 *
 * This function is called during initial Gmail connection to:
 * 1. Fetch and store all Gmail labels
 * 2. Sync Google Contacts to Person entities
 * 3. Capture the current history ID for future incremental syncs
 *
 * The user can then configure which labels to sync before any emails are pulled.
 *
 * @param userId - The user ID to sync for
 * @param accessToken - OAuth2 access token
 * @param onProgress - Optional progress callback (can be async)
 * @returns Metadata sync result
 */
export async function syncMetadata(
  userId: string,
  accessToken: string,
  onProgress?: (progress: MetadataSyncProgress) => void | Promise<void>
): Promise<MetadataSyncResult> {
  const startTime = Date.now();

  const result: MetadataSyncResult = {
    labels: {
      count: 0,
      synced: false,
    },
    contacts: {
      created: 0,
      updated: 0,
      total: 0,
      synced: false,
    },
    durationMs: 0,
  };

  try {
    // Create Gmail client
    const client = createGmailClient(accessToken, userId);

    // Step 1: Sync labels
    await onProgress?.({ phase: "syncing-labels" });

    const labels = await client.listLabels();
    const labelInputs = mapGmailLabelsToEmailLabels(
      labels as GmailLabel[],
      userId
    );
    result.labels.count = await labelRepository.upsertMany(labelInputs);
    result.labels.synced = true;

    await onProgress?.({
      phase: "syncing-labels",
      labelsCount: result.labels.count,
    });

    // Step 2: Capture history ID for future syncs (but don't sync emails)
    const historyId = await client.getHistoryId();

    // Step 3: Sync contacts
    await onProgress?.({ phase: "syncing-contacts" });

    try {
      const contactResult = await syncContacts(userId, accessToken);
      result.contacts.created = contactResult.created;
      result.contacts.updated = contactResult.updated;
      result.contacts.total = contactResult.total;
      result.contacts.synced = true;

      await onProgress?.({
        phase: "syncing-contacts",
        contactsProcessed: contactResult.total,
      });
    } catch (contactError) {
      // Log but don't fail if contacts sync fails
      syncLogger.warn("Contact sync failed during metadata sync", {
        userId,
        error:
          contactError instanceof Error
            ? contactError.message
            : String(contactError),
      });
    }

    // Step 4: Update sync state with metadata counts and history ID
    // Note: syncConfigured remains false - user must configure labels
    // Use result.contacts.total for consistency with audit logging
    await syncStateRepository.update(userId, {
      historyId,
      historyIdSetAt: new Date(),
      labelCount: result.labels.count,
      contactCount: result.contacts.total,
      lastSyncAt: new Date(),
      syncStatus: "idle",
      // Do NOT set lastFullSyncAt - no emails have been synced
    });

    // Log audit entry
    await logAuditEntry({
      userId,
      actionType: "create",
      actionCategory: "integration",
      entityType: "integration",
      outputSummary: `Metadata sync completed: ${result.labels.count} labels, ${result.contacts.total} contacts`,
      metadata: {
        source: "gmail",
        syncType: "metadata",
        stats: {
          labels: result.labels.count,
          contactsCreated: result.contacts.created,
          contactsUpdated: result.contacts.updated,
          contactsTotal: result.contacts.total,
        },
        historyId,
      },
    });

    result.durationMs = Date.now() - startTime;

    await onProgress?.({ phase: "complete" });

    syncLogger.info("Metadata sync completed", {
      userId,
      labels: result.labels.count,
      contacts: result.contacts.total,
      durationMs: result.durationMs,
    });

    return result;
  } catch (error) {
    result.durationMs = Date.now() - startTime;
    result.error = error instanceof Error ? error.message : "Unknown error";

    syncLogger.error("Metadata sync failed", { userId }, error);

    // Update sync state to error
    await syncStateRepository.failSync(userId, result.error);

    throw error;
  }
}

/**
 * Check if metadata has been synced for a user
 */
export async function hasMetadataSynced(userId: string): Promise<boolean> {
  const state = await syncStateRepository.get(userId);
  return state.labelCount > 0;
}

/**
 * Check if sync is configured (user has selected labels)
 */
export async function isSyncConfigured(userId: string): Promise<boolean> {
  const state = await syncStateRepository.get(userId);
  return state.syncConfigured;
}

/**
 * Get available labels for sync configuration
 */
export async function getAvailableLabels(userId: string) {
  return labelRepository.findAll(userId);
}

