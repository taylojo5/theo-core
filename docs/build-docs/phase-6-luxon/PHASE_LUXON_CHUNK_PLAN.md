# Phase 6-Luxon: Date/Time Library Migration Plan

## Overview

This phase migrates the codebase from native JavaScript `Date` objects to the Luxon time library. This addresses recurring timezone issues, WET date manipulation code, and provides intelligent time logic across the application.

### Current State Analysis

| Metric | Count | Key Areas |
|--------|-------|-----------|
| `new Date()` usage | 503+ | All modules |
| `.toISOString()` | 73+ | API responses, database |
| Timezone mentions | 211+ | Calendar, events, scheduling |
| Date getter methods | 109+ | Business logic, UI display |

### Problem Patterns Identified

1. **Timezone Drift** - `setHours()` vs `setUTCHours()` inconsistencies
2. **Date Math Errors** - Manual millisecond calculations prone to off-by-one errors
3. **WET Code** - Repeated date range, comparison, and formatting logic
4. **Parsing Ambiguity** - `new Date(string)` behavior varies by browser/runtime
5. **DST Issues** - No DST-aware date arithmetic
6. **Format Inconsistency** - Mixed use of `toLocaleDateString` vs custom formatting

### Benefits of Luxon

- **Immutable** - Prevents accidental mutation bugs
- **Timezone-aware** - IANA timezone database built-in
- **Fluent API** - Chainable, readable date operations
- **DST-safe** - Automatic daylight saving time handling
- **ISO 8601** - Native support for all ISO formats
- **Duration/Interval** - First-class duration and interval types
- **Intl-based** - Uses native Intl for localization

---

## Chunk Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                     CHUNK 1 (Foundation)                        │
│                   Core Utilities Module                         │
└─────────────────────────────────┬───────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
          ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    CHUNK 2      │     │    CHUNK 3      │     │    CHUNK 4      │
│ Context Services│     │   Integrations  │     │   Agent Tools   │
│  (deadlines,    │     │ (gmail, calendar│     │ (availability,  │
│   events, etc)  │     │  mappers, sync) │     │  scheduling)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │        CHUNK 5          │
                    │   API & UI Components   │
                    │ (routes, formatters,    │
                    │      display logic)     │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │        CHUNK 6          │
                    │   Tests & Validation    │
                    │ (timezone edge cases,   │
                    │      DST testing)       │
                    └─────────────────────────┘
```

### Parallelization Analysis

- **Chunk 1**: Must complete first (foundation)
- **Chunks 2, 3, 4**: Can be parallelized after Chunk 1
- **Chunk 5**: Depends on Chunks 2-4
- **Chunk 6**: Depends on all previous chunks

---

## Chunk 1: Core Utilities Module (Foundation)

### Architecture Notes

Create a centralized date/time utilities module using Luxon. This module will:
1. Export all Luxon types needed across the codebase
2. Provide project-specific helper functions
3. Define timezone constants and configuration
4. Establish conversion patterns for database/API boundaries

### Files to Create

```
src/lib/datetime/
├── index.ts              # Main exports
├── luxon-core.ts         # Re-exports from Luxon with type augmentation
├── constants.ts          # Timezone constants, defaults
├── converters.ts         # Date ↔ DateTime conversion utilities
├── formatters.ts         # Display formatting functions
├── ranges.ts             # Date range and interval utilities
├── comparisons.ts        # Date comparison helpers
├── durations.ts          # Duration calculation utilities
└── zones.ts              # Timezone utilities and validation
```

### Implementation Guidance

#### `src/lib/datetime/index.ts`
```typescript
// ═══════════════════════════════════════════════════════════════════════════
// DateTime Utilities
// Centralized date/time handling using Luxon
// ═══════════════════════════════════════════════════════════════════════════

// Re-export Luxon core types
export { DateTime, Duration, Interval, Zone, Info } from "luxon";
export type { DateTimeOptions, DurationLike, DurationObject } from "luxon";

// Constants
export * from "./constants";

// Conversion utilities
export * from "./converters";

// Formatting
export * from "./formatters";

// Date ranges and intervals
export * from "./ranges";

// Comparison helpers
export * from "./comparisons";

// Duration utilities
export * from "./durations";

// Timezone utilities
export * from "./zones";
```

#### `src/lib/datetime/constants.ts`
```typescript
// Default timezone for server operations
export const DEFAULT_TIMEZONE = "UTC";

// Common timezone aliases
export const TIMEZONE_ALIASES = {
  EASTERN: "America/New_York",
  PACIFIC: "America/Los_Angeles",
  CENTRAL: "America/Chicago",
  MOUNTAIN: "America/Denver",
  UTC: "UTC",
} as const;

