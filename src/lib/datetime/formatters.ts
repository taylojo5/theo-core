// ═══════════════════════════════════════════════════════════════════════════
// DateTime Formatters
// Functions for formatting dates for display
// ═══════════════════════════════════════════════════════════════════════════

import { DateTime } from "luxon";
import { DATE_FORMATS, type DateFormatKey } from "./constants";
import { now } from "./converters";

// ─────────────────────────────────────────────────────────────
// Basic Formatting
// ─────────────────────────────────────────────────────────────

/**
 * Format a DateTime using a preset or custom format string
 *
 * @param dt - DateTime to format
 * @param format - Format key from DATE_FORMATS or custom Luxon format string
 * @returns Formatted string
 *
 * @example
 * ```typescript
 * formatDate(dt, "DISPLAY_DATE");     // "Mar 15, 2024"
 * formatDate(dt, "DISPLAY_DATETIME"); // "Mar 15, 2024 at 2:30 PM"
 * formatDate(dt, "HH:mm");            // "14:30" (custom format)
 * ```
 */
export function formatDate(
  dt: DateTime,
  format: DateFormatKey | string = "DISPLAY_DATE"
): string {
  const formatString =
    DATE_FORMATS[format as DateFormatKey] ?? format;
  return dt.toFormat(formatString);
}

/**
 * Format a DateTime for ISO output (API responses, database)
 *
 * @param dt - DateTime to format
 * @returns ISO 8601 string
 */
export function formatISO(dt: DateTime): string {
  return dt.toISO() ?? dt.toUTC().toISO()!;
}

/**
 * Format a DateTime as date only (YYYY-MM-DD)
 *
 * @param dt - DateTime to format
 * @returns Date string
 */
export function formatDateOnly(dt: DateTime): string {
  return dt.toISODate()!;
}

/**
 * Format a DateTime as time only
 *
 * @param dt - DateTime to format
 * @returns Time string (e.g., "2:30 PM")
 */
export function formatTime(dt: DateTime): string {
  return dt.toFormat(DATE_FORMATS.DISPLAY_TIME);
}

/**
 * Format a DateTime as 24-hour time
 *
 * @param dt - DateTime to format
 * @returns Time string (e.g., "14:30")
 */
export function formatTime24(dt: DateTime): string {
  return dt.toFormat(DATE_FORMATS.DISPLAY_TIME_24H);
}

// ─────────────────────────────────────────────────────────────
// Relative Formatting
// ─────────────────────────────────────────────────────────────

/**
 * Format a DateTime relative to now
 *
 * @param dt - DateTime to format
 * @returns Relative string (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelative(dt: DateTime): string {
  return dt.toRelative() ?? formatDate(dt, "DISPLAY_DATETIME");
}

/**
 * Format a DateTime relative to a specific date
 *
 * @param dt - DateTime to format
 * @param base - Base DateTime to compare against
 * @returns Relative string
 */
export function formatRelativeTo(dt: DateTime, base: DateTime): string {
  return dt.toRelative({ base }) ?? formatDate(dt, "DISPLAY_DATETIME");
}

/**
 * Format a DateTime as a calendar reference
 *
 * Uses "Today", "Tomorrow", "Yesterday" when appropriate,
 * otherwise falls back to date format.
 *
 * @param dt - DateTime to format
 * @param zone - Timezone for comparison
 * @returns Calendar string
 */
export function formatCalendar(dt: DateTime, zone?: string): string {
  const reference = zone ? now(zone) : now(dt.zoneName ?? undefined);
  const comparison = zone ? dt.setZone(zone) : dt;

  if (comparison.hasSame(reference, "day")) {
    return "Today";
  }

  if (comparison.hasSame(reference.plus({ days: 1 }), "day")) {
    return "Tomorrow";
  }

  if (comparison.hasSame(reference.minus({ days: 1 }), "day")) {
    return "Yesterday";
  }

  // This week - show day name
  if (comparison.hasSame(reference, "week")) {
    return comparison.toFormat("EEEE"); // "Monday", "Tuesday", etc.
  }

  // This year - omit year
  if (comparison.hasSame(reference, "year")) {
    return comparison.toFormat(DATE_FORMATS.DISPLAY_DATE_SHORT);
  }

  // Different year - include year
  return comparison.toFormat(DATE_FORMATS.DISPLAY_DATE);
}

/**
 * Get a friendly date description with optional time
 *
 * @param dt - DateTime to format
 * @param includeTime - Whether to include time
 * @param zone - Timezone for comparison
 * @returns Friendly string
 */
export function friendlyDate(
  dt: DateTime,
  includeTime: boolean = false,
  zone?: string
): string {
  const calendar = formatCalendar(dt, zone);
  
  if (!includeTime) {
    return calendar;
  }

  const time = formatTime(dt);
  return `${calendar} at ${time}`;
}

