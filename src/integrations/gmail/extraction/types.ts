// ═══════════════════════════════════════════════════════════════════════════
// Email Extraction Types
// TypeScript definitions for email content extraction
// ═══════════════════════════════════════════════════════════════════════════

import type { Person, Task } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Extraction Result Types
// ─────────────────────────────────────────────────────────────

/**
 * Complete result of processing an email's content
 */
export interface EmailProcessingResult {
  /** Email ID that was processed */
  emailId: string;

  /** People mentioned or involved in the email */
  people: ExtractedPerson[];

  /** Dates found in the email content */
  dates: ExtractedDate[];

  /** Action items identified in the email */
  actionItems: ExtractedActionItem[];

  /** Opportunities identified in the email */
  opportunities: ExtractedOpportunity[];

  /** Topics/categories identified */
  topics: ExtractedTopic[];

  /** Brief summary of the email */
  summary?: string;

  /** Processing metadata */
  metadata: ProcessingMetadata;
}

/**
 * Processing metadata
 */
export interface ProcessingMetadata {
  /** Time taken to process in milliseconds */
  processingTimeMs: number;

  /** Timestamp when processed */
  processedAt: Date;

  /** Any errors that occurred during processing */
  errors: ProcessingError[];

  /** Processing version for backwards compatibility */
  version: string;
}

/**
 * Error during processing
 */
export interface ProcessingError {
  phase: "people" | "dates" | "actions" | "opportunities" | "topics" | "summary";
  message: string;
  recoverable: boolean;
}

// ─────────────────────────────────────────────────────────────
// Extracted Person
// ─────────────────────────────────────────────────────────────

/**
 * A person extracted from email content
 */
export interface ExtractedPerson {
  /** Email address */
  email: string;

  /** Display name if available */
  name?: string;

  /** How this person relates to the email */
  role: PersonRole;

  /** If matched to existing Person entity */
  linkedPersonId?: string;

  /** The linked Person entity (if found) */
  linkedPerson?: Person;

  /** Confidence in the extraction (0-1) */
  confidence: number;
}

/**
 * Role of a person in relation to the email
 */
export type PersonRole =
  | "sender"
  | "recipient"
  | "cc"
  | "bcc"
  | "mentioned"
  | "reply_to";

/**
 * Options for people extraction
 */
export interface PeopleExtractionOptions {
  /** Whether to attempt linking to existing Person entities */
  linkToExisting?: boolean;

  /** Create new Person entities for unknown contacts */
  createMissing?: boolean;

  /** Minimum confidence threshold for mentions in body */
  minMentionConfidence?: number;
}

// ─────────────────────────────────────────────────────────────
// Extracted Date
// ─────────────────────────────────────────────────────────────

/**
 * A date/time extracted from email content
 */
export interface ExtractedDate {
  /** The parsed date */
  date: Date;

  /** End date for date ranges */
  endDate?: Date;

  /** Original text that was parsed */
  originalText: string;

  /** Type of date reference */
  type: DateType;

  /** Whether this could be a deadline */
  isPotentialDeadline: boolean;

  /** Whether the time component is meaningful */
  hasTime: boolean;

  /** Confidence in the extraction (0-1) */
  confidence: number;

  /** Position in the original text */
  position?: {
    start: number;
    end: number;
  };
}

/**
 * Type of date reference
 */
export type DateType =
  | "absolute" // "January 5th, 2025"
  | "relative" // "next Tuesday", "in 3 days"
  | "deadline" // "due by", "deadline:"
  | "meeting" // "meeting at", "call at"
  | "event" // "conference on"
  | "reminder" // "remind me on"
  | "range" // "from X to Y"
  | "recurring"; // "every Monday"

/**
 * Options for date extraction
 */
export interface DateExtractionOptions {
  /** Reference date for relative dates (defaults to email date) */
  referenceDate?: Date;

  /** Timezone for parsing */
  timezone?: string;

