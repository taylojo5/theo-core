// ═══════════════════════════════════════════════════════════════════════════
// DateTime Comparisons
// Utility functions for comparing and checking dates
// ═══════════════════════════════════════════════════════════════════════════

import { DateTime } from "luxon";
import { now } from "./converters";
import { WEEKDAYS } from "./constants";

// ─────────────────────────────────────────────────────────────
// Relative Time Checks
// ─────────────────────────────────────────────────────────────

/**
 * Check if a DateTime is in the past
 *
 * @param dt - DateTime to check
 * @returns true if dt is before now
 */
export function isPast(dt: DateTime): boolean {
  return dt < now();
}

/**
 * Check if a DateTime is in the future
 *
 * @param dt - DateTime to check
 * @returns true if dt is after now
 */
export function isFuture(dt: DateTime): boolean {
  return dt > now();
}

/**
 * Check if a DateTime is right now (within a tolerance)
 *
 * @param dt - DateTime to check
 * @param toleranceMs - Tolerance in milliseconds (default 1000ms)
 * @returns true if dt is within tolerance of now
 */
export function isNow(dt: DateTime, toleranceMs: number = 1000): boolean {
  const diff = Math.abs(dt.diffNow().milliseconds);
  return diff <= toleranceMs;
}

// ─────────────────────────────────────────────────────────────
// Day-Level Checks
// ─────────────────────────────────────────────────────────────

/**
 * Check if a DateTime is today
 *
 * @param dt - DateTime to check
 * @param zone - Timezone for comparison (uses dt's zone if not specified)
 * @returns true if dt is the same calendar day as today
 */
export function isToday(dt: DateTime, zone?: string): boolean {
  const reference = zone ? now(zone) : now(dt.zoneName ?? undefined);
  const comparison = zone ? dt.setZone(zone) : dt;
  return comparison.hasSame(reference, "day");
}

/**
 * Check if a DateTime is tomorrow
 *
 * @param dt - DateTime to check
 * @param zone - Timezone for comparison
 * @returns true if dt is tomorrow's calendar day
 */
export function isTomorrow(dt: DateTime, zone?: string): boolean {
  const reference = zone ? now(zone) : now(dt.zoneName ?? undefined);
  const tmrw = reference.plus({ days: 1 });
  const comparison = zone ? dt.setZone(zone) : dt;
  return comparison.hasSame(tmrw, "day");
}

/**
 * Check if a DateTime is yesterday
 *
 * @param dt - DateTime to check
 * @param zone - Timezone for comparison
 * @returns true if dt is yesterday's calendar day
 */
export function isYesterday(dt: DateTime, zone?: string): boolean {
  const reference = zone ? now(zone) : now(dt.zoneName ?? undefined);
  const yest = reference.minus({ days: 1 });
  const comparison = zone ? dt.setZone(zone) : dt;
  return comparison.hasSame(yest, "day");
}

// ─────────────────────────────────────────────────────────────
// Week/Month/Year Checks
// ─────────────────────────────────────────────────────────────

/**
 * Check if a DateTime is in this week
 *
 * @param dt - DateTime to check
 * @param zone - Timezone for comparison
 * @returns true if dt is in the current week
 */
export function isThisWeek(dt: DateTime, zone?: string): boolean {
  const reference = zone ? now(zone) : now(dt.zoneName ?? undefined);
  const comparison = zone ? dt.setZone(zone) : dt;
  return comparison.hasSame(reference, "week");
}

/**
 * Check if a DateTime is in this month
 *
 * @param dt - DateTime to check
 * @param zone - Timezone for comparison
 * @returns true if dt is in the current month
 */
export function isThisMonth(dt: DateTime, zone?: string): boolean {
  const reference = zone ? now(zone) : now(dt.zoneName ?? undefined);
  const comparison = zone ? dt.setZone(zone) : dt;
  return comparison.hasSame(reference, "month");
}

/**
 * Check if a DateTime is in this year
 *
 * @param dt - DateTime to check
 * @param zone - Timezone for comparison
 * @returns true if dt is in the current year
 */
export function isThisYear(dt: DateTime, zone?: string): boolean {
  const reference = zone ? now(zone) : now(dt.zoneName ?? undefined);
  const comparison = zone ? dt.setZone(zone) : dt;
  return comparison.hasSame(reference, "year");
}

