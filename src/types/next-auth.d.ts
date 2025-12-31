import type { DefaultSession } from "next-auth";

/**
 * Module augmentation for NextAuth.js types
 * Adds user ID to session object
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
  }
}
