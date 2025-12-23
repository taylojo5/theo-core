// ═══════════════════════════════════════════════════════════════════════════
// Places Service
// CRUD operations for Place entities with audit logging
// ═══════════════════════════════════════════════════════════════════════════

import { db } from "@/lib/db";
import { logAuditEntry } from "@/services/audit";
import { Prisma } from "@prisma/client";
import {
  softDeleteFilter,
  normalizePagination,
  processPaginatedResults,
  buildOrderBy,
  normalizeTags,
  validateImportance,
} from "../utils";
import {
  embedPlace,
  removePlaceEmbedding,
  type EmbeddingContext,
} from "../embedding-integration";
import type {
  Place,
  CreatePlaceInput,
  UpdatePlaceInput,
  ListPlacesOptions,
  PaginatedResult,
  Source,
  ServiceContext,
  UpsertResult,
  IPlacesService,
  SearchPlacesOptions,
  SourcePlaceInput,
} from "./types";
import { PlacesServiceError as PlacesError } from "./types";

// ─────────────────────────────────────────────────────────────
// Coordinate Validation
// ─────────────────────────────────────────────────────────────

/**
 * Validate latitude/longitude coordinates
 */
function validateCoordinates(
  latitude?: number,
  longitude?: number
): { latitude?: number; longitude?: number } {
  if (latitude !== undefined) {
    if (latitude < -90 || latitude > 90) {
      throw new PlacesError(
        "INVALID_COORDINATES",
        `Invalid latitude: ${latitude}. Must be between -90 and 90.`
      );
    }
  }

  if (longitude !== undefined) {
    if (longitude < -180 || longitude > 180) {
      throw new PlacesError(
        "INVALID_COORDINATES",
        `Invalid longitude: ${longitude}. Must be between -180 and 180.`
      );
    }
  }

  return { latitude, longitude };
}

// ─────────────────────────────────────────────────────────────
// Places Service Implementation
// ─────────────────────────────────────────────────────────────

/**
 * Create a new place
 */
export async function createPlace(
  userId: string,
  data: CreatePlaceInput,
  context?: ServiceContext
): Promise<Place> {
  // Validate coordinates if provided
  const { latitude, longitude } = validateCoordinates(data.latitude, data.longitude);

  // Normalize tags
  const normalizedTags = data.tags ? normalizeTags(data.tags) : [];

  // Validate importance
  const importance = data.importance !== undefined
    ? validateImportance(data.importance)
    : 5;

  try {
    const place = await db.place.create({
      data: {
        userId,
        name: data.name,
        type: data.type ?? "location",
        address: data.address,
        city: data.city,
        state: data.state,
        country: data.country,
        postalCode: data.postalCode,
        latitude: latitude !== undefined ? new Prisma.Decimal(latitude) : undefined,
        longitude: longitude !== undefined ? new Prisma.Decimal(longitude) : undefined,
        timezone: data.timezone,
        notes: data.notes,
        importance,
        source: data.source,
        sourceId: data.sourceId,
        metadata: (data.metadata as Prisma.InputJsonValue) ?? {},
        tags: normalizedTags,
      },
    });

    // Log audit entry
    await logAuditEntry({
      userId: context?.userId ?? userId,
      sessionId: context?.sessionId,
      conversationId: context?.conversationId,
      actionType: "create",
      actionCategory: "context",
      entityType: "place",
      entityId: place.id,
      entitySnapshot: place as unknown as Prisma.InputJsonValue,
      outputSummary: `Created place: ${place.name}`,
    });

    // Generate embedding (fire-and-forget, errors don't fail the operation)
    void embedPlace(place, context as EmbeddingContext);

    return place;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = error.meta?.target as string[] | undefined;
        if (target?.includes("sourceId")) {
          throw new PlacesError(
            "DUPLICATE_SOURCE_ID",
            `A place from ${data.source} with ID ${data.sourceId} already exists`,
            { source: data.source, sourceId: data.sourceId }
          );
        }
      }
    }
    throw error;
  }
}

/**
 * Get a place by ID
 */
export async function getPlaceById(
  userId: string,
  id: string
): Promise<Place | null> {
  return db.place.findFirst({
    where: {
      id,
      userId,
      ...softDeleteFilter(),
    },
  });
}

/**
 * Update a place
 */
