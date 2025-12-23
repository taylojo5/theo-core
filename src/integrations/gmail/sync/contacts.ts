// ═══════════════════════════════════════════════════════════════════════════
// Contact Sync
// Sync Google Contacts to Person entities
// ═══════════════════════════════════════════════════════════════════════════

import { GmailClient, createGmailClient } from "../client";
import { mapContactToPerson } from "../mappers";
import { syncStateRepository } from "../repository";
import { upsertPeopleFromSource } from "@/services/context/people/people-service";
import { logAuditEntry } from "@/services/audit";
import type { ParsedContact } from "../types";
import type {
  ContactSyncResult,
  ContactSyncError,
  ContactSyncOptions,
} from "./types";
import type { ServiceContext } from "@/services/context/types";
import type { SourcePersonInput } from "@/services/context/people/types";

// ─────────────────────────────────────────────────────────────
// Default Options
// ─────────────────────────────────────────────────────────────

const DEFAULT_OPTIONS: Required<ContactSyncOptions> = {
  maxContacts: 1000,
  requireEmail: true,
  forceUpdate: false,
  includePhotos: true,
  pageSize: 100,
};

// ─────────────────────────────────────────────────────────────
// Contact Sync Functions
// ─────────────────────────────────────────────────────────────

/**
 * Sync Google Contacts to Person entities
 *
 * This function:
 * 1. Fetches all contacts from Google People API
 * 2. Maps them to Person entities
 * 3. Deduplicates by email and source ID
 * 4. Creates new people or updates existing ones
 * 5. Updates sync state with contact count
 *
 * @param userId - The user ID to sync contacts for
 * @param accessToken - OAuth2 access token with contacts.readonly scope
 * @param options - Sync options
 * @param context - Optional service context for audit logging
 * @returns Contact sync result with statistics
 */
export async function syncContacts(
  userId: string,
  accessToken: string,
  options: ContactSyncOptions = {},
  context?: ServiceContext
): Promise<ContactSyncResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const result: ContactSyncResult = {
    created: 0,
    updated: 0,
    unchanged: 0,
    skipped: 0,
    total: 0,
    errors: [],
    durationMs: 0,
    createdPeople: [],
    updatedPeople: [],
  };

  try {
    // Create Gmail client (also handles People API)
    const client = createGmailClient(accessToken, userId);

    // Fetch all contacts with pagination
    const contacts = await fetchAllContacts(client, opts);
    result.total = contacts.length;

    // Filter and map contacts to person inputs
    const { personInputs, skipped, errors } = processContacts(
      contacts,
      userId,
      opts
    );
    result.skipped = skipped;
    result.errors = errors;

    if (personInputs.length === 0) {
      result.durationMs = Date.now() - startTime;
      return result;
    }

    // Upsert people using the people service
    const upsertResult = await upsertPeopleFromSource(
      userId,
      "gmail",
      personInputs,
      context,
      { forceUpdate: opts.forceUpdate }
    );

    result.created = upsertResult.created.length;
    result.updated = upsertResult.updated.length;
    result.unchanged = upsertResult.unchanged;
    result.createdPeople = upsertResult.created;
    result.updatedPeople = upsertResult.updated;

    // Update sync state with contact count and last sync timestamp
    await syncStateRepository.update(userId, {
      contactCount: result.created + result.updated + result.unchanged,
      lastSyncAt: new Date(),
    });

    // Log audit entry
    await logAuditEntry({
      userId: context?.userId ?? userId,
      sessionId: context?.sessionId,
      conversationId: context?.conversationId,
      actionType: "update",
      actionCategory: "integration",
      entityType: "person",
      outputSummary: `Synced ${result.total} contacts: ${result.created} created, ${result.updated} updated, ${result.unchanged} unchanged`,
      metadata: {
        source: "gmail",
        syncType: "contacts",
        stats: {
          created: result.created,
          updated: result.updated,
          unchanged: result.unchanged,
          skipped: result.skipped,
          errors: result.errors.length,
        },
      },
    });

    result.durationMs = Date.now() - startTime;
    return result;
  } catch (error) {
    result.durationMs = Date.now() - startTime;

    // Log error
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    result.errors.push({
      resourceName: "sync",
      message: `Sync failed: ${errorMessage}`,
      code: error instanceof Error ? error.name : "UNKNOWN",
    });

    // Update sync state with error
    await syncStateRepository.failSync(userId, errorMessage);

    throw error;
  }
}

