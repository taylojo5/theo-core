// ═══════════════════════════════════════════════════════════════════════════
// Timezone Utilities Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { DateTime } from "luxon";
import {
  isValidTimezone,
  resolveTimezone,
  safeTimezone,
  getLocalTimezone,
  getUTCOffset,
  getUTCOffsetMinutes,
  getTimezoneAbbr,
  isInDST,
  toTimezone,
  toUTC,
  toLocal,
  setTimezoneKeepLocal,
  getCommonTimezones,
  searchTimezones,
} from "@/lib/datetime";

describe("Timezone Utilities", () => {
  // ─────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────

  describe("isValidTimezone", () => {
    it("validates IANA timezone names", () => {
      expect(isValidTimezone("America/New_York")).toBe(true);
      expect(isValidTimezone("Europe/London")).toBe(true);
      expect(isValidTimezone("Asia/Tokyo")).toBe(true);
      expect(isValidTimezone("UTC")).toBe(true);
    });

    it("rejects invalid timezone names", () => {
      // Note: EST may be valid in some Luxon versions as a fixed offset zone
      expect(isValidTimezone("Eastern")).toBe(false);
      expect(isValidTimezone("Not/A/Zone")).toBe(false);
      expect(isValidTimezone("")).toBe(false);
    });
  });

  describe("resolveTimezone", () => {
    it("resolves timezone aliases", () => {
      expect(resolveTimezone("EASTERN")).toBe("America/New_York");
      expect(resolveTimezone("PACIFIC")).toBe("America/Los_Angeles");
      expect(resolveTimezone("UTC")).toBe("UTC");
    });

    it("passes through valid IANA zones", () => {
      expect(resolveTimezone("America/New_York")).toBe("America/New_York");
      expect(resolveTimezone("Europe/Paris")).toBe("Europe/Paris");
    });

    it("falls back to UTC for invalid zones", () => {
      expect(resolveTimezone("Invalid/Zone")).toBe("UTC");
    });
  });

  describe("safeTimezone", () => {
    it("returns valid timezone as-is", () => {
      expect(safeTimezone("America/New_York")).toBe("America/New_York");
    });

    it("returns fallback for invalid timezone", () => {
      expect(safeTimezone("Invalid")).toBe("UTC");
    });

    it("returns fallback for null/undefined", () => {
      expect(safeTimezone(null)).toBe("UTC");
      expect(safeTimezone(undefined)).toBe("UTC");
    });

    it("uses custom fallback", () => {
      expect(safeTimezone(null, "America/New_York")).toBe("America/New_York");
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Information
  // ─────────────────────────────────────────────────────────────

  describe("getLocalTimezone", () => {
    it("returns a valid IANA timezone", () => {
      const local = getLocalTimezone();
      expect(isValidTimezone(local)).toBe(true);
    });
  });

  describe("getUTCOffset", () => {
    it("returns UTC offset string", () => {
      const offset = getUTCOffset("UTC");
      expect(offset).toBe("+00:00");
    });

    it("returns correct offset for timezone", () => {
      // Note: This depends on whether DST is in effect
      const dt = DateTime.fromISO("2024-01-15T12:00:00", {
        zone: "America/New_York",
      });
      const offset = getUTCOffset("America/New_York", dt);
      expect(offset).toBe("-05:00"); // EST (no DST in January)
    });
  });

  describe("getUTCOffsetMinutes", () => {
    it("returns offset in minutes", () => {
      const dt = DateTime.fromISO("2024-01-15T12:00:00", {
        zone: "America/New_York",
      });
      const offset = getUTCOffsetMinutes("America/New_York", dt);
      expect(offset).toBe(-300); // -5 hours = -300 minutes
    });
  });

  describe("isInDST", () => {
    it("correctly identifies DST status", () => {
      // July is DST in New York
      const summer = DateTime.fromISO("2024-07-15T12:00:00Z");
      expect(isInDST("America/New_York", summer)).toBe(true);

      // January is not DST in New York
      const winter = DateTime.fromISO("2024-01-15T12:00:00Z");
      expect(isInDST("America/New_York", winter)).toBe(false);
    });

    it("returns false for UTC (no DST)", () => {
      expect(isInDST("UTC")).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Conversion
  // ─────────────────────────────────────────────────────────────

  describe("toTimezone", () => {
    it("converts DateTime to different timezone", () => {
      const utc = DateTime.fromISO("2024-03-15T14:00:00Z");
      const nyc = toTimezone(utc, "America/New_York");

      expect(nyc.zoneName).toBe("America/New_York");
      expect(nyc.hour).toBe(10); // 14:00 UTC = 10:00 EDT
      expect(nyc.toMillis()).toBe(utc.toMillis()); // Same instant
    });
  });

  describe("toUTC", () => {
    it("converts DateTime to UTC", () => {
      const nyc = DateTime.fromISO("2024-03-15T10:00:00", {
        zone: "America/New_York",
      });
      const utc = toUTC(nyc);

      expect(utc.zoneName).toBe("UTC");
      expect(utc.toMillis()).toBe(nyc.toMillis());
    });
  });

  describe("toLocal", () => {
    it("converts DateTime to local timezone", () => {
      const utc = DateTime.fromISO("2024-03-15T14:00:00Z");
      const local = toLocal(utc);

      expect(local.toMillis()).toBe(utc.toMillis());
    });
  });

  describe("setTimezoneKeepLocal", () => {
    it("keeps local time when changing zone", () => {
      const utc = DateTime.fromObject({ year: 2024, month: 3, day: 15, hour: 14 }, { zone: "UTC" });
      const withNewZone = setTimezoneKeepLocal(utc, "America/New_York");

      // Same clock time, different timezone
      expect(withNewZone.hour).toBe(14);
      expect(withNewZone.zoneName).toBe("America/New_York");
      // Different instant
      expect(withNewZone.toMillis()).not.toBe(utc.toMillis());
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Timezone Lists
  // ─────────────────────────────────────────────────────────────

  describe("getCommonTimezones", () => {
    it("returns array of timezone options", () => {
      const zones = getCommonTimezones();

      expect(Array.isArray(zones)).toBe(true);
      expect(zones.length).toBeGreaterThan(0);
      expect(zones[0]).toHaveProperty("value");
      expect(zones[0]).toHaveProperty("label");
    });

    it("includes common US timezones", () => {
      const zones = getCommonTimezones();
      const values = zones.map((z) => z.value);

      expect(values).toContain("America/New_York");
      expect(values).toContain("America/Los_Angeles");
      expect(values).toContain("America/Chicago");
    });

    it("includes offset when requested", () => {
      const zones = getCommonTimezones(true);

      expect(zones[0]).toHaveProperty("offset");
    });
  });

  describe("searchTimezones", () => {
    it("finds timezones by name", () => {
      const results = searchTimezones("york");

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.value.includes("New_York"))).toBe(true);
    });

    it("finds timezones by label", () => {
      const results = searchTimezones("eastern");

      expect(results.length).toBeGreaterThan(0);
    });

    it("is case-insensitive", () => {
      const lower = searchTimezones("tokyo");
      const upper = searchTimezones("TOKYO");

      expect(lower.length).toBe(upper.length);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // DST Edge Cases
  // ─────────────────────────────────────────────────────────────

  describe("DST Edge Cases", () => {
    it("handles spring DST transition correctly", () => {
      // March 10, 2024 - DST starts at 2:00 AM in New York
      // 2:00 AM EST becomes 3:00 AM EDT
      const beforeDST = DateTime.fromISO("2024-03-10T01:30:00", {
        zone: "America/New_York",
      });
      const afterDST = beforeDST.plus({ hours: 1 });

      // After 1 hour, it should be 3:30 AM (skipping 2:30 AM)
      expect(afterDST.hour).toBe(3);
      expect(afterDST.minute).toBe(30);
    });

    it("handles fall DST transition correctly", () => {
      // November 3, 2024 - DST ends at 2:00 AM in New York
      // 2:00 AM EDT becomes 1:00 AM EST (repeat 1:00 AM)
      const beforeTransition = DateTime.fromISO("2024-11-03T00:30:00", {
        zone: "America/New_York",
      });
      const duringFirst = beforeTransition.plus({ hours: 1 });
      const duringSecond = beforeTransition.plus({ hours: 2 });

      // The clock shows 1:30 twice, but the instant advances
      expect(duringFirst.toMillis()).toBeLessThan(duringSecond.toMillis());
    });

    it("preserves instant across timezone conversions during DST", () => {
      // During DST transition
      const nyc = DateTime.fromISO("2024-03-10T10:00:00", {
        zone: "America/New_York",
      });
      const utc = toUTC(nyc);
      const backToNyc = toTimezone(utc, "America/New_York");

      expect(backToNyc.toMillis()).toBe(nyc.toMillis());
      expect(backToNyc.hour).toBe(nyc.hour);
    });
  });
});

