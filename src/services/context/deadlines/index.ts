// ═══════════════════════════════════════════════════════════════════════════
// Deadlines Service
// Barrel exports for Deadline entity management
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Service interface
  IDeadlinesService,
  // Deadline-specific types
  SearchDeadlinesOptions,
  SourceDeadlineInput,
  DeadlineWithRelations,
  DeadlineWithUrgency,
  UrgencyLevel,
  DeadlineUrgencyOptions,
  DeadlinesErrorCode,
  // Re-exported base types
  Deadline,
  Task,
  Event,
  CreateDeadlineInput,
  UpdateDeadlineInput,
  ListDeadlinesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  DeadlineStatus,
  DeadlineType,
} from "./types";

export { DeadlinesServiceError } from "./types";

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  DeadlinesService,
  // Individual functions (for direct import)
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
} from "./deadlines-service";

