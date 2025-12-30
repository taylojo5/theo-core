// ═══════════════════════════════════════════════════════════════════════════
// Plan Repository
// CRUD operations for AgentPlan and AgentPlanStep database models
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { PLAN_STATUS, STEP_STATUS } from "../constants";
import { agentLogger } from "../logger";
import { PlanningError } from "./types";
import type {
  StructuredPlan,
  StructuredStep,
  StoredAssumption,
  CreatePlanInput,
  UpdatePlanStatusInput,
  UpdateStepStatusInput,
  PlanQueryOptions,
  PlanQueryResult,
  RollbackAction,
} from "./types";
import type { PlanStatus, StepStatus } from "../constants";

const logger = agentLogger.child("plan-repository");

// ─────────────────────────────────────────────────────────────
// Type Definitions for Prisma Models
// ─────────────────────────────────────────────────────────────

interface DbPlan {
  id: string;
  userId: string;
  conversationId: string | null;
  goal: string;
  goalType: string;
  status: string;
  currentStep: number;
  requiresApproval: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
  // LLM Metadata
  reasoning: string | null;
  confidence: number;
  assumptions: unknown;
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

interface DbStep {
  id: string;
  planId: string;
  stepOrder: number;
  dependsOn: string[];
  toolName: string;
  toolParams: unknown;
  description: string;
  requiresApproval: boolean;
  status: string;
  errorMessage: string | null;
  approvalId: string | null;
  result: unknown;
  rollbackAction: unknown;
  rolledBackAt: Date | null;
  createdAt: Date;
  executedAt: Date | null;
}

interface DbPlanWithSteps extends DbPlan {
  steps: DbStep[];
}

// ─────────────────────────────────────────────────────────────
// Repository Object
// ─────────────────────────────────────────────────────────────

export const planRepository = {
  // ─────────────────────────────────────────────────────────────
  // Create Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a new plan with steps
   */
  async create(input: CreatePlanInput): Promise<StructuredPlan> {
    logger.debug("Creating plan", { userId: input.userId, goal: input.goal });

    // Convert assumptions to stored format with IDs before saving
    const storedAssumptions: StoredAssumption[] = input.assumptions.map((a, i) => ({
      ...a,
      id: `assumption-temp-${i}`, // Will be replaced with real ID after plan creation
    }));

    const plan = await db.agentPlan.create({
      data: {
        userId: input.userId,
        goal: input.goal,
        goalType: input.goalType,
        status: PLAN_STATUS.PLANNED,
        currentStep: 0,
        requiresApproval: input.requiresApproval,
        conversationId: input.conversationId,
        // LLM Metadata
        reasoning: input.reasoning,
        confidence: input.confidence,
        assumptions: storedAssumptions as unknown as Prisma.InputJsonValue,
        steps: {
          create: input.steps.map((step) => ({
            stepOrder: step.stepOrder,
            toolName: step.toolName,
            toolParams: step.toolParams as Prisma.InputJsonValue,
            dependsOn: step.dependsOn,
            description: step.description,
            requiresApproval: step.requiresApproval,
            status: STEP_STATUS.PENDING,
            rollbackAction: step.rollbackAction
              ? (step.rollbackAction as unknown as Prisma.InputJsonValue)
              : undefined,
          })),
        },
      },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
      },
    });

    const planWithSteps = plan as DbPlanWithSteps;
    logger.info("Plan created", { planId: plan.id, stepCount: planWithSteps.steps.length });

    // Update assumption IDs with the actual plan ID
    const finalAssumptions: StoredAssumption[] = storedAssumptions.map((a, i) => ({
      ...a,
      id: `assumption-${plan.id}-${i}`,
    }));

    // Update the stored assumptions with correct IDs
    await db.agentPlan.update({
      where: { id: plan.id },
      data: {
        assumptions: finalAssumptions as unknown as Prisma.InputJsonValue,
      },
    });

    return mapDbPlanToStructured(planWithSteps, finalAssumptions);
  },

  // ─────────────────────────────────────────────────────────────
  // Read Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Get a plan by ID
   */
  async getById(planId: string, includeSteps = true): Promise<StructuredPlan | null> {
    const plan = await db.agentPlan.findUnique({
      where: { id: planId },
      include: includeSteps
        ? {
            steps: {
              orderBy: { stepOrder: "asc" },
            },
          }
        : undefined,
    });

    if (!plan) {
      return null;
    }

    return mapDbPlanToStructured(plan as DbPlanWithSteps);
  },

