// ═══════════════════════════════════════════════════════════════════════════
// Plan Generation & Structuring Tests
// Tests for plan validation, structuring, and repository operations
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { toolRegistry } from "@/lib/agent/tools/registry";
import { defineTool } from "@/lib/agent/tools/types";
import { z } from "zod";
import type { LLMGeneratedPlan, LLMPlanStep, LLMAssumption } from "@/lib/agent/llm/types";
import type { PlanConstraints, PlanningContext } from "@/lib/agent/planning/types";

// ─────────────────────────────────────────────────────────────
// Mock Data
// ─────────────────────────────────────────────────────────────

// Mock tools for testing
const mockQueryTool = defineTool({
  name: "query_context",
  description: "Query user context",
  whenToUse: "When you need to find information",
  examples: ["Find my tasks", "What's on my calendar?"],
  parametersSchema: {
    type: "object" as const,
    properties: {
      query: { type: "string" as const, description: "Search query" },
    },
    required: ["query"],
  },
  category: "query",
  riskLevel: "low",
  requiresApproval: false,
  requiredIntegrations: [],
  inputValidator: z.object({
    query: z.string(),
  }),
  execute: async () => ({ results: [] }),
});

const mockCreateTaskTool = defineTool({
  name: "create_task",
  description: "Create a new task",
  whenToUse: "When user wants to create a task",
  examples: ["Create a task to buy groceries", "Add a todo item"],
  parametersSchema: {
    type: "object" as const,
    properties: {
      title: { type: "string" as const, description: "Task title" },
      description: { type: "string" as const, description: "Task description" },
      dueDate: { type: "string" as const, description: "Due date" },
    },
    required: ["title"],
  },
  category: "create",
  riskLevel: "medium",
  requiresApproval: false,
  requiredIntegrations: [],
  inputValidator: z.object({
    title: z.string(),
    description: z.string().optional(),
    dueDate: z.string().optional(),
  }),
  execute: async () => ({ taskId: "task-123" }),
});

const mockSendEmailTool = defineTool({
  name: "send_email",
  description: "Send an email",
  whenToUse: "When user wants to send an email",
  examples: ["Send an email to John", "Email my manager about the project"],
  parametersSchema: {
    type: "object" as const,
    properties: {
      to: { type: "string" as const, format: "email" as const, description: "Recipient email" },
      subject: { type: "string" as const, description: "Email subject" },
      body: { type: "string" as const, description: "Email body" },
    },
    required: ["to", "subject", "body"],
  },
  category: "external",
  riskLevel: "high",
  requiresApproval: true,
  requiredIntegrations: ["gmail"],
  inputValidator: z.object({
    to: z.string().email(),
    subject: z.string(),
    body: z.string(),
  }),
  execute: async () => ({ messageId: "msg-123" }),
});

// Mock LLM plan
function createMockLLMPlan(overrides?: Partial<LLMGeneratedPlan>): LLMGeneratedPlan {
  return {
    goal: "Create a task and send notification",
    goalType: "task_management",
    steps: [
      {
        order: 0,
        toolName: "create_task",
        parameters: { title: "Test Task", description: "Test description" },
        dependsOn: [],
        description: "Create a new task",
        requiresApproval: false,
      },
      {
        order: 1,
        toolName: "send_email",
        parameters: { to: "test@example.com", subject: "Task Created", body: "A new task was created" },
        dependsOn: [0],
        description: "Send email notification",
        requiresApproval: true,
      },
    ],
    requiresApproval: true,
    reasoning: "Creating task first, then notifying via email",
    assumptions: [
      {
        statement: "User wants immediate notification",
        category: "preference",
        evidence: ["User said 'notify me'"],
        confidence: 0.8,
      },
    ],
    confidence: 0.85,
    ...overrides,
  };
}

