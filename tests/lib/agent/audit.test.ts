// ═══════════════════════════════════════════════════════════════════════════
// Agent Audit Tests
// Tests for the Agent Engine audit trail system
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import type { AuditLog, AgentAssumption } from "@prisma/client";

// Mock the database
vi.mock("@/lib/db", () => ({
  db: {
    auditLog: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    agentAssumption: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Import after mocking
import { auditLogRepository, assumptionRepository } from "@/lib/agent/audit/repository";
import {
  auditService,
  logAgentAction,
  startAuditAction,
  completeAuditAction,
  failAuditAction,
  withAuditTrail,
  queryAuditLog,
  getAuditEntry,
  getEntityAuditTrail,
  getRecentActions,
  queryAssumptions,
  getAssumptionsForAction,
  getUnverifiedAssumptions,
  verifyAssumption,
  getAuditStats,
} from "@/lib/agent/audit/service";
import type {
  AuditLogCreateInput,
  AuditLogWithAssumptions,
  AssumptionRecord,
  AuditQueryOptions,
} from "@/lib/agent/audit/types";

// ─────────────────────────────────────────────────────────────
// Test Data Factories
// ─────────────────────────────────────────────────────────────

type AuditLogWithRelations = AuditLog & { assumptions?: AgentAssumption[] };

const createMockAuditLog = (
  overrides: Partial<AuditLogWithRelations> = {}
): AuditLogWithRelations => ({
  id: "audit-123",
  userId: "user-123",
  sessionId: "session-123",
  conversationId: "conv-123",
  actionType: "query",
  actionCategory: "context",
  entityType: null,
  entityId: null,
  entitySnapshot: null,
  intent: "Find upcoming meetings",
  reasoning: "User asked about schedule",
  confidence: new Prisma.Decimal(0.85),
  inputSummary: "What's on my calendar?",
  outputSummary: "Found 3 meetings",
  metadata: {},
  status: "completed",
  errorMessage: null,
  startedAt: new Date("2024-01-01T10:00:00Z"),
  completedAt: new Date("2024-01-01T10:00:01Z"),
  durationMs: 1000,
  createdAt: new Date("2024-01-01T10:00:00Z"),
  assumptions: [], // Include by default for findMany with include
  ...overrides,
});

const createMockAssumption = (
  overrides: Partial<AgentAssumption> = {}
): AgentAssumption => ({
  id: "assumption-123",
  auditLogId: "audit-123",
  assumption: "User wants to see today's calendar",
  category: "intent",
  evidence: [{ source: "user_input", content: "calendar", weight: 0.8 }],
  confidence: new Prisma.Decimal(0.75),
  verified: null,
  verifiedAt: null,
  verifiedBy: null,
  correction: null,
  createdAt: new Date("2024-01-01T10:00:00Z"),
  ...overrides,
});

// ─────────────────────────────────────────────────────────────
// Repository Tests
// ─────────────────────────────────────────────────────────────

describe("auditLogRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create an audit log entry with pending status", async () => {
      const mockEntry = createMockAuditLog({ status: "pending" });
      vi.mocked(db.auditLog.create).mockResolvedValue(mockEntry);

      const input: AuditLogCreateInput = {
        userId: "user-123",
        actionType: "query",
        actionCategory: "context",
        intent: "Find meetings",
      };

      const result = await auditLogRepository.create(input);

      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-123",
          actionType: "query",
          actionCategory: "context",
          status: "pending",
        }),
      });
      expect(result.id).toBe("audit-123");
    });
  });

  describe("createCompleted", () => {
    it("should create a completed audit log entry with duration", async () => {
      const mockEntry = createMockAuditLog({ status: "completed" });
      vi.mocked(db.auditLog.create).mockResolvedValue(mockEntry);

      const input: AuditLogCreateInput = {
        userId: "user-123",
        actionType: "query",
        actionCategory: "context",
      };

      const result = await auditLogRepository.createCompleted(input);

      expect(db.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: "user-123",
          status: "completed",
          completedAt: expect.any(Date),
          durationMs: expect.any(Number),
        }),
      });
      expect(result.status).toBe("completed");
    });
  });

  describe("complete", () => {
    it("should complete a pending entry with duration calculation", async () => {
      const pendingEntry = createMockAuditLog({
        status: "pending",
        completedAt: null,
      });
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(pendingEntry);
      vi.mocked(db.auditLog.update).mockResolvedValue({
        ...pendingEntry,
        status: "completed",
        completedAt: new Date(),
        durationMs: 500,
      });

      const result = await auditLogRepository.complete("audit-123", {
        status: "completed",
        reasoning: "Operation successful",
      });

      expect(db.auditLog.update).toHaveBeenCalledWith({
        where: { id: "audit-123" },
        data: expect.objectContaining({
          status: "completed",
          reasoning: "Operation successful",
          completedAt: expect.any(Date),
          durationMs: expect.any(Number),
        }),
      });
    });

    it("should throw if entry not found", async () => {
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(null);

      await expect(
        auditLogRepository.complete("nonexistent", {})
      ).rejects.toThrow("Audit log entry not found: nonexistent");
    });
  });

  describe("fail", () => {
    it("should mark entry as failed with error message", async () => {
      const pendingEntry = createMockAuditLog({ status: "pending" });
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(pendingEntry);
      vi.mocked(db.auditLog.update).mockResolvedValue({
        ...pendingEntry,
        status: "failed",
        errorMessage: "Connection timeout",
      });

      const result = await auditLogRepository.fail("audit-123", "Connection timeout");

      expect(db.auditLog.update).toHaveBeenCalledWith({
        where: { id: "audit-123" },
        data: expect.objectContaining({
          status: "failed",
          errorMessage: "Connection timeout",
        }),
      });
    });
  });

  describe("findByUser", () => {
    it("should query with all filter options", async () => {
      const mockEntry = createMockAuditLog();
      vi.mocked(db.auditLog.findMany).mockResolvedValue([mockEntry]);
      vi.mocked(db.auditLog.count).mockResolvedValue(1);

      const options: AuditQueryOptions = {
        userId: "user-123",
        actionTypes: ["query", "create"],
        actionCategories: ["context"],
        dateRange: {
          start: new Date("2024-01-01"),
          end: new Date("2024-01-31"),
        },
        limit: 10,
        offset: 0,
      };

      const result = await auditLogRepository.findByUser(options);

      expect(db.auditLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          userId: "user-123",
          actionType: { in: ["query", "create"] },
          actionCategory: { in: ["context"] },
          createdAt: {
            gte: options.dateRange!.start,
            lte: options.dateRange!.end,
          },
        }),
        include: { assumptions: true },
        orderBy: { createdAt: "desc" },
        take: 10,
        skip: 0,
      });
      expect(result.entries).toHaveLength(1);
      expect(result.totalCount).toBe(1);
    });
  });

  describe("findByEntity", () => {
    it("should find audit entries for a specific entity", async () => {
      const mockEntry = createMockAuditLog({
        entityType: "event",
        entityId: "event-456",
      });
      vi.mocked(db.auditLog.findMany).mockResolvedValue([mockEntry]);

      const result = await auditLogRepository.findByEntity(
        "user-123",
        "event",
        "event-456"
      );

      expect(db.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          userId: "user-123",
          entityType: "event",
          entityId: "event-456",
        },
        include: { assumptions: true },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(1);
    });
  });
});

