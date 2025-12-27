// ═══════════════════════════════════════════════════════════════════════════
// Tool Definition Types
// LLM-First tool definitions with JSON Schema for LLM and Zod for validation
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ToolForLLM } from "../llm/types";
import type { ToolCategory, RiskLevel } from "../constants";
import type { ExecutionContext } from "../types";

// ─────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────

/**
 * Full tool definition including LLM interface and execution logic
 *
 * LLM-First Design:
 * - Tools define their own LLM interface (whenToUse, examples, parametersSchema)
 * - JSON Schema for parameters (LLM-native format)
 * - Zod schema for runtime validation of LLM-provided parameters
 *
 * @template TInput - Type of the validated input
 * @template TOutput - Type of the execution result
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  // ═══════════════════════════════════════════════════════════════════════
  // LLM Interface (what the LLM sees and uses for tool selection)
  // ═══════════════════════════════════════════════════════════════════════

  /** Unique tool identifier (e.g., "query_events", "create_task") */
  name: string;

  /** Human-readable description of what the tool does */
  description: string;

  /** Guidance for the LLM on when to use this tool */
  whenToUse: string;

  /** Example usage scenarios for few-shot learning */
  examples: string[];

  /** JSON Schema for parameters (LLM-native format) */
  parametersSchema: JSONSchema;

  // ═══════════════════════════════════════════════════════════════════════
  // Internal Configuration
  // ═══════════════════════════════════════════════════════════════════════

  /** Category of the tool (query, create, update, delete, etc.) */
  category: ToolCategory;

  /** Risk level of this tool */
  riskLevel: RiskLevel;

  /** Whether this tool requires user approval before execution */
  requiresApproval: boolean;

  /** Required integrations (e.g., ["gmail", "calendar"]) */
  requiredIntegrations: string[];

  // ═══════════════════════════════════════════════════════════════════════
  // Validation & Execution
  // ═══════════════════════════════════════════════════════════════════════

  /** Zod schema for runtime validation of LLM-provided parameters */
  inputValidator: z.ZodSchema<TInput>;

  /**
   * Execute the tool with validated input
   * @param input - Validated input parameters
   * @param context - Execution context (user, session, etc.)
   * @returns Tool execution result
   */
  execute: (input: TInput, context: ExecutionContext) => Promise<TOutput>;

  /**
   * Optional undo/rollback function for reversible actions
   * @param result - The result from execute()
   * @param context - Execution context
   */
  undo?: (result: TOutput, context: ExecutionContext) => Promise<void>;
}

/**
 * Type alias for any tool definition
 * Used in arrays where tools have different input/output types
 * 
 * Note: This uses `any` to avoid contravariance issues with function parameters.
 * The type safety is maintained through Zod validation at runtime.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyToolDefinition = ToolDefinition<any, any>;

// ─────────────────────────────────────────────────────────────
// JSON Schema Types (for parametersSchema)
// ─────────────────────────────────────────────────────────────

/**
 * Simplified JSON Schema type for tool parameters
 * Covers the most common use cases for LLM tool definitions
 */
export interface JSONSchema {
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export type JSONSchemaProperty =
  | JSONSchemaString
  | JSONSchemaNumber
  | JSONSchemaBoolean
  | JSONSchemaArray
  | JSONSchemaObject
  | JSONSchemaEnum;

export interface JSONSchemaBase {
  description?: string;
  default?: unknown;
}

export interface JSONSchemaString extends JSONSchemaBase {
  type: "string";
  format?: "date" | "date-time" | "email" | "uri" | "uuid";
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface JSONSchemaNumber extends JSONSchemaBase {
  type: "number" | "integer";
  minimum?: number;
  maximum?: number;
}

export interface JSONSchemaBoolean extends JSONSchemaBase {
  type: "boolean";
}

export interface JSONSchemaArray extends JSONSchemaBase {
  type: "array";
  items: JSONSchemaProperty;
  minItems?: number;
  maxItems?: number;
}

export interface JSONSchemaObject extends JSONSchemaBase {
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

export interface JSONSchemaEnum extends JSONSchemaBase {
  type: "string";
  enum: string[];
}

// ─────────────────────────────────────────────────────────────
// Tool Result Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of validating tool parameters
 */
export interface ValidationResult<T = unknown> {
  /** Whether validation succeeded */
  success: boolean;

