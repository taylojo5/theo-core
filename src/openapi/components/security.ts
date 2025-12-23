// ═══════════════════════════════════════════════════════════════════════════
// OpenAPI Security Schemes
// Authentication and authorization definitions
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import type { SecurityRequirementObject } from "openapi3-ts/oas31";

export function registerSecuritySchemes(registry: OpenAPIRegistry) {
  // Session-based authentication (NextAuth.js cookies)
  registry.registerComponent("securitySchemes", "sessionAuth", {
    type: "apiKey",
    in: "cookie",
    name: "next-auth.session-token",
    description:
      "Session cookie set by NextAuth.js after successful OAuth login. " +
      "In production, uses `__Secure-next-auth.session-token`.",
  });

  // Bearer token (for API clients)
  registry.registerComponent("securitySchemes", "bearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description:
      "Bearer token for programmatic API access. " +
      "Currently uses session tokens; dedicated API keys coming in future release.",
  });
}

// Default security requirement for protected endpoints
// Either session auth OR bearer auth can be used
export const protectedEndpoint: SecurityRequirementObject[] = [
  { sessionAuth: [] },
  { bearerAuth: [] },
];
