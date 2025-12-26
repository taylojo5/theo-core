// ═══════════════════════════════════════════════════════════════════════════
// Agent Content Filter
// Input sanitization and output filtering for agent safety
// ═══════════════════════════════════════════════════════════════════════════

import { getDefaultContentFilterConfig, type ContentFilterConfig } from "../config";

// ─────────────────────────────────────────────────────────────
// Default Config (lazy cached)
// ─────────────────────────────────────────────────────────────

let _cachedConfig: Required<ContentFilterConfig> | null = null;

/**
 * Get the default content filter config (cached for performance)
 * For per-user config, use agentConfigService.getConfig(userId).contentFilterConfig
 */
function getConfig(): Required<ContentFilterConfig> {
  if (!_cachedConfig) {
    _cachedConfig = getDefaultContentFilterConfig();
  }
  return _cachedConfig;
}

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of content filtering
 */
export interface ContentFilterResult {
  /** Whether the content passed filtering */
  passed: boolean;
  /** Sanitized/filtered content (if passed) */
  content: string;
  /** Reasons for blocking (if not passed) */
  blockedReasons: string[];
  /** Detected issues that were sanitized but not blocked */
  warnings: string[];
}

/**
 * Content filter options
 */
export interface ContentFilterOptions {
  /** Maximum allowed length */
  maxLength?: number;
  /** Whether to check for prompt injection */
  checkInjection?: boolean;
  /** Whether to block harmful content */
  blockHarmful?: boolean;
  /** Whether to sanitize HTML */
  sanitizeHtml?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Prompt Injection Detection
// ─────────────────────────────────────────────────────────────

/**
 * Patterns that indicate potential prompt injection attempts
 * These are heuristics and not foolproof
 */
const INJECTION_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  // Direct instruction override attempts
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|context)/i,
    name: "instruction_override",
  },
  {
    pattern: /disregard\s+(all\s+)?(previous|prior|above|your)\s+(instructions?|prompts?|rules?)/i,
    name: "instruction_override",
  },
  {
    pattern: /forget\s+(everything|all|your)\s+(you\s+)?(know|learned|were\s+told)/i,
    name: "instruction_override",
  },

  // Role manipulation attempts
  {
    pattern: /you\s+are\s+(now|actually)\s+(a|an|my)\s+/i,
    name: "role_manipulation",
  },
  {
    pattern: /pretend\s+(to\s+be|you\s+are)\s+(a|an|my)\s+/i,
    name: "role_manipulation",
  },
  {
    pattern: /act\s+as\s+(if\s+you\s+are|a|an|my)\s+/i,
    name: "role_manipulation",
  },

  // System prompt extraction attempts
  {
    pattern: /what\s+(is|are)\s+your\s+(system|initial)\s+(prompt|instructions?)/i,
    name: "prompt_extraction",
  },
  {
    pattern: /reveal\s+(your|the)\s+(system|hidden|secret)\s+(prompt|instructions?)/i,
    name: "prompt_extraction",
  },
  {
    pattern: /show\s+(me\s+)?(your|the)\s+(system|original)\s+(prompt|instructions?)/i,
    name: "prompt_extraction",
  },

  // Jailbreak attempts
  {
    pattern: /\bDAN\b.*\bmode\b/i,
    name: "jailbreak_attempt",
  },
  {
    pattern: /\bjailbreak\b/i,
    name: "jailbreak_attempt",
  },
  {
    pattern: /developer\s+mode\s+(enabled|on|activated)/i,
    name: "jailbreak_attempt",
  },

  // Token/delimiter manipulation
  {
    pattern: /<\|?(system|user|assistant|endof\w+)\|?>/i,
    name: "delimiter_injection",
  },
  {
    pattern: /\[\[?(system|user|assistant|INST)\]?\]/i,
    name: "delimiter_injection",
  },

  // Base64/encoding attempts
  {
    pattern: /base64\s*decode/i,
    name: "encoding_bypass",
  },
  {
    pattern: /eval\s*\(/i,
    name: "code_execution",
  },
];

/**
 * Check for prompt injection attempts
 */
export function detectPromptInjection(
  text: string
): { detected: boolean; patterns: string[] } {
  if (!getConfig().DETECT_INJECTION) {
    return { detected: false, patterns: [] };
  }

  const detectedPatterns: string[] = [];

  for (const { pattern, name } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      detectedPatterns.push(name);
    }
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: [...new Set(detectedPatterns)], // Deduplicate
  };
}

// ─────────────────────────────────────────────────────────────
// Harmful Content Detection
// ─────────────────────────────────────────────────────────────

/**
 * Categories of harmful content to detect
 * Note: This is a basic implementation. Production should use
 * a dedicated content moderation API (e.g., OpenAI Moderation API)
 */
const HARMFUL_PATTERNS: Array<{ pattern: RegExp; category: string }> = [
  // Requests for illegal activities
  {
    pattern: /how\s+to\s+(make|build|create)\s+(a\s+)?(bomb|explosive|weapon)/i,
    category: "violence",
  },
  {
    pattern: /instructions?\s+(for|to)\s+(hack|hacking|break\s+into)/i,
    category: "illegal_activity",
  },

  // Self-harm (basic detection - should use dedicated API)
  {
    pattern: /how\s+to\s+(commit|do)\s+suicide/i,
    category: "self_harm",
  },
  {
    pattern: /best\s+way\s+to\s+(kill|hurt)\s+(myself|yourself)/i,
    category: "self_harm",
  },

  // Requests to bypass safety
  {
    pattern: /bypass\s+(content\s+)?filter/i,
    category: "filter_bypass",
  },
  {
    pattern: /disable\s+safety/i,
    category: "filter_bypass",
  },
];

/**
 * Check for harmful content
 * Returns categories of harmful content detected
 */