// Mock planning context
function createMockContext(overrides?: Partial<PlanningContext>): PlanningContext {
  return {
    userId: "user-123",
    availableTools: [],
    resolvedEntities: [],
    relevantContext: [],
    timezone: "America/New_York",
    currentTime: new Date("2024-01-15T10:00:00Z"),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Test Setup
// ─────────────────────────────────────────────────────────────

describe("Plan Validation", () => {
  beforeEach(() => {
    // Register mock tools
    toolRegistry.clear();
    toolRegistry.register(mockQueryTool);
    toolRegistry.register(mockCreateTaskTool);
    toolRegistry.register(mockSendEmailTool);
  });

  afterEach(() => {
    toolRegistry.clear();
  });

  describe("validatePlan", () => {
    it("should validate a valid plan", async () => {
      const { validatePlan } = await import("@/lib/agent/planning/validator");
      const plan = createMockLLMPlan();

      const result = validatePlan(plan);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.validatedPlan).toBeDefined();
    });

    it("should reject empty plan", async () => {
      const { validatePlan } = await import("@/lib/agent/planning/validator");
      const plan = createMockLLMPlan({ steps: [] });

      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "empty_plan")).toBe(true);
    });

    it("should reject plan with missing goal", async () => {
      const { validatePlan } = await import("@/lib/agent/planning/validator");
      const plan = createMockLLMPlan({ goal: "" });

      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "missing_goal")).toBe(true);
    });

    it("should reject plan with non-existent tool", async () => {
      const { validatePlan } = await import("@/lib/agent/planning/validator");
      const plan = createMockLLMPlan({
        steps: [
          {
            order: 0,
            toolName: "nonexistent_tool",
            parameters: {},
            dependsOn: [],
            description: "This tool doesn't exist",
            requiresApproval: false,
          },
        ],
      });

      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "tool_not_found")).toBe(true);
    });

    it("should reject plan with invalid parameters", async () => {
      const { validatePlan } = await import("@/lib/agent/planning/validator");
      const plan = createMockLLMPlan({
        steps: [
          {
            order: 0,
            toolName: "create_task",
            parameters: { title: 123 }, // Should be string
            dependsOn: [],
            description: "Invalid params",
            requiresApproval: false,
          },
        ],
      });

      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "invalid_parameters")).toBe(true);
    });

    it("should reject plan with cyclic dependencies", async () => {
      const { validatePlan } = await import("@/lib/agent/planning/validator");
      const plan = createMockLLMPlan({
        steps: [
          {
            order: 0,
            toolName: "create_task",
            parameters: { title: "Task 1" },
            dependsOn: [1], // Depends on step 1
            description: "Task 1",
            requiresApproval: false,
          },
          {
            order: 1,
            toolName: "create_task",
            parameters: { title: "Task 2" },
            dependsOn: [0], // Depends on step 0 - creates cycle
            description: "Task 2",
            requiresApproval: false,
          },
        ],
      });

      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      const hasCyclicError = result.errors.some(
        (e) => e.code === "cyclic_dependency" || e.code === "dependency_out_of_order"
      );
      expect(hasCyclicError).toBe(true);
    });

    it("should reject plan with invalid dependency reference", async () => {
      const { validatePlan } = await import("@/lib/agent/planning/validator");
      const plan = createMockLLMPlan({
        steps: [
          {
            order: 0,
            toolName: "create_task",
            parameters: { title: "Task" },
            dependsOn: [5], // Step 5 doesn't exist
            description: "Task",
            requiresApproval: false,
          },
        ],
      });

      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "invalid_dependency")).toBe(true);
    });

    it("should reject plan with duplicate step orders", async () => {
      const { validatePlan } = await import("@/lib/agent/planning/validator");
      const plan = createMockLLMPlan({
        steps: [
          {
            order: 0,
            toolName: "create_task",
            parameters: { title: "Task 1" },
            dependsOn: [],
            description: "Task 1",
            requiresApproval: false,
          },
          {
            order: 0, // Duplicate!
            toolName: "create_task",
            parameters: { title: "Task 2" },
            dependsOn: [],
            description: "Task 2",
            requiresApproval: false,
          },
        ],
      });

      const result = validatePlan(plan);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "duplicate_step_order")).toBe(true);
    });

    it("should enforce max steps constraint", async () => {
      const { validatePlan } = await import("@/lib/agent/planning/validator");
      const manySteps: LLMPlanStep[] = Array.from({ length: 15 }, (_, i) => ({
        order: i,
        toolName: "create_task",
        parameters: { title: `Task ${i}` },
        dependsOn: i > 0 ? [i - 1] : [],
        description: `Task ${i}`,
        requiresApproval: false,
      }));

      const plan = createMockLLMPlan({ steps: manySteps });
      const constraints: PlanConstraints = { maxSteps: 10 };

      const result = validatePlan(plan, constraints);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === "too_many_steps")).toBe(true);
    });

    it("should generate warnings for high-risk tools", async () => {
      const { validatePlan } = await import("@/lib/agent/planning/validator");
      const plan = createMockLLMPlan();

      const result = validatePlan(plan);

      // send_email is high-risk
      expect(result.warnings.some((w) => w.code === "high_risk_tool")).toBe(true);
    });

    it("should generate warnings for low confidence", async () => {
      const { validatePlan } = await import("@/lib/agent/planning/validator");
      const plan = createMockLLMPlan({ confidence: 0.3 });

      const result = validatePlan(plan);

      expect(result.warnings.some((w) => w.code === "low_confidence")).toBe(true);
    });
  });

  describe("formatValidationErrorsForLLM", () => {
    it("should format errors for LLM retry", async () => {
      const { formatValidationErrorsForLLM } = await import("@/lib/agent/planning/validator");
      const errors = [
        { code: "tool_not_found" as const, message: "Tool xyz not found", stepIndex: 0 },
        { code: "invalid_parameters" as const, message: "Invalid param", stepIndex: 1, expected: "string", received: "number" },
      ];

      const formatted = formatValidationErrorsForLLM(errors);

      expect(formatted).toContain("Unknown Tools");
      expect(formatted).toContain("Invalid Parameters");
      expect(formatted).toContain("Tool xyz not found");
      expect(formatted).toContain("correct these issues");
    });

    it("should return valid message for no errors", async () => {
      const { formatValidationErrorsForLLM } = await import("@/lib/agent/planning/validator");

      const formatted = formatValidationErrorsForLLM([]);

      expect(formatted).toBe("Plan is valid.");
    });
  });

  describe("canRetryPlanGeneration", () => {
    it("should return true for retryable errors", async () => {
      const { canRetryPlanGeneration } = await import("@/lib/agent/planning/validator");
      const errors = [
        { code: "tool_not_found" as const, message: "Tool not found", stepIndex: 0 },
        { code: "invalid_parameters" as const, message: "Invalid params", stepIndex: 1 },
      ];

      expect(canRetryPlanGeneration(errors)).toBe(true);
    });

    it("should return false for non-retryable errors", async () => {
      const { canRetryPlanGeneration } = await import("@/lib/agent/planning/validator");
      const errors = [
        { code: "missing_goal" as const, message: "Missing goal", stepIndex: -1 },
      ];

      expect(canRetryPlanGeneration(errors)).toBe(false);
    });
  });
});

