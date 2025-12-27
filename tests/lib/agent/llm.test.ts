// ═══════════════════════════════════════════════════════════════════════════
// LLM Module Tests
// Tests for the LLM abstraction layer
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  // Types
  type ToolForLLM,
  type ClassificationRequest,
  type ClassificationResponse,
  type LLMClient,
  type LLMConfig,

  // Prompt builders
  buildClassificationPrompt,
  parseClassificationResponse,
  buildPlanGenerationPrompt,
  parsePlanGenerationResponse,
  buildResponsePrompt,
  buildRecoveryPrompt,
  parseRecoveryResponse,
  isTransientError,
  getSuggestedRecoveryAction,

  // Retry logic
  calculateRetryDelay,
  DEFAULT_RETRY_CONFIG,
  withRetry,
  extractErrorDetails,
  isRetryableLLMError,

  // Client factory
  getDefaultLLMConfig,
  isProviderAvailable,
  getAvailableProviders,
} from "@/lib/agent";

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

const mockTool: ToolForLLM = {
  name: "create_task",
  description: "Create a new task",
  whenToUse: "When user wants to add a new task or todo item",
  examples: ["Create a task to buy groceries", "Add a todo for tomorrow"],
  parameters: {
    type: "object",
    properties: {
      title: { type: "string" },
      dueDate: { type: "string" },
    },
    required: ["title"],
  },
  requiresApproval: false,
};

const mockClassificationRequest: ClassificationRequest = {
  message: "Create a task to buy groceries tomorrow",
  availableTools: [mockTool],
  timezone: "America/New_York",
  currentTime: new Date("2024-01-15T10:00:00Z"),
};

// ─────────────────────────────────────────────────────────────
// Prompt Builder Tests
// ─────────────────────────────────────────────────────────────

describe("buildClassificationPrompt", () => {
  it("should include user message", () => {
    const prompt = buildClassificationPrompt(mockClassificationRequest);
    expect(prompt).toContain("Create a task to buy groceries tomorrow");
  });

  it("should include available tools", () => {
    const prompt = buildClassificationPrompt(mockClassificationRequest);
    expect(prompt).toContain("create_task");
    expect(prompt).toContain("Create a new task");
    expect(prompt).toContain("When user wants to add a new task");
  });

  it("should include tool examples", () => {
    const prompt = buildClassificationPrompt(mockClassificationRequest);
    expect(prompt).toContain("Create a task to buy groceries");
  });

  it("should include timezone when provided", () => {
    const prompt = buildClassificationPrompt(mockClassificationRequest);
    expect(prompt).toContain("America/New_York");
  });

  it("should include current time when provided", () => {
    const prompt = buildClassificationPrompt(mockClassificationRequest);
    expect(prompt).toContain("2024-01-15");
  });

  it("should include conversation history when provided", () => {
    const request: ClassificationRequest = {
      ...mockClassificationRequest,
      conversationHistory: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ],
    };
    const prompt = buildClassificationPrompt(request);
    expect(prompt).toContain("Hello");
    expect(prompt).toContain("Hi there!");
  });

  it("should include JSON schema instructions", () => {
    const prompt = buildClassificationPrompt(mockClassificationRequest);
    expect(prompt).toContain('"intent"');
    expect(prompt).toContain('"entities"');
    expect(prompt).toContain('"suggestedTool"');
    expect(prompt).toContain('"confidence"');
  });
});

