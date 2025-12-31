// ═══════════════════════════════════════════════════════════════════════════
// Tasks Service - Unit Tests
// Tests for Task entity CRUD operations
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Mock the db module before importing the service
vi.mock("@/lib/db", () => ({
  db: {
    task: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    person: {
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
  createTask,
  getTaskById,
  getTaskByIdWithRelations,
  updateTask,
  updateTaskStatus,
  completeTask,
  startTask,
  deferTask,
  cancelTask,
  reopenTask,
  getSubtasks,
  setTaskParent,
  reorderTask,
  deleteTask,
  restoreTask,
  listTasks,
  findTaskBySource,
  searchTasks,
  getOverdueTasks,
  getTasksDueSoon,
  getTasksDueOnDate,
  getTasksAssignedTo,
  upsertTasksFromSource,
  TasksServiceError,
} from "@/services/context/tasks";
import type {
  CreateTaskInput,
  UpdateTaskInput,
  Task,
  Person,
} from "@/services/context/tasks";

// ─────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────

const mockUserId = "user-123";
const mockTaskId = "task-456";
const mockParentTaskId = "task-parent";
const mockPersonId = "person-789";

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

const mockTask: Task = {
  id: mockTaskId,
  userId: mockUserId,
  title: "Complete project",
  description: "Finish the quarterly project",
  parentId: null,
  position: 0,
  status: "pending",
  priority: "high",
  dueDate: futureDate,
  startDate: null,
  completedAt: null,
  estimatedMinutes: 120,
  actualMinutes: null,
  notes: "Important task",
  assignedToId: null,
  source: "manual",
  sourceId: null,
  sourceSyncedAt: null,
  metadata: {},
  tags: ["project", "q1"],
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
  deletedAt: null,
};

const mockCreateInput: CreateTaskInput = {
  title: "Complete project",
  description: "Finish the quarterly project",
  priority: "high",
  dueDate: futureDate,
  source: "manual",
  tags: ["project"],
};

// ─────────────────────────────────────────────────────────────
// Create Task Tests
// ─────────────────────────────────────────────────────────────

describe("createTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a task with valid input", async () => {
    vi.mocked(db.task.create).mockResolvedValue(mockTask);

    const result = await createTask(mockUserId, mockCreateInput);

    expect(result).toEqual(mockTask);
    expect(db.task.create).toHaveBeenCalledTimes(1);
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserId,
        actionType: "create",
        actionCategory: "context",
        entityType: "task",
        entityId: mockTaskId,
      })
    );
  });

  it("normalizes tags", async () => {
    vi.mocked(db.task.create).mockResolvedValue(mockTask);

    await createTask(mockUserId, {
      ...mockCreateInput,
      tags: ["Project", "Q1", "project"],
    });

    expect(db.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tags: ["project", "q1"],
        }),
      })
    );
  });

  it("throws error when parent task not found", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue(null);

    await expect(
      createTask(mockUserId, {
        ...mockCreateInput,
        parentId: "nonexistent",
      })
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    });
  });

  it("verifies parent task exists before creating", async () => {
    const mockParent = { ...mockTask, id: mockParentTaskId };
    vi.mocked(db.task.findFirst)
      .mockResolvedValueOnce(mockParent) // Parent exists check
      .mockResolvedValueOnce(null); // Last sibling check
    vi.mocked(db.task.create).mockResolvedValue({
      ...mockTask,
      parentId: mockParentTaskId,
    });

    await createTask(mockUserId, {
      ...mockCreateInput,
      parentId: mockParentTaskId,
    });

    expect(db.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: mockParentTaskId,
        }),
      })
    );
  });

  it("throws error when assigned person not found", async () => {
    vi.mocked(db.person.findFirst).mockResolvedValue(null);

    await expect(
      createTask(mockUserId, {
        ...mockCreateInput,
        assignedToId: "nonexistent",
      })
    ).rejects.toMatchObject({
      code: "PERSON_NOT_FOUND",
    });
  });

  it("verifies assigned person exists", async () => {
    const mockPerson = {
      id: mockPersonId,
      userId: mockUserId,
      deletedAt: null,
    };
    vi.mocked(db.person.findFirst).mockResolvedValue(mockPerson as Person);
    vi.mocked(db.task.create).mockResolvedValue({
      ...mockTask,
      assignedToId: mockPersonId,
    });

    await createTask(mockUserId, {
      ...mockCreateInput,
      assignedToId: mockPersonId,
    });

    expect(db.person.findFirst).toHaveBeenCalledWith({
      where: { id: mockPersonId, userId: mockUserId, deletedAt: null },
    });
  });

  it("auto-calculates position for subtasks", async () => {
    const mockParent = { ...mockTask, id: mockParentTaskId };
    const lastSibling = { position: 2 };
    vi.mocked(db.task.findFirst)
      .mockResolvedValueOnce(mockParent) // Parent exists check
      .mockResolvedValueOnce(lastSibling as Task); // Last sibling for position
    vi.mocked(db.task.create).mockResolvedValue({
      ...mockTask,
      parentId: mockParentTaskId,
      position: 3,
    });

    await createTask(mockUserId, {
      ...mockCreateInput,
      parentId: mockParentTaskId,
    });

    expect(db.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          position: 3, // lastSibling.position + 1
        }),
      })
    );
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
    vi.mocked(db.task.create).mockRejectedValue(prismaError);

    await expect(
      createTask(mockUserId, {
        ...mockCreateInput,
        source: "slack",
        sourceId: "123",
      })
    ).rejects.toMatchObject({
      code: "DUPLICATE_SOURCE_ID",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Get Task By ID Tests
// ─────────────────────────────────────────────────────────────

describe("getTaskById", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns task when found", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue(mockTask);

    const result = await getTaskById(mockUserId, mockTaskId);

    expect(result).toEqual(mockTask);
    expect(db.task.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockTaskId,
        userId: mockUserId,
        deletedAt: null,
      },
    });
  });

  it("returns null when task not found", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue(null);

    const result = await getTaskById(mockUserId, "nonexistent");

    expect(result).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────
// Get Task With Relations Tests
// ─────────────────────────────────────────────────────────────

describe("getTaskByIdWithRelations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns task with relations", async () => {
    const taskWithRelations = {
      ...mockTask,
      parent: null,
      subtasks: [],
      assignedTo: null,
    };
    vi.mocked(db.task.findFirst).mockResolvedValue(taskWithRelations as Task);

    const result = await getTaskByIdWithRelations(mockUserId, mockTaskId);

    expect(result).toBeDefined();
    expect(db.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          parent: true,
          subtasks: expect.any(Object),
          assignedTo: true,
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Update Task Tests
// ─────────────────────────────────────────────────────────────

describe("updateTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates task with valid input", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue(mockTask);
    const updatedTask = { ...mockTask, title: "Updated task" };
    vi.mocked(db.task.update).mockResolvedValue(updatedTask);

    const updateInput: UpdateTaskInput = { title: "Updated task" };
    const result = await updateTask(mockUserId, mockTaskId, updateInput);

    expect(result.title).toBe("Updated task");
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "update",
        entityType: "task",
      })
    );
  });

  it("throws error when task not found", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue(null);

    await expect(
      updateTask(mockUserId, "nonexistent", { title: "Test" })
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    });
  });

  it("auto-sets completedAt when status changes to completed", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue({
      ...mockTask,
      status: "pending",
    });
    vi.mocked(db.task.update).mockResolvedValue({
      ...mockTask,
      status: "completed",
      completedAt: new Date(),
    });

    await updateTask(mockUserId, mockTaskId, { status: "completed" });

    expect(db.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "completed",
          completedAt: expect.any(Date),
        }),
      })
    );
  });

  it("verifies parent task on update", async () => {
    vi.mocked(db.task.findFirst)
      .mockResolvedValueOnce(mockTask) // Existing task
      .mockResolvedValueOnce(null); // Parent check

    await expect(
      updateTask(mockUserId, mockTaskId, { parentId: "nonexistent" })
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    });
  });

  it("prevents circular reference in hierarchy", async () => {
    const taskA = { ...mockTask, id: "task-a" };
    const taskB = { ...mockTask, id: "task-b", parentId: "task-a" };

    vi.mocked(db.task.findFirst)
      .mockResolvedValueOnce(taskA) // Existing task check
      .mockResolvedValueOnce(taskB) // Parent exists check
      .mockResolvedValueOnce({ parentId: "task-a" } as Task); // Walk up chain - finds cycle

    await expect(
      updateTask(mockUserId, "task-a", { parentId: "task-b" })
    ).rejects.toMatchObject({
      code: "CIRCULAR_REFERENCE",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Status Transition Tests
// ─────────────────────────────────────────────────────────────

describe("updateTaskStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows valid status transitions", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue({
      ...mockTask,
      status: "pending",
    });
    vi.mocked(db.task.update).mockResolvedValue({
      ...mockTask,
      status: "in_progress",
    });

    const result = await updateTaskStatus(
      mockUserId,
      mockTaskId,
      "in_progress"
    );

    expect(result.status).toBe("in_progress");
  });

  it("throws error for invalid status transition", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue({
      ...mockTask,
      status: "completed",
    });

    await expect(
      updateTaskStatus(mockUserId, mockTaskId, "deferred")
    ).rejects.toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
    });
  });
});

