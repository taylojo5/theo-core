// ═══════════════════════════════════════════════════════════════════════════
// Places Service
// Barrel exports for Place entity management
// ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type {
  // Service interface
  IPlacesService,
  // Place-specific types
  SearchPlacesOptions,
  SourcePlaceInput,
  GeocodingResult,
  PlacesErrorCode,
  // Re-exported base types
  Place,
  CreatePlaceInput,
  UpdatePlaceInput,
  ListPlacesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
} from "./types";

export { PlacesServiceError } from "./types";

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

export {
  // Service object
  PlacesService,
  // Individual functions (for direct import)
  createPlace,
  getPlaceById,
  updatePlace,
  deletePlace,
  restorePlace,
  listPlaces,
  findPlaceBySource,
  searchPlaces,
  findPlacesByCity,
  findPlacesNearby,
  upsertPlacesFromSource,
} from "./places-service";
