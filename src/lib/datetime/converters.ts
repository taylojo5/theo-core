// ═══════════════════════════════════════════════════════════════════════════
// DateTime Converters
// Bidirectional conversion between JS Date and Luxon DateTime
// ═══════════════════════════════════════════════════════════════════════════

import { DateTime } from "luxon";
import { DEFAULT_TIMEZONE } from "./constants";

// ─────────────────────────────────────────────────────────────
// Core Conversions
// ─────────────────────────────────────────────────────────────

/**
 * Convert a JavaScript Date to a Luxon DateTime
 *
 * @param date - JavaScript Date object
 * @param zone - Target timezone (defaults to UTC)
 * @returns Luxon DateTime in the specified timezone
 *
 * @example
 * ```typescript
 * const jsDate = new Date();
 * const dt = fromDate(jsDate); // DateTime in UTC
 * const dtNY = fromDate(jsDate, "America/New_York"); // DateTime in NYC
 * ```
 */
export function fromDate(date: Date, zone?: string): DateTime {
  return DateTime.fromJSDate(date, { zone: zone ?? DEFAULT_TIMEZONE });
}

/**
 * Convert a Luxon DateTime to a JavaScript Date
 *
 * The returned Date represents the same instant in time.
 * Note: JS Date is always in local timezone for display purposes.
 *
 * @param dt - Luxon DateTime
 * @returns JavaScript Date object
 */
export function toDate(dt: DateTime): Date {
  return dt.toJSDate();
}

// ─────────────────────────────────────────────────────────────
// String Parsing
// ─────────────────────────────────────────────────────────────

/**
 * Parse an ISO 8601 string to DateTime
 *
 * Handles full ISO strings with timezone info, or interprets as UTC if none.
 *
 * @param iso - ISO 8601 formatted string
 * @param zone - Timezone for strings without offset (defaults to UTC)
 * @returns Luxon DateTime
 *
 * @example
 * ```typescript
 * fromISO("2024-03-15T14:30:00Z");          // UTC
 * fromISO("2024-03-15T14:30:00-05:00");     // Keeps original offset
 * fromISO("2024-03-15T14:30:00", "America/New_York"); // NYC timezone
 * ```
 */
export function fromISO(iso: string, zone?: string): DateTime {
  return DateTime.fromISO(iso, { zone: zone ?? DEFAULT_TIMEZONE });
}

/**
 * Parse a date-only string (YYYY-MM-DD) to DateTime at start of day
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param zone - Timezone for the resulting DateTime
 * @returns DateTime at 00:00:00 in the specified timezone
 */
export function fromDateString(dateStr: string, zone?: string): DateTime {
  return DateTime.fromISO(dateStr, { zone: zone ?? DEFAULT_TIMEZONE }).startOf(
    "day"
  );
}

/**
 * Parse an RFC 2822 date string (common in email headers)
 *
 * @param rfc - RFC 2822 formatted string (e.g., "Fri, 15 Mar 2024 14:30:00 -0500")
 * @returns Luxon DateTime
 */
export function fromRFC2822(rfc: string): DateTime {
  return DateTime.fromRFC2822(rfc);
}

/**
 * Parse a timestamp (milliseconds since Unix epoch)
 *
 * @param millis - Milliseconds since Unix epoch
 * @param zone - Target timezone
 * @returns Luxon DateTime
 */
export function fromMillis(millis: number, zone?: string): DateTime {
  return DateTime.fromMillis(millis, { zone: zone ?? DEFAULT_TIMEZONE });
}

/**
 * Parse a Unix timestamp (seconds since epoch)
 *
 * @param seconds - Seconds since Unix epoch
 * @param zone - Target timezone
 * @returns Luxon DateTime
 */
export function fromSeconds(seconds: number, zone?: string): DateTime {
  return DateTime.fromSeconds(seconds, { zone: zone ?? DEFAULT_TIMEZONE });
}

// ─────────────────────────────────────────────────────────────
// String Serialization
// ─────────────────────────────────────────────────────────────

/**
 * Convert DateTime to ISO 8601 string (full format with timezone)
 *
 * @param dt - Luxon DateTime
 * @returns ISO 8601 string (e.g., "2024-03-15T14:30:00.000-05:00")
 */
export function toISO(dt: DateTime): string {
  // Ensure we always get a valid string
  return dt.toISO() ?? dt.toUTC().toISO()!;
}

/**
 * Convert DateTime to date-only string (YYYY-MM-DD)
 *
 * @param dt - Luxon DateTime
 * @returns Date string (e.g., "2024-03-15")
 */
export function toDateString(dt: DateTime): string {
  return dt.toISODate()!;
}

/**
 * Convert DateTime to RFC 2822 format (for email headers)
 *
 * @param dt - Luxon DateTime
 * @returns RFC 2822 string
 */
export function toRFC2822(dt: DateTime): string {
  return dt.toRFC2822()!;
}

/**
 * Convert DateTime to Unix timestamp (seconds)
 *
 * @param dt - Luxon DateTime
 * @returns Seconds since Unix epoch
 */
export function toSeconds(dt: DateTime): number {
  return Math.floor(dt.toSeconds());
}