describe("completeTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("completes a pending task", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue({
      ...mockTask,
      status: "pending",
    });
    vi.mocked(db.task.update).mockResolvedValue({
      ...mockTask,
      status: "completed",
      completedAt: new Date(),
    });

    const result = await completeTask(mockUserId, mockTaskId);

    expect(result.status).toBe("completed");
  });
});

describe("startTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts a pending task", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue({
      ...mockTask,
      status: "pending",
    });
    vi.mocked(db.task.update).mockResolvedValue({
      ...mockTask,
      status: "in_progress",
    });

    const result = await startTask(mockUserId, mockTaskId);

    expect(result.status).toBe("in_progress");
  });
});

describe("deferTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("defers a pending task", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue({
      ...mockTask,
      status: "pending",
    });
    vi.mocked(db.task.update).mockResolvedValue({
      ...mockTask,
      status: "deferred",
    });

    const result = await deferTask(mockUserId, mockTaskId);

    expect(result.status).toBe("deferred");
  });
});

describe("cancelTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancels a pending task", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue({
      ...mockTask,
      status: "pending",
    });
    vi.mocked(db.task.update).mockResolvedValue({
      ...mockTask,
      status: "cancelled",
    });

    const result = await cancelTask(mockUserId, mockTaskId);

    expect(result.status).toBe("cancelled");
  });
});

