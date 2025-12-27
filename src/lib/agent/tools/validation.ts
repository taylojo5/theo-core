// ═══════════════════════════════════════════════════════════════════════════
// Tool Parameter Validation
// Validates LLM-provided parameters using Zod schemas
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ToolDefinition, ValidationResult, ValidationError } from "./types";

// ─────────────────────────────────────────────────────────────
// Validation Functions
// ─────────────────────────────────────────────────────────────

/**
 * Validate parameters against a tool's Zod schema
 *
 * @param tool - Tool definition containing the validator
 * @param params - Raw parameters from the LLM
 * @returns Validation result with typed data or errors
 */
export function validateToolParams<TInput, TOutput>(
  tool: ToolDefinition<TInput, TOutput>,
  params: unknown
): ValidationResult<TInput> {
  return validateWithSchema(tool.inputValidator, params);
}

/**
 * Validate data against a Zod schema
 *
 * @param schema - Zod schema to validate against
 * @param data - Data to validate
 * @returns Validation result with typed data or errors
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

// ─────────────────────────────────────────────────────────────
// Error Formatting
// ─────────────────────────────────────────────────────────────

/**
 * Format Zod errors into a consistent ValidationError format
 *
 * @param error - Zod error object
 * @returns Array of formatted validation errors
 */
export function formatZodErrors(error: z.ZodError): ValidationError[] {
  return error.issues.map((issue) => {
    const path = issue.path.join(".");

    return {
      path: path || "(root)",
      message: issue.message,
      expected: getExpectedType(issue),
      received: getReceivedValue(issue),
    };
  });
}

/**
 * Format validation errors for LLM retry prompt
 *
 * When the LLM provides invalid parameters, we format the errors
 * in a way that helps the LLM understand what went wrong and retry.
 *
 * @param errors - Array of validation errors
 * @param toolName - Name of the tool
 * @returns Formatted error message for LLM
 */
export function formatErrorsForLLM(
  errors: ValidationError[],
  toolName: string
): string {
  const errorList = errors
    .map((e) => {
      let msg = `- ${e.path}: ${e.message}`;
      if (e.expected) {
        msg += ` (expected: ${e.expected})`;
      }
      if (e.received) {
        msg += ` (received: ${e.received})`;
      }
      return msg;
    })
    .join("\n");

  return `Parameter validation failed for tool "${toolName}":\n${errorList}\n\nPlease provide valid parameters and try again.`;
}

/**
 * Format a single validation error as a human-readable message
 */
export function formatValidationError(error: ValidationError): string {
  let message = `${error.path}: ${error.message}`;

  if (error.expected && error.received) {
    message += ` (expected ${error.expected}, got ${error.received})`;
  } else if (error.expected) {
    message += ` (expected ${error.expected})`;
  }

  return message;
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Zod issue with potential extra properties
 * Zod v4 has different issue structures, so we use a flexible approach
 */
type ZodIssueWithExtras = z.ZodIssue & {
  expected?: unknown;
  received?: unknown;
  minimum?: number;
  maximum?: number;
  options?: unknown[];
};

/**
 * Extract expected type from a Zod issue
 * Compatible with Zod v3 and v4
 */
function getExpectedType(issue: z.ZodIssue): string | undefined {
  const issueWithExtras = issue as ZodIssueWithExtras;

  // Check for expected property (invalid_type, invalid_literal, etc.)
  if ("expected" in issueWithExtras && issueWithExtras.expected !== undefined) {
    return String(issueWithExtras.expected);
  }

  // Check for options property (enum values)
  if ("options" in issueWithExtras && Array.isArray(issueWithExtras.options)) {
    return `one of [${issueWithExtras.options.join(", ")}]`;
  }

  // Check for minimum (too_small)
  if ("minimum" in issueWithExtras && issueWithExtras.minimum !== undefined) {
    return `at least ${issueWithExtras.minimum}`;
  }

  // Check for maximum (too_big)
  if ("maximum" in issueWithExtras && issueWithExtras.maximum !== undefined) {
    return `at most ${issueWithExtras.maximum}`;
  }

  return undefined;
}

/**
 * Extract received value from a Zod issue
 * Compatible with Zod v3 and v4
 */
function getReceivedValue(issue: z.ZodIssue): string | undefined {
  const issueWithExtras = issue as ZodIssueWithExtras;

  if ("received" in issueWithExtras && issueWithExtras.received !== undefined) {
    return String(issueWithExtras.received);
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────
// Schema Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Common Zod schema fragments for tool parameters
 */
export const commonSchemas = {
  /** Non-empty string */
  nonEmptyString: z.string().min(1, "Cannot be empty"),

  /** Optional non-empty string (empty becomes undefined) */
  optionalString: z
    .string()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),

  /** ISO date string */
  dateString: z.string().refine(
    (val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    },
    { message: "Invalid date format" }
  ),

  /** ISO datetime string */
  datetimeString: z.string().refine(
    (val) => {
      const date = new Date(val);
      return !isNaN(date.getTime());
    },
    { message: "Invalid datetime format" }
  ),

  /** Email address */
  email: z.string().email("Invalid email address"),

  /** Array of email addresses */
  emailList: z.array(z.string().email("Invalid email address")),

  /** Positive integer */
  positiveInt: z.number().int().positive(),

  /** Optional positive integer with default */
  pageSize: z.number().int().min(1).max(100).default(20),

  /** UUID string */
  uuid: z.string().uuid("Invalid UUID"),

  /** Priority level */
  priority: z.enum(["low", "medium", "high", "urgent"]),

  /** Status values (commonly used) */
  taskStatus: z.enum(["todo", "in_progress", "completed", "cancelled"]),
};

/**
 * Create a paginated query parameters schema
 */
export function paginatedQuerySchema<T extends z.ZodRawShape>(
  additionalFields: T
) {
  return z.object({
    ...additionalFields,
    limit: z.number().int().min(1).max(100).optional().default(20),
    offset: z.number().int().min(0).optional().default(0),
  });
}

/**
 * Create a date range query parameters schema
 */
export function dateRangeSchema<T extends z.ZodRawShape>(additionalFields: T) {
  return z.object({
    ...additionalFields,
    startDate: commonSchemas.dateString.optional(),
    endDate: commonSchemas.dateString.optional(),
  });
}

