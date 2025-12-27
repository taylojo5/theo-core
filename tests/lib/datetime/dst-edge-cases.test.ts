// ═══════════════════════════════════════════════════════════════════════════
// DST Edge Case Tests
// Tests for Daylight Saving Time transitions and timezone edge cases
// These tests ensure Luxon handles DST correctly where native Date fails
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { DateTime } from "luxon";
import {
  addDays,
  daysUntil,
  eachDay,
  createRange,
  type DateRange,
} from "@/lib/datetime";

// ─────────────────────────────────────────────────────────────
// DST Transition Dates (US Eastern Time)
// Spring forward: March 10, 2024 at 2:00 AM → 3:00 AM
// Fall back: November 3, 2024 at 2:00 AM → 1:00 AM
// ─────────────────────────────────────────────────────────────

const TIMEZONE = "America/New_York";

// Spring forward 2024: March 10 at 2am becomes 3am
const SPRING_FORWARD_DATE = "2024-03-10";
const BEFORE_SPRING_FORWARD = "2024-03-09";
const AFTER_SPRING_FORWARD = "2024-03-11";

// Fall back 2024: November 3 at 2am becomes 1am (hour repeats)
const FALL_BACK_DATE = "2024-11-03";
const BEFORE_FALL_BACK = "2024-11-02";
const AFTER_FALL_BACK = "2024-11-04";

