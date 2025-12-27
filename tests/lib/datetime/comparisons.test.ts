// ═══════════════════════════════════════════════════════════════════════════
// DateTime Comparisons Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DateTime } from "luxon";
import {
  isPast,
  isFuture,
  isNow,
  isToday,
  isTomorrow,
  isYesterday,
  isThisWeek,
  isThisMonth,
  isThisYear,
  isWeekend,
  isWeekday,
  isWithinDays,
  isWithinHours,
  isWithinMinutes,
  isWithinPastDays,
  daysBetween,
  daysUntil,
  hoursUntil,
  minutesUntil,
  earliest,
  latest,
  isSameDay,
  isSameWeek,
  isSameMonth,
  isStartOfDay,
  isEndOfDay,
  isWithinWorkingHours,
  timesOverlap,
  timesAreClose,
} from "@/lib/datetime";

describe("DateTime Comparisons", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Wednesday, March 15, 2024 at 14:30:00 UTC
    vi.setSystemTime(new Date("2024-03-15T14:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────
  // Relative Time Checks
  // ─────────────────────────────────────────────────────────────

  describe("isPast", () => {
    it("returns true for past dates", () => {
      const yesterday = DateTime.fromISO("2024-03-14T14:30:00Z");
      expect(isPast(yesterday)).toBe(true);
    });

    it("returns false for future dates", () => {
      const tomorrow = DateTime.fromISO("2024-03-16T14:30:00Z");
      expect(isPast(tomorrow)).toBe(false);
    });
  });

  describe("isFuture", () => {
    it("returns true for future dates", () => {
      const tomorrow = DateTime.fromISO("2024-03-16T14:30:00Z");
      expect(isFuture(tomorrow)).toBe(true);
    });

    it("returns false for past dates", () => {
      const yesterday = DateTime.fromISO("2024-03-14T14:30:00Z");
      expect(isFuture(yesterday)).toBe(false);
    });
  });

  describe("isNow", () => {
    it("returns true for current time within tolerance", () => {
      const now = DateTime.fromISO("2024-03-15T14:30:00Z");
      expect(isNow(now)).toBe(true);
    });

    it("returns true for time within tolerance", () => {
      const almostNow = DateTime.fromISO("2024-03-15T14:30:00.500Z");
      expect(isNow(almostNow, 1000)).toBe(true);
    });

    it("returns false for time outside tolerance", () => {
      const notNow = DateTime.fromISO("2024-03-15T14:31:00Z");
      expect(isNow(notNow, 1000)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Day-Level Checks
  // ─────────────────────────────────────────────────────────────

  describe("isToday", () => {
    it("returns true for same calendar day", () => {
      const morning = DateTime.fromISO("2024-03-15T09:00:00Z");
      expect(isToday(morning)).toBe(true);
    });

    it("returns false for different day", () => {
      const yesterday = DateTime.fromISO("2024-03-14T14:30:00Z", { zone: "UTC" });
      expect(isToday(yesterday, "UTC")).toBe(false);
    });

    it("handles timezone correctly", () => {
      // When it's March 15 2:30 PM in UTC, it's March 15 10:30 AM in NYC
      const nycTime = DateTime.fromISO("2024-03-15T10:30:00", {
        zone: "America/New_York",
      });
      expect(isToday(nycTime, "America/New_York")).toBe(true);
    });
  });

  describe("isTomorrow", () => {
    it("returns true for next calendar day", () => {
      const tomorrow = DateTime.fromISO("2024-03-16T09:00:00Z");
      expect(isTomorrow(tomorrow)).toBe(true);
    });

    it("returns false for today", () => {
      const today = DateTime.fromISO("2024-03-15T09:00:00Z");
      expect(isTomorrow(today)).toBe(false);
    });
  });

  describe("isYesterday", () => {
    it("returns true for previous calendar day", () => {
      const yesterday = DateTime.fromISO("2024-03-14T09:00:00Z");
      expect(isYesterday(yesterday)).toBe(true);
    });

    it("returns false for today", () => {
      const today = DateTime.fromISO("2024-03-15T09:00:00Z");
      expect(isYesterday(today)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Week/Month/Year Checks
  // ─────────────────────────────────────────────────────────────

  describe("isThisWeek", () => {
    it("returns true for date in current week", () => {
      const monday = DateTime.fromISO("2024-03-11T09:00:00Z");
      expect(isThisWeek(monday)).toBe(true);
    });

    it("returns false for date in different week", () => {
      const lastWeek = DateTime.fromISO("2024-03-08T09:00:00Z");
      expect(isThisWeek(lastWeek)).toBe(false);
    });
  });

  describe("isThisMonth", () => {
    it("returns true for date in current month", () => {
      const sameMonth = DateTime.fromISO("2024-03-01T09:00:00Z");
      expect(isThisMonth(sameMonth)).toBe(true);
    });

    it("returns false for date in different month", () => {
      const lastMonth = DateTime.fromISO("2024-02-15T09:00:00Z");
      expect(isThisMonth(lastMonth)).toBe(false);
    });
  });

  describe("isThisYear", () => {
    it("returns true for date in current year", () => {
      const sameYear = DateTime.fromISO("2024-01-01T09:00:00Z");
      expect(isThisYear(sameYear)).toBe(true);
    });

    it("returns false for date in different year", () => {
      const lastYear = DateTime.fromISO("2023-12-15T09:00:00Z");
      expect(isThisYear(lastYear)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Weekday Checks
  // ─────────────────────────────────────────────────────────────

  describe("isWeekend", () => {
    it("returns true for Saturday", () => {
      const saturday = DateTime.fromISO("2024-03-16T09:00:00Z");
      expect(isWeekend(saturday)).toBe(true);
    });

    it("returns true for Sunday", () => {
      const sunday = DateTime.fromISO("2024-03-17T09:00:00Z");
      expect(isWeekend(sunday)).toBe(true);
    });

    it("returns false for weekday", () => {
      const friday = DateTime.fromISO("2024-03-15T09:00:00Z");
      expect(isWeekend(friday)).toBe(false);
    });
  });

  describe("isWeekday", () => {
    it("returns true for Monday-Friday", () => {
      const friday = DateTime.fromISO("2024-03-15T09:00:00Z");
      expect(isWeekday(friday)).toBe(true);
    });

    it("returns false for weekend", () => {
      const saturday = DateTime.fromISO("2024-03-16T09:00:00Z");
      expect(isWeekday(saturday)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Range Checks
  // ─────────────────────────────────────────────────────────────

  describe("isWithinDays", () => {
    it("returns true for date within N days", () => {
      const inThreeDays = DateTime.fromISO("2024-03-18T09:00:00Z");
      expect(isWithinDays(inThreeDays, 7)).toBe(true);
    });

    it("returns false for date beyond N days", () => {
      const inTenDays = DateTime.fromISO("2024-03-25T09:00:00Z");
      expect(isWithinDays(inTenDays, 7)).toBe(false);
    });

    it("returns false for past dates", () => {
      const yesterday = DateTime.fromISO("2024-03-14T09:00:00Z");
      expect(isWithinDays(yesterday, 7)).toBe(false);
    });
  });

  describe("isWithinHours", () => {
    it("returns true for date within N hours", () => {
      const inTwoHours = DateTime.fromISO("2024-03-15T16:30:00Z");
      expect(isWithinHours(inTwoHours, 4)).toBe(true);
    });

    it("returns false for date beyond N hours", () => {
      const inSixHours = DateTime.fromISO("2024-03-15T20:30:00Z");
      expect(isWithinHours(inSixHours, 4)).toBe(false);
    });
  });

  describe("isWithinMinutes", () => {
    it("returns true for date within N minutes", () => {
      const inFiveMin = DateTime.fromISO("2024-03-15T14:35:00Z");
      expect(isWithinMinutes(inFiveMin, 10)).toBe(true);
    });
  });

  describe("isWithinPastDays", () => {
    it("returns true for date within past N days", () => {
      const threeDaysAgo = DateTime.fromISO("2024-03-12T09:00:00Z");
      expect(isWithinPastDays(threeDaysAgo, 7)).toBe(true);
    });

    it("returns false for future dates", () => {
      const tomorrow = DateTime.fromISO("2024-03-16T09:00:00Z");
      expect(isWithinPastDays(tomorrow, 7)).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Comparison Functions
  // ─────────────────────────────────────────────────────────────

  describe("daysBetween", () => {
    it("calculates days between two dates", () => {
      const a = DateTime.fromISO("2024-03-15T09:00:00Z");
      const b = DateTime.fromISO("2024-03-20T09:00:00Z");

      expect(daysBetween(a, b)).toBe(5);
    });

    it("returns absolute value", () => {
      const a = DateTime.fromISO("2024-03-20T09:00:00Z");
      const b = DateTime.fromISO("2024-03-15T09:00:00Z");

      expect(daysBetween(a, b)).toBe(5);
    });
  });

  describe("daysUntil", () => {
    it("returns positive for future dates", () => {
      const inFiveDays = DateTime.fromISO("2024-03-20T14:30:00Z");
      expect(daysUntil(inFiveDays)).toBe(5);
    });

    it("returns negative for past dates", () => {
      const fiveDaysAgo = DateTime.fromISO("2024-03-10T14:30:00Z");
      expect(daysUntil(fiveDaysAgo)).toBe(-5);
    });
  });

  describe("hoursUntil", () => {
    it("returns hours until date", () => {
      const inTwoHours = DateTime.fromISO("2024-03-15T16:30:00Z");
      expect(hoursUntil(inTwoHours)).toBe(2);
    });
  });

  describe("minutesUntil", () => {
    it("returns minutes until date", () => {
      const inThirtyMin = DateTime.fromISO("2024-03-15T15:00:00Z");
      expect(minutesUntil(inThirtyMin)).toBe(30);
    });
  });

  describe("earliest / latest", () => {
    it("returns earliest date", () => {
      const a = DateTime.fromISO("2024-03-15T09:00:00Z");
      const b = DateTime.fromISO("2024-03-16T09:00:00Z");
      const c = DateTime.fromISO("2024-03-14T09:00:00Z");

      expect(earliest(a, b, c).day).toBe(14);
    });

    it("returns latest date", () => {
      const a = DateTime.fromISO("2024-03-15T09:00:00Z");
      const b = DateTime.fromISO("2024-03-16T09:00:00Z");
      const c = DateTime.fromISO("2024-03-14T09:00:00Z");

      expect(latest(a, b, c).day).toBe(16);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Same-Unit Checks
  // ─────────────────────────────────────────────────────────────

  describe("isSameDay", () => {
    it("returns true for same calendar day", () => {
      const a = DateTime.fromISO("2024-03-15T09:00:00Z");
      const b = DateTime.fromISO("2024-03-15T18:00:00Z");

      expect(isSameDay(a, b)).toBe(true);
    });

    it("returns false for different days", () => {
      const a = DateTime.fromISO("2024-03-15T09:00:00Z");
      const b = DateTime.fromISO("2024-03-16T09:00:00Z");

      expect(isSameDay(a, b)).toBe(false);
    });
  });

  describe("isSameWeek", () => {
    it("returns true for same ISO week", () => {
      const monday = DateTime.fromISO("2024-03-11T09:00:00Z");
      const friday = DateTime.fromISO("2024-03-15T09:00:00Z");

      expect(isSameWeek(monday, friday)).toBe(true);
    });
  });

  describe("isSameMonth", () => {
    it("returns true for same month and year", () => {
      const early = DateTime.fromISO("2024-03-01T09:00:00Z");
      const late = DateTime.fromISO("2024-03-31T09:00:00Z");

      expect(isSameMonth(early, late)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Time-of-Day Checks
  // ─────────────────────────────────────────────────────────────

  describe("isStartOfDay", () => {
    it("returns true for midnight", () => {
      const midnight = DateTime.fromISO("2024-03-15T00:00:00.000", { zone: "UTC" });
      expect(isStartOfDay(midnight)).toBe(true);
    });

    it("returns false for other times", () => {
      const afternoon = DateTime.fromISO("2024-03-15T14:30:00Z");
      expect(isStartOfDay(afternoon)).toBe(false);
    });
  });

  describe("isEndOfDay", () => {
    it("returns true for 23:59:59.999", () => {
      const endOfDay = DateTime.fromISO("2024-03-15T00:00:00Z").endOf("day");
      expect(isEndOfDay(endOfDay)).toBe(true);
    });
  });

  describe("isWithinWorkingHours", () => {
    it("returns true for time within working hours", () => {
      // Create a DateTime with the hour set explicitly in its zone
      const tenAM = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 10 }, { zone: "UTC" });
      expect(isWithinWorkingHours(tenAM)).toBe(true);
    });

    it("returns false for time outside working hours", () => {
      const eightAM = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 8 }, { zone: "UTC" });
      expect(isWithinWorkingHours(eightAM)).toBe(false);
    });

    it("respects custom working hours", () => {
      const eightAM = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 8 }, { zone: "UTC" });
      expect(isWithinWorkingHours(eightAM, 8, 18)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Overlap Detection
  // ─────────────────────────────────────────────────────────────

  describe("timesOverlap", () => {
    it("detects overlapping time ranges", () => {
      const startA = DateTime.fromISO("2024-03-15T09:00:00Z");
      const endA = DateTime.fromISO("2024-03-15T11:00:00Z");
      const startB = DateTime.fromISO("2024-03-15T10:00:00Z");
      const endB = DateTime.fromISO("2024-03-15T12:00:00Z");

      expect(timesOverlap(startA, endA, startB, endB)).toBe(true);
    });

    it("returns false for non-overlapping ranges", () => {
      const startA = DateTime.fromISO("2024-03-15T09:00:00Z");
      const endA = DateTime.fromISO("2024-03-15T10:00:00Z");
      const startB = DateTime.fromISO("2024-03-15T11:00:00Z");
      const endB = DateTime.fromISO("2024-03-15T12:00:00Z");

      expect(timesOverlap(startA, endA, startB, endB)).toBe(false);
    });
  });

  describe("timesAreClose", () => {
    it("returns true for times within threshold", () => {
      const a = DateTime.fromISO("2024-03-15T10:00:00Z");
      const b = DateTime.fromISO("2024-03-15T10:03:00Z");

      expect(timesAreClose(a, b, 5)).toBe(true);
    });

    it("returns false for times beyond threshold", () => {
      const a = DateTime.fromISO("2024-03-15T10:00:00Z");
      const b = DateTime.fromISO("2024-03-15T10:10:00Z");

      expect(timesAreClose(a, b, 5)).toBe(false);
    });
  });
});

