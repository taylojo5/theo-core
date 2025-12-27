// ═══════════════════════════════════════════════════════════════════════════
// Duration Utilities Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { DateTime, Duration } from "luxon";
import {
  durationFromMinutes,
  durationFromHours,
  durationFromDays,
  durationFrom,
  durationFromMillis,
  durationBetween,
  minutesBetween,
  hoursBetween,
  addDuration,
  subtractDuration,
  addMinutes,
  addHours,
  addDays,
  addWeeks,
  addMonths,
  formatDuration,
  formatDurationLong,
  formatDurationClock,
  toTotalMinutes,
  toTotalHours,
  toTotalDays,
  toTotalMillis,
  isZeroDuration,
  isPositiveDuration,
  isNegativeDuration,
  isLongerThan,
  isShorterThan,
  absDuration,
} from "@/lib/datetime";

describe("Duration Utilities", () => {
  // ─────────────────────────────────────────────────────────────
  // Duration Creation
  // ─────────────────────────────────────────────────────────────

  describe("Duration Creation", () => {
    it("creates duration from minutes", () => {
      const duration = durationFromMinutes(30);
      expect(duration.minutes).toBe(30);
    });

    it("creates duration from hours", () => {
      const duration = durationFromHours(2);
      expect(duration.hours).toBe(2);
    });

    it("creates duration from days", () => {
      const duration = durationFromDays(5);
      expect(duration.days).toBe(5);
    });

    it("creates duration from object", () => {
      const duration = durationFrom({ hours: 2, minutes: 30 });
      expect(duration.hours).toBe(2);
      expect(duration.minutes).toBe(30);
    });

    it("creates duration from milliseconds", () => {
      const duration = durationFromMillis(3600000); // 1 hour
      expect(duration.as("hours")).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Duration Between DateTimes
  // ─────────────────────────────────────────────────────────────

  describe("Duration Between", () => {
    it("calculates duration between DateTimes", () => {
      const start = DateTime.fromISO("2024-03-15T09:00:00Z");
      const end = DateTime.fromISO("2024-03-15T11:30:00Z");

      const duration = durationBetween(start, end);

      expect(duration.as("minutes")).toBe(150);
    });

    it("calculates minutes between DateTimes", () => {
      const start = DateTime.fromISO("2024-03-15T09:00:00Z");
      const end = DateTime.fromISO("2024-03-15T09:45:00Z");

      expect(minutesBetween(start, end)).toBe(45);
    });

    it("calculates hours between DateTimes", () => {
      const start = DateTime.fromISO("2024-03-15T09:00:00Z");
      const end = DateTime.fromISO("2024-03-15T15:00:00Z");

      expect(hoursBetween(start, end)).toBe(6);
    });

    it("handles negative durations", () => {
      const start = DateTime.fromISO("2024-03-15T12:00:00Z");
      const end = DateTime.fromISO("2024-03-15T09:00:00Z");

      const duration = durationBetween(start, end);

      expect(duration.as("hours")).toBe(-3);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Duration Arithmetic
  // ─────────────────────────────────────────────────────────────

  describe("Duration Arithmetic", () => {
    const baseTime = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 12 }, { zone: "UTC" });

    it("adds duration to DateTime", () => {
      const duration = Duration.fromObject({ hours: 2 });
      const result = addDuration(baseTime, duration);

      expect(result.hour).toBe(14);
    });

    it("subtracts duration from DateTime", () => {
      const duration = Duration.fromObject({ hours: 2 });
      const result = subtractDuration(baseTime, duration);

      expect(result.hour).toBe(10);
    });

    it("adds minutes", () => {
      const result = addMinutes(baseTime, 30);
      expect(result.minute).toBe(30);
    });

    it("adds hours", () => {
      const result = addHours(baseTime, 3);
      expect(result.hour).toBe(15);
    });

    it("adds days", () => {
      const result = addDays(baseTime, 5);
      expect(result.day).toBe(20);
    });

    it("adds weeks", () => {
      const result = addWeeks(baseTime, 2);
      expect(result.day).toBe(29);
    });

    it("adds months", () => {
      const result = addMonths(baseTime, 2);
      expect(result.month).toBe(5); // March + 2 = May
    });

    it("handles month boundaries correctly", () => {
      const jan31 = DateTime.fromISO("2024-01-31T12:00:00Z");
      const result = addMonths(jan31, 1);

      // Feb 2024 has 29 days (leap year), so Jan 31 + 1 month = Feb 29
      expect(result.month).toBe(2);
      expect(result.day).toBe(29);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Duration Formatting
  // ─────────────────────────────────────────────────────────────

  describe("Duration Formatting", () => {
    it("formats duration in short form", () => {
      expect(formatDuration(Duration.fromObject({ hours: 2 }))).toBe("2h");
      expect(formatDuration(Duration.fromObject({ minutes: 30 }))).toBe("30m");
      expect(formatDuration(Duration.fromObject({ hours: 2, minutes: 30 }))).toBe("2h 30m");
      expect(formatDuration(Duration.fromObject({ days: 1, hours: 5 }))).toBe("1d 5h");
    });

    it("formats zero duration", () => {
      expect(formatDuration(Duration.fromObject({}))).toBe("0m");
    });

    it("formats duration in long form", () => {
      expect(formatDurationLong(Duration.fromObject({ hours: 1 }))).toBe("1 hour");
      expect(formatDurationLong(Duration.fromObject({ hours: 2 }))).toBe("2 hours");
      expect(formatDurationLong(Duration.fromObject({ minutes: 1 }))).toBe("1 minute");
      expect(formatDurationLong(Duration.fromObject({ hours: 2, minutes: 30 }))).toBe(
        "2 hours 30 minutes"
      );
    });

    it("formats duration as clock time", () => {
      expect(formatDurationClock(Duration.fromObject({ hours: 2, minutes: 30 }))).toBe("02:30");
      expect(formatDurationClock(Duration.fromObject({ hours: 10, minutes: 5 }))).toBe("10:05");
      expect(formatDurationClock(Duration.fromObject({ minutes: 45 }))).toBe("00:45");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Duration Conversion
  // ─────────────────────────────────────────────────────────────

  describe("Duration Conversion", () => {
    const duration = Duration.fromObject({ hours: 2, minutes: 30 });

    it("converts to total minutes", () => {
      expect(toTotalMinutes(duration)).toBe(150);
    });

    it("converts to total hours", () => {
      expect(toTotalHours(duration)).toBe(2.5);
    });

    it("converts to total days", () => {
      const days = Duration.fromObject({ days: 2, hours: 12 });
      expect(toTotalDays(days)).toBe(2.5);
    });

    it("converts to milliseconds", () => {
      const oneHour = Duration.fromObject({ hours: 1 });
      expect(toTotalMillis(oneHour)).toBe(3600000);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Duration Comparison
  // ─────────────────────────────────────────────────────────────

  describe("Duration Comparison", () => {
    it("checks if duration is zero", () => {
      expect(isZeroDuration(Duration.fromObject({}))).toBe(true);
      expect(isZeroDuration(Duration.fromObject({ minutes: 0 }))).toBe(true);
      expect(isZeroDuration(Duration.fromObject({ minutes: 1 }))).toBe(false);
    });

    it("checks if duration is positive", () => {
      expect(isPositiveDuration(Duration.fromObject({ hours: 1 }))).toBe(true);
      expect(isPositiveDuration(Duration.fromObject({}))).toBe(false);
    });

    it("checks if duration is negative", () => {
      expect(isNegativeDuration(Duration.fromObject({ hours: -1 }))).toBe(true);
      expect(isNegativeDuration(Duration.fromObject({ hours: 1 }))).toBe(false);
    });

    it("compares duration lengths", () => {
      const shorter = Duration.fromObject({ hours: 1 });
      const longer = Duration.fromObject({ hours: 2 });

      expect(isLongerThan(longer, shorter)).toBe(true);
      expect(isLongerThan(shorter, longer)).toBe(false);
      expect(isShorterThan(shorter, longer)).toBe(true);
      expect(isShorterThan(longer, shorter)).toBe(false);
    });

    it("gets absolute value of duration", () => {
      const negative = Duration.fromObject({ hours: -2 });
      const positive = absDuration(negative);

      expect(positive.as("hours")).toBe(2);
    });

    it("preserves already positive durations", () => {
      const positive = Duration.fromObject({ hours: 2 });
      const result = absDuration(positive);

      expect(result.as("hours")).toBe(2);
    });
  });
});

