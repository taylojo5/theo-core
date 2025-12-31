// ═══════════════════════════════════════════════════════════════════════════
// Calendar Action Types
// Type definitions for calendar event actions and approval workflows
// ═══════════════════════════════════════════════════════════════════════════

import type {
  CalendarActionType,
  CalendarApprovalStatus,
  EventCreateInput,
  EventUpdateInput,
  AttendeeResponseStatus,
} from "../types";
import type { CalendarApproval, Event } from "@prisma/client";

// ─────────────────────────────────────────────────────────────
// Action Request Types
// ─────────────────────────────────────────────────────────────

/**
 * Base interface for all action requests
 */
export interface BaseActionRequest {
  /** User ID requesting the action */
  userId: string;
  /** Calendar ID for the action */
  calendarId: string;
  /** Entity requesting the action (e.g., "agent", "user") */
  requestedBy?: string;
  /** Notes or reason for the action */
  notes?: string;
}

/**
 * Request to create a new event
 */
export interface CreateEventRequest extends BaseActionRequest {
  actionType: "create";
  /** Event data to create */
  event: EventCreateInput;
  /** Check for conflicts before creating */
  checkConflicts?: boolean;
}

/**
 * Request to update an existing event
 */
export interface UpdateEventRequest extends BaseActionRequest {
  actionType: "update";
  /** Internal event ID to update */
  eventId: string;
  /** Google Event ID (if known) */
  googleEventId?: string;
  /** Updates to apply */
  updates: EventUpdateInput;
  /** Check for conflicts before updating */
  checkConflicts?: boolean;
  /** How to notify attendees */
  sendUpdates?: "all" | "externalOnly" | "none";
}

/**
 * Request to delete an event
 */
export interface DeleteEventRequest extends BaseActionRequest {
  actionType: "delete";
  /** Internal event ID to delete */
  eventId: string;
  /** Google Event ID (if known) */
  googleEventId?: string;
  /** How to notify attendees */
  sendUpdates?: "all" | "externalOnly" | "none";
}

/**
 * Request to respond to an event invitation
 */
export interface RespondEventRequest extends BaseActionRequest {
  actionType: "respond";
  /** Internal event ID to respond to */
  eventId: string;
  /** Google Event ID (if known) */
  googleEventId?: string;
  /** Response status */
  response: AttendeeResponseStatus;
  /** Optional response comment */
  comment?: string;
  /** How to notify attendees */
  sendUpdates?: "all" | "externalOnly" | "none";
}

/**
 * Union of all action request types
 */
export type ActionRequest =
  | CreateEventRequest
  | UpdateEventRequest
  | DeleteEventRequest
  | RespondEventRequest;

// ─────────────────────────────────────────────────────────────
// Action Result Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of an action request (approval creation)
 */
export interface ActionRequestResult {
  /** Whether the request was accepted */
  success: boolean;
  /** The created approval record */
  approval?: CalendarApproval;
  /** Approval ID for reference */
  approvalId?: string;
  /** Conflict information (if any) */
  conflicts?: ConflictInfo[];
  /** Error message (if not successful) */
  error?: string;
  /** Human-readable message */
  message: string;
}

/**
 * Result of executing an approved action
 */
export interface ActionExecuteResult {
  /** Whether the execution was successful */
  success: boolean;
  /** The resulting event (for create/update/respond) */
  event?: Event;
  /** The approval record after execution */
  approval?: CalendarApproval;
  /** Error message (if not successful) */
  error?: string;
  /** Human-readable message */
  message: string;
}

/**
 * Result of an approval decision (approve/reject)
 */
export interface ApprovalDecisionResult {
  /** Whether the decision was processed */
  success: boolean;
  /** The updated approval record */
  approval?: CalendarApproval;
  /** The resulting event (if action was executed) */
  event?: Event;
  /** Error message (if not successful) */
  error?: string;
  /** Human-readable message */
  message: string;
}

