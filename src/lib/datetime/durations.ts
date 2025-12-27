// ═══════════════════════════════════════════════════════════════════════════
// Duration Utilities
// Functions for working with time durations
// ═══════════════════════════════════════════════════════════════════════════

import { DateTime, Duration, type DurationLikeObject } from "luxon";

// ─────────────────────────────────────────────────────────────
// Duration Creation
// ─────────────────────────────────────────────────────────────

/**
 * Create a Duration from minutes
 *
 * @param minutes - Number of minutes
 * @returns Luxon Duration
 */
export function durationFromMinutes(minutes: number): Duration {
  return Duration.fromObject({ minutes });
}

/**
 * Create a Duration from hours
 *
 * @param hours - Number of hours
 * @returns Luxon Duration
 */
export function durationFromHours(hours: number): Duration {
  return Duration.fromObject({ hours });
}

/**
 * Create a Duration from days
 *
 * @param days - Number of days
 * @returns Luxon Duration
 */
export function durationFromDays(days: number): Duration {
  return Duration.fromObject({ days });
}

/**
 * Create a Duration from an object
 *
 * @param obj - Duration object (e.g., { hours: 2, minutes: 30 })
 * @returns Luxon Duration
 */
export function durationFrom(obj: DurationLikeObject): Duration {
  return Duration.fromObject(obj);
}

/**
 * Create a Duration from milliseconds
 *
 * @param ms - Milliseconds
 * @returns Luxon Duration
 */
export function durationFromMillis(ms: number): Duration {
  return Duration.fromMillis(ms);
}

// ─────────────────────────────────────────────────────────────
// Duration Between DateTimes
// ─────────────────────────────────────────────────────────────

/**
 * Get the Duration between two DateTimes
 *
 * @param start - Start DateTime
 * @param end - End DateTime
 * @returns Duration (can be negative if end < start)
 */
export function durationBetween(start: DateTime, end: DateTime): Duration {
  return end.diff(start);
}

/**
 * Get minutes between two DateTimes
 *
 * @param start - Start DateTime
 * @param end - End DateTime
 * @returns Number of minutes (rounded)
 */
export function minutesBetween(start: DateTime, end: DateTime): number {
  return Math.round(end.diff(start, "minutes").minutes);
}

/**
 * Get hours between two DateTimes
 *
 * @param start - Start DateTime
 * @param end - End DateTime
 * @returns Number of hours (decimal)
 */
export function hoursBetween(start: DateTime, end: DateTime): number {
  return end.diff(start, "hours").hours;
}

/**
 * Get days between two DateTimes
 *
 * @param start - Start DateTime
 * @param end - End DateTime
 * @returns Number of days (decimal)
 */
export function daysBetweenDuration(start: DateTime, end: DateTime): number {
  return end.diff(start, "days").days;
}

// ─────────────────────────────────────────────────────────────
// Duration Arithmetic
// ─────────────────────────────────────────────────────────────

/**
 * Add a Duration to a DateTime
 *
 * @param dt - Starting DateTime
 * @param duration - Duration to add
 * @returns New DateTime
 */
export function addDuration(dt: DateTime, duration: Duration): DateTime {
  return dt.plus(duration);
}

/**
 * Subtract a Duration from a DateTime
 *
 * @param dt - Starting DateTime
 * @param duration - Duration to subtract
 * @returns New DateTime
 */
export function subtractDuration(dt: DateTime, duration: Duration): DateTime {
  return dt.minus(duration);
}

/**
 * Add minutes to a DateTime
 *
 * @param dt - Starting DateTime
 * @param minutes - Minutes to add
 * @returns New DateTime
 */
export function addMinutes(dt: DateTime, minutes: number): DateTime {
  return dt.plus({ minutes });
}

/**
 * Add hours to a DateTime
 *
 * @param dt - Starting DateTime
 * @param hours - Hours to add
 * @returns New DateTime
 */
export function addHours(dt: DateTime, hours: number): DateTime {
  return dt.plus({ hours });
}

/**
 * Add days to a DateTime
 *
 * @param dt - Starting DateTime
 * @param days - Days to add
 * @returns New DateTime
 */
export function addDays(dt: DateTime, days: number): DateTime {
  return dt.plus({ days });
}

/**
 * Add weeks to a DateTime
 *
 * @param dt - Starting DateTime
 * @param weeks - Weeks to add
 * @returns New DateTime
 */
export function addWeeks(dt: DateTime, weeks: number): DateTime {
  return dt.plus({ weeks });
}