// ─────────────────────────────────────────────────────────────
// Localized Formatting
// ─────────────────────────────────────────────────────────────

/**
 * Format a DateTime using browser/system locale
 *
 * @param dt - DateTime to format
 * @param options - Intl.DateTimeFormat options
 * @returns Localized string
 */
export function formatLocalized(
  dt: DateTime,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return dt.toLocaleString(options);
}

/**
 * Format a DateTime for a specific locale
 *
 * @param dt - DateTime to format
 * @param locale - Locale string (e.g., "en-US", "de-DE")
 * @param options - Intl.DateTimeFormat options
 * @returns Localized string
 */
export function formatForLocale(
  dt: DateTime,
  locale: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return dt.setLocale(locale).toLocaleString(options);
}

/**
 * Format as localized date (no time)
 *
 * @param dt - DateTime to format
 * @returns Localized date string
 */
export function formatLocalizedDate(dt: DateTime): string {
  return dt.toLocaleString(DateTime.DATE_MED);
}

/**
 * Format as localized date and time
 *
 * @param dt - DateTime to format
 * @returns Localized datetime string
 */
export function formatLocalizedDateTime(dt: DateTime): string {
  return dt.toLocaleString(DateTime.DATETIME_MED);
}

// ─────────────────────────────────────────────────────────────
// Range Formatting
// ─────────────────────────────────────────────────────────────

/**
 * Format a date range for display
 *
 * Intelligently formats based on whether dates are same day, month, year.
 *
 * @param start - Start DateTime
 * @param end - End DateTime
 * @returns Formatted range string
 */
export function formatDateRange(start: DateTime, end: DateTime): string {
  // Same day: "Dec 27, 2025, 2:00 PM - 4:00 PM"
  if (start.hasSame(end, "day")) {
    return `${formatDate(start, "DISPLAY_DATE")}, ${formatTime(start)} - ${formatTime(end)}`;
  }

  // Same month: "Dec 27 - 29, 2025"
  if (start.hasSame(end, "month")) {
    return `${start.toFormat("MMM d")} - ${end.toFormat("d, yyyy")}`;
  }

  // Same year: "Dec 27 - Jan 2, 2025"
  if (start.hasSame(end, "year")) {
    return `${start.toFormat("MMM d")} - ${end.toFormat("MMM d, yyyy")}`;
  }

  // Different years: "Dec 27, 2024 - Jan 2, 2025"
  return `${formatDate(start, "DISPLAY_DATE")} - ${formatDate(end, "DISPLAY_DATE")}`;
}

/**
 * Format a time range for display (assumes same day)
 *
 * @param start - Start DateTime
 * @param end - End DateTime
 * @returns Formatted time range (e.g., "2:00 PM - 4:00 PM")
 */
export function formatTimeRange(start: DateTime, end: DateTime): string {
  return `${formatTime(start)} - ${formatTime(end)}`;
}

// ─────────────────────────────────────────────────────────────
// Weekday Formatting
// ─────────────────────────────────────────────────────────────

/**
 * Get the full weekday name
 *
 * @param dt - DateTime
 * @returns Weekday name (e.g., "Monday")
 */
export function getWeekdayName(dt: DateTime): string {
  return dt.toFormat("EEEE");
}

/**
 * Get the abbreviated weekday name
 *
 * @param dt - DateTime
 * @returns Weekday abbreviation (e.g., "Mon")
 */
export function getWeekdayAbbr(dt: DateTime): string {
  return dt.toFormat("EEE");
}

/**
 * Get the month name
 *
 * @param dt - DateTime
 * @returns Month name (e.g., "March")
 */
export function getMonthName(dt: DateTime): string {
  return dt.toFormat("MMMM");
}

/**
 * Get the abbreviated month name
 *
 * @param dt - DateTime
 * @returns Month abbreviation (e.g., "Mar")
 */
export function getMonthAbbr(dt: DateTime): string {
  return dt.toFormat("MMM");
}

// ─────────────────────────────────────────────────────────────
// Ordinal Formatting
// ─────────────────────────────────────────────────────────────

/**
 * Get the day of month with ordinal suffix
 *
 * @param dt - DateTime
 * @returns Day with ordinal (e.g., "15th", "1st", "22nd")
 */
export function getDayWithOrdinal(dt: DateTime): string {
  const day = dt.day;
  const suffix = getOrdinalSuffix(day);
  return `${day}${suffix}`;
}

/**
 * Get ordinal suffix for a number
 *
 * @param n - Number
 * @returns Ordinal suffix ("st", "nd", "rd", "th")
 */
function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Format date with ordinal day
 *
 * @param dt - DateTime
 * @returns Formatted string (e.g., "March 15th, 2024")
 */
export function formatWithOrdinal(dt: DateTime): string {
  return `${getMonthName(dt)} ${getDayWithOrdinal(dt)}, ${dt.year}`;
}