  /**
   * Get a plan by ID, ensuring it belongs to the user
   */
  async getByIdForUser(
    planId: string,
    userId: string,
    includeSteps = true
  ): Promise<StructuredPlan | null> {
    const plan = await db.agentPlan.findFirst({
      where: { id: planId, userId },
      include: includeSteps
        ? {
            steps: {
              orderBy: { stepOrder: "asc" },
            },
          }
        : undefined,
    });

    if (!plan) {
      return null;
    }

    return mapDbPlanToStructured(plan as DbPlanWithSteps);
  },

  /**
   * Query plans with filters
   */
  async query(options: PlanQueryOptions): Promise<PlanQueryResult> {
    const where: Record<string, unknown> = {};

    if (options.userId) {
      where.userId = options.userId;
    }

    if (options.conversationId) {
      where.conversationId = options.conversationId;
    }

    if (options.status) {
      where.status = Array.isArray(options.status)
        ? { in: options.status }
        : options.status;
    }

    const [plans, total] = await Promise.all([
      db.agentPlan.findMany({
        where,
        include: options.includeSteps
          ? {
              steps: {
                orderBy: { stepOrder: "asc" },
              },
            }
          : undefined,
        orderBy: {
          [options.orderBy || "createdAt"]: options.orderDirection || "desc",
        },
        take: options.limit,
        skip: options.offset,
      }),
      db.agentPlan.count({ where }),
    ]);

    const hasMore = options.limit
      ? (options.offset || 0) + plans.length < total
      : false;

    return {
      plans: plans.map((p) => mapDbPlanToStructured(p as DbPlanWithSteps)),
      total,
      hasMore,
    };
  },

  /**
   * Get plans by user ID
   */
  async getByUserId(
    userId: string,
    options?: Partial<PlanQueryOptions>
  ): Promise<StructuredPlan[]> {
    const result = await this.query({
      ...options,
      userId,
    });
    return result.plans;
  },

  /**
   * Get active plans for a user (planned or executing)
   */
  async getActivePlans(userId: string): Promise<StructuredPlan[]> {
    return this.getByUserId(userId, {
      status: [PLAN_STATUS.PLANNED, PLAN_STATUS.EXECUTING, PLAN_STATUS.PAUSED],
      includeSteps: true,
    });
  },

  /**
   * Get plans by conversation ID
   */
  async getByConversationId(conversationId: string): Promise<StructuredPlan[]> {
    const result = await this.query({
      conversationId,
      includeSteps: true,
    });
    return result.plans;
  },

  // ─────────────────────────────────────────────────────────────
  // Update Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Update plan status
   */
  async updateStatus(
    planId: string,
    input: UpdatePlanStatusInput
  ): Promise<StructuredPlan> {
    logger.debug("Updating plan status", { planId, status: input.status });

    const plan = await db.agentPlan.update({
      where: { id: planId },
      data: {
        status: input.status,
        currentStep: input.currentStep,
        approvedAt: input.approvedAt,
        approvedBy: input.approvedBy,
        completedAt: input.completedAt,
      },
      include: {
        steps: {
          orderBy: { stepOrder: "asc" },
        },
      },
    });

    logger.info("Plan status updated", { planId, status: input.status });

    return mapDbPlanToStructured(plan as DbPlanWithSteps);
  },

  /**
   * Update current step index
   */
  async updateCurrentStep(planId: string, stepIndex: number): Promise<void> {
    await db.agentPlan.update({
      where: { id: planId },
      data: { currentStep: stepIndex },
    });
  },

  /**
   * Update step status
   */
  async updateStepStatus(
    stepId: string,
    input: UpdateStepStatusInput
  ): Promise<StructuredStep> {
    logger.debug("Updating step status", { stepId, status: input.status });

    const step = await db.agentPlanStep.update({
      where: { id: stepId },
      data: {
        status: input.status,
        result: input.result !== undefined
          ? (input.result as Prisma.InputJsonValue)
          : undefined,
        errorMessage: input.errorMessage,
        executedAt: input.executedAt,
        rolledBackAt: input.rolledBackAt,
        approvalId: input.approvalId,
      },
    });

    logger.info("Step status updated", { stepId, status: input.status });

    // Build step ID to index mapping for proper dependsOnIndices resolution
    const stepIdToIndex = await buildStepIdToIndexMap(step.planId);

    return mapDbStepToStructured(step as DbStep, stepIdToIndex);
  },

  /**
   * Mark a step as requiring approval
   */
  async markStepAwaitingApproval(
    stepId: string,
    approvalId: string
  ): Promise<void> {
    await db.agentPlanStep.update({
      where: { id: stepId },
      data: {
        status: STEP_STATUS.AWAITING_APPROVAL,
        approvalId,
      },
    });
  },

