// ═══════════════════════════════════════════════════════════════════════════
// DateTime Converters Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DateTime } from "luxon";
import {
  fromDate,
  toDate,
  fromISO,
  fromDateString,
  fromRFC2822,
  fromMillis,
  fromSeconds,
  toISO,
  toDateString,
  toRFC2822,
  toSeconds,
  toMillis,
  now,
  nowUTC,
  nowLocal,
  today,
  tomorrow,
  yesterday,
  safeParse,
  parse,
  fromDbDate,
  toDbDate,
} from "@/lib/datetime";

describe("DateTime Converters", () => {
  // ─────────────────────────────────────────────────────────────
  // Core Conversions
  // ─────────────────────────────────────────────────────────────

  describe("fromDate", () => {
    it("converts JS Date to DateTime", () => {
      const jsDate = new Date("2024-03-15T14:30:00Z");
      const dt = fromDate(jsDate);

      expect(dt.isValid).toBe(true);
      expect(dt.year).toBe(2024);
      expect(dt.month).toBe(3);
      expect(dt.day).toBe(15);
    });

    it("preserves the instant in time", () => {
      const jsDate = new Date("2024-03-15T14:30:00Z");
      const dt = fromDate(jsDate);

      expect(dt.toMillis()).toBe(jsDate.getTime());
    });

    it("respects timezone parameter", () => {
      const jsDate = new Date("2024-03-15T14:30:00Z");
      const dtNY = fromDate(jsDate, "America/New_York");

      expect(dtNY.zoneName).toBe("America/New_York");
      // Same instant, different local time
      expect(dtNY.toMillis()).toBe(jsDate.getTime());
    });

    it("defaults to UTC when no timezone specified", () => {
      const jsDate = new Date("2024-03-15T14:30:00Z");
      const dt = fromDate(jsDate);

      expect(dt.zoneName).toBe("UTC");
    });
  });

  describe("toDate", () => {
    it("converts DateTime to JS Date", () => {
      const dt = DateTime.fromISO("2024-03-15T14:30:00Z");
      const jsDate = toDate(dt);

      expect(jsDate).toBeInstanceOf(Date);
      expect(jsDate.toISOString()).toBe("2024-03-15T14:30:00.000Z");
    });

    it("preserves the instant across timezones", () => {
      const dtNY = DateTime.fromISO("2024-03-15T10:30:00", {
        zone: "America/New_York",
      });
      const dtLA = dtNY.setZone("America/Los_Angeles");

      const jsDateNY = toDate(dtNY);
      const jsDateLA = toDate(dtLA);

      // Same instant, same JS Date
      expect(jsDateNY.getTime()).toBe(jsDateLA.getTime());
    });
  });

  // ─────────────────────────────────────────────────────────────
  // String Parsing
  // ─────────────────────────────────────────────────────────────

  describe("fromISO", () => {
    it("parses ISO strings with timezone", () => {
      // When parsing with offset, the DateTime preserves the instant
      // but displays in the default zone (UTC)
      const dt = fromISO("2024-03-15T14:30:00-05:00");

      expect(dt.isValid).toBe(true);
      // 14:30 EST = 19:30 UTC
      expect(dt.toUTC().hour).toBe(19);
      expect(dt.minute).toBe(30);
    });

    it("parses ISO strings with Z (UTC)", () => {
      const dt = fromISO("2024-03-15T14:30:00Z");

      expect(dt.isValid).toBe(true);
      expect(dt.zoneName).toBe("UTC");
    });

    it("applies zone parameter for strings without offset", () => {
      const dt = fromISO("2024-03-15T14:30:00", "America/New_York");

      expect(dt.isValid).toBe(true);
      expect(dt.zoneName).toBe("America/New_York");
    });

    it("defaults to UTC for strings without offset", () => {
      const dt = fromISO("2024-03-15T14:30:00");

      expect(dt.zoneName).toBe("UTC");
    });
  });

  describe("fromDateString", () => {
    it("parses date-only string to start of day", () => {
      const dt = fromDateString("2024-03-15");

      expect(dt.isValid).toBe(true);
      expect(dt.year).toBe(2024);
      expect(dt.month).toBe(3);
      expect(dt.day).toBe(15);
      expect(dt.hour).toBe(0);
      expect(dt.minute).toBe(0);
      expect(dt.second).toBe(0);
    });

    it("respects timezone for start of day", () => {
      const dt = fromDateString("2024-03-15", "America/New_York");

      expect(dt.zoneName).toBe("America/New_York");
      expect(dt.hour).toBe(0);
    });
  });

  describe("fromRFC2822", () => {
    it("parses RFC2822 email date format", () => {
      const dt = fromRFC2822("Fri, 15 Mar 2024 14:30:00 -0500");

      expect(dt.isValid).toBe(true);
      expect(dt.year).toBe(2024);
      expect(dt.month).toBe(3);
      expect(dt.day).toBe(15);
    });

    it("handles various RFC2822 formats", () => {
      const formats = [
        "15 Mar 2024 14:30:00 +0000",
        "Fri, 15 Mar 2024 14:30:00 GMT",
        "15 Mar 24 14:30 +0000",
      ];

      for (const format of formats) {
        const dt = fromRFC2822(format);
        expect(dt.isValid).toBe(true);
      }
    });
  });

  describe("fromMillis", () => {
    it("parses millisecond timestamp", () => {
      const millis = 1710513000000; // 2024-03-15T14:30:00Z
      const dt = fromMillis(millis);

      expect(dt.isValid).toBe(true);
      expect(dt.toMillis()).toBe(millis);
    });
  });

  describe("fromSeconds", () => {
    it("parses Unix timestamp (seconds)", () => {
      const seconds = 1710513000; // 2024-03-15T14:30:00Z
      const dt = fromSeconds(seconds);

      expect(dt.isValid).toBe(true);
      expect(Math.floor(dt.toSeconds())).toBe(seconds);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // String Serialization
  // ─────────────────────────────────────────────────────────────

  describe("toISO", () => {
    it("serializes to ISO 8601 format", () => {
      const dt = DateTime.fromISO("2024-03-15T14:30:00Z", { zone: "UTC" });
      const iso = toISO(dt);

      expect(iso).toMatch(/^2024-03-15T14:30:00/);
    });

    it("includes timezone offset", () => {
      const dt = DateTime.fromISO("2024-03-15T14:30:00", {
        zone: "America/New_York",
      });
      const iso = toISO(dt);

      expect(iso).toMatch(/-0[45]:00$/); // -04:00 or -05:00 depending on DST
    });
  });

  describe("toDateString", () => {
    it("serializes to YYYY-MM-DD format", () => {
      const dt = DateTime.fromISO("2024-03-15T14:30:00Z");
      const dateStr = toDateString(dt);

      expect(dateStr).toBe("2024-03-15");
    });
  });

  describe("toRFC2822", () => {
    it("serializes to RFC2822 format", () => {
      const dt = DateTime.fromISO("2024-03-15T14:30:00Z");
      const rfc = toRFC2822(dt);

      expect(rfc).toMatch(/Fri, 15 Mar 2024/);
    });
  });

  describe("toSeconds / toMillis", () => {
    it("returns correct Unix timestamps", () => {
      const dt = DateTime.fromISO("2024-03-15T14:30:00Z");
      const millis = toMillis(dt);
      const seconds = toSeconds(dt);

      expect(millis).toBe(1710513000000);
      expect(seconds).toBe(1710513000);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Current Time Helpers
  // ─────────────────────────────────────────────────────────────

  describe("now / nowUTC / nowLocal", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-03-15T14:30:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("now() returns current time in specified zone", () => {
      const dt = now("UTC");
      expect(dt.year).toBe(2024);
      expect(dt.month).toBe(3);
      expect(dt.day).toBe(15);
      expect(dt.hour).toBe(14);
    });

    it("nowUTC() returns current time in UTC", () => {
      const dt = nowUTC();
      expect(dt.zoneName).toBe("UTC");
    });

    it("nowLocal() returns current time in local zone", () => {
      const dt = nowLocal();
      expect(dt.isValid).toBe(true);
    });
  });

  describe("today / tomorrow / yesterday", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2024-03-15T14:30:00Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("today() returns start of current day", () => {
      const dt = today("UTC");
      expect(dt.day).toBe(15);
      expect(dt.hour).toBe(0);
      expect(dt.minute).toBe(0);
    });

    it("tomorrow() returns start of next day", () => {
      const dt = tomorrow("UTC");
      expect(dt.day).toBe(16);
      expect(dt.hour).toBe(0);
    });

    it("yesterday() returns start of previous day", () => {
      const dt = yesterday("UTC");
      expect(dt.day).toBe(14);
      expect(dt.hour).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Safe Parsing
  // ─────────────────────────────────────────────────────────────

  describe("safeParse", () => {
    it("parses valid ISO strings", () => {
      const dt = safeParse("2024-03-15T14:30:00Z");
      expect(dt).not.toBeNull();
      expect(dt!.isValid).toBe(true);
    });

    it("parses Date objects", () => {
      const jsDate = new Date("2024-03-15T14:30:00Z");
      const dt = safeParse(jsDate);
      expect(dt).not.toBeNull();
      expect(dt!.isValid).toBe(true);
    });

    it("parses timestamps", () => {
      const dt = safeParse(1710513000000);
      expect(dt).not.toBeNull();
    });

    it("parses RFC2822 strings", () => {
      const dt = safeParse("Fri, 15 Mar 2024 14:30:00 +0000");
      expect(dt).not.toBeNull();
    });

    it("returns null for invalid strings", () => {
      expect(safeParse("not a date")).toBeNull();
      expect(safeParse("")).toBeNull();
      expect(safeParse("12345")).toBeNull();
    });

    it("returns null for null/undefined", () => {
      expect(safeParse(null)).toBeNull();
      expect(safeParse(undefined)).toBeNull();
    });

    it("passes through valid DateTime objects", () => {
      const original = DateTime.fromISO("2024-03-15T14:30:00Z");
      const result = safeParse(original);
      expect(result).toBe(original);
    });
  });

  describe("parse", () => {
    it("parses valid input", () => {
      const dt = parse("2024-03-15T14:30:00Z");
      expect(dt.isValid).toBe(true);
    });

    it("throws for invalid input", () => {
      expect(() => parse("not a date")).toThrow();
      expect(() => parse(null)).toThrow();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Database Helpers
  // ─────────────────────────────────────────────────────────────

  describe("fromDbDate / toDbDate", () => {
    it("fromDbDate converts nullable Date", () => {
      const jsDate = new Date("2024-03-15T14:30:00Z");
      const dt = fromDbDate(jsDate);

      expect(dt).toBeDefined();
      expect(dt!.isValid).toBe(true);
    });

    it("fromDbDate returns undefined for null", () => {
      expect(fromDbDate(null)).toBeUndefined();
      expect(fromDbDate(undefined)).toBeUndefined();
    });

    it("toDbDate converts DateTime to Date", () => {
      const dt = DateTime.fromISO("2024-03-15T14:30:00Z");
      const jsDate = toDbDate(dt);

      expect(jsDate).toBeInstanceOf(Date);
    });

    it("toDbDate returns undefined for undefined input", () => {
      expect(toDbDate(undefined)).toBeUndefined();
    });
  });
});

