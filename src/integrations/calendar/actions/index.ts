// ═══════════════════════════════════════════════════════════════════════════
// Calendar Actions Module
// Event CRUD operations with approval workflow
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Request types
  BaseActionRequest,
  CreateEventRequest,
  UpdateEventRequest,
  DeleteEventRequest,
  RespondEventRequest,
  ActionRequest,
  
  // Result types
  ActionRequestResult,
  ActionExecuteResult,
  ApprovalDecisionResult,
  
  // Conflict types
  ConflictInfo,
  ConflictType,
  ConflictSeverity,
  ConflictDetectionOptions,
  
  // Snapshot types
  EventSnapshot,
  
  // Option types
  ActionExecuteOptions,
  ApprovalOptions,
  
  // Validation types
  ValidationResult,
  ValidationError,
  
  // Re-exported types
  CalendarActionType,
  CalendarApprovalStatus,
} from "./types";

// ─────────────────────────────────────────────────────────────
// Event Creation
// ─────────────────────────────────────────────────────────────

export {
  requestEventCreation,
  executeEventCreation,
} from "./create";

// ─────────────────────────────────────────────────────────────
// Event Update
// ─────────────────────────────────────────────────────────────

export {
  requestEventUpdate,
  executeEventUpdate,
} from "./update";

// ─────────────────────────────────────────────────────────────
// Event Deletion
// ─────────────────────────────────────────────────────────────

export {
  requestEventDeletion,
  executeEventDeletion,
} from "./delete";

// ─────────────────────────────────────────────────────────────
// Event Response (RSVP)
// ─────────────────────────────────────────────────────────────

export {
  requestEventResponse,
  executeEventResponse,
} from "./respond";

// ─────────────────────────────────────────────────────────────
// Approval Workflow
// ─────────────────────────────────────────────────────────────

export {
  approveCalendarAction,
  rejectCalendarAction,
  cancelApproval,
  expireOldApprovals,
  getPendingApprovals,
  getApproval,
} from "./approval";

// ─────────────────────────────────────────────────────────────
// Conflict Detection
// ─────────────────────────────────────────────────────────────

export {
  detectConflicts,
  hasHighSeverityConflicts,
  summarizeConflicts,
  formatConflictForDisplay,
  shouldBlockAction,
} from "./conflicts";