describe("Plan Structuring", () => {
  beforeEach(() => {
    toolRegistry.clear();
    toolRegistry.register(mockQueryTool);
    toolRegistry.register(mockCreateTaskTool);
    toolRegistry.register(mockSendEmailTool);
  });

  afterEach(() => {
    toolRegistry.clear();
  });

  describe("createPlanPreview", () => {
    it("should create a plan preview without persisting", async () => {
      const { createPlanPreview } = await import("@/lib/agent/planning/structurer");
      const plan = createMockLLMPlan();
      const context = createMockContext();

      const preview = createPlanPreview(plan, context);

      expect(preview.goal).toBe(plan.goal);
      expect(preview.goalType).toBe(plan.goalType);
      expect(preview.steps).toHaveLength(2);
      expect(preview.requiresApproval).toBe(true);
      expect(preview.steps[0].toolName).toBe("create_task");
      expect(preview.steps[1].toolName).toBe("send_email");
    });

    it("should throw for invalid plan", async () => {
      const { createPlanPreview } = await import("@/lib/agent/planning/structurer");
      const plan = createMockLLMPlan({ steps: [] });
      const context = createMockContext();

      expect(() => createPlanPreview(plan, context)).toThrow();
    });
  });

  describe("markApprovalSteps", () => {
    it("should mark steps based on tool configuration", async () => {
      const { createPlanPreview, markApprovalSteps } = await import("@/lib/agent/planning/structurer");
      const plan = createMockLLMPlan();
      const context = createMockContext();

      const preview = createPlanPreview(plan, context);
      const marked = markApprovalSteps(preview.steps);

      // send_email tool requires approval
      expect(marked[1].requiresApproval).toBe(true);
    });
  });

  describe("getApprovalRequiredSteps", () => {
    it("should return only steps requiring approval", async () => {
      const { createPlanPreview, getApprovalRequiredSteps } = await import("@/lib/agent/planning/structurer");
      const plan = createMockLLMPlan();
      const context = createMockContext();

      const preview = createPlanPreview(plan, context);
      // Mock the full StructuredPlan shape
      const fullPlan = {
        ...preview,
        id: "test-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const approvalSteps = getApprovalRequiredSteps(fullPlan);

      expect(approvalSteps.length).toBeGreaterThan(0);
      expect(approvalSteps.every((s) => s.requiresApproval)).toBe(true);
    });
  });

  describe("estimatePlanDuration", () => {
    it("should estimate duration based on tools", async () => {
      const { createPlanPreview, estimatePlanDuration } = await import("@/lib/agent/planning/structurer");
      const plan = createMockLLMPlan();
      const context = createMockContext();

      const preview = createPlanPreview(plan, context);
      const fullPlan = {
        ...preview,
        id: "test-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const duration = estimatePlanDuration(fullPlan);

      expect(duration.minSeconds).toBeGreaterThan(0);
      expect(duration.maxSeconds).toBeGreaterThan(duration.minSeconds);
      expect(duration.formatted).toMatch(/\d+.*(second|minute)/);
    });
  });

  describe("summarizePlan", () => {
    it("should generate human-readable summary", async () => {
      const { createPlanPreview, summarizePlan } = await import("@/lib/agent/planning/structurer");
      const plan = createMockLLMPlan();
      const context = createMockContext();

      const preview = createPlanPreview(plan, context);
      const fullPlan = {
        ...preview,
        id: "test-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const summary = summarizePlan(fullPlan);

      expect(summary).toContain(plan.goal);
      expect(summary).toContain("Steps:");
      expect(summary).toContain("1.");
      expect(summary).toContain("2.");
    });
  });

  describe("canExecuteNextStep", () => {
    it("should return true when dependencies are met", async () => {
      const { createPlanPreview, canExecuteNextStep } = await import("@/lib/agent/planning/structurer");
      const plan = createMockLLMPlan();
      const context = createMockContext();

      const preview = createPlanPreview(plan, context);
      const fullPlan = {
        ...preview,
        id: "test-id",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "planned" as const,
      };

      // First step has no dependencies
      expect(canExecuteNextStep(fullPlan)).toBe(true);
    });

    it("should return false when plan is completed", async () => {
      const { createPlanPreview, canExecuteNextStep } = await import("@/lib/agent/planning/structurer");
      const plan = createMockLLMPlan();
      const context = createMockContext();

      const preview = createPlanPreview(plan, context);
      const fullPlan = {
        ...preview,
        id: "test-id",
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "completed" as const,
      };

      expect(canExecuteNextStep(fullPlan)).toBe(false);
    });
  });

  describe("getExecutionOrder", () => {
    it("should return topologically sorted order", async () => {
      const { createPlanPreview, getExecutionOrder } = await import("@/lib/agent/planning/structurer");
      const plan = createMockLLMPlan();
      const context = createMockContext();

      const preview = createPlanPreview(plan, context);
      const fullPlan = {
        ...preview,
        id: "test-id",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const order = getExecutionOrder(fullPlan);

      // Step 0 should come before step 1 (step 1 depends on 0)
      expect(order.indexOf(0)).toBeLessThan(order.indexOf(1));
    });
  });
});

describe("Plan Repository", () => {
  // Note: These tests would need database mocking
  // Here we test the interface contracts

  describe("interface contracts", () => {
    it("should export planRepository with expected methods", async () => {
      const { planRepository } = await import("@/lib/agent/planning/repository");

      expect(typeof planRepository.create).toBe("function");
      expect(typeof planRepository.getById).toBe("function");
      expect(typeof planRepository.getByIdForUser).toBe("function");
      expect(typeof planRepository.query).toBe("function");
      expect(typeof planRepository.updateStatus).toBe("function");
      expect(typeof planRepository.updateStepStatus).toBe("function");
      expect(typeof planRepository.startExecution).toBe("function");
      expect(typeof planRepository.pauseExecution).toBe("function");
      expect(typeof planRepository.completePlan).toBe("function");
      expect(typeof planRepository.failPlan).toBe("function");
      expect(typeof planRepository.cancelPlan).toBe("function");
      expect(typeof planRepository.approvePlan).toBe("function");
      expect(typeof planRepository.delete).toBe("function");
    });
  });
});

describe("Planning Module Exports", () => {
  it("should export all expected types and functions", async () => {
    const planning = await import("@/lib/agent/planning");

    // Types are compile-time only, but we can check functions
    expect(typeof planning.validatePlan).toBe("function");
    expect(typeof planning.formatValidationErrorsForLLM).toBe("function");
    expect(typeof planning.canRetryPlanGeneration).toBe("function");
    expect(typeof planning.createPlanPreview).toBe("function");
    expect(typeof planning.markApprovalSteps).toBe("function");
    expect(typeof planning.estimatePlanDuration).toBe("function");
    expect(typeof planning.summarizePlan).toBe("function");
    expect(typeof planning.canExecuteNextStep).toBe("function");
    expect(typeof planning.getExecutionOrder).toBe("function");
    expect(planning.planRepository).toBeDefined();
    expect(planning.PlanningError).toBeDefined();
  });
});

