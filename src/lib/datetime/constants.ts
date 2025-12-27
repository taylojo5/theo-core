// ═══════════════════════════════════════════════════════════════════════════
// DateTime Constants
// Timezone aliases, date formats, and duration presets
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Timezone Constants
// ─────────────────────────────────────────────────────────────

/** Default timezone for server operations */
export const DEFAULT_TIMEZONE = "UTC";

/** Common timezone aliases for quick access */
export const TIMEZONE_ALIASES = {
  EASTERN: "America/New_York",
  PACIFIC: "America/Los_Angeles",
  CENTRAL: "America/Chicago",
  MOUNTAIN: "America/Denver",
  ARIZONA: "America/Phoenix",
  ALASKA: "America/Anchorage",
  HAWAII: "Pacific/Honolulu",
  UTC: "UTC",
  // European
  LONDON: "Europe/London",
  PARIS: "Europe/Paris",
  BERLIN: "Europe/Berlin",
  // Asian
  TOKYO: "Asia/Tokyo",
  SHANGHAI: "Asia/Shanghai",
  SINGAPORE: "Asia/Singapore",
  // Oceania
  SYDNEY: "Australia/Sydney",
} as const;

export type TimezoneAlias = keyof typeof TIMEZONE_ALIASES;

// ─────────────────────────────────────────────────────────────
// Date Format Presets
// ─────────────────────────────────────────────────────────────

/**
 * Standard date/time format strings for use with Luxon's toFormat()
 *
 * Luxon format tokens:
 * - yyyy: 4-digit year
 * - MM: 2-digit month
 * - dd: 2-digit day
 * - HH: 24-hour hour
 * - hh: 12-hour hour
 * - mm: minutes
 * - ss: seconds
 * - SSS: milliseconds
 * - a: AM/PM
 * - EEEE: Full weekday name
 * - EEE: Abbreviated weekday name
 * - MMM: Abbreviated month name
 * - MMMM: Full month name
 * - ZZ: Timezone offset (+00:00)
 * - ZZZ: Timezone offset (+0000)
 * - ZZZZ: Timezone name (Eastern Standard Time)
 * - z: Timezone abbreviation (EST)
 */
export const DATE_FORMATS = {
  // ISO formats (for APIs and databases)
  ISO_DATE: "yyyy-MM-dd",
  ISO_DATETIME: "yyyy-MM-dd'T'HH:mm:ss",
  ISO_FULL: "yyyy-MM-dd'T'HH:mm:ss.SSSZZ",

  // Display formats (for UI)
  DISPLAY_DATE: "MMM d, yyyy",
  DISPLAY_DATETIME: "MMM d, yyyy 'at' h:mm a",
  DISPLAY_DATETIME_SHORT: "MMM d, h:mm a",
  DISPLAY_TIME: "h:mm a",
  DISPLAY_TIME_24H: "HH:mm",
  DISPLAY_DATE_SHORT: "MMM d",
  DISPLAY_WEEKDAY: "EEEE, MMM d",
  DISPLAY_WEEKDAY_SHORT: "EEE, MMM d",
  DISPLAY_MONTH_YEAR: "MMMM yyyy",

  // Email/Calendar formats
  RFC2822: "EEE, dd MMM yyyy HH:mm:ss ZZZ",

  // Compact formats
  COMPACT_DATE: "M/d/yy",
  COMPACT_DATETIME: "M/d/yy h:mm a",

  // Sortable formats
  SORTABLE: "yyyy-MM-dd HH:mm:ss",
} as const;

export type DateFormatKey = keyof typeof DATE_FORMATS;

// ─────────────────────────────────────────────────────────────
// Duration Presets
// ─────────────────────────────────────────────────────────────

/**
 * Common duration values for use with Luxon Duration
 * Use with: Duration.fromObject(DURATION_PRESETS.ONE_HOUR)
 */
export const DURATION_PRESETS = {
  // Minutes
  FIVE_MINUTES: { minutes: 5 },
  FIFTEEN_MINUTES: { minutes: 15 },
  THIRTY_MINUTES: { minutes: 30 },
  FORTY_FIVE_MINUTES: { minutes: 45 },

  // Hours
  ONE_HOUR: { hours: 1 },
  TWO_HOURS: { hours: 2 },
  HALF_DAY: { hours: 12 },

  // Days
  ONE_DAY: { days: 1 },
  TWO_DAYS: { days: 2 },
  THREE_DAYS: { days: 3 },
  ONE_WEEK: { weeks: 1 },
  TWO_WEEKS: { weeks: 2 },
  THIRTY_DAYS: { days: 30 },

  // Months/Years
  ONE_MONTH: { months: 1 },
  THREE_MONTHS: { months: 3 },
  SIX_MONTHS: { months: 6 },
  ONE_YEAR: { years: 1 },
} as const;

// ─────────────────────────────────────────────────────────────
// Working Hours Defaults
// ─────────────────────────────────────────────────────────────

/** Default working hours configuration */
export const DEFAULT_WORKING_HOURS = {
  startHour: 9,
  endHour: 17,
  startMinute: 0,
  endMinute: 0,
} as const;

/** Default meeting duration in minutes */
export const DEFAULT_MEETING_DURATION = 60;

/** Minimum slot duration for availability in minutes */
export const MIN_SLOT_DURATION = 15;

/** Maximum slot duration for availability in minutes */
export const MAX_SLOT_DURATION = 480; // 8 hours

// ─────────────────────────────────────────────────────────────
// Weekday Constants
// ─────────────────────────────────────────────────────────────

/**
 * Luxon weekday numbers (1 = Monday, 7 = Sunday)
 * Different from JavaScript Date (0 = Sunday, 6 = Saturday)
 */
export const WEEKDAYS = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
} as const;

/** Weekend days in Luxon format */
export const WEEKEND_DAYS = [WEEKDAYS.SATURDAY, WEEKDAYS.SUNDAY] as const;

/** Weekday days in Luxon format */
export const WEEKDAY_DAYS = [
  WEEKDAYS.MONDAY,
  WEEKDAYS.TUESDAY,
  WEEKDAYS.WEDNESDAY,
  WEEKDAYS.THURSDAY,
  WEEKDAYS.FRIDAY,
] as const;