// Date format presets
export const DATE_FORMATS = {
  ISO_DATE: "yyyy-MM-dd",
  ISO_DATETIME: "yyyy-MM-dd'T'HH:mm:ss",
  ISO_FULL: "yyyy-MM-dd'T'HH:mm:ss.SSSZZZ",
  DISPLAY_DATE: "MMM d, yyyy",
  DISPLAY_DATETIME: "MMM d, yyyy 'at' h:mm a",
  DISPLAY_TIME: "h:mm a",
  DISPLAY_DATE_SHORT: "MMM d",
  DISPLAY_WEEKDAY: "EEEE, MMM d",
  RFC2822: "EEE, dd MMM yyyy HH:mm:ss ZZZ",
} as const;

// Duration presets for common operations
export const DURATION_PRESETS = {
  ONE_HOUR: { hours: 1 },
  ONE_DAY: { days: 1 },
  ONE_WEEK: { weeks: 1 },
  ONE_MONTH: { months: 1 },
  THIRTY_DAYS: { days: 30 },
} as const;
```

#### `src/lib/datetime/converters.ts`
```typescript
import { DateTime } from "luxon";
import { DEFAULT_TIMEZONE } from "./constants";

/**
 * Convert a JavaScript Date to a Luxon DateTime
 * Preserves the instant in time, interpreting as UTC if no timezone info
 */
export function fromDate(date: Date, zone?: string): DateTime {
  return DateTime.fromJSDate(date, { zone: zone ?? DEFAULT_TIMEZONE });
}

/**
 * Convert a Luxon DateTime to a JavaScript Date
 * Returns a Date object representing the same instant
 */
export function toDate(dt: DateTime): Date {
  return dt.toJSDate();
}

/**
 * Parse an ISO string to DateTime
 */
export function fromISO(iso: string, zone?: string): DateTime {
  return DateTime.fromISO(iso, { zone: zone ?? DEFAULT_TIMEZONE });
}

/**
 * Parse a date-only string (YYYY-MM-DD) to DateTime at start of day
 */
export function fromDateString(dateStr: string, zone?: string): DateTime {
  return DateTime.fromISO(dateStr, { zone: zone ?? DEFAULT_TIMEZONE }).startOf("day");
}

/**
 * Convert DateTime to ISO string for API/database
 */
export function toISO(dt: DateTime): string {
  return dt.toISO() ?? dt.toUTC().toISO()!;
}

/**
 * Convert DateTime to date-only string (YYYY-MM-DD)
 */
export function toDateString(dt: DateTime): string {
  return dt.toISODate()!;
}

/**
 * Get current DateTime in specified zone
 */
export function now(zone?: string): DateTime {
  return DateTime.now().setZone(zone ?? DEFAULT_TIMEZONE);
}

/**
 * Get current DateTime in UTC
 */
export function nowUTC(): DateTime {
  return DateTime.utc();
}

/**
 * Convert from RFC2822 email date format
 */
export function fromRFC2822(rfc: string): DateTime {
  return DateTime.fromRFC2822(rfc);
}

/**
 * Safe parse that returns null on invalid input
 */
export function safeParse(value: unknown, zone?: string): DateTime | null {
  if (!value) return null;
  
  if (value instanceof Date) {
    const dt = fromDate(value, zone);
    return dt.isValid ? dt : null;
  }
  
  if (typeof value === "string") {
    const dt = DateTime.fromISO(value, { zone: zone ?? DEFAULT_TIMEZONE });
    if (dt.isValid) return dt;
    
    // Try RFC2822 (common in email headers)
    const rfc = DateTime.fromRFC2822(value);
    if (rfc.isValid) return rfc;
  }
  
  if (typeof value === "number") {
    const dt = DateTime.fromMillis(value, { zone: zone ?? DEFAULT_TIMEZONE });
    return dt.isValid ? dt : null;
  }
  
  return null;
}
```

#### `src/lib/datetime/ranges.ts`
```typescript
import { DateTime, Interval } from "luxon";
import { now } from "./converters";

export interface DateRange {
  start: DateTime;
  end: DateTime;
}

/**
 * Get date range for common periods
 */
export function getDateRange(
  range: "today" | "tomorrow" | "week" | "month" | "quarter" | "year",
  zone?: string
): DateRange {
  const current = now(zone);
  
  switch (range) {
    case "today":
      return {
        start: current.startOf("day"),
        end: current.endOf("day"),
      };
    
    case "tomorrow":
      const tomorrow = current.plus({ days: 1 });
      return {
        start: tomorrow.startOf("day"),
        end: tomorrow.endOf("day"),
      };
    
    case "week":
      return {
        start: current.startOf("week"),
        end: current.endOf("week"),
      };
    
    case "month":
      return {
        start: current.startOf("month"),
        end: current.endOf("month"),
      };
    
    case "quarter":
      return {
        start: current.startOf("quarter"),
        end: current.endOf("quarter"),
      };
    
    case "year":
      return {
        start: current.startOf("year"),
        end: current.endOf("year"),
      };
  }
}

/**
 * Get a date range for the next N days
 */
export function getNextDays(days: number, zone?: string): DateRange {
  const current = now(zone);
  return {
    start: current,
    end: current.plus({ days }).endOf("day"),
  };
}

