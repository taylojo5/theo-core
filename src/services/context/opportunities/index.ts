// ═══════════════════════════════════════════════════════════════════════════
// Opportunities Service - Index
// Barrel exports for the Opportunities context service
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Service object
  OpportunitiesService,
  // Individual functions
  createOpportunity,
  getOpportunityById,
  updateOpportunity,
  deleteOpportunity,
  restoreOpportunity,
  startEvaluatingOpportunity,
  pursueOpportunity,
  declineOpportunity,
  markOpportunityExpired,
  archiveOpportunity,
  convertOpportunity,
  listOpportunities,
  findOpportunityBySource,
  searchOpportunities,
  getActiveOpportunities,
  getExpiringOpportunities,
  getOpportunitiesByPerson,
  getOpportunitiesByCategory,
  upsertOpportunitiesFromSource,
} from "./opportunities-service";

export type {
  // Service interface
  IOpportunitiesService,
  // Opportunity-specific types
  SearchOpportunitiesOptions,
  SourceOpportunityInput,
  OpportunitiesErrorCode,
} from "./types";

export { OpportunitiesServiceError } from "./types";

// Re-export types from base for convenience
export type {
  Opportunity,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  ListOpportunitiesOptions,
  OpportunityStatus,
  OpportunityType,
  OpportunityPriority,
} from "./types";

