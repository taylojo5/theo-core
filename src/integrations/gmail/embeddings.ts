// ═══════════════════════════════════════════════════════════════════════════
// Email Embedding Generation
// Create and manage embeddings for email content for semantic search
// ═══════════════════════════════════════════════════════════════════════════

import type { Email } from "@prisma/client";
import { getEmbeddingService } from "@/lib/embeddings";
import { emailRepository } from "./repository";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/** Entity type for emails in the embedding system */
export const EMAIL_ENTITY_TYPE = "email" as const;

/** Maximum body length to include in embedding (to manage token costs) */
const MAX_BODY_LENGTH = 2000;

/** Batch size for bulk embedding operations */
const EMBEDDING_BATCH_SIZE = 5;

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
    const bodyContent = email.bodyText.slice(0, MAX_BODY_LENGTH);
    parts.push(`Content: ${bodyContent}`);
    if (email.bodyText.length > MAX_BODY_LENGTH) {
      parts.push("...[truncated]");
    }
  }

  // Labels provide useful context
  if (email.labelIds && email.labelIds.length > 0) {
    // Filter out common system labels for cleaner search
    const meaningfulLabels = email.labelIds.filter(
      (label) =>
        !["INBOX", "UNREAD", "SENT", "DRAFT", "TRASH", "SPAM"].includes(label)
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
    if (content.trim().length < 20) {
      return {
        emailId: email.id,
        success: false,
        error: "Content too short, skipped",
      };
    }

    const metadata = buildEmailMetadata(email);
    const embeddingService = getEmbeddingService();

    await embeddingService.storeEntityEmbedding(
      email.userId,
      EMAIL_ENTITY_TYPE,
      email.id,
      content,
      metadata as unknown as Record<string, unknown>
    );

    return {
      emailId: email.id,
      success: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(
      `[EmailEmbedding] Failed to generate embedding for email ${email.id}:`,
      message
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
 * Generate embeddings for multiple emails (batched for efficiency)
 */
export async function generateEmailEmbeddings(
  emails: Email[]
): Promise<BulkEmailEmbeddingResult> {
  const results: EmailEmbeddingResult[] = [];
  let succeeded = 0;
  let failed = 0;

  // Process in batches to avoid overwhelming the API
  for (let i = 0; i < emails.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = emails.slice(i, i + EMBEDDING_BATCH_SIZE);

    const batchResults = await Promise.all(
      batch.map((email) => generateEmailEmbedding(email))
    );

    for (const result of batchResults) {
      results.push(result);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    // Small delay between batches to respect rate limits
    if (i + EMBEDDING_BATCH_SIZE < emails.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

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
