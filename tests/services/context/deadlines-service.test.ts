// ═══════════════════════════════════════════════════════════════════════════
// Deadlines Service - Unit Tests
// Tests for Deadline entity CRUD operations
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Mock the db module before importing the service
vi.mock("@/lib/db", () => ({
  db: {
    deadline: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    task: {
      findFirst: vi.fn(),
    },
    event: {
      findFirst: vi.fn(),
    },
  },
}));

// Mock the audit service
vi.mock("@/services/audit", () => ({
  logAuditEntry: vi.fn(),
}));

import { db } from "@/lib/db";
import { logAuditEntry } from "@/services/audit";
import {
  createDeadline,
  getDeadlineById,
  getDeadlineByIdWithRelations,
  updateDeadline,
  updateDeadlineStatus,
  completeDeadline,
  markDeadlineMissed,
  extendDeadline,
  reopenDeadline,
  deleteDeadline,
  restoreDeadline,
  listDeadlines,
  findDeadlineBySource,
  searchDeadlines,
  getOverdueDeadlines,
  getApproachingDeadlines,
  getDeadlinesByUrgency,
  calculateDeadlineUrgency,
  getDeadlinesByTask,
  getDeadlinesByEvent,
  upsertDeadlinesFromSource,
  DeadlinesServiceError,
} from "@/services/context/deadlines";
import type {
  CreateDeadlineInput,
  UpdateDeadlineInput,
  Deadline,
} from "@/services/context/deadlines";

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

const mockUserId = "user-123";
const mockDeadlineId = "deadline-456";
const mockTaskId = "task-789";
const mockEventId = "event-012";

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
const soonDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now

const mockDeadline: Deadline = {
  id: mockDeadlineId,
  userId: mockUserId,
  title: "Project Deadline",
  description: "Complete the project",
  type: "deadline",
  dueAt: futureDate,
  reminderAt: new Date(futureDate.getTime() - 24 * 60 * 60 * 1000), // 1 day before
  status: "pending",
  importance: 8,
  taskId: null,
  eventId: null,
  notes: "Critical deadline",
  consequences: "Project delay",
  source: "manual",
  sourceId: null,
  sourceSyncedAt: null,
  metadata: {},
  tags: ["project", "q1"],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  deletedAt: null,
};

const mockCreateInput: CreateDeadlineInput = {
  title: "Project Deadline",
  description: "Complete the project",
  dueAt: futureDate,
  source: "manual",
  importance: 8,
  tags: ["project"],
};

// ─────────────────────────────────────────────────────────────
// Create Deadline Tests
// ─────────────────────────────────────────────────────────────

