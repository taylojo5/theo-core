// ═══════════════════════════════════════════════════════════════════════════
// Notes Service - Index
// Barrel exports for the Notes context service
// ═══════════════════════════════════════════════════════════════════════════

export {
  // Service object
  NotesService,
  // Individual functions
  createNote,
  getNoteById,
  updateNote,
  deleteNote,
  restoreNote,
  pinNote,
  unpinNote,
  favoriteNote,
  unfavoriteNote,
  listNotes,
  findNoteBySource,
  searchNotes,
  getPinnedNotes,
  getFavoriteNotes,
  getRecentNotes,
  getNotesByCategory,
  upsertNotesFromSource,
} from "./notes-service";

export type {
  // Service interface
  INotesService,
  // Note-specific types
  SearchNotesOptions,
  SourceNoteInput,
  NotesErrorCode,
} from "./types";

export { NotesServiceError } from "./types";

// Re-export types from base for convenience
export type {
  Note,
  CreateNoteInput,
  UpdateNoteInput,
  ListNotesOptions,
  NoteType,
} from "./types";

