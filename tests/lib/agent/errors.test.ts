// ═══════════════════════════════════════════════════════════════════════════
// Agent Error Tests
// Tests for Agent Engine error classes
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  AgentError,
  AgentErrorCode,
  IntentUnclearError,
  ContextMissingError,
  ToolNotAvailableError,
  ApprovalTimeoutError,
  ToolExecutionFailedError,
  PlanFailedError,
  RateLimitExceededError,
  InvalidParametersError,
  LLMError,
  ContentBlockedError,
  EntityResolutionError,
  isAgentError,
  isRetryableError,
  needsClarification,
  needsIntegration,
  wrapError,
} from "@/lib/agent/errors";

describe("AgentError", () => {
  it("should create base error with all properties", () => {
    const error = new AgentError(
      AgentErrorCode.UNKNOWN,
      "Test error",
      true,
      5000,
      "User message",
      new Error("Original")
    );

    expect(error.code).toBe(AgentErrorCode.UNKNOWN);
    expect(error.message).toBe("Test error");
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBe(5000);
    expect(error.userMessage).toBe("User message");
    expect(error.originalError).toBeInstanceOf(Error);
    expect(error.name).toBe("AgentError");
  });

  it("should convert to string with retry info", () => {
    const error = new AgentError(AgentErrorCode.UNKNOWN, "Test", true, 5000);
    expect(error.toString()).toBe(
      "AgentError [UNKNOWN]: Test (retryable after 5000ms)"
    );
  });

  it("should convert to JSON safely", () => {
    const error = new AgentError(
      AgentErrorCode.UNKNOWN,
      "Test",
      true,
      5000,
      "User msg"
    );
    const json = error.toJSON();

    expect(json).toEqual({
      name: "AgentError",
      code: AgentErrorCode.UNKNOWN,
      message: "Test",
      userMessage: "User msg",
      retryable: true,
      retryAfterMs: 5000,
    });
  });

  it("should return user message when available", () => {
    const error = new AgentError(
      AgentErrorCode.UNKNOWN,
      "Internal error",
      false,
      undefined,
      "Friendly message"
    );
    expect(error.getUserMessage()).toBe("Friendly message");
  });

  it("should fall back to message when no user message", () => {
    const error = new AgentError(AgentErrorCode.UNKNOWN, "Internal error");
    expect(error.getUserMessage()).toBe("Internal error");
  });
});

describe("IntentUnclearError", () => {
  it("should create with clarification questions", () => {
    const error = new IntentUnclearError(
      "Could not understand intent",
      ["What do you mean by 'it'?", "Which project?"],
      0.3
    );

    expect(error.code).toBe(AgentErrorCode.INTENT_UNCLEAR);
    expect(error.clarificationQuestions).toHaveLength(2);
    expect(error.confidence).toBe(0.3);
    expect(error.retryable).toBe(false);
    expect(error.name).toBe("IntentUnclearError");
  });

  it("should include clarification questions in JSON", () => {
    const error = new IntentUnclearError("Unclear", ["Question 1"], 0.5);
    const json = error.toJSON();

    expect(json.clarificationQuestions).toEqual(["Question 1"]);
    expect(json.confidence).toBe(0.5);
  });
});

describe("ContextMissingError", () => {
  it("should create with missing context types", () => {
    const error = new ContextMissingError(
      "Missing calendar context",
      ["calendar", "contacts"],
      "Please connect your Google Calendar"
    );

    expect(error.code).toBe(AgentErrorCode.CONTEXT_MISSING);
    expect(error.missingContextTypes).toEqual(["calendar", "contacts"]);
    expect(error.suggestion).toBe("Please connect your Google Calendar");
    expect(error.name).toBe("ContextMissingError");
  });
});

describe("ToolNotAvailableError", () => {
  it("should create for unregistered tool", () => {
    const error = new ToolNotAvailableError(
      "Tool not found",
      "send_slack",
      "not_registered"
    );

    expect(error.code).toBe(AgentErrorCode.TOOL_NOT_AVAILABLE);
    expect(error.toolName).toBe("send_slack");
    expect(error.reason).toBe("not_registered");
    expect(error.name).toBe("ToolNotAvailableError");
  });

  it("should create for disconnected integration", () => {
    const error = new ToolNotAvailableError(
      "Gmail not connected",
      "send_email",
      "integration_not_connected",
      "Gmail"
    );

    expect(error.reason).toBe("integration_not_connected");
    expect(error.requiredIntegration).toBe("Gmail");
    expect(error.getUserMessage()).toContain("Gmail");
  });
});