describe("parseClassificationResponse", () => {
  it("should parse valid JSON response", () => {
    const rawResponse = JSON.stringify({
      intent: {
        category: "action",
        action: "create_task",
        summary: "Create a task to buy groceries",
      },
      entities: [
        { type: "task", text: "buy groceries", value: "buy groceries", needsResolution: false },
        { type: "datetime", text: "tomorrow", value: "2024-01-16", needsResolution: false },
      ],
      suggestedTool: {
        name: "create_task",
        parameters: { title: "Buy groceries", dueDate: "2024-01-16" },
        confidence: 0.9,
        reasoning: "User wants to create a task",
      },
      assumptions: [
        {
          statement: "User wants the task for tomorrow",
          category: "intent",
          evidence: ["Message contains 'tomorrow'"],
          confidence: 0.95,
        },
      ],
      confidence: 0.9,
    });

    const result = parseClassificationResponse(rawResponse);

    expect(result.intent.category).toBe("action");
    expect(result.intent.action).toBe("create_task");
    expect(result.entities).toHaveLength(2);
    expect(result.suggestedTool?.name).toBe("create_task");
    expect(result.suggestedTool?.confidence).toBe(0.9);
    expect(result.assumptions).toHaveLength(1);
    expect(result.confidence).toBe(0.9);
  });

  it("should parse JSON wrapped in markdown code block", () => {
    const rawResponse = `Here's my analysis:

\`\`\`json
{
  "intent": { "category": "query", "summary": "Test query" },
  "entities": [],
  "assumptions": [],
  "confidence": 0.8
}
\`\`\``;

    const result = parseClassificationResponse(rawResponse);
    expect(result.intent.category).toBe("query");
    expect(result.confidence).toBe(0.8);
  });

  it("should return fallback for invalid JSON", () => {
    const rawResponse = "This is not JSON at all";
    const result = parseClassificationResponse(rawResponse);

    expect(result.intent.category).toBe("unknown");
    expect(result.confidence).toBe(0);
  });

  it("should handle missing fields gracefully", () => {
    const rawResponse = JSON.stringify({
      intent: { category: "action" },
    });

    const result = parseClassificationResponse(rawResponse);
    expect(result.intent.category).toBe("action");
    expect(result.entities).toEqual([]);
    expect(result.assumptions).toEqual([]);
    expect(result.suggestedTool).toBeUndefined();
  });
});

describe("buildPlanGenerationPrompt", () => {
  it("should include goal", () => {
    const prompt = buildPlanGenerationPrompt({
      goal: "Schedule a meeting with John tomorrow",
      availableTools: [mockTool],
    });
    expect(prompt).toContain("Schedule a meeting with John tomorrow");
  });

  it("should include goal context when provided", () => {
    const prompt = buildPlanGenerationPrompt({
      goal: "Schedule meeting",
      goalContext: "User prefers morning meetings",
      availableTools: [mockTool],
    });
    expect(prompt).toContain("User prefers morning meetings");
  });

  it("should include previous attempts for recovery", () => {
    const prompt = buildPlanGenerationPrompt({
      goal: "Send email",
      availableTools: [mockTool],
      previousAttempts: [
        {
          steps: [{ order: 0, toolName: "send_email", parameters: {}, dependsOn: [], description: "Send email", requiresApproval: true }],
          failure: { stepIndex: 0, error: "Rate limit exceeded" },
        },
      ],
    });
    expect(prompt).toContain("Previous Attempts");
    expect(prompt).toContain("Rate limit exceeded");
  });
});

describe("parsePlanGenerationResponse", () => {
  it("should parse valid plan response", () => {
    const rawResponse = JSON.stringify({
      goal: "Schedule meeting with John",
      goalType: "scheduling",
      steps: [
        {
          order: 0,
          toolName: "check_availability",
          parameters: { date: "2024-01-16" },
          dependsOn: [],
          description: "Check calendar availability",
          requiresApproval: false,
        },
        {
          order: 1,
          toolName: "create_event",
          parameters: { title: "Meeting with John" },
          dependsOn: [0],
          description: "Create calendar event",
          requiresApproval: true,
        },
      ],
      requiresApproval: true,
      reasoning: "Need to check availability before creating event",
      assumptions: [],
      confidence: 0.85,
    });

    const result = parsePlanGenerationResponse(rawResponse);

    expect(result.goal).toBe("Schedule meeting with John");
    expect(result.steps).toHaveLength(2);
    expect(result.steps[0].toolName).toBe("check_availability");
    expect(result.steps[1].dependsOn).toEqual([0]);
    expect(result.requiresApproval).toBe(true);
  });

  it("should return fallback for invalid JSON", () => {
    const result = parsePlanGenerationResponse("Not JSON");
    expect(result.goal).toBe("Failed to parse plan");
    expect(result.steps).toEqual([]);
    expect(result.confidence).toBe(0);
  });
});

