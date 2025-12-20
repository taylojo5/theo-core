// ═══════════════════════════════════════════════════════════════════════════
// Email Content Extraction Module
// Extract structured data from email content
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Main Processor
// ─────────────────────────────────────────────────────────────

export {
  processEmailContent,
  processEmailQuick,
  processEmailBatch,
  hasActionableContent,
  getDeadlines,
  getHighPriorityActions,
  getLinkedPeople,
  hasProcessingErrors,
  getPrimaryTopic,
  PROCESSING_VERSION,
} from "./processor";

// ─────────────────────────────────────────────────────────────
// People Extraction
// ─────────────────────────────────────────────────────────────

export {
  extractPeople,
  extractSender,
  extractRecipients,
  getUniqueEmails,
  getPeopleByRole,
  getLinkedPersonIds,
} from "./people";

// ─────────────────────────────────────────────────────────────
// Date Extraction
// ─────────────────────────────────────────────────────────────

export {
  extractDates,
  extractDeadlines,
  extractDatesFromSubject,
  formatExtractedDate,
} from "./dates";

// ─────────────────────────────────────────────────────────────
// Action Item Extraction
// ─────────────────────────────────────────────────────────────

export {
  extractActionItems,
  extractActionItemsWithAssignees,
  extractListItems,
  containsActionPatterns,
} from "./action-items";

// ─────────────────────────────────────────────────────────────
// Topic Categorization
// ─────────────────────────────────────────────────────────────

export {
  extractTopics,
  getPrimaryTopic as getEmailPrimaryTopic,
  matchesTopic,
  getAllCategories,
  isValidCategory,
} from "./topics";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Processing results
  EmailProcessingResult,
  ProcessingMetadata,
  ProcessingError,
  BatchProcessingResult,

  // People
  ExtractedPerson,
  PersonRole,
  PeopleExtractionOptions,

  // Dates
  ExtractedDate,
  DateType,
  DateExtractionOptions,

  // Action items
  ExtractedActionItem,
  ActionPriority,
  ActionIndicator,
  ActionExtractionOptions,

  // Topics
  ExtractedTopic,
  TopicCategory,
  TopicExtractionOptions,

  // Processing options
  EmailProcessingOptions,
  BatchProcessingOptions,

  // Input types
  EmailInput,
} from "./types";