describe("ApprovalTimeoutError", () => {
  it("should create with expiration info", () => {
    const expiresAt = new Date(Date.now() + 3600000);
    const error = new ApprovalTimeoutError(
      "Approval expired",
      "action_123",
      "send_email",
      expiresAt
    );

    expect(error.code).toBe(AgentErrorCode.APPROVAL_TIMEOUT);
    expect(error.actionId).toBe("action_123");
    expect(error.toolName).toBe("send_email");
    expect(error.expiresAt).toEqual(expiresAt);
    expect(error.retryable).toBe(true);
    expect(error.name).toBe("ApprovalTimeoutError");
  });
});

describe("ToolExecutionFailedError", () => {
  it("should create with execution details", () => {
    const error = new ToolExecutionFailedError(
      "Failed to send email",
      "send_email",
      { to: "test@example.com" },
      "Rate limit exceeded",
      true
    );

    expect(error.code).toBe(AgentErrorCode.TOOL_EXECUTION_FAILED);
    expect(error.toolName).toBe("send_email");
    expect(error.toolParams).toEqual({ to: "test@example.com" });
    expect(error.executionError).toBe("Rate limit exceeded");
    expect(error.canRetry).toBe(true);
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBe(5000);
    expect(error.name).toBe("ToolExecutionFailedError");
  });

  it("should not include toolParams in JSON for security", () => {
    const error = new ToolExecutionFailedError(
      "Failed",
      "send_email",
      { password: "secret" },
      "Error",
      false
    );
    const json = error.toJSON();

    expect(json.toolParams).toBeUndefined();
    expect(json.toolName).toBe("send_email");
  });
});

describe("PlanFailedError", () => {
  it("should create with plan failure details", () => {
    const error = new PlanFailedError(
      "Plan failed at step 2",
      "plan_123",
      2,
      "send_email",
      "Rate limit",
      2,
      5,
      true,
      false
    );

    expect(error.code).toBe(AgentErrorCode.PLAN_FAILED);
    expect(error.planId).toBe("plan_123");
    expect(error.failedStepIndex).toBe(2);
    expect(error.failedToolName).toBe("send_email");
    expect(error.completedSteps).toBe(2);
    expect(error.totalSteps).toBe(5);
    expect(error.canRollback).toBe(true);
    expect(error.rolledBack).toBe(false);
    expect(error.retryable).toBe(false);
    expect(error.name).toBe("PlanFailedError");
  });

  it("should have different message when rolled back", () => {
    const error = new PlanFailedError(
      "Plan failed",
      "plan_123",
      2,
      "send_email",
      "Error",
      2,
      5,
      true,
      true
    );

    expect(error.getUserMessage()).toContain("undone the previous steps");
  });
});

describe("RateLimitExceededError", () => {
  it("should calculate retry time", () => {
    const resetAt = new Date(Date.now() + 120000); // 2 minutes from now
    const error = new RateLimitExceededError(
      "Rate limit exceeded",
      "chat",
      20,
      60000,
      resetAt
    );

    expect(error.code).toBe(AgentErrorCode.RATE_LIMIT_EXCEEDED);
    expect(error.limitType).toBe("chat");
    expect(error.limit).toBe(20);
    expect(error.windowMs).toBe(60000);
    expect(error.retryable).toBe(true);
    expect(error.retryAfterMs).toBeGreaterThan(0);
    expect(error.getUserMessage()).toContain("minute");
    expect(error.name).toBe("RateLimitExceededError");
  });
});

describe("InvalidParametersError", () => {
  it("should create with validation errors", () => {
    const error = new InvalidParametersError("Invalid params", "send_email", [
      { field: "to", message: "Required" },
      { field: "subject", message: "Too long", code: "max_length" },
    ]);

    expect(error.code).toBe(AgentErrorCode.INVALID_PARAMETERS);
    expect(error.toolName).toBe("send_email");
    expect(error.validationErrors).toHaveLength(2);
    expect(error.name).toBe("InvalidParametersError");
  });
});

describe("LLMError", () => {
  it("should create for timeout", () => {
    const error = new LLMError(
      "Request timed out",
      "openai",
      "gpt-4o",
      true,
      true
    );

    expect(error.code).toBe(AgentErrorCode.LLM_TIMEOUT);
    expect(error.provider).toBe("openai");
    expect(error.model).toBe("gpt-4o");
    expect(error.isTimeout).toBe(true);
    expect(error.retryable).toBe(true);
    expect(error.name).toBe("LLMError");
  });

  it("should create for non-timeout error", () => {
    const error = new LLMError(
      "API error",
      "anthropic",
      "claude-3",
      false,
      true
    );

    expect(error.code).toBe(AgentErrorCode.LLM_ERROR);
    expect(error.isTimeout).toBe(false);
  });
});