describe("reopenTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reopens a completed task", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue({
      ...mockTask,
      status: "completed",
    });
    vi.mocked(db.task.update).mockResolvedValue({
      ...mockTask,
      status: "pending",
    });

    const result = await reopenTask(mockUserId, mockTaskId);

    expect(result.status).toBe("pending");
  });
});

// ─────────────────────────────────────────────────────────────
// Hierarchy Tests
// ─────────────────────────────────────────────────────────────

describe("getSubtasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns subtasks of a parent task", async () => {
    const subtasks = [
      { ...mockTask, id: "subtask-1", parentId: mockParentTaskId, position: 0 },
      { ...mockTask, id: "subtask-2", parentId: mockParentTaskId, position: 1 },
    ];
    vi.mocked(db.task.findMany).mockResolvedValue(subtasks);

    const result = await getSubtasks(mockUserId, mockParentTaskId);

    expect(result).toHaveLength(2);
    expect(db.task.findMany).toHaveBeenCalledWith({
      where: {
        userId: mockUserId,
        parentId: mockParentTaskId,
        deletedAt: null,
      },
      orderBy: { position: "asc" },
    });
  });
});

describe("setTaskParent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets parent for a task", async () => {
    const parentTask = { ...mockTask, id: mockParentTaskId, parentId: null };
    vi.mocked(db.task.findFirst)
      .mockResolvedValueOnce({ parentId: null } as Task) // Circular check walk - parent has no parent
      .mockResolvedValueOnce(mockTask) // Task exists check (in updateTask)
      .mockResolvedValueOnce(parentTask); // Parent exists check in updateTask

    vi.mocked(db.task.update).mockResolvedValue({
      ...mockTask,
      parentId: mockParentTaskId,
    });

    const result = await setTaskParent(
      mockUserId,
      mockTaskId,
      mockParentTaskId
    );

    expect(result.parentId).toBe(mockParentTaskId);
  });

  it("removes parent when set to null", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue({
      ...mockTask,
      parentId: mockParentTaskId,
    });
    vi.mocked(db.task.update).mockResolvedValue({
      ...mockTask,
      parentId: null,
    });

    const result = await setTaskParent(mockUserId, mockTaskId, null);

    expect(result.parentId).toBeNull();
  });

  it("prevents circular reference", async () => {
    // Task A -> Task B -> Task A would be circular
    vi.mocked(db.task.findFirst)
      .mockResolvedValueOnce(mockTask) // in updateTask - task exists
      .mockResolvedValueOnce({ ...mockTask, id: "parent-id", parentId: null }) // parent check
      .mockResolvedValueOnce({ parentId: mockTaskId } as Task); // Circular check finds the task

    await expect(
      setTaskParent(mockUserId, mockTaskId, "parent-id")
    ).rejects.toMatchObject({
      code: "CIRCULAR_REFERENCE",
    });
  });
});

