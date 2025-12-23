// ═══════════════════════════════════════════════════════════════════════════
// Token Encryption
// AES-256-GCM encryption for sensitive data at rest
// ═══════════════════════════════════════════════════════════════════════════

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "crypto";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 16;

// Prefix to identify encrypted values
const ENCRYPTED_PREFIX = "enc:v1:";

// ─────────────────────────────────────────────────────────────
// Key Derivation
// ─────────────────────────────────────────────────────────────

/**
 * Derive an encryption key from the master secret
 * Uses scrypt for key derivation with a salt
 */
function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH);
}

/**
 * Get the master encryption key from environment
 * Falls back to a derived key from NEXTAUTH_SECRET if TOKEN_ENCRYPTION_KEY is not set
 */
function getMasterSecret(): string {
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
  if (encryptionKey && encryptionKey.length >= 32) {
    return encryptionKey;
  }

  // Fallback to NextAuth secret (not recommended for production)
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;
  if (nextAuthSecret) {
    console.warn(
      "[Crypto] TOKEN_ENCRYPTION_KEY not set, falling back to NEXTAUTH_SECRET. " +
        "Set TOKEN_ENCRYPTION_KEY in production for better security."
    );
    return nextAuthSecret;
  }

  throw new Error(
    "No encryption key available. Set TOKEN_ENCRYPTION_KEY or NEXTAUTH_SECRET environment variable."
  );
}

// ─────────────────────────────────────────────────────────────
// Encryption Functions
// ─────────────────────────────────────────────────────────────

/**
 * Encrypt a string value using AES-256-GCM
 * Returns a prefixed string containing: salt + iv + authTag + ciphertext (base64)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext;

  const secret = getMasterSecret();
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(secret, salt);
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Combine: salt (16) + iv (16) + authTag (16) + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);

  return ENCRYPTED_PREFIX + combined.toString("base64");
}

/**
 * Decrypt a string value encrypted with encrypt()
 * Automatically handles both encrypted (prefixed) and plain values
 */
export function decrypt(encryptedValue: string): string {
  if (!encryptedValue) return encryptedValue;

  // If not encrypted (no prefix), return as-is (for backward compatibility)
  if (!encryptedValue.startsWith(ENCRYPTED_PREFIX)) {
    return encryptedValue;
  }

  const secret = getMasterSecret();

  // Remove prefix and decode
  const combined = Buffer.from(
    encryptedValue.slice(ENCRYPTED_PREFIX.length),
    "base64"
  );

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const ciphertext = combined.subarray(
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );

  // Derive key and decrypt
  const key = deriveKey(secret, salt);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Check if a value is encrypted
 */
export function isEncrypted(value: string | null | undefined): boolean {
  return value?.startsWith(ENCRYPTED_PREFIX) ?? false;
}

/**
 * Encrypt a value only if it's not already encrypted
 */
export function encryptIfPlain(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  if (isEncrypted(value)) return value;
  return encrypt(value);
}

/**
 * Safely decrypt a value, returning null on error
 */
export function safeDecrypt(value: string | null | undefined): string | null {
  if (!value) return null;

  try {
    return decrypt(value);
  } catch (error) {
    console.error("[Crypto] Decryption failed:", error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────
// Token-Specific Helpers
// ─────────────────────────────────────────────────────────────

export interface EncryptedTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

export interface DecryptedTokens {
  accessToken: string | null;
  refreshToken: string | null;
}

/**
 * Encrypt access and refresh tokens
 */
export function encryptTokens(
  accessToken: string | null | undefined,
  refreshToken: string | null | undefined
): EncryptedTokens {
  return {
    accessToken: accessToken ? encryptIfPlain(accessToken) : null,
    refreshToken: refreshToken ? encryptIfPlain(refreshToken) : null,
  };
}

/**
 * Decrypt access and refresh tokens
 */
export function decryptTokens(
  accessToken: string | null | undefined,
  refreshToken: string | null | undefined
): DecryptedTokens {
  return {
    accessToken: safeDecrypt(accessToken),
    refreshToken: safeDecrypt(refreshToken),
  };
}
