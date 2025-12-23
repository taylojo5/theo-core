// ═══════════════════════════════════════════════════════════════════════════
// Places Service Types
// Place-specific types, DTOs, and interfaces
// ═══════════════════════════════════════════════════════════════════════════

import type { Place } from "@prisma/client";
import type {
  CreatePlaceInput,
  UpdatePlaceInput,
  ListPlacesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
} from "../types";

// ─────────────────────────────────────────────────────────────
// Search Options
// ─────────────────────────────────────────────────────────────

/** Options for place search */
export interface SearchPlacesOptions {
  /** Maximum results to return (default: 20) */
  limit?: number;
  /** Include soft-deleted places */
  includeDeleted?: boolean;
}

// ─────────────────────────────────────────────────────────────
// Source Place Input
// ─────────────────────────────────────────────────────────────

/** Input for upserting places from external sources */
export interface SourcePlaceInput {
  /** Unique ID from the source system */
  sourceId: string;
  /** Place data */
  data: Omit<CreatePlaceInput, "source" | "sourceId">;
}

// ─────────────────────────────────────────────────────────────
// Geocoding (stub for future integration)
// ─────────────────────────────────────────────────────────────

/** Result from geocoding service */
export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  timezone?: string;
}

// ─────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────

export interface IPlacesService {
  // CRUD
  create(
    userId: string,
    data: CreatePlaceInput,
    context?: ServiceContext
  ): Promise<Place>;

  getById(userId: string, id: string): Promise<Place | null>;

  update(
    userId: string,
    id: string,
    data: UpdatePlaceInput,
    context?: ServiceContext
  ): Promise<Place>;

  delete(userId: string, id: string, context?: ServiceContext): Promise<void>;

  restore(userId: string, id: string, context?: ServiceContext): Promise<Place>;

  // Query
  list(
    userId: string,
    options?: ListPlacesOptions
  ): Promise<PaginatedResult<Place>>;

  findBySource(
    userId: string,
    source: Source,
    sourceId: string
  ): Promise<Place | null>;

  search(
    userId: string,
    query: string,
    options?: SearchPlacesOptions
  ): Promise<Place[]>;

  // Location-based
  findByCity(userId: string, city: string): Promise<Place[]>;

  findNearby(
    userId: string,
    latitude: number,
    longitude: number,
    radiusKm?: number
  ): Promise<Place[]>;

  // Bulk
  upsertFromSource(
    userId: string,
    source: Source,
    places: SourcePlaceInput[],
    context?: ServiceContext
  ): Promise<UpsertResult<Place>>;
}

// ─────────────────────────────────────────────────────────────
// Error Types
// ─────────────────────────────────────────────────────────────

/** Error codes specific to places service */
export type PlacesErrorCode =
  | "PLACE_NOT_FOUND"
  | "PLACE_ALREADY_EXISTS"
  | "DUPLICATE_SOURCE_ID"
  | "INVALID_COORDINATES";

/** Custom error for places service operations */
export class PlacesServiceError extends Error {
  constructor(
    public readonly code: PlacesErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PlacesServiceError";
  }
}

// Re-export types from base for convenience
export type {
  Place,
  CreatePlaceInput,
  UpdatePlaceInput,
  ListPlacesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
};

