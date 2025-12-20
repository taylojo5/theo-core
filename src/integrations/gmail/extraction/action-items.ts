// ═══════════════════════════════════════════════════════════════════════════
// Email Action Item Extraction
// Extract action items and tasks from email content
// ═══════════════════════════════════════════════════════════════════════════

import type {
  ExtractedActionItem,
  ActionPriority,
  ActionIndicator,
  ActionExtractionOptions,
  ExtractedDate,
  ExtractedPerson,
} from "./types";
import { extractDates } from "./dates";

// ─────────────────────────────────────────────────────────────
// Action Detection Patterns
// ─────────────────────────────────────────────────────────────

/** Imperative verb patterns that suggest action items */
const IMPERATIVE_PATTERNS = [
  /^please\s+(\w+)/i,
  /^kindly\s+(\w+)/i,
  /^(\w+)\s+the\b/i,
  /^let['']?s\s+(\w+)/i,
  /^make\s+sure\s+to\s+(\w+)/i,
  /^don['']?t\s+forget\s+to\s+(\w+)/i,
  /^remember\s+to\s+(\w+)/i,
];

/** Common action verbs */
const ACTION_VERBS = [
  "send",
  "review",
  "check",
  "update",
  "complete",
  "finish",
  "schedule",
  "prepare",
  "create",
  "submit",
  "approve",
  "confirm",
  "follow up",
  "follow-up",
  "contact",
  "call",
  "email",
  "share",
  "forward",
  "discuss",
  "finalize",
  "sign",
  "book",
  "organize",
  "set up",
  "look into",
  "investigate",
  "research",
  "analyze",
  "implement",
  "fix",
  "resolve",
  "address",
  "handle",
  "process",
  "respond",
  "reply",
];

/** Question patterns that suggest requests */
const QUESTION_PATTERNS = [
  /can\s+you\s+(\w+)/i,
  /could\s+you\s+(\w+)/i,
  /would\s+you\s+(\w+)/i,
  /will\s+you\s+(\w+)/i,
  /are\s+you\s+able\s+to\s+(\w+)/i,
  /is\s+it\s+possible\s+to\s+(\w+)/i,
  /would\s+you\s+mind\s+(\w+ing)/i,
];

/** Assignment phrases */
const ASSIGNMENT_PATTERNS = [
  /i\s+need\s+you\s+to\s+(\w+)/i,
  /i['']?d\s+like\s+you\s+to\s+(\w+)/i,
  /i\s+want\s+you\s+to\s+(\w+)/i,
  /your\s+task\s+is\s+to\s+(\w+)/i,
  /please\s+take\s+care\s+of\s+(\w+)/i,
  /you\s+should\s+(\w+)/i,
  /you\s+need\s+to\s+(\w+)/i,
];

/** Urgency indicators */
const URGENCY_KEYWORDS = {
  urgent: [
    "urgent",
    "urgently",
    "asap",
    "immediately",
    "right away",
    "critical",
  ],
  high: ["important", "priority", "time-sensitive", "soon", "quickly"],
  medium: ["when you can", "when possible", "at your convenience"],
  low: ["no rush", "whenever", "eventually", "if you have time"],
};

/** Checkbox patterns */
const CHECKBOX_PATTERNS = [
  /^\s*\[\s*\]/m, // [ ]
  /^\s*\[ \]/m, // [ ] with space
  /^\s*☐/m, // Unicode checkbox
  /^\s*□/m, // Unicode empty box
  /^\s*○/m, // Circle
];

/** List patterns */
const NUMBERED_LIST_PATTERN = /^\s*\d+[.)]\s+(.+)/gm;
const BULLET_LIST_PATTERN = /^\s*[•\-\*]\s+(.+)/gm;

// ─────────────────────────────────────────────────────────────
// Action Item Extraction
// ─────────────────────────────────────────────────────────────

/**
 * Extract action items from email body
 *
 * @param bodyText - The email body text
 * @param options - Extraction options
 * @returns Array of extracted action items
 */