describe("buildResponsePrompt", () => {
  it("should include user message", () => {
    const prompt = buildResponsePrompt({
      userMessage: "Create a task for tomorrow",
    });
    expect(prompt).toContain("Create a task for tomorrow");
  });

  it("should include tool results", () => {
    const prompt = buildResponsePrompt({
      userMessage: "Create a task",
      toolResults: [
        { toolName: "create_task", success: true, result: { id: "123" } },
      ],
    });
    expect(prompt).toContain("create_task");
    expect(prompt).toContain("Success");
  });

  it("should include failed tool results", () => {
    const prompt = buildResponsePrompt({
      userMessage: "Create a task",
      toolResults: [
        { toolName: "create_task", success: false, error: "Permission denied" },
      ],
    });
    expect(prompt).toContain("Failed");
    expect(prompt).toContain("Permission denied");
  });
});

describe("buildRecoveryPrompt", () => {
  it("should include plan context", () => {
    const prompt = buildRecoveryPrompt({
      plan: {
        goal: "Send important email",
        steps: [
          { order: 0, toolName: "send_email", parameters: {}, dependsOn: [], description: "Send email", requiresApproval: true },
        ],
        currentStepIndex: 0,
      },
      failure: {
        stepIndex: 0,
        error: "Rate limit exceeded",
        errorType: "rate_limit",
      },
      retryCount: 1,
    });

    expect(prompt).toContain("Send important email");
    expect(prompt).toContain("Rate limit exceeded");
    expect(prompt).toContain("Retry count: 1");
  });
});

describe("parseRecoveryResponse", () => {
  it("should parse valid recovery response", () => {
    const rawResponse = JSON.stringify({
      action: "retry",
      reasoning: "Error is transient, retry should work",
      modifiedParameters: { delay: 5000 },
      confidence: 0.8,
    });

    const result = parseRecoveryResponse(rawResponse);
    expect(result.action).toBe("retry");
    expect(result.reasoning).toBe("Error is transient, retry should work");
    expect(result.modifiedParameters).toEqual({ delay: 5000 });
  });

  it("should default to ask_user for invalid response", () => {
    const result = parseRecoveryResponse("Not JSON");
    expect(result.action).toBe("ask_user");
    expect(result.confidence).toBe(0);
  });

  it("should parse ask_user response with message", () => {
    const rawResponse = JSON.stringify({
      action: "ask_user",
      reasoning: "Need user input",
      userMessage: "Would you like me to try again?",
      confidence: 0.7,
    });

    const result = parseRecoveryResponse(rawResponse);
    expect(result.action).toBe("ask_user");
    expect(result.userMessage).toBe("Would you like me to try again?");
  });
});

describe("isTransientError", () => {
  it("should return true for transient error types", () => {
    expect(isTransientError("rate_limit")).toBe(true);
    expect(isTransientError("timeout")).toBe(true);
    expect(isTransientError("network_error")).toBe(true);
    expect(isTransientError("service_unavailable")).toBe(true);
    expect(isTransientError("model_overloaded")).toBe(true);
  });

  it("should return false for non-transient errors", () => {
    expect(isTransientError("validation_error")).toBe(false);
    expect(isTransientError("auth_error")).toBe(false);
    expect(isTransientError("unknown")).toBe(false);
  });
});

