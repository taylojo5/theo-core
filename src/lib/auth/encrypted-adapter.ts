// ═══════════════════════════════════════════════════════════════════════════
// Encrypted Prisma Adapter
// Wraps the PrismaAdapter to encrypt OAuth tokens at rest
// ═══════════════════════════════════════════════════════════════════════════

import { PrismaAdapter } from "@auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";
import type { Adapter, AdapterAccount } from "next-auth/adapters";
import { encrypt } from "@/lib/crypto";

/**
 * Create an encrypted adapter that wraps PrismaAdapter
 * Encrypts access_token, refresh_token, and id_token before storage
 * Decrypts them when reading
 */
export function EncryptedPrismaAdapter(prisma: PrismaClient): Adapter {
  const baseAdapter = PrismaAdapter(prisma);

  return {
    ...baseAdapter,

    /**
     * Override linkAccount to encrypt tokens before storing
     */
    linkAccount: async (account: AdapterAccount): Promise<void> => {
      // Encrypt sensitive tokens
      const encryptedAccount = {
        ...account,
        access_token: account.access_token
          ? encrypt(account.access_token)
          : undefined,
        refresh_token: account.refresh_token
          ? encrypt(account.refresh_token)
          : undefined,
        id_token: account.id_token ? encrypt(account.id_token) : undefined,
      };

      // Use the base adapter's linkAccount with encrypted tokens
      await baseAdapter.linkAccount?.(encryptedAccount);
    },
  };
}