/**
 * Fetch all contacts with pagination
 */
async function fetchAllContacts(
  client: GmailClient,
  options: Required<ContactSyncOptions>
): Promise<ParsedContact[]> {
  const allContacts: ParsedContact[] = [];
  let pageToken: string | undefined;

  do {
    const response = await client.listContactsParsed({
      pageSize: options.pageSize,
      pageToken,
      personFields: options.includePhotos
        ? undefined // Use default which includes photos
        : ["names", "emailAddresses", "phoneNumbers", "organizations"],
    });

    allContacts.push(...response.contacts);
    pageToken = response.nextPageToken;

    // Respect max contacts limit
    if (allContacts.length >= options.maxContacts) {
      break;
    }
  } while (pageToken);

  // Trim to max contacts
  return allContacts.slice(0, options.maxContacts);
}

/**
 * Process contacts into person inputs for upsert
 */
function processContacts(
  contacts: ParsedContact[],
  userId: string,
  options: Required<ContactSyncOptions>
): {
  personInputs: SourcePersonInput[];
  skipped: number;
  errors: ContactSyncError[];
} {
  const personInputs: SourcePersonInput[] = [];
  const errors: ContactSyncError[] = [];
  let skipped = 0;

  // Track seen emails to avoid duplicates within the same sync
  const seenEmails = new Set<string>();

  for (const contact of contacts) {
    try {
      // Skip contacts without email if required
      if (options.requireEmail && !contact.email) {
        skipped++;
        continue;
      }

      // Skip contacts without a name and email
      if (!contact.name && !contact.email) {
        skipped++;
        continue;
      }

      // Skip duplicate emails within this sync batch
      if (contact.email) {
        const normalizedEmail = contact.email.toLowerCase();
        if (seenEmails.has(normalizedEmail)) {
          skipped++;
          continue;
        }
        seenEmails.add(normalizedEmail);
      }

      // Map contact to person input
      const mapped = mapContactToPerson(contact, userId);

      personInputs.push({
        sourceId: contact.resourceName,
        data: {
          name: mapped.name,
          email: mapped.email,
          phone: mapped.phone,
          avatarUrl: mapped.avatarUrl,
          company: mapped.company,
          title: mapped.title,
          bio: mapped.bio,
          metadata: mapped.metadata,
          sourceSyncedAt: mapped.sourceSyncedAt,
        },
      });
    } catch (error) {
      errors.push({
        resourceName: contact.resourceName,
        contactName: contact.name,
        message: error instanceof Error ? error.message : "Processing failed",
        code: "PROCESSING_ERROR",
      });
    }
  }

  return { personInputs, skipped, errors };
}

/**
 * Sync contacts for a user using their stored access token
 * This is a convenience wrapper for use with BullMQ jobs
 */
export async function syncContactsForUser(
  userId: string,
  getAccessToken: () => Promise<string>,
  options?: ContactSyncOptions
): Promise<ContactSyncResult> {
  const accessToken = await getAccessToken();
  return syncContacts(userId, accessToken, options);
}

/**
 * Get contact sync status for a user
 */
export async function getContactSyncStatus(userId: string): Promise<{
  contactCount: number;
  lastSyncAt: Date | null;
  status: string;
}> {
  const state = await syncStateRepository.get(userId);
  return {
    contactCount: state.contactCount,
    lastSyncAt: state.lastSyncAt,
    status: state.syncStatus,
  };
}