describe("ContentBlockedError", () => {
  it("should create for input blocking", () => {
    const error = new ContentBlockedError(
      "Content blocked",
      ["harmful_content", "violence"],
      true
    );

    expect(error.code).toBe(AgentErrorCode.CONTENT_BLOCKED);
    expect(error.blockedReasons).toEqual(["harmful_content", "violence"]);
    expect(error.isInput).toBe(true);
    expect(error.getUserMessage()).toContain("not able to help");
    expect(error.name).toBe("ContentBlockedError");
  });

  it("should have different message for output blocking", () => {
    const error = new ContentBlockedError("Blocked", ["test"], false);
    expect(error.getUserMessage()).toContain("unable to generate");
  });
});

describe("EntityResolutionError", () => {
  it("should create with candidates", () => {
    const error = new EntityResolutionError("Ambiguous", "person", "Sarah", [
      { id: "1", name: "Sarah Chen", confidence: 0.8 },
      { id: "2", name: "Sarah Johnson", confidence: 0.7 },
    ]);

    expect(error.code).toBe(AgentErrorCode.ENTITY_RESOLUTION_FAILED);
    expect(error.entityType).toBe("person");
    expect(error.entityText).toBe("Sarah");
    expect(error.candidates).toHaveLength(2);
    expect(error.getUserMessage()).toContain("multiple matches");
    expect(error.name).toBe("EntityResolutionError");
  });

  it("should have different message when no candidates", () => {
    const error = new EntityResolutionError("Not found", "person", "Xyz", []);
    expect(error.getUserMessage()).toContain("couldn't find");
  });

  it("should have verification message for single candidate", () => {
    const error = new EntityResolutionError("Low confidence", "person", "John", [
      { id: "1", name: "John Smith", confidence: 0.6 },
    ]);
    expect(error.getUserMessage()).toContain("found");
    expect(error.getUserMessage()).toContain("verify");
    expect(error.getUserMessage()).not.toContain("couldn't find");
    expect(error.getUserMessage()).not.toContain("multiple");
  });
});

describe("Error utility functions", () => {
  describe("isAgentError", () => {
    it("should return true for AgentError", () => {
      const error = new AgentError(AgentErrorCode.UNKNOWN, "Test");
      expect(isAgentError(error)).toBe(true);
    });

    it("should return true for subclasses", () => {
      const error = new IntentUnclearError("Test");
      expect(isAgentError(error)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const error = new Error("Test");
      expect(isAgentError(error)).toBe(false);
    });

    it("should return false for non-errors", () => {
      expect(isAgentError("string")).toBe(false);
      expect(isAgentError(null)).toBe(false);
      expect(isAgentError(undefined)).toBe(false);
    });
  });

  describe("isRetryableError", () => {
    it("should return true for retryable errors", () => {
      const error = new RateLimitExceededError(
        "Rate limited",
        "chat",
        20,
        60000,
        new Date(Date.now() + 60000)
      );
      expect(isRetryableError(error)).toBe(true);
    });

    it("should return false for non-retryable errors", () => {
      const error = new IntentUnclearError("Unclear");
      expect(isRetryableError(error)).toBe(false);
    });

    it("should return false for non-AgentErrors", () => {
      expect(isRetryableError(new Error("Test"))).toBe(false);
    });
  });

  describe("needsClarification", () => {
    it("should return true for IntentUnclearError", () => {
      const error = new IntentUnclearError("Unclear", ["Question?"]);
      expect(needsClarification(error)).toBe(true);
    });

    it("should return false for other errors", () => {
      const error = new AgentError(AgentErrorCode.UNKNOWN, "Test");
      expect(needsClarification(error)).toBe(false);
    });
  });

  describe("needsIntegration", () => {
    it("should return true for integration not connected", () => {
      const error = new ToolNotAvailableError(
        "Gmail not connected",
        "send_email",
        "integration_not_connected",
        "Gmail"
      );
      expect(needsIntegration(error)).toBe(true);
    });

    it("should return false for other ToolNotAvailable reasons", () => {
      const error = new ToolNotAvailableError(
        "Not registered",
        "custom_tool",
        "not_registered"
      );
      expect(needsIntegration(error)).toBe(false);
    });
  });

  describe("wrapError", () => {
    it("should return AgentError as-is", () => {
      const original = new IntentUnclearError("Test");
      const wrapped = wrapError(original);
      expect(wrapped).toBe(original);
    });

    it("should wrap regular Error", () => {
      const original = new Error("Original error");
      const wrapped = wrapError(original, "Context");

      expect(wrapped.code).toBe(AgentErrorCode.UNKNOWN);
      expect(wrapped.message).toBe("Context: Original error");
      expect(wrapped.originalError).toBe(original);
    });

    it("should wrap string error", () => {
      const wrapped = wrapError("String error");
      expect(wrapped.message).toBe("String error");
    });
  });
});