export async function updatePlace(
  userId: string,
  id: string,
  data: UpdatePlaceInput,
  context?: ServiceContext
): Promise<Place> {
  // Verify place exists and user owns it
  const existing = await db.place.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new PlacesError("PLACE_NOT_FOUND", `Place not found: ${id}`);
  }

  // Validate coordinates if provided
  const { latitude, longitude } = validateCoordinates(data.latitude, data.longitude);

  // Normalize tags if provided
  const normalizedTags = data.tags ? normalizeTags(data.tags) : undefined;

  // Validate importance if provided
  const importance = data.importance !== undefined
    ? validateImportance(data.importance)
    : undefined;

  try {
    const place = await db.place.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.state !== undefined && { state: data.state }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
        ...(latitude !== undefined && { latitude: new Prisma.Decimal(latitude) }),
        ...(longitude !== undefined && { longitude: new Prisma.Decimal(longitude) }),
        ...(data.timezone !== undefined && { timezone: data.timezone }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(importance !== undefined && { importance }),
        ...(data.metadata !== undefined && {
          metadata: data.metadata as Prisma.InputJsonValue,
        }),
        ...(normalizedTags !== undefined && { tags: normalizedTags }),
      },
    });

    // Log audit entry
    await logAuditEntry({
      userId: context?.userId ?? userId,
      sessionId: context?.sessionId,
      conversationId: context?.conversationId,
      actionType: "update",
      actionCategory: "context",
      entityType: "place",
      entityId: place.id,
      entitySnapshot: place as unknown as Prisma.InputJsonValue,
      outputSummary: `Updated place: ${place.name}`,
    });

    // Update embedding (fire-and-forget, errors don't fail the operation)
    void embedPlace(place, context as EmbeddingContext);

    return place;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        const target = error.meta?.target as string[] | undefined;
        if (target?.includes("sourceId")) {
          throw new PlacesError(
            "DUPLICATE_SOURCE_ID",
            `A place with this source ID already exists`,
            { sourceId: data }
          );
        }
      }
    }
    throw error;
  }
}

/**
 * Soft delete a place
 */
export async function deletePlace(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<void> {
  // Verify place exists and user owns it
  const existing = await db.place.findFirst({
    where: { id, userId, ...softDeleteFilter() },
  });

  if (!existing) {
    throw new PlacesError("PLACE_NOT_FOUND", `Place not found: ${id}`);
  }

  await db.place.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  // Log audit entry
  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "delete",
    actionCategory: "context",
    entityType: "place",
    entityId: id,
    outputSummary: `Deleted place: ${existing.name}`,
  });

  // Remove embedding (fire-and-forget, errors don't fail the operation)
  void removePlaceEmbedding(userId, id, context as EmbeddingContext);
}

/**
 * Restore a soft-deleted place
 */
export async function restorePlace(
  userId: string,
  id: string,
  context?: ServiceContext
): Promise<Place> {
  // Find deleted place
  const existing = await db.place.findFirst({
    where: {
      id,
      userId,
      deletedAt: { not: null },
    },
  });

  if (!existing) {
    throw new PlacesError(
      "PLACE_NOT_FOUND",
      `Deleted place not found: ${id}`
    );
  }

  const place = await db.place.update({
    where: { id },
    data: { deletedAt: null },
  });

  // Log audit entry
  await logAuditEntry({
    userId: context?.userId ?? userId,
    sessionId: context?.sessionId,
    conversationId: context?.conversationId,
    actionType: "update",
    actionCategory: "context",
    entityType: "place",
    entityId: place.id,
    outputSummary: `Restored place: ${place.name}`,
  });

  return place;
}

/**
 * List places with filtering and pagination
 */