export function detectHarmfulContent(
  text: string
): { detected: boolean; categories: string[] } {
  const detectedCategories: string[] = [];

  for (const { pattern, category } of HARMFUL_PATTERNS) {
    if (pattern.test(text)) {
      detectedCategories.push(category);
    }
  }

  return {
    detected: detectedCategories.length > 0,
    categories: [...new Set(detectedCategories)],
  };
}

// ─────────────────────────────────────────────────────────────
// Input Sanitization
// ─────────────────────────────────────────────────────────────

/**
 * Sanitize user input before sending to LLM
 */
export function sanitizeInput(
  input: string,
  options: ContentFilterOptions = {}
): ContentFilterResult {
  const {
    maxLength = getConfig().MAX_MESSAGE_LENGTH,
    checkInjection = getConfig().DETECT_INJECTION,
    blockHarmful = true,
    sanitizeHtml = true,
  } = options;

  const blockedReasons: string[] = [];
  const warnings: string[] = [];
  let content = input;

  // Check for empty input
  if (!content || typeof content !== "string") {
    return {
      passed: false,
      content: "",
      blockedReasons: ["empty_input"],
      warnings: [],
    };
  }

  // Trim whitespace
  content = content.trim();

  // Check length
  if (content.length > maxLength) {
    content = content.slice(0, maxLength);
    warnings.push(`truncated_to_${maxLength}_chars`);
  }

  // Strip potentially dangerous HTML if requested
  if (sanitizeHtml) {
    // Remove script tags and their content
    content = content.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ""
    );
    // Remove other potentially dangerous tags
    content = content.replace(/<(iframe|object|embed|form|input)[^>]*>/gi, "");
  }

  // Check for prompt injection
  if (checkInjection) {
    const injectionResult = detectPromptInjection(content);
    if (injectionResult.detected) {
      // We warn but don't block - let the agent handle it
      // The patterns might be legitimate in some contexts
      warnings.push(
        `potential_injection: ${injectionResult.patterns.join(", ")}`
      );
    }
  }

  // Check for harmful content
  if (blockHarmful) {
    const harmfulResult = detectHarmfulContent(content);
    if (harmfulResult.detected) {
      // Block harmful content
      blockedReasons.push(
        `harmful_content: ${harmfulResult.categories.join(", ")}`
      );
    }
  }

  // Normalize unicode to prevent homograph attacks
  content = normalizeUnicode(content);

  // Remove null bytes and other control characters (except newlines/tabs)
  content = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return {
    passed: blockedReasons.length === 0,
    content,
    blockedReasons,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────
// Output Filtering
// ─────────────────────────────────────────────────────────────

/**
 * Patterns that should not appear in agent output
 * These indicate the agent may have been compromised or is leaking info
 */
const OUTPUT_BLOCK_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  // API key patterns
  {
    pattern: /sk-[a-zA-Z0-9]{20,}/,
    reason: "potential_api_key",
  },
  // Password patterns in responses
  {
    pattern: /password\s*[:=]\s*['"][^'"]+['"]/i,
    reason: "potential_password",
  },
  // System prompt leakage indicators
  {
    pattern: /\[SYSTEM\]|\[INST\]|<\|system\|>/i,
    reason: "system_prompt_leak",
  },
];

/**
 * Filter agent output before sending to user
 */
export function filterOutput(
  output: string,
  options: ContentFilterOptions = {}
): ContentFilterResult {
  const { maxLength = getConfig().MAX_MESSAGE_LENGTH } = options;

  const blockedReasons: string[] = [];
  const warnings: string[] = [];
  let content = output;

  // Check for empty output
  if (!content || typeof content !== "string") {
    return {
      passed: true,
      content: "",
      blockedReasons: [],
      warnings: [],
    };
  }

  // Trim whitespace
  content = content.trim();

  // Check length
  if (content.length > maxLength) {
    content = content.slice(0, maxLength);
    warnings.push(`truncated_to_${maxLength}_chars`);
  }

  // Check for patterns that shouldn't be in output
  for (const { pattern, reason } of OUTPUT_BLOCK_PATTERNS) {
    if (pattern.test(content)) {
      // Redact rather than block entirely
      content = content.replace(pattern, "[REDACTED]");
      warnings.push(`redacted_${reason}`);
    }
  }

  // Ensure harmful content isn't in output
  const harmfulResult = detectHarmfulContent(content);
  if (harmfulResult.detected) {
    blockedReasons.push(
      `harmful_output: ${harmfulResult.categories.join(", ")}`
    );
  }

  return {
    passed: blockedReasons.length === 0,
    content,
    blockedReasons,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Normalize unicode to prevent homograph attacks
 * Converts look-alike characters to their ASCII equivalents
 */
function normalizeUnicode(text: string): string {
  // Normalize to NFKC (compatibility decomposition, then canonical composition)
  // This handles most homograph attacks
  return text.normalize("NFKC");
}

/**
 * Check if content is safe for processing
 * Quick check without full sanitization
 */
export function isContentSafe(content: string): boolean {
  if (!content || typeof content !== "string") {
    return false;
  }

  // Quick harmful content check
  const harmful = detectHarmfulContent(content);
  if (harmful.detected) {
    return false;
  }

  return true;
}

/**
 * Estimate token count for a string
 * This is a rough estimate - actual tokens depend on the tokenizer
 * Rule of thumb: ~4 characters per token for English
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // Rough estimate: 4 chars per token on average
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to approximate token limit
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  if (!text) return "";
  
  const estimatedTokens = estimateTokenCount(text);
  if (estimatedTokens <= maxTokens) {
    return text;
  }

  // Calculate approximate character limit
  const charLimit = maxTokens * 4;
  return text.slice(0, charLimit) + "...";
}

