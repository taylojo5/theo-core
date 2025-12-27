// ═══════════════════════════════════════════════════════════════════════════
// Tool Registry
// Central registry for all agent tools with LLM interface generation
// ═══════════════════════════════════════════════════════════════════════════

import type { ToolForLLM } from "../llm/types";
import type { ToolCategory, RiskLevel } from "../constants";
import type {
  ToolDefinition,
  AnyToolDefinition,
  ToolFilterOptions,
  ValidationResult,
} from "./types";
import { toToolForLLM, isToolAvailable } from "./types";
import { validateToolParams } from "./validation";
import { agentLogger } from "../logger";

// ─────────────────────────────────────────────────────────────
// Tool Registry Class
// ─────────────────────────────────────────────────────────────

/**
 * Central registry for agent tools
 *
 * The registry:
 * - Stores tool definitions
 * - Provides tools to the LLM in ToolForLLM format
 * - Filters tools by category, integration, and user availability
 * - Validates tool parameters using Zod schemas
 */
export class ToolRegistry {
  /** Registered tools by name */
  private tools = new Map<string, AnyToolDefinition>();

  /** Logger instance */
  private logger = agentLogger.child("tool-registry");

  // ─────────────────────────────────────────────────────────────
  // Registration
  // ─────────────────────────────────────────────────────────────

