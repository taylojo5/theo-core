import { db } from "@/lib/db";
import { KrogerTokenSet } from "../types";
import { KrogerConnection } from "@prisma/client";
import { decrypt, encrypt } from "@/lib/crypto";
import { omit } from "lodash";
import { cacheDelete, cacheGet, cacheSet } from "@/lib/redis/cache";
import { KROGER_TOKEN_CACHE_PREFIX } from "../constants";
import { refreshKrogerTokenSet } from "./oauth";



export async function getKrogerTokenSet(
  userId: string
): Promise<KrogerTokenSet | null> {
  // Get the token set from the cache
  const cachedTokenSet = await cacheGet<KrogerTokenSet>(`${KROGER_TOKEN_CACHE_PREFIX}${userId}`);
  if (cachedTokenSet) {
    return {
      tokenType: "Bearer",
      accessToken: decrypt(cachedTokenSet.accessToken),
      refreshToken: decrypt(cachedTokenSet.refreshToken ?? ""),
      expiresAt: cachedTokenSet.expiresAt,
      scopes: cachedTokenSet.scopes,
    };
  }

  // Get the token set from the database
  const connection = await db.krogerConnection.findFirst({
    where: {
      userId,
    },
    include: {
      store: true,
    },
  });
  if (!connection) return null;

  const refreshedTokenSet = await refreshKrogerTokenSet({
    accessToken: decrypt(connection.accessToken),
    refreshToken: decrypt(connection.refreshToken ?? ""),
    expiresAt: connection.tokenExpiresAt,
    scopes: connection.scopes,
    tokenType: "Bearer",
  });
  await storeKrogerTokenSet(userId, refreshedTokenSet);
  return refreshedTokenSet;
}

export async function storeKrogerTokenSet(
  userId: string,
  tokenSet: KrogerTokenSet
): Promise<void> {
  // Store the token set
  await db.krogerConnection.upsert({
    where: {
      userId,
    },
    update: {
      accessToken: encrypt(tokenSet.accessToken),
      refreshToken: encrypt(tokenSet.refreshToken ?? ""),
      tokenExpiresAt: tokenSet.expiresAt,
      scopes: tokenSet.scopes,
    },
    create: {
      userId,
      accessToken: encrypt(tokenSet.accessToken),
      refreshToken: encrypt(tokenSet.refreshToken ?? ""),
      tokenExpiresAt: tokenSet.expiresAt,
      scopes: tokenSet.scopes,
    },
  });
  // Cache the token set
  await cacheSet<KrogerTokenSet>(`${KROGER_TOKEN_CACHE_PREFIX}${userId}`, {
    tokenType: "Bearer",
    accessToken: encrypt(tokenSet.accessToken),
    refreshToken: encrypt(tokenSet.refreshToken ?? ""),
    expiresAt: tokenSet.expiresAt,
    scopes: tokenSet.scopes,
  }, {
    // Cache the token until 1 min before it expires
    ttlSeconds: Math.floor((tokenSet.expiresAt.getTime() - Date.now()) / 1000) - 60,
  });
  return;
}

export async function getKrogerConnection(
  userId: string
): Promise<Omit<KrogerConnection, "accessToken" | "refreshToken"> | null> {
  // Get the connection
  const connection = await db.krogerConnection.findFirst({
    where: {
      userId,
    },
    include: {
      store: true,
    },
  });
  if (!connection) return null;
  return omit(connection, ["accessToken", "refreshToken"]);
}

export async function createKrogerConnection(
  connection: KrogerConnection
): Promise<KrogerConnection> {
  // Create the connection
  const createdConnection = await db.krogerConnection.create({
    data: {
      ...connection,
      accessToken: encrypt(connection.accessToken ?? ""),
      refreshToken: encrypt(connection.refreshToken ?? ""),
    },
  });
  return createdConnection;
}

export async function updateKrogerConnection(
  connection: Omit<KrogerConnection, "accessToken" | "refreshToken">
): Promise<Omit<KrogerConnection, "accessToken" | "refreshToken">> {
  // Update the connection
  const updatedConnection = await db.krogerConnection.update({
    where: {
      id: connection.id,
    },
    data: {
      ...connection,
    },
    include: {
      store: true,
    },
  });
  return omit(updatedConnection, ["accessToken", "refreshToken"]);
}

export async function deleteKrogerConnection(userId: string): Promise<void> {
  // Delete the connection
  await db.krogerConnection.delete({
    where: {
      userId,
    },
  });
  // Delete the cache
  await cacheDelete(`${KROGER_TOKEN_CACHE_PREFIX}${userId}`);
}