describe("createDeadline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a deadline with valid input", async () => {
    vi.mocked(db.deadline.create).mockResolvedValue(mockDeadline);

    const result = await createDeadline(mockUserId, mockCreateInput);

    expect(result).toEqual(mockDeadline);
    expect(db.deadline.create).toHaveBeenCalledTimes(1);
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserId,
        actionType: "create",
        actionCategory: "context",
        entityType: "deadline",
        entityId: mockDeadlineId,
      })
    );
  });

  it("normalizes tags", async () => {
    vi.mocked(db.deadline.create).mockResolvedValue(mockDeadline);

    await createDeadline(mockUserId, {
      ...mockCreateInput,
      tags: ["Project", "Q1", "project"],
    });

    expect(db.deadline.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tags: ["project", "q1"],
        }),
      })
    );
  });

  it("validates importance range", async () => {
    vi.mocked(db.deadline.create).mockResolvedValue(mockDeadline);

    await createDeadline(mockUserId, {
      ...mockCreateInput,
      importance: 15,
    });

    expect(db.deadline.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          importance: 10,
        }),
      })
    );
  });

  it("throws error when task not found", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue(null);

    await expect(
      createDeadline(mockUserId, {
        ...mockCreateInput,
        taskId: "nonexistent",
      })
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    });
  });

  it("verifies task exists before creating", async () => {
    const mockTask = { id: mockTaskId, userId: mockUserId, deletedAt: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.task.findFirst).mockResolvedValue(mockTask as any);
    vi.mocked(db.deadline.create).mockResolvedValue({
      ...mockDeadline,
      taskId: mockTaskId,
    });

    await createDeadline(mockUserId, {
      ...mockCreateInput,
      taskId: mockTaskId,
    });

    expect(db.task.findFirst).toHaveBeenCalledWith({
      where: { id: mockTaskId, userId: mockUserId, deletedAt: null },
    });
  });

  it("throws error when event not found", async () => {
    vi.mocked(db.event.findFirst).mockResolvedValue(null);

    await expect(
      createDeadline(mockUserId, {
        ...mockCreateInput,
        eventId: "nonexistent",
      })
    ).rejects.toMatchObject({
      code: "EVENT_NOT_FOUND",
    });
  });

  it("verifies event exists before creating", async () => {
    const mockEvent = { id: mockEventId, userId: mockUserId, deletedAt: null };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.event.findFirst).mockResolvedValue(mockEvent as any);
    vi.mocked(db.deadline.create).mockResolvedValue({
      ...mockDeadline,
      eventId: mockEventId,
    });

    await createDeadline(mockUserId, {
      ...mockCreateInput,
      eventId: mockEventId,
    });

    expect(db.event.findFirst).toHaveBeenCalledWith({
      where: { id: mockEventId, userId: mockUserId, deletedAt: null },
    });
  });

  it("handles duplicate sourceId constraint violation", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      "Unique constraint failed",
      {
        code: "P2002",
        clientVersion: "5.0.0",
        meta: { target: ["userId", "source", "sourceId"] },
      }
    );
    vi.mocked(db.deadline.create).mockRejectedValue(prismaError);

    await expect(
      createDeadline(mockUserId, {
        ...mockCreateInput,
        source: "calendar",
        sourceId: "123",
      })
    ).rejects.toMatchObject({
      code: "DUPLICATE_SOURCE_ID",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Get Deadline By ID Tests
// ─────────────────────────────────────────────────────────────

describe("getDeadlineById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns deadline when found", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue(mockDeadline);

    const result = await getDeadlineById(mockUserId, mockDeadlineId);

    expect(result).toEqual(mockDeadline);
    expect(db.deadline.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockDeadlineId,
        userId: mockUserId,
        deletedAt: null,
      },
    });
  });

  it("returns null when deadline not found", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue(null);

    const result = await getDeadlineById(mockUserId, "nonexistent");

    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Get Deadline With Relations Tests
// ─────────────────────────────────────────────────────────────

describe("getDeadlineByIdWithRelations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns deadline with relations", async () => {
    const deadlineWithRelations = {
      ...mockDeadline,
      task: null,
      event: null,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(db.deadline.findFirst).mockResolvedValue(
      deadlineWithRelations as Deadline
    );

    const result = await getDeadlineByIdWithRelations(
      mockUserId,
      mockDeadlineId
    );

    expect(result).toBeDefined();
    expect(db.deadline.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          task: true,
          event: true,
        },
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Update Deadline Tests
// ─────────────────────────────────────────────────────────────

describe("updateDeadline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates deadline with valid input", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue(mockDeadline);
    const updatedDeadline = { ...mockDeadline, title: "Updated Deadline" };
    vi.mocked(db.deadline.update).mockResolvedValue(updatedDeadline);

    const updateInput: UpdateDeadlineInput = { title: "Updated Deadline" };
    const result = await updateDeadline(
      mockUserId,
      mockDeadlineId,
      updateInput
    );

    expect(result.title).toBe("Updated Deadline");
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "update",
        entityType: "deadline",
      })
    );
  });

  it("throws error when deadline not found", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue(null);

    await expect(
      updateDeadline(mockUserId, "nonexistent", { title: "Test" })
    ).rejects.toMatchObject({
      code: "DEADLINE_NOT_FOUND",
    });
  });

  it("verifies task on update", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue(mockDeadline);
    vi.mocked(db.task.findFirst).mockResolvedValue(null);

    await expect(
      updateDeadline(mockUserId, mockDeadlineId, { taskId: "nonexistent" })
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    });
  });

  it("verifies event on update", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue(mockDeadline);
    vi.mocked(db.event.findFirst).mockResolvedValue(null);

    await expect(
      updateDeadline(mockUserId, mockDeadlineId, { eventId: "nonexistent" })
    ).rejects.toMatchObject({
      code: "EVENT_NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Status Transition Tests
// ─────────────────────────────────────────────────────────────

describe("updateDeadlineStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows valid status transitions", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue({
      ...mockDeadline,
      status: "pending",
    });
    vi.mocked(db.deadline.update).mockResolvedValue({
      ...mockDeadline,
      status: "completed",
    });

    const result = await updateDeadlineStatus(
      mockUserId,
      mockDeadlineId,
      "completed"
    );

    expect(result.status).toBe("completed");
  });

  it("throws error for invalid status transition", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue({
      ...mockDeadline,
      status: "completed",
    });

    await expect(
      updateDeadlineStatus(mockUserId, mockDeadlineId, "missed")
    ).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
    });
  });
});

