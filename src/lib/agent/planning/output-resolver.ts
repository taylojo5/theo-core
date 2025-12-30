// ═══════════════════════════════════════════════════════════════════════════
// Output Resolver
// Resolves step output references in plan parameters
// Enables data flow between steps using {{step.X.output}} syntax
// ═══════════════════════════════════════════════════════════════════════════

import { agentLogger } from "../logger";
import type {
  StructuredPlan,
  StructuredStep,
  OutputResolutionResult,
  OutputResolutionError,
  ResolvedReference,
} from "./types";

// Re-export types for convenience
export type { OutputResolutionResult, OutputResolutionError, ResolvedReference };

const logger = agentLogger.child("output-resolver");

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

/**
 * Pattern to match step output references (non-global, for testing)
 * Use this for `.test()` calls to avoid lastIndex state issues
 * 
 * Path pattern: `\.\w+` followed by zero or more `\.\w+` groups
 * This ensures proper dot-separated identifiers (no consecutive dots)
 */
const OUTPUT_REFERENCE_TEST_PATTERN = /\{\{step\.(\d+)\.output(\.\w+(?:\.\w+)*)?\}\}/;

/**
 * Pattern source for creating fresh global regex instances
 * Use `new RegExp(OUTPUT_REFERENCE_SOURCE, "g")` for each iteration
 * 
 * Must be kept in sync with OUTPUT_REFERENCE_TEST_PATTERN and FULL_REFERENCE_PATTERN
 */
const OUTPUT_REFERENCE_SOURCE = "\\{\\{step\\.(\\d+)\\.output(\\.\\w+(?:\\.\\w+)*)?\\}\\}";

/**
 * Pattern to match entire step reference (for full-string matching)
 * Must be kept in sync with OUTPUT_REFERENCE_TEST_PATTERN and OUTPUT_REFERENCE_SOURCE
 */
const FULL_REFERENCE_PATTERN = /^\{\{step\.(\d+)\.output(\.\w+(?:\.\w+)*)?\}\}$/;

// ─────────────────────────────────────────────────────────────
// Main Resolution Functions
// ─────────────────────────────────────────────────────────────

/**
 * Resolve step output references in a step's parameters
 *
 * Replaces {{step.X.output}} references with actual values from
 * previously completed steps.
 *
 * @param step - The step whose parameters need resolution
 * @param plan - The full plan containing all steps
 * @returns Resolution result with resolved parameters
 */
export function resolveStepOutputs(
  step: StructuredStep,
  plan: StructuredPlan
): OutputResolutionResult {
  logger.debug("Resolving step outputs", {
    stepIndex: step.index,
    planId: plan.id,
  });

  const errors: OutputResolutionError[] = [];
  const resolvedReferences: ResolvedReference[] = [];

  // Deep clone parameters to avoid mutation
  const resolvedParams = resolveValue(
    step.parameters,
    plan,
    errors,
    resolvedReferences
  );

  const success = errors.length === 0;

  if (!success) {
    logger.warn("Output resolution failed", {
      stepIndex: step.index,
      planId: plan.id,
      errorCount: errors.length,
    });
  } else if (resolvedReferences.length > 0) {
    logger.debug("Output resolution successful", {
      stepIndex: step.index,
      resolvedCount: resolvedReferences.length,
    });
  }

  return {
    success,
    resolvedParams: resolvedParams as Record<string, unknown>,
    errors,
    resolvedReferences,
  };
}

/**
 * Check if parameters contain any step output references
 *
 * Useful for determining if a step has dependencies that need resolution.
 *
 * @param params - Parameters to check
 * @returns True if any references are found
 */
export function hasOutputReferences(params: Record<string, unknown>): boolean {
  const json = JSON.stringify(params);
  // Use non-global pattern for .test() to avoid lastIndex state issues
  return OUTPUT_REFERENCE_TEST_PATTERN.test(json);
}

/**
 * Extract all step indices referenced in parameters
 *
 * Useful for determining dynamic dependencies.
 *
 * @param params - Parameters to analyze
 * @returns Array of step indices that are referenced
 */
export function getReferencedStepIndices(params: Record<string, unknown>): number[] {
  const json = JSON.stringify(params);
  const indices = new Set<number>();

  let match;
  // Create fresh global regex to avoid state issues
  const pattern = new RegExp(OUTPUT_REFERENCE_SOURCE, "g");
  while ((match = pattern.exec(json)) !== null) {
    indices.add(parseInt(match[1], 10));
  }

  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Validate that all referenced steps exist and would be completed before this step
 *
 * @param step - Step to validate
 * @param plan - Plan containing all steps
 * @returns Array of validation errors (empty if valid)
 */
export function validateOutputReferences(
  step: StructuredStep,
  plan: StructuredPlan
): OutputResolutionError[] {
  const errors: OutputResolutionError[] = [];
  const referencedIndices = getReferencedStepIndices(step.parameters);

  for (const refIndex of referencedIndices) {
    // Check if referenced step exists
    if (refIndex >= plan.steps.length) {
      errors.push({
        type: "step_not_found",
        reference: `{{step.${refIndex}.output}}`,
        message: `Step ${refIndex} does not exist (plan has ${plan.steps.length} steps)`,
        stepIndex: refIndex,
      });
      continue;
    }

    // Check if referenced step comes before this step in execution order
    // Steps can only reference outputs from steps that execute before them
    if (refIndex >= step.index) {
      errors.push({
        type: "invalid_reference",
        reference: `{{step.${refIndex}.output}}`,
        message: `Step ${step.index} cannot reference step ${refIndex} (must reference earlier steps)`,
        stepIndex: refIndex,
      });
    }
  }

  return errors;
}

// ─────────────────────────────────────────────────────────────
// Internal Resolution Logic
// ─────────────────────────────────────────────────────────────

/**
 * Recursively resolve output references in a value
 */
function resolveValue(
  value: unknown,
  plan: StructuredPlan,
  errors: OutputResolutionError[],
  resolvedReferences: ResolvedReference[]
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return resolveStringValue(value, plan, errors, resolvedReferences);
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      resolveValue(item, plan, errors, resolvedReferences)
    );
  }

  if (typeof value === "object") {
    const resolved: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      resolved[key] = resolveValue(val, plan, errors, resolvedReferences);
    }
    return resolved;
  }

  // Primitives (number, boolean) - return as-is
  return value;
}