/**
 * Get a date range for the past N days
 */
export function getPastDays(days: number, zone?: string): DateRange {
  const current = now(zone);
  return {
    start: current.minus({ days }).startOf("day"),
    end: current,
  };
}

/**
 * Check if a DateTime falls within a range
 */
export function isInRange(dt: DateTime, range: DateRange): boolean {
  const interval = Interval.fromDateTimes(range.start, range.end);
  return interval.contains(dt);
}

/**
 * Check if two date ranges overlap
 */
export function rangesOverlap(a: DateRange, b: DateRange): boolean {
  const intervalA = Interval.fromDateTimes(a.start, a.end);
  const intervalB = Interval.fromDateTimes(b.start, b.end);
  return intervalA.overlaps(intervalB);
}

/**
 * Get the overlap between two date ranges
 */
export function getRangeOverlap(a: DateRange, b: DateRange): DateRange | null {
  const intervalA = Interval.fromDateTimes(a.start, a.end);
  const intervalB = Interval.fromDateTimes(b.start, b.end);
  const intersection = intervalA.intersection(intervalB);
  
  if (!intersection || !intersection.isValid) return null;
  
  return {
    start: intersection.start!,
    end: intersection.end!,
  };
}

/**
 * Iterate through each day in a range
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
 * Get business days (excluding weekends) in a range
 */
export function getBusinessDays(range: DateRange): DateTime[] {
  const days: DateTime[] = [];
  
  for (const day of eachDay(range)) {
    if (day.weekday <= 5) { // Monday = 1, Friday = 5
      days.push(day);
    }
  }
  
  return days;
}
```

#### `src/lib/datetime/comparisons.ts`
```typescript
import { DateTime, Duration } from "luxon";
import { now } from "./converters";

/**
 * Check if a DateTime is in the past
 */
export function isPast(dt: DateTime): boolean {
  return dt < now();
}

/**
 * Check if a DateTime is in the future
 */
export function isFuture(dt: DateTime): boolean {
  return dt > now();
}

/**
 * Check if a DateTime is today
 */
export function isToday(dt: DateTime, zone?: string): boolean {
  return dt.hasSame(now(zone), "day");
}

/**
 * Check if a DateTime is tomorrow
 */
export function isTomorrow(dt: DateTime, zone?: string): boolean {
  return dt.hasSame(now(zone).plus({ days: 1 }), "day");
}

/**
 * Check if a DateTime is this week
 */
export function isThisWeek(dt: DateTime, zone?: string): boolean {
  return dt.hasSame(now(zone), "week");
}

/**
 * Check if a DateTime is a weekend day
 */
export function isWeekend(dt: DateTime): boolean {
  return dt.weekday >= 6; // Saturday = 6, Sunday = 7
}

/**
 * Check if a DateTime is within N days from now
 */
export function isWithinDays(dt: DateTime, days: number): boolean {
  const current = now();
  const future = current.plus({ days });
  return dt >= current && dt <= future;
}

/**
 * Get the number of days between two DateTimes
 */
export function daysBetween(a: DateTime, b: DateTime): number {
  return Math.floor(Math.abs(b.diff(a, "days").days));
}

/**
 * Get days remaining until a date (negative if past)
 */
export function daysUntil(dt: DateTime): number {
  const diff = dt.diff(now(), "days").days;
  return Math.ceil(diff);
}

/**
 * Get the earliest of multiple DateTimes
 */
export function earliest(...dates: DateTime[]): DateTime {
  return DateTime.min(...dates)!;
}

/**
 * Get the latest of multiple DateTimes
 */
export function latest(...dates: DateTime[]): DateTime {
  return DateTime.max(...dates)!;
}

/**
 * Check if two DateTimes are the same day
 */
export function isSameDay(a: DateTime, b: DateTime): boolean {
  return a.hasSame(b, "day");
}

/**
 * Check if a DateTime is at the start of a day (midnight)
 */
export function isStartOfDay(dt: DateTime): boolean {
  return dt.equals(dt.startOf("day"));
}

/**
 * Check if times overlap within a threshold
 */
export function timesOverlap(
  startA: DateTime,
  endA: DateTime,
  startB: DateTime,
  endB: DateTime
): boolean {
  return startA < endB && endA > startB;
}
```

#### `src/lib/datetime/durations.ts`
```typescript
import { DateTime, Duration } from "luxon";

/**
 * Get duration between two DateTimes
 */
export function durationBetween(start: DateTime, end: DateTime): Duration {
  return end.diff(start);
}

/**
 * Get duration in minutes
 */
export function minutesBetween(start: DateTime, end: DateTime): number {
  return Math.round(end.diff(start, "minutes").minutes);
}

/**
 * Get duration in hours
 */
export function hoursBetween(start: DateTime, end: DateTime): number {
  return end.diff(start, "hours").hours;
}

/**
 * Format a duration for display
 */
