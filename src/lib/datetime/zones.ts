// ═══════════════════════════════════════════════════════════════════════════
// Timezone Utilities
// Functions for working with timezones
// ═══════════════════════════════════════════════════════════════════════════

import { DateTime, Info, IANAZone } from "luxon";
import { DEFAULT_TIMEZONE, TIMEZONE_ALIASES, type TimezoneAlias } from "./constants";

// ─────────────────────────────────────────────────────────────
// Timezone Validation
// ─────────────────────────────────────────────────────────────

/**
 * Check if a timezone string is a valid IANA timezone
 *
 * @param zone - Timezone string to validate
 * @returns true if valid IANA timezone
 *
 * @example
 * ```typescript
 * isValidTimezone("America/New_York"); // true
 * isValidTimezone("EST");               // false (abbreviation)
 * isValidTimezone("Not/A/Zone");        // false
 * ```
 */
export function isValidTimezone(zone: string): boolean {
  return Info.isValidIANAZone(zone);
}

/**
 * Resolve a timezone alias or abbreviation to IANA format
 *
 * @param zone - Timezone string (can be alias like "EASTERN" or IANA)
 * @returns IANA timezone string
 */
export function resolveTimezone(zone: string): string {
  // Check if it's a known alias
  const upperZone = zone.toUpperCase() as TimezoneAlias;
  if (upperZone in TIMEZONE_ALIASES) {
    return TIMEZONE_ALIASES[upperZone];
  }

  // Check if it's already a valid IANA zone
  if (isValidTimezone(zone)) {
    return zone;
  }

  // Fall back to default
  return DEFAULT_TIMEZONE;
}

/**
 * Get a timezone, falling back to default if invalid
 *
 * @param zone - Timezone string
 * @param fallback - Fallback timezone (default: UTC)
 * @returns Valid timezone string
 */
export function safeTimezone(
  zone: string | undefined | null,
  fallback: string = DEFAULT_TIMEZONE
): string {
  if (!zone) return fallback;
  return isValidTimezone(zone) ? zone : fallback;
}

// ─────────────────────────────────────────────────────────────
// Timezone Information
// ─────────────────────────────────────────────────────────────

/**
 * Get the system's local timezone
 *
 * @returns IANA timezone string (e.g., "America/New_York")
 */
export function getLocalTimezone(): string {
  return DateTime.local().zoneName;
}

/**
 * Get the UTC offset for a timezone at a specific time
 *
 * @param zone - Timezone string
 * @param at - DateTime to check offset at (default: now)
 * @returns Offset string (e.g., "-05:00", "+09:00")
 */
export function getUTCOffset(zone: string, at?: DateTime): string {
  const dt = (at ?? DateTime.now()).setZone(zone);
  return dt.toFormat("ZZ"); // e.g., "-05:00"
}

/**
 * Get the UTC offset in minutes for a timezone
 *
 * @param zone - Timezone string
 * @param at - DateTime to check offset at (default: now)
 * @returns Offset in minutes (e.g., -300 for EST)
 */
export function getUTCOffsetMinutes(zone: string, at?: DateTime): number {
  const dt = (at ?? DateTime.now()).setZone(zone);
  return dt.offset;
}

/**
 * Get the timezone abbreviation (note: may be ambiguous)
 *
 * @param zone - Timezone string
 * @param at - DateTime to check abbreviation at (default: now)
 * @returns Abbreviation (e.g., "EST", "PDT")
 */
export function getTimezoneAbbr(zone: string, at?: DateTime): string {
  const dt = (at ?? DateTime.now()).setZone(zone);
  return dt.toFormat("ZZZZ");
}

/**
 * Get the short timezone abbreviation
 *
 * @param zone - Timezone string
 * @param at - DateTime to check abbreviation at (default: now)
 * @returns Short abbreviation (e.g., "EST", "PST")
 */
export function getTimezoneShortAbbr(zone: string, at?: DateTime): string {
  const dt = (at ?? DateTime.now()).setZone(zone);
  return dt.toFormat("z");
}

/**
 * Check if a timezone is currently in DST
 *
 * @param zone - Timezone string
 * @param at - DateTime to check (default: now)
 * @returns true if in DST
 */
export function isInDST(zone: string, at?: DateTime): boolean {
  const dt = (at ?? DateTime.now()).setZone(zone);
  return dt.isInDST;
}

/**
 * Get the next DST transition for a timezone
 *
 * @param zone - Timezone string
 * @param from - DateTime to search from (default: now)
 * @returns DateTime of next DST transition, or null if none
 */