  // ─────────────────────────────────────────────────────────────
  // Status Transition Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Start plan execution
   */
  async startExecution(planId: string): Promise<StructuredPlan> {
    const plan = await this.getById(planId);
    if (!plan) {
      throw new PlanningError(
        "plan_not_found",
        `Plan ${planId} not found`,
        planId
      );
    }

    if (plan.status !== PLAN_STATUS.PLANNED && plan.status !== PLAN_STATUS.PAUSED) {
      throw new PlanningError(
        "invalid_state_transition",
        `Cannot start execution of plan in status: ${plan.status}`,
        planId
      );
    }

    return this.updateStatus(planId, { status: PLAN_STATUS.EXECUTING });
  },

  /**
   * Pause plan execution
   */
  async pauseExecution(planId: string): Promise<StructuredPlan> {
    return this.updateStatus(planId, { status: PLAN_STATUS.PAUSED });
  },

  /**
   * Complete plan execution
   */
  async completePlan(planId: string): Promise<StructuredPlan> {
    return this.updateStatus(planId, {
      status: PLAN_STATUS.COMPLETED,
      completedAt: new Date(),
    });
  },

  /**
   * Fail plan execution
   */
  async failPlan(planId: string): Promise<StructuredPlan> {
    return this.updateStatus(planId, { status: PLAN_STATUS.FAILED });
  },

  /**
   * Cancel plan execution
   */
  async cancelPlan(planId: string): Promise<StructuredPlan> {
    return this.updateStatus(planId, { status: PLAN_STATUS.CANCELLED });
  },

  /**
   * Approve a plan
   */
  async approvePlan(planId: string, approvedBy: string): Promise<StructuredPlan> {
    return this.updateStatus(planId, {
      status: PLAN_STATUS.EXECUTING,
      approvedAt: new Date(),
      approvedBy,
    });
  },

  // ─────────────────────────────────────────────────────────────
  // Step Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Get a step by ID
   */
  async getStepById(stepId: string): Promise<StructuredStep | null> {
    const step = await db.agentPlanStep.findUnique({
      where: { id: stepId },
    });

    if (!step) {
      return null;
    }

    // Build step ID to index mapping for proper dependsOnIndices resolution
    const stepIdToIndex = await buildStepIdToIndexMap(step.planId);

    return mapDbStepToStructured(step as DbStep, stepIdToIndex);
  },

  /**
   * Get steps for a plan
   */
  async getStepsForPlan(planId: string): Promise<StructuredStep[]> {
    const steps = await db.agentPlanStep.findMany({
      where: { planId },
      orderBy: { stepOrder: "asc" },
    });

    // Build step ID to index mapping from the fetched steps
    // Maps to array indices (positions), not stepOrder values
    const stepIdToIndex = new Map<string, number>();
    for (let i = 0; i < steps.length; i++) {
      stepIdToIndex.set(steps[i].id, i);
    }

    return steps.map((s) => mapDbStepToStructured(s as DbStep, stepIdToIndex));
  },

  /**
   * Start step execution
   */
  async startStepExecution(stepId: string): Promise<StructuredStep> {
    return this.updateStepStatus(stepId, {
      status: STEP_STATUS.EXECUTING,
    });
  },

  /**
   * Complete step execution
   */
  async completeStep(stepId: string, result: unknown): Promise<StructuredStep> {
    return this.updateStepStatus(stepId, {
      status: STEP_STATUS.COMPLETED,
      result,
      executedAt: new Date(),
    });
  },

  /**
   * Fail step execution
   */
  async failStep(stepId: string, errorMessage: string): Promise<StructuredStep> {
    return this.updateStepStatus(stepId, {
      status: STEP_STATUS.FAILED,
      errorMessage,
      executedAt: new Date(),
    });
  },

  /**
   * Skip a step
   */
  async skipStep(stepId: string): Promise<StructuredStep> {
    return this.updateStepStatus(stepId, {
      status: STEP_STATUS.SKIPPED,
    });
  },

  /**
   * Mark step as rolled back
   */
  async rollbackStep(stepId: string): Promise<StructuredStep> {
    return this.updateStepStatus(stepId, {
      status: STEP_STATUS.ROLLED_BACK,
      rolledBackAt: new Date(),
    });
  },

  // ─────────────────────────────────────────────────────────────
  // Delete Operations
  // ─────────────────────────────────────────────────────────────

