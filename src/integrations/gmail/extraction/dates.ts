// ═══════════════════════════════════════════════════════════════════════════
// Email Date Extraction
// Extract dates and potential deadlines from email content using chrono-node
// Uses Luxon for date comparisons and formatting
// ═══════════════════════════════════════════════════════════════════════════

import * as chrono from "chrono-node";
import { DateTime } from "luxon";
import type { ExtractedDate, DateType, DateExtractionOptions } from "./types";

// ─────────────────────────────────────────────────────────────
// Deadline Keywords
// ─────────────────────────────────────────────────────────────

/** Keywords that indicate a deadline */
const DEADLINE_KEYWORDS = [
  "deadline",
  "due",
  "due by",
  "due date",
  "by",
  "before",
  "no later than",
  "submit by",
  "respond by",
  "complete by",
  "finish by",
  "expires",
  "expiring",
  "expiration",
  "end of",
  "eod",
  "cob",
  "asap",
  "urgent",
  "immediately",
];

/** Keywords that indicate a meeting or event */
const MEETING_KEYWORDS = [
  "meeting",
  "call",
  "conference",
  "sync",
  "standup",
  "stand-up",
  "interview",
  "appointment",
  "session",
  "webinar",
];

/** Keywords that indicate a reminder */
const REMINDER_KEYWORDS = [
  "remind",
  "reminder",
  "don't forget",
  "remember to",
  "follow up",
  "follow-up",
  "check in",
  "check-in",
];

/** Keywords that indicate a recurring event */
const RECURRING_KEYWORDS = [
  "every",
  "weekly",
  "daily",
  "monthly",
  "annually",
  "biweekly",
  "bi-weekly",
];

// ─────────────────────────────────────────────────────────────
// Date Extraction
// ─────────────────────────────────────────────────────────────

/**
 * Extract dates from text content
 * Uses chrono-node for NLP parsing and Luxon for comparisons
 *
 * @param text - The text to extract dates from
 * @param options - Extraction options
 * @returns Array of extracted dates
 */
export function extractDates(
  text: string,
  options: DateExtractionOptions = {}
): ExtractedDate[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const referenceDate = options.referenceDate ?? new Date();
  const referenceDt = DateTime.fromJSDate(referenceDate);
  const minConfidence = options.minConfidence ?? 0.5;

  // Parse dates using chrono-node
  const parsed = chrono.parse(text, referenceDate, {
    forwardDate: options.futureOnly ?? false,
  });

  const results: ExtractedDate[] = [];

  for (const result of parsed) {
    // Calculate base confidence
    const confidence = calculateConfidence(result);

    // Skip low-confidence results
    if (confidence < minConfidence) {
      continue;
    }

    // Determine date type based on context
    const surroundingText = getSurroundingText(text, result.index, 50);
    const dateType = determineDateType(surroundingText, result.text);

    // Check if this is a potential deadline
    const isPotentialDeadline = checkIfDeadline(surroundingText, dateType);

    // Check if time component is meaningful
    const hasTime =
      result.start.isCertain("hour") || result.start.isCertain("minute");

    // Filter future-only if requested (using Luxon for comparison)
    const startDate = result.start.date();
    const startDt = DateTime.fromJSDate(startDate);
    if (options.futureOnly && startDt < referenceDt) {
      continue;
    }

    // Build the extracted date
    const extracted: ExtractedDate = {
      date: startDate,
      originalText: result.text,
      type: dateType,
      isPotentialDeadline,
      hasTime,
      confidence,
      position: {
        start: result.index,
        end: result.index + result.text.length,
      },
    };

    // Add end date for ranges
    if (result.end) {
      extracted.endDate = result.end.date();
    }

    results.push(extracted);
  }

  // Sort by date using Luxon for comparison
  results.sort((a, b) => {
    const aDt = DateTime.fromJSDate(a.date);
    const bDt = DateTime.fromJSDate(b.date);
    return aDt.toMillis() - bDt.toMillis();
  });

  // Deduplicate dates that are very close
  return deduplicateDates(results);
}

/**
 * Extract only deadline-like dates from text
 *
 * @param text - The text to extract from
 * @param options - Extraction options
 * @returns Array of dates that appear to be deadlines
 */
export function extractDeadlines(
  text: string,
  options: DateExtractionOptions = {}
): ExtractedDate[] {
  const allDates = extractDates(text, options);
  return allDates.filter((d) => d.isPotentialDeadline);
}

/**
 * Extract dates from email subject (higher confidence for deadlines)
 *
 * @param subject - Email subject line
 * @param options - Extraction options
 * @returns Extracted dates
 */
