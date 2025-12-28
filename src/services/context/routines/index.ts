// ═══════════════════════════════════════════════════════════════════════════
// Routines Service - Index
// Barrel exports for the Routines context service
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Service object
  RoutinesService,
  // Individual functions
  createRoutine,
  getRoutineById,
  updateRoutine,
  deleteRoutine,
  restoreRoutine,
  pauseRoutine,
  resumeRoutine,
  archiveRoutine,
  recordRoutineCompletion,
  recordRoutineSkip,
  listRoutines,
  findRoutineBySource,
  searchRoutines,
  getRoutinesDueNow,
  getUpcomingRoutines,
  getRoutinesByCategory,
  upsertRoutinesFromSource,
} from "./routines-service";

export type {
  // Service interface
  IRoutinesService,
  // Routine-specific types
  SearchRoutinesOptions,
  SourceRoutineInput,
  RoutinesErrorCode,
} from "./types";

export { RoutinesServiceError } from "./types";

// Re-export types from base for convenience
export type {
  Routine,
  CreateRoutineInput,
  UpdateRoutineInput,
  ListRoutinesOptions,
  RoutineStatus,
  RoutineType,
  RoutineFrequency,
} from "./types";