export async function listPlaces(
  userId: string,
  options: ListPlacesOptions = {}
): Promise<PaginatedResult<Place>> {
  const pagination = normalizePagination(options);
  const orderBy = buildOrderBy(options.sortBy ?? "name", options.sortOrder ?? "asc");

  // Build where clause
  const where: Prisma.PlaceWhereInput = {
    userId,
    ...softDeleteFilter(options.includeDeleted),
    ...(options.type && { type: options.type }),
    ...(options.city && {
      city: { contains: options.city, mode: "insensitive" as const },
    }),
    ...(options.country && {
      country: { contains: options.country, mode: "insensitive" as const },
    }),
    ...(options.source && { source: options.source }),
    ...(options.tags?.length && { tags: { hasSome: options.tags } }),
    ...(options.search && {
      OR: [
        { name: { contains: options.search, mode: "insensitive" as const } },
        { address: { contains: options.search, mode: "insensitive" as const } },
        { city: { contains: options.search, mode: "insensitive" as const } },
        { country: { contains: options.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const places = await db.place.findMany({
    where,
    orderBy,
    ...pagination,
  });

  return processPaginatedResults(places, options.limit ?? 20);
}

/**
 * Find a place by source and sourceId
 */
export async function findPlaceBySource(
  userId: string,
  source: Source,
  sourceId: string
): Promise<Place | null> {
  return db.place.findFirst({
    where: {
      userId,
      source,
      sourceId,
      ...softDeleteFilter(),
    },
  });
}

/**
 * Search places by name/address
 */
export async function searchPlaces(
  userId: string,
  query: string,
  options: SearchPlacesOptions = {}
): Promise<Place[]> {
  const limit = options.limit ?? 20;

  const places = await db.place.findMany({
    where: {
      userId,
      ...softDeleteFilter(options.includeDeleted),
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { address: { contains: query, mode: "insensitive" } },
        { city: { contains: query, mode: "insensitive" } },
        { state: { contains: query, mode: "insensitive" } },
        { country: { contains: query, mode: "insensitive" } },
        { notes: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: [
      { importance: "desc" },
      { name: "asc" },
    ],
    take: limit,
  });

  return places;
}

/**
 * Find places by city
 */
export async function findPlacesByCity(
  userId: string,
  city: string
): Promise<Place[]> {
  return db.place.findMany({
    where: {
      userId,
      city: { contains: city, mode: "insensitive" },
      ...softDeleteFilter(),
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Find places near a coordinate (stub - requires PostGIS for proper implementation)
 * Currently uses simple bounding box approximation
 */
export async function findPlacesNearby(
  userId: string,
  latitude: number,
  longitude: number,
  radiusKm: number = 10
): Promise<Place[]> {
  // Simple approximation: 1 degree latitude ≈ 111km
  // This is a simplified bounding box query - for production, use PostGIS
  const latDelta = radiusKm / 111;
  const lonDelta = radiusKm / (111 * Math.cos((latitude * Math.PI) / 180));

  const places = await db.place.findMany({
    where: {
      userId,
      ...softDeleteFilter(),
      latitude: {
        gte: new Prisma.Decimal(latitude - latDelta),
        lte: new Prisma.Decimal(latitude + latDelta),
      },
      longitude: {
        gte: new Prisma.Decimal(longitude - lonDelta),
        lte: new Prisma.Decimal(longitude + lonDelta),
      },
    },
    orderBy: { name: "asc" },
  });

  return places;
}

/**
 * Upsert places from an external source
 */
export async function upsertPlacesFromSource(
  userId: string,
  source: Source,
  places: SourcePlaceInput[],
  context?: ServiceContext
): Promise<UpsertResult<Place>> {
  const created: Place[] = [];
  const updated: Place[] = [];
  let unchanged = 0;

  for (const { sourceId, data } of places) {
    const existing = await findPlaceBySource(userId, source, sourceId);

    if (existing) {
      // Check if data has changed
      const hasChanges =
        existing.name !== data.name ||
        (data.address !== undefined && existing.address !== data.address) ||
        (data.city !== undefined && existing.city !== data.city) ||
        (data.country !== undefined && existing.country !== data.country);

      if (hasChanges) {
        const updatedPlace = await updatePlace(
          userId,
          existing.id,
          { ...data },
          context
        );
        updated.push(updatedPlace);
      } else {
        unchanged++;
      }
    } else {
      const newPlace = await createPlace(
        userId,
        { ...data, source, sourceId },
        context
      );
      created.push(newPlace);
    }
  }

  return { created, updated, unchanged };
}

// ─────────────────────────────────────────────────────────────
// Service Object (for DI / testing)
// ─────────────────────────────────────────────────────────────

/**
 * Places service object implementing IPlacesService
 */
export const PlacesService: IPlacesService = {
  create: createPlace,
  getById: getPlaceById,
  update: updatePlace,
  delete: deletePlace,
  restore: restorePlace,
  list: listPlaces,
  findBySource: findPlaceBySource,
  search: searchPlaces,
  findByCity: findPlacesByCity,
  findNearby: findPlacesNearby,
  upsertFromSource: upsertPlacesFromSource,
};