export function getNextDSTTransition(
  zone: string,
  from?: DateTime
): DateTime | null {
  const ianaZone = IANAZone.create(zone);
  if (!ianaZone.isValid) return null;

  const start = from ?? DateTime.now();
  
  // Check up to 1 year ahead
  const endCheck = start.plus({ years: 1 });
  let current = start;
  let wasInDST = current.setZone(zone).isInDST;

  while (current < endCheck) {
    current = current.plus({ days: 1 });
    const isInDSTNow = current.setZone(zone).isInDST;
    
    if (isInDSTNow !== wasInDST) {
      // Found a transition, narrow it down to the hour
      let searchStart = current.minus({ days: 1 });
      let searchEnd = current;
      
      while (searchEnd.diff(searchStart, "hours").hours > 1) {
        const mid = searchStart.plus({
          hours: searchEnd.diff(searchStart, "hours").hours / 2,
        });
        if (mid.setZone(zone).isInDST === wasInDST) {
          searchStart = mid;
        } else {
          searchEnd = mid;
        }
      }
      
      return searchEnd.setZone(zone);
    }
    
    wasInDST = isInDSTNow;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────
// Timezone Conversion
// ─────────────────────────────────────────────────────────────

/**
 * Convert a DateTime to a different timezone
 *
 * @param dt - DateTime to convert
 * @param zone - Target timezone
 * @returns DateTime in the new timezone (same instant)
 */
export function toTimezone(dt: DateTime, zone: string): DateTime {
  return dt.setZone(zone);
}

/**
 * Convert a DateTime to UTC
 *
 * @param dt - DateTime to convert
 * @returns DateTime in UTC
 */
export function toUTC(dt: DateTime): DateTime {
  return dt.toUTC();
}

/**
 * Convert a DateTime to the local system timezone
 *
 * @param dt - DateTime to convert
 * @returns DateTime in local timezone
 */
export function toLocal(dt: DateTime): DateTime {
  return dt.toLocal();
}

/**
 * Keep the same local time but change the timezone
 *
 * This is for when you have "2pm" and want to say it's "2pm Eastern"
 * instead of converting 2pm UTC to the equivalent Eastern time.
 *
 * @param dt - DateTime
 * @param zone - Target timezone
 * @returns DateTime with same clock time but different zone
 */
export function setTimezoneKeepLocal(dt: DateTime, zone: string): DateTime {
  return dt.setZone(zone, { keepLocalTime: true });
}

// ─────────────────────────────────────────────────────────────
// Timezone Lists
// ─────────────────────────────────────────────────────────────

/** Common timezone option for UI dropdowns */
export interface TimezoneOption {
  value: string;
  label: string;
  offset?: string;
}

/**
 * Get a list of common timezones for UI dropdowns
 *
 * @param includeOffset - Whether to include current UTC offset
 * @returns Array of timezone options
 */
export function getCommonTimezones(
  includeOffset: boolean = false
): TimezoneOption[] {
  const now = DateTime.now();

  const zones: TimezoneOption[] = [
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
    { value: "Europe/Moscow", label: "Moscow" },
    { value: "Asia/Dubai", label: "Dubai" },
    { value: "Asia/Kolkata", label: "India" },
    { value: "Asia/Singapore", label: "Singapore" },
    { value: "Asia/Shanghai", label: "China" },
    { value: "Asia/Tokyo", label: "Tokyo" },
    { value: "Australia/Sydney", label: "Sydney" },
    { value: "Pacific/Auckland", label: "New Zealand" },
  ];

  if (includeOffset) {
    return zones.map((z) => ({
      ...z,
      offset: now.setZone(z.value).toFormat("ZZ"),
      label: `${z.label} (${now.setZone(z.value).toFormat("ZZ")})`,
    }));
  }

  return zones;
}

/**
 * Get all available IANA timezones
 *
 * Note: This is a large list (400+ entries). Use getCommonTimezones
 * for UI dropdowns unless you need the full list.
 *
 * @returns Array of IANA timezone strings
 */
export function getAllTimezones(): string[] {
  // Luxon doesn't expose a list of all timezones, so we return
  // a curated list of the most commonly used ones
  return [
    // UTC
    "UTC",
    // Americas
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "America/Anchorage",
    "Pacific/Honolulu",
    "America/Toronto",
    "America/Vancouver",
    "America/Mexico_City",
    "America/Sao_Paulo",
    "America/Buenos_Aires",
    // Europe
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Europe/Rome",
    "Europe/Madrid",
    "Europe/Amsterdam",
    "Europe/Brussels",
    "Europe/Vienna",
    "Europe/Stockholm",
    "Europe/Oslo",
    "Europe/Copenhagen",
    "Europe/Helsinki",
    "Europe/Warsaw",
    "Europe/Prague",
    "Europe/Budapest",
    "Europe/Athens",
    "Europe/Moscow",
    "Europe/Istanbul",
    // Africa
    "Africa/Cairo",
    "Africa/Johannesburg",
    "Africa/Lagos",
    "Africa/Nairobi",
    // Asia
    "Asia/Dubai",
    "Asia/Riyadh",
    "Asia/Tehran",
    "Asia/Karachi",
    "Asia/Kolkata",
    "Asia/Dhaka",
    "Asia/Bangkok",
    "Asia/Singapore",
    "Asia/Hong_Kong",
    "Asia/Shanghai",
    "Asia/Seoul",
    "Asia/Tokyo",
    // Oceania
    "Australia/Sydney",
    "Australia/Melbourne",
    "Australia/Brisbane",
    "Australia/Perth",
    "Pacific/Auckland",
    "Pacific/Fiji",
  ];
}

/**
 * Search timezones by name or city
 *
 * @param query - Search query
 * @returns Matching timezone options
 */
export function searchTimezones(query: string): TimezoneOption[] {
  const lowerQuery = query.toLowerCase();
  const all = getCommonTimezones(true);

  return all.filter(
    (tz) =>
      tz.value.toLowerCase().includes(lowerQuery) ||
      tz.label.toLowerCase().includes(lowerQuery)
  );
}