export function formatDuration(duration: Duration): string {
  const hours = Math.floor(duration.as("hours"));
  const minutes = Math.round(duration.as("minutes") % 60);
  
  if (hours === 0) {
    return `${minutes}m`;
  }
  
  if (minutes === 0) {
    return `${hours}h`;
  }
  
  return `${hours}h ${minutes}m`;
}

/**
 * Create a duration from minutes
 */
export function durationFromMinutes(minutes: number): Duration {
  return Duration.fromObject({ minutes });
}

/**
 * Create a duration from hours
 */
export function durationFromHours(hours: number): Duration {
  return Duration.fromObject({ hours });
}

/**
 * Add duration to a DateTime
 */
export function addDuration(dt: DateTime, duration: Duration): DateTime {
  return dt.plus(duration);
}

/**
 * Subtract duration from a DateTime
 */
export function subtractDuration(dt: DateTime, duration: Duration): DateTime {
  return dt.minus(duration);
}
```

#### `src/lib/datetime/formatters.ts`
```typescript
import { DateTime } from "luxon";
import { DATE_FORMATS } from "./constants";

/**
 * Format a DateTime for display
 */
export function formatDate(dt: DateTime, format: keyof typeof DATE_FORMATS | string = "DISPLAY_DATE"): string {
  const formatString = DATE_FORMATS[format as keyof typeof DATE_FORMATS] ?? format;
  return dt.toFormat(formatString);
}

/**
 * Format a DateTime relative to now (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelative(dt: DateTime): string {
  return dt.toRelative() ?? dt.toFormat(DATE_FORMATS.DISPLAY_DATETIME);
}

/**
 * Format a DateTime for a specific locale
 */
export function formatLocalized(
  dt: DateTime,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return dt.toLocaleString(options);
}

/**
 * Format a time only (e.g., "2:30 PM")
 */
export function formatTime(dt: DateTime): string {
  return dt.toFormat(DATE_FORMATS.DISPLAY_TIME);
}

/**
 * Format a date range for display
 */
export function formatDateRange(start: DateTime, end: DateTime): string {
  if (start.hasSame(end, "day")) {
    // Same day: "Dec 27, 2025, 2:00 PM - 4:00 PM"
    return `${formatDate(start, "DISPLAY_DATE")}, ${formatTime(start)} - ${formatTime(end)}`;
  }
  
  if (start.hasSame(end, "month")) {
    // Same month: "Dec 27 - 29, 2025"
    return `${start.toFormat("MMM d")} - ${end.toFormat("d, yyyy")}`;
  }
  
  // Different months: "Dec 27, 2025 - Jan 2, 2026"
  return `${formatDate(start, "DISPLAY_DATE")} - ${formatDate(end, "DISPLAY_DATE")}`;
}

/**
 * Get a friendly date description
 */
export function friendlyDate(dt: DateTime): string {
  const now = DateTime.now();
  
  if (dt.hasSame(now, "day")) {
    return "Today";
  }
  
  if (dt.hasSame(now.plus({ days: 1 }), "day")) {
    return "Tomorrow";
  }
  
  if (dt.hasSame(now.minus({ days: 1 }), "day")) {
    return "Yesterday";
  }
  
  if (dt.hasSame(now, "week")) {
    return dt.toFormat("EEEE"); // Day name
  }
  
  if (dt.hasSame(now, "year")) {
    return dt.toFormat("MMM d");
  }
  
  return formatDate(dt, "DISPLAY_DATE");
}
```

#### `src/lib/datetime/zones.ts`
```typescript
import { DateTime, Zone, Info } from "luxon";

/**
 * Check if a timezone string is valid
 */
export function isValidTimezone(zone: string): boolean {
  return Info.isValidIANAZone(zone);
}

/**
 * Get the system's local timezone
 */
export function getLocalTimezone(): string {
  return DateTime.local().zoneName;
}

/**
 * Convert a DateTime to a different timezone
 */
export function toTimezone(dt: DateTime, zone: string): DateTime {
  return dt.setZone(zone);
}

/**
 * Convert a DateTime to UTC
 */
export function toUTC(dt: DateTime): DateTime {
  return dt.toUTC();
}

/**
 * Get the UTC offset for a timezone at a given time
 */
export function getUTCOffset(zone: string, at?: DateTime): string {
  const dt = (at ?? DateTime.now()).setZone(zone);
  return dt.toFormat("ZZ"); // e.g., "-05:00"
}

/**
 * Get timezone abbreviation (e.g., "EST", "PST")
 */
export function getTimezoneAbbr(zone: string, at?: DateTime): string {
  const dt = (at ?? DateTime.now()).setZone(zone);
  return dt.toFormat("ZZZZ"); // e.g., "Eastern Standard Time"
}

/**
 * List common timezone options for UI
 */