/**
 * Add months to a DateTime
 *
 * @param dt - Starting DateTime
 * @param months - Months to add
 * @returns New DateTime
 */
export function addMonths(dt: DateTime, months: number): DateTime {
  return dt.plus({ months });
}

// ─────────────────────────────────────────────────────────────
// Duration Formatting
// ─────────────────────────────────────────────────────────────

/**
 * Format a Duration for human-readable display
 *
 * @param duration - Duration to format
 * @returns Formatted string (e.g., "2h 30m", "45m", "3d")
 */
export function formatDuration(duration: Duration): string {
  const normalized = duration.shiftTo("days", "hours", "minutes").normalize();
  const days = Math.floor(normalized.days);
  const hours = Math.floor(normalized.hours);
  const minutes = Math.round(normalized.minutes);

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days}d`);
  }

  if (hours > 0) {
    parts.push(`${hours}h`);
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes}m`);
  }

  return parts.join(" ");
}

/**
 * Format a Duration in long form
 *
 * @param duration - Duration to format
 * @returns Formatted string (e.g., "2 hours 30 minutes")
 */
export function formatDurationLong(duration: Duration): string {
  const normalized = duration.shiftTo("days", "hours", "minutes").normalize();
  const days = Math.floor(normalized.days);
  const hours = Math.floor(normalized.hours);
  const minutes = Math.round(normalized.minutes);

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} day${days !== 1 ? "s" : ""}`);
  }

  if (hours > 0) {
    parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
  }

  if (minutes > 0 || parts.length === 0) {
    parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
  }

  return parts.join(" ");
}

/**
 * Format a Duration as clock time (HH:MM)
 *
 * @param duration - Duration to format
 * @returns Formatted string (e.g., "02:30")
 */
export function formatDurationClock(duration: Duration): string {
  const normalized = duration.shiftTo("hours", "minutes").normalize();
  const hours = Math.floor(normalized.hours);
  const minutes = Math.round(normalized.minutes);

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// Duration Conversion
// ─────────────────────────────────────────────────────────────

/**
 * Convert Duration to total minutes
 *
 * @param duration - Duration to convert
 * @returns Total minutes
 */
export function toTotalMinutes(duration: Duration): number {
  return duration.as("minutes");
}

/**
 * Convert Duration to total hours
 *
 * @param duration - Duration to convert
 * @returns Total hours (decimal)
 */
export function toTotalHours(duration: Duration): number {
  return duration.as("hours");
}

/**
 * Convert Duration to total days
 *
 * @param duration - Duration to convert
 * @returns Total days (decimal)
 */
export function toTotalDays(duration: Duration): number {
  return duration.as("days");
}

/**
 * Convert Duration to milliseconds
 *
 * @param duration - Duration to convert
 * @returns Milliseconds
 */
export function toTotalMillis(duration: Duration): number {
  return duration.toMillis();
}

// ─────────────────────────────────────────────────────────────
// Duration Comparison
// ─────────────────────────────────────────────────────────────

/**
 * Check if a Duration is zero
 *
 * @param duration - Duration to check
 * @returns true if duration is zero
 */
export function isZeroDuration(duration: Duration): boolean {
  return duration.toMillis() === 0;
}

/**
 * Check if a Duration is positive
 *
 * @param duration - Duration to check
 * @returns true if duration is greater than zero
 */
export function isPositiveDuration(duration: Duration): boolean {
  return duration.toMillis() > 0;
}

/**
 * Check if a Duration is negative
 *
 * @param duration - Duration to check
 * @returns true if duration is less than zero
 */
export function isNegativeDuration(duration: Duration): boolean {
  return duration.toMillis() < 0;
}

/**
 * Check if duration A is longer than duration B
 *
 * @param a - First duration
 * @param b - Second duration
 * @returns true if a > b
 */
export function isLongerThan(a: Duration, b: Duration): boolean {
  return a.toMillis() > b.toMillis();
}

/**
 * Check if duration A is shorter than duration B
 *
 * @param a - First duration
 * @param b - Second duration
 * @returns true if a < b
 */
export function isShorterThan(a: Duration, b: Duration): boolean {
  return a.toMillis() < b.toMillis();
}

/**
 * Get the absolute value of a Duration
 *
 * @param duration - Duration (possibly negative)
 * @returns Positive duration
 */
export function absDuration(duration: Duration): Duration {
  const ms = duration.toMillis();
  return ms < 0 ? Duration.fromMillis(-ms) : duration;
}