describe("completeDeadline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes a pending deadline", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue({
      ...mockDeadline,
      status: "pending",
    });
    vi.mocked(db.deadline.update).mockResolvedValue({
      ...mockDeadline,
      status: "completed",
    });

    const result = await completeDeadline(mockUserId, mockDeadlineId);

    expect(result.status).toBe("completed");
  });
});

describe("markDeadlineMissed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks a pending deadline as missed", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue({
      ...mockDeadline,
      status: "pending",
    });
    vi.mocked(db.deadline.update).mockResolvedValue({
      ...mockDeadline,
      status: "missed",
    });

    const result = await markDeadlineMissed(mockUserId, mockDeadlineId);

    expect(result.status).toBe("missed");
  });
});

describe("extendDeadline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extends a pending deadline to new due date", async () => {
    const newDueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    vi.mocked(db.deadline.findFirst).mockResolvedValue({
      ...mockDeadline,
      status: "pending",
    });
    vi.mocked(db.deadline.update).mockResolvedValue({
      ...mockDeadline,
      status: "extended",
      dueAt: newDueAt,
    });

    const result = await extendDeadline(mockUserId, mockDeadlineId, newDueAt);

    expect(result.status).toBe("extended");
  });

  it("throws error when new due date is in the past", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue({
      ...mockDeadline,
      status: "pending",
    });

    await expect(
      extendDeadline(mockUserId, mockDeadlineId, pastDate)
    ).rejects.toMatchObject({
      code: "INVALID_DUE_DATE",
    });
  });

  it("extends a missed deadline", async () => {
    const newDueAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    vi.mocked(db.deadline.findFirst).mockResolvedValue({
      ...mockDeadline,
      status: "missed",
    });
    vi.mocked(db.deadline.update).mockResolvedValue({
      ...mockDeadline,
      status: "extended",
      dueAt: newDueAt,
    });

    const result = await extendDeadline(mockUserId, mockDeadlineId, newDueAt);

    expect(result.status).toBe("extended");
  });
});

describe("reopenDeadline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reopens a completed deadline", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue({
      ...mockDeadline,
      status: "completed",
    });
    vi.mocked(db.deadline.update).mockResolvedValue({
      ...mockDeadline,
      status: "pending",
    });

    const result = await reopenDeadline(mockUserId, mockDeadlineId);

    expect(result.status).toBe("pending");
  });

  it("reopens a missed deadline", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue({
      ...mockDeadline,
      status: "missed",
    });
    vi.mocked(db.deadline.update).mockResolvedValue({
      ...mockDeadline,
      status: "pending",
    });

    const result = await reopenDeadline(mockUserId, mockDeadlineId);

    expect(result.status).toBe("pending");
  });
});

// ─────────────────────────────────────────────────────────────
// Delete Deadline Tests
// ─────────────────────────────────────────────────────────────

