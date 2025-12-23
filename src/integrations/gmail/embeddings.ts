// ═══════════════════════════════════════════════════════════════════════════
// Email Embedding Generation
// Create and manage embeddings for email content for semantic search
// ═══════════════════════════════════════════════════════════════════════════

import type { Email } from "@prisma/client";
import { getEmbeddingService } from "@/lib/embeddings";
import { emailRepository } from "./repository";
import { embeddingsLogger } from "./logger";
import {
  EMBEDDING_MAX_BODY_LENGTH,
  EMBEDDING_BATCH_DELAY_MS,
  MIN_CONTENT_LENGTH_FOR_EMBEDDING,
  SYSTEM_LABELS_TO_FILTER,
} from "./constants";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Entity type for emails in the embedding system */
export const EMAIL_ENTITY_TYPE = "email" as const;

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** Result of email embedding generation */
export interface EmailEmbeddingResult {
  emailId: string;
  success: boolean;
  error?: string;
}

/** Bulk embedding result */
export interface BulkEmailEmbeddingResult {
  total: number;
  succeeded: number;
  failed: number;
  results: EmailEmbeddingResult[];
}

/** Email metadata stored with embeddings */
export interface EmailEmbeddingMetadata {
  gmailId: string;
  subject?: string;
  fromEmail: string;
  fromName?: string;
  toEmails: string[];
  threadId: string;
  internalDate: string;
  labelIds: string[];
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  hasAttachments: boolean;
}

// ─────────────────────────────────────────────────────────────
// Content Building
// ─────────────────────────────────────────────────────────────

/**
 * Build searchable content from email for embedding generation
 *
 * Combines subject, sender info, snippet, and body text into
 * a single string optimized for semantic search.
 */
export function buildEmailContent(email: Email): string {
  const parts: string[] = [];

  // Subject is most important for semantic meaning
  if (email.subject) {
    parts.push(`Subject: ${email.subject}`);
  }

  // Sender information for context
  if (email.fromName) {
    parts.push(`From: ${email.fromName} <${email.fromEmail}>`);
  } else {
    parts.push(`From: ${email.fromEmail}`);
  }

  // Recipients for context
  if (email.toEmails && email.toEmails.length > 0) {
    parts.push(`To: ${email.toEmails.join(", ")}`);
  }

  // Snippet provides a summary
  if (email.snippet) {
    parts.push(`Summary: ${email.snippet}`);
  }

  // Body text (truncated to manage token costs)
  if (email.bodyText) {
    const bodyContent = email.bodyText.slice(0, EMBEDDING_MAX_BODY_LENGTH);
    parts.push(`Content: ${bodyContent}`);
    if (email.bodyText.length > EMBEDDING_MAX_BODY_LENGTH) {
      parts.push("...[truncated]");
    }
  }

  // Labels provide useful context
  if (email.labelIds && email.labelIds.length > 0) {
    // Filter out common system labels for cleaner search
    const meaningfulLabels = email.labelIds.filter(
      (label) => !(SYSTEM_LABELS_TO_FILTER as readonly string[]).includes(label)
    );
    if (meaningfulLabels.length > 0) {
      parts.push(`Labels: ${meaningfulLabels.join(", ")}`);
    }
  }

  return parts.join("\n\n");
}

/**
 * Build metadata object for email embedding storage
 */
export function buildEmailMetadata(email: Email): EmailEmbeddingMetadata {
  return {
    gmailId: email.gmailId,
    subject: email.subject ?? undefined,
    fromEmail: email.fromEmail,
    fromName: email.fromName ?? undefined,
    toEmails: email.toEmails,
    threadId: email.threadId,
    internalDate: email.internalDate.toISOString(),
    labelIds: email.labelIds,
    isRead: email.isRead,
    isStarred: email.isStarred,
    isImportant: email.isImportant,
    hasAttachments: email.hasAttachments,
  };
}

// ─────────────────────────────────────────────────────────────
// Single Email Embedding
// ─────────────────────────────────────────────────────────────

/**
 * Generate and store embedding for a single email
 */