  /** Only extract dates in the future */
  futureOnly?: boolean;

  /** Minimum confidence threshold */
  minConfidence?: number;
}

// ─────────────────────────────────────────────────────────────
// Extracted Action Item
// ─────────────────────────────────────────────────────────────

/**
 * An action item extracted from email content
 */
export interface ExtractedActionItem {
  /** The action to be taken */
  title: string;

  /** Full text context where action was found */
  context: string;

  /** Who should take the action (if identifiable) */
  assignee?: ExtractedPerson;

  /** When it should be done (if mentioned) */
  dueDate?: ExtractedDate;

  /** Priority level based on language */
  priority: ActionPriority;

  /** Indicators that suggest this is an action item */
  indicators: ActionIndicator[];

  /** Confidence in the extraction (0-1) */
  confidence: number;

  /** If converted to a Task entity */
  linkedTaskId?: string;

  /** The linked Task entity (if created) */
  linkedTask?: Task;
}

/**
 * Priority levels for action items
 */
export type ActionPriority = "urgent" | "high" | "medium" | "low";

/**
 * Indicators that suggest an action item
 */
export type ActionIndicator =
  | "imperative_verb" // "Please send", "Review the"
  | "question" // "Can you", "Would you"
  | "deadline_mention" // "by Friday"
  | "assignment_phrase" // "I need you to"
  | "checkbox" // "[ ]" or "☐"
  | "numbered_list" // "1. Do this"
  | "bullet_list"; // "• Do this"

/**
 * Options for action item extraction
 */
export interface ActionExtractionOptions {
  /** Minimum confidence threshold */
  minConfidence?: number;

  /** Create Task entities for high-confidence items */
  createTasks?: boolean;

  /** Link to existing Task entities if similar */
  linkToExisting?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Extracted Topic
// ─────────────────────────────────────────────────────────────

/**
 * A topic/category extracted from email content
 */
export interface ExtractedTopic {
  /** Topic name/label */
  name: string;

  /** Category this topic belongs to */
  category: TopicCategory;

  /** Confidence in the categorization (0-1) */
  confidence: number;

  /** Keywords that contributed to this topic */
  keywords: string[];
}

/**
 * High-level topic categories
 */
export type TopicCategory =
  | "work" // Work/professional topics
  | "personal" // Personal matters
  | "finance" // Money, payments, invoices
  | "travel" // Travel, flights, hotels
  | "scheduling" // Meetings, appointments
  | "project" // Project-related
  | "support" // Customer support, help requests
  | "newsletter" // Newsletters, marketing
  | "social" // Social events, invitations
  | "legal" // Legal, contracts
  | "health" // Health, medical
  | "education" // Learning, courses
  | "shopping" // Orders, receipts
  | "other"; // Uncategorized

/**
 * Options for topic extraction
 */
export interface TopicExtractionOptions {
  /** Maximum number of topics to extract */
  maxTopics?: number;

  /** Minimum confidence threshold */
  minConfidence?: number;
}

// ─────────────────────────────────────────────────────────────
// Extracted Opportunity
// ─────────────────────────────────────────────────────────────

/**
 * An opportunity extracted from email content
 */
export interface ExtractedOpportunity {
  /** Brief title/summary of the opportunity */
  title: string;

  /** Full description/context */
  description: string;

  /** Type of opportunity */
  type: OpportunityType;

  /** Indicators that suggest this is an opportunity */
  indicators: OpportunityIndicator[];

  /** Confidence in the extraction (0-1) */
  confidence: number;

  /** Potential value or benefit */
  potentialValue?: string;

  /** Whether there's urgency/deadline mentioned */
  hasUrgency: boolean;

  /** Expiration date if mentioned */
  expiresAt?: ExtractedDate;

