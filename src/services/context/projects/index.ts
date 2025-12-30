// ═══════════════════════════════════════════════════════════════════════════
// Projects Service - Index
// Barrel exports for the Projects context service
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Service object
  ProjectsService,
  // Individual functions
  createProject,
  getProjectById,
  getProjectByIdWithRelations,
  updateProject,
  deleteProject,
  restoreProject,
  startProject,
  completeProject,
  cancelProject,
  putProjectOnHold,
  archiveProject,
  getProjectChildren,
  setProjectParent,
  listProjects,
  findProjectBySource,
  searchProjects,
  getActiveProjects,
  getOverdueProjects,
  upsertProjectsFromSource,
} from "./projects-service";

export type {
  // Service interface
  IProjectsService,
  // Project-specific types
  SearchProjectsOptions,
  SourceProjectInput,
  ProjectWithRelations,
  ProjectsErrorCode,
} from "./types";

export { ProjectsServiceError } from "./types";

// Re-export types from base for convenience
export type {
  Project,
  CreateProjectInput,
  UpdateProjectInput,
  ListProjectsOptions,
  ProjectStatus,
  ProjectType,
  ProjectPriority,
} from "./types";



