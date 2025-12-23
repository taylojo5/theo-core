// ═══════════════════════════════════════════════════════════════════════════
// People Service
// Barrel exports for Person entity management
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Service interface
  IPeopleService,
  // Person-specific types
  SearchPeopleOptions,
  SourcePersonInput,
  PeopleErrorCode,
  // Re-exported base types
  Person,
  CreatePersonInput,
  UpdatePersonInput,
  ListPeopleOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
} from "./types";

export { PeopleServiceError } from "./types";

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  PeopleService,
  // Individual functions (for direct import)
  createPerson,
  getPersonById,
  updatePerson,
  deletePerson,
  restorePerson,
  listPeople,
  findPersonByEmail,
  findPersonBySource,
  searchPeople,
  upsertPeopleFromSource,
} from "./people-service";

