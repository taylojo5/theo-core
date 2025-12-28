// ═══════════════════════════════════════════════════════════════════════════
// Agent Engine Logger
// Structured logging for the Agent Engine with specialized child loggers
// ═══════════════════════════════════════════════════════════════════════════

import { getLogger } from "@/lib/logging";

// ─────────────────────────────────────────────────────────────
// Main Agent Logger
// ─────────────────────────────────────────────────────────────

/**
 * Main logger for the Agent Engine
 * Use for general agent operations and orchestration
 */
export const agentLogger = getLogger("agent");

// ─────────────────────────────────────────────────────────────
// Specialized Child Loggers
// ─────────────────────────────────────────────────────────────

/**
 * Logger for intent analysis operations
 * Use for logging intent classification, entity extraction, etc.
 */
export const intentLogger = agentLogger.child("intent");

/**
 * Logger for planning operations
 * Use for logging plan creation, step sequencing, dependencies
 */
export const planLogger = agentLogger.child("plan");

/**
 * Logger for tool operations
 * Use for logging tool registration, validation, execution
 */
export const toolLogger = agentLogger.child("tool");

/**
 * Logger for audit operations
 * Use for logging audit entry creation, queries, verification
 */
export const auditLogger = agentLogger.child("audit");

/**
 * Logger for context retrieval operations
 * Use for logging context queries, ranking, summarization
 */
export const contextLogger = agentLogger.child("context");

/**
 * Logger for LLM operations
 * Use for logging LLM requests, responses, token usage
 */
export const llmLogger = agentLogger.child("llm");

/**
 * Logger for approval workflow operations
 * Use for logging approval requests, decisions, expirations
 */
export const approvalLogger = agentLogger.child("approval");

/**
 * Logger for entity operations
 * Use for logging entity extraction and resolution
 */
export const entityLogger = agentLogger.child("entity");

/**
 * Logger for reasoning operations
 * Use for logging hypothesis formation, confidence scoring
 */
export const reasoningLogger = agentLogger.child("reasoning");

/**
 * Logger for response generation
 * Use for logging response creation, uncertainty expression
 */
export const responseLogger = agentLogger.child("response");

/**
 * Logger for execution operations
 * Use for logging tool execution, result evaluation
 */
export const executionLogger = agentLogger.child("execution");

/**
 * Logger for streaming operations
 * Use for logging SSE events, stream management
 */
export const streamLogger = agentLogger.child("stream");



