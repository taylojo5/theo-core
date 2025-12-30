// ═══════════════════════════════════════════════════════════════════════════
// Approval System Tests
// Tests for LLM-first approval lifecycle management
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  approvalRepository,
  approvalService,
  runExpirationCheck,
  getDefaultExpirationMs,
  isExpirationWarning,
  getTimeUntilExpiration,
  isPendingApproval,
  isExpiredApproval,
  isActionableApproval,
  hasUserModifications,
  getEffectiveParameters,
  type AgentActionApproval,
  type ApprovalCreateInput,
} from "@/lib/agent/approval";
import { RISK_LEVELS, ACTION_APPROVAL_STATUS } from "@/lib/agent/constants";

// ─────────────────────────────────────────────────────────────
// Mocks
// ─────────────────────────────────────────────────────────────

const mockApprovalRecord = {
  id: "approval-123",
  userId: "user-123",
  planId: "plan-456",
  stepIndex: 0,
  conversationId: "conv-789",
  toolName: "send_email",
  parameters: {
    to: "test@example.com",
    subject: "Test",
    body: "Hello",
    _assumptions: [
      {
        category: "user_intent",
        statement: "User wants to send the email now",
        confidence: 0.9,
        evidence: [],
      },
    ],
    _confidence: 0.85,
    _summary: "external via send_email",
  },
  actionType: "external",
  status: "pending",
  riskLevel: "high",
  reasoning: "User wants to send an email to confirm the meeting",
  requestedAt: new Date(),
  expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours
  decidedAt: null,
  result: null,
  errorMessage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    actionApproval: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    auditLog: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    assumption: {
      findMany: vi.fn(),
    },
  },
}));

// Mock the audit service
vi.mock("@/lib/agent/audit/service", () => ({
  logAgentAction: vi.fn().mockResolvedValue({
    id: "audit-123",
    userId: "user-123",
    status: "pending",
  }),
  completeAuditAction: vi.fn().mockResolvedValue({
    id: "audit-123",
    status: "completed",
  }),
  failAuditAction: vi.fn().mockResolvedValue({
    id: "audit-123",
    status: "failed",
  }),
}));

// Import the mocked modules after mocking
import { db } from "@/lib/db";
import { logAgentAction } from "@/lib/agent/audit/service";

// ─────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────

function createTestApprovalInput(
  overrides: Partial<ApprovalCreateInput> = {}
): ApprovalCreateInput {
  return {
    userId: "user-123",
    toolName: "send_email",
    parameters: { to: "test@example.com", subject: "Test", body: "Hello" },
    actionType: "external",
    riskLevel: RISK_LEVELS.HIGH,
    reasoning: "User wants to send an email to confirm the meeting",
    confidence: 0.85,
    assumptions: [
      {
        category: "intent",
        statement: "User wants to send the email now",
        confidence: 0.9,
        evidence: [],
      },
    ],
    conversationId: "conv-789",
    planId: "plan-456",
    stepIndex: 0,
    ...overrides,
  };
}

