// ═══════════════════════════════════════════════════════════════════════════
// DateTime Ranges Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DateTime } from "luxon";
import {
  getDateRange,
  getNextDays,
  getPastDays,
  getNextHours,
  createRange,
  isInRange,
  rangesOverlap,
  getRangeOverlap,
  mergeRanges,
  getRangeDuration,
  eachDay,
  eachHour,
  getBusinessDays,
  getWeekendDays,
  countBusinessDays,
  addBusinessDays,
  subtractBusinessDays,
  type DateRange,
} from "@/lib/datetime";

describe("DateTime Ranges", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Wednesday, March 15, 2024
    vi.setSystemTime(new Date("2024-03-15T14:30:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─────────────────────────────────────────────────────────────
  // Named Ranges
  // ─────────────────────────────────────────────────────────────

  describe("getDateRange", () => {
    it("calculates today range correctly", () => {
      const range = getDateRange("today", "UTC");

      expect(range.start.day).toBe(15);
      expect(range.start.hour).toBe(0);
      expect(range.start.minute).toBe(0);
      expect(range.end.day).toBe(15);
      expect(range.end.hour).toBe(23);
      expect(range.end.minute).toBe(59);
    });

    it("calculates tomorrow range correctly", () => {
      const range = getDateRange("tomorrow", "UTC");

      expect(range.start.day).toBe(16);
      expect(range.end.day).toBe(16);
    });

    it("calculates yesterday range correctly", () => {
      const range = getDateRange("yesterday", "UTC");

      expect(range.start.day).toBe(14);
      expect(range.end.day).toBe(14);
    });

    it("calculates thisWeek range (Mon-Sun)", () => {
      const range = getDateRange("thisWeek", "UTC");

      // Week should start on Monday (March 11) and end on Sunday (March 17)
      expect(range.start.weekday).toBe(1); // Monday
      expect(range.end.weekday).toBe(7); // Sunday
    });

    it("calculates thisMonth range correctly", () => {
      const range = getDateRange("thisMonth", "UTC");

      expect(range.start.day).toBe(1);
      expect(range.start.month).toBe(3);
      expect(range.end.day).toBe(31); // March has 31 days
      expect(range.end.month).toBe(3);
    });

    it("calculates thisYear range correctly", () => {
      const range = getDateRange("thisYear", "UTC");

      expect(range.start.month).toBe(1);
      expect(range.start.day).toBe(1);
      expect(range.end.month).toBe(12);
      expect(range.end.day).toBe(31);
    });

    it("handles lastWeek correctly", () => {
      const range = getDateRange("lastWeek", "UTC");

      expect(range.start.day).toBe(4); // March 4
      expect(range.end.day).toBe(10); // March 10
    });

    it("handles nextWeek correctly", () => {
      const range = getDateRange("nextWeek", "UTC");

      expect(range.start.day).toBe(18); // March 18
      expect(range.end.day).toBe(24); // March 24
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Relative Ranges
  // ─────────────────────────────────────────────────────────────

  describe("getNextDays", () => {
    it("returns range from now to N days ahead", () => {
      const range = getNextDays(7, "UTC");

      expect(range.start.day).toBe(15);
      expect(range.start.hour).toBe(14);
      expect(range.end.day).toBe(22);
      expect(range.end.hour).toBe(23);
    });
  });

  describe("getPastDays", () => {
    it("returns range from N days ago to now", () => {
      const range = getPastDays(7, "UTC");

      expect(range.start.day).toBe(8);
      expect(range.start.hour).toBe(0);
      expect(range.end.day).toBe(15);
      expect(range.end.hour).toBe(14);
    });
  });

  describe("getNextHours", () => {
    it("returns range from now to N hours ahead", () => {
      const range = getNextHours(4, "UTC");

      expect(range.start.hour).toBe(14);
      expect(range.end.hour).toBe(18);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Range Operations
  // ─────────────────────────────────────────────────────────────

  describe("isInRange", () => {
    it("returns true for date within range", () => {
      const range = createRange(
        DateTime.fromISO("2024-03-15T09:00:00Z"),
        DateTime.fromISO("2024-03-15T17:00:00Z")
      );
      const dt = DateTime.fromISO("2024-03-15T12:00:00Z");

      expect(isInRange(dt, range)).toBe(true);
    });

    it("returns false for date outside range", () => {
      const range = createRange(
        DateTime.fromISO("2024-03-15T09:00:00Z"),
        DateTime.fromISO("2024-03-15T17:00:00Z")
      );
      const dt = DateTime.fromISO("2024-03-15T20:00:00Z");

      expect(isInRange(dt, range)).toBe(false);
    });

    it("includes boundary dates", () => {
      const range = createRange(
        DateTime.fromISO("2024-03-15T09:00:00Z"),
        DateTime.fromISO("2024-03-15T17:00:00Z")
      );

      expect(isInRange(range.start, range)).toBe(true);
      expect(isInRange(range.end, range)).toBe(true);
    });
  });

  describe("rangesOverlap", () => {
    it("detects overlapping ranges", () => {
      const a = createRange(
        DateTime.fromISO("2024-03-15T09:00:00Z"),
        DateTime.fromISO("2024-03-15T12:00:00Z")
      );
      const b = createRange(
        DateTime.fromISO("2024-03-15T11:00:00Z"),
        DateTime.fromISO("2024-03-15T14:00:00Z")
      );

      expect(rangesOverlap(a, b)).toBe(true);
    });

    it("returns false for non-overlapping ranges", () => {
      const a = createRange(
        DateTime.fromISO("2024-03-15T09:00:00Z"),
        DateTime.fromISO("2024-03-15T10:00:00Z")
      );
      const b = createRange(
        DateTime.fromISO("2024-03-15T11:00:00Z"),
        DateTime.fromISO("2024-03-15T12:00:00Z")
      );

      expect(rangesOverlap(a, b)).toBe(false);
    });

    it("returns false for adjacent ranges (no overlap)", () => {
      const a = createRange(
        DateTime.fromISO("2024-03-15T09:00:00Z"),
        DateTime.fromISO("2024-03-15T10:00:00Z")
      );
      const b = createRange(
        DateTime.fromISO("2024-03-15T10:00:00Z"),
        DateTime.fromISO("2024-03-15T11:00:00Z")
      );

      // Adjacent but not overlapping
      expect(rangesOverlap(a, b)).toBe(false);
    });
  });

  describe("getRangeOverlap", () => {
    it("returns overlap range when ranges overlap", () => {
      const a = createRange(
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 9 }, { zone: "UTC" }),
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 12 }, { zone: "UTC" })
      );
      const b = createRange(
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 11 }, { zone: "UTC" }),
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 14 }, { zone: "UTC" })
      );

      const overlap = getRangeOverlap(a, b);

      expect(overlap).not.toBeNull();
      expect(overlap!.start.hour).toBe(11);
      expect(overlap!.end.hour).toBe(12);
    });

    it("returns null when ranges don't overlap", () => {
      const a = createRange(
        DateTime.fromISO("2024-03-15T09:00:00Z"),
        DateTime.fromISO("2024-03-15T10:00:00Z")
      );
      const b = createRange(
        DateTime.fromISO("2024-03-15T11:00:00Z"),
        DateTime.fromISO("2024-03-15T12:00:00Z")
      );

      expect(getRangeOverlap(a, b)).toBeNull();
    });
  });

  describe("mergeRanges", () => {
    it("merges overlapping ranges", () => {
      const a = createRange(
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 9 }, { zone: "UTC" }),
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 12 }, { zone: "UTC" })
      );
      const b = createRange(
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 11 }, { zone: "UTC" }),
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 14 }, { zone: "UTC" })
      );

      const merged = mergeRanges(a, b);

      expect(merged).not.toBeNull();
      expect(merged!.start.hour).toBe(9);
      expect(merged!.end.hour).toBe(14);
    });

    it("merges adjacent ranges", () => {
      const a = createRange(
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 9 }, { zone: "UTC" }),
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 12 }, { zone: "UTC" })
      );
      const b = createRange(
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 12 }, { zone: "UTC" }),
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 14 }, { zone: "UTC" })
      );

      const merged = mergeRanges(a, b);

      expect(merged).not.toBeNull();
      expect(merged!.start.hour).toBe(9);
      expect(merged!.end.hour).toBe(14);
    });

    it("returns null for non-adjacent ranges", () => {
      const a = createRange(
        DateTime.fromISO("2024-03-15T09:00:00Z"),
        DateTime.fromISO("2024-03-15T10:00:00Z")
      );
      const b = createRange(
        DateTime.fromISO("2024-03-15T11:00:00Z"),
        DateTime.fromISO("2024-03-15T12:00:00Z")
      );

      expect(mergeRanges(a, b)).toBeNull();
    });
  });

  describe("getRangeDuration", () => {
    it("calculates duration in minutes", () => {
      const range = createRange(
        DateTime.fromISO("2024-03-15T09:00:00Z"),
        DateTime.fromISO("2024-03-15T10:30:00Z")
      );

      expect(getRangeDuration(range, "minutes")).toBe(90);
    });

    it("calculates duration in hours", () => {
      const range = createRange(
        DateTime.fromISO("2024-03-15T09:00:00Z"),
        DateTime.fromISO("2024-03-15T15:00:00Z")
      );

      expect(getRangeDuration(range, "hours")).toBe(6);
    });

    it("calculates duration in days", () => {
      const range = createRange(
        DateTime.fromISO("2024-03-15T00:00:00Z"),
        DateTime.fromISO("2024-03-17T00:00:00Z")
      );

      expect(getRangeDuration(range, "days")).toBe(2);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Day Iteration
  // ─────────────────────────────────────────────────────────────

  describe("eachDay", () => {
    it("yields each day in range", () => {
      const range = createRange(
        DateTime.fromObject({ year: 2024, month: 3, day: 15 }, { zone: "UTC" }),
        DateTime.fromObject({ year: 2024, month: 3, day: 17, hour: 23, minute: 59, second: 59 }, { zone: "UTC" })
      );

      const days = [...eachDay(range)];

      expect(days).toHaveLength(3);
      expect(days[0].day).toBe(15);
      expect(days[1].day).toBe(16);
      expect(days[2].day).toBe(17);
    });

    it("handles single-day range", () => {
      const range = createRange(
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 9 }, { zone: "UTC" }),
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 17 }, { zone: "UTC" })
      );

      const days = [...eachDay(range)];

      expect(days).toHaveLength(1);
      expect(days[0].day).toBe(15);
    });
  });

  describe("eachHour", () => {
    it("yields each hour in range", () => {
      const range = createRange(
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 9 }, { zone: "UTC" }),
        DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 12 }, { zone: "UTC" })
      );

      const hours = [...eachHour(range)];

      expect(hours).toHaveLength(4);
      expect(hours[0].hour).toBe(9);
      expect(hours[1].hour).toBe(10);
      expect(hours[2].hour).toBe(11);
      expect(hours[3].hour).toBe(12);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Business Days
  // ─────────────────────────────────────────────────────────────

  describe("getBusinessDays", () => {
    it("returns only weekdays", () => {
      // March 15 (Fri) to March 20 (Wed)
      const range = createRange(
        DateTime.fromObject({ year: 2024, month: 3, day: 15 }, { zone: "UTC" }),
        DateTime.fromObject({ year: 2024, month: 3, day: 20, hour: 23, minute: 59, second: 59 }, { zone: "UTC" })
      );

      const businessDays = getBusinessDays(range);

      // Fri, Mon, Tue, Wed = 4 days (Sat, Sun excluded)
      expect(businessDays).toHaveLength(4);
      expect(businessDays.every((d) => d.weekday <= 5)).toBe(true);
    });
  });

  describe("getWeekendDays", () => {
    it("returns only weekend days", () => {
      // March 15 (Fri) to March 20 (Wed)
      const range = createRange(
        DateTime.fromISO("2024-03-15T00:00:00Z"),
        DateTime.fromISO("2024-03-20T23:59:59Z")
      );

      const weekendDays = getWeekendDays(range);

      // Sat, Sun = 2 days
      expect(weekendDays).toHaveLength(2);
      expect(weekendDays.every((d) => d.weekday >= 6)).toBe(true);
    });
  });

  describe("countBusinessDays", () => {
    it("counts weekdays in range", () => {
      // March 11 (Mon) to March 15 (Fri) = 5 business days
      const range = createRange(
        DateTime.fromISO("2024-03-11T00:00:00Z"),
        DateTime.fromISO("2024-03-15T23:59:59Z")
      );

      expect(countBusinessDays(range)).toBe(5);
    });
  });

  describe("addBusinessDays", () => {
    it("adds business days, skipping weekends", () => {
      // Friday + 1 business day = Monday
      const friday = DateTime.fromISO("2024-03-15T10:00:00Z");
      const result = addBusinessDays(friday, 1);

      expect(result.weekday).toBe(1); // Monday
      expect(result.day).toBe(18);
    });

    it("adds multiple business days", () => {
      // Friday + 5 business days = Friday next week
      const friday = DateTime.fromISO("2024-03-15T10:00:00Z");
      const result = addBusinessDays(friday, 5);

      expect(result.weekday).toBe(5); // Friday
      expect(result.day).toBe(22);
    });
  });

  describe("subtractBusinessDays", () => {
    it("subtracts business days, skipping weekends", () => {
      // Monday - 1 business day = Friday
      const monday = DateTime.fromISO("2024-03-18T10:00:00Z");
      const result = subtractBusinessDays(monday, 1);

      expect(result.weekday).toBe(5); // Friday
      expect(result.day).toBe(15);
    });
  });
});

