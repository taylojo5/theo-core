// ═══════════════════════════════════════════════════════════════════════════
// Integration API Path Exports
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { registerIntegrationStatusPaths } from "./status";
import { registerGmailPaths } from "./gmail";

export function registerIntegrationPaths(registry: OpenAPIRegistry) {
  registerIntegrationStatusPaths(registry);
  registerGmailPaths(registry);
}

export { registerIntegrationStatusPaths, registerGmailPaths };