function createMockAgentApproval(
  overrides: Partial<AgentActionApproval> = {}
): AgentActionApproval {
  return {
    id: "approval-123",
    userId: "user-123",
    planId: "plan-456",
    stepIndex: 0,
    conversationId: "conv-789",
    toolName: "send_email",
    actionType: "external",
    parameters: { to: "test@example.com", subject: "Test", body: "Hello" },
    reasoning: "User wants to send an email",
    confidence: 0.85,
    assumptions: [
      {
        category: "intent",
        statement: "User wants to send now",
        confidence: 0.9,
        evidence: [],
      },
    ],
    summary: "Send email to test@example.com",
    riskLevel: RISK_LEVELS.HIGH,
    status: ACTION_APPROVAL_STATUS.PENDING,
    requestedAt: new Date(),
    expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────

describe("Approval System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────
  // Type Guard Tests
  // ─────────────────────────────────────────────────────────────

  describe("Type Guards", () => {
    describe("isPendingApproval", () => {
      it("should return true for pending status", () => {
        const approval = createMockAgentApproval({
          status: ACTION_APPROVAL_STATUS.PENDING,
        });
        expect(isPendingApproval(approval)).toBe(true);
      });

      it("should return false for non-pending status", () => {
        const approval = createMockAgentApproval({
          status: ACTION_APPROVAL_STATUS.APPROVED,
        });
        expect(isPendingApproval(approval)).toBe(false);
      });
    });

    describe("isExpiredApproval", () => {
      it("should return true when past expiration date", () => {
        const approval = createMockAgentApproval({
          expiresAt: new Date(Date.now() - 1000), // 1 second ago
        });
        expect(isExpiredApproval(approval)).toBe(true);
      });

      it("should return false when before expiration date", () => {
        const approval = createMockAgentApproval({
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
        });
        expect(isExpiredApproval(approval)).toBe(false);
      });

      it("should return false when no expiration date", () => {
        const approval = createMockAgentApproval({
          expiresAt: undefined,
        });
        expect(isExpiredApproval(approval)).toBe(false);
      });
    });

    describe("isActionableApproval", () => {
      it("should return true for pending and not expired", () => {
        const approval = createMockAgentApproval({
          status: ACTION_APPROVAL_STATUS.PENDING,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });
        expect(isActionableApproval(approval)).toBe(true);
      });

      it("should return false for pending but expired", () => {
        const approval = createMockAgentApproval({
          status: ACTION_APPROVAL_STATUS.PENDING,
          expiresAt: new Date(Date.now() - 1000),
        });
        expect(isActionableApproval(approval)).toBe(false);
      });

      it("should return false for non-pending", () => {
        const approval = createMockAgentApproval({
          status: ACTION_APPROVAL_STATUS.APPROVED,
        });
        expect(isActionableApproval(approval)).toBe(false);
      });
    });

    describe("hasUserModifications", () => {
      it("should return true when modifiedParameters has keys", () => {
        const approval = createMockAgentApproval({
          modifiedParameters: { to: "different@example.com" },
        });
        expect(hasUserModifications(approval)).toBe(true);
      });

      it("should return false when modifiedParameters is undefined", () => {
        const approval = createMockAgentApproval({
          modifiedParameters: undefined,
        });
        expect(hasUserModifications(approval)).toBe(false);
      });

      it("should return false when modifiedParameters is empty", () => {
        const approval = createMockAgentApproval({
          modifiedParameters: {},
        });
        expect(hasUserModifications(approval)).toBe(false);
      });
    });

    describe("getEffectiveParameters", () => {
      it("should merge original and modified parameters", () => {
        const approval = createMockAgentApproval({
          parameters: { to: "original@example.com", subject: "Test" },
          modifiedParameters: { to: "modified@example.com" },
        });

        const effective = getEffectiveParameters(approval);

        expect(effective.to).toBe("modified@example.com");
        expect(effective.subject).toBe("Test");
      });

      it("should return original parameters when no modifications", () => {
        const approval = createMockAgentApproval({
          parameters: { to: "original@example.com" },
          modifiedParameters: undefined,
        });

        const effective = getEffectiveParameters(approval);

        expect(effective.to).toBe("original@example.com");
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Expiration Utility Tests
  // ─────────────────────────────────────────────────────────────

  describe("Expiration Utilities", () => {
    describe("getDefaultExpirationMs", () => {
      it("should return 24 hours for low risk", () => {
        expect(getDefaultExpirationMs(RISK_LEVELS.LOW)).toBe(
          24 * 60 * 60 * 1000
        );
      });

      it("should return 12 hours for medium risk", () => {
        expect(getDefaultExpirationMs(RISK_LEVELS.MEDIUM)).toBe(
          12 * 60 * 60 * 1000
        );
      });

      it("should return 4 hours for high risk", () => {
        expect(getDefaultExpirationMs(RISK_LEVELS.HIGH)).toBe(
          4 * 60 * 60 * 1000
        );
      });

      it("should return 1 hour for critical risk", () => {
        expect(getDefaultExpirationMs(RISK_LEVELS.CRITICAL)).toBe(
          1 * 60 * 60 * 1000
        );
      });
    });

    describe("isExpirationWarning", () => {
      it("should return true when within 30 minutes", () => {
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        expect(isExpirationWarning(expiresAt)).toBe(true);
      });

      it("should return false when more than 30 minutes away", () => {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        expect(isExpirationWarning(expiresAt)).toBe(false);
      });

      it("should return false when already expired", () => {
        const expiresAt = new Date(Date.now() - 1000); // 1 second ago
        expect(isExpirationWarning(expiresAt)).toBe(false);
      });
    });

    describe("getTimeUntilExpiration", () => {
      it("should return hours and minutes for future expiration", () => {
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000 + 30 * 60 * 1000); // 2h 30m
        const result = getTimeUntilExpiration(expiresAt);

        expect(result.hours).toBe(2);
        expect(result.minutes).toBe(30);
        expect(result.isExpired).toBe(false);
      });

      it("should return isExpired true for past expiration", () => {
        const expiresAt = new Date(Date.now() - 1000);
        const result = getTimeUntilExpiration(expiresAt);

        expect(result.isExpired).toBe(true);
        expect(result.hours).toBe(0);
        expect(result.minutes).toBe(0);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Repository Tests
  // ─────────────────────────────────────────────────────────────

  describe("approvalRepository", () => {
    describe("create", () => {
      it("should create an approval record", async () => {
        const input = createTestApprovalInput();
        vi.mocked(db.actionApproval.create).mockResolvedValue(mockApprovalRecord);

        const result = await approvalRepository.create(input);

        expect(db.actionApproval.create).toHaveBeenCalled();
        expect(result.id).toBe("approval-123");
        expect(result.status).toBe("pending");
        expect(result.toolName).toBe("send_email");
      });
    });

    describe("getById", () => {
      it("should retrieve an approval by ID", async () => {
        vi.mocked(db.actionApproval.findUnique).mockResolvedValue(mockApprovalRecord);

        const result = await approvalRepository.getById("approval-123");

        expect(db.actionApproval.findUnique).toHaveBeenCalledWith({
          where: { id: "approval-123" },
        });
        expect(result?.id).toBe("approval-123");
      });

      it("should return null for non-existent approval", async () => {
        vi.mocked(db.actionApproval.findUnique).mockResolvedValue(null);

        const result = await approvalRepository.getById("non-existent");

        expect(result).toBeNull();
      });
    });

    describe("getByIdForUser", () => {
      it("should retrieve approval only if user owns it", async () => {
        vi.mocked(db.actionApproval.findFirst).mockResolvedValue(mockApprovalRecord);

        const result = await approvalRepository.getByIdForUser(
          "user-123",
          "approval-123"
        );

        expect(db.actionApproval.findFirst).toHaveBeenCalledWith({
          where: {
            id: "approval-123",
            userId: "user-123",
          },
        });
        expect(result?.id).toBe("approval-123");
      });

      it("should return null when user does not own approval", async () => {
        vi.mocked(db.actionApproval.findFirst).mockResolvedValue(null);

        const result = await approvalRepository.getByIdForUser(
          "other-user",
          "approval-123"
        );

        expect(result).toBeNull();
      });
    });

    describe("getPending", () => {
      it("should retrieve pending approvals for user", async () => {
        vi.mocked(db.actionApproval.findMany).mockResolvedValue([
          mockApprovalRecord,
          { ...mockApprovalRecord, id: "approval-456" },
        ]);

        const result = await approvalRepository.getPending("user-123");

        expect(result).toHaveLength(2);
        expect(result[0].status).toBe("pending");
      });
    });

    describe("getPendingForPlan", () => {
      it("should retrieve pending approvals for a plan", async () => {
        vi.mocked(db.actionApproval.findMany).mockResolvedValue([mockApprovalRecord]);

        const result = await approvalRepository.getPendingForPlan("plan-456");

        expect(db.actionApproval.findMany).toHaveBeenCalledWith({
          where: {
            planId: "plan-456",
            status: "pending",
          },
          orderBy: {
            stepIndex: "asc",
          },
        });
        expect(result).toHaveLength(1);
      });
    });

    describe("approve", () => {
      it("should approve a pending approval", async () => {
        // Mock findFirst for the initial check
        vi.mocked(db.actionApproval.findFirst).mockResolvedValue(mockApprovalRecord);
        
        // Mock findUnique for the update's pre-fetch
        vi.mocked(db.actionApproval.findUnique).mockResolvedValue(mockApprovalRecord);

        // Mock update for the approval
        const approvedRecord = {
          ...mockApprovalRecord,
          status: "approved",
          decidedAt: new Date(),
        };
        vi.mocked(db.actionApproval.update).mockResolvedValue(approvedRecord);

        const result = await approvalRepository.approve("user-123", "approval-123");

        expect(result?.status).toBe("approved");
      });

      it("should not approve an already decided approval", async () => {
        vi.mocked(db.actionApproval.findFirst).mockResolvedValue({
          ...mockApprovalRecord,
          status: "approved",
        });

        const result = await approvalRepository.approve("user-123", "approval-123");

        expect(result).toBeNull();
      });
    });

    describe("reject", () => {
      it("should reject a pending approval with feedback", async () => {
        vi.mocked(db.actionApproval.findFirst).mockResolvedValue(mockApprovalRecord);
        vi.mocked(db.actionApproval.findUnique).mockResolvedValue(mockApprovalRecord);

        const rejectedRecord = {
          ...mockApprovalRecord,
          status: "rejected",
          decidedAt: new Date(),
        };
        vi.mocked(db.actionApproval.update).mockResolvedValue(rejectedRecord);

        const result = await approvalRepository.reject(
          "user-123",
          "approval-123",
          "Wrong recipient"
        );

        expect(result?.status).toBe("rejected");
      });
    });

    describe("expireStale", () => {
      it("should expire stale approvals", async () => {
        vi.mocked(db.actionApproval.findMany).mockResolvedValue([
          mockApprovalRecord,
        ]);
        vi.mocked(db.actionApproval.updateMany).mockResolvedValue({ count: 1 });

        const result = await approvalRepository.expireStale();

        expect(result.count).toBe(1);
        expect(result.planIds).toContain("plan-456");
      });

      it("should return empty when no stale approvals", async () => {
        vi.mocked(db.actionApproval.findMany).mockResolvedValue([]);

        const result = await approvalRepository.expireStale();

        expect(result.count).toBe(0);
        expect(result.planIds).toHaveLength(0);
      });
    });

    describe("cancelForPlan", () => {
      it("should cancel pending approvals for a plan", async () => {
        vi.mocked(db.actionApproval.updateMany).mockResolvedValue({ count: 2 });

        const result = await approvalRepository.cancelForPlan("plan-456");

        expect(result).toBe(2);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Service Tests
  // ─────────────────────────────────────────────────────────────

  describe("approvalService", () => {
    describe("createApproval", () => {
      it("should create an approval and log the action", async () => {
        const input = createTestApprovalInput();
        vi.mocked(db.actionApproval.create).mockResolvedValue(mockApprovalRecord);
        vi.mocked(db.actionApproval.findUnique).mockResolvedValue(mockApprovalRecord);
        vi.mocked(db.actionApproval.update).mockResolvedValue(mockApprovalRecord);

        const result = await approvalService.createApproval(input);

        expect(result.approval.id).toBe("approval-123");
        expect(result.auditLogId).toBeDefined();
        expect(logAgentAction).toHaveBeenCalled();
      });
    });

    describe("getApproval", () => {
      it("should get an approval for a user", async () => {
        vi.mocked(db.actionApproval.findFirst).mockResolvedValue(mockApprovalRecord);

        const result = await approvalService.getApproval("user-123", "approval-123");

        expect(result?.id).toBe("approval-123");
      });
    });

    describe("getPendingApprovals", () => {
      it("should get pending approvals for a user", async () => {
        vi.mocked(db.actionApproval.findMany).mockResolvedValue([mockApprovalRecord]);

        const result = await approvalService.getPendingApprovals("user-123");

        expect(result).toHaveLength(1);
        expect(result[0].status).toBe("pending");
      });
    });

    describe("processApprovalDecision", () => {
      beforeEach(() => {
        vi.mocked(db.actionApproval.findFirst).mockResolvedValue(mockApprovalRecord);
        vi.mocked(db.actionApproval.findUnique).mockResolvedValue(mockApprovalRecord);
      });

      it("should approve an action", async () => {
        const approvedRecord = {
          ...mockApprovalRecord,
          status: "approved",
          decidedAt: new Date(),
        };
        vi.mocked(db.actionApproval.update).mockResolvedValue(approvedRecord);

        const result = await approvalService.processApprovalDecision(
          "user-123",
          "approval-123",
          "approve"
        );

        expect(result?.approval.status).toBe("approved");
        expect(result?.shouldExecute).toBe(true);
      });

      it("should reject an action with feedback", async () => {
        const rejectedRecord = {
          ...mockApprovalRecord,
          status: "rejected",
          decidedAt: new Date(),
        };
        vi.mocked(db.actionApproval.update).mockResolvedValue(rejectedRecord);

        const result = await approvalService.processApprovalDecision(
          "user-123",
          "approval-123",
          "reject",
          { feedback: "Wrong recipient" }
        );

        expect(result?.approval.status).toBe("rejected");
        expect(result?.shouldExecute).toBe(false);
      });

      it("should include plan resumption info when part of plan", async () => {
        const approvedRecord = {
          ...mockApprovalRecord,
          status: "approved",
          decidedAt: new Date(),
        };
        vi.mocked(db.actionApproval.update).mockResolvedValue(approvedRecord);

        const result = await approvalService.processApprovalDecision(
          "user-123",
          "approval-123",
          "approve"
        );

        expect(result?.planResumption).toBeDefined();
        expect(result?.planResumption?.planId).toBe("plan-456");
        expect(result?.planResumption?.stepIndex).toBe(0);
      });

      it("should return null for non-existent approval", async () => {
        vi.mocked(db.actionApproval.findFirst).mockResolvedValue(null);

        const result = await approvalService.processApprovalDecision(
          "user-123",
          "non-existent",
          "approve"
        );

        expect(result).toBeNull();
      });

      it("should return null for already decided approval", async () => {
        vi.mocked(db.actionApproval.findFirst).mockResolvedValue({
          ...mockApprovalRecord,
          status: "approved",
        });

        const result = await approvalService.processApprovalDecision(
          "user-123",
          "approval-123",
          "approve"
        );

        expect(result).toBeNull();
      });

      it("should return null for expired approval", async () => {
        vi.mocked(db.actionApproval.findFirst).mockResolvedValue({
          ...mockApprovalRecord,
          expiresAt: new Date(Date.now() - 1000), // Expired
        });

        const result = await approvalService.processApprovalDecision(
          "user-123",
          "approval-123",
          "approve"
        );

        expect(result).toBeNull();
      });
    });

    describe("formatApprovalForDisplay", () => {
      it("should format approval for UI display", () => {
        const approval = createMockAgentApproval();

        const display = approvalService.formatApprovalForDisplay(approval);

        expect(display.id).toBe(approval.id);
        expect(display.toolName).toBe(approval.toolName);
        expect(display.confidencePercent).toBe(85);
        expect(display.riskLevel).toBe(RISK_LEVELS.HIGH);
      });

      it("should indicate urgency when expiring soon", () => {
        const approval = createMockAgentApproval({
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        });

        const display = approvalService.formatApprovalForDisplay(approval);

        expect(display.isUrgent).toBe(true);
        expect(display.expiresIn).toBeDefined();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Expiration Check Tests
  // ─────────────────────────────────────────────────────────────

  describe("runExpirationCheck", () => {
    it("should expire stale approvals", async () => {
      vi.mocked(db.actionApproval.findMany).mockResolvedValue([mockApprovalRecord]);
      vi.mocked(db.actionApproval.updateMany).mockResolvedValue({ count: 1 });

      const result = await runExpirationCheck();

      expect(result.expiredCount).toBe(1);
    });

    it("should handle no stale approvals", async () => {
      vi.mocked(db.actionApproval.findMany).mockResolvedValue([]);

      const result = await runExpirationCheck();

      expect(result.expiredCount).toBe(0);
    });
  });
});
