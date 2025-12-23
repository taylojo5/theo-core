// ═══════════════════════════════════════════════════════════════════════════
// Tasks Service
// Barrel exports for Task entity management
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Service interface
  ITasksService,
  // Task-specific types
  SearchTasksOptions,
  SourceTaskInput,
  TaskWithRelations,
  TaskDueDateOptions,
  TasksErrorCode,
  // Re-exported base types
  Task,
  Person,
  CreateTaskInput,
  UpdateTaskInput,
  ListTasksOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  TaskStatus,
  TaskPriority,
} from "./types";

export { TasksServiceError } from "./types";

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  TasksService,
  // Individual functions (for direct import)
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
} from "./tasks-service";

