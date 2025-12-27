// ═══════════════════════════════════════════════════════════════════════════
// Date Range Utilities
// Functions for working with date ranges and intervals
// ═══════════════════════════════════════════════════════════════════════════

import { DateTime, Interval } from "luxon";
import { now } from "./converters";
import { WEEKDAYS } from "./constants";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/** A date range with start and end DateTimes */
export interface DateRange {
  start: DateTime;
  end: DateTime;
}

/** Named range types for common periods */
export type NamedRange =
  | "today"
  | "tomorrow"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "nextWeek"
  | "thisMonth"
  | "lastMonth"
  | "nextMonth"
  | "thisQuarter"
  | "lastQuarter"
  | "thisYear"
  | "lastYear";

// ─────────────────────────────────────────────────────────────
// Named Range Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Get date range for common named periods
 *
 * @param range - Named period
 * @param zone - Timezone for the range
 * @returns DateRange with start and end
 *
 * @example
 * ```typescript
 * getDateRange("thisWeek");           // Current week Mon-Sun
 * getDateRange("nextMonth", "America/New_York"); // Next month in NYC
 * ```
 */
export function getDateRange(range: NamedRange, zone?: string): DateRange {
  const current = now(zone);

  switch (range) {
    case "today":
      return {
        start: current.startOf("day"),
        end: current.endOf("day"),
      };

    case "tomorrow": {
      const tmrw = current.plus({ days: 1 });
      return {
        start: tmrw.startOf("day"),
        end: tmrw.endOf("day"),
      };
    }

    case "yesterday": {
      const yest = current.minus({ days: 1 });
      return {
        start: yest.startOf("day"),
        end: yest.endOf("day"),
      };
    }

    case "thisWeek":
      return {
        start: current.startOf("week"),
        end: current.endOf("week"),
      };

    case "lastWeek": {
      const lastWeek = current.minus({ weeks: 1 });
      return {
        start: lastWeek.startOf("week"),
        end: lastWeek.endOf("week"),
      };
    }

    case "nextWeek": {
      const nextWeek = current.plus({ weeks: 1 });
      return {
        start: nextWeek.startOf("week"),
        end: nextWeek.endOf("week"),
      };
    }

    case "thisMonth":
      return {
        start: current.startOf("month"),
        end: current.endOf("month"),
      };

    case "lastMonth": {
      const lastMonth = current.minus({ months: 1 });
      return {
        start: lastMonth.startOf("month"),
        end: lastMonth.endOf("month"),
      };
    }

    case "nextMonth": {
      const nextMonth = current.plus({ months: 1 });
      return {
        start: nextMonth.startOf("month"),
        end: nextMonth.endOf("month"),
      };
    }

    case "thisQuarter":
      return {
        start: current.startOf("quarter"),
        end: current.endOf("quarter"),
      };

    case "lastQuarter": {
      const lastQuarter = current.minus({ quarters: 1 });
      return {
        start: lastQuarter.startOf("quarter"),
        end: lastQuarter.endOf("quarter"),
      };
    }

    case "thisYear":
      return {
        start: current.startOf("year"),
        end: current.endOf("year"),
      };

    case "lastYear": {
      const lastYear = current.minus({ years: 1 });
      return {
        start: lastYear.startOf("year"),
        end: lastYear.endOf("year"),
      };
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Relative Range Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Get a date range for the next N days (from now)
 *
 * @param days - Number of days
 * @param zone - Timezone
 * @returns DateRange from now to N days in the future
 */
export function getNextDays(days: number, zone?: string): DateRange {
  const current = now(zone);
  return {
    start: current,
    end: current.plus({ days }).endOf("day"),
  };
}

/**
 * Get a date range for the past N days (ending now)
 *
 * @param days - Number of days
 * @param zone - Timezone
 * @returns DateRange from N days ago to now
 */
export function getPastDays(days: number, zone?: string): DateRange {
  const current = now(zone);
  return {
    start: current.minus({ days }).startOf("day"),
    end: current,
  };
}

/**
 * Get a date range for the next N hours
 *
 * @param hours - Number of hours
 * @param zone - Timezone
 * @returns DateRange from now to N hours in the future
 */
export function getNextHours(hours: number, zone?: string): DateRange {
  const current = now(zone);
  return {
    start: current,
    end: current.plus({ hours }),
  };
}

/**
 * Get a date range for the next N weeks
 *
 * @param weeks - Number of weeks
 * @param zone - Timezone
 * @returns DateRange from start of this week to end of N weeks from now
 */
export function getNextWeeks(weeks: number, zone?: string): DateRange {
  const current = now(zone);
  return {
    start: current.startOf("week"),
    end: current.plus({ weeks }).endOf("week"),
  };
}

/**
 * Get a date range for the next N months
 *
 * @param months - Number of months
 * @param zone - Timezone
 * @returns DateRange from start of this month to end of N months from now
 */
export function getNextMonths(months: number, zone?: string): DateRange {
  const current = now(zone);
  return {
    start: current.startOf("month"),
    end: current.plus({ months }).endOf("month"),
  };
}

// ─────────────────────────────────────────────────────────────
// Range Operations
// ─────────────────────────────────────────────────────────────

/**
 * Create a DateRange from start and end DateTimes
 *
 * @param start - Start DateTime
 * @param end - End DateTime
 * @returns DateRange
 */
export function createRange(start: DateTime, end: DateTime): DateRange {
  return { start, end };
}

/**
 * Convert DateRange to Luxon Interval
 *
 * @param range - DateRange
 * @returns Luxon Interval
 */
export function toInterval(range: DateRange): Interval {
  return Interval.fromDateTimes(range.start, range.end);
}

/**
 * Check if a DateTime falls within a range (inclusive)
 *
 * @param dt - DateTime to check
 * @param range - DateRange to check against
 * @returns true if dt is within the range
 */
export function isInRange(dt: DateTime, range: DateRange): boolean {
  return dt >= range.start && dt <= range.end;
}

/**
 * Check if two date ranges overlap
 *
 * @param a - First range
 * @param b - Second range
 * @returns true if ranges overlap
 */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  return a.start < b.end && a.end > b.start;
}

/**
 * Get the overlap between two date ranges
 *
 * @param a - First range
 * @param b - Second range
 * @returns DateRange of overlap, or null if no overlap
 */
export function getRangeOverlap(a: DateRange, b: DateRange): DateRange | null {
  if (!rangesOverlap(a, b)) return null;

  return {
    start: a.start > b.start ? a.start : b.start,
    end: a.end < b.end ? a.end : b.end,
  };
}

/**
 * Merge two overlapping or adjacent ranges
 *
 * @param a - First range
 * @param b - Second range
 * @returns Merged range, or null if ranges don't overlap/touch
 */
export function mergeRanges(a: DateRange, b: DateRange): DateRange | null {
  // Check if ranges overlap or are adjacent (end of one = start of other)
  const adjacent = a.end.equals(b.start) || b.end.equals(a.start);
  if (!rangesOverlap(a, b) && !adjacent) return null;

  return {
    start: a.start < b.start ? a.start : b.start,
    end: a.end > b.end ? a.end : b.end,
  };
}

/**
 * Get the duration of a range in specified units
 *
 * @param range - DateRange
 * @param unit - Duration unit (minutes, hours, days, etc.)
 * @returns Number of units
 */
export function getRangeDuration(
  range: DateRange,
  unit: "minutes" | "hours" | "days" | "weeks" | "months"
): number {
  return range.end.diff(range.start, unit)[unit];
}

// ─────────────────────────────────────────────────────────────
// Day Iteration
// ─────────────────────────────────────────────────────────────

/**
 * Iterate through each day in a range
 *
 * @param range - DateRange to iterate
 * @yields DateTime for each day (at start of day)
 *
 * @example
 * ```typescript
 * for (const day of eachDay(range)) {
 *   console.log(day.toISODate());
 * }
 * ```
 */
export function* eachDay(range: DateRange): Generator<DateTime> {
  let current = range.start.startOf("day");
  const endDay = range.end.startOf("day");

  while (current <= endDay) {
    yield current;
    current = current.plus({ days: 1 });
  }
}

/**
 * Iterate through each hour in a range
 *
 * @param range - DateRange to iterate
 * @yields DateTime for each hour (at start of hour)
 */
export function* eachHour(range: DateRange): Generator<DateTime> {
  let current = range.start.startOf("hour");

  while (current <= range.end) {
    yield current;
    current = current.plus({ hours: 1 });
  }
}

/**
 * Iterate through each week in a range
 *
 * @param range - DateRange to iterate
 * @yields DateTime for each week (at start of week)
 */
export function* eachWeek(range: DateRange): Generator<DateTime> {
  let current = range.start.startOf("week");

  while (current <= range.end) {
    yield current;
    current = current.plus({ weeks: 1 });
  }
}

/**
 * Iterate through each month in a range
 *
 * @param range - DateRange to iterate
 * @yields DateTime for each month (at start of month)
 */
export function* eachMonth(range: DateRange): Generator<DateTime> {
  let current = range.start.startOf("month");

  while (current <= range.end) {
    yield current;
    current = current.plus({ months: 1 });
  }
}

// ─────────────────────────────────────────────────────────────
// Business Day Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Get all business days (weekdays) in a range
 *
 * @param range - DateRange
 * @returns Array of DateTimes for each weekday
 */
export function getBusinessDays(range: DateRange): DateTime[] {
  const days: DateTime[] = [];

  for (const day of eachDay(range)) {
    // Luxon weekday: 1 = Monday, 5 = Friday
    if (day.weekday <= WEEKDAYS.FRIDAY) {
      days.push(day);
    }
  }

  return days;
}

/**
 * Get all weekend days in a range
 *
 * @param range - DateRange
 * @returns Array of DateTimes for each weekend day
 */
export function getWeekendDays(range: DateRange): DateTime[] {
  const days: DateTime[] = [];

  for (const day of eachDay(range)) {
    // Luxon weekday: 6 = Saturday, 7 = Sunday
    if (day.weekday >= WEEKDAYS.SATURDAY) {
      days.push(day);
    }
  }

  return days;
}

/**
 * Count business days in a range
 *
 * @param range - DateRange
 * @returns Number of business days
 */
export function countBusinessDays(range: DateRange): number {
  return getBusinessDays(range).length;
}

/**
 * Add N business days to a date
 *
 * @param dt - Starting DateTime
 * @param days - Number of business days to add
 * @returns DateTime N business days later
 */
export function addBusinessDays(dt: DateTime, days: number): DateTime {
  let result = dt;
  let remaining = days;

  while (remaining > 0) {
    result = result.plus({ days: 1 });
    if (result.weekday <= WEEKDAYS.FRIDAY) {
      remaining--;
    }
  }

  return result;
}

/**
 * Subtract N business days from a date
 *
 * @param dt - Starting DateTime
 * @param days - Number of business days to subtract
 * @returns DateTime N business days earlier
 */
export function subtractBusinessDays(dt: DateTime, days: number): DateTime {
  let result = dt;
  let remaining = days;

  while (remaining > 0) {
    result = result.minus({ days: 1 });
    if (result.weekday <= WEEKDAYS.FRIDAY) {
      remaining--;
    }
  }

  return result;
}