export function extractActionItems(
  bodyText: string,
  options: ActionExtractionOptions = {}
): ExtractedActionItem[] {
  if (!bodyText || bodyText.trim().length === 0) {
    return [];
  }

  const minConfidence = options.minConfidence ?? 0.5;
  const actionItems: ExtractedActionItem[] = [];

  // Split into sentences/lines for analysis
  const segments = splitIntoSegments(bodyText);

  for (const segment of segments) {
    const analysis = analyzeSegment(segment);

    if (analysis.isActionItem && analysis.confidence >= minConfidence) {
      const actionItem: ExtractedActionItem = {
        title: analysis.title,
        context: segment.text,
        priority: analysis.priority,
        indicators: analysis.indicators,
        confidence: analysis.confidence,
      };

      // Extract due date if mentioned
      const dates = extractDates(segment.text, { futureOnly: true });
      if (dates.length > 0) {
        actionItem.dueDate = dates[0];
      }

      actionItems.push(actionItem);
    }
  }

  // Deduplicate similar action items
  return deduplicateActionItems(actionItems);
}

/**
 * Extract action items with associated people
 *
 * @param bodyText - The email body text
 * @param people - People extracted from the email
 * @param options - Extraction options
 * @returns Action items with assignees
 */
export function extractActionItemsWithAssignees(
  bodyText: string,
  people: ExtractedPerson[],
  options: ActionExtractionOptions = {}
): ExtractedActionItem[] {
  const actionItems = extractActionItems(bodyText, options);

  // Try to assign people to action items based on context
  for (const item of actionItems) {
    const assignee = findAssignee(item.context, people);
    if (assignee) {
      item.assignee = assignee;
    }
  }

  return actionItems;
}

/**
 * Extract action items from a list (numbered or bulleted)
 */
export function extractListItems(bodyText: string): ExtractedActionItem[] {
  const actionItems: ExtractedActionItem[] = [];

  // Extract numbered list items
  const numberedMatches = bodyText.matchAll(NUMBERED_LIST_PATTERN);
  for (const match of numberedMatches) {
    const text = match[1].trim();
    if (text.length > 3) {
      actionItems.push({
        title: text,
        context: match[0],
        priority: "medium",
        indicators: ["numbered_list"],
        confidence: 0.7,
      });
    }
  }

  // Extract bullet list items
  const bulletMatches = bodyText.matchAll(BULLET_LIST_PATTERN);
  for (const match of bulletMatches) {
    const text = match[1].trim();
    if (text.length > 3) {
      actionItems.push({
        title: text,
        context: match[0],
        priority: "medium",
        indicators: ["bullet_list"],
        confidence: 0.7,
      });
    }
  }

  return actionItems;
}

// ─────────────────────────────────────────────────────────────
// Analysis Types
// ─────────────────────────────────────────────────────────────

interface TextSegment {
  text: string;
  index: number;
}

interface SegmentAnalysis {
  isActionItem: boolean;
  title: string;
  confidence: number;
  priority: ActionPriority;
  indicators: ActionIndicator[];
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Split text into analyzable segments
 */
function splitIntoSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];

  // Split by sentences and newlines
  const parts = text.split(/(?<=[.!?])\s+|\n+/);

  let index = 0;
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length > 5) {
      segments.push({
        text: trimmed,
        index,
      });
    }
    index += part.length + 1;
  }

  return segments;
}

/**
 * Analyze a text segment for action item indicators
 */
function analyzeSegment(segment: TextSegment): SegmentAnalysis {
  const text = segment.text;
  const lowerText = text.toLowerCase();
  const indicators: ActionIndicator[] = [];
  let confidence = 0;

  // Check for imperative verbs
  for (const pattern of IMPERATIVE_PATTERNS) {
    if (pattern.test(text)) {
      indicators.push("imperative_verb");
      confidence += 0.3;
      break;
    }
  }

  // Check for action verbs at the start
  const firstWord = lowerText.split(/\s+/)[0];
  if (ACTION_VERBS.some((verb) => lowerText.startsWith(verb))) {
    if (!indicators.includes("imperative_verb")) {
      indicators.push("imperative_verb");
      confidence += 0.25;
    }
  }

  // Check for question patterns
  for (const pattern of QUESTION_PATTERNS) {
    if (pattern.test(text)) {
      indicators.push("question");
      confidence += 0.25;
      break;
    }
  }

  // Check for assignment patterns
  for (const pattern of ASSIGNMENT_PATTERNS) {
    if (pattern.test(text)) {
      indicators.push("assignment_phrase");
      confidence += 0.3;
      break;
    }
  }

  // Check for checkboxes
  for (const pattern of CHECKBOX_PATTERNS) {
    if (pattern.test(text)) {
      indicators.push("checkbox");
      confidence += 0.4;
      break;
    }
  }

  // Check for deadline mentions
  const hasDeadlineKeyword = ["by", "before", "deadline", "due", "until"].some(
    (kw) => lowerText.includes(kw)
  );
  if (hasDeadlineKeyword) {
    indicators.push("deadline_mention");
    confidence += 0.15;
  }

  // Determine priority based on urgency keywords
  const priority = determinePriority(lowerText);

  // Boost confidence for urgent items
  if (priority === "urgent") {
    confidence += 0.1;
  }

  // Create title from text
  const title = createActionTitle(text);

  return {
    isActionItem: indicators.length > 0 && confidence >= 0.25,
    title,
    confidence: Math.min(1, confidence),
    priority,
    indicators,
  };
}