describe("getSuggestedRecoveryAction", () => {
  it("should suggest retry for transient errors", () => {
    expect(getSuggestedRecoveryAction("rate_limit", 0)).toBe("retry");
    expect(getSuggestedRecoveryAction("timeout", 1)).toBe("retry");
  });

  it("should ask user after max retries", () => {
    expect(getSuggestedRecoveryAction("rate_limit", 3)).toBe("ask_user");
  });

  it("should ask user for auth errors", () => {
    expect(getSuggestedRecoveryAction("auth_error", 0)).toBe("ask_user");
    expect(getSuggestedRecoveryAction("permission_denied", 0)).toBe("ask_user");
  });

  it("should ask user for validation errors", () => {
    expect(getSuggestedRecoveryAction("validation_error", 0)).toBe("ask_user");
    expect(getSuggestedRecoveryAction("invalid_input", 0)).toBe("ask_user");
  });
});

// ─────────────────────────────────────────────────────────────
// Retry Logic Tests
// ─────────────────────────────────────────────────────────────

describe("calculateRetryDelay", () => {
  it("should calculate exponential backoff", () => {
    const delay0 = calculateRetryDelay(0, { ...DEFAULT_RETRY_CONFIG, jitterFactor: 0 });
    const delay1 = calculateRetryDelay(1, { ...DEFAULT_RETRY_CONFIG, jitterFactor: 0 });
    const delay2 = calculateRetryDelay(2, { ...DEFAULT_RETRY_CONFIG, jitterFactor: 0 });

    expect(delay0).toBe(DEFAULT_RETRY_CONFIG.initialDelayMs);
    expect(delay1).toBe(DEFAULT_RETRY_CONFIG.initialDelayMs * DEFAULT_RETRY_CONFIG.backoffMultiplier);
    expect(delay2).toBe(DEFAULT_RETRY_CONFIG.initialDelayMs * Math.pow(DEFAULT_RETRY_CONFIG.backoffMultiplier, 2));
  });

  it("should cap at max delay", () => {
    const delay = calculateRetryDelay(10, { ...DEFAULT_RETRY_CONFIG, jitterFactor: 0 });
    expect(delay).toBe(DEFAULT_RETRY_CONFIG.maxDelayMs);
  });

  it("should use suggested delay when provided", () => {
    const delay = calculateRetryDelay(0, DEFAULT_RETRY_CONFIG, 5000);
    expect(delay).toBe(5000);
  });

  it("should cap suggested delay at max", () => {
    const delay = calculateRetryDelay(0, DEFAULT_RETRY_CONFIG, 100000);
    expect(delay).toBe(DEFAULT_RETRY_CONFIG.maxDelayMs);
  });
});

describe("isRetryableLLMError", () => {
  it("should return true for retryable errors", () => {
    expect(isRetryableLLMError({ code: "rate_limit", message: "Rate limited", retryable: true })).toBe(true);
    expect(isRetryableLLMError({ code: "timeout", message: "Timeout", retryable: false })).toBe(true); // Code takes precedence
    expect(isRetryableLLMError({ code: "model_overloaded", message: "Overloaded", retryable: false })).toBe(true);
  });

  it("should return false for non-retryable errors", () => {
    expect(isRetryableLLMError({ code: "auth_error", message: "Auth failed", retryable: false })).toBe(false);
    expect(isRetryableLLMError({ code: "content_filter", message: "Blocked", retryable: false })).toBe(false);
  });

  it("should use retryable flag as fallback", () => {
    expect(isRetryableLLMError({ code: "unknown", message: "Unknown", retryable: true })).toBe(true);
    expect(isRetryableLLMError({ code: "unknown", message: "Unknown", retryable: false })).toBe(false);
  });
});

