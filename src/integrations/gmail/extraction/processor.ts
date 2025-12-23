// ═══════════════════════════════════════════════════════════════════════════
// Email Content Processor
// Main orchestrator for extracting structured data from email content
// ═══════════════════════════════════════════════════════════════════════════

import type { Email } from "@prisma/client";
import { extractPeople, getLinkedPersonIds } from "./people";
import { extractDates, extractDatesFromSubject } from "./dates";
import {
  extractActionItems,
  extractActionItemsWithAssignees,
} from "./action-items";
import { extractTopics } from "./topics";
import type {
  EmailProcessingResult,
  EmailProcessingOptions,
  EmailInput,
  ProcessingMetadata,
  ProcessingError,
  ExtractedPerson,
  ExtractedDate,
  ExtractedActionItem,
  ExtractedTopic,
  BatchProcessingResult,
  BatchProcessingOptions,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Processing Version
// ─────────────────────────────────────────────────────────────

/** Current processing version for backwards compatibility */
export const PROCESSING_VERSION = "1.0.0";

// ─────────────────────────────────────────────────────────────
// Main Processing Function
// ─────────────────────────────────────────────────────────────

/**
 * Process email content to extract structured data
 *
 * This is the main entry point for email content processing.
 * It orchestrates extraction of:
 * - People (from headers and body)
 * - Dates (potential deadlines, meetings, events)
 * - Action items (tasks, requests)
 * - Topics (categorization)
 *
 * @param email - The email to process
 * @param options - Processing options
 * @returns Comprehensive extraction result
 */
export async function processEmailContent(
  email: Email | EmailInput,
  options: EmailProcessingOptions = {}
): Promise<EmailProcessingResult> {
  const startTime = Date.now();
  const errors: ProcessingError[] = [];

  // Convert Email to EmailInput if needed
  const emailInput = ensureEmailInput(email);

  // Initialize results
  let people: ExtractedPerson[] = [];
  let dates: ExtractedDate[] = [];
  let actionItems: ExtractedActionItem[] = [];
  let topics: ExtractedTopic[] = [];
  let summary: string | undefined;

  // Extract people
  if (!options.skip?.people) {
    try {
      people = await extractPeople(emailInput, options.people);
    } catch (error) {
      errors.push({
        phase: "people",
        message: error instanceof Error ? error.message : "Unknown error",
        recoverable: true,
      });
    }
  }

  // Extract dates
  if (!options.skip?.dates) {
    try {
      dates = extractDatesFromEmail(emailInput, options.dates);
    } catch (error) {
      errors.push({
        phase: "dates",
        message: error instanceof Error ? error.message : "Unknown error",
        recoverable: true,
      });
    }
  }

  // Extract action items
  if (!options.skip?.actions) {
    try {
      if (emailInput.bodyText) {
        // Include people for assignee detection
        actionItems = extractActionItemsWithAssignees(
          emailInput.bodyText,
          people,
          options.actions
        );
      }
    } catch (error) {
      errors.push({
        phase: "actions",
        message: error instanceof Error ? error.message : "Unknown error",
        recoverable: true,
      });
    }
  }

  // Extract topics
  if (!options.skip?.topics) {
    try {
      topics = extractTopics(emailInput, options.topics);
    } catch (error) {
      errors.push({
        phase: "topics",
        message: error instanceof Error ? error.message : "Unknown error",
        recoverable: true,
      });
    }
  }

  // Generate summary
  if (!options.skip?.summary) {
    try {
      summary = generateSummary(emailInput, people, dates, actionItems);
    } catch (error) {
      errors.push({
        phase: "summary",
        message: error instanceof Error ? error.message : "Unknown error",
        recoverable: true,
      });
    }
  }

  // Build metadata
  const metadata: ProcessingMetadata = {
    processingTimeMs: Date.now() - startTime,
    processedAt: new Date(),
    errors,
    version: PROCESSING_VERSION,
  };

  return {
    emailId: emailInput.id,
    people,
    dates,
    actionItems,
    topics,
    summary,
    metadata,
  };
}

/**
 * Process email for a quick analysis (dates and actions only)
 *
 * Lighter-weight processing for batch operations
 */
export async function processEmailQuick(
  email: Email | EmailInput
): Promise<
  Pick<EmailProcessingResult, "emailId" | "dates" | "actionItems" | "metadata">
> {
  const startTime = Date.now();
  const emailInput = ensureEmailInput(email);
  const errors: ProcessingError[] = [];

  let dates: ExtractedDate[] = [];
  let actionItems: ExtractedActionItem[] = [];

  try {
    dates = extractDatesFromEmail(emailInput, { futureOnly: true });
  } catch (error) {
    errors.push({
      phase: "dates",
      message: error instanceof Error ? error.message : "Unknown error",
      recoverable: true,
    });
  }

  try {
    if (emailInput.bodyText) {
      actionItems = extractActionItems(emailInput.bodyText, {
        minConfidence: 0.6,
      });
    }
  } catch (error) {
    errors.push({
      phase: "actions",
      message: error instanceof Error ? error.message : "Unknown error",
      recoverable: true,
    });
  }

  return {
    emailId: emailInput.id,
    dates,
    actionItems,
    metadata: {
      processingTimeMs: Date.now() - startTime,
      processedAt: new Date(),
      errors,
      version: PROCESSING_VERSION,
    },
  };
}

/**
 * Process multiple emails in batch
 *
 * @param emails - Array of emails to process
 * @param options - Batch processing options
 * @returns Batch processing result
 */
export async function processEmailBatch(
  emails: (Email | EmailInput)[],
  options: BatchProcessingOptions = {}
): Promise<BatchProcessingResult> {
  const startTime = Date.now();
  const { concurrency = 5, continueOnError = true, onProgress } = options;

  const results: BatchProcessingResult["results"] = [];
  let processed = 0;
  let failed = 0;

  // Process in batches for concurrency control
  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency);

    const batchPromises = batch.map(async (email) => {
      try {
        const result = await processEmailContent(email, options);
        return { emailId: email.id, success: true, result };
      } catch (error) {
        if (!continueOnError) throw error;
        return {
          emailId: email.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      results.push(result);
      if (result.success) {
        processed++;
      } else {
        failed++;
      }
    }

    // Report progress
    onProgress?.(processed + failed, emails.length);
  }

  return {
    processed,
    failed,
    results,
    totalTimeMs: Date.now() - startTime,
  };
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Ensure we have an EmailInput object
 */
function ensureEmailInput(email: Email | EmailInput): EmailInput {
  // Check if it's already an EmailInput (has the right shape)
  if ("labelIds" in email && Array.isArray(email.labelIds)) {
    return email as EmailInput;
  }

  // Convert Email to EmailInput
  const prismaEmail = email as Email;
  return {
    id: prismaEmail.id,
    userId: prismaEmail.userId,
    subject: prismaEmail.subject,
    fromEmail: prismaEmail.fromEmail,
    fromName: prismaEmail.fromName,
    toEmails: prismaEmail.toEmails,
    ccEmails: prismaEmail.ccEmails,
    bccEmails: prismaEmail.bccEmails,
    replyTo: prismaEmail.replyTo,
    bodyText: prismaEmail.bodyText,
    bodyHtml: prismaEmail.bodyHtml,
    snippet: prismaEmail.snippet,
    internalDate: prismaEmail.internalDate,
    labelIds: prismaEmail.labelIds,
  };
}

/**
 * Extract dates from email content (subject and body)
 */
function extractDatesFromEmail(
  email: EmailInput,
  options?: EmailProcessingOptions["dates"]
): ExtractedDate[] {
  const allDates: ExtractedDate[] = [];

  // Use email date as reference for relative dates
  const referenceDate = email.internalDate ?? new Date();

  // Extract from subject (higher priority)
  if (email.subject) {
    const subjectDates = extractDatesFromSubject(email.subject, {
      ...options,
      referenceDate,
    });
    allDates.push(...subjectDates);
  }

  // Extract from body
  if (email.bodyText) {
    const bodyDates = extractDates(email.bodyText, {
      ...options,
      referenceDate,
    });
    allDates.push(...bodyDates);
  }

  // Deduplicate and sort
  return deduplicateDates(allDates);
}

/**
 * Deduplicate dates by removing near-duplicates
 */
function deduplicateDates(dates: ExtractedDate[]): ExtractedDate[] {
  if (dates.length <= 1) return dates;

  const seen = new Map<string, ExtractedDate>();

  for (const date of dates) {
    // Create a key based on date rounded to hour
    const key = date.date.toISOString().slice(0, 13);

    const existing = seen.get(key);
    if (!existing || date.confidence > existing.confidence) {
      seen.set(key, date);
    }
  }

  return Array.from(seen.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );
}

/**
 * Generate a brief summary of the email processing results
 */
function generateSummary(
  email: EmailInput,
  people: ExtractedPerson[],
  dates: ExtractedDate[],
  actionItems: ExtractedActionItem[]
): string {
  const parts: string[] = [];

  // Sender
  const sender = people.find((p) => p.role === "sender");
  if (sender) {
    parts.push(`From ${sender.name || sender.email}`);
  }

  // Recipients count
  const recipients = people.filter((p) => p.role === "recipient");
  if (recipients.length > 0) {
    parts.push(
      `to ${recipients.length} recipient${recipients.length > 1 ? "s" : ""}`
    );
  }

  // Subject
  if (email.subject) {
    parts.push(`re: ${truncate(email.subject, 50)}`);
  }

  // Deadlines
  const deadlines = dates.filter((d) => d.isPotentialDeadline);
  if (deadlines.length > 0) {
    parts.push(
      `${deadlines.length} deadline${deadlines.length > 1 ? "s" : ""} mentioned`
    );
  }

  // Action items
  if (actionItems.length > 0) {
    parts.push(
      `${actionItems.length} action item${actionItems.length > 1 ? "s" : ""}`
    );
  }

  return parts.join("; ");
}

/**
 * Truncate a string with ellipsis
 */
function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length - 3) + "...";
}

// ─────────────────────────────────────────────────────────────
// Utility Exports
// ─────────────────────────────────────────────────────────────

/**
 * Check if an email has actionable content
 */
export function hasActionableContent(result: EmailProcessingResult): boolean {
  return (
    result.dates.some((d) => d.isPotentialDeadline) ||
    result.actionItems.length > 0
  );
}

/**
 * Get deadline dates from a processing result
 */
export function getDeadlines(result: EmailProcessingResult): ExtractedDate[] {
  return result.dates.filter((d) => d.isPotentialDeadline);
}

/**
 * Get high-priority action items from a processing result
 */
export function getHighPriorityActions(
  result: EmailProcessingResult
): ExtractedActionItem[] {
  return result.actionItems.filter(
    (a) => a.priority === "urgent" || a.priority === "high"
  );
}

/**
 * Get linked Person IDs from a processing result
 */
export function getLinkedPeople(result: EmailProcessingResult): string[] {
  return getLinkedPersonIds(result.people);
}

/**
 * Check if processing completed successfully
 */
export function hasProcessingErrors(result: EmailProcessingResult): boolean {
  return result.metadata.errors.length > 0;
}

/**
 * Get primary topic from a processing result
 */
export function getPrimaryTopic(
  result: EmailProcessingResult
): ExtractedTopic | undefined {
  return result.topics.length > 0 ? result.topics[0] : undefined;
}
