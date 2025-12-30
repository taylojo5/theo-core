// ═══════════════════════════════════════════════════════════════════════════
// Plan State, Recovery & Rollback Tests
// Tests for plan state management, failure recovery, and rollback handling
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";
import { PLAN_STATUS, STEP_STATUS } from "@/lib/agent/constants";
import type { StructuredPlan, StructuredStep } from "@/lib/agent/planning/types";

// ─────────────────────────────────────────────────────────────
// Mock Data Factories
// ─────────────────────────────────────────────────────────────

function createMockStep(overrides: Partial<StructuredStep> = {}): StructuredStep {
  return {
    id: `step-${Math.random().toString(36).slice(2, 9)}`,
    planId: "plan-123",
    index: 0,
    toolName: "query_context",
    parameters: { query: "test" },
    dependsOn: [],
    dependsOnIndices: [],
    description: "Test step",
    status: STEP_STATUS.PENDING,
    requiresApproval: false,
    createdAt: new Date(),
    ...overrides,
  };
}

function createMockPlan(overrides: Partial<StructuredPlan> = {}): StructuredPlan {
  const steps = overrides.steps || [
    createMockStep({ index: 0, id: "step-1" }),
    createMockStep({ index: 1, id: "step-2" }),
    createMockStep({ index: 2, id: "step-3" }),
  ];

  return {
    id: "plan-123",
    userId: "user-456",
    goal: "Test plan goal",
    goalType: "test",
    status: PLAN_STATUS.PLANNED,
    steps,
    currentStepIndex: 0,
    requiresApproval: false,
    reasoning: "Test reasoning",
    assumptions: [],
    confidence: 0.8,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// State Module Tests
// ─────────────────────────────────────────────────────────────

describe("Plan State Management", () => {
  describe("State Mapping", () => {
    it("should correctly identify completed steps count", async () => {
      // Import directly to test mapping functions indirectly through public API
      const { getNextExecutableStep } = await import("@/lib/agent/planning/state");

      const plan = createMockPlan({
        steps: [
          createMockStep({ index: 0, status: STEP_STATUS.COMPLETED, id: "step-1" }),
          createMockStep({ index: 1, status: STEP_STATUS.PENDING, id: "step-2" }),
          createMockStep({ index: 2, status: STEP_STATUS.PENDING, id: "step-3" }),
        ],
        currentStepIndex: 1,
      });

      const nextStep = getNextExecutableStep(plan);
      expect(nextStep).toBeDefined();
      expect(nextStep?.index).toBe(1);
    });

    it("should identify step awaiting approval", async () => {
      const { getStepAwaitingApproval } = await import("@/lib/agent/planning/state");

      const plan = createMockPlan({
        steps: [
          createMockStep({ index: 0, status: STEP_STATUS.COMPLETED, id: "step-1" }),
          createMockStep({
            index: 1,
            status: STEP_STATUS.AWAITING_APPROVAL,
            approvalId: "approval-123",
            id: "step-2",
          }),
          createMockStep({ index: 2, status: STEP_STATUS.PENDING, id: "step-3" }),
        ],
      });

      const awaitingStep = getStepAwaitingApproval(plan);
      expect(awaitingStep).toBeDefined();
      expect(awaitingStep?.approvalId).toBe("approval-123");
    });

    it("should return undefined when no step awaiting approval", async () => {
      const { getStepAwaitingApproval } = await import("@/lib/agent/planning/state");

      const plan = createMockPlan();
      const awaitingStep = getStepAwaitingApproval(plan);
      expect(awaitingStep).toBeUndefined();
    });
  });

  describe("getRollbackableSteps", () => {
    it("should return completed steps with rollback actions in reverse order", async () => {
      const { getRollbackableSteps } = await import("@/lib/agent/planning/state");

      const plan = createMockPlan({
        steps: [
          createMockStep({
            index: 0,
            status: STEP_STATUS.COMPLETED,
            rollbackAction: { toolName: "delete_task", parameters: { id: "1" } },
            id: "step-1",
          }),
          createMockStep({
            index: 1,
            status: STEP_STATUS.COMPLETED,
            rollbackAction: { toolName: "delete_event", parameters: { id: "2" } },
            id: "step-2",
          }),
          createMockStep({ index: 2, status: STEP_STATUS.PENDING, id: "step-3" }),
        ],
      });

      const rollbackable = getRollbackableSteps(plan);
      expect(rollbackable).toHaveLength(2);
      // Should be in reverse order
      expect(rollbackable[0].index).toBe(1);
      expect(rollbackable[1].index).toBe(0);
    });

    it("should not include completed steps without rollback actions", async () => {
      const { getRollbackableSteps } = await import("@/lib/agent/planning/state");

      const plan = createMockPlan({
        steps: [
          createMockStep({ index: 0, status: STEP_STATUS.COMPLETED, id: "step-1" }),
          createMockStep({
            index: 1,
            status: STEP_STATUS.COMPLETED,
            rollbackAction: { toolName: "delete_task", parameters: { id: "1" } },
            id: "step-2",
          }),
        ],
      });

      const rollbackable = getRollbackableSteps(plan);
      expect(rollbackable).toHaveLength(1);
      expect(rollbackable[0].index).toBe(1);
    });
  });

  describe("canPlanContinue", () => {
    it("should return true for executing plan with pending steps", async () => {
      const { canPlanContinue } = await import("@/lib/agent/planning/state");

      const plan = createMockPlan({
        status: PLAN_STATUS.EXECUTING,
        steps: [
          createMockStep({ index: 0, status: STEP_STATUS.COMPLETED }),
          createMockStep({ index: 1, status: STEP_STATUS.PENDING }),
        ],
      });

      expect(canPlanContinue(plan)).toBe(true);
    });

    it("should return true for paused plan with approval step", async () => {
      const { canPlanContinue } = await import("@/lib/agent/planning/state");

      const plan = createMockPlan({
        status: PLAN_STATUS.PAUSED,
        steps: [
          createMockStep({ index: 0, status: STEP_STATUS.COMPLETED }),
          createMockStep({ index: 1, status: STEP_STATUS.AWAITING_APPROVAL }),
        ],
      });

      expect(canPlanContinue(plan)).toBe(true);
    });

    it("should return false for completed plan", async () => {
      const { canPlanContinue } = await import("@/lib/agent/planning/state");

      const plan = createMockPlan({
        status: PLAN_STATUS.COMPLETED,
        steps: [
          createMockStep({ index: 0, status: STEP_STATUS.COMPLETED }),
        ],
      });

      expect(canPlanContinue(plan)).toBe(false);
    });

    it("should return false for executing plan with all steps done", async () => {
      const { canPlanContinue } = await import("@/lib/agent/planning/state");

      const plan = createMockPlan({
        status: PLAN_STATUS.EXECUTING,
        steps: [
          createMockStep({ index: 0, status: STEP_STATUS.COMPLETED }),
          createMockStep({ index: 1, status: STEP_STATUS.COMPLETED }),
        ],
      });

      expect(canPlanContinue(plan)).toBe(false);
    });
  });

  describe("getNextExecutableStep", () => {
    it("should skip steps with unmet dependencies", async () => {
      const { getNextExecutableStep } = await import("@/lib/agent/planning/state");

      const plan = createMockPlan({
        currentStepIndex: 0,
        steps: [
          createMockStep({
            index: 0,
            status: STEP_STATUS.PENDING,
            id: "step-1",
            dependsOn: ["step-0-missing"], // Dependency not met
          }),
          createMockStep({
            index: 1,
            status: STEP_STATUS.PENDING,
            id: "step-2",
            dependsOn: [], // No dependencies
          }),
        ],
      });

      const nextStep = getNextExecutableStep(plan);
      expect(nextStep).toBeDefined();
      expect(nextStep?.index).toBe(1);
    });

    it("should return step with met dependencies", async () => {
      const { getNextExecutableStep } = await import("@/lib/agent/planning/state");

      const plan = createMockPlan({
        currentStepIndex: 1,
        steps: [
          createMockStep({
            index: 0,
            status: STEP_STATUS.COMPLETED,
            id: "step-1",
          }),
          createMockStep({
            index: 1,
            status: STEP_STATUS.PENDING,
            id: "step-2",
            dependsOn: ["step-1"], // Dependency met
          }),
        ],
      });

      const nextStep = getNextExecutableStep(plan);
      expect(nextStep).toBeDefined();
      expect(nextStep?.index).toBe(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Recovery Module Tests
// ─────────────────────────────────────────────────────────────

describe("Plan Recovery", () => {
  describe("classifyError", () => {
    it("should classify rate limit errors", async () => {
      const { classifyError } = await import("@/lib/agent/planning/recovery");

      expect(classifyError("Rate limit exceeded")).toBe("rate_limit");
      expect(classifyError("Too many requests, please try again")).toBe("rate_limit");
      expect(classifyError("HTTP 429 error")).toBe("rate_limit");
    });

    it("should classify timeout errors", async () => {
      const { classifyError } = await import("@/lib/agent/planning/recovery");

      expect(classifyError("Request timeout")).toBe("timeout");
      expect(classifyError("Connection timed out")).toBe("timeout");
      expect(classifyError("Deadline exceeded")).toBe("timeout");
    });

    it("should classify network errors", async () => {
      const { classifyError } = await import("@/lib/agent/planning/recovery");

      expect(classifyError("Network error occurred")).toBe("network_error");
      expect(classifyError("ECONNREFUSED")).toBe("network_error");
      expect(classifyError("Connection refused")).toBe("network_error");
    });

    it("should classify authentication errors", async () => {
      const { classifyError } = await import("@/lib/agent/planning/recovery");

      expect(classifyError("Authentication failed")).toBe("authentication");
      expect(classifyError("401 Unauthorized")).toBe("authentication");
    });

    it("should classify permission errors", async () => {
      const { classifyError } = await import("@/lib/agent/planning/recovery");

      expect(classifyError("Permission denied")).toBe("permission");
      expect(classifyError("403 Forbidden")).toBe("permission");
    });

    it("should classify validation errors", async () => {
      const { classifyError } = await import("@/lib/agent/planning/recovery");

      expect(classifyError("Validation failed")).toBe("validation");
      expect(classifyError("Invalid parameter")).toBe("validation");
      expect(classifyError("400 Bad request")).toBe("validation");
    });

    it("should classify not found errors", async () => {
      const { classifyError } = await import("@/lib/agent/planning/recovery");

      expect(classifyError("Resource not found")).toBe("not_found");
      expect(classifyError("404 error")).toBe("not_found");
    });

    it("should classify conflict errors", async () => {
      const { classifyError } = await import("@/lib/agent/planning/recovery");

      expect(classifyError("Conflict detected")).toBe("conflict");
      expect(classifyError("Resource already exists")).toBe("conflict");
    });

    it("should return unknown for unrecognized errors", async () => {
      const { classifyError } = await import("@/lib/agent/planning/recovery");

      expect(classifyError("Some random error")).toBe("unknown");
      expect(classifyError("")).toBe("unknown");
    });
  });

  describe("createStepFailure", () => {
    it("should create a step failure with correct classification", async () => {
      const { createStepFailure } = await import("@/lib/agent/planning/recovery");

      const step = createMockStep();
      const failure = createStepFailure(step, "Rate limit exceeded", 2);

      expect(failure.step).toBe(step);
      expect(failure.error).toBe("Rate limit exceeded");
      expect(failure.errorType).toBe("rate_limit");
      expect(failure.retryCount).toBe(2);
      expect(failure.failedAt).toBeInstanceOf(Date);
    });

    it("should default retry count to 0", async () => {
      const { createStepFailure } = await import("@/lib/agent/planning/recovery");

      const step = createMockStep();
      const failure = createStepFailure(step, "Some error");

      expect(failure.retryCount).toBe(0);
    });
  });

  describe("determineRecoveryAction (heuristic)", () => {
    it("should suggest retry for transient errors", async () => {
      const { determineRecoveryAction, createStepFailure } = await import(
        "@/lib/agent/planning/recovery"
      );

      const plan = createMockPlan();
      const step = createMockStep();
      const failure = createStepFailure(step, "Rate limit exceeded", 0);

      const action = await determineRecoveryAction(plan, failure, {
        useLLMRecovery: false,
      });

      expect(action.action).toBe("retry");
    });

    it("should suggest ask_user after max retries", async () => {
      const { determineRecoveryAction, createStepFailure } = await import(
        "@/lib/agent/planning/recovery"
      );

      const plan = createMockPlan();
      const step = createMockStep();
      const failure = createStepFailure(step, "Rate limit exceeded", 3);

      const action = await determineRecoveryAction(plan, failure, {
        useLLMRecovery: false,
        maxRetries: 3,
      });

      expect(action.action).toBe("ask_user");
      expect(action.reasoning).toContain("Maximum retry attempts");
    });

    it("should respect alwaysAskUser option", async () => {
      const { determineRecoveryAction, createStepFailure } = await import(
        "@/lib/agent/planning/recovery"
      );

      const plan = createMockPlan();
      const step = createMockStep();
      const failure = createStepFailure(step, "Rate limit exceeded", 0);

      const action = await determineRecoveryAction(plan, failure, {
        alwaysAskUser: true,
      });

      expect(action.action).toBe("ask_user");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Rollback Module Tests
// ─────────────────────────────────────────────────────────────

describe("Plan Rollback", () => {
  describe("analyzeRollbackForPlan", () => {
    it("should identify rollbackable steps", async () => {
      const { analyzeRollbackForPlan } = await import("@/lib/agent/planning/rollback");

      const plan = createMockPlan({
        steps: [
          createMockStep({
            index: 0,
            status: STEP_STATUS.COMPLETED,
            rollbackAction: { toolName: "delete_task", parameters: { id: "1" } },
            id: "step-1",
          }),
          createMockStep({
            index: 1,
            status: STEP_STATUS.COMPLETED,
            id: "step-2",
            // No rollback action
          }),
        ],
      });

      const analysis = analyzeRollbackForPlan(plan);

      expect(analysis.canRollback).toBe(true);
      expect(analysis.rollbackableSteps).toHaveLength(1);
      expect(analysis.nonRollbackableSteps).toHaveLength(1);
    });

    it("should return canRollback false when no rollbackable steps", async () => {
      const { analyzeRollbackForPlan } = await import("@/lib/agent/planning/rollback");

      const plan = createMockPlan({
        steps: [
          createMockStep({ index: 0, status: STEP_STATUS.COMPLETED, id: "step-1" }),
          createMockStep({ index: 1, status: STEP_STATUS.COMPLETED, id: "step-2" }),
        ],
      });

      const analysis = analyzeRollbackForPlan(plan);

      expect(analysis.canRollback).toBe(false);
      expect(analysis.effort).toBe("none");
    });

    it("should calculate effort levels correctly", async () => {
      const { analyzeRollbackForPlan } = await import("@/lib/agent/planning/rollback");

      // 100% rollbackable = minimal
      const planMinimal = createMockPlan({
        steps: [
          createMockStep({
            index: 0,
            status: STEP_STATUS.COMPLETED,
            rollbackAction: { toolName: "undo", parameters: {} },
          }),
        ],
      });
      expect(analyzeRollbackForPlan(planMinimal).effort).toBe("minimal");

      // 50% rollbackable = moderate
      const planModerate = createMockPlan({
        steps: [
          createMockStep({
            index: 0,
            status: STEP_STATUS.COMPLETED,
            rollbackAction: { toolName: "undo", parameters: {} },
          }),
          createMockStep({ index: 1, status: STEP_STATUS.COMPLETED }),
        ],
      });
      expect(analyzeRollbackForPlan(planModerate).effort).toBe("moderate");

      // < 50% rollbackable = significant
      const planSignificant = createMockPlan({
        steps: [
          createMockStep({
            index: 0,
            status: STEP_STATUS.COMPLETED,
            rollbackAction: { toolName: "undo", parameters: {} },
          }),
          createMockStep({ index: 1, status: STEP_STATUS.COMPLETED }),
          createMockStep({ index: 2, status: STEP_STATUS.COMPLETED }),
        ],
      });
      expect(analyzeRollbackForPlan(planSignificant).effort).toBe("significant");
    });
  });

  describe("canFullyRollback", () => {
    it("should return true when all completed steps have rollback actions", async () => {
      const { canFullyRollback } = await import("@/lib/agent/planning/rollback");

      const plan = createMockPlan({
        steps: [
          createMockStep({
            index: 0,
            status: STEP_STATUS.COMPLETED,
            rollbackAction: { toolName: "undo", parameters: {} },
          }),
          createMockStep({ index: 1, status: STEP_STATUS.PENDING }),
        ],
      });

      expect(canFullyRollback(plan)).toBe(true);
    });

    it("should return false when some completed steps lack rollback actions", async () => {
      const { canFullyRollback } = await import("@/lib/agent/planning/rollback");

      const plan = createMockPlan({
        steps: [
          createMockStep({
            index: 0,
            status: STEP_STATUS.COMPLETED,
            rollbackAction: { toolName: "undo", parameters: {} },
          }),
          createMockStep({ index: 1, status: STEP_STATUS.COMPLETED }),
        ],
      });

      expect(canFullyRollback(plan)).toBe(false);
    });

    it("should return true when no steps are completed", async () => {
      const { canFullyRollback } = await import("@/lib/agent/planning/rollback");

      const plan = createMockPlan({
        steps: [
          createMockStep({ index: 0, status: STEP_STATUS.PENDING }),
          createMockStep({ index: 1, status: STEP_STATUS.PENDING }),
        ],
      });

      expect(canFullyRollback(plan)).toBe(true);
    });
  });

  describe("hasRollbackableSteps", () => {
    it("should return true when there are rollbackable steps", async () => {
      const { hasRollbackableSteps } = await import("@/lib/agent/planning/rollback");

      const plan = createMockPlan({
        steps: [
          createMockStep({
            index: 0,
            status: STEP_STATUS.COMPLETED,
            rollbackAction: { toolName: "undo", parameters: {} },
          }),
        ],
      });

      expect(hasRollbackableSteps(plan)).toBe(true);
    });

    it("should return false when there are no rollbackable steps", async () => {
      const { hasRollbackableSteps } = await import("@/lib/agent/planning/rollback");

      const plan = createMockPlan({
        steps: [
          createMockStep({ index: 0, status: STEP_STATUS.COMPLETED }),
          createMockStep({ index: 1, status: STEP_STATUS.PENDING }),
        ],
      });

      expect(hasRollbackableSteps(plan)).toBe(false);
    });
  });

  describe("Rollback Action Helpers", () => {
    it("should create delete rollback action", async () => {
      const { createDeleteRollback } = await import("@/lib/agent/planning/rollback");

      const rollback = createDeleteRollback("delete_task", "taskId", "id");

      expect(rollback.toolName).toBe("delete_task");
      expect(rollback.parameters).toEqual({ taskId: "{{result.id}}" });
    });

    it("should get standard rollback for known tools", async () => {
      const { getStandardRollback } = await import("@/lib/agent/planning/rollback");

      const rollback = getStandardRollback("create_calendar_event");

      expect(rollback).toBeDefined();
      expect(rollback?.toolName).toBe("delete_calendar_event");
    });

    it("should return undefined for unknown tools", async () => {
      const { getStandardRollback } = await import("@/lib/agent/planning/rollback");

      const rollback = getStandardRollback("some_unknown_tool");

      expect(rollback).toBeUndefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// LLM Recovery Integration Tests
// ─────────────────────────────────────────────────────────────

describe("LLM-Based Recovery", () => {
  // Mock LLM Client factory
  function createMockLLMClient(recoveryResponse: {
    action: "retry" | "skip" | "abort" | "ask_user" | "rollback";
    reasoning: string;
    confidence: number;
    modifiedParameters?: Record<string, unknown>;
    userMessage?: string;
  }) {
    return {
      decideRecovery: vi.fn().mockResolvedValue(recoveryResponse),
      // Other methods not needed for these tests
      classify: vi.fn(),
      generatePlan: vi.fn(),
      generateResponse: vi.fn(),
      complete: vi.fn(),
      streamComplete: vi.fn(),
      getProvider: vi.fn().mockReturnValue("openai"),
      getModel: vi.fn().mockReturnValue("gpt-4"),
    };
  }

  it("should use LLM for recovery decision when client is provided", async () => {
    const {
      createStepFailure,
      determineRecoveryAction,
    } = await import("@/lib/agent/planning/recovery");

    const plan = createMockPlan({
      status: PLAN_STATUS.EXECUTING,
      steps: [
        createMockStep({ index: 0, status: STEP_STATUS.FAILED }),
      ],
    });

    const mockLLMClient = createMockLLMClient({
      action: "retry",
      reasoning: "This appears to be a temporary issue. Retrying should work.",
      confidence: 0.85,
      modifiedParameters: { timeout: 30000 },
    });

    const failure = createStepFailure(plan.steps[0], "Connection timeout", 0);

    const action = await determineRecoveryAction(plan, failure, {
      llmClient: mockLLMClient as unknown as import("@/lib/agent/llm/types").LLMClient,
      useLLMRecovery: true,
    });

    // Verify LLM was called
    expect(mockLLMClient.decideRecovery).toHaveBeenCalledTimes(1);
    
    // Verify the request structure
    const request = mockLLMClient.decideRecovery.mock.calls[0][0];
    expect(request.plan.goal).toBe(plan.goal);
    expect(request.failure.stepIndex).toBe(0);
    expect(request.failure.error).toBe("Connection timeout");
    expect(request.retryCount).toBe(0);

    // Should return LLM's decision
    expect(action.action).toBe("retry");
    expect(action.reasoning).toBe("This appears to be a temporary issue. Retrying should work.");
    expect(action.confidence).toBe(0.85);
    expect(action.modifiedParameters).toEqual({ timeout: 30000 });
  });

  it("should override LLM retry suggestion when max retries exceeded", async () => {
    const {
      createStepFailure,
      determineRecoveryAction,
    } = await import("@/lib/agent/planning/recovery");

    const plan = createMockPlan({
      status: PLAN_STATUS.EXECUTING,
      steps: [createMockStep({ index: 0, status: STEP_STATUS.FAILED })],
    });

    const mockLLMClient = createMockLLMClient({
      action: "retry",
      reasoning: "Try again",
      confidence: 0.9,
    });

    // Failure with max retries already hit
    const failure = createStepFailure(plan.steps[0], "Rate limit exceeded", 3);

    const action = await determineRecoveryAction(plan, failure, {
      llmClient: mockLLMClient as unknown as import("@/lib/agent/llm/types").LLMClient,
      useLLMRecovery: true,
      maxRetries: 3,
    });

    // Should override LLM's retry suggestion
    expect(action.action).toBe("ask_user");
    expect(action.reasoning).toContain("Maximum retry attempts");
  });

  it("should fallback to heuristics when LLM fails", async () => {
    const {
      createStepFailure,
      determineRecoveryAction,
    } = await import("@/lib/agent/planning/recovery");

    const plan = createMockPlan({
      status: PLAN_STATUS.EXECUTING,
      steps: [createMockStep({ index: 0, status: STEP_STATUS.FAILED })],
    });

    const mockLLMClient = {
      decideRecovery: vi.fn().mockRejectedValue(new Error("LLM service unavailable")),
      classify: vi.fn(),
      generatePlan: vi.fn(),
      generateResponse: vi.fn(),
      complete: vi.fn(),
      streamComplete: vi.fn(),
      getProvider: vi.fn().mockReturnValue("openai"),
      getModel: vi.fn().mockReturnValue("gpt-4"),
    };

    // Transient error that heuristics would retry
    const failure = createStepFailure(plan.steps[0], "Rate limit exceeded", 0);

    const action = await determineRecoveryAction(plan, failure, {
      llmClient: mockLLMClient as unknown as import("@/lib/agent/llm/types").LLMClient,
      useLLMRecovery: true,
    });

    // Should fallback to heuristic decision (retry for rate limit)
    expect(mockLLMClient.decideRecovery).toHaveBeenCalled();
    expect(action.action).toBe("retry");
  });

  it("should use LLM's skip decision for non-critical failures", async () => {
    const {
      createStepFailure,
      determineRecoveryAction,
    } = await import("@/lib/agent/planning/recovery");

    const plan = createMockPlan({
      status: PLAN_STATUS.EXECUTING,
      steps: [
        createMockStep({ index: 0, status: STEP_STATUS.COMPLETED }),
        createMockStep({ index: 1, status: STEP_STATUS.FAILED }),
        createMockStep({ index: 2, status: STEP_STATUS.PENDING }),
      ],
    });

    const mockLLMClient = createMockLLMClient({
      action: "skip",
      reasoning: "This step is optional for the goal. Skipping to continue.",
      confidence: 0.75,
    });

    const failure = createStepFailure(plan.steps[1], "Resource not found", 0);

    const action = await determineRecoveryAction(plan, failure, {
      llmClient: mockLLMClient as unknown as import("@/lib/agent/llm/types").LLMClient,
      useLLMRecovery: true,
    });

    expect(action.action).toBe("skip");
    expect(action.reasoning).toContain("optional for the goal");
  });

  it("should use LLM's rollback decision for critical failures", async () => {
    const {
      createStepFailure,
      determineRecoveryAction,
    } = await import("@/lib/agent/planning/recovery");

    const plan = createMockPlan({
      status: PLAN_STATUS.EXECUTING,
      steps: [
        createMockStep({
          index: 0,
          status: STEP_STATUS.COMPLETED,
          rollbackAction: { toolName: "delete_task", parameters: { id: "1" } },
        }),
        createMockStep({ index: 1, status: STEP_STATUS.FAILED }),
      ],
    });

    const mockLLMClient = createMockLLMClient({
      action: "rollback",
      reasoning: "Critical step failed. Rolling back to clean state.",
      confidence: 0.9,
    });

    const failure = createStepFailure(plan.steps[1], "Validation failed", 0);

    const action = await determineRecoveryAction(plan, failure, {
      llmClient: mockLLMClient as unknown as import("@/lib/agent/llm/types").LLMClient,
      useLLMRecovery: true,
    });

    expect(action.action).toBe("rollback");
    expect(action.reasoning).toContain("Rolling back");
  });

  it("should pass correct plan context to LLM", async () => {
    const {
      createStepFailure,
      determineRecoveryAction,
    } = await import("@/lib/agent/planning/recovery");

    const plan = createMockPlan({
      goal: "Create project with tasks",
      status: PLAN_STATUS.EXECUTING,
      steps: [
        createMockStep({
          index: 0,
          status: STEP_STATUS.COMPLETED,
          toolName: "create_project",
          description: "Create the project",
          dependsOnIndices: [],
          requiresApproval: false,
        }),
        createMockStep({
          index: 1,
          status: STEP_STATUS.FAILED,
          toolName: "create_task",
          description: "Create first task",
          dependsOnIndices: [0],
          requiresApproval: false,
        }),
      ],
      currentStepIndex: 1,
    });

    const mockLLMClient = createMockLLMClient({
      action: "retry",
      reasoning: "Retry",
      confidence: 0.8,
    });

    const failure = createStepFailure(plan.steps[1], "API error", 1);

    await determineRecoveryAction(plan, failure, {
      llmClient: mockLLMClient as unknown as import("@/lib/agent/llm/types").LLMClient,
      useLLMRecovery: true,
    });

    // Verify the complete request structure
    const request = mockLLMClient.decideRecovery.mock.calls[0][0];
    
    expect(request.plan.goal).toBe("Create project with tasks");
    expect(request.plan.steps).toHaveLength(2);
    expect(request.plan.steps[0].toolName).toBe("create_project");
    expect(request.plan.steps[1].toolName).toBe("create_task");
    expect(request.plan.steps[1].dependsOn).toEqual([0]);
    expect(request.plan.currentStepIndex).toBe(1);
    
    expect(request.failure.stepIndex).toBe(1);
    expect(request.failure.error).toBe("API error");
    expect(request.failure.errorType).toBe("unknown");
    
    expect(request.retryCount).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────
// Integration Tests (with mocked repository)
// ─────────────────────────────────────────────────────────────

describe("State & Recovery Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle complete recovery flow for transient error", async () => {
    const {
      createStepFailure,
      determineRecoveryAction,
    } = await import("@/lib/agent/planning/recovery");

    // Setup: Plan with first step completed, second step failing
    const plan = createMockPlan({
      status: PLAN_STATUS.EXECUTING,
      steps: [
        createMockStep({ index: 0, status: STEP_STATUS.COMPLETED }),
        createMockStep({
          index: 1,
          status: STEP_STATUS.FAILED,
          errorMessage: "Rate limit exceeded",
        }),
        createMockStep({ index: 2, status: STEP_STATUS.PENDING }),
      ],
      currentStepIndex: 1,
    });

    // Create failure
    const failure = createStepFailure(plan.steps[1], "Rate limit exceeded", 0);
    expect(failure.errorType).toBe("rate_limit");

    // Determine recovery
    const action = await determineRecoveryAction(plan, failure, {
      useLLMRecovery: false,
    });

    // Should suggest retry for transient error
    expect(action.action).toBe("retry");
  });

  it("should handle recovery flow for permanent error", async () => {
    const {
      createStepFailure,
      determineRecoveryAction,
    } = await import("@/lib/agent/planning/recovery");

    // Setup: Plan with authentication error
    const plan = createMockPlan({
      status: PLAN_STATUS.EXECUTING,
      steps: [
        createMockStep({
          index: 0,
          status: STEP_STATUS.FAILED,
          errorMessage: "401 Unauthorized",
        }),
      ],
      currentStepIndex: 0,
    });

    const failure = createStepFailure(plan.steps[0], "401 Unauthorized", 0);
    expect(failure.errorType).toBe("authentication");

    const action = await determineRecoveryAction(plan, failure, {
      useLLMRecovery: false,
    });

    // Should ask user for auth errors
    expect(action.action).toBe("ask_user");
  });

  it("should analyze rollback capability for failed plan", async () => {
    const { analyzeRollbackForPlan } = await import("@/lib/agent/planning/rollback");
    const { canPlanContinue } = await import("@/lib/agent/planning/state");

    // Setup: Plan with some completed rollbackable steps
    const plan = createMockPlan({
      status: PLAN_STATUS.FAILED,
      steps: [
        createMockStep({
          index: 0,
          status: STEP_STATUS.COMPLETED,
          rollbackAction: { toolName: "delete_task", parameters: { id: "1" } },
        }),
        createMockStep({
          index: 1,
          status: STEP_STATUS.COMPLETED,
          rollbackAction: { toolName: "delete_event", parameters: { id: "2" } },
        }),
        createMockStep({ index: 2, status: STEP_STATUS.FAILED }),
      ],
    });

    // Plan cannot continue (it's failed)
    expect(canPlanContinue(plan)).toBe(false);

    // But it can be rolled back
    const analysis = analyzeRollbackForPlan(plan);
    expect(analysis.canRollback).toBe(true);
    expect(analysis.rollbackableSteps).toHaveLength(2);
    expect(analysis.effort).toBe("minimal");
  });
});