export function getCommonTimezones(): { value: string; label: string }[] {
  return [
    { value: "America/New_York", label: "Eastern Time (US)" },
    { value: "America/Chicago", label: "Central Time (US)" },
    { value: "America/Denver", label: "Mountain Time (US)" },
    { value: "America/Los_Angeles", label: "Pacific Time (US)" },
    { value: "America/Phoenix", label: "Arizona (No DST)" },
    { value: "America/Anchorage", label: "Alaska" },
    { value: "Pacific/Honolulu", label: "Hawaii" },
    { value: "UTC", label: "UTC" },
    { value: "Europe/London", label: "London" },
    { value: "Europe/Paris", label: "Paris" },
    { value: "Europe/Berlin", label: "Berlin" },
    { value: "Asia/Tokyo", label: "Tokyo" },
    { value: "Asia/Shanghai", label: "Shanghai" },
    { value: "Asia/Singapore", label: "Singapore" },
    { value: "Australia/Sydney", label: "Sydney" },
  ];
}
```

### Test Requirements

```typescript
// tests/lib/datetime/converters.test.ts
describe("DateTime Converters", () => {
  describe("fromDate", () => {
    it("converts JS Date to DateTime preserving instant", () => {});
    it("respects timezone parameter", () => {});
    it("handles edge dates (year boundaries, leap seconds)", () => {});
  });

  describe("safeParse", () => {
    it("parses ISO strings", () => {});
    it("parses RFC2822 strings", () => {});
    it("returns null for invalid input", () => {});
    it("handles Date objects", () => {});
    it("handles timestamps", () => {});
  });
});

// tests/lib/datetime/ranges.test.ts
describe("Date Ranges", () => {
  describe("getDateRange", () => {
    it("calculates today range correctly", () => {});
    it("calculates week range starting on correct day", () => {});
    it("handles month boundaries", () => {});
    it("handles year boundaries", () => {});
  });

  describe("eachDay", () => {
    it("yields each day in range", () => {});
    it("handles DST transitions", () => {});
  });
});

// tests/lib/datetime/zones.test.ts
describe("Timezone Utilities", () => {
  describe("toTimezone", () => {
    it("converts between timezones correctly", () => {});
    it("handles DST transitions", () => {});
    it("preserves instant in time", () => {});
  });
});
```

### Acceptance Criteria

- [ ] All Luxon types properly exported
- [ ] Converters handle all input types safely
- [ ] Range utilities support all common periods
- [ ] Timezone validation works for IANA zones
- [ ] All functions are immutable (don't mutate inputs)
- [ ] Test coverage > 90% for this module
- [ ] No direct `new Date()` calls in this module

---

## Chunk 2: Context Services Migration

### Architecture Notes

Migrate the context services layer (deadlines, events, tasks, places, relationships) to use Luxon. This is a critical layer as it handles:
- Deadline urgency calculations
- Event date range queries
- Task due date logic

### Files to Modify

```
src/services/context/
├── utils.ts                           # Date utilities → Luxon
├── deadlines/deadlines-service.ts     # Urgency calculation
├── events/events-service.ts           # Event queries
├── tasks/tasks-service.ts             # Due date logic
└── types.ts                           # Update type definitions
```

### Implementation Guidance

#### Update `src/services/context/utils.ts`

Replace the date utilities section:

```typescript
// BEFORE (WET, error-prone)
export function isPast(date: Date): boolean {
  return date < new Date();
}

export function isWithinDays(date: Date, days: number): boolean {
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return date >= now && date <= future;
}

export function getDateRange(range: "today" | "week" | "month" | "quarter" | "year"): { start: Date; end: Date } {
  const now = new Date();
  // ... complex switch statement with setHours, setDate, setMonth
}

// AFTER (DRY, timezone-aware)
import { 
  DateTime, 
  fromDate, 
  toDate, 
  isPast as luxonIsPast, 
  isWithinDays as luxonIsWithinDays,
  getDateRange as luxonGetDateRange,
} from "@/lib/datetime";

export function isPast(date: Date): boolean {
  return luxonIsPast(fromDate(date));
}

export function isWithinDays(date: Date, days: number): boolean {
  return luxonIsWithinDays(fromDate(date), days);
}

export function getDateRange(
  range: "today" | "week" | "month" | "quarter" | "year"
): { start: Date; end: Date } {
  const { start, end } = luxonGetDateRange(range);
  return { start: toDate(start), end: toDate(end) };
}
```

#### Update `src/services/context/deadlines/deadlines-service.ts`

```typescript
// BEFORE
function calculateDaysRemaining(dueAt: Date): number {
  const now = new Date();
  const diffMs = dueAt.getTime() - now.getTime();
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}

// AFTER
import { fromDate, daysUntil } from "@/lib/datetime";

function calculateDaysRemaining(dueAt: Date): number {
  return daysUntil(fromDate(dueAt));
}
```

#### Update `src/services/context/events/events-service.ts`

```typescript
// BEFORE
const startOfDay = new Date(date);
startOfDay.setHours(0, 0, 0, 0);
const endOfDay = new Date(date);
endOfDay.setHours(23, 59, 59, 999);

// AFTER
import { fromDate, toDate } from "@/lib/datetime";

