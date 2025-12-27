// ═══════════════════════════════════════════════════════════════════════════
// LLM Retry Logic
// Exponential backoff and retry handling for LLM requests
// ═══════════════════════════════════════════════════════════════════════════

import { llmLogger } from "../logger";
import type { LLMErrorCode, LLMErrorDetails } from "./types";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG = {
  /** Maximum number of retry attempts */
  maxRetries: 3,

  /** Initial delay in milliseconds */
  initialDelayMs: 1000,

  /** Maximum delay in milliseconds */
  maxDelayMs: 30000,

  /** Exponential backoff multiplier */
  backoffMultiplier: 2,

  /** Jitter factor (0-1) to randomize delays */
  jitterFactor: 0.1,
} as const;

/**
 * Error codes that are retryable
 */
const RETRYABLE_ERROR_CODES: Set<LLMErrorCode> = new Set([
  "rate_limit",
  "timeout",
  "model_overloaded",
]);

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

/**
 * Retry configuration options
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;

  /** Initial delay in milliseconds */
  initialDelayMs: number;

  /** Maximum delay in milliseconds */
  maxDelayMs: number;

  /** Exponential backoff multiplier */
  backoffMultiplier: number;

  /** Jitter factor (0-1) to randomize delays */
  jitterFactor: number;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;

  /** The result value (if successful) */
  result?: T;

  /** Error details (if failed) */
  error?: LLMErrorDetails;

  /** Number of attempts made */
  attempts: number;

  /** Total duration in milliseconds */
  durationMs: number;
}

/**
 * Callback for retry progress notifications
 */
export type RetryProgressCallback = (attempt: number, delayMs: number, error: LLMErrorDetails) => void;

// ─────────────────────────────────────────────────────────────
// Retry Logic
// ─────────────────────────────────────────────────────────────

/**
 * Calculate delay for a retry attempt with exponential backoff and jitter
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  suggestedDelayMs?: number
): number {
  // If the API suggests a retry delay, respect it
  if (suggestedDelayMs && suggestedDelayMs > 0) {
    return Math.min(suggestedDelayMs, config.maxDelayMs);
  }

  // Calculate exponential backoff
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);

  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  // Add jitter to prevent thundering herd
  const jitter = cappedDelay * config.jitterFactor * (Math.random() * 2 - 1);

  return Math.max(0, Math.round(cappedDelay + jitter));
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: LLMErrorDetails): boolean {
  return error.retryable || RETRYABLE_ERROR_CODES.has(error.code);
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onProgress?: RetryProgressCallback
): Promise<RetryResult<T>> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const startTime = Date.now();
  let lastError: LLMErrorDetails | undefined;
  let attemptsMade = 0;

  for (let attempt = 0; attempt <= fullConfig.maxRetries; attempt++) {
    attemptsMade = attempt + 1;
    
    try {
      const result = await fn();
      return {
        success: true,
        result,
        attempts: attemptsMade,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = extractErrorDetails(error);

      llmLogger.warn("LLM request failed", {
        attempt: attemptsMade,
        maxRetries: fullConfig.maxRetries,
        errorCode: lastError.code,
        retryable: isRetryableError(lastError),
      });

      // Don't retry if error is not retryable or we've exhausted retries
      if (!isRetryableError(lastError) || attempt >= fullConfig.maxRetries) {
        break;
      }

      // Calculate delay and wait
      const delay = calculateRetryDelay(attempt, fullConfig, lastError.retryAfterMs);
      
      if (onProgress) {
        onProgress(attemptsMade, delay, lastError);
      }

      llmLogger.info("Retrying after delay", {
        attempt: attemptsMade,
        delayMs: delay,
      });

      await sleep(delay);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: attemptsMade,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Extract error details from various error types
 */
export function extractErrorDetails(error: unknown): LLMErrorDetails {
  // Handle OpenAI error format
  if (isOpenAIError(error)) {
    return extractOpenAIErrorDetails(error);
  }

  // Handle Anthropic error format
  if (isAnthropicError(error)) {
    return extractAnthropicErrorDetails(error);
  }

  // Handle generic Error
  if (error instanceof Error) {
    return {
      code: determineErrorCode(error.message),
      message: error.message,
      retryable: false,
      providerError: error,
    };
  }

  // Unknown error type
  return {
    code: "unknown",
    message: String(error),
    retryable: false,
    providerError: error,
  };
}