describe("DST Edge Cases", () => {
  // ═══════════════════════════════════════════════════════════
  // Spring Forward (March) - 23 Hour Day
  // ═══════════════════════════════════════════════════════════

  describe("Spring Forward (March - 23 hour day)", () => {
    it("should correctly calculate day duration during spring forward", () => {
      const startOfDay = DateTime.fromISO(`${SPRING_FORWARD_DATE}T00:00:00`, {
        zone: TIMEZONE,
      });
      const endOfDay = DateTime.fromISO(`${SPRING_FORWARD_DATE}T23:59:59`, {
        zone: TIMEZONE,
      });

      // The day should only have 23 hours due to DST spring forward
      const duration = endOfDay.diff(startOfDay, "hours");
      expect(Math.floor(duration.hours)).toBe(22); // 23:59:59 - 00:00:00 ≈ 23 hours minus 1 for DST
    });

    it("should add 1 day correctly across spring forward", () => {
      const beforeDst = DateTime.fromISO(`${BEFORE_SPRING_FORWARD}T10:00:00`, {
        zone: TIMEZONE,
      });
      const afterAdding = beforeDst.plus({ days: 1 });

      // Adding 1 day should preserve the local time (10:00)
      expect(afterAdding.hour).toBe(10);
      expect(afterAdding.day).toBe(10);
      expect(afterAdding.month).toBe(3);
    });

    it("should handle the non-existent 2:30 AM correctly", () => {
      // 2:30 AM doesn't exist on March 10, 2024 in Eastern Time
      const nonExistentTime = DateTime.fromObject(
        {
          year: 2024,
          month: 3,
          day: 10,
          hour: 2,
          minute: 30,
        },
        { zone: TIMEZONE }
      );

      // Luxon should push this forward to 3:30 AM
      expect(nonExistentTime.isValid).toBe(true);
      expect(nonExistentTime.hour).toBe(3);
      expect(nonExistentTime.minute).toBe(30);
    });

    it("should iterate days correctly across spring forward", () => {
      const start = DateTime.fromISO(`${BEFORE_SPRING_FORWARD}T00:00:00`, {
        zone: TIMEZONE,
      });
      const end = DateTime.fromISO(`${AFTER_SPRING_FORWARD}T23:59:59`, {
        zone: TIMEZONE,
      });

      const range: DateRange = { start, end };
      const days = [...eachDay(range)];

      // Should have exactly 3 days: March 9, 10, 11
      expect(days.length).toBe(3);
      expect(days[0].day).toBe(9);
      expect(days[1].day).toBe(10);
      expect(days[2].day).toBe(11);
    });

    it("should calculate working hours correctly on DST day", () => {
      const workStart = DateTime.fromISO(`${SPRING_FORWARD_DATE}T09:00:00`, {
        zone: TIMEZONE,
      });
      const workEnd = DateTime.fromISO(`${SPRING_FORWARD_DATE}T17:00:00`, {
        zone: TIMEZONE,
      });

      // 9 AM to 5 PM should still be 8 hours (DST happens at 2 AM)
      const workHours = workEnd.diff(workStart, "hours");
      expect(workHours.hours).toBe(8);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Fall Back (November) - 25 Hour Day
  // ═══════════════════════════════════════════════════════════

  describe("Fall Back (November - 25 hour day)", () => {
    it("should correctly calculate day duration during fall back", () => {
      const startOfDay = DateTime.fromISO(`${FALL_BACK_DATE}T00:00:00`, {
        zone: TIMEZONE,
      });
      const endOfDay = DateTime.fromISO(`${FALL_BACK_DATE}T23:59:59`, {
        zone: TIMEZONE,
      });

      // The day should have ~25 hours due to DST fall back
      const duration = endOfDay.diff(startOfDay, "hours");
      expect(Math.floor(duration.hours)).toBe(24); // Close to 25 but just under
    });

    it("should add 1 day correctly across fall back", () => {
      const beforeDst = DateTime.fromISO(`${BEFORE_FALL_BACK}T10:00:00`, {
        zone: TIMEZONE,
      });
      const afterAdding = beforeDst.plus({ days: 1 });

      // Adding 1 day should preserve the local time (10:00)
      expect(afterAdding.hour).toBe(10);
      expect(afterAdding.day).toBe(3);
      expect(afterAdding.month).toBe(11);
    });

    it("should handle the ambiguous 1:30 AM correctly", () => {
      // 1:30 AM occurs twice on November 3, 2024 in Eastern Time
      // Luxon defaults to the first occurrence (before the transition)
      const ambiguousTime = DateTime.fromObject(
        {
          year: 2024,
          month: 11,
          day: 3,
          hour: 1,
          minute: 30,
        },
        { zone: TIMEZONE }
      );

      expect(ambiguousTime.isValid).toBe(true);
      expect(ambiguousTime.hour).toBe(1);
      expect(ambiguousTime.minute).toBe(30);
    });

    it("should iterate days correctly across fall back", () => {
      const start = DateTime.fromISO(`${BEFORE_FALL_BACK}T00:00:00`, {
        zone: TIMEZONE,
      });
      const end = DateTime.fromISO(`${AFTER_FALL_BACK}T23:59:59`, {
        zone: TIMEZONE,
      });

      const range: DateRange = { start, end };
      const days = [...eachDay(range)];

      // Should have exactly 3 days: November 2, 3, 4
      expect(days.length).toBe(3);
      expect(days[0].day).toBe(2);
      expect(days[1].day).toBe(3);
      expect(days[2].day).toBe(4);
    });

    it("should calculate overnight shift correctly spanning fall back", () => {
      // A night shift from 10 PM on Nov 2 to 6 AM on Nov 3
      const shiftStart = DateTime.fromISO(`${BEFORE_FALL_BACK}T22:00:00`, {
        zone: TIMEZONE,
      });
      const shiftEnd = DateTime.fromISO(`${FALL_BACK_DATE}T06:00:00`, {
        zone: TIMEZONE,
      });

      // This shift includes the extra hour from fall back
      const shiftHours = shiftEnd.diff(shiftStart, "hours");
      expect(shiftHours.hours).toBe(9); // 8 hours + 1 extra hour from DST
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Multi-Day Calculations Across DST
  // ═══════════════════════════════════════════════════════════

  describe("Multi-Day Calculations Across DST", () => {
    it("should calculate days remaining correctly across spring forward", () => {
      const fromDt = DateTime.fromISO(`${BEFORE_SPRING_FORWARD}T12:00:00`, {
        zone: TIMEZONE,
      });
      const deadline = DateTime.fromISO(`${AFTER_SPRING_FORWARD}T12:00:00`, {
        zone: TIMEZONE,
      });

      // Manual calculation: deadline - fromDt in days
      const daysRemaining = Math.floor(deadline.diff(fromDt, "days").days);
      expect(daysRemaining).toBe(2);
    });

    it("should calculate days remaining correctly across fall back", () => {
      const fromDt = DateTime.fromISO(`${BEFORE_FALL_BACK}T12:00:00`, {
        zone: TIMEZONE,
      });
      const deadline = DateTime.fromISO(`${AFTER_FALL_BACK}T12:00:00`, {
        zone: TIMEZONE,
      });

      const daysRemaining = Math.floor(deadline.diff(fromDt, "days").days);
      expect(daysRemaining).toBe(2);
    });

    it("should check if date is within days correctly across DST", () => {
      const fromDt = DateTime.fromISO(`${BEFORE_SPRING_FORWARD}T12:00:00`, {
        zone: TIMEZONE,
      });
      const targetDate = DateTime.fromISO(`${AFTER_SPRING_FORWARD}T12:00:00`, {
        zone: TIMEZONE,
      });

      // Target is 2 days from fromDt
      const daysDiff = targetDate.diff(fromDt, "days").days;
      expect(daysDiff < 3).toBe(true);  // Within 3 days
      expect(daysDiff < 1).toBe(false); // Not within 1 day
    });

    it("should handle week-long ranges across DST", () => {
      // Week that includes spring forward
      const weekStart = DateTime.fromISO("2024-03-08T00:00:00", {
        zone: TIMEZONE,
      });
      const weekEnd = DateTime.fromISO("2024-03-14T23:59:59", {
        zone: TIMEZONE,
      });

      const range: DateRange = { start: weekStart, end: weekEnd };
      const days = [...eachDay(range)];
      expect(days.length).toBe(7);

      // Verify all days are present
      const dayNumbers = days.map((d) => d.day);
      expect(dayNumbers).toEqual([8, 9, 10, 11, 12, 13, 14]);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Start/End of Day Across DST
  // ═══════════════════════════════════════════════════════════

  describe("Start/End of Day Across DST", () => {
    it("should get start of day correctly on spring forward day", () => {
      const dt = DateTime.fromISO(`${SPRING_FORWARD_DATE}T14:30:00`, {
        zone: TIMEZONE,
      });
      const startOfDay = dt.startOf("day");

      expect(startOfDay.hour).toBe(0);
      expect(startOfDay.minute).toBe(0);
      expect(startOfDay.second).toBe(0);
      expect(startOfDay.day).toBe(10);
    });

    it("should get end of day correctly on spring forward day", () => {
      const dt = DateTime.fromISO(`${SPRING_FORWARD_DATE}T14:30:00`, {
        zone: TIMEZONE,
      });
      const endOfDay = dt.endOf("day");

      expect(endOfDay.hour).toBe(23);
      expect(endOfDay.minute).toBe(59);
      expect(endOfDay.second).toBe(59);
      expect(endOfDay.day).toBe(10);
    });

    it("should get start of day correctly on fall back day", () => {
      const dt = DateTime.fromISO(`${FALL_BACK_DATE}T14:30:00`, {
        zone: TIMEZONE,
      });
      const startOfDay = dt.startOf("day");

      expect(startOfDay.hour).toBe(0);
      expect(startOfDay.minute).toBe(0);
      expect(startOfDay.day).toBe(3);
    });

    it("should get end of day correctly on fall back day", () => {
      const dt = DateTime.fromISO(`${FALL_BACK_DATE}T14:30:00`, {
        zone: TIMEZONE,
      });
      const endOfDay = dt.endOf("day");

      expect(endOfDay.hour).toBe(23);
      expect(endOfDay.minute).toBe(59);
      expect(endOfDay.day).toBe(3);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Timezone Conversion Across DST
  // ═══════════════════════════════════════════════════════════

  describe("Timezone Conversion Across DST", () => {
    it("should convert correctly during spring forward", () => {
      // 3:00 AM Eastern on March 10 = 7:00 AM UTC (EDT is UTC-4)
      const eastern = DateTime.fromISO(`${SPRING_FORWARD_DATE}T03:00:00`, {
        zone: TIMEZONE,
      });
      const utc = eastern.toUTC();

      expect(utc.hour).toBe(7);
      expect(eastern.offset).toBe(-240); // EDT is -4 hours = -240 minutes
    });

    it("should convert correctly before spring forward", () => {
      // 1:00 AM Eastern on March 10 = 6:00 AM UTC (EST is UTC-5)
      const eastern = DateTime.fromISO(`${SPRING_FORWARD_DATE}T01:00:00`, {
        zone: TIMEZONE,
      });
      const utc = eastern.toUTC();

      expect(utc.hour).toBe(6);
      expect(eastern.offset).toBe(-300); // EST is -5 hours = -300 minutes
    });

    it("should convert correctly during fall back (first 1 AM)", () => {
      // First 1:00 AM Eastern on November 3 = 5:00 AM UTC (EDT is UTC-4)
      const eastern = DateTime.fromISO(`${FALL_BACK_DATE}T01:00:00-04:00`);
      const utc = eastern.toUTC();

      expect(utc.hour).toBe(5);
    });

    it("should convert correctly during fall back (second 1 AM)", () => {
      // Second 1:00 AM Eastern on November 3 = 6:00 AM UTC (EST is UTC-5)
      const eastern = DateTime.fromISO(`${FALL_BACK_DATE}T01:00:00-05:00`);
      const utc = eastern.toUTC();

      expect(utc.hour).toBe(6);
    });

    it("should handle UTC to timezone conversion across DST", () => {
      // Same UTC time should have different local times before/after DST
      const utcTime = DateTime.fromISO("2024-03-10T06:00:00Z");

      const beforeDst = utcTime.setZone(TIMEZONE);
      expect(beforeDst.hour).toBe(1); // EST (UTC-5), so 6-5=1

      // After DST kicks in at 2 AM, but this is before
      // Let's check March 10 at 7 AM UTC
      const utcAfterDst = DateTime.fromISO("2024-03-10T08:00:00Z");
      const afterDst = utcAfterDst.setZone(TIMEZONE);
      expect(afterDst.hour).toBe(4); // EDT (UTC-4), so 8-4=4
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Real-World Scheduling Scenarios
  // ═══════════════════════════════════════════════════════════

  describe("Real-World Scheduling Scenarios", () => {
    it("should schedule a daily meeting correctly across spring forward", () => {
      // Meeting at 9 AM every day for a week starting March 8
      const meetingTimes: DateTime[] = [];
      let current = DateTime.fromISO("2024-03-08T09:00:00", { zone: TIMEZONE });

      for (let i = 0; i < 7; i++) {
        meetingTimes.push(current);
        current = current.plus({ days: 1 });
      }

      // All meetings should be at 9 AM local time
      for (const meeting of meetingTimes) {
        expect(meeting.hour).toBe(9);
        expect(meeting.minute).toBe(0);
      }

      // Verify dates are correct
      expect(meetingTimes.map((m) => m.day)).toEqual([8, 9, 10, 11, 12, 13, 14]);
    });

    it("should calculate availability correctly on DST day", () => {
      // Working hours 9 AM - 5 PM on March 10 (spring forward day)
      const workStart = DateTime.fromISO(`${SPRING_FORWARD_DATE}T09:00:00`, {
        zone: TIMEZONE,
      });
      const workEnd = DateTime.fromISO(`${SPRING_FORWARD_DATE}T17:00:00`, {
        zone: TIMEZONE,
      });

      // A 2-hour meeting at 10 AM should be within working hours
      const meetingStart = DateTime.fromISO(`${SPRING_FORWARD_DATE}T10:00:00`, {
        zone: TIMEZONE,
      });
      const meetingEnd = meetingStart.plus({ hours: 2 });

      expect(meetingStart >= workStart).toBe(true);
      expect(meetingEnd <= workEnd).toBe(true);
    });

    it("should handle deadline at midnight across DST", () => {
      // Deadline at midnight (end of March 10)
      const deadline = DateTime.fromISO(`${SPRING_FORWARD_DATE}T23:59:59`, {
        zone: TIMEZONE,
      });

      // Current time: 6 PM on March 10
      const now = DateTime.fromISO(`${SPRING_FORWARD_DATE}T18:00:00`, {
        zone: TIMEZONE,
      });

      const hoursRemaining = deadline.diff(now, "hours");
      expect(Math.floor(hoursRemaining.hours)).toBe(5); // ~6 hours remaining
    });

    it("should calculate recurring event correctly across fall back", () => {
      // Bi-weekly meeting starting Oct 20, 2024 at 10 AM
      const firstMeeting = DateTime.fromISO("2024-10-20T10:00:00", {
        zone: TIMEZONE,
      });

      // Next occurrence (Nov 3 - fall back day)
      const secondMeeting = firstMeeting.plus({ weeks: 2 });

      // Meeting should still be at 10 AM local time
      expect(secondMeeting.hour).toBe(10);
      expect(secondMeeting.day).toBe(3);
      expect(secondMeeting.month).toBe(11);
    });
  });

  // ═══════════════════════════════════════════════════════════
  // Edge Cases with Different Timezones
  // ═══════════════════════════════════════════════════════════

  describe("Cross-Timezone Edge Cases", () => {
    it("should handle same moment in different timezones during DST", () => {
      // 2024-03-10 at 3:00 AM Eastern (just after spring forward, EDT = UTC-4)
      // This is 7:00 AM UTC
      const eastern = DateTime.fromISO(`${SPRING_FORWARD_DATE}T03:00:00`, {
        zone: "America/New_York",
      });

      // Same moment in Pacific
      // Pacific springs forward at 2 AM PST (= 10 AM UTC)
      // At 7 AM UTC, Pacific is still PST (UTC-8): 7 - 8 = 23:00 on March 9
      const pacific = eastern.setZone("America/Los_Angeles");

      // Pacific should be 11 PM (23:00) on March 9
      expect(pacific.hour).toBe(23);
      expect(pacific.day).toBe(9);
    });

    it("should handle international date line implications", () => {
      // When it's March 10 in New York, it could be March 11 in Tokyo
      const nyTime = DateTime.fromISO(`${SPRING_FORWARD_DATE}T22:00:00`, {
        zone: "America/New_York",
      });

      const tokyoTime = nyTime.setZone("Asia/Tokyo");

      // Tokyo is 13 hours ahead of EDT
      expect(tokyoTime.hour).toBe(11);
      expect(tokyoTime.day).toBe(11); // Next day in Tokyo
    });

    it("should handle timezones that don't observe DST", () => {
      // Arizona doesn't observe DST (except Navajo Nation)
      const arizonaBeforeDst = DateTime.fromISO(
        `${BEFORE_SPRING_FORWARD}T12:00:00`,
        { zone: "America/Phoenix" }
      );
      const arizonaAfterDst = DateTime.fromISO(
        `${AFTER_SPRING_FORWARD}T12:00:00`,
        { zone: "America/Phoenix" }
      );

      // Both should have the same offset (-7)
      expect(arizonaBeforeDst.offset).toBe(-420);
      expect(arizonaAfterDst.offset).toBe(-420);
    });
  });
});