// ─────────────────────────────────────────────────────────────
// Conflict Types
// ─────────────────────────────────────────────────────────────

/**
 * Information about a scheduling conflict
 */
export interface ConflictInfo {
  /** Internal ID of the conflicting event */
  eventId: string;
  /** Google Event ID of the conflicting event */
  googleEventId?: string;
  /** Title of the conflicting event */
  title: string;
  /** Start time of the conflicting event */
  startsAt: Date;
  /** End time of the conflicting event */
  endsAt: Date;
  /** Whether this is an all-day event */
  allDay: boolean;
  /** Calendar ID of the conflicting event */
  calendarId?: string;
  /** Type of conflict */
  conflictType: ConflictType;
  /** Severity of the conflict */
  severity: ConflictSeverity;
}

/**
 * Types of scheduling conflicts
 */
export type ConflictType =
  | "overlap" // Events overlap in time
  | "same_time" // Events start at the exact same time
  | "back_to_back" // Events are immediately adjacent (no buffer)
  | "travel_time"; // Not enough travel time between locations

/**
 * Severity levels for conflicts
 */
export type ConflictSeverity =
  | "high" // Definite conflict (overlapping times)
  | "medium" // Likely conflict (back-to-back, travel time)
  | "low"; // Potential conflict (same calendar, busy time)

/**
 * Options for conflict detection
 */
export interface ConflictDetectionOptions {
  /** Event ID to exclude from conflict check (for updates) */
  excludeEventId?: string;
  /** Calendar IDs to check for conflicts */
  calendarIds?: string[];
  /** Minimum buffer time between events in minutes */
  bufferMinutes?: number;
  /** Whether to check for travel time conflicts */
  checkTravelTime?: boolean;
  /** Maximum number of conflicts to return */
  maxConflicts?: number;
}

// ─────────────────────────────────────────────────────────────
// Event Snapshot Types
// ─────────────────────────────────────────────────────────────

/**
 * Snapshot of event data stored in approval record
 * Captures the intended state for create/update operations
 */
export interface EventSnapshot {
  /** Action type */
  actionType: CalendarActionType;
  /** Event data (for create) */
  createData?: EventCreateInput;
  /** Update data (for update) */
  updateData?: EventUpdateInput;
  /** Response data (for respond) */
  responseData?: {
    response: AttendeeResponseStatus;
    comment?: string;
  };
  /** Original event state (for update/delete/respond) */
  originalEvent?: {
    id: string;
    googleEventId?: string;
    title?: string;
    startsAt?: Date;
    endsAt?: Date;
    calendarId?: string;
  };
  /** Detected conflicts */
  conflicts?: ConflictInfo[];
  /** Send updates setting */
  sendUpdates?: "all" | "externalOnly" | "none";
}

// ─────────────────────────────────────────────────────────────
// Action Options
// ─────────────────────────────────────────────────────────────

/**
 * Options for action execution
 */
export interface ActionExecuteOptions {
  /** Skip conflict check during execution */
  skipConflictCheck?: boolean;
  /** Force execution even if conflicts exist */
  forceExecution?: boolean;
}

/**
 * Options for approval operations
 */
export interface ApprovalOptions {
  /** Custom expiration time */
  expiresAt?: Date;
  /** Whether to auto-execute on approval */
  autoExecute?: boolean;
  /** Additional metadata to store */
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────
// Validation Types
// ─────────────────────────────────────────────────────────────

/**
 * Result of validating an action request
 */
export interface ValidationResult {
  /** Whether the request is valid */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
}

/**
 * A validation error
 */
export interface ValidationError {
  /** Field that failed validation */
  field: string;
  /** Error message */
  message: string;
  /** Error code */
  code: string;
}

// ─────────────────────────────────────────────────────────────
// Re-exports for convenience
// ─────────────────────────────────────────────────────────────

export type { CalendarActionType, CalendarApprovalStatus };
