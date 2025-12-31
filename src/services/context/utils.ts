// ═══════════════════════════════════════════════════════════════════════════
// Context Service Utilities
// Shared utility functions for context entity operations
// ═══════════════════════════════════════════════════════════════════════════

import type { PaginationParams, SortOrder } from "./types";

// ─────────────────────────────────────────────────────────────
// Soft Delete Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Prisma where clause to exclude soft-deleted records
 * Usage: prisma.person.findMany({ where: { ...excludeDeleted() } })
 */
export function excludeDeleted(): { deletedAt: null } {
  return { deletedAt: null };
}

/**
 * Prisma where clause to include only soft-deleted records
 */
export function onlyDeleted(): { deletedAt: { not: null } } {
  return { deletedAt: { not: null } };
}

/**
 * Conditionally apply soft delete filter
 */
export function softDeleteFilter(includeDeleted: boolean = false): {
  deletedAt?: null;
} {
  return includeDeleted ? {} : excludeDeleted();
}

// ─────────────────────────────────────────────────────────────
// Pagination Utilities
// ─────────────────────────────────────────────────────────────

/** Default pagination limit */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum pagination limit */
export const MAX_PAGE_SIZE = 100;

/**
 * Normalize pagination parameters with defaults and limits
 */
export function normalizePagination(params: PaginationParams): {
  take: number;
  skip: number;
  cursor?: { id: string };
} {
  const limit = Math.min(
    Math.max(1, params.limit ?? DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );

  return {
    take: limit + 1, // Fetch one extra to determine hasMore
    skip: params.cursor ? 1 : 0, // Skip cursor item if using cursor
    ...(params.cursor && { cursor: { id: params.cursor } }),
  };
}

/**
 * Process paginated results to extract next cursor and hasMore
 */
export function processPaginatedResults<T extends { id: string }>(
  items: T[],
  requestedLimit: number
): {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
} {
  const limit = Math.min(
    Math.max(1, requestedLimit ?? DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE
  );

  const hasMore = items.length > limit;
  const resultItems = hasMore ? items.slice(0, limit) : items;
  const nextCursor = hasMore
    ? resultItems[resultItems.length - 1]?.id
    : undefined;

  return {
    items: resultItems,
    nextCursor,
    hasMore,
  };
}

/**
 * Build Prisma orderBy clause from sort parameters
 */
export function buildOrderBy(
  sortBy: string = "createdAt",
  sortOrder: SortOrder = "desc"
): Record<string, SortOrder> {
  return { [sortBy]: sortOrder };
}

// ─────────────────────────────────────────────────────────────
// Email Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Normalize email address for consistent storage and matching
 * - Lowercases the entire email
 * - Trims whitespace
 * - Handles Gmail's dot-insensitivity (optional)
 */
export function normalizeEmail(
  email: string,
  options: { handleGmailDots?: boolean } = {}
): string {
  let normalized = email.toLowerCase().trim();

  // Gmail ignores dots in the local part
  if (options.handleGmailDots) {
    const [local, domain] = normalized.split("@");
    if (domain === "gmail.com" || domain === "googlemail.com") {
      // Remove dots and anything after + in local part
      const cleanLocal = local.split("+")[0].replace(/\./g, "");
      normalized = `${cleanLocal}@${domain}`;
    }
  }

  return normalized;
}

/**
 * Extract email domain
 */
export function extractEmailDomain(email: string): string | null {
  const parts = email.split("@");
  return parts.length === 2 ? parts[1].toLowerCase() : null;
}

/**
 * Validate email format (basic validation)
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// ─────────────────────────────────────────────────────────────
// Content Hash Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Generate a hash of content for deduplication
 * Uses a fast, Edge-compatible hash algorithm (djb2 with xxHash-style mixing)
 * Note: This is NOT cryptographic - just for content deduplication
 */
export function generateContentHash(content: string): string {
  // Use djb2 algorithm with xxHash-style avalanche for better distribution
  let hash1 = 5381;
  let hash2 = 52711;

  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash1 = (hash1 * 33) ^ char;
    hash2 = (hash2 * 33) ^ char;
  }

  // Combine hashes and convert to hex string
  // Use unsigned right shift (>>>) to ensure positive numbers
  const combined1 = (hash1 >>> 0).toString(16).padStart(8, "0");
  const combined2 = (hash2 >>> 0).toString(16).padStart(8, "0");

  // Add content length as additional entropy
  const lengthHash = (content.length >>> 0).toString(16).padStart(8, "0");

  return `${combined1}${combined2}${lengthHash}`;
}

/**
 * Generate a hash from multiple fields for change detection
 */
export function generateEntityHash(
  fields: (string | undefined | null)[]
): string {
  const content = fields.filter(Boolean).join("|");
  return generateContentHash(content);
}

// ─────────────────────────────────────────────────────────────
// Text Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Build searchable text content from entity fields
 * Used for both full-text search and embedding generation
 */
export function buildSearchableContent(
  fields: (string | undefined | null)[]
): string {
  return fields.filter(Boolean).join(" | ");
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + "...";
}

/**
 * Extract a snippet around a search match
 */
export function extractSnippet(
  text: string,
  searchTerm: string,
  contextLength: number = 50
): string {
  const lowerText = text.toLowerCase();
  const lowerSearch = searchTerm.toLowerCase();
  const matchIndex = lowerText.indexOf(lowerSearch);

  if (matchIndex === -1) {
    return truncateText(text, contextLength * 2);
  }

  const start = Math.max(0, matchIndex - contextLength);
  const end = Math.min(
    text.length,
    matchIndex + searchTerm.length + contextLength
  );

  let snippet = text.slice(start, end);

  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";

  return snippet;
}

// ─────────────────────────────────────────────────────────────
// Tag Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Normalize tags (lowercase, trim, dedupe)
 */
export function normalizeTags(tags: string[]): string[] {
  const normalized = tags
    .map((tag) => tag.toLowerCase().trim())
    .filter((tag) => tag.length > 0);

  return [...new Set(normalized)];
}

/**
 * Merge tags without duplicates
 */
export function mergeTags(existing: string[], additional: string[]): string[] {
  return normalizeTags([...existing, ...additional]);
}

// ─────────────────────────────────────────────────────────────
// Date Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Check if a date is in the past
 */
export function isPast(date: Date): boolean {
  return date < new Date();
}

/**
 * Check if a date is in the future
 */
export function isFuture(date: Date): boolean {
  return date > new Date();
}

/**
 * Check if a date is within N days from now
 */
export function isWithinDays(date: Date, days: number): boolean {
  const now = new Date();
  const future = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return date >= now && date <= future;
}

/**
 * Get date range for common queries
 */
export function getDateRange(
  range: "today" | "week" | "month" | "quarter" | "year"
): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (range) {
    case "today":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "week":
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
      // Copy start after month wrapping, then add 6 days for end of week
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    case "month":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "quarter":
      const quarter = Math.floor(now.getMonth() / 3);
      start.setMonth(quarter * 3, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(quarter * 3 + 3, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "year":
      start.setMonth(0, 1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(11, 31);
      end.setHours(23, 59, 59, 999);
      break;
  }

  return { start, end };
}

// ─────────────────────────────────────────────────────────────
// Importance / Priority Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Validate importance value (1-10)
 */
export function validateImportance(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value)));
}

/**
 * Get importance label
 */
export function getImportanceLabel(
  value: number
): "low" | "medium" | "high" | "critical" {
  if (value <= 3) return "low";
  if (value <= 5) return "medium";
  if (value <= 7) return "high";
  return "critical";
}