describe("deleteDeadline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft deletes deadline", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue(mockDeadline);
    vi.mocked(db.deadline.update).mockResolvedValue({
      ...mockDeadline,
      deletedAt: new Date(),
    });

    await deleteDeadline(mockUserId, mockDeadlineId);

    expect(db.deadline.update).toHaveBeenCalledWith({
      where: { id: mockDeadlineId },
      data: { deletedAt: expect.any(Date) },
    });
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "delete",
        entityType: "deadline",
      })
    );
  });

  it("throws error when deadline not found", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue(null);

    await expect(
      deleteDeadline(mockUserId, "nonexistent")
    ).rejects.toMatchObject({
      code: "DEADLINE_NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Restore Deadline Tests
// ─────────────────────────────────────────────────────────────

describe("restoreDeadline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores soft-deleted deadline", async () => {
    const deletedDeadline = { ...mockDeadline, deletedAt: new Date() };
    vi.mocked(db.deadline.findFirst).mockResolvedValue(deletedDeadline);
    vi.mocked(db.deadline.update).mockResolvedValue({
      ...mockDeadline,
      deletedAt: null,
    });

    const result = await restoreDeadline(mockUserId, mockDeadlineId);

    expect(result.deletedAt).toBeNull();
  });

  it("throws error when deleted deadline not found", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue(null);

    await expect(
      restoreDeadline(mockUserId, "nonexistent")
    ).rejects.toMatchObject({
      code: "DEADLINE_NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// List Deadlines Tests
// ─────────────────────────────────────────────────────────────

describe("listDeadlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated results", async () => {
    const deadlines = [mockDeadline, { ...mockDeadline, id: "deadline-789" }];
    vi.mocked(db.deadline.findMany).mockResolvedValue(deadlines);

    const result = await listDeadlines(mockUserId, { limit: 10 });

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it("filters by type", async () => {
    vi.mocked(db.deadline.findMany).mockResolvedValue([]);

    await listDeadlines(mockUserId, { type: "milestone" });

    expect(db.deadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "milestone",
        }),
      })
    );
  });

  it("filters by status", async () => {
    vi.mocked(db.deadline.findMany).mockResolvedValue([]);

    await listDeadlines(mockUserId, { status: "pending" });

    expect(db.deadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "pending",
        }),
      })
    );
  });

  it("filters by due before", async () => {
    vi.mocked(db.deadline.findMany).mockResolvedValue([]);

    const dueBefore = new Date();

    await listDeadlines(mockUserId, { dueBefore });

    expect(db.deadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueAt: { lte: dueBefore },
        }),
      })
    );
  });

  it("filters by due after", async () => {
    vi.mocked(db.deadline.findMany).mockResolvedValue([]);

    const dueAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    await listDeadlines(mockUserId, { dueAfter });

    expect(db.deadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueAt: { gte: dueAfter },
        }),
      })
    );
  });

  it("filters by task", async () => {
    vi.mocked(db.deadline.findMany).mockResolvedValue([]);

    await listDeadlines(mockUserId, { taskId: mockTaskId });

    expect(db.deadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          taskId: mockTaskId,
        }),
      })
    );
  });

  it("filters by event", async () => {
    vi.mocked(db.deadline.findMany).mockResolvedValue([]);

    await listDeadlines(mockUserId, { eventId: mockEventId });

    expect(db.deadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventId: mockEventId,
        }),
      })
    );
  });

  it("filters by minimum importance", async () => {
    vi.mocked(db.deadline.findMany).mockResolvedValue([]);

    await listDeadlines(mockUserId, { minImportance: 7 });

    expect(db.deadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          importance: { gte: 7 },
        }),
      })
    );
  });

  it("searches across multiple fields", async () => {
    vi.mocked(db.deadline.findMany).mockResolvedValue([]);

    await listDeadlines(mockUserId, { search: "project" });

    expect(db.deadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { title: { contains: "project", mode: "insensitive" } },
            { description: { contains: "project", mode: "insensitive" } },
            { notes: { contains: "project", mode: "insensitive" } },
          ],
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Urgency Query Tests
// ─────────────────────────────────────────────────────────────

describe("getOverdueDeadlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns overdue deadlines", async () => {
    const overdueDeadline = { ...mockDeadline, dueAt: pastDate };
    vi.mocked(db.deadline.findMany).mockResolvedValue([overdueDeadline]);

    const result = await getOverdueDeadlines(mockUserId);

    expect(result).toHaveLength(1);
    expect(db.deadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueAt: { lt: expect.any(Date) },
          status: { in: ["pending", "extended"] },
        }),
      })
    );
  });
});