  /**
   * Register a tool with the registry
   *
   * @param tool - Tool definition to register
   * @throws Error if a tool with the same name is already registered
   */
  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }

    this.tools.set(tool.name, tool as AnyToolDefinition);
    this.logger.debug("Tool registered", { name: tool.name });
  }

  /**
   * Register multiple tools at once
   *
   * @param tools - Array of tool definitions
   */
  registerAll(tools: AnyToolDefinition[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
  }

  /**
   * Unregister a tool (mainly for testing)
   *
   * @param name - Tool name to unregister
   * @returns true if the tool was removed
   */
  unregister(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      this.logger.debug("Tool unregistered", { name });
    }
    return removed;
  }

  /**
   * Clear all registered tools (mainly for testing)
   */
  clear(): void {
    this.tools.clear();
    this.logger.debug("All tools cleared");
  }

  // ─────────────────────────────────────────────────────────────
  // Retrieval
  // ─────────────────────────────────────────────────────────────

  /**
   * Get a tool by name
   *
   * @param name - Tool name
   * @returns Tool definition or undefined
   */
  get(name: string): AnyToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Check if a tool exists
   *
   * @param name - Tool name
   * @returns true if the tool is registered
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all registered tool names
   *
   * @returns Array of tool names
   */
  names(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get the number of registered tools
   */
  get size(): number {
    return this.tools.size;
  }

  // ─────────────────────────────────────────────────────────────
  // Filtering
  // ─────────────────────────────────────────────────────────────

  /**
   * List tools, optionally filtered
   *
   * @param options - Filter options
   * @returns Array of matching tool definitions
   */
  list(options?: ToolFilterOptions): AnyToolDefinition[] {
    let result = Array.from(this.tools.values());

    if (options?.category) {
      result = result.filter((t) => t.category === options.category);
    }

    if (options?.integration) {
      result = result.filter((t) =>
        t.requiredIntegrations.includes(options.integration!)
      );
    }

    if (options?.riskLevel) {
      result = result.filter((t) => t.riskLevel === options.riskLevel);
    }

    if (options?.requiresApproval !== undefined) {
      result = result.filter(
        (t) => t.requiresApproval === options.requiresApproval
      );
    }

    return result;
  }

  /**
   * List tools by category
   *
   * @param category - Tool category
   * @returns Array of tools in that category
   */
  listByCategory(category: ToolCategory): AnyToolDefinition[] {
    return this.list({ category });
  }

  /**
   * List tools by integration
   *
   * @param integration - Integration name (e.g., "gmail", "calendar")
   * @returns Array of tools requiring that integration
   */
  listByIntegration(integration: string): AnyToolDefinition[] {
    return this.list({ integration });
  }

  /**
   * List tools by risk level
   *
   * @param riskLevel - Risk level
   * @returns Array of tools at that risk level
   */
  listByRiskLevel(riskLevel: RiskLevel): AnyToolDefinition[] {
    return this.list({ riskLevel });
  }

  // ─────────────────────────────────────────────────────────────
  // LLM Interface
  // ─────────────────────────────────────────────────────────────

  /**
   * Get all tools in LLM format for classification
   *
   * This converts all registered tools to the ToolForLLM interface
   * that the LLM uses for understanding available actions.
   *
   * @returns Array of ToolForLLM for LLM consumption
   */
  getToolsForLLM(): ToolForLLM[] {
    return Array.from(this.tools.values()).map(toToolForLLM);
  }

  /**
   * Get tools available for a specific user
   *
   * Filters tools based on the user's connected integrations.
   * Tools that require integrations the user hasn't connected are excluded.
   *
   * @param connectedIntegrations - Integrations the user has connected
   * @returns Array of ToolForLLM available to the user
   */
  getAvailableTools(connectedIntegrations: string[]): ToolForLLM[] {
    return Array.from(this.tools.values())
      .filter((tool) => isToolAvailable(tool, connectedIntegrations))
      .map(toToolForLLM);
  }

  /**
   * Get tools for a specific category in LLM format
   *
   * @param category - Tool category to filter by
   * @returns Array of ToolForLLM in that category
   */
  getToolsForLLMByCategory(category: ToolCategory): ToolForLLM[] {
    return this.listByCategory(category).map(toToolForLLM);
  }

  // ─────────────────────────────────────────────────────────────
  // Validation
  // ─────────────────────────────────────────────────────────────

  /**
   * Validate parameters for a tool
   *
   * @param name - Tool name
   * @param params - Parameters to validate
   * @returns Validation result
   */
  validateParams(name: string, params: unknown): ValidationResult {
    const tool = this.tools.get(name);

    if (!tool) {
      return {
        success: false,
        errors: [
          {
            path: "(tool)",
            message: `Tool "${name}" not found`,
          },
        ],
      };
    }

    return validateToolParams(tool, params);
  }

  // ─────────────────────────────────────────────────────────────
  // Introspection
  // ─────────────────────────────────────────────────────────────

  /**
   * Get a summary of registered tools
   *
   * Useful for debugging and monitoring.
   */
  getSummary(): ToolRegistrySummary {
    const tools = Array.from(this.tools.values());

    const byCategory: Record<ToolCategory, number> = {
      query: 0,
      compute: 0,
      draft: 0,
      create: 0,
      update: 0,
      delete: 0,
      external: 0,
    };

    const byRiskLevel: Record<RiskLevel, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const integrations = new Set<string>();
    let requiresApproval = 0;

    for (const tool of tools) {
      byCategory[tool.category]++;
      byRiskLevel[tool.riskLevel]++;

      if (tool.requiresApproval) {
        requiresApproval++;
      }

      for (const integration of tool.requiredIntegrations) {
        integrations.add(integration);
      }
    }

    return {
      totalTools: tools.length,
      byCategory,
      byRiskLevel,
      integrations: Array.from(integrations),
      requiresApproval,
    };
  }
}

/**
 * Summary of the tool registry state
 */
export interface ToolRegistrySummary {
  totalTools: number;
  byCategory: Record<ToolCategory, number>;
  byRiskLevel: Record<RiskLevel, number>;
  integrations: string[];
  requiresApproval: number;
}

// ─────────────────────────────────────────────────────────────
// Singleton Instance
// ─────────────────────────────────────────────────────────────

/**
 * Global tool registry instance
 *
 * Use this for normal application code.
 * Create new instances only for testing.
 */
export const toolRegistry = new ToolRegistry();

