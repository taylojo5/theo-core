// ═══════════════════════════════════════════════════════════════════════════
// Search Services
// Unified search across emails and other content types
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Email Search
// ─────────────────────────────────────────────────────────────

export type {
  EmailSearchOptions,
  EmailSearchResult,
  EmailSearchResponse,
} from "./email-search";

export {
  EmailSearchService,
  getEmailSearchService,
  createEmailSearchService,
  // Convenience functions
  searchEmails,
  semanticSearchEmails,
  findSimilarEmails,
} from "./email-search";
