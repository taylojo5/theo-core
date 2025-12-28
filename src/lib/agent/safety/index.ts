// ═══════════════════════════════════════════════════════════════════════════
// Agent Safety Module
// Input sanitization, output filtering, and content safety for the Agent Engine
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Content filtering
  sanitizeInput,
  filterOutput,
  isContentSafe,

  // Detection functions
  detectPromptInjection,
  detectHarmfulContent,

  // Utility functions
  estimateTokenCount,
  truncateToTokenLimit,

  // Types
  type ContentFilterResult,
  type ContentFilterOptions,
} from "./content-filter";


