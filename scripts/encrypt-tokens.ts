#!/usr/bin/env tsx
// ═══════════════════════════════════════════════════════════════════════════
// Token Encryption Migration Script
// Encrypts existing plain-text OAuth tokens in the database
// ═══════════════════════════════════════════════════════════════════════════
//
// Usage:
//   npx tsx scripts/encrypt-tokens.ts
//
// This script is safe to run multiple times - it will skip already encrypted tokens.
//
// IMPORTANT: Make sure TOKEN_ENCRYPTION_KEY is set in your environment before running.
// ═══════════════════════════════════════════════════════════════════════════

import { PrismaClient } from "@prisma/client";
import { encrypt, isEncrypted } from "../src/lib/crypto";

const prisma = new PrismaClient();

interface MigrationStats {
  total: number;
  alreadyEncrypted: number;
  encrypted: number;
  failed: number;
  errors: string[];
}

async function migrateAccountTokens(): Promise<MigrationStats> {
  console.log("🔐 Starting token encryption migration for Account table...\n");

  const stats: MigrationStats = {
    total: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    failed: 0,
    errors: [],
  };

  // Get all accounts with tokens
  const accounts = await prisma.account.findMany({
    select: {
      id: true,
      userId: true,
      provider: true,
      access_token: true,
      refresh_token: true,
      id_token: true,
    },
  });

  stats.total = accounts.length;
  console.log(`Found ${accounts.length} accounts to process.\n`);

  for (const account of accounts) {
    const updates: Record<string, string | null> = {};
    let needsUpdate = false;
    let alreadyEncrypted = true;

    // Check and encrypt access_token
    if (account.access_token) {
      if (isEncrypted(account.access_token)) {
        console.log(
          `  ✓ Account ${account.id}: access_token already encrypted`
        );
      } else {
        try {
          updates.access_token = encrypt(account.access_token);
          needsUpdate = true;
          alreadyEncrypted = false;
        } catch (error) {
          stats.errors.push(`Account ${account.id} access_token: ${error}`);
          stats.failed++;
          continue;
        }
      }
    }

    // Check and encrypt refresh_token
    if (account.refresh_token) {
      if (isEncrypted(account.refresh_token)) {
        console.log(
          `  ✓ Account ${account.id}: refresh_token already encrypted`
        );
      } else {
        try {
          updates.refresh_token = encrypt(account.refresh_token);
          needsUpdate = true;
          alreadyEncrypted = false;
        } catch (error) {
          stats.errors.push(`Account ${account.id} refresh_token: ${error}`);
          stats.failed++;
          continue;
        }
      }
    }

    // Check and encrypt id_token
    if (account.id_token) {
      if (isEncrypted(account.id_token)) {
        console.log(`  ✓ Account ${account.id}: id_token already encrypted`);
      } else {
        try {
          updates.id_token = encrypt(account.id_token);
          needsUpdate = true;
          alreadyEncrypted = false;
        } catch (error) {
          stats.errors.push(`Account ${account.id} id_token: ${error}`);
          stats.failed++;
          continue;
        }
      }
    }

    // Update the account if needed
    if (needsUpdate) {
      try {
        await prisma.account.update({
          where: { id: account.id },
          data: updates,
        });
        console.log(
          `  🔒 Account ${account.id}: tokens encrypted successfully`
        );
        stats.encrypted++;
      } catch (error) {
        stats.errors.push(`Account ${account.id} update failed: ${error}`);
        stats.failed++;
      }
    } else if (
      alreadyEncrypted &&
      (account.access_token || account.refresh_token || account.id_token)
    ) {
      stats.alreadyEncrypted++;
    }
  }

  return stats;
}