describe("reorderTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reorders task within siblings", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue({
      ...mockTask,
      position: 0,
    });
    vi.mocked(db.task.findMany).mockResolvedValue([
      { ...mockTask, id: "task-1", position: 1 },
      { ...mockTask, id: "task-2", position: 2 },
    ]);
    vi.mocked(db.task.update).mockResolvedValue({ ...mockTask, position: 2 });

    const result = await reorderTask(mockUserId, mockTaskId, 2);

    expect(result.position).toBe(2);
  });

  it("throws error when task not found", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue(null);

    await expect(
      reorderTask(mockUserId, "nonexistent", 1)
    ).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Delete Task Tests
// ─────────────────────────────────────────────────────────────

describe("deleteTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("soft deletes task", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue(mockTask);
    vi.mocked(db.task.update).mockResolvedValue({
      ...mockTask,
      deletedAt: new Date(),
    });

    await deleteTask(mockUserId, mockTaskId);

    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: mockTaskId },
      data: { deletedAt: expect.any(Date) },
    });
    expect(logAuditEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "delete",
        entityType: "task",
      })
    );
  });

  it("throws error when task not found", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue(null);

    await expect(deleteTask(mockUserId, "nonexistent")).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Restore Task Tests
// ─────────────────────────────────────────────────────────────

describe("restoreTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores soft-deleted task", async () => {
    const deletedTask = { ...mockTask, deletedAt: new Date() };
    vi.mocked(db.task.findFirst).mockResolvedValue(deletedTask);
    vi.mocked(db.task.update).mockResolvedValue({
      ...mockTask,
      deletedAt: null,
    });

    const result = await restoreTask(mockUserId, mockTaskId);

    expect(result.deletedAt).toBeNull();
  });

  it("throws error when deleted task not found", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue(null);

    await expect(restoreTask(mockUserId, "nonexistent")).rejects.toMatchObject({
      code: "TASK_NOT_FOUND",
    });
  });
});

// ─────────────────────────────────────────────────────────────
// List Tasks Tests
// ─────────────────────────────────────────────────────────────

describe("listTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated results", async () => {
    const tasks = [mockTask, { ...mockTask, id: "task-789" }];
    vi.mocked(db.task.findMany).mockResolvedValue(tasks);

    const result = await listTasks(mockUserId, { limit: 10 });

    expect(result.items).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it("filters by status", async () => {
    vi.mocked(db.task.findMany).mockResolvedValue([]);

    await listTasks(mockUserId, { status: "pending" });

    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "pending",
        }),
      })
    );
  });

  it("filters by priority", async () => {
    vi.mocked(db.task.findMany).mockResolvedValue([]);

    await listTasks(mockUserId, { priority: "high" });

    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          priority: "high",
        }),
      })
    );
  });

  it("filters by parent (top-level only)", async () => {
    vi.mocked(db.task.findMany).mockResolvedValue([]);

    await listTasks(mockUserId, { parentId: null });

    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          parentId: null,
        }),
      })
    );
  });

  it("filters by assigned person", async () => {
    vi.mocked(db.task.findMany).mockResolvedValue([]);

    await listTasks(mockUserId, { assignedToId: mockPersonId });

    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assignedToId: mockPersonId,
        }),
      })
    );
  });

  it("filters by due before", async () => {
    vi.mocked(db.task.findMany).mockResolvedValue([]);

    const dueBefore = new Date();

    await listTasks(mockUserId, { dueBefore });

    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: { lte: dueBefore },
        }),
      })
    );
  });

  it("filters by due after", async () => {
    vi.mocked(db.task.findMany).mockResolvedValue([]);

    const dueAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    await listTasks(mockUserId, { dueAfter });

    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: { gte: dueAfter },
        }),
      })
    );
  });

  it("searches across multiple fields", async () => {
    vi.mocked(db.task.findMany).mockResolvedValue([]);

    await listTasks(mockUserId, { search: "project" });

    expect(db.task.findMany).toHaveBeenCalledWith(
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
// Due Date Query Tests
// ─────────────────────────────────────────────────────────────

describe("getOverdueTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns overdue tasks", async () => {
    const overdueTask = { ...mockTask, dueDate: pastDate };
    vi.mocked(db.task.findMany).mockResolvedValue([overdueTask]);

    const result = await getOverdueTasks(mockUserId);

    expect(result).toHaveLength(1);
    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: { lt: expect.any(Date) },
          status: { notIn: ["completed", "cancelled"] },
        }),
      })
    );
  });
});

