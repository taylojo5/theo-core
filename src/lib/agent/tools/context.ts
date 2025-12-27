// ═══════════════════════════════════════════════════════════════════════════
// Tool Execution Context
// Utilities for creating and managing tool execution context
// ═══════════════════════════════════════════════════════════════════════════

import type { ExecutionContext } from "../types";

// ─────────────────────────────────────────────────────────────
// Extended Execution Context
// ─────────────────────────────────────────────────────────────

/**
 * Extended execution context with additional runtime information
 * Used internally by the tool execution engine
 */
export interface ExtendedExecutionContext extends ExecutionContext {
  /** Function to get access token for an integration */
  getAccessToken?: (integration: string) => Promise<string | null>;

  /** User's timezone (e.g., "America/New_York") */
  timezone?: string;

  /** Current timestamp for relative date resolution */
  currentTime?: Date;

  /** Audit log ID for this execution */
  auditLogId?: string;

  /** Request ID for tracing */
  requestId?: string;
}

// ─────────────────────────────────────────────────────────────
// Context Creation
// ─────────────────────────────────────────────────────────────

/**
 * Options for creating an execution context
 */
export interface CreateContextOptions {
  userId: string;
  sessionId?: string;
  conversationId?: string;
  planId?: string;
  stepIndex?: number;
  timezone?: string;
  requestId?: string;
}

/**
 * Create a basic execution context
 *
 * @param options - Context creation options
 * @returns Execution context for tool calls
 */
export function createExecutionContext(
  options: CreateContextOptions
): ExecutionContext {
  return {
    userId: options.userId,
    sessionId: options.sessionId,
    conversationId: options.conversationId,
    planId: options.planId,
    stepIndex: options.stepIndex,
  };
}

/**
 * Create an extended execution context with token provider
 *
 * @param options - Context creation options
 * @param getAccessToken - Function to get access tokens for integrations
 * @returns Extended execution context
 */
export function createExtendedContext(
  options: CreateContextOptions,
  getAccessToken?: (integration: string) => Promise<string | null>
): ExtendedExecutionContext {
  return {
    userId: options.userId,
    sessionId: options.sessionId,
    conversationId: options.conversationId,
    planId: options.planId,
    stepIndex: options.stepIndex,
    timezone: options.timezone,
    currentTime: new Date(),
    requestId: options.requestId,
    getAccessToken,
  };
}

// ─────────────────────────────────────────────────────────────
// Context Utilities
// ─────────────────────────────────────────────────────────────

/**
 * Add plan context to an existing execution context
 *
 * @param context - Base execution context
 * @param planId - Plan ID
 * @param stepIndex - Current step index
 * @returns New context with plan information
 */
export function withPlanContext(
  context: ExecutionContext,
  planId: string,
  stepIndex: number
): ExecutionContext {
  return {
    ...context,
    planId,
    stepIndex,
  };
}

/**
 * Add conversation context to an existing execution context
 *
 * @param context - Base execution context
 * @param conversationId - Conversation ID
 * @returns New context with conversation information
 */
export function withConversationContext(
  context: ExecutionContext,
  conversationId: string
): ExecutionContext {
  return {
    ...context,
    conversationId,
  };
}

/**
 * Add session context to an existing execution context
 *
 * @param context - Base execution context
 * @param sessionId - Session ID
 * @returns New context with session information
 */
export function withSessionContext(
  context: ExecutionContext,
  sessionId: string
): ExecutionContext {
  return {
    ...context,
    sessionId,
  };
}

/**
 * Create a minimal context for internal operations
 * (e.g., scheduled jobs, background tasks)
 *
 * @param userId - User ID
 * @returns Minimal execution context
 */
export function createSystemContext(userId: string): ExecutionContext {
  return {
    userId,
    sessionId: "system",
  };
}

// ─────────────────────────────────────────────────────────────
// Context Validation
// ─────────────────────────────────────────────────────────────

/**
 * Validate that a context has all required fields for tool execution
 *
 * @param context - Context to validate
 * @returns true if context is valid
 */
export function isValidContext(context: ExecutionContext): boolean {
  return Boolean(context.userId && context.userId.length > 0);
}

/**
 * Validate that a context has plan information
 *
 * @param context - Context to validate
 * @returns true if context has plan info
 */
export function hasPlanContext(
  context: ExecutionContext
): context is ExecutionContext & { planId: string; stepIndex: number } {
  return (
    context.planId !== undefined &&
    context.planId.length > 0 &&
    context.stepIndex !== undefined &&
    typeof context.stepIndex === "number"
  );
}

/**
 * Validate that a context has conversation information
 *
 * @param context - Context to validate
 * @returns true if context has conversation info
 */
export function hasConversationContext(
  context: ExecutionContext
): context is ExecutionContext & { conversationId: string } {
  return (
    context.conversationId !== undefined && context.conversationId.length > 0
  );
}

// ─────────────────────────────────────────────────────────────
// Access Token Provider Factory
// ─────────────────────────────────────────────────────────────

/**
 * Create an access token provider that fetches tokens on demand
 *
 * This is a factory that returns a function compatible with ExtendedExecutionContext.
 * The actual token fetching logic is injected to avoid coupling to specific implementations.
 *
 * Uses Promise caching to handle concurrent requests - if multiple calls request
 * the same integration token before the first fetch completes, they all share
 * the same Promise rather than triggering multiple fetches.
 *
 * @param tokenFetcher - Function that fetches tokens for a user and integration
 * @param userId - User ID to fetch tokens for
 * @returns Access token provider function
 */
export function createTokenProvider(
  tokenFetcher: (
    userId: string,
    integration: string
  ) => Promise<string | null>,
  userId: string
): (integration: string) => Promise<string | null> {
  // Cache Promises (not just results) to handle concurrent requests
  // This ensures multiple concurrent calls for the same integration share one fetch
  const promiseCache = new Map<string, Promise<string | null>>();

  return (integration: string): Promise<string | null> => {
    // Check if we already have a pending or completed fetch for this integration
    const cachedPromise = promiseCache.get(integration);
    if (cachedPromise) {
      return cachedPromise;
    }

    // Create the fetch promise and cache it immediately (before awaiting)
    const fetchPromise = tokenFetcher(userId, integration);
    promiseCache.set(integration, fetchPromise);

    return fetchPromise;
  };
}

