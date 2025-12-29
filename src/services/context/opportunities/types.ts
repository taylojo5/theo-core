// ═══════════════════════════════════════════════════════════════════════════
// Opportunities Service Types
// Opportunity-specific types, DTOs, and interfaces
// ═══════════════════════════════════════════════════════════════════════════

import type { Opportunity } from "@prisma/client";
import type {
  CreateOpportunityInput,
  UpdateOpportunityInput,
  ListOpportunitiesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  OpportunityStatus,
  OpportunityType,
  OpportunityPriority,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Search Options
// ─────────────────────────────────────────────────────────────

/** Options for opportunity search */
export interface SearchOpportunitiesOptions {
  /** Maximum results to return (default: 20) */
  limit?: number;
  /** Include soft-deleted opportunities */
  includeDeleted?: boolean;
  /** Filter by status */
  status?: OpportunityStatus;
  /** Filter by priority */
  priority?: OpportunityPriority;
}

// ─────────────────────────────────────────────────────────────
// Source Opportunity Input
// ─────────────────────────────────────────────────────────────

/** Input for upserting opportunities from external sources */
export interface SourceOpportunityInput {
  /** Unique ID from the source system */
  sourceId: string;
  /** Opportunity data */
  data: Omit<CreateOpportunityInput, "source" | "sourceId">;
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

export interface IOpportunitiesService {
  // CRUD
  create(
    userId: string,
    data: CreateOpportunityInput,
    context?: ServiceContext
  ): Promise<Opportunity>;

  getById(userId: string, id: string): Promise<Opportunity | null>;

  update(
    userId: string,
    id: string,
    data: UpdateOpportunityInput,
    context?: ServiceContext
  ): Promise<Opportunity>;

  delete(userId: string, id: string, context?: ServiceContext): Promise<void>;

  restore(userId: string, id: string, context?: ServiceContext): Promise<Opportunity>;

  // Status transitions
  startEvaluating(
    userId: string,
    id: string,
    context?: ServiceContext
  ): Promise<Opportunity>;

  pursue(
    userId: string,
    id: string,
    context?: ServiceContext
  ): Promise<Opportunity>;

  decline(
    userId: string,
    id: string,
    reason?: string,
    context?: ServiceContext
  ): Promise<Opportunity>;

  markExpired(
    userId: string,
    id: string,
    context?: ServiceContext
  ): Promise<Opportunity>;

  archive(
    userId: string,
    id: string,
    context?: ServiceContext
  ): Promise<Opportunity>;

  convert(
    userId: string,
    id: string,
    convertedToType: string,
    convertedToId: string,
    context?: ServiceContext
  ): Promise<Opportunity>;

  // Query
  list(
    userId: string,
    options?: ListOpportunitiesOptions
  ): Promise<PaginatedResult<Opportunity>>;

  findBySource(
    userId: string,
    source: Source,
    sourceId: string
  ): Promise<Opportunity | null>;

  search(
    userId: string,
    query: string,
    options?: SearchOpportunitiesOptions
  ): Promise<Opportunity[]>;

  // Status queries
  getActive(userId: string, limit?: number): Promise<Opportunity[]>;

  getExpiring(userId: string, withinDays?: number, limit?: number): Promise<Opportunity[]>;

  getByPerson(userId: string, personId: string): Promise<Opportunity[]>;

  getByCategory(userId: string, category: string): Promise<Opportunity[]>;

  // Bulk
  upsertFromSource(
    userId: string,
    source: Source,
    opportunities: SourceOpportunityInput[],
    context?: ServiceContext
  ): Promise<UpsertResult<Opportunity>>;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/** Error codes specific to opportunities service */
export type OpportunitiesErrorCode =
  | "OPPORTUNITY_NOT_FOUND"
  | "OPPORTUNITY_ALREADY_EXISTS"
  | "DUPLICATE_SOURCE_ID"
  | "INVALID_STATUS_TRANSITION"
  | "ALREADY_CONVERTED";

/** Custom error for opportunities service operations */
export class OpportunitiesServiceError extends Error {
  constructor(
    public readonly code: OpportunitiesErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "OpportunitiesServiceError";
  }
}

// Re-export types from base for convenience
export type {
  Opportunity,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  ListOpportunitiesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  OpportunityStatus,
  OpportunityType,
  OpportunityPriority,
};