export async function generateEmailEmbedding(
  email: Email
): Promise<EmailEmbeddingResult> {
  try {
    const content = buildEmailContent(email);

    // Skip if content is too short to be meaningful
    if (content.trim().length < MIN_CONTENT_LENGTH_FOR_EMBEDDING) {
      return {
        emailId: email.id,
        success: false,
        error: "Content too short, skipped",
      };
    }

    const metadata = buildEmailMetadata(email);
    const embeddingService = getEmbeddingService();

    // Convert metadata to record type for embedding storage
    const metadataRecord: Record<string, unknown> = {
      gmailId: metadata.gmailId,
      subject: metadata.subject,
      fromEmail: metadata.fromEmail,
      fromName: metadata.fromName,
      toEmails: metadata.toEmails,
      threadId: metadata.threadId,
      internalDate: metadata.internalDate,
      labelIds: metadata.labelIds,
      isRead: metadata.isRead,
      isStarred: metadata.isStarred,
      isImportant: metadata.isImportant,
      hasAttachments: metadata.hasAttachments,
    };

    await embeddingService.storeEntityEmbedding(
      email.userId,
      EMAIL_ENTITY_TYPE,
      email.id,
      content,
      metadataRecord
    );

    return {
      emailId: email.id,
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    embeddingsLogger.error(
      "Failed to generate embedding",
      {
        emailId: email.id,
        userId: email.userId,
      },
      error
    );
    return {
      emailId: email.id,
      success: false,
      error: message,
    };
  }
}

/**
 * Generate embedding for an email by its ID
 *
 * Supports both internal database IDs and Gmail IDs for flexibility.
 * Tries internal ID first (most common from sync operations), then Gmail ID.
 */
export async function generateEmailEmbeddingById(
  userId: string,
  emailId: string
): Promise<EmailEmbeddingResult> {
  // First, try to find by our internal database ID (most common case from sync)
  let email = await emailRepository.findByUserAndId(userId, emailId);

  // If not found, it might be a Gmail ID instead of our internal ID
  if (!email) {
    email = await emailRepository.findByUserAndGmailId(userId, emailId);
  }

  if (!email) {
    return {
      emailId,
      success: false,
      error: "Email not found",
    };
  }

  return generateEmailEmbedding(email);
}

// ─────────────────────────────────────────────────────────────
// Bulk Email Embedding
// ─────────────────────────────────────────────────────────────

/**
 * Generate embeddings for multiple emails (throttled to avoid rate limits)
 * 
 * Processes emails sequentially with delays between each API call to prevent
 * hitting OpenAI rate limits. Since this is async background processing,
 * throughput is less critical than reliability.
 */
export async function generateEmailEmbeddings(
  emails: Email[]
): Promise<BulkEmailEmbeddingResult> {
  const results: EmailEmbeddingResult[] = [];
  let succeeded = 0;
  let failed = 0;

  // Process emails sequentially with throttling to avoid rate limits
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    
    try {
      const result = await generateEmailEmbedding(email);
      results.push(result);
      
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    } catch (error) {
      // Catch any unexpected errors to ensure we continue processing
      const message = error instanceof Error ? error.message : "Unknown error";
      results.push({
        emailId: email.id,
        success: false,
        error: message,
      });
      failed++;
    }

    // Throttle between each API call to stay under rate limits
    // Only delay if there are more emails to process
    if (i < emails.length - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, EMBEDDING_BATCH_DELAY_MS)
      );
    }
  }

  embeddingsLogger.debug("Bulk embedding complete", {
    total: emails.length,
    succeeded,
    failed,
    avgDelayMs: EMBEDDING_BATCH_DELAY_MS,
  });

  return {
    total: emails.length,
    succeeded,
    failed,
    results,
  };
}

/**
 * Generate embeddings for a user's emails (with optional limit)
 */
export async function generateUserEmailEmbeddings(
  userId: string,
  options: {
    limit?: number;
    startDate?: Date;
    endDate?: Date;
    labelIds?: string[];
  } = {}
): Promise<BulkEmailEmbeddingResult> {
  const { limit = 100, startDate, endDate, labelIds } = options;

  const result = await emailRepository.search(userId, {
    startDate,
    endDate,
    labelIds,
    limit,
    orderBy: "internalDate",
    orderDirection: "desc",
  });

  return generateEmailEmbeddings(result.emails);
}

// ─────────────────────────────────────────────────────────────
// Embedding Management
// ─────────────────────────────────────────────────────────────

/**
 * Delete embedding for an email
 */
export async function deleteEmailEmbedding(
  userId: string,
  emailId: string
): Promise<void> {
  const embeddingService = getEmbeddingService();
  await embeddingService.deleteEmbeddings(userId, EMAIL_ENTITY_TYPE, emailId);
}

/**
 * Delete embeddings for multiple emails
 */
export async function deleteEmailEmbeddings(
  userId: string,
  emailIds: string[]
): Promise<void> {
  const embeddingService = getEmbeddingService();

  await Promise.all(
    emailIds.map((emailId) =>
      embeddingService.deleteEmbeddings(userId, EMAIL_ENTITY_TYPE, emailId)
    )
  );
}

/**
 * Check if an email needs re-embedding (content changed)
 */
export async function emailNeedsReembedding(email: Email): Promise<boolean> {
  const content = buildEmailContent(email);
  const embeddingService = getEmbeddingService();

  return embeddingService.needsReembedding(
    email.userId,
    EMAIL_ENTITY_TYPE,
    email.id,
    content
  );
}