const dt = fromDate(date);
const startOfDay = toDate(dt.startOf("day"));
const endOfDay = toDate(dt.endOf("day"));
```

### Test Requirements

- Update all context service tests to verify Luxon-based calculations
- Add timezone-specific test cases
- Test DST edge cases for deadline urgency

### Acceptance Criteria

- [ ] All date operations use Luxon utilities
- [ ] Existing test suite passes
- [ ] Urgency calculations are timezone-aware
- [ ] Date range queries handle DST correctly

---

## Chunk 3: Integrations Migration (Gmail & Calendar)

### Architecture Notes

Migrate the integration modules to use Luxon. These modules handle:
- Google Calendar date/time parsing (RFC3339)
- Gmail email date parsing (RFC2822)
- Sync state timestamps
- Webhook expiration

### Files to Modify

```
src/integrations/calendar/
├── mappers.ts            # parseEventDateTime, formatEventDateTime
├── sync/utils.ts         # Sync timing utilities
├── sync/webhook.ts       # Webhook expiration
├── actions/conflicts.ts  # Conflict detection timing

src/integrations/gmail/
├── mappers.ts            # Date mapping
├── extraction/dates.ts   # Date extraction from email
├── sync/*.ts             # Sync timing
└── utils.ts              # Date utilities
```

### Implementation Guidance

#### Update `src/integrations/calendar/mappers.ts`

```typescript
// BEFORE
export function parseEventDateTime(eventDateTime: EventDateTime): Date {
  if (eventDateTime.dateTime) {
    return new Date(eventDateTime.dateTime);
  }
  if (eventDateTime.date) {
    return new Date(`${eventDateTime.date}T00:00:00Z`);
  }
  throw new Error("EventDateTime must have either date or dateTime");
}

export function formatEventDateTime(date: Date, allDay: boolean, timeZone?: string): EventDateTime {
  if (allDay) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return { date: `${year}-${month}-${day}`, timeZone };
  }
  return { dateTime: date.toISOString(), timeZone };
}

// AFTER
import { DateTime, fromISO, toDate, toDateString, toISO, fromDate } from "@/lib/datetime";

export function parseEventDateTime(eventDateTime: EventDateTime): Date {
  if (eventDateTime.dateTime) {
    // RFC3339 format with timezone info
    return toDate(fromISO(eventDateTime.dateTime));
  }
  if (eventDateTime.date) {
    // All-day event: date only, interpret as UTC midnight
    return toDate(fromISO(eventDateTime.date).startOf("day").toUTC());
  }
  throw new Error("EventDateTime must have either date or dateTime");
}

export function formatEventDateTime(
  date: Date, 
  allDay: boolean, 
  timeZone?: string
): EventDateTime {
  const dt = fromDate(date, timeZone ?? "UTC");
  
  if (allDay) {
    return { 
      date: toDateString(dt), 
      timeZone 
    };
  }
  
  return { 
    dateTime: toISO(dt), 
    timeZone 
  };
}
```

#### Update `src/integrations/calendar/actions/conflicts.ts`

```typescript
// BEFORE
const bufferMs = bufferMinutes * 60 * 1000;
const bufferedStart = new Date(start.getTime() - bufferMs);
const bufferedEnd = new Date(end.getTime() + bufferMs);

const isSameTime = Math.abs(eventStart.getTime() - proposedStart.getTime()) < SAME_TIME_THRESHOLD_MS;

// AFTER
import { fromDate, toDate, minutesBetween, timesOverlap, DateTime, Duration } from "@/lib/datetime";

const buffer = Duration.fromObject({ minutes: bufferMinutes });
const startDt = fromDate(start);
const endDt = fromDate(end);
const bufferedStart = toDate(startDt.minus(buffer));
const bufferedEnd = toDate(endDt.plus(buffer));

const eventStartDt = fromDate(eventStart);
const proposedStartDt = fromDate(proposedStart);
const isSameTime = Math.abs(minutesBetween(eventStartDt, proposedStartDt)) < 5;
```

#### Update `src/integrations/gmail/extraction/dates.ts`

```typescript
// BEFORE
const referenceDate = options.referenceDate ?? new Date();

// AFTER
import { now, toDate, fromDate, DateTime } from "@/lib/datetime";

const referenceDate = options.referenceDate 
  ? options.referenceDate 
  : toDate(now());
```

### Test Requirements

- Update calendar mapper tests with RFC3339 edge cases
- Add tests for all-day event timezone handling
- Test email date parsing with various RFC2822 formats

### Acceptance Criteria

- [ ] Google Calendar dates parse correctly in all timezones
- [ ] All-day events stored consistently as UTC midnight
- [ ] Email dates from various mail clients parse correctly
- [ ] Webhook expiration calculations are accurate

---

## Chunk 4: Agent Tools Migration

### Architecture Notes

Migrate the agent tools layer to use Luxon. These are critical for:
- Availability checking
- Calendar event listing
- Task due date queries
- Natural language date parsing

### Files to Modify

```
src/lib/agent/tools/
├── query/check-availability.ts   # Free slot calculation
├── query/list-calendar-events.ts # Date range queries
├── query/list-tasks.ts           # Due date filtering
├── query/search-emails.ts        # Date filtering
├── validation.ts                 # Date input validation
└── context.ts                    # Date context for LLM
```

### Implementation Guidance

#### Update `src/lib/agent/tools/query/check-availability.ts`

```typescript
// BEFORE - Complex, error-prone date arithmetic
const startDateTime = new Date(startDate);
startDateTime.setUTCHours(0, 0, 0, 0);

let endDateTime: Date;
if (endDate) {
  endDateTime = new Date(endDate);
} else {
  endDateTime = new Date(startDate);
}
endDateTime.setUTCHours(23, 59, 59, 999);

const dayOfWeek = startDateTime.getUTCDay();
const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

// Working hours iteration
while (currentDate <= endDateTime) {
  const dayOfWeekCurrent = currentDate.getUTCDay();
  const isWeekendDay = dayOfWeekCurrent === 0 || dayOfWeekCurrent === 6;
  
  const dayWorkStart = new Date(currentDate);
  dayWorkStart.setUTCHours(workingHoursStart, 0, 0, 0);
  
  const dayWorkEnd = new Date(currentDate);
  dayWorkEnd.setUTCHours(workingHoursEnd, 0, 0, 0);
  
  currentDate.setUTCDate(currentDate.getUTCDate() + 1);
}

// AFTER - Clean, readable Luxon code
import { 
  DateTime, 
  fromISO, 
  toDate, 
  toISO, 
  isWeekend, 
  eachDay,
  minutesBetween,
  DateRange,
} from "@/lib/datetime";

const startDt = fromISO(startDate).startOf("day");
const endDt = endDate 
  ? fromISO(endDate).endOf("day") 
  : startDt.endOf("day");

const isSingleDay = !endDate || startDate === endDate;

if (excludeWeekends && isWeekend(startDt) && isSingleDay) {
  return {
    date: startDate,
    freeSlots: [],
    busyPeriods: [],
    totalFreeMinutes: 0,
    summary: "Weekend day - excluded from availability check",
  };
}

// Clean iteration through days
for (const day of eachDay({ start: startDt, end: endDt })) {
  if (excludeWeekends && isWeekend(day)) {
    continue;
  }
  
  const dayWorkStart = day.set({ hour: workingHoursStart, minute: 0 });
  const dayWorkEnd = day.set({ hour: workingHoursEnd, minute: 0 });
  
  // Calculate free slots for this day
  const dayFreeSlots = calculateFreeSlots(
    dayBusyPeriods,
    toDate(dayWorkStart),
    toDate(dayWorkEnd),
    durationMinutes
  );
  
  allFreeSlots.push(...dayFreeSlots);
}
```

#### Update `src/lib/agent/tools/validation.ts`

```typescript
// BEFORE
const dateSchema = z.string().refine(
  (val) => !isNaN(new Date(val).getTime()),
  { message: "Invalid date format" }
);

// AFTER
import { safeParse } from "@/lib/datetime";

const dateSchema = z.string().refine(
  (val) => safeParse(val) !== null,
  { message: "Invalid date format" }
);
```

### Test Requirements

- Test availability calculation across DST transitions
- Test with various user timezone configurations
- Test working hours in different timezones

### Acceptance Criteria

- [ ] Availability tool correctly handles timezone context
- [ ] Working hours respect user's timezone
- [ ] Free slot calculations are DST-aware
- [ ] Date validation accepts all ISO formats

---

## Chunk 5: API & UI Components

### Architecture Notes

Migrate API routes and UI components to use Luxon for:
- Request parameter parsing
- Response date formatting
- Display date formatting in React components

### Files to Modify

```
src/app/api/
├── integrations/calendar/events/route.ts
├── integrations/gmail/sync/route.ts
├── context/*/route.ts
└── admin/queues/route.ts