  /** Validated data (if success) */
  data?: T;

  /** Validation errors (if failed) */
  errors?: ValidationError[];
}

/**
 * A single validation error
 */
export interface ValidationError {
  /** Path to the invalid field (e.g., "attendees[0].email") */
  path: string;

  /** Error message */
  message: string;

  /** Expected type or value */
  expected?: string;

  /** Received value */
  received?: string;
}

/**
 * Result of executing a tool
 */
export interface ToolExecutionResult<T = unknown> {
  /** Tool name */
  toolName: string;

  /** Whether execution succeeded */
  success: boolean;

  /** Result data (if success) */
  result?: T;

  /** Error message (if failed) */
  error?: string;

  /** Error code (if failed) */
  errorCode?: string;

  /** Execution duration in milliseconds */
  durationMs: number;

  /** Whether this action requires/required approval */
  requiresApproval?: boolean;

  /** Approval ID (if pending approval) */
  approvalId?: string;

  /** Audit log ID for this execution */
  auditLogId?: string;
}

// ─────────────────────────────────────────────────────────────
// Registry Types
// ─────────────────────────────────────════════════════════════

/**
 * Options for filtering tools
 */
export interface ToolFilterOptions {
  /** Filter by category */
  category?: ToolCategory;

  /** Filter by required integration */
  integration?: string;

  /** Filter by risk level */
  riskLevel?: RiskLevel;

  /** Only include tools that require approval */
  requiresApproval?: boolean;
}

/**
 * Options for getting tools available to a user
 */
export interface UserToolsOptions {
  /** User ID */
  userId: string;

  /** Integrations the user has connected */
  connectedIntegrations: string[];
}

// ─────────────────────════════════════════════════════════════
// Conversion Functions
// ─────────────────────────────────────────────────────────────

/**
 * Convert a ToolDefinition to ToolForLLM for classification/planning
 *
 * This extracts the LLM-facing interface from the full tool definition,
 * producing the format that LLM classification and planning expect.
 *
 * @param tool - Full tool definition
 * @returns ToolForLLM interface for LLM consumption
 */
export function toToolForLLM<TInput, TOutput>(
  tool: ToolDefinition<TInput, TOutput>
): ToolForLLM {
  return {
    name: tool.name,
    description: tool.description,
    whenToUse: tool.whenToUse,
    examples: tool.examples,
    // Cast JSONSchema to Record<string, unknown> for LLM consumption
    parameters: tool.parametersSchema as unknown as Record<string, unknown>,
    requiresApproval: tool.requiresApproval,
  };
}

/**
 * Check if a tool is available given connected integrations
 *
 * @param tool - Tool definition to check
 * @param connectedIntegrations - User's connected integration names
 * @returns true if all required integrations are connected
 */
export function isToolAvailable<TInput, TOutput>(
  tool: ToolDefinition<TInput, TOutput>,
  connectedIntegrations: string[]
): boolean {
  if (tool.requiredIntegrations.length === 0) {
    return true;
  }

  return tool.requiredIntegrations.every((integration) =>
    connectedIntegrations.includes(integration)
  );
}

// ─────────────────────────────────────────────────────────────
// Builder Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Helper to create a tool definition with type inference
 *
 * @example
 * const queryEventsTool = defineTool({
 *   name: "query_events",
 *   description: "Query calendar events",
 *   // ... rest of definition
 *   inputValidator: z.object({ startDate: z.string() }),
 *   execute: async (input, ctx) => { ... },
 * });
 */
export function defineTool<TInput, TOutput>(
  definition: ToolDefinition<TInput, TOutput>
): ToolDefinition<TInput, TOutput> {
  return definition;
}

/**
 * Helper to create a JSON Schema for object parameters
 *
 * @example
 * const schema = objectSchema({
 *   title: { type: "string", description: "Task title" },
 *   priority: { type: "string", enum: ["low", "medium", "high"] },
 * }, ["title"]);
 */
export function objectSchema(
  properties: Record<string, JSONSchemaProperty>,
  required?: string[]
): JSONSchema {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

