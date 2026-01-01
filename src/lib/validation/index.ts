import { NextResponse } from "next/server";
import { z, ZodError, ZodSchema } from "zod";

// ═══════════════════════════════════════════════════════════════════════════
// Validation Utilities
// Helper functions for request validation in API routes
// ═══════════════════════════════════════════════════════════════════════════

export * from "./schemas";

/**
 * Result of a validation operation
 */
export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: NextResponse };

/**
 * Validate request body against a Zod schema
 */
export function validateBody<T extends ZodSchema>(
  body: unknown,
  schema: T
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(body);

  if (!result.success) {
    return {
      success: false,
      error: validationErrorResponse(result.error),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate an object against a Zod schema
 * Used for validating parsed bodies for updates
 */
export function validateObject<T extends ZodSchema>(
  obj: unknown,
  schema: T
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(obj);

  if (!result.success) {
    return {
      success: false,
      error: validationErrorResponse(result.error),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate URL search params against a Zod schema
 */
export function validateQuery<T extends ZodSchema>(
  searchParams: URLSearchParams,
  schema: T
): ValidationResult<z.infer<T>> {
  // Convert URLSearchParams to object
  const params: Record<string, string | string[]> = {};
  searchParams.forEach((value, key) => {
    const existing = params[key];
    if (existing) {
      // Handle array params (e.g., ?tag=a&tag=b)
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        params[key] = [existing, value];
      }
    } else {
      params[key] = value;
    }
  });

  const result = schema.safeParse(params);

  if (!result.success) {
    return {
      success: false,
      error: validationErrorResponse(result.error),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Validate path params against a Zod schema
 */
export function validateParams<T extends ZodSchema>(
  params: Record<string, string | string[] | undefined>,
  schema: T
): ValidationResult<z.infer<T>> {
  const result = schema.safeParse(params);

  if (!result.success) {
    return {
      success: false,
      error: validationErrorResponse(result.error),
    };
  }

  return { success: true, data: result.data };
}

/**
 * Create a validation error response from a ZodError
 */
export function validationErrorResponse(error: ZodError): NextResponse {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
    code: issue.code,
  }));

  return NextResponse.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        issues,
      },
    },
    { status: 400 }
  );
}

/**
 * Parse and validate JSON body from request
 * Returns validated data or error response
 */
export async function parseAndValidateBody<T extends ZodSchema>(
  request: Request,
  schema: T
): Promise<ValidationResult<z.infer<T>>> {
  try {
    const body = await request.json();
    return validateBody(body, schema);
  } catch {
    return {
      success: false,
      error: NextResponse.json(
        {
          error: {
            code: "INVALID_JSON",
            message: "Request body must be valid JSON",
          },
        },
        { status: 400 }
      ),
    };
  }
}

/**
 * Type helper to infer schema type
 */
export type InferSchema<T extends ZodSchema> = z.infer<T>;