/**
 * Resolve output references in a string value
 */
function resolveStringValue(
  value: string,
  plan: StructuredPlan,
  errors: OutputResolutionError[],
  resolvedReferences: ResolvedReference[]
): unknown {
  // Check if the entire string is a single reference
  // In this case, return the actual value (not stringified)
  const fullMatch = value.match(FULL_REFERENCE_PATTERN);
  if (fullMatch) {
    const stepIndex = parseInt(fullMatch[1], 10);
    const path = fullMatch[2]?.slice(1); // Remove leading dot
    return resolveSingleReference(
      value,
      stepIndex,
      path,
      plan,
      errors,
      resolvedReferences
    );
  }

  // If string contains embedded references, replace them as strings
  // Use non-global pattern for .test() to avoid lastIndex state issues
  if (OUTPUT_REFERENCE_TEST_PATTERN.test(value)) {
    // Create fresh global regex for replacement
    const pattern = new RegExp(OUTPUT_REFERENCE_SOURCE, "g");
    return value.replace(pattern, (match, stepIndexStr, pathPart) => {
      const stepIndex = parseInt(stepIndexStr, 10);
      const path = pathPart?.slice(1); // Remove leading dot
      const resolved = resolveSingleReference(
        match,
        stepIndex,
        path,
        plan,
        errors,
        resolvedReferences
      );
      // Convert to string for embedding
      return resolved === undefined ? match : String(resolved);
    });
  }

  return value;
}

/**
 * Resolve a single output reference
 */
function resolveSingleReference(
  reference: string,
  stepIndex: number,
  path: string | undefined,
  plan: StructuredPlan,
  errors: OutputResolutionError[],
  resolvedReferences: ResolvedReference[]
): unknown {
  // Check if step exists
  if (stepIndex >= plan.steps.length) {
    errors.push({
      type: "step_not_found",
      reference,
      message: `Referenced step ${stepIndex} does not exist`,
      stepIndex,
    });
    return undefined;
  }

  const referencedStep = plan.steps[stepIndex];

  // Check if step is completed
  if (referencedStep.status !== "completed") {
    errors.push({
      type: "step_not_completed",
      reference,
      message: `Referenced step ${stepIndex} has not completed (status: ${referencedStep.status})`,
      stepIndex,
    });
    return undefined;
  }

  // Get the output
  let value = referencedStep.result;

  // Navigate path if specified
  if (path) {
    value = navigatePath(value, path);
    if (value === undefined) {
      errors.push({
        type: "path_not_found",
        reference,
        message: `Path "${path}" not found in step ${stepIndex} output`,
        stepIndex,
        path,
      });
      return undefined;
    }
  }

  // Record successful resolution
  resolvedReferences.push({
    reference,
    stepIndex,
    path,
    value,
  });

  return value;
}

/**
 * Navigate a dot-separated path in an object
 */
function navigatePath(value: unknown, path: string): unknown {
  const parts = path.split(".");
  let current = value;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    if (typeof current !== "object") {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = parseInt(part, 10);
      if (isNaN(index)) {
        return undefined;
      }
      current = current[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

// ─────────────────────────────────────────────────────────────
// Utility Functions
// ─────────────────────────────────────────────────────────────

/**
 * Format output references for display
 *
 * Useful for showing users what data will flow between steps.
 *
 * @param params - Parameters to format
 * @returns Human-readable description of references
 */
export function formatOutputReferences(
  params: Record<string, unknown>
): string[] {
  const references: string[] = [];
  const json = JSON.stringify(params);

  let match;
  // Create fresh global regex to avoid state issues
  const pattern = new RegExp(OUTPUT_REFERENCE_SOURCE, "g");
  while ((match = pattern.exec(json)) !== null) {
    const stepIndex = parseInt(match[1], 10);
    const path = match[2]?.slice(1) || "full output";
    references.push(`Step ${stepIndex + 1}: ${path}`);
  }

  return references;
}

/**
 * Create a step output reference string
 *
 * Helper for constructing references programmatically.
 *
 * @param stepIndex - Step to reference
 * @param path - Optional path within the output
 * @returns Reference string
 */
export function createOutputReference(
  stepIndex: number,
  path?: string
): string {
  if (path) {
    return `{{step.${stepIndex}.output.${path}}}`;
  }
  return `{{step.${stepIndex}.output}}`;
}