src/components/
├── integrations/calendar/*.tsx
├── integrations/gmail/*.tsx
└── email/*.tsx
```

### Implementation Guidance

#### API Route Updates

```typescript
// BEFORE
const lastSyncAt = gmailSyncState?.lastSyncAt?.toISOString() || undefined;

// AFTER
import { fromDate, toISO } from "@/lib/datetime";

const lastSyncAt = gmailSyncState?.lastSyncAt 
  ? toISO(fromDate(gmailSyncState.lastSyncAt))
  : undefined;
```

#### React Component Updates

```typescript
// BEFORE
const formatApprovalDate = (date: Date) => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  // etc...
};

// AFTER
import { fromDate, formatRelative, friendlyDate } from "@/lib/datetime";

const formatApprovalDate = (date: Date) => {
  return formatRelative(fromDate(date));
};

// Or for friendly dates
const displayDate = friendlyDate(fromDate(event.startsAt));
```

### Test Requirements

- Verify API responses have consistent date formats
- Test UI date displays in different timezones

### Acceptance Criteria

- [ ] All API responses use ISO 8601 format
- [ ] UI displays dates in user's locale
- [ ] Relative time displays update correctly
- [ ] Date pickers work correctly

---

## Chunk 6: Tests & Validation

### Architecture Notes

Comprehensive test coverage for:
- Timezone edge cases
- DST transitions
- Leap years
- Year/month boundaries
- International date line handling

### Test Scenarios

```typescript
describe("Timezone Edge Cases", () => {
  // DST transitions
  it("handles March DST spring forward", () => {
    // At 2:00 AM EST, clocks move to 3:00 AM EDT
    // 1:30 AM + 1 hour should be 3:30 AM (not 2:30 AM)
  });

  it("handles November DST fall back", () => {
    // At 2:00 AM EDT, clocks move back to 1:00 AM EST
    // Ambiguous times handled correctly
  });

  // Time zone conversions
  it("preserves instant across timezone conversions", () => {
    const nyc = DateTime.fromISO("2024-03-15T14:00:00", { zone: "America/New_York" });
    const la = nyc.setZone("America/Los_Angeles");
    expect(la.toMillis()).toBe(nyc.toMillis()); // Same instant
    expect(la.hour).toBe(11); // 3 hours earlier
  });

  // All-day events
  it("stores all-day events consistently regardless of server timezone", () => {
    // All-day event on "2024-03-15" should be midnight UTC
    // regardless of server location
  });
});

describe("Edge Date Cases", () => {
  it("handles leap year Feb 29", () => {});
  it("handles year boundary Dec 31 → Jan 1", () => {});
  it("handles month boundaries (Jan 31 + 1 month)", () => {});
  it("handles international date line", () => {});
});

describe("Duration Calculations", () => {
  it("calculates duration across DST transitions correctly", () => {
    // Meeting from 1:00 AM to 3:00 AM during spring DST
    // Should be 1 hour, not 2 hours
  });
});
```

### Acceptance Criteria

- [ ] All tests pass in different TZ environments
- [ ] CI runs tests with multiple TZ settings
- [ ] Edge case coverage documented
- [ ] No flaky tests due to timing

---

## Migration Strategy

### Phase 1: Add Luxon (Non-Breaking)
1. Install Luxon: `npm install luxon` and `npm install -D @types/luxon`
2. Create `src/lib/datetime/` module
3. Write comprehensive tests for new module

### Phase 2: Gradual Adoption
1. Start with new code using Luxon
2. Migrate context services (Chunk 2)
3. Migrate integrations (Chunk 3)
4. Migrate agent tools (Chunk 4)
5. Migrate API/UI (Chunk 5)

### Phase 3: Cleanup
1. Remove redundant date utilities
2. Update documentation
3. Add timezone guidelines to CONTRIBUTING.md

### Rollback Plan

Each chunk can be rolled back independently:
- Converters maintain Date ↔ DateTime boundaries
- Old Date-based code still works
- Feature flags can gate Luxon usage

---

## Guidelines for Migrating Existing Code

### 1. Input Boundaries

At function entry points that accept `Date`:
```typescript
// Convert to Luxon immediately
function processEvent(event: { startsAt: Date; endsAt?: Date }) {
  const startDt = fromDate(event.startsAt);
  const endDt = event.endsAt ? fromDate(event.endsAt) : undefined;
  
  // All internal logic uses DateTime
}
```

### 2. Output Boundaries

At function exits or DB writes that need `Date`:
```typescript
// Convert back to Date at the last moment
return {
  ...result,
  startsAt: toDate(startDt),
  endsAt: endDt ? toDate(endDt) : undefined,
};
```

### 3. Database Considerations

Prisma uses JavaScript `Date` objects. The migration should:
- Keep Prisma schema unchanged (DateTime fields stay as-is)
- Convert at repository boundaries
- Consider adding a database field for original timezone

### 4. API Response Format

Always use ISO 8601 for API responses:
```typescript
// Response serialization
{
  createdAt: toISO(fromDate(entity.createdAt)),
  expiresAt: entity.expiresAt ? toISO(fromDate(entity.expiresAt)) : null,
}
```

---

## Estimated Effort

| Chunk | Complexity | Time Estimate |
|-------|------------|---------------|
| 1. Core Utilities | Medium | 4-6 hours |
| 2. Context Services | Medium | 3-4 hours |
| 3. Integrations | High | 6-8 hours |
| 4. Agent Tools | High | 4-6 hours |
| 5. API & UI | Low | 2-3 hours |
| 6. Tests & Validation | Medium | 3-4 hours |

**Total: 22-31 hours**

---

## Success Metrics

1. **Zero timezone bugs** in production for 30 days post-migration
2. **Test coverage** > 90% for datetime module
3. **Code reduction** of ~30% in date manipulation logic
4. **DST handling** verified with automated tests
5. **Developer experience** improved (subjective feedback)