/**
 * Convert DateTime to milliseconds since epoch
 *
 * @param dt - Luxon DateTime
 * @returns Milliseconds since Unix epoch
 */
export function toMillis(dt: DateTime): number {
  return dt.toMillis();
}

// ─────────────────────────────────────────────────────────────
// Current Time Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Get current DateTime in specified timezone
 *
 * @param zone - Target timezone (defaults to UTC)
 * @returns Current DateTime
 */
export function now(zone?: string): DateTime {
  return DateTime.now().setZone(zone ?? DEFAULT_TIMEZONE);
}

/**
 * Get current DateTime in UTC
 *
 * @returns Current DateTime in UTC
 */
export function nowUTC(): DateTime {
  return DateTime.utc();
}

/**
 * Get current DateTime in the system's local timezone
 *
 * @returns Current DateTime in local timezone
 */
export function nowLocal(): DateTime {
  return DateTime.local();
}

/**
 * Get today's date at start of day in specified timezone
 *
 * @param zone - Target timezone
 * @returns DateTime at 00:00:00 today
 */
export function today(zone?: string): DateTime {
  return now(zone).startOf("day");
}

/**
 * Get tomorrow's date at start of day in specified timezone
 *
 * @param zone - Target timezone
 * @returns DateTime at 00:00:00 tomorrow
 */
export function tomorrow(zone?: string): DateTime {
  return now(zone).plus({ days: 1 }).startOf("day");
}

/**
 * Get yesterday's date at start of day in specified timezone
 *
 * @param zone - Target timezone
 * @returns DateTime at 00:00:00 yesterday
 */
export function yesterday(zone?: string): DateTime {
  return now(zone).minus({ days: 1 }).startOf("day");
}

// ─────────────────────────────────────────────────────────────
// Safe Parsing
// ─────────────────────────────────────────────────────────────

/**
 * Safely parse any date-like value to DateTime
 *
 * Returns null for invalid or unparseable inputs instead of throwing.
 *
 * @param value - Date, string, or number to parse
 * @param zone - Target timezone for parsed result
 * @returns DateTime or null if invalid
 *
 * @example
 * ```typescript
 * safeParse(new Date());              // DateTime
 * safeParse("2024-03-15T14:30:00Z"); // DateTime
 * safeParse(1710513000000);           // DateTime
 * safeParse("not a date");            // null
 * safeParse(null);                    // null
 * ```
 */
export function safeParse(value: unknown, zone?: string): DateTime | null {
  if (!value) return null;

  try {
    // Handle Date objects
    if (value instanceof Date) {
      const dt = fromDate(value, zone);
      return dt.isValid ? dt : null;
    }

    // Handle DateTime objects (convert to specified zone if provided)
    if (DateTime.isDateTime(value)) {
      if (!value.isValid) return null;
      return zone ? value.setZone(zone) : value;
    }

    // Handle strings
    if (typeof value === "string") {
      // Try ISO format first (most common)
      const iso = DateTime.fromISO(value, { zone: zone ?? DEFAULT_TIMEZONE });
      if (iso.isValid) return iso;

      // Try RFC2822 (common in email headers)
      const rfc = DateTime.fromRFC2822(value);
      if (rfc.isValid) return rfc;

      // Try SQL format
      const sql = DateTime.fromSQL(value, { zone: zone ?? DEFAULT_TIMEZONE });
      if (sql.isValid) return sql;

      // Try HTTP format
      const http = DateTime.fromHTTP(value);
      if (http.isValid) return http;

      return null;
    }

    // Handle numbers (assumed to be milliseconds)
    if (typeof value === "number") {
      // Sanity check: assume milliseconds if > 1e10 (after year 2001)
      // Otherwise assume seconds
      const dt =
        value > 1e10
          ? DateTime.fromMillis(value, { zone: zone ?? DEFAULT_TIMEZONE })
          : DateTime.fromSeconds(value, { zone: zone ?? DEFAULT_TIMEZONE });
      return dt.isValid ? dt : null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parse a value to DateTime, throwing on invalid input
 *
 * @param value - Value to parse
 * @param zone - Target timezone
 * @returns DateTime
 * @throws Error if parsing fails
 */
export function parse(value: unknown, zone?: string): DateTime {
  const result = safeParse(value, zone);
  if (!result) {
    throw new Error(`Unable to parse date value: ${String(value)}`);
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Prisma/Database Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Convert a nullable Date from database to DateTime or undefined
 *
 * Useful for Prisma optional DateTime fields.
 *
 * @param date - Date or null from database
 * @param zone - Target timezone
 * @returns DateTime or undefined
 */
export function fromDbDate(
  date: Date | null | undefined,
  zone?: string
): DateTime | undefined {
  return date ? fromDate(date, zone) : undefined;
}

/**
 * Convert DateTime to Date for database storage
 *
 * Returns undefined for undefined input (preserves optionality).
 *
 * @param dt - DateTime or undefined
 * @returns Date or undefined
 */
export function toDbDate(dt: DateTime | undefined): Date | undefined {
  return dt ? toDate(dt) : undefined;
}