  /**
   * Delete a plan (cascades to steps)
   */
  async delete(planId: string): Promise<void> {
    await db.agentPlan.delete({
      where: { id: planId },
    });

    logger.info("Plan deleted", { planId });
  },

  /**
   * Delete plans older than a given date
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const result = await db.agentPlan.deleteMany({
      where: {
        createdAt: { lt: date },
        status: { in: [PLAN_STATUS.COMPLETED, PLAN_STATUS.FAILED, PLAN_STATUS.CANCELLED] },
      },
    });

    logger.info("Deleted old plans", { count: result.count });

    return result.count;
  },

  // ─────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────

  /**
   * Get plan statistics for a user
   */
  async getStats(userId: string): Promise<PlanStats> {
    const [total, byStatus] = await Promise.all([
      db.agentPlan.count({ where: { userId } }),
      db.agentPlan.groupBy({
        by: ["status"],
        where: { userId },
        _count: { _all: true },
      }),
    ]);

    const statusCounts: Record<string, number> = {};
    for (const row of byStatus) {
      // Prisma groupBy with _count returns { _all: number }, not a plain number
      statusCounts[row.status] = row._count._all;
    }

    return {
      total,
      byStatus: {
        planned: statusCounts[PLAN_STATUS.PLANNED] || 0,
        executing: statusCounts[PLAN_STATUS.EXECUTING] || 0,
        paused: statusCounts[PLAN_STATUS.PAUSED] || 0,
        completed: statusCounts[PLAN_STATUS.COMPLETED] || 0,
        failed: statusCounts[PLAN_STATUS.FAILED] || 0,
        cancelled: statusCounts[PLAN_STATUS.CANCELLED] || 0,
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Helper Types
// ─────────────────────────────────────────────────────────────

interface PlanStats {
  total: number;
  byStatus: Record<PlanStatus, number>;
}

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Build a mapping of step IDs to array indices for a given plan
 * Used to reconstruct dependsOnIndices when fetching individual steps
 * Note: Returns array indices (positions after sorting), NOT stepOrder values
 */
async function buildStepIdToIndexMap(planId: string): Promise<Map<string, number>> {
  const steps = await db.agentPlanStep.findMany({
    where: { planId },
    select: { id: true, stepOrder: true },
    orderBy: { stepOrder: "asc" },
  });

  // Map step IDs to their array positions (indices), not stepOrder values
  const stepIdToIndex = new Map<string, number>();
  for (let i = 0; i < steps.length; i++) {
    stepIdToIndex.set(steps[i].id, i);
  }
  return stepIdToIndex;
}

// ─────────────────────────────────────────────────────────────
// Mapping Functions
// ─────────────────────────────────────────────────────────────

/**
 * Map database plan to structured plan
 * 
 * ## Database to Domain Model Mapping
 * 
 * This function transforms the Prisma `AgentPlan` model into the domain
 * `StructuredPlan` type used throughout the planning module.
 * 
 * Key field mappings:
 * - `AgentPlanStep.stepOrder` → `StructuredStep.index`
 * - `AgentPlan.currentStep` → `StructuredPlan.currentStepIndex`
 * - `AgentPlanStep.dependsOn` (step IDs) → `StructuredStep.dependsOnIndices` (positions)
 * 
 * The `dependsOnIndices` field is derived by mapping step IDs to their
 * array positions (after sorting by stepOrder). This allows algorithms
 * like topological sort to work with simple integer indices.
 * 
 * @param dbPlan - Database plan with steps included
 * @param overrideAssumptions - Optional pre-parsed assumptions (used during creation)
 * @returns Domain model representation of the plan
 */
function mapDbPlanToStructured(
  dbPlan: DbPlanWithSteps,
  overrideAssumptions?: StoredAssumption[]
): StructuredPlan {
  // Build a mapping of step IDs to array indices for resolving dependsOnIndices
  // Note: We map to array indices (positions after sorting), NOT to stepOrder values
  // This ensures getExecutionOrder works correctly even with non-sequential stepOrder values
  const stepIdToIndex = new Map<string, number>();
  if (dbPlan.steps) {
    // Steps are already sorted by stepOrder from the query
    for (let i = 0; i < dbPlan.steps.length; i++) {
      stepIdToIndex.set(dbPlan.steps[i].id, i);
    }
  }

  const steps = dbPlan.steps?.map((s) => mapDbStepToStructured(s, stepIdToIndex)) || [];

  // Parse assumptions from JSON or use override (for create flow before DB update)
  let assumptions: StoredAssumption[] = [];
  if (overrideAssumptions) {
    assumptions = overrideAssumptions;
  } else if (dbPlan.assumptions && Array.isArray(dbPlan.assumptions)) {
    assumptions = (dbPlan.assumptions as unknown[]).map((a) => {
      const assumptionData = a as Record<string, unknown>;
      return {
        id: String(assumptionData.id || ""),
        statement: String(assumptionData.statement || ""),
        category: (assumptionData.category as "intent" | "context" | "preference" | "inference") || "inference",
        evidence: Array.isArray(assumptionData.evidence)
          ? assumptionData.evidence.map(String)
          : [],
        confidence: Number(assumptionData.confidence ?? 0.5),
        verified: Boolean(assumptionData.verified),
        verifiedAt: assumptionData.verifiedAt
          ? new Date(String(assumptionData.verifiedAt))
          : undefined,
        correction: assumptionData.correction
          ? String(assumptionData.correction)
          : undefined,
      };
    });
  }

  return {
    id: dbPlan.id,
    userId: dbPlan.userId,
    goal: dbPlan.goal,
    goalType: dbPlan.goalType,
    status: dbPlan.status as PlanStatus,
    steps,
    currentStepIndex: dbPlan.currentStep,
    requiresApproval: dbPlan.requiresApproval,
    reasoning: dbPlan.reasoning || "",
    assumptions,
    confidence: dbPlan.confidence,
    conversationId: dbPlan.conversationId || undefined,
    approvedAt: dbPlan.approvedAt || undefined,
    approvedBy: dbPlan.approvedBy || undefined,
    createdAt: dbPlan.createdAt,
    updatedAt: dbPlan.updatedAt,
    completedAt: dbPlan.completedAt || undefined,
  };
}

/**
 * Map database step to structured step
 * 
 * ## Field Mapping Details
 * 
 * | Database Field | Domain Field | Notes |
 * |----------------|--------------|-------|
 * | `stepOrder`    | `index`      | 0-based execution order |
 * | `dependsOn`    | `dependsOn`  | Array of step UUIDs |
 * | (derived)      | `dependsOnIndices` | Array of step indices |
 * | `toolParams`   | `parameters` | JSON → Record mapping |
 * | `rollbackAction` | `rollbackAction` | JSON → typed object |
 * 
 * The `dependsOnIndices` field is computed by looking up each step ID
 * in the `stepIdToIndex` map, which contains the array position of each
 * step after sorting by stepOrder.
 * 
 * @param dbStep - Database step record from Prisma
 * @param stepIdToIndex - Map of step IDs to their 0-based array positions.
 *   Required for computing `dependsOnIndices`. When undefined, `dependsOnIndices`
 *   will be an empty array.
 * @returns Domain model representation of the step
 */
function mapDbStepToStructured(
  dbStep: DbStep,
  stepIdToIndex?: Map<string, number>
): StructuredStep {
  // Parse rollback action from JSON
  let rollbackAction: RollbackAction | undefined;
  if (dbStep.rollbackAction && typeof dbStep.rollbackAction === "object") {
    const rb = dbStep.rollbackAction as Record<string, unknown>;
    if (rb.toolName && typeof rb.toolName === "string") {
      rollbackAction = {
        toolName: rb.toolName,
        parameters: (rb.parameters as Record<string, unknown>) || {},
      };
    }
  }

  // Reconstruct dependsOnIndices from step IDs using the provided mapping.
  // - dependsOn: array of step UUIDs (preserved from database)
  // - dependsOnIndices: array of 0-based positions (derived for convenience)
  const dependsOnIndices: number[] = [];
  if (stepIdToIndex && dbStep.dependsOn) {
    for (const depId of dbStep.dependsOn) {
      const index = stepIdToIndex.get(depId);
      if (index !== undefined) {
        dependsOnIndices.push(index);
      }
    }
  }

  return {
    id: dbStep.id,
    planId: dbStep.planId,
    // stepOrder becomes index - see StructuredStep documentation for details
    index: dbStep.stepOrder,
    toolName: dbStep.toolName,
    parameters: (dbStep.toolParams as Record<string, unknown>) || {},
    dependsOn: dbStep.dependsOn,
    dependsOnIndices,
    description: dbStep.description,
    status: dbStep.status as StepStatus,
    requiresApproval: dbStep.requiresApproval,
    approvalId: dbStep.approvalId || undefined,
    rollbackAction,
    result: dbStep.result || undefined,
    errorMessage: dbStep.errorMessage || undefined,
    rolledBackAt: dbStep.rolledBackAt || undefined,
    createdAt: dbStep.createdAt,
    executedAt: dbStep.executedAt || undefined,
  };
}