/**
 * Determine priority based on text content
 */
function determinePriority(text: string): ActionPriority {
  const lowerText = text.toLowerCase();

  if (URGENCY_KEYWORDS.urgent.some((kw) => lowerText.includes(kw))) {
    return "urgent";
  }

  if (URGENCY_KEYWORDS.high.some((kw) => lowerText.includes(kw))) {
    return "high";
  }

  if (URGENCY_KEYWORDS.low.some((kw) => lowerText.includes(kw))) {
    return "low";
  }

  return "medium";
}

/**
 * Create a clean action title from text
 */
function createActionTitle(text: string): string {
  // Remove leading "please", "kindly", etc.
  let title = text
    .replace(/^(please|kindly|could you|can you|would you)\s+/i, "")
    .trim();

  // Remove checkbox markers
  title = title.replace(/^\[\s*\]\s*/, "").replace(/^[☐□○]\s*/, "");

  // Remove bullet/number markers
  title = title.replace(/^\d+[.)]\s*/, "").replace(/^[•\-\*]\s*/, "");

  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  // Truncate if too long
  if (title.length > 100) {
    title = title.slice(0, 97) + "...";
  }

  return title;
}

/**
 * Find an assignee for an action item based on context
 */
function findAssignee(
  context: string,
  people: ExtractedPerson[]
): ExtractedPerson | undefined {
  const lowerContext = context.toLowerCase();

  // Check for "you" - likely the recipient
  if (
    lowerContext.includes("you should") ||
    lowerContext.includes("can you") ||
    lowerContext.includes("could you") ||
    lowerContext.includes("i need you")
  ) {
    // Return the first recipient
    const recipient = people.find((p) => p.role === "recipient");
    if (recipient) return recipient;
  }

  // Check for names mentioned in the context
  for (const person of people) {
    if (person.name) {
      const nameLower = person.name.toLowerCase();
      // Check if name appears in context
      if (lowerContext.includes(nameLower)) {
        return person;
      }
      // Check first name only
      const firstName = nameLower.split(/\s+/)[0];
      if (firstName.length > 2 && lowerContext.includes(firstName)) {
        return person;
      }
    }
  }

  return undefined;
}

/**
 * Deduplicate similar action items
 */
function deduplicateActionItems(
  items: ExtractedActionItem[]
): ExtractedActionItem[] {
  if (items.length <= 1) return items;

  const result: ExtractedActionItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    // Create a simplified key for comparison
    const key = item.title.toLowerCase().slice(0, 50);

    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  // Sort by confidence (highest first)
  result.sort((a, b) => b.confidence - a.confidence);

  return result;
}

/**
 * Check if text contains action item patterns
 */
export function containsActionPatterns(text: string): boolean {
  if (!text) return false;

  const lowerText = text.toLowerCase();

  // Check for imperative verbs
  for (const pattern of IMPERATIVE_PATTERNS) {
    if (pattern.test(text)) return true;
  }

  // Check for question patterns
  for (const pattern of QUESTION_PATTERNS) {
    if (pattern.test(text)) return true;
  }

  // Check for assignment patterns
  for (const pattern of ASSIGNMENT_PATTERNS) {
    if (pattern.test(text)) return true;
  }

  // Check for action verbs at the start
  if (ACTION_VERBS.some((verb) => lowerText.startsWith(verb))) {
    return true;
  }

  return false;
}
