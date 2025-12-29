// ═══════════════════════════════════════════════════════════════════════════
// Action Routing Tests
// Tests for confidence-based action routing (Chunk [R1D])
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ActionRouter,
  actionRouter,
  createActionRouter,
  routeToAction,
  shouldExecute as shouldExecuteAction,
  needsClarification as needsRoutingClarification,
  DEFAULT_THRESHOLDS,
  CONSERVATIVE_THRESHOLDS,
  AGGRESSIVE_THRESHOLDS,
  ALWAYS_CONFIRM_THRESHOLDS,
  getThresholdPreset,
  mergeThresholds,
  validateThresholds,
  getThresholdBand,
  describeConfidenceAction,
  isExecuteDecision,
  isConfirmDecision,
  isClarifyDecision,
  isRespondDecision,
  isErrorDecision,
} from "@/lib/agent/routing";
import type {
  PerceptionResult,
  ActionDecision,
  ConfidenceThresholdConfig,
} from "@/lib/agent/routing";
import type { ClassificationResponse } from "@/lib/agent/llm/types";
import type { ResolutionResult } from "@/lib/agent/entities/types";
import type { ContextRetrieval } from "@/lib/agent/context/types";
import type { IntentAnalysisResult } from "@/lib/agent/intent/types";

// Mock the tool registry
vi.mock("@/lib/agent/tools/registry", () => ({
  toolRegistry: {
    get: vi.fn((name: string) => {
      if (name === "unknown_tool") {
        return undefined;
      }
      return {
        name,
        description: `Mock ${name} tool`,
        requiresApproval: name === "send_email" || name === "create_event",
        riskLevel: name === "send_email" ? "high" : "low",
        category: name.startsWith("query") ? "query" : "action",
      };
    }),
  },
}));

// ─────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────

function createMockClassification(
  overrides: Partial<ClassificationResponse> = {}
): ClassificationResponse {
  return {
    intent: {
      category: "task",
      action: "create_task",
      summary: "Create a task",
    },
    entities: [],
    suggestedTool: {
      name: "create_task",
      parameters: { title: "Test task" },
      confidence: 0.9,
      reasoning: "User wants to create a task",
    },
    assumptions: [],
    confidence: 0.9,
    ...overrides,
  };
}

function createMockResolution(
  overrides: Partial<ResolutionResult> = {}
): ResolutionResult {
  return {
    entities: [],
    resolved: [],
    ambiguous: [],
    notFound: [],
    needsClarification: false,
    clarificationQuestions: [],
    ...overrides,
  };
}

function createMockContext(): ContextRetrieval {
  return {
    relevantPeople: [],
    relevantEvents: [],
    relevantTasks: [],
    relevantDeadlines: [],
    relevantPlaces: [],
    relevantRoutines: [],
    relevantOpenLoops: [],
    relevantProjects: [],
    relevantNotes: [],
    relevantOpportunities: [],
    conversationContext: [],
    semanticMatches: [],
    recentInteractions: [],
    stats: {
      totalItems: 0,
      fromResolution: 0,
      fromSemanticSearch: 0,
      fromTextSearch: 0,
      fromConversation: 0,
      fromRecentInteractions: 0,
      durationMs: 10,
    },
  };
}

function createMockIntent(): IntentAnalysisResult {
  return {
    category: "task",
    action: "create_task",
    summary: "Create a task",
    confidence: 0.9,
    entities: [],
    assumptions: [],
  };
}

function createMockPerception(
  classificationOverrides: Partial<ClassificationResponse> = {},
  resolutionOverrides: Partial<ResolutionResult> = {}
): PerceptionResult {
  return {
    classification: createMockClassification(classificationOverrides),
    intent: createMockIntent(),
    resolution: createMockResolution(resolutionOverrides),
    context: createMockContext(),
    userId: "user-123",
    originalMessage: "Create a task for tomorrow",
  };
}

// ─────────────────────────────────────────────────────────────
// Threshold Tests
// ─────────────────────────────────────────────────────────────