  /** Related person from the email */
  relatedPerson?: ExtractedPerson;
}

/**
 * Types of opportunities
 */
export type OpportunityType =
  | "networking"    // Connection, introduction, meetup
  | "business"      // Sales lead, partnership, client
  | "learning"      // Course, webinar, conference
  | "career"        // Job opportunity, recruiting
  | "social"        // Event, party, gathering
  | "collaboration" // Joint project, contribution
  | "investment"    // Financial opportunity
  | "general";      // Uncategorized

/**
 * Indicators that suggest an opportunity
 */
export type OpportunityIndicator =
  | "networking_phrase"     // "let's connect", "introduce you"
  | "business_phrase"       // "business opportunity", "potential client"
  | "learning_phrase"       // "webinar", "workshop"
  | "career_phrase"         // "job opportunity", "hiring"
  | "social_phrase"         // "you're invited", "join us"
  | "collaboration_phrase"  // "collaborate", "work together"
  | "investment_phrase"     // "investment opportunity"
  | "opportunity_keyword"   // "opportunity", "chance", "potential"
  | "urgency_indicator";    // "limited time", "deadline"

/**
 * Options for opportunity extraction
 */
export interface OpportunityExtractionOptions {
  /** Minimum confidence threshold */
  minConfidence?: number;

  /** Create Opportunity entities for high-confidence items */
  createOpportunities?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Processing Options
// ─────────────────────────────────────────────────────────────

/**
 * Options for email content processing
 */
export interface EmailProcessingOptions {
  /** Options for people extraction */
  people?: PeopleExtractionOptions;

  /** Options for date extraction */
  dates?: DateExtractionOptions;

  /** Options for action item extraction */
  actions?: ActionExtractionOptions;

  /** Options for opportunity extraction */
  opportunities?: OpportunityExtractionOptions;

  /** Options for topic extraction */
  topics?: TopicExtractionOptions;

  /** Skip specific extraction phases */
  skip?: {
    people?: boolean;
    dates?: boolean;
    actions?: boolean;
    opportunities?: boolean;
    topics?: boolean;
    summary?: boolean;
  };

  /** Service context for audit logging */
  context?: {
    userId?: string;
    sessionId?: string;
    conversationId?: string;
  };
}

// ─────────────────────────────────────────────────────────────
// Email Input Types
// ─────────────────────────────────────────────────────────────

/**
 * Minimal email data needed for processing
 */
export interface EmailInput {
  id: string;
  userId: string;
  subject?: string | null;
  fromEmail: string;
  fromName?: string | null;
  toEmails: string[];
  ccEmails: string[];
  bccEmails: string[];
  replyTo?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  snippet?: string | null;
  internalDate: Date;
  labelIds: string[];
}

/**
 * Type guard to check if an object is a valid EmailInput
 */
export function isEmailInput(obj: unknown): obj is EmailInput {
  if (typeof obj !== "object" || obj === null) return false;
  const email = obj as Record<string, unknown>;
  return (
    typeof email.id === "string" &&
    typeof email.userId === "string" &&
    typeof email.fromEmail === "string" &&
    Array.isArray(email.toEmails) &&
    Array.isArray(email.ccEmails) &&
    Array.isArray(email.bccEmails) &&
    email.internalDate instanceof Date
  );
}

// ─────────────────────────────────────────────────────────────
// Batch Processing Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of batch processing multiple emails
 */
export interface BatchProcessingResult {
  /** Number of emails processed successfully */
  processed: number;

  /** Number of emails that failed */
  failed: number;

  /** Individual results */
  results: Array<{
    emailId: string;
    success: boolean;
    result?: EmailProcessingResult;
    error?: string;
  }>;

  /** Total processing time */
  totalTimeMs: number;
}

/**
 * Options for batch processing
 */
export interface BatchProcessingOptions extends EmailProcessingOptions {
  /** Maximum number of emails to process concurrently */
  concurrency?: number;

  /** Continue processing if individual emails fail */
  continueOnError?: boolean;

  /** Progress callback */
  onProgress?: (processed: number, total: number) => void;
}