// ─────────────────────────────────────────────────────────────
// Weekday Checks
// ─────────────────────────────────────────────────────────────

/**
 * Check if a DateTime is a weekend day (Saturday or Sunday)
 *
 * @param dt - DateTime to check
 * @returns true if dt is Saturday or Sunday
 */
export function isWeekend(dt: DateTime): boolean {
  return dt.weekday >= WEEKDAYS.SATURDAY; // 6 = Sat, 7 = Sun
}

/**
 * Check if a DateTime is a weekday (Monday-Friday)
 *
 * @param dt - DateTime to check
 * @returns true if dt is Monday through Friday
 */
export function isWeekday(dt: DateTime): boolean {
  return dt.weekday <= WEEKDAYS.FRIDAY; // 1-5 = Mon-Fri
}

/**
 * Check if a DateTime is a specific day of the week
 *
 * @param dt - DateTime to check
 * @param weekday - Luxon weekday number (1=Monday, 7=Sunday)
 * @returns true if dt is the specified weekday
 */
export function isSpecificWeekday(dt: DateTime, weekday: number): boolean {
  return dt.weekday === weekday;
}

// ─────────────────────────────────────────────────────────────
// Range Checks
// ─────────────────────────────────────────────────────────────

/**
 * Check if a DateTime is within N days from now
 *
 * @param dt - DateTime to check
 * @param days - Number of days
 * @returns true if dt is between now and N days from now
 */
export function isWithinDays(dt: DateTime, days: number): boolean {
  const current = now();
  const future = current.plus({ days });
  return dt >= current && dt <= future;
}

/**
 * Check if a DateTime is within N hours from now
 *
 * @param dt - DateTime to check
 * @param hours - Number of hours
 * @returns true if dt is between now and N hours from now
 */
export function isWithinHours(dt: DateTime, hours: number): boolean {
  const current = now();
  const future = current.plus({ hours });
  return dt >= current && dt <= future;
}

/**
 * Check if a DateTime is within N minutes from now
 *
 * @param dt - DateTime to check
 * @param minutes - Number of minutes
 * @returns true if dt is between now and N minutes from now
 */
export function isWithinMinutes(dt: DateTime, minutes: number): boolean {
  const current = now();
  const future = current.plus({ minutes });
  return dt >= current && dt <= future;
}

/**
 * Check if a DateTime was within the past N days
 *
 * @param dt - DateTime to check
 * @param days - Number of days
 * @returns true if dt is between N days ago and now
 */
export function isWithinPastDays(dt: DateTime, days: number): boolean {
  const current = now();
  const past = current.minus({ days });
  return dt >= past && dt <= current;
}

// ─────────────────────────────────────────────────────────────
// Comparison Functions
// ─────────────────────────────────────────────────────────────

/**
 * Get the number of whole days between two DateTimes
 *
 * @param a - First DateTime
 * @param b - Second DateTime
 * @returns Absolute number of days (always positive)
 */
export function daysBetween(a: DateTime, b: DateTime): number {
  return Math.floor(Math.abs(b.diff(a, "days").days));
}

/**
 * Get days remaining until a date (negative if past)
 *
 * @param dt - Target DateTime
 * @returns Number of days until dt (negative if dt is in the past)
 */
export function daysUntil(dt: DateTime): number {
  const diff = dt.diff(now(), "days").days;
  return Math.ceil(diff);
}

/**
 * Get hours remaining until a date (negative if past)
 *
 * @param dt - Target DateTime
 * @returns Number of hours until dt
 */
export function hoursUntil(dt: DateTime): number {
  return dt.diff(now(), "hours").hours;
}

/**
 * Get minutes remaining until a date (negative if past)
 *
 * @param dt - Target DateTime
 * @returns Number of minutes until dt
 */
export function minutesUntil(dt: DateTime): number {
  return dt.diff(now(), "minutes").minutes;
}

/**
 * Get the earliest of multiple DateTimes
 *
 * @param dates - DateTimes to compare (must have at least one)
 * @returns The earliest DateTime
 * @throws Error if no dates are provided
 */