export function extractDatesFromSubject(
  subject: string,
  options: DateExtractionOptions = {}
): ExtractedDate[] {
  const dates = extractDates(subject, options);

  // Boost confidence for dates in subject
  return dates.map((d) => ({
    ...d,
    confidence: Math.min(1, d.confidence * 1.2),
    // Dates in subject are more likely to be deadlines
    isPotentialDeadline: d.isPotentialDeadline || d.type === "absolute",
  }));
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Calculate confidence score for a parsed date result
 */
function calculateConfidence(result: chrono.ParsedResult): number {
  let confidence = 0.6; // Base confidence

  // Boost for explicit date components
  if (result.start.isCertain("year")) confidence += 0.1;
  if (result.start.isCertain("month")) confidence += 0.1;
  if (result.start.isCertain("day")) confidence += 0.1;
  if (result.start.isCertain("hour")) confidence += 0.05;

  // Reduce for very short matches (less context)
  if (result.text.length < 5) confidence -= 0.2;

  // Reduce for implicit dates like "tomorrow" (could be figurative)
  const implicitTerms = ["soon", "later", "sometime", "eventually", "shortly"];
  if (implicitTerms.some((term) => result.text.toLowerCase().includes(term))) {
    confidence -= 0.2;
  }

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Get surrounding text around a position
 */
function getSurroundingText(
  text: string,
  position: number,
  radius: number
): string {
  const start = Math.max(0, position - radius);
  const end = Math.min(text.length, position + radius);
  return text.slice(start, end).toLowerCase();
}

/**
 * Determine the type of date reference
 */
function determineDateType(context: string, matchText: string): DateType {
  const lowerContext = context.toLowerCase();
  const lowerMatch = matchText.toLowerCase();

  // Check for recurring patterns
  if (RECURRING_KEYWORDS.some((kw) => lowerContext.includes(kw))) {
    return "recurring";
  }

  // Check for deadline patterns
  if (DEADLINE_KEYWORDS.some((kw) => lowerContext.includes(kw))) {
    return "deadline";
  }

  // Check for meeting patterns
  if (MEETING_KEYWORDS.some((kw) => lowerContext.includes(kw))) {
    return "meeting";
  }

  // Check for reminder patterns
  if (REMINDER_KEYWORDS.some((kw) => lowerContext.includes(kw))) {
    return "reminder";
  }

  // Check for range patterns
  if (lowerContext.includes(" to ") || lowerContext.includes(" - ")) {
    return "range";
  }

  // Check if it's a relative date
  const relativeTerms = [
    "next",
    "this",
    "in",
    "tomorrow",
    "today",
    "yesterday",
    "ago",
  ];
  if (relativeTerms.some((term) => lowerMatch.includes(term))) {
    return "relative";
  }

  // Default to absolute
  return "absolute";
}

/**
 * Check if a date appears to be a deadline
 */
function checkIfDeadline(context: string, dateType: DateType): boolean {
  // Explicit deadline types
  if (dateType === "deadline") {
    return true;
  }

  // Check for deadline indicators in context
  const lowerContext = context.toLowerCase();

  const deadlineIndicators = [
    "due",
    "deadline",
    "submit",
    "complete",
    "finish",
    "deliver",
    "expires",
    "respond",
    "reply",
    "by",
    "before",
    "no later than",
    "asap",
    "urgent",
  ];

  return deadlineIndicators.some((indicator) =>
    lowerContext.includes(indicator)
  );
}

/**
 * Remove duplicate dates that are within a small time window
 * Uses Luxon for ISO date formatting
 */
function deduplicateDates(dates: ExtractedDate[]): ExtractedDate[] {
  if (dates.length <= 1) return dates;

  const result: ExtractedDate[] = [];
  const seen = new Set<string>();

  for (const date of dates) {
    // Create a key based on date (rounded to hour) using Luxon
    const dt = DateTime.fromJSDate(date.date);
    const hourKey = dt.toFormat("yyyy-MM-dd'T'HH");
    const key = `${hourKey}-${date.type}`;

    if (!seen.has(key)) {
      seen.add(key);
      result.push(date);
    } else {
      // If duplicate, keep the one with higher confidence
      const existingIndex = result.findIndex((d) => {
        const existingDt = DateTime.fromJSDate(d.date);
        return existingDt.toFormat("yyyy-MM-dd'T'HH") === hourKey;
      });
      if (
        existingIndex >= 0 &&
        date.confidence > result[existingIndex].confidence
      ) {
        result[existingIndex] = date;
      }
    }
  }

  return result;
}

/**
 * Format an extracted date for display
 * Uses Luxon for consistent, locale-aware formatting
 */
export function formatExtractedDate(date: ExtractedDate): string {
  const dt = DateTime.fromJSDate(date.date);
  
  // Format with Luxon - weekday, month, day, optionally time
  let formatted = date.hasTime
    ? dt.toFormat("EEE, MMM d 'at' h:mm a")
    : dt.toFormat("EEE, MMM d");

  if (date.endDate) {
    const endDt = DateTime.fromJSDate(date.endDate);
    const endFormatted = date.hasTime
      ? endDt.toFormat("EEE, MMM d 'at' h:mm a")
      : endDt.toFormat("EEE, MMM d");
    formatted += ` - ${endFormatted}`;
  }

  return formatted;
}
