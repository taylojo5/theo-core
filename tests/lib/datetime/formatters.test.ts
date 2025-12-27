// ═══════════════════════════════════════════════════════════════════════════
// DateTime Formatters Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DateTime } from "luxon";
import {
  formatDate,
  formatISO,
  formatDateOnly,
  formatTime,
  formatTime24,
  formatRelative,
  formatCalendar,
  friendlyDate,
  formatDateRange,
  formatTimeRange,
  getWeekdayName,
  getWeekdayAbbr,
  getMonthName,
  getMonthAbbr,
  getDayWithOrdinal,
  formatWithOrdinal,
} from "@/lib/datetime";

describe("DateTime Formatters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Friday, March 15, 2024 at 14:30:00 UTC
    vi.setSystemTime(new Date("2024-03-15T14:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────
  // Basic Formatting
  // ─────────────────────────────────────────────────────────────

  describe("formatDate", () => {
    // Create in UTC explicitly so hour is preserved
    const dt = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 14, minute: 30 }, { zone: "UTC" });

    it("formats with default format", () => {
      const result = formatDate(dt);
      expect(result).toBe("Mar 15, 2024");
    });

    it("formats with preset formats", () => {
      expect(formatDate(dt, "ISO_DATE")).toBe("2024-03-15");
      expect(formatDate(dt, "DISPLAY_TIME")).toBe("2:30 PM");
      expect(formatDate(dt, "DISPLAY_DATE_SHORT")).toBe("Mar 15");
    });

    it("formats with custom format string", () => {
      expect(formatDate(dt, "yyyy/MM/dd")).toBe("2024/03/15");
      expect(formatDate(dt, "EEEE")).toBe("Friday");
    });
  });

  describe("formatISO", () => {
    it("returns ISO 8601 string", () => {
      const dt = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 14, minute: 30 }, { zone: "UTC" });
      const iso = formatISO(dt);

      expect(iso).toMatch(/^2024-03-15T14:30:00/);
    });
  });

  describe("formatDateOnly", () => {
    it("returns date-only string", () => {
      const dt = DateTime.fromISO("2024-03-15T14:30:00Z");
      expect(formatDateOnly(dt)).toBe("2024-03-15");
    });
  });

  describe("formatTime", () => {
    it("formats time in 12-hour format", () => {
      const morning = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 9, minute: 30 }, { zone: "UTC" });
      const afternoon = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 14, minute: 30 }, { zone: "UTC" });

      expect(formatTime(morning)).toBe("9:30 AM");
      expect(formatTime(afternoon)).toBe("2:30 PM");
    });
  });

  describe("formatTime24", () => {
    it("formats time in 24-hour format", () => {
      const morning = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 9, minute: 30 }, { zone: "UTC" });
      const afternoon = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 14, minute: 30 }, { zone: "UTC" });

      expect(formatTime24(morning)).toBe("09:30");
      expect(formatTime24(afternoon)).toBe("14:30");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Relative Formatting
  // ─────────────────────────────────────────────────────────────

  describe("formatRelative", () => {
    it("formats recent past dates", () => {
      const oneHourAgo = DateTime.fromISO("2024-03-15T13:30:00Z");
      const result = formatRelative(oneHourAgo);

      expect(result).toContain("hour");
    });

    it("formats future dates", () => {
      const inTwoHours = DateTime.fromISO("2024-03-15T16:30:00Z");
      const result = formatRelative(inTwoHours);

      expect(result).toContain("hour");
    });
  });

  describe("formatCalendar", () => {
    it("returns Today for current day", () => {
      const today = DateTime.fromISO("2024-03-15T09:00:00Z");
      expect(formatCalendar(today)).toBe("Today");
    });

    it("returns Tomorrow for next day", () => {
      const tomorrow = DateTime.fromISO("2024-03-16T09:00:00Z");
      expect(formatCalendar(tomorrow)).toBe("Tomorrow");
    });

    it("returns Yesterday for previous day", () => {
      const yesterday = DateTime.fromISO("2024-03-14T09:00:00Z");
      expect(formatCalendar(yesterday)).toBe("Yesterday");
    });

    it("returns day name for this week", () => {
      // March 11 is Monday of the same week as March 15 (Friday)
      const monday = DateTime.fromISO("2024-03-11T09:00:00Z");
      expect(formatCalendar(monday)).toBe("Monday");
    });

    it("returns short date for this year", () => {
      const february = DateTime.fromISO("2024-02-20T09:00:00Z");
      expect(formatCalendar(february)).toBe("Feb 20");
    });

    it("returns full date for different year", () => {
      const lastYear = DateTime.fromISO("2023-12-20T09:00:00Z");
      expect(formatCalendar(lastYear)).toBe("Dec 20, 2023");
    });
  });

  describe("friendlyDate", () => {
    it("returns calendar date without time by default", () => {
      const today = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 9 }, { zone: "UTC" });
      expect(friendlyDate(today, false, "UTC")).toBe("Today");
    });

    it("includes time when requested", () => {
      const today = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 14, minute: 30 }, { zone: "UTC" });
      const result = friendlyDate(today, true, "UTC");

      expect(result).toBe("Today at 2:30 PM");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Range Formatting
  // ─────────────────────────────────────────────────────────────

  describe("formatDateRange", () => {
    it("formats same-day range", () => {
      const start = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 9 }, { zone: "UTC" });
      const end = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 17 }, { zone: "UTC" });

      const result = formatDateRange(start, end);

      expect(result).toBe("Mar 15, 2024, 9:00 AM - 5:00 PM");
    });

    it("formats same-month range", () => {
      const start = DateTime.fromISO("2024-03-15T09:00:00Z");
      const end = DateTime.fromISO("2024-03-20T17:00:00Z");

      const result = formatDateRange(start, end);

      expect(result).toBe("Mar 15 - 20, 2024");
    });

    it("formats same-year range", () => {
      const start = DateTime.fromISO("2024-03-15T09:00:00Z");
      const end = DateTime.fromISO("2024-04-20T17:00:00Z");

      const result = formatDateRange(start, end);

      expect(result).toBe("Mar 15 - Apr 20, 2024");
    });

    it("formats cross-year range", () => {
      const start = DateTime.fromISO("2024-12-20T09:00:00Z");
      const end = DateTime.fromISO("2025-01-05T17:00:00Z");

      const result = formatDateRange(start, end);

      expect(result).toBe("Dec 20, 2024 - Jan 5, 2025");
    });
  });

  describe("formatTimeRange", () => {
    it("formats time range", () => {
      const start = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 9 }, { zone: "UTC" });
      const end = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 17 }, { zone: "UTC" });

      const result = formatTimeRange(start, end);

      expect(result).toBe("9:00 AM - 5:00 PM");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Weekday Formatting
  // ─────────────────────────────────────────────────────────────

  describe("Weekday/Month Names", () => {
    const dt = DateTime.fromISO("2024-03-15T14:30:00Z"); // Friday in March

    it("gets full weekday name", () => {
      expect(getWeekdayName(dt)).toBe("Friday");
    });

    it("gets abbreviated weekday name", () => {
      expect(getWeekdayAbbr(dt)).toBe("Fri");
    });

    it("gets full month name", () => {
      expect(getMonthName(dt)).toBe("March");
    });

    it("gets abbreviated month name", () => {
      expect(getMonthAbbr(dt)).toBe("Mar");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Ordinal Formatting
  // ─────────────────────────────────────────────────────────────

  describe("Ordinal Formatting", () => {
    it("gets day with correct ordinal suffix", () => {
      expect(getDayWithOrdinal(DateTime.fromObject({ year: 2024, month: 3, day: 1 }, { zone: "UTC" }))).toBe("1st");
      expect(getDayWithOrdinal(DateTime.fromObject({ year: 2024, month: 3, day: 2 }, { zone: "UTC" }))).toBe("2nd");
      expect(getDayWithOrdinal(DateTime.fromObject({ year: 2024, month: 3, day: 3 }, { zone: "UTC" }))).toBe("3rd");
      expect(getDayWithOrdinal(DateTime.fromObject({ year: 2024, month: 3, day: 4 }, { zone: "UTC" }))).toBe("4th");
      expect(getDayWithOrdinal(DateTime.fromObject({ year: 2024, month: 3, day: 11 }, { zone: "UTC" }))).toBe("11th");
      expect(getDayWithOrdinal(DateTime.fromObject({ year: 2024, month: 3, day: 12 }, { zone: "UTC" }))).toBe("12th");
      expect(getDayWithOrdinal(DateTime.fromObject({ year: 2024, month: 3, day: 13 }, { zone: "UTC" }))).toBe("13th");
      expect(getDayWithOrdinal(DateTime.fromObject({ year: 2024, month: 3, day: 21 }, { zone: "UTC" }))).toBe("21st");
      expect(getDayWithOrdinal(DateTime.fromObject({ year: 2024, month: 3, day: 22 }, { zone: "UTC" }))).toBe("22nd");
      expect(getDayWithOrdinal(DateTime.fromObject({ year: 2024, month: 3, day: 23 }, { zone: "UTC" }))).toBe("23rd");
    });

    it("formats date with ordinal", () => {
      const dt = DateTime.fromObject({ year: 2024, month: 3, day: 15 }, { zone: "UTC" });
      expect(formatWithOrdinal(dt)).toBe("March 15th, 2024");
    });
  });
});