describe("assumptionRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create an assumption with evidence", async () => {
      const mockAssumption = createMockAssumption();
      vi.mocked(db.agentAssumption.create).mockResolvedValue(mockAssumption);

      const result = await assumptionRepository.create({
        auditLogId: "audit-123",
        assumption: "User wants today's calendar",
        category: "intent",
        evidence: [{ source: "user_input", content: "calendar", weight: 0.8 }],
        confidence: 0.75,
      });

      expect(db.agentAssumption.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          auditLogId: "audit-123",
          assumption: "User wants today's calendar",
          category: "intent",
          confidence: 0.75,
        }),
      });
      expect(result.id).toBe("assumption-123");
    });
  });

  describe("createMany", () => {
    it("should create multiple assumptions in a transaction", async () => {
      const mockAssumptions = [
        createMockAssumption({ id: "a1" }),
        createMockAssumption({ id: "a2" }),
      ];
      vi.mocked(db.$transaction).mockResolvedValue(mockAssumptions);

      const result = await assumptionRepository.createMany("audit-123", [
        {
          assumption: "Assumption 1",
          category: "intent",
          evidence: [],
          confidence: 0.8,
        },
        {
          assumption: "Assumption 2",
          category: "context",
          evidence: [],
          confidence: 0.7,
        },
      ]);

      expect(db.$transaction).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it("should return empty array for empty input", async () => {
      const result = await assumptionRepository.createMany("audit-123", []);

      expect(db.$transaction).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe("verify", () => {
    it("should verify an assumption as correct", async () => {
      const mockAssumption = createMockAssumption({
        verified: true,
        verifiedAt: new Date(),
        verifiedBy: "user",
      });
      vi.mocked(db.agentAssumption.update).mockResolvedValue(mockAssumption);

      const result = await assumptionRepository.verify("assumption-123", {
        verified: true,
        verifiedBy: "user",
      });

      expect(db.agentAssumption.update).toHaveBeenCalledWith({
        where: { id: "assumption-123" },
        data: {
          verified: true,
          verifiedAt: expect.any(Date),
          verifiedBy: "user",
          correction: undefined,
        },
      });
    });

    it("should verify an assumption as incorrect with correction", async () => {
      const mockAssumption = createMockAssumption({
        verified: false,
        verifiedAt: new Date(),
        verifiedBy: "user",
        correction: "User actually wanted tomorrow's calendar",
      });
      vi.mocked(db.agentAssumption.update).mockResolvedValue(mockAssumption);

      await assumptionRepository.verify("assumption-123", {
        verified: false,
        verifiedBy: "user",
        correction: "User actually wanted tomorrow's calendar",
      });

      expect(db.agentAssumption.update).toHaveBeenCalledWith({
        where: { id: "assumption-123" },
        data: expect.objectContaining({
          verified: false,
          correction: "User actually wanted tomorrow's calendar",
        }),
      });
    });
  });

  describe("findUnverified", () => {
    it("should find unverified assumptions for a user", async () => {
      vi.mocked(db.auditLog.findMany).mockResolvedValue([
        { id: "audit-1" } as AuditLog,
        { id: "audit-2" } as AuditLog,
      ]);
      vi.mocked(db.agentAssumption.findMany).mockResolvedValue([
        createMockAssumption({ verified: null }),
      ]);

      const result = await assumptionRepository.findUnverified("user-123", 10);

      expect(db.agentAssumption.findMany).toHaveBeenCalledWith({
        where: {
          auditLogId: { in: ["audit-1", "audit-2"] },
          verified: null,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      expect(result).toHaveLength(1);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Service Tests
// ─────────────────────────────────────────────────────────────

describe("auditService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("logAgentAction", () => {
    it("should log an action with assumptions", async () => {
      const mockEntry = createMockAuditLog();
      const mockAssumptions = [createMockAssumption()];

      vi.mocked(db.auditLog.create).mockResolvedValue(mockEntry);
      vi.mocked(db.$transaction).mockResolvedValue(mockAssumptions);

      const result = await logAgentAction({
        userId: "user-123",
        actionType: "query",
        actionCategory: "context",
        intent: "Find meetings",
        assumptions: [
          {
            assumption: "User wants today's meetings",
            category: "intent",
            evidence: [{ source: "user_input", content: "meetings", weight: 0.9 }],
            confidence: 0.85,
          },
        ],
      });

      expect(result.id).toBe("audit-123");
      expect(result.assumptions).toHaveLength(1);
    });

    it("should log an action without assumptions", async () => {
      const mockEntry = createMockAuditLog();
      vi.mocked(db.auditLog.create).mockResolvedValue(mockEntry);

      const result = await logAgentAction({
        userId: "user-123",
        actionType: "query",
        actionCategory: "context",
      });

      expect(result.id).toBe("audit-123");
      expect(result.assumptions).toEqual([]);
    });
  });

  describe("startAuditAction / completeAuditAction / failAuditAction", () => {
    it("should start and complete an audit action", async () => {
      const pendingEntry = createMockAuditLog({ status: "pending" });
      const completedEntry = createMockAuditLog({ status: "completed" });

      vi.mocked(db.auditLog.create).mockResolvedValue(pendingEntry);
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(completedEntry);
      vi.mocked(db.auditLog.update).mockResolvedValue(completedEntry);

      const auditLogId = await startAuditAction({
        userId: "user-123",
        actionType: "create",
        actionCategory: "context",
      });

      expect(auditLogId).toBe("audit-123");

      const result = await completeAuditAction("user-123", auditLogId, {
        reasoning: "Task created successfully",
      });

      expect(result.status).toBe("completed");
    });

    it("should start and fail an audit action", async () => {
      const pendingEntry = createMockAuditLog({ status: "pending" });
      const failedEntry = createMockAuditLog({
        status: "failed",
        errorMessage: "API error",
      });

      vi.mocked(db.auditLog.create).mockResolvedValue(pendingEntry);
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(pendingEntry);
      vi.mocked(db.auditLog.update).mockResolvedValue(failedEntry);

      const auditLogId = await startAuditAction({
        userId: "user-123",
        actionType: "create",
        actionCategory: "integration",
      });

      await failAuditAction("user-123", auditLogId, "API error");

      expect(db.auditLog.update).toHaveBeenCalledWith({
        where: { id: auditLogId },
        data: expect.objectContaining({
          status: "failed",
          errorMessage: "API error",
        }),
      });
    });
  });

  describe("withAuditTrail", () => {
    it("should wrap an action with audit logging on success", async () => {
      const pendingEntry = createMockAuditLog({ status: "pending" });
      const completedEntry = createMockAuditLog({ status: "completed" });

      vi.mocked(db.auditLog.create).mockResolvedValue(pendingEntry);
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(completedEntry);
      vi.mocked(db.auditLog.update).mockResolvedValue(completedEntry);

      const result = await withAuditTrail(
        {
          userId: "user-123",
          actionType: "query",
          actionCategory: "context",
        },
        async () => {
          return { data: "success" };
        }
      );

      expect(result.auditLogId).toBe("audit-123");
      expect(result.result).toEqual({ data: "success" });
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should wrap an action with audit logging on failure", async () => {
      const pendingEntry = createMockAuditLog({ status: "pending" });
      const failedEntry = createMockAuditLog({ status: "failed" });

      vi.mocked(db.auditLog.create).mockResolvedValue(pendingEntry);
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(pendingEntry);
      vi.mocked(db.auditLog.update).mockResolvedValue(failedEntry);

      await expect(
        withAuditTrail(
          {
            userId: "user-123",
            actionType: "create",
            actionCategory: "context",
          },
          async () => {
            throw new Error("Something went wrong");
          }
        )
      ).rejects.toThrow("Something went wrong");

      expect(db.auditLog.update).toHaveBeenCalledWith({
        where: { id: pendingEntry.id },
        data: expect.objectContaining({
          status: "failed",
          errorMessage: "Something went wrong",
        }),
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Security Tests
  // ─────────────────────────────────────────────────────────────

  describe("security: ownership verification", () => {
    it("completeAuditAction should reject if audit log belongs to different user", async () => {
      const otherUserEntry = createMockAuditLog({ userId: "other-user" });
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(otherUserEntry);

      await expect(
        completeAuditAction("user-123", "audit-123", { reasoning: "test" })
      ).rejects.toThrow("Unauthorized: audit log entry does not belong to user");
    });

    it("completeAuditAction should throw if audit log not found", async () => {
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(null);

      await expect(
        completeAuditAction("user-123", "nonexistent", { reasoning: "test" })
      ).rejects.toThrow("Audit log entry not found: nonexistent");
    });

    it("failAuditAction should reject if audit log belongs to different user", async () => {
      const otherUserEntry = createMockAuditLog({ userId: "other-user" });
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(otherUserEntry);

      await expect(
        failAuditAction("user-123", "audit-123", "error message")
      ).rejects.toThrow("Unauthorized: audit log entry does not belong to user");
    });

    it("failAuditAction should throw if audit log not found", async () => {
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(null);

      await expect(
        failAuditAction("user-123", "nonexistent", "error message")
      ).rejects.toThrow("Audit log entry not found: nonexistent");
    });

    it("getAuditEntry should return null if audit log belongs to different user", async () => {
      const otherUserEntry = createMockAuditLog({ userId: "other-user" });
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(otherUserEntry);

      const result = await getAuditEntry("user-123", "audit-123");
      expect(result).toBeNull();
    });

    it("getAuditEntry should return entry if it belongs to the user", async () => {
      const userEntry = createMockAuditLog({ userId: "user-123" });
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(userEntry);

      const result = await getAuditEntry("user-123", "audit-123");
      expect(result).not.toBeNull();
      expect(result?.userId).toBe("user-123");
    });

    it("getAssumptionsForAction should return empty if audit log belongs to different user", async () => {
      const otherUserEntry = createMockAuditLog({ userId: "other-user" });
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(otherUserEntry);

      const result = await getAssumptionsForAction("user-123", "audit-123");
      expect(result).toEqual([]);
    });

    it("getAssumptionsForAction should return empty if audit log not found", async () => {
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(null);

      const result = await getAssumptionsForAction("user-123", "nonexistent");
      expect(result).toEqual([]);
    });

    it("getAssumptionsForAction should return assumptions if audit log belongs to user", async () => {
      const userEntry = createMockAuditLog({ userId: "user-123" });
      const mockAssumption = createMockAssumption();

      vi.mocked(db.auditLog.findUnique).mockResolvedValue(userEntry);
      vi.mocked(db.agentAssumption.findMany).mockResolvedValue([mockAssumption]);

      const result = await getAssumptionsForAction("user-123", "audit-123");
      expect(result).toHaveLength(1);
    });
  });

  describe("queryAuditLog", () => {
    it("should query audit entries with pagination info", async () => {
      const mockEntry = createMockAuditLog();
      vi.mocked(db.auditLog.findMany).mockResolvedValue([mockEntry]);
      vi.mocked(db.auditLog.count).mockResolvedValue(100);

      const result = await queryAuditLog({
        userId: "user-123",
        limit: 10,
        offset: 0,
      });

      expect(result.entries).toHaveLength(1);
      expect(result.totalCount).toBe(100);
      expect(result.hasMore).toBe(true);
    });
  });

  describe("verifyAssumption", () => {
    it("should verify an assumption for the correct user", async () => {
      const mockAssumption = createMockAssumption();
      const mockAuditEntry = createMockAuditLog();

      vi.mocked(db.agentAssumption.findUnique).mockResolvedValue(mockAssumption);
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(mockAuditEntry);
      vi.mocked(db.agentAssumption.update).mockResolvedValue({
        ...mockAssumption,
        verified: true,
        verifiedAt: new Date(),
        verifiedBy: "user",
      });

      const result = await verifyAssumption("user-123", "assumption-123", {
        verified: true,
        verifiedBy: "user",
      });

      expect(result.verified).toBe(true);
      expect(result.verifiedBy).toBe("user");
    });

    it("should throw if assumption not found", async () => {
      vi.mocked(db.agentAssumption.findUnique).mockResolvedValue(null);

      await expect(
        verifyAssumption("user-123", "nonexistent", {
          verified: true,
          verifiedBy: "user",
        })
      ).rejects.toThrow("Assumption not found: nonexistent");
    });

    it("should throw if assumption belongs to different user", async () => {
      const mockAssumption = createMockAssumption();
      const mockAuditEntry = createMockAuditLog({ userId: "other-user" });

      vi.mocked(db.agentAssumption.findUnique).mockResolvedValue(mockAssumption);
      vi.mocked(db.auditLog.findUnique).mockResolvedValue(mockAuditEntry);

      await expect(
        verifyAssumption("user-123", "assumption-123", {
          verified: true,
          verifiedBy: "user",
        })
      ).rejects.toThrow("Unauthorized: Assumption does not belong to user");
    });
  });

  describe("getAuditStats", () => {
    it("should return comprehensive statistics", async () => {
      vi.mocked(db.auditLog.count).mockResolvedValue(100);
      vi.mocked(db.auditLog.findMany).mockResolvedValue([
        { id: "a1" } as AuditLog,
      ]);
      vi.mocked(db.agentAssumption.count)
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(20) // unverified
        .mockResolvedValueOnce(25) // correct
        .mockResolvedValueOnce(5); // incorrect

      const result = await getAuditStats("user-123");

      expect(result.totalEntries).toBe(100);
      expect(result.totalAssumptions).toBe(50);
      expect(result.unverifiedAssumptions).toBe(20);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Service Object Tests
// ─────────────────────────────────────────────────────────────

describe("auditService object", () => {
  it("should export all functions", () => {
    expect(auditService.logAgentAction).toBe(logAgentAction);
    expect(auditService.startAuditAction).toBe(startAuditAction);
    expect(auditService.completeAuditAction).toBe(completeAuditAction);
    expect(auditService.failAuditAction).toBe(failAuditAction);
    expect(auditService.withAuditTrail).toBe(withAuditTrail);
    expect(auditService.queryAuditLog).toBe(queryAuditLog);
    expect(auditService.getAuditEntry).toBe(getAuditEntry);
    expect(auditService.getEntityAuditTrail).toBe(getEntityAuditTrail);
    expect(auditService.getRecentActions).toBe(getRecentActions);
    expect(auditService.queryAssumptions).toBe(queryAssumptions);
    expect(auditService.getAssumptionsForAction).toBe(getAssumptionsForAction);
    expect(auditService.getUnverifiedAssumptions).toBe(getUnverifiedAssumptions);
    expect(auditService.verifyAssumption).toBe(verifyAssumption);
    expect(auditService.getAuditStats).toBe(getAuditStats);
  });
});

