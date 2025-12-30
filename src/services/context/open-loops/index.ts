// ═══════════════════════════════════════════════════════════════════════════
// OpenLoops Service - Index
// Barrel exports for the OpenLoops context service
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Service object
  OpenLoopsService,
  // Individual functions
  createOpenLoop,
  getOpenLoopById,
  updateOpenLoop,
  deleteOpenLoop,
  restoreOpenLoop,
  resolveOpenLoop,
  cancelOpenLoop,
  markOpenLoopStale,
  reopenOpenLoop,
  listOpenLoops,
  findOpenLoopBySource,
  searchOpenLoops,
  getOpenOpenLoops,
  getOverdueOpenLoops,
  getOpenLoopsByPerson,
  upsertOpenLoopsFromSource,
} from "./open-loops-service";

export type {
  // Service interface
  IOpenLoopsService,
  // OpenLoop-specific types
  SearchOpenLoopsOptions,
  SourceOpenLoopInput,
  OpenLoopsErrorCode,
} from "./types";

export { OpenLoopsServiceError } from "./types";

// Re-export types from base for convenience
export type {
  OpenLoop,
  CreateOpenLoopInput,
  UpdateOpenLoopInput,
  ListOpenLoopsOptions,
  OpenLoopStatus,
  OpenLoopType,
  OpenLoopPriority,
} from "./types";