// ─────────────────────────────────────────────────────────────
// OpenAI Error Handling
// ─────────────────────────────────────────────────────────────

interface OpenAIErrorShape {
  status?: number;
  code?: string;
  message?: string;
  headers?: Record<string, string>;
}

function isOpenAIError(error: unknown): error is OpenAIErrorShape & Error {
  return (
    error instanceof Error &&
    ("status" in error || "code" in error) &&
    typeof (error as OpenAIErrorShape).message === "string"
  );
}

function extractOpenAIErrorDetails(error: OpenAIErrorShape & Error): LLMErrorDetails {
  const status = error.status;
  const retryAfter = error.headers?.["retry-after"];
  const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;

  let code: LLMErrorCode;
  let retryable = false;

  switch (status) {
    case 429:
      code = "rate_limit";
      retryable = true;
      break;
    case 401:
    case 403:
      code = "auth_error";
      break;
    case 400:
      if (error.code === "context_length_exceeded") {
        code = "context_length";
      } else if (error.code === "content_filter") {
        code = "content_filter";
      } else {
        code = "invalid_response";
      }
      break;
    case 503:
    case 529:
      code = "model_overloaded";
      retryable = true;
      break;
    case 408:
    case 504:
      code = "timeout";
      retryable = true;
      break;
    default:
      code = "unknown";
  }

  return {
    code,
    message: error.message || "OpenAI API error",
    retryable,
    retryAfterMs,
    providerError: error,
  };
}

// ─────────────────────────────────────────────────────────────
// Anthropic Error Handling
// ─────────────────────────────────────────────────────────────

interface AnthropicErrorShape {
  status?: number;
  error?: {
    type?: string;
    message?: string;
  };
  headers?: Record<string, string>;
}

function isAnthropicError(error: unknown): error is AnthropicErrorShape & Error {
  return (
    error instanceof Error &&
    "status" in error &&
    typeof (error as AnthropicErrorShape).error === "object"
  );
}

function extractAnthropicErrorDetails(error: AnthropicErrorShape & Error): LLMErrorDetails {
  const status = error.status;
  const errorType = error.error?.type;
  const retryAfter = error.headers?.["retry-after"];
  const retryAfterMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined;

  let code: LLMErrorCode;
  let retryable = false;

  switch (status) {
    case 429:
      code = "rate_limit";
      retryable = true;
      break;
    case 401:
      code = "auth_error";
      break;
    case 400:
      if (errorType === "invalid_request_error") {
        code = "invalid_response";
      } else {
        code = "unknown";
      }
      break;
    case 529:
      code = "model_overloaded";
      retryable = true;
      break;
    case 408:
    case 504:
      code = "timeout";
      retryable = true;
      break;
    default:
      code = "unknown";
  }

  return {
    code,
    message: error.error?.message || "Anthropic API error",
    retryable,
    retryAfterMs,
    providerError: error,
  };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Determine error code from error message
 */
function determineErrorCode(message: string): LLMErrorCode {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("rate limit") || lowerMessage.includes("too many requests")) {
    return "rate_limit";
  }
  if (lowerMessage.includes("timeout") || lowerMessage.includes("timed out")) {
    return "timeout";
  }
  if (lowerMessage.includes("overloaded") || lowerMessage.includes("capacity")) {
    return "model_overloaded";
  }
  if (lowerMessage.includes("unauthorized") || lowerMessage.includes("invalid api key")) {
    return "auth_error";
  }
  if (lowerMessage.includes("context") || lowerMessage.includes("token limit")) {
    return "context_length";
  }
  if (lowerMessage.includes("content filter") || lowerMessage.includes("safety")) {
    return "content_filter";
  }

  return "unknown";
}

/**
 * Create a timeout error
 */
export function createTimeoutError(timeoutMs: number): LLMErrorDetails {
  return {
    code: "timeout",
    message: `Request timed out after ${timeoutMs}ms`,
    retryable: true,
  };
}

/**
 * Wrap a promise with a timeout
 * Properly cleans up the timer to prevent memory leaks
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(Object.assign(new Error(`Timeout after ${timeoutMs}ms`), {
        code: "timeout",
        status: 408,
      }));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    // Always clear the timeout to prevent memory leaks
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

