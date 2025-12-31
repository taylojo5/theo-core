import { db } from "@/lib/db";
import { KrogerTokenSet } from "../types";
import { KrogerConnection } from "@prisma/client";
import { decrypt, encrypt } from "@/lib/crypto";
import { omit } from "lodash";

export async function getKrogerTokenSet(
  userId: string
): Promise<KrogerTokenSet | null> {
  // Get the token set
  const tokenSet = await db.krogerConnection.findFirst({
    where: {
      userId,
    },
    include: {
      store: true,
    },
  });
  if (!tokenSet) return null;
  return {
    tokenType: "Bearer",
    accessToken: decrypt(tokenSet.accessToken),
    refreshToken: decrypt(tokenSet.refreshToken ?? ""),
    expiresAt: tokenSet.tokenExpiresAt,
    scopes: tokenSet.scopes,
  };
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
}
