// ═══════════════════════════════════════════════════════════════════════════
// Context Service Utilities - Unit Tests
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  // Soft Delete
  excludeDeleted,
  onlyDeleted,
  softDeleteFilter,

  // Pagination
  normalizePagination,
  processPaginatedResults,
  buildOrderBy,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,

  // Email
  normalizeEmail,
  extractEmailDomain,
  isValidEmail,

  // Content Hash
  generateContentHash,
  generateEntityHash,

  // Text
  buildSearchableContent,
  truncateText,
  extractSnippet,

  // Tags
  normalizeTags,
  mergeTags,

  // Dates
  isPast,
  isFuture,
  isWithinDays,
  getDateRange,

  // Importance
  validateImportance,
  getImportanceLabel,
} from "@/services/context/utils";

// ─────────────────────────────────────────────────────────────
// Soft Delete Tests
// ─────────────────────────────────────────────────────────────

describe("Soft Delete Utilities", () => {
  describe("excludeDeleted", () => {
    it("returns filter for non-deleted records", () => {
      expect(excludeDeleted()).toEqual({ deletedAt: null });
    });
  });

  describe("onlyDeleted", () => {
    it("returns filter for deleted records only", () => {
      expect(onlyDeleted()).toEqual({ deletedAt: { not: null } });
    });
  });

  describe("softDeleteFilter", () => {
    it("excludes deleted by default", () => {
      expect(softDeleteFilter()).toEqual({ deletedAt: null });
    });

    it("returns empty filter when includeDeleted is true", () => {
      expect(softDeleteFilter(true)).toEqual({});
    });

    it("excludes deleted when includeDeleted is false", () => {
      expect(softDeleteFilter(false)).toEqual({ deletedAt: null });
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Pagination Tests
// ─────────────────────────────────────────────────────────────

describe("Pagination Utilities", () => {
  describe("normalizePagination", () => {
    it("uses default limit when not specified", () => {
      const result = normalizePagination({});
      expect(result.take).toBe(DEFAULT_PAGE_SIZE + 1);
      expect(result.skip).toBe(0);
      expect(result.cursor).toBeUndefined();
    });

    it("respects custom limit", () => {
      const result = normalizePagination({ limit: 50 });
      expect(result.take).toBe(51);
    });

    it("caps limit at MAX_PAGE_SIZE", () => {
      const result = normalizePagination({ limit: 500 });
      expect(result.take).toBe(MAX_PAGE_SIZE + 1);
    });

    it("handles minimum limit", () => {
      const result = normalizePagination({ limit: 0 });
      expect(result.take).toBe(2); // min 1 + 1
    });

    it("adds cursor when provided", () => {
      const result = normalizePagination({ cursor: "abc123" });
      expect(result.cursor).toEqual({ id: "abc123" });
      expect(result.skip).toBe(1);
    });
  });

  describe("processPaginatedResults", () => {
    const createItems = (count: number) =>
      Array.from({ length: count }, (_, i) => ({ id: `item-${i}` }));

    it("returns all items when fewer than limit", () => {
      const items = createItems(5);
      const result = processPaginatedResults(items, 10);

      expect(result.items).toHaveLength(5);
      expect(result.hasMore).toBe(false);
      expect(result.nextCursor).toBeUndefined();
    });

    it("returns hasMore when more items than limit", () => {
      const items = createItems(11);
      const result = processPaginatedResults(items, 10);

      expect(result.items).toHaveLength(10);
      expect(result.hasMore).toBe(true);
      expect(result.nextCursor).toBe("item-9");
    });

    it("handles exactly limit items", () => {
      const items = createItems(10);
      const result = processPaginatedResults(items, 10);

      expect(result.items).toHaveLength(10);
      expect(result.hasMore).toBe(false);
    });
  });

  describe("buildOrderBy", () => {
    it("uses default values", () => {
      expect(buildOrderBy()).toEqual({ createdAt: "desc" });
    });

    it("respects custom field", () => {
      expect(buildOrderBy("name")).toEqual({ name: "desc" });
    });

    it("respects custom order", () => {
      expect(buildOrderBy("name", "asc")).toEqual({ name: "asc" });
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Email Tests
// ─────────────────────────────────────────────────────────────

describe("Email Utilities", () => {
  describe("normalizeEmail", () => {
    it("lowercases email", () => {
      expect(normalizeEmail("John.Doe@Example.COM")).toBe("john.doe@example.com");
    });

    it("trims whitespace", () => {
      expect(normalizeEmail("  john@example.com  ")).toBe("john@example.com");
    });

    it("handles Gmail dots when option enabled", () => {
      expect(
        normalizeEmail("john.doe@gmail.com", { handleGmailDots: true })
      ).toBe("johndoe@gmail.com");
    });

    it("handles Gmail plus addressing when option enabled", () => {
      expect(
        normalizeEmail("john+test@gmail.com", { handleGmailDots: true })
      ).toBe("john@gmail.com");
    });

    it("preserves dots for non-Gmail when option enabled", () => {
      expect(
        normalizeEmail("john.doe@company.com", { handleGmailDots: true })
      ).toBe("john.doe@company.com");
    });
  });

  describe("extractEmailDomain", () => {
    it("extracts domain from valid email", () => {
      expect(extractEmailDomain("john@example.com")).toBe("example.com");
    });

    it("lowercases domain", () => {
      expect(extractEmailDomain("john@EXAMPLE.COM")).toBe("example.com");
    });

    it("returns null for invalid email", () => {
      expect(extractEmailDomain("invalid")).toBeNull();
    });
  });

  describe("isValidEmail", () => {
    it("validates correct emails", () => {
      expect(isValidEmail("john@example.com")).toBe(true);
      expect(isValidEmail("john.doe@example.co.uk")).toBe(true);
      expect(isValidEmail("john+tag@example.com")).toBe(true);
    });

    it("rejects invalid emails", () => {
      expect(isValidEmail("invalid")).toBe(false);
      expect(isValidEmail("@example.com")).toBe(false);
      expect(isValidEmail("john@")).toBe(false);
      expect(isValidEmail("john@example")).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Content Hash Tests
// ─────────────────────────────────────────────────────────────

describe("Content Hash Utilities", () => {
  describe("generateContentHash", () => {
    it("generates consistent hash for same content", () => {
      const hash1 = generateContentHash("hello world");
      const hash2 = generateContentHash("hello world");
      expect(hash1).toBe(hash2);
    });

    it("generates different hash for different content", () => {
      const hash1 = generateContentHash("hello world");
      const hash2 = generateContentHash("hello there");
      expect(hash1).not.toBe(hash2);
    });

    it("generates 24-character hex string", () => {
      const hash = generateContentHash("test");
      // Hash format: 8 chars (hash1) + 8 chars (hash2) + 8 chars (length)
      expect(hash).toMatch(/^[a-f0-9]{24}$/);
    });
  });

  describe("generateEntityHash", () => {
    it("combines fields into hash", () => {
      const hash = generateEntityHash(["John", "Doe", "john@example.com"]);
      // Hash format: 8 chars (hash1) + 8 chars (hash2) + 8 chars (length)
      expect(hash).toMatch(/^[a-f0-9]{24}$/);
    });

    it("filters out null/undefined", () => {
      const hash1 = generateEntityHash(["John", null, "Doe"]);
      const hash2 = generateEntityHash(["John", undefined, "Doe"]);
      expect(hash1).toBe(hash2);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Text Tests
// ─────────────────────────────────────────────────────────────

describe("Text Utilities", () => {
  describe("buildSearchableContent", () => {
    it("joins fields with separator", () => {
      const result = buildSearchableContent(["John", "Doe", "Engineer"]);
      expect(result).toBe("John | Doe | Engineer");
    });

    it("filters out null/undefined", () => {
      const result = buildSearchableContent(["John", null, "Doe", undefined]);
      expect(result).toBe("John | Doe");
    });
  });

  describe("truncateText", () => {
    it("returns original text if shorter than max", () => {
      expect(truncateText("hello", 10)).toBe("hello");
    });

    it("truncates with ellipsis", () => {
      expect(truncateText("hello world", 8)).toBe("hello...");
    });

    it("handles edge case at max length", () => {
      expect(truncateText("hello", 5)).toBe("hello");
    });
  });

  describe("extractSnippet", () => {
    const longText =
      "The quick brown fox jumps over the lazy dog. This is a test sentence.";

    it("extracts snippet around search term", () => {
      const snippet = extractSnippet(longText, "fox", 10);
      expect(snippet).toContain("fox");
      expect(snippet.length).toBeLessThan(longText.length);
    });

    it("adds ellipsis at start if not at beginning", () => {
      const snippet = extractSnippet(longText, "lazy", 10);
      expect(snippet.startsWith("...")).toBe(true);
    });

    it("handles case-insensitive search", () => {
      const snippet = extractSnippet(longText, "FOX", 10);
      expect(snippet.toLowerCase()).toContain("fox");
    });

    it("returns truncated text if term not found", () => {
      const snippet = extractSnippet(longText, "xyz", 20);
      expect(snippet.length).toBeLessThanOrEqual(40);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Tag Tests
// ─────────────────────────────────────────────────────────────

describe("Tag Utilities", () => {
  describe("normalizeTags", () => {
    it("lowercases tags", () => {
      expect(normalizeTags(["TAG", "Tag"])).toEqual(["tag"]);
    });

    it("trims whitespace", () => {
      expect(normalizeTags(["  tag  ", "other"])).toEqual(["tag", "other"]);
    });

    it("removes duplicates", () => {
      expect(normalizeTags(["tag", "TAG", "Tag"])).toEqual(["tag"]);
    });

    it("filters empty strings", () => {
      expect(normalizeTags(["tag", "", "  "])).toEqual(["tag"]);
    });
  });

  describe("mergeTags", () => {
    it("merges without duplicates", () => {
      expect(mergeTags(["a", "b"], ["b", "c"])).toEqual(["a", "b", "c"]);
    });

    it("normalizes while merging", () => {
      expect(mergeTags(["A"], ["a", "B"])).toEqual(["a", "b"]);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Date Tests
// ─────────────────────────────────────────────────────────────

describe("Date Utilities", () => {
  describe("isPast", () => {
    it("returns true for past dates", () => {
      const yesterday = new Date(Date.now() - 86400000);
      expect(isPast(yesterday)).toBe(true);
    });

    it("returns false for future dates", () => {
      const tomorrow = new Date(Date.now() + 86400000);
      expect(isPast(tomorrow)).toBe(false);
    });
  });

  describe("isFuture", () => {
    it("returns true for future dates", () => {
      const tomorrow = new Date(Date.now() + 86400000);
      expect(isFuture(tomorrow)).toBe(true);
    });

    it("returns false for past dates", () => {
      const yesterday = new Date(Date.now() - 86400000);
      expect(isFuture(yesterday)).toBe(false);
    });
  });

  describe("isWithinDays", () => {
    it("returns true for date within range", () => {
      const inTwoDays = new Date(Date.now() + 2 * 86400000);
      expect(isWithinDays(inTwoDays, 7)).toBe(true);
    });

    it("returns false for date outside range", () => {
      const inTenDays = new Date(Date.now() + 10 * 86400000);
      expect(isWithinDays(inTenDays, 7)).toBe(false);
    });

    it("returns false for past dates", () => {
      const yesterday = new Date(Date.now() - 86400000);
      expect(isWithinDays(yesterday, 7)).toBe(false);
    });
  });

  describe("getDateRange", () => {
    it("returns today range", () => {
      const { start, end } = getDateRange("today");
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(end.getHours()).toBe(23);
      expect(end.getMinutes()).toBe(59);
    });

    it("returns week range", () => {
      const { start, end } = getDateRange("week");
      expect(start.getDay()).toBe(0); // Sunday
      expect(end.getDay()).toBe(6); // Saturday
    });

    it("returns month range", () => {
      const { start, end } = getDateRange("month");
      expect(start.getDate()).toBe(1);
      expect(end.getDate()).toBeGreaterThan(27); // Last day of month
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Importance Tests
// ─────────────────────────────────────────────────────────────

describe("Importance Utilities", () => {
  describe("validateImportance", () => {
    it("clamps values below minimum", () => {
      expect(validateImportance(0)).toBe(1);
      expect(validateImportance(-5)).toBe(1);
    });

    it("clamps values above maximum", () => {
      expect(validateImportance(15)).toBe(10);
    });

    it("rounds to nearest integer", () => {
      expect(validateImportance(5.7)).toBe(6);
    });

    it("preserves valid values", () => {
      expect(validateImportance(5)).toBe(5);
    });
  });

  describe("getImportanceLabel", () => {
    it("returns low for 1-3", () => {
      expect(getImportanceLabel(1)).toBe("low");
      expect(getImportanceLabel(3)).toBe("low");
    });

    it("returns medium for 4-5", () => {
      expect(getImportanceLabel(4)).toBe("medium");
      expect(getImportanceLabel(5)).toBe("medium");
    });

    it("returns high for 6-7", () => {
      expect(getImportanceLabel(6)).toBe("high");
      expect(getImportanceLabel(7)).toBe("high");
    });

    it("returns critical for 8-10", () => {
      expect(getImportanceLabel(8)).toBe("critical");
      expect(getImportanceLabel(10)).toBe("critical");
    });
  });
});

