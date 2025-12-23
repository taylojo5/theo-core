// ═══════════════════════════════════════════════════════════════════════════
// Context API Path Exports
// ═══════════════════════════════════════════════════════════════════════════

import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { registerPeoplePaths } from "./people";
import { registerPlacesPaths } from "./places";
import { registerEventsPaths } from "./events";
import { registerTasksPaths } from "./tasks";
import { registerDeadlinesPaths } from "./deadlines";
import { registerRelationshipsPaths } from "./relationships";
import { registerContextSearchPaths } from "./search";

export function registerContextPaths(registry: OpenAPIRegistry) {
  registerPeoplePaths(registry);
  registerPlacesPaths(registry);
  registerEventsPaths(registry);
  registerTasksPaths(registry);
  registerDeadlinesPaths(registry);
  registerRelationshipsPaths(registry);
  registerContextSearchPaths(registry);
}

export {
  registerPeoplePaths,
  registerPlacesPaths,
  registerEventsPaths,
  registerTasksPaths,
  registerDeadlinesPaths,
  registerRelationshipsPaths,
  registerContextSearchPaths,
};