async function migrateConnectedAccountTokens(): Promise<MigrationStats> {
  console.log(
    "\n🔐 Starting token encryption migration for ConnectedAccount table...\n"
  );

  const stats: MigrationStats = {
    total: 0,
    alreadyEncrypted: 0,
    encrypted: 0,
    failed: 0,
    errors: [],
  };

  // Get all connected accounts with tokens
  const connectedAccounts = await prisma.connectedAccount.findMany({
    select: {
      id: true,
      userId: true,
      provider: true,
      accessToken: true,
      refreshToken: true,
    },
  });

  stats.total = connectedAccounts.length;
  console.log(
    `Found ${connectedAccounts.length} connected accounts to process.\n`
  );

  for (const account of connectedAccounts) {
    const updates: Record<string, string | null> = {};
    let needsUpdate = false;
    let alreadyEncrypted = true;

    // Check and encrypt accessToken
    if (account.accessToken) {
      if (isEncrypted(account.accessToken)) {
        console.log(
          `  ✓ ConnectedAccount ${account.id}: accessToken already encrypted`
        );
      } else {
        try {
          updates.accessToken = encrypt(account.accessToken);
          needsUpdate = true;
          alreadyEncrypted = false;
        } catch (error) {
          stats.errors.push(
            `ConnectedAccount ${account.id} accessToken: ${error}`
          );
          stats.failed++;
          continue;
        }
      }
    }

    // Check and encrypt refreshToken
    if (account.refreshToken) {
      if (isEncrypted(account.refreshToken)) {
        console.log(
          `  ✓ ConnectedAccount ${account.id}: refreshToken already encrypted`
        );
      } else {
        try {
          updates.refreshToken = encrypt(account.refreshToken);
          needsUpdate = true;
          alreadyEncrypted = false;
        } catch (error) {
          stats.errors.push(
            `ConnectedAccount ${account.id} refreshToken: ${error}`
          );
          stats.failed++;
          continue;
        }
      }
    }

    // Update the connected account if needed
    if (needsUpdate) {
      try {
        await prisma.connectedAccount.update({
          where: { id: account.id },
          data: updates,
        });
        console.log(
          `  🔒 ConnectedAccount ${account.id}: tokens encrypted successfully`
        );
        stats.encrypted++;
      } catch (error) {
        stats.errors.push(
          `ConnectedAccount ${account.id} update failed: ${error}`
        );
        stats.failed++;
      }
    } else if (
      alreadyEncrypted &&
      (account.accessToken || account.refreshToken)
    ) {
      stats.alreadyEncrypted++;
    }
  }

  return stats;
}

function printStats(name: string, stats: MigrationStats): void {
  console.log(`\n📊 ${name} Results:`);
  console.log(`   Total accounts: ${stats.total}`);
  console.log(`   Already encrypted: ${stats.alreadyEncrypted}`);
  console.log(`   Newly encrypted: ${stats.encrypted}`);
  console.log(`   Failed: ${stats.failed}`);

  if (stats.errors.length > 0) {
    console.log("\n⚠️  Errors:");
    stats.errors.forEach((error) => console.log(`   - ${error}`));
  }
}

async function main() {
  console.log(
    "═══════════════════════════════════════════════════════════════"
  );
  console.log("             Token Encryption Migration Script");
  console.log(
    "═══════════════════════════════════════════════════════════════\n"
  );

  // Check for encryption key
  if (!process.env.TOKEN_ENCRYPTION_KEY && !process.env.NEXTAUTH_SECRET) {
    console.error(
      "❌ ERROR: Neither TOKEN_ENCRYPTION_KEY nor NEXTAUTH_SECRET is set."
    );
    console.error(
      "   Please set TOKEN_ENCRYPTION_KEY environment variable before running this script."
    );
    process.exit(1);
  }

  if (!process.env.TOKEN_ENCRYPTION_KEY) {
    console.warn("⚠️  WARNING: TOKEN_ENCRYPTION_KEY is not set.");
    console.warn("   Falling back to NEXTAUTH_SECRET for encryption.");
    console.warn("   For production, set a dedicated TOKEN_ENCRYPTION_KEY.\n");
  }

  try {
    const accountStats = await migrateAccountTokens();
    printStats("Account Table", accountStats);

    const connectedAccountStats = await migrateConnectedAccountTokens();
    printStats("ConnectedAccount Table", connectedAccountStats);

    console.log(
      "\n═══════════════════════════════════════════════════════════════"
    );
    console.log("                    Migration Complete!");
    console.log(
      "═══════════════════════════════════════════════════════════════\n"
    );

    const totalEncrypted =
      accountStats.encrypted + connectedAccountStats.encrypted;
    const totalFailed = accountStats.failed + connectedAccountStats.failed;

    if (totalFailed > 0) {
      console.log(
        `⚠️  ${totalFailed} token(s) failed to encrypt. Please review the errors above.`
      );
      process.exit(1);
    } else if (totalEncrypted > 0) {
      console.log(`✅ Successfully encrypted ${totalEncrypted} token(s).`);
    } else {
      console.log("✅ All tokens are already encrypted. Nothing to do.");
    }
  } catch (error) {
    console.error("\n❌ Migration failed with error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