describe("getApproachingDeadlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns deadlines approaching within specified days", async () => {
    const approachingDeadline = { ...mockDeadline, dueAt: soonDate };
    vi.mocked(db.deadline.findMany).mockResolvedValue([approachingDeadline]);

    const result = await getApproachingDeadlines(mockUserId, 7);

    expect(result).toHaveLength(1);
    expect(db.deadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
          status: { in: ["pending", "extended"] },
        }),
      })
    );
  });
});

describe("getDeadlinesByUrgency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns deadlines with urgency calculation", async () => {
    vi.mocked(db.deadline.findMany).mockResolvedValue([mockDeadline]);

    const result = await getDeadlinesByUrgency(mockUserId);

    expect(result).toHaveLength(1);
    expect(result[0]).toHaveProperty("urgency");
    expect(result[0]).toHaveProperty("daysRemaining");
  });

  it("filters by minimum urgency level", async () => {
    vi.mocked(db.deadline.findMany).mockResolvedValue([mockDeadline]);

    await getDeadlinesByUrgency(mockUserId, { minUrgency: "urgent" });

    expect(db.deadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueAt: expect.objectContaining({
            lte: expect.any(Date),
          }),
        }),
      })
    );
  });

  it("excludes overdue when specified", async () => {
    vi.mocked(db.deadline.findMany).mockResolvedValue([mockDeadline]);

    await getDeadlinesByUrgency(mockUserId, { includeOverdue: false });

    expect(db.deadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueAt: expect.objectContaining({
            gte: expect.any(Date),
          }),
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Calculate Urgency Tests
// ─────────────────────────────────────────────────────────────

describe("calculateDeadlineUrgency", () => {
  it("calculates overdue urgency", () => {
    const overdueDeadline = { ...mockDeadline, dueAt: pastDate };
    const result = calculateDeadlineUrgency(overdueDeadline);

    expect(result.urgency).toBe("overdue");
    expect(result.daysRemaining).toBeLessThan(0);
  });

  it("calculates urgent urgency (due within 1 day)", () => {
    const urgentDeadline = {
      ...mockDeadline,
      dueAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
    }; // 12 hours
    const result = calculateDeadlineUrgency(urgentDeadline);

    expect(result.urgency).toBe("urgent");
    expect(result.daysRemaining).toBeLessThanOrEqual(1);
  });

  it("calculates approaching urgency (due within 7 days)", () => {
    const approachingDeadline = {
      ...mockDeadline,
      dueAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    }; // 5 days
    const result = calculateDeadlineUrgency(approachingDeadline);

    expect(result.urgency).toBe("approaching");
    expect(result.daysRemaining).toBeLessThanOrEqual(7);
  });

  it("calculates normal urgency (due within 30 days)", () => {
    const normalDeadline = {
      ...mockDeadline,
      dueAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    }; // 20 days
    const result = calculateDeadlineUrgency(normalDeadline);

    expect(result.urgency).toBe("normal");
  });

  it("calculates distant urgency (due after 30 days)", () => {
    const distantDeadline = {
      ...mockDeadline,
      dueAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    }; // 60 days
    const result = calculateDeadlineUrgency(distantDeadline);

    expect(result.urgency).toBe("distant");
  });
});

// ─────────────────────────────────────────────────────────────
// Relation Query Tests
// ─────────────────────────────────────────────────────────────

describe("getDeadlinesByTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns deadlines for a task", async () => {
    vi.mocked(db.deadline.findMany).mockResolvedValue([
      { ...mockDeadline, taskId: mockTaskId },
    ]);

    const result = await getDeadlinesByTask(mockUserId, mockTaskId);

    expect(result).toHaveLength(1);
    expect(db.deadline.findMany).toHaveBeenCalledWith({
      where: {
        userId: mockUserId,
        taskId: mockTaskId,
        deletedAt: null,
      },
      orderBy: { dueAt: "asc" },
    });
  });
});

describe("getDeadlinesByEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns deadlines for an event", async () => {
    vi.mocked(db.deadline.findMany).mockResolvedValue([
      { ...mockDeadline, eventId: mockEventId },
    ]);

    const result = await getDeadlinesByEvent(mockUserId, mockEventId);

    expect(result).toHaveLength(1);
    expect(db.deadline.findMany).toHaveBeenCalledWith({
      where: {
        userId: mockUserId,
        eventId: mockEventId,
        deletedAt: null,
      },
      orderBy: { dueAt: "asc" },
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Find By Source Tests
// ─────────────────────────────────────────────────────────────

describe("findDeadlineBySource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds deadline by source and sourceId", async () => {
    const calendarDeadline = {
      ...mockDeadline,
      source: "calendar",
      sourceId: "cal-123",
    };
    vi.mocked(db.deadline.findFirst).mockResolvedValue(calendarDeadline);

    const result = await findDeadlineBySource(
      mockUserId,
      "calendar",
      "cal-123"
    );

    expect(result).toEqual(calendarDeadline);
  });
});

// ─────────────────────────────────────────────────────────────
// Search Deadlines Tests
// ─────────────────────────────────────────────────────────────

describe("searchDeadlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches across multiple fields", async () => {
    vi.mocked(db.deadline.findMany).mockResolvedValue([mockDeadline]);

    const result = await searchDeadlines(mockUserId, "project");

    expect(result).toHaveLength(1);
    expect(db.deadline.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { title: { contains: "project", mode: "insensitive" } },
            { description: { contains: "project", mode: "insensitive" } },
          ]),
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Upsert From Source Tests
// ─────────────────────────────────────────────────────────────

describe("upsertDeadlinesFromSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates new deadlines when not found", async () => {
    vi.mocked(db.deadline.findFirst).mockResolvedValue(null);
    vi.mocked(db.deadline.create).mockResolvedValue(mockDeadline);

    const result = await upsertDeadlinesFromSource(mockUserId, "calendar", [
      {
        sourceId: "cal-123",
        data: { title: "New Deadline", dueAt: futureDate },
      },
    ]);

    expect(result.created).toHaveLength(1);
    expect(result.updated).toHaveLength(0);
    expect(result.unchanged).toBe(0);
  });

  it("updates existing deadlines when data changed", async () => {
    const existingDeadline = {
      ...mockDeadline,
      source: "calendar",
      sourceId: "cal-123",
    };
    vi.mocked(db.deadline.findFirst).mockResolvedValue(existingDeadline);
    vi.mocked(db.deadline.update).mockResolvedValue({
      ...existingDeadline,
      title: "Updated Deadline",
    });

    const result = await upsertDeadlinesFromSource(mockUserId, "calendar", [
      {
        sourceId: "cal-123",
        data: { title: "Updated Deadline", dueAt: existingDeadline.dueAt },
      },
    ]);

    expect(result.created).toHaveLength(0);
    expect(result.updated).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────
// DeadlinesServiceError Tests
// ─────────────────────────────────────────────────────────────

describe("DeadlinesServiceError", () => {
  it("creates error with code and message", () => {
    const error = new DeadlinesServiceError(
      "DEADLINE_NOT_FOUND",
      "Deadline not found"
    );

    expect(error.code).toBe("DEADLINE_NOT_FOUND");
    expect(error.message).toBe("Deadline not found");
    expect(error.name).toBe("DeadlinesServiceError");
  });

  it("includes optional details", () => {
    const error = new DeadlinesServiceError("INVALID_DUE_DATE", "Bad date", {
      dueAt: new Date(),
    });

    expect(error.details).toBeDefined();
  });
});
