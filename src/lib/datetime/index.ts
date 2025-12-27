// ═══════════════════════════════════════════════════════════════════════════
// DateTime Utilities
// Centralized date/time handling using Luxon
// Replaces native JavaScript Date for timezone-aware, immutable date operations
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Re-export Luxon Core Types
// ─────────────────────────────────────────────────────────────

export { DateTime, Duration, Interval, Info } from "luxon";
export type {
  DateTimeOptions,
  DurationLike,
  DurationLikeObject,
  DateTimeUnit,
  DateObjectUnits,
  Zone,
} from "luxon";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

export {
  // Timezone
  DEFAULT_TIMEZONE,
  TIMEZONE_ALIASES,
  type TimezoneAlias,
  // Formats
  DATE_FORMATS,
  type DateFormatKey,
  // Durations
  DURATION_PRESETS,
  // Working hours
  DEFAULT_WORKING_HOURS,
  DEFAULT_MEETING_DURATION,
  MIN_SLOT_DURATION,
  MAX_SLOT_DURATION,
  // Weekdays
  WEEKDAYS,
  WEEKEND_DAYS,
  WEEKDAY_DAYS,
} from "./constants";

// ─────────────────────────────────────────────────────────────
// Converters
// ─────────────────────────────────────────────────────────────

export {
  // Core conversions
  fromDate,
  toDate,
  // String parsing
  fromISO,
  fromDateString,
  fromRFC2822,
  fromMillis,
  fromSeconds,
  // String serialization
  toISO,
  toDateString,
  toRFC2822,
  toSeconds,
  toMillis,
  // Current time
  now,
  nowUTC,
  nowLocal,
  today,
  tomorrow,
  yesterday,
  // Safe parsing
  safeParse,
  parse,
  // Database helpers
  fromDbDate,
  toDbDate,
} from "./converters";

// ─────────────────────────────────────────────────────────────
// Ranges
// ─────────────────────────────────────────────────────────────

export {
  // Types
  type DateRange,
  type NamedRange,
  // Named ranges
  getDateRange,
  // Relative ranges
  getNextDays,
  getPastDays,
  getNextHours,
  getNextWeeks,
  getNextMonths,
  // Range operations
  createRange,
  toInterval,
  isInRange,
  rangesOverlap,
  getRangeOverlap,
  mergeRanges,
  getRangeDuration,
  // Iteration
  eachDay,
  eachHour,
  eachWeek,
  eachMonth,
  // Business days
  getBusinessDays,
  getWeekendDays,
  countBusinessDays,
  addBusinessDays,
  subtractBusinessDays,
} from "./ranges";

// ─────────────────────────────────────────────────────────────
// Comparisons
// ─────────────────────────────────────────────────────────────

export {
  // Relative time checks
  isPast,
  isFuture,
  isNow,
  // Day-level checks
  isToday,
  isTomorrow,
  isYesterday,
  // Week/Month/Year checks
  isThisWeek,
  isThisMonth,
  isThisYear,
  // Weekday checks
  isWeekend,
  isWeekday,
  isSpecificWeekday,
  // Range checks
  isWithinDays,
  isWithinHours,
  isWithinMinutes,
  isWithinPastDays,
  // Comparison functions
  daysBetween,
  daysUntil,
  hoursUntil,
  minutesUntil,
  earliest,
  latest,
  // Same-unit checks
  isSameDay,
  isSameWeek,
  isSameMonth,
  isSameYear,
  isSameHour,
  // Time-of-day checks
  isStartOfDay,
  isEndOfDay,
  isWithinWorkingHours,
  // Overlap detection
  timesOverlap,
  timesAreClose,
} from "./comparisons";

// ─────────────────────────────────────────────────────────────
// Durations
// ─────────────────────────────────────────────────────────────

export {
  // Duration creation
  durationFromMinutes,
  durationFromHours,
  durationFromDays,
  durationFrom,
  durationFromMillis,
  // Duration between
  durationBetween,
  minutesBetween,
  hoursBetween,
  daysBetweenDuration,
  // Duration arithmetic
  addDuration,
  subtractDuration,
  addMinutes,
  addHours,
  addDays,
  addWeeks,
  addMonths,
  // Duration formatting
  formatDuration,
  formatDurationLong,
  formatDurationClock,
  // Duration conversion
  toTotalMinutes,
  toTotalHours,
  toTotalDays,
  toTotalMillis,
  // Duration comparison
  isZeroDuration,
  isPositiveDuration,
  isNegativeDuration,
  isLongerThan,
  isShorterThan,
  absDuration,
} from "./durations";

// ─────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────

export {
  // Basic formatting
  formatDate,
  formatISO,
  formatDateOnly,
  formatTime,
  formatTime24,
  // Relative formatting
  formatRelative,
  formatRelativeTo,
  formatCalendar,
  friendlyDate,
  // Localized formatting
  formatLocalized,
  formatForLocale,
  formatLocalizedDate,
  formatLocalizedDateTime,
  // Range formatting
  formatDateRange,
  formatTimeRange,
  // Weekday formatting
  getWeekdayName,
  getWeekdayAbbr,
  getMonthName,
  getMonthAbbr,
  // Ordinal formatting
  getDayWithOrdinal,
  formatWithOrdinal,
} from "./formatters";

// ─────────────────────────────────────────────────────────────
// Timezone Utilities
// ─────────────────────────────────────────────────────────────

export {
  // Validation
  isValidTimezone,
  resolveTimezone,
  safeTimezone,
  // Information
  getLocalTimezone,
  getUTCOffset,
  getUTCOffsetMinutes,
  getTimezoneAbbr,
  getTimezoneShortAbbr,
  isInDST,
  getNextDSTTransition,
  // Conversion
  toTimezone,
  toUTC,
  toLocal,
  setTimezoneKeepLocal,
  // Lists
  type TimezoneOption,
  getCommonTimezones,
  getAllTimezones,
  searchTimezones,
} from "./zones";

