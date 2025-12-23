// ═══════════════════════════════════════════════════════════════════════════
// Integration API Path Exports
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { registerIntegrationStatusPaths } from "./status";
import { registerGmailPaths } from "./gmail";
import { registerCalendarPaths } from "./calendar";

export function registerIntegrationPaths(registry: OpenAPIRegistry) {
  registerIntegrationStatusPaths(registry);
  registerGmailPaths(registry);
  registerCalendarPaths(registry);
}

export { registerIntegrationStatusPaths, registerGmailPaths, registerCalendarPaths };