describe("getTasksDueSoon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tasks due within specified days", async () => {
    vi.mocked(db.task.findMany).mockResolvedValue([mockTask]);

    const result = await getTasksDueSoon(mockUserId, 7);

    expect(result).toHaveLength(1);
    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
          status: { notIn: ["completed", "cancelled"] },
        }),
      })
    );
  });
});

describe("getTasksDueOnDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tasks due on specific date", async () => {
    vi.mocked(db.task.findMany).mockResolvedValue([mockTask]);

    const targetDate = new Date("2024-06-15");
    await getTasksDueOnDate(mockUserId, targetDate);

    expect(db.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueDate: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
      })
    );
  });
});

// ─────────────────────────────────────────────────────────────
// Assignment Query Tests
// ─────────────────────────────────────────────────────────────

describe("getTasksAssignedTo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns tasks assigned to person", async () => {
    vi.mocked(db.task.findMany).mockResolvedValue([
      { ...mockTask, assignedToId: mockPersonId },
    ]);

    const result = await getTasksAssignedTo(mockUserId, mockPersonId);

    expect(result).toHaveLength(1);
    expect(db.task.findMany).toHaveBeenCalledWith({
      where: {
        userId: mockUserId,
        assignedToId: mockPersonId,
        deletedAt: null,
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Find By Source Tests
// ─────────────────────────────────────────────────────────────

describe("findTaskBySource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("finds task by source and sourceId", async () => {
    const slackTask = { ...mockTask, source: "slack", sourceId: "slack-123" };
    vi.mocked(db.task.findFirst).mockResolvedValue(slackTask);

    const result = await findTaskBySource(mockUserId, "slack", "slack-123");

    expect(result).toEqual(slackTask);
  });
});

// ─────────────────────────────────────────────────────────────
// Search Tasks Tests
// ─────────────────────────────────────────────────────────────

describe("searchTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("searches across multiple fields", async () => {
    vi.mocked(db.task.findMany).mockResolvedValue([mockTask]);

    const result = await searchTasks(mockUserId, "project");

    expect(result).toHaveLength(1);
    expect(db.task.findMany).toHaveBeenCalledWith(
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

describe("upsertTasksFromSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates new tasks when not found", async () => {
    vi.mocked(db.task.findFirst).mockResolvedValue(null);
    vi.mocked(db.task.create).mockResolvedValue(mockTask);

    const result = await upsertTasksFromSource(mockUserId, "slack", [
      {
        sourceId: "slack-123",
        data: { title: "New Task" },
      },
    ]);

    expect(result.created).toHaveLength(1);
    expect(result.updated).toHaveLength(0);
    expect(result.unchanged).toBe(0);
  });

  it("updates existing tasks when data changed", async () => {
    const existingTask = {
      ...mockTask,
      source: "slack",
      sourceId: "slack-123",
    };
    vi.mocked(db.task.findFirst).mockResolvedValue(existingTask);
    vi.mocked(db.task.update).mockResolvedValue({
      ...existingTask,
      title: "Updated Task",
    });

    const result = await upsertTasksFromSource(mockUserId, "slack", [
      {
        sourceId: "slack-123",
        data: { title: "Updated Task" },
      },
    ]);

    expect(result.created).toHaveLength(0);
    expect(result.updated).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────
// TasksServiceError Tests
// ─────────────────────────────────────────────────────────────

describe("TasksServiceError", () => {
  it("creates error with code and message", () => {
    const error = new TasksServiceError("TASK_NOT_FOUND", "Task not found");

    expect(error.code).toBe("TASK_NOT_FOUND");
    expect(error.message).toBe("Task not found");
    expect(error.name).toBe("TasksServiceError");
  });

  it("includes optional details", () => {
    const error = new TasksServiceError("CIRCULAR_REFERENCE", "Circular", {
      taskId: "task-a",
      parentId: "task-b",
    });

    expect(error.details).toEqual({ taskId: "task-a", parentId: "task-b" });
  });
});