export function earliest(...dates: DateTime[]): DateTime {
  if (dates.length === 0) {
    throw new Error("earliest() requires at least one DateTime argument");
  }
  const result = DateTime.min(...dates);
  if (!result) {
    throw new Error("earliest() received invalid DateTime values");
  }
  return result;
}

/**
 * Get the latest of multiple DateTimes
 *
 * @param dates - DateTimes to compare (must have at least one)
 * @returns The latest DateTime
 * @throws Error if no dates are provided
 */
export function latest(...dates: DateTime[]): DateTime {
  if (dates.length === 0) {
    throw new Error("latest() requires at least one DateTime argument");
  }
  const result = DateTime.max(...dates);
  if (!result) {
    throw new Error("latest() received invalid DateTime values");
  }
  return result;
}

// ─────────────────────────────────────────────────────────────
// Same-Unit Checks
// ─────────────────────────────────────────────────────────────

/**
 * Check if two DateTimes are the same calendar day
 *
 * @param a - First DateTime
 * @param b - Second DateTime
 * @returns true if same year, month, and day
 */
export function isSameDay(a: DateTime, b: DateTime): boolean {
  return a.hasSame(b, "day");
}

/**
 * Check if two DateTimes are the same week
 *
 * @param a - First DateTime
 * @param b - Second DateTime
 * @returns true if same ISO week
 */
export function isSameWeek(a: DateTime, b: DateTime): boolean {
  return a.hasSame(b, "week");
}

/**
 * Check if two DateTimes are the same month
 *
 * @param a - First DateTime
 * @param b - Second DateTime
 * @returns true if same year and month
 */
export function isSameMonth(a: DateTime, b: DateTime): boolean {
  return a.hasSame(b, "month");
}

/**
 * Check if two DateTimes are the same year
 *
 * @param a - First DateTime
 * @param b - Second DateTime
 * @returns true if same year
 */
export function isSameYear(a: DateTime, b: DateTime): boolean {
  return a.hasSame(b, "year");
}

/**
 * Check if two DateTimes are the same hour
 *
 * @param a - First DateTime
 * @param b - Second DateTime
 * @returns true if same year, month, day, and hour
 */
export function isSameHour(a: DateTime, b: DateTime): boolean {
  return a.hasSame(b, "hour");
}

// ─────────────────────────────────────────────────────────────
// Time-of-Day Checks
// ─────────────────────────────────────────────────────────────

/**
 * Check if a DateTime is at the start of its day (midnight)
 *
 * @param dt - DateTime to check
 * @returns true if time is 00:00:00.000
 */
export function isStartOfDay(dt: DateTime): boolean {
  return dt.equals(dt.startOf("day"));
}

/**
 * Check if a DateTime is at the end of its day (23:59:59.999)
 *
 * @param dt - DateTime to check
 * @returns true if time is end of day
 */
export function isEndOfDay(dt: DateTime): boolean {
  return dt.equals(dt.endOf("day"));
}

/**
 * Check if a DateTime is within working hours
 *
 * @param dt - DateTime to check
 * @param startHour - Start of working hours (default 9)
 * @param endHour - End of working hours (default 17)
 * @returns true if within working hours
 */
export function isWithinWorkingHours(
  dt: DateTime,
  startHour: number = 9,
  endHour: number = 17
): boolean {
  return dt.hour >= startHour && dt.hour < endHour;
}

// ─────────────────────────────────────────────────────────────
// Overlap Detection
// ─────────────────────────────────────────────────────────────

/**
 * Check if two time ranges overlap
 *
 * @param startA - Start of first range
 * @param endA - End of first range
 * @param startB - Start of second range
 * @param endB - End of second range
 * @returns true if ranges overlap
 */
export function timesOverlap(
  startA: DateTime,
  endA: DateTime,
  startB: DateTime,
  endB: DateTime
): boolean {
  return startA < endB && endA > startB;
}

/**
 * Check if two times are within a threshold of each other
 *
 * @param a - First DateTime
 * @param b - Second DateTime
 * @param thresholdMinutes - Threshold in minutes
 * @returns true if times are within threshold
 */
export function timesAreClose(
  a: DateTime,
  b: DateTime,
  thresholdMinutes: number
): boolean {
  const diffMs = Math.abs(a.diff(b).milliseconds);
  return diffMs <= thresholdMinutes * 60 * 1000;
}