describe("Confidence Thresholds", () => {
  describe("DEFAULT_THRESHOLDS", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_THRESHOLDS.execute).toBe(0.85);
      expect(DEFAULT_THRESHOLDS.confirm).toBe(0.65);
      expect(DEFAULT_THRESHOLDS.clarify).toBe(0.4);
    });

    it("should be in descending order", () => {
      expect(DEFAULT_THRESHOLDS.execute).toBeGreaterThan(
        DEFAULT_THRESHOLDS.confirm
      );
      expect(DEFAULT_THRESHOLDS.confirm).toBeGreaterThan(
        DEFAULT_THRESHOLDS.clarify
      );
    });
  });

  describe("getThresholdPreset", () => {
    it("should return default thresholds", () => {
      expect(getThresholdPreset("default")).toEqual(DEFAULT_THRESHOLDS);
    });

    it("should return conservative thresholds", () => {
      expect(getThresholdPreset("conservative")).toEqual(
        CONSERVATIVE_THRESHOLDS
      );
    });

    it("should return aggressive thresholds", () => {
      expect(getThresholdPreset("aggressive")).toEqual(AGGRESSIVE_THRESHOLDS);
    });

    it("should return always_confirm thresholds", () => {
      expect(getThresholdPreset("always_confirm")).toEqual(
        ALWAYS_CONFIRM_THRESHOLDS
      );
    });
  });

  describe("mergeThresholds", () => {
    it("should return defaults when no overrides provided", () => {
      expect(mergeThresholds()).toEqual(DEFAULT_THRESHOLDS);
    });

    it("should merge partial overrides", () => {
      const result = mergeThresholds({ execute: 0.95 });
      expect(result.execute).toBe(0.95);
      expect(result.confirm).toBe(DEFAULT_THRESHOLDS.confirm);
      expect(result.clarify).toBe(DEFAULT_THRESHOLDS.clarify);
    });

    it("should override all values when provided", () => {
      const custom = { execute: 0.99, confirm: 0.8, clarify: 0.5 };
      expect(mergeThresholds(custom)).toEqual(custom);
    });
  });

  describe("validateThresholds", () => {
    it("should return no errors for valid thresholds", () => {
      const errors = validateThresholds(DEFAULT_THRESHOLDS);
      expect(errors).toHaveLength(0);
    });

    it("should detect out-of-range values", () => {
      const errors = validateThresholds({
        execute: 1.5,
        confirm: -0.1,
        clarify: 0.5,
      });
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should detect incorrect ordering", () => {
      const errors = validateThresholds({
        execute: 0.5,
        confirm: 0.8, // Higher than execute
        clarify: 0.3,
      });
      expect(errors.some((e) => e.includes("must be greater than"))).toBe(true);
    });
  });

  describe("getThresholdBand", () => {
    it("should return 'execute' for high confidence", () => {
      expect(getThresholdBand(0.9)).toBe("execute");
      expect(getThresholdBand(0.85)).toBe("execute");
    });

    it("should return 'confirm' for medium confidence", () => {
      expect(getThresholdBand(0.7)).toBe("confirm");
      expect(getThresholdBand(0.65)).toBe("confirm");
    });

    it("should return 'clarify' for low confidence", () => {
      expect(getThresholdBand(0.5)).toBe("clarify");
      expect(getThresholdBand(0.4)).toBe("clarify");
    });

    it("should return 'uncertain' for very low confidence", () => {
      expect(getThresholdBand(0.3)).toBe("uncertain");
      expect(getThresholdBand(0)).toBe("uncertain");
    });

    it("should use custom thresholds", () => {
      const custom = { execute: 0.95, confirm: 0.8, clarify: 0.6 };
      expect(getThresholdBand(0.9, custom)).toBe("confirm");
      expect(getThresholdBand(0.7, custom)).toBe("clarify");
    });
  });

  describe("describeConfidenceAction", () => {
    it("should describe execute action", () => {
      const desc = describeConfidenceAction(0.9);
      expect(desc).toContain("execute immediately");
    });

    it("should describe confirm action", () => {
      const desc = describeConfidenceAction(0.7);
      expect(desc).toContain("confirmation");
    });

    it("should describe clarify action", () => {
      const desc = describeConfidenceAction(0.5);
      expect(desc).toContain("clarifying questions");
    });

    it("should describe uncertain state", () => {
      const desc = describeConfidenceAction(0.2);
      expect(desc).toContain("more information");
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Type Guard Tests
// ─────────────────────────────────────────────────────────────

describe("Decision Type Guards", () => {
  it("should identify execute decision", () => {
    const decision: ActionDecision = {
      type: "execute_tool",
      tool: "create_task",
      params: {},
      requiresApproval: false,
      confidence: 0.9,
      reasoning: "test",
      assumptions: [],
    };
    expect(isExecuteDecision(decision)).toBe(true);
    expect(isConfirmDecision(decision)).toBe(false);
  });

  it("should identify confirm decision", () => {
    const decision: ActionDecision = {
      type: "confirm_action",
      tool: "create_task",
      params: {},
      confirmationMessage: "Proceed?",
      uncertainties: [],
      confidence: 0.7,
      assumptionsToVerify: [],
    };
    expect(isConfirmDecision(decision)).toBe(true);
    expect(isExecuteDecision(decision)).toBe(false);
  });

  it("should identify clarify decision", () => {
    const decision: ActionDecision = {
      type: "clarify",
      questions: ["What do you mean?"],
      missingInfo: [],
      clarificationReason: "low_confidence",
    };
    expect(isClarifyDecision(decision)).toBe(true);
    expect(isRespondDecision(decision)).toBe(false);
  });

  it("should identify respond decision", () => {
    const decision: ActionDecision = {
      type: "respond",
      responseStyle: "conversational",
      responseContext: "General chat",
      isSimple: true,
    };
    expect(isRespondDecision(decision)).toBe(true);
    expect(isClarifyDecision(decision)).toBe(false);
  });

  it("should identify error decision", () => {
    const decision: ActionDecision = {
      type: "error",
      errorCode: "tool_not_found",
      error: "Tool not found",
      recoverable: true,
    };
    expect(isErrorDecision(decision)).toBe(true);
    expect(isExecuteDecision(decision)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────
// Router Tests
// ─────────────────────────────────────────────────────────────

describe("ActionRouter", () => {
  describe("constructor", () => {
    it("should create router with default thresholds", () => {
      const router = new ActionRouter();
      expect(router.getThresholds()).toEqual(DEFAULT_THRESHOLDS);
    });

    it("should create router with custom thresholds", () => {
      const custom = { execute: 0.95 };
      const router = new ActionRouter(custom);
      const thresholds = router.getThresholds();
      expect(thresholds.execute).toBe(0.95);
      expect(thresholds.confirm).toBe(DEFAULT_THRESHOLDS.confirm);
    });
  });

  describe("shouldExecute", () => {
    const router = new ActionRouter();

    it("should return true for high confidence with tool", () => {
      const classification = createMockClassification({ confidence: 0.9 });
      const resolution = createMockResolution();
      expect(router.shouldExecute(classification, resolution)).toBe(true);
    });

    it("should return false for low confidence", () => {
      const classification = createMockClassification({ confidence: 0.5 });
      const resolution = createMockResolution();
      expect(router.shouldExecute(classification, resolution)).toBe(false);
    });

    it("should return false when no tool suggested", () => {
      const classification = createMockClassification({
        confidence: 0.9,
        suggestedTool: undefined,
      });
      const resolution = createMockResolution();
      expect(router.shouldExecute(classification, resolution)).toBe(false);
    });

    it("should return false when clarification is needed", () => {
      const classification = createMockClassification({
        confidence: 0.9,
        clarificationNeeded: {
          required: true,
          questions: ["Which task?"],
          missingInfo: ["task name"],
        },
      });
      const resolution = createMockResolution();
      expect(router.shouldExecute(classification, resolution)).toBe(false);
    });
  });

  describe("needsClarification", () => {
    const router = new ActionRouter();

    it("should return true when LLM requests clarification", () => {
      const classification = createMockClassification({
        clarificationNeeded: {
          required: true,
          questions: ["Which meeting?"],
          missingInfo: ["meeting details"],
        },
      });
      const resolution = createMockResolution();
      expect(router.needsClarification(classification, resolution)).toBe(true);
    });

    it("should return true for low confidence", () => {
      const classification = createMockClassification({ confidence: 0.3 });
      const resolution = createMockResolution();
      expect(router.needsClarification(classification, resolution)).toBe(true);
    });

    it("should return true when entities are ambiguous", () => {
      const classification = createMockClassification();
      const resolution = createMockResolution({
        ambiguous: [
          {
            extracted: { type: "person", text: "John", value: "John", needsResolution: true },
            status: "ambiguous",
            confidence: 0.5,
            candidates: [
              { id: "1", label: "John Smith", confidence: 0.6 },
              { id: "2", label: "John Doe", confidence: 0.5 },
            ],
          },
        ],
      });
      expect(router.needsClarification(classification, resolution)).toBe(true);
    });

    it("should return false for high confidence resolved request", () => {
      const classification = createMockClassification({ confidence: 0.9 });
      const resolution = createMockResolution();
      expect(router.needsClarification(classification, resolution)).toBe(false);
    });
  });

  describe("routeToAction", () => {
    const router = new ActionRouter();

    it("should route high confidence to execute", async () => {
      const perception = createMockPerception({ confidence: 0.9 });
      const result = await router.routeToAction(perception);

      expect(result.decision.type).toBe("execute_tool");
      if (isExecuteDecision(result.decision)) {
        expect(result.decision.tool).toBe("create_task");
        expect(result.decision.requiresApproval).toBe(false);
      }
    });

    it("should route medium confidence to confirm", async () => {
      const perception = createMockPerception({ confidence: 0.7 });
      const result = await router.routeToAction(perception);

      expect(result.decision.type).toBe("confirm_action");
      if (isConfirmDecision(result.decision)) {
        expect(result.decision.tool).toBe("create_task");
        expect(result.decision.confirmationMessage).toContain("proceed");
      }
    });

    it("should route low confidence to clarify", async () => {
      const perception = createMockPerception({ confidence: 0.3 });
      const result = await router.routeToAction(perception);

      expect(result.decision.type).toBe("clarify");
      if (isClarifyDecision(result.decision)) {
        expect(result.decision.questions.length).toBeGreaterThan(0);
      }
    });

    it("should route no tool to respond", async () => {
      const perception = createMockPerception({
        confidence: 0.9,
        suggestedTool: undefined,
        intent: { category: "conversation", summary: "General chat" },
      });
      const result = await router.routeToAction(perception);

      expect(result.decision.type).toBe("respond");
      if (isRespondDecision(result.decision)) {
        expect(result.decision.responseStyle).toBeDefined();
      }
    });

    it("should respect alwaysConfirm context", async () => {
      const perception = createMockPerception({ confidence: 0.95 });
      const result = await router.routeToAction(perception, {
        alwaysConfirm: true,
      });

      expect(result.decision.type).toBe("confirm_action");
    });

    it("should error for unknown tool", async () => {
      const perception = createMockPerception({
        confidence: 0.9,
        suggestedTool: {
          name: "unknown_tool",
          parameters: {},
          confidence: 0.9,
          reasoning: "test",
        },
      });
      const result = await router.routeToAction(perception);

      expect(result.decision.type).toBe("error");
      if (isErrorDecision(result.decision)) {
        expect(result.decision.errorCode).toBe("tool_not_found");
      }
    });

    it("should error for disabled tool", async () => {
      const perception = createMockPerception({ confidence: 0.9 });
      const result = await router.routeToAction(perception, {
        disabledTools: ["create_task"],
      });

      expect(result.decision.type).toBe("error");
      if (isErrorDecision(result.decision)) {
        expect(result.decision.errorCode).toBe("tool_not_found");
        expect(result.decision.error).toContain("disabled");
      }
    });

    it("should include routing metadata", async () => {
      const perception = createMockPerception();
      const result = await router.routeToAction(perception);

      expect(result.thresholdsUsed).toEqual(DEFAULT_THRESHOLDS);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(result.timestamp).toBeInstanceOf(Date);
      expect(result.perception).toBe(perception);
    });

    it("should merge user thresholds", async () => {
      const perception = createMockPerception({ confidence: 0.9 });
      const result = await router.routeToAction(perception, {
        userThresholds: { execute: 0.95 },
      });

      // 0.9 < 0.95, so should be confirm, not execute
      expect(result.decision.type).toBe("confirm_action");
      expect(result.thresholdsUsed.execute).toBe(0.95);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Factory and Convenience Function Tests
// ─────────────────────────────────────────────────────────────

describe("Factory and Convenience Functions", () => {
  describe("createActionRouter", () => {
    it("should create router with custom thresholds", () => {
      const router = createActionRouter({ execute: 0.99 });
      expect(router.getThresholds().execute).toBe(0.99);
    });
  });

  describe("actionRouter singleton", () => {
    it("should be an ActionRouter instance", () => {
      expect(actionRouter).toBeInstanceOf(ActionRouter);
    });
  });

  describe("routeToAction convenience function", () => {
    it("should route using default router", async () => {
      const perception = createMockPerception();
      const result = await routeToAction(perception);
      expect(result.decision).toBeDefined();
    });
  });

  describe("shouldExecuteAction convenience function", () => {
    it("should check execution eligibility", () => {
      const classification = createMockClassification({ confidence: 0.9 });
      const resolution = createMockResolution();
      expect(shouldExecuteAction(classification, resolution)).toBe(true);
    });

    it("should use custom thresholds", () => {
      const classification = createMockClassification({ confidence: 0.9 });
      const resolution = createMockResolution();
      expect(
        shouldExecuteAction(classification, resolution, { execute: 0.95 })
      ).toBe(false);
    });
  });

  describe("needsRoutingClarification convenience function", () => {
    it("should check clarification need", () => {
      const classification = createMockClassification({ confidence: 0.3 });
      const resolution = createMockResolution();
      expect(needsRoutingClarification(classification, resolution)).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Edge Cases and Error Handling
// ─────────────────────────────────────────────────────────────

describe("Edge Cases", () => {
  const router = new ActionRouter();

  it("should handle exactly at threshold boundaries", async () => {
    // Exactly at execute threshold
    const perception1 = createMockPerception({ confidence: 0.85 });
    const result1 = await router.routeToAction(perception1);
    expect(result1.decision.type).toBe("execute_tool");

    // Just below execute threshold
    const perception2 = createMockPerception({ confidence: 0.84 });
    const result2 = await router.routeToAction(perception2);
    expect(result2.decision.type).toBe("confirm_action");
  });

  it("should handle empty suggestions gracefully", async () => {
    const perception = createMockPerception({
      suggestedTool: undefined,
      intent: { category: "unknown", summary: "" },
    });
    const result = await router.routeToAction(perception);
    expect(result.decision.type).toBe("respond");
  });

  it("should mark high-risk tools as requiring approval", async () => {
    const perception = createMockPerception({
      confidence: 0.95,
      suggestedTool: {
        name: "send_email",
        parameters: { to: "test@example.com" },
        confidence: 0.95,
        reasoning: "User wants to send email",
      },
    });
    const result = await router.routeToAction(perception);

    expect(result.decision.type).toBe("execute_tool");
    if (isExecuteDecision(result.decision)) {
      expect(result.decision.requiresApproval).toBe(true);
    }
  });

  it("should include low-confidence assumptions in confirmations", async () => {
    const perception = createMockPerception({
      confidence: 0.7,
      assumptions: [
        {
          statement: "The meeting is tomorrow",
          category: "inference",
          evidence: [],
          confidence: 0.6,
        },
      ],
    });
    const result = await router.routeToAction(perception);

    expect(result.decision.type).toBe("confirm_action");
    if (isConfirmDecision(result.decision)) {
      expect(result.decision.assumptionsToVerify.length).toBeGreaterThan(0);
    }
  });

  it("should generate clarification questions for ambiguous entities", async () => {
    const perception = createMockPerception(
      { confidence: 0.3 },
      {
        ambiguous: [
          {
            extracted: { type: "person", text: "John", value: "John", needsResolution: true },
            status: "ambiguous",
            confidence: 0.5,
            candidates: [
              { id: "1", label: "John Smith", confidence: 0.6 },
              { id: "2", label: "John Doe", confidence: 0.5 },
            ],
          },
        ],
        clarificationQuestions: [
          'Did you mean "John Smith" or "John Doe"?',
        ],
      }
    );
    const result = await router.routeToAction(perception);

    expect(result.decision.type).toBe("clarify");
    if (isClarifyDecision(result.decision)) {
      expect(result.decision.clarificationReason).toBe("ambiguous_entity");
    }
  });
});