describe("extractErrorDetails", () => {
  it("should extract details from Error", () => {
    const error = new Error("Something went wrong");
    const details = extractErrorDetails(error);

    expect(details.code).toBe("unknown");
    expect(details.message).toBe("Something went wrong");
  });

  it("should detect rate limit from message", () => {
    const error = new Error("Rate limit exceeded, please retry later");
    const details = extractErrorDetails(error);

    expect(details.code).toBe("rate_limit");
  });

  it("should detect timeout from message", () => {
    const error = new Error("Request timed out after 30s");
    const details = extractErrorDetails(error);

    expect(details.code).toBe("timeout");
  });

  it("should handle non-Error values", () => {
    const details = extractErrorDetails("String error");
    expect(details.code).toBe("unknown");
    expect(details.message).toBe("String error");
  });
});

describe("withRetry", () => {
  it("should return result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("success");

    const result = await withRetry(fn, { maxRetries: 3 });

    expect(result.success).toBe(true);
    expect(result.result).toBe("success");
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should retry on retryable error", async () => {
    const error = new Error("Rate limit exceeded");
    Object.assign(error, { status: 429 });

    const fn = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce("success");

    // Use minimal delays for fast testing
    const result = await withRetry(fn, { 
      maxRetries: 3, 
      initialDelayMs: 1, 
      maxDelayMs: 10,
      jitterFactor: 0 
    });

    expect(result.success).toBe(true);
    expect(result.result).toBe("success");
    expect(result.attempts).toBe(2);
  }, 10000);

  it("should stop retrying after max retries", async () => {
    const error = new Error("Rate limit exceeded");
    Object.assign(error, { status: 429 });

    const fn = vi.fn().mockRejectedValue(error);

    // Use minimal delays for fast testing
    const result = await withRetry(fn, { 
      maxRetries: 2, 
      initialDelayMs: 1,
      maxDelayMs: 10,
      jitterFactor: 0 
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3); // Initial + 2 retries
    expect(fn).toHaveBeenCalledTimes(3);
  }, 10000);

  it("should not retry non-retryable errors", async () => {
    const error = new Error("Invalid API key");
    Object.assign(error, { status: 401 });

    const fn = vi.fn().mockRejectedValue(error);

    const result = await withRetry(fn, { maxRetries: 3 });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

// ─────────────────────────────────────────────────────────────
// Configuration Tests
// ─────────────────────────────────────────────────────────────

describe("getDefaultLLMConfig", () => {
  it("should return valid config structure", () => {
    const config = getDefaultLLMConfig();

    expect(config).toHaveProperty("provider");
    expect(config).toHaveProperty("models");
    expect(config).toHaveProperty("defaultTemperature");
    expect(config).toHaveProperty("maxRetries");
    expect(config).toHaveProperty("timeout");

    expect(config.models).toHaveProperty("fast");
    expect(config.models).toHaveProperty("reasoning");
    expect(config.models).toHaveProperty("conversational");
  });

  it("should have reasonable default values", () => {
    const config = getDefaultLLMConfig();

    expect(config.defaultTemperature).toBeGreaterThanOrEqual(0);
    expect(config.defaultTemperature).toBeLessThanOrEqual(2);
    expect(config.maxRetries).toBeGreaterThanOrEqual(1);
    expect(config.timeout).toBeGreaterThan(0);
  });
});

describe("isProviderAvailable", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should detect OpenAI availability", () => {
    process.env.OPENAI_API_KEY = "test-key";
    expect(isProviderAvailable("openai")).toBe(true);
  });

  it("should detect Anthropic availability", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(isProviderAvailable("anthropic")).toBe(true);
  });

  it("should return false for missing keys", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(isProviderAvailable("openai")).toBe(false);
    expect(isProviderAvailable("anthropic")).toBe(false);
  });
});

describe("getAvailableProviders", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should return empty array when no providers available", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(getAvailableProviders()).toEqual([]);
  });

  it("should return available providers", () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.ANTHROPIC_API_KEY = "test-key";
    const providers = getAvailableProviders();
    expect(providers).toContain("openai");
    expect(providers).toContain("anthropic");
  });
});

