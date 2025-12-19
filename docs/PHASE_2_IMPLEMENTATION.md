# Phase 2: Context System - Implementation Plan

> **Status**: Ready for Implementation  
> **Created**: December 2024  
> **Target Duration**: 3 weeks (Weeks 5-7 per SCAFFOLDING_PLAN.md)

---

## Overview

Phase 2 builds the **Context System** - the foundation of Theo's intelligence. This phase transforms the raw database schema (already created in Phase 0) into a fully functional context management system with CRUD operations, relationships, and semantic search via vector embeddings.

### Goals
- Context entity CRUD services for People, Places, Events, Tasks, Deadlines
- Relationship management system
- Context retrieval API endpoints
- Vector embeddings for semantic search
- Unified context search across all entities

### Prerequisites Completed (Phase 0 & 1)
- ✅ Database schema with all context tables
- ✅ Prisma client configured
- ✅ pgvector extension enabled
- ✅ Authentication working
- ✅ Audit logging service implemented
- ✅ Chat services pattern established

---

## Things You Need to Set Up / Provide

Before starting Phase 2, the following external dependencies are required:

### Required
| Item | Purpose | Where to Get |
|------|---------|--------------|
| **OpenAI API Key** | Text embeddings via `text-embedding-ada-002` or `text-embedding-3-small` | [OpenAI Platform](https://platform.openai.com/api-keys) |

### Recommended (can defer)
| Item | Purpose | Where to Get |
|------|---------|--------------|
| **Anthropic API Key** | Alternative embeddings/future agent | [Anthropic Console](https://console.anthropic.com/) |

### Environment Variables to Add

```bash
# Add to .env.local
OPENAI_API_KEY="sk-..."
# Optional for now
ANTHROPIC_API_KEY="sk-ant-..."
```

---

## Implementation Chunks

The work is divided into 8 chunks, each producing a committable unit of work. Chunks are designed to be worked on sequentially, though some can be parallelized (noted below).

---

## Chunk 1: Context Service Foundation & Types

**Estimated Time**: 2-3 hours  
**Dependencies**: None  
**Can Parallelize With**: None (foundational)

### Description
Establish the service layer pattern for context entities with shared types, utilities, and base service abstractions.

### Files to Create

```
src/services/context/
├── index.ts                 # Barrel exports
├── types.ts                 # Shared types and DTOs
├── utils.ts                 # Shared utilities (soft delete, etc.)
└── base-service.ts          # Optional: base class for CRUD
```

### Deliverables

1. **Types** (`types.ts`):
   - `EntityType` enum: `'person' | 'place' | 'event' | 'task' | 'deadline'`
   - `Source` enum: `'manual' | 'gmail' | 'slack' | 'calendar'`
   - `SortOrder`, `PaginationParams`, `PaginatedResult<T>` generics
   - Create/Update DTOs for each entity type
   - Query filter types for each entity

2. **Utilities** (`utils.ts`):
   - `excludeDeleted()` - Prisma filter for soft deletes
   - `buildPaginationQuery()` - Cursor-based pagination helper
   - `normalizeEmail()` - Email normalization
   - `generateContentHash()` - SHA256 for deduplication

3. **Barrel Exports** (`index.ts`):
   - Export all types and utilities
   - Will grow as services are added

### Acceptance Criteria
- [ ] All types compile without errors
- [ ] Utilities have unit tests
- [ ] Pattern matches existing `services/chat/types.ts` style

---

## Chunk 2: People Service (CRUD)

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 1  
**Can Parallelize With**: None

### Description
Full CRUD service for the Person entity, following the pattern established by ChatService.

### Files to Create/Modify

```
src/services/context/
├── people/
│   ├── index.ts             # Barrel exports
│   ├── types.ts             # Person-specific types (extends base)
│   └── people-service.ts    # PeopleService implementation
└── index.ts                 # Update barrel exports
```

### Service Methods

```typescript
interface PeopleService {
  // CRUD
  create(userId: string, data: CreatePersonInput): Promise<Person>
  getById(userId: string, id: string): Promise<Person | null>
  update(userId: string, id: string, data: UpdatePersonInput): Promise<Person>
  delete(userId: string, id: string): Promise<void>  // Soft delete
  restore(userId: string, id: string): Promise<Person>  // Undo delete
  
  // Query
  list(userId: string, options: ListPeopleOptions): Promise<PaginatedResult<Person>>
  findByEmail(userId: string, email: string): Promise<Person | null>
  findBySource(userId: string, source: string, sourceId: string): Promise<Person | null>
  search(userId: string, query: string, options?: SearchOptions): Promise<Person[]>
  
  // Bulk
  upsertFromSource(userId: string, source: string, people: SourcePerson[]): Promise<Person[]>
}
```

### Key Features
- Full audit logging on all mutations
- Ownership verification (userId check)
- Soft deletes with `deletedAt`
- Unique constraint handling (email, source+sourceId)
- Full-text search on name field
- Upsert for integration sync scenarios

### Acceptance Criteria
- [ ] All CRUD operations work correctly
- [ ] Audit logs created for create/update/delete
- [ ] Soft delete works (excludes from normal queries)
- [ ] Unique constraint errors handled gracefully
- [ ] Full-text search returns relevant results

---

## Chunk 3: Remaining Entity Services (Places, Events, Tasks, Deadlines)

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 2  
**Can Parallelize With**: Partially (after Chunk 2, these 4 can be done in parallel)

### Description
Implement CRUD services for the remaining context entities, following the People pattern.

### Files to Create

```
src/services/context/
├── places/
│   ├── index.ts
│   ├── types.ts
│   └── places-service.ts
├── events/
│   ├── index.ts
│   ├── types.ts
│   └── events-service.ts
├── tasks/
│   ├── index.ts
│   ├── types.ts
│   └── tasks-service.ts
├── deadlines/
│   ├── index.ts
│   ├── types.ts
│   └── deadlines-service.ts
└── index.ts                  # Update with all exports
```

### Entity-Specific Features

**Places**:
- Geocoding integration stub (future: Google Places API)
- Search by location/city

**Events**:
- Time range queries (upcoming, past, on date)
- Relation to Place (optional)
- Status transitions

**Tasks**:
- Hierarchy support (parent/subtasks)
- Status transitions (with completion timestamp)
- Due date queries (overdue, due soon)
- Assignment to Person

**Deadlines**:
- Relation to Task or Event
- Status transitions (pending → completed/missed)
- Urgency queries (approaching, overdue)

### Acceptance Criteria
- [ ] All 4 entity services implemented
- [ ] Each has full CRUD + list/search
- [ ] Entity-specific queries work
- [ ] All mutations have audit logging
- [ ] Services follow consistent patterns

---

## Chunk 4: Relationship Service

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 3 (or can start after Chunk 2)  
**Can Parallelize With**: Chunk 3

### Description
Service for managing relationships between any two entities (person-person, person-event, etc.).

### Files to Create

```
src/services/context/
├── relationships/
│   ├── index.ts
│   ├── types.ts
│   └── relationships-service.ts
└── index.ts                  # Update exports
```

### Service Methods

```typescript
interface RelationshipService {
  // Create/Manage
  create(userId: string, data: CreateRelationshipInput): Promise<EntityRelationship>
  update(userId: string, id: string, data: UpdateRelationshipInput): Promise<EntityRelationship>
  delete(userId: string, id: string): Promise<void>
  
  // Query
  getRelationshipsFor(
    userId: string, 
    entityType: EntityType, 
    entityId: string,
    options?: RelationshipQueryOptions
  ): Promise<EntityRelationship[]>
  
  getRelatedEntities<T>(
    userId: string,
    entityType: EntityType,
    entityId: string,
    targetType: EntityType,
    relationshipTypes?: string[]
  ): Promise<T[]>
  
  // Bulk for sync
  syncRelationships(
    userId: string,
    sourceType: EntityType,
    sourceId: string,
    relationships: CreateRelationshipInput[]
  ): Promise<void>
}
```

### Common Relationship Types to Support
- `works_with`, `manages`, `reports_to` (person ↔ person)
- `works_at`, `lives_at` (person → place)
- `attends`, `organizes` (person → event)
- `assigned_to`, `created_by` (person → task)
- `located_at` (event → place)

### Acceptance Criteria
- [ ] Can create/update/delete relationships
- [ ] Bidirectional relationships work correctly
- [ ] Can query relationships from either direction
- [ ] Can resolve related entities (get actual Person, not just ID)
- [ ] Audit logging on mutations

---

## Chunk 5: Context API Routes

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunks 2, 3, 4  
**Can Parallelize With**: None

### Description
REST API routes for all context entities, following the pattern from chat API routes.

### Files to Create

```
src/app/api/context/
├── people/
│   ├── route.ts              # GET (list), POST (create)
│   └── [id]/
│       └── route.ts          # GET, PATCH, DELETE
├── places/
│   ├── route.ts
│   └── [id]/
│       └── route.ts
├── events/
│   ├── route.ts
│   └── [id]/
│       └── route.ts
├── tasks/
│   ├── route.ts
│   └── [id]/
│       └── route.ts
├── deadlines/
│   ├── route.ts
│   └── [id]/
│       └── route.ts
├── relationships/
│   ├── route.ts              # GET (list), POST (create)
│   └── [id]/
│       └── route.ts          # PATCH, DELETE
└── search/
    └── route.ts              # GET - unified search endpoint
```

### API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/context/people` | List people (paginated, filterable) |
| POST | `/api/context/people` | Create person |
| GET | `/api/context/people/[id]` | Get person by ID |
| PATCH | `/api/context/people/[id]` | Update person |
| DELETE | `/api/context/people/[id]` | Soft delete person |
| ... | (same pattern for places, events, tasks, deadlines) | ... |
| GET | `/api/context/relationships` | List relationships |
| POST | `/api/context/relationships` | Create relationship |
| GET | `/api/context/search?q=...&types=...` | Unified search |

### Query Parameters
- `?cursor=` - Cursor for pagination
- `?limit=` - Page size (default 20, max 100)
- `?q=` - Search query
- `?type=` - Filter by type (entity-specific)
- `?source=` - Filter by source
- `?tags=` - Filter by tags (comma-separated)
- `?includeDeleted=true` - Include soft-deleted items

### Acceptance Criteria
- [ ] All CRUD endpoints work
- [ ] Authentication required on all routes
- [ ] Ownership verification (users only see their data)
- [ ] Proper HTTP status codes
- [ ] Validation errors return helpful messages
- [ ] Pagination works correctly
- [ ] Search endpoint queries across entity types

---

## Chunk 6: Embedding Service Foundation

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunk 1  
**Can Parallelize With**: Chunks 2-5

### Description
Core embedding service for generating and storing vector embeddings using OpenAI's API.

### Files to Create

```
src/lib/embeddings/
├── index.ts                  # Barrel exports
├── types.ts                  # Embedding types
├── openai-provider.ts        # OpenAI embedding provider
└── embedding-service.ts      # Main service
```

### Install Dependencies

```bash
npm install openai
```

### Service Interface

```typescript
interface EmbeddingService {
  // Generate embedding for text
  generateEmbedding(text: string): Promise<number[]>
  
  // Store embedding for entity
  storeEmbedding(params: {
    userId: string
    entityType: EntityType
    entityId: string
    content: string
    chunkIndex?: number
    metadata?: Record<string, unknown>
  }): Promise<Embedding>
  
  // Update embedding when entity changes
  updateEmbedding(
    userId: string,
    entityType: EntityType,
    entityId: string,
    newContent: string
  ): Promise<void>
  
  // Delete embeddings when entity deleted
  deleteEmbeddings(
    userId: string,
    entityType: EntityType,
    entityId: string
  ): Promise<void>
  
  // Content chunking for long text
  chunkContent(content: string, maxTokens?: number): string[]
}
```

### Key Considerations
- Use `text-embedding-3-small` (cheaper, still good quality) or `text-embedding-ada-002`
- Handle rate limiting with exponential backoff
- Content deduplication via `contentHash`
- Batch embedding generation for efficiency

### Acceptance Criteria
- [ ] Can generate embeddings from OpenAI
- [ ] Embeddings stored in database correctly
- [ ] Content hashing prevents duplicate work
- [ ] Long content chunked appropriately
- [ ] Rate limit handling works
- [ ] Service gracefully handles API errors

---

## Chunk 7: Semantic Search

**Estimated Time**: 4-5 hours  
**Dependencies**: Chunk 6  
**Can Parallelize With**: None

### Description
Implement vector similarity search using pgvector for semantic context retrieval.

### Files to Create/Modify

```
src/lib/embeddings/
├── search-service.ts         # Semantic search implementation
└── index.ts                  # Update exports

src/services/context/
├── context-search.ts         # Unified context search (text + semantic)
└── index.ts                  # Update exports

prisma/
└── (may need raw SQL for vector operations)
```

### Search Service Interface

```typescript
interface SemanticSearchService {
  // Find similar content by embedding
  searchSimilar(params: {
    userId: string
    query: string
    entityTypes?: EntityType[]
    limit?: number
    minSimilarity?: number
  }): Promise<SemanticSearchResult[]>
  
  // Find similar to existing entity
  findSimilarToEntity(params: {
    userId: string
    entityType: EntityType
    entityId: string
    targetTypes?: EntityType[]
    limit?: number
  }): Promise<SemanticSearchResult[]>
}

interface SemanticSearchResult {
  entityType: EntityType
  entityId: string
  content: string
  similarity: number
  metadata: Record<string, unknown>
}
```

### Vector Search with pgvector

```sql
-- Example query (will use Prisma.$queryRaw)
SELECT 
  entity_type,
  entity_id,
  content,
  1 - (embedding <=> $1::vector) as similarity
FROM embeddings
WHERE user_id = $2
  AND entity_type = ANY($3)
ORDER BY embedding <=> $1::vector
LIMIT $4;
```

### Unified Context Search

```typescript
interface ContextSearchService {
  // Combined text + semantic search
  search(params: {
    userId: string
    query: string
    entityTypes?: EntityType[]
    limit?: number
    useSemanticSearch?: boolean  // Default: true
  }): Promise<ContextSearchResult[]>
}
```

### Acceptance Criteria
- [ ] Vector similarity search returns relevant results
- [ ] Can filter by entity type
- [ ] Similarity scores are meaningful
- [ ] Combined text + semantic search works
- [ ] Performance is acceptable (< 500ms for typical queries)
- [ ] Empty results handled gracefully

---

## Chunk 8: Entity Embedding Integration

**Estimated Time**: 3-4 hours  
**Dependencies**: Chunks 2-4, 6-7  
**Can Parallelize With**: None (final integration)

### Description
Integrate embedding generation into entity lifecycle - automatically create/update embeddings when entities change.

### Files to Modify

```
src/services/context/
├── people/people-service.ts     # Add embedding hooks
├── places/places-service.ts     # Add embedding hooks
├── events/events-service.ts     # Add embedding hooks
├── tasks/tasks-service.ts       # Add embedding hooks
├── deadlines/deadlines-service.ts # Add embedding hooks
└── embedding-integration.ts     # Helper for building embeddable content
```

### Integration Pattern

```typescript
// In each service, after create/update:
async function afterEntityMutation(entity: Entity, operation: 'create' | 'update') {
  const content = buildEmbeddableContent(entity)
  await embeddingService.storeOrUpdate({
    userId: entity.userId,
    entityType: 'person', // or appropriate type
    entityId: entity.id,
    content,
  })
}

// Content builder creates searchable text representation
function buildEmbeddableContent(person: Person): string {
  return [
    person.name,
    person.email,
    person.company,
    person.title,
    person.bio,
    person.notes,
    person.tags.join(' '),
  ].filter(Boolean).join(' | ')
}
```

### Background Processing Option
For performance, embedding generation can be queued:

```typescript
// Option A: Inline (simple, blocks response)
await embeddingService.store(...)

// Option B: Queue (better UX, more complex)
await embeddingQueue.add('generate-embedding', { entityType, entityId })
```

For MVP, inline is fine. Can add BullMQ queue later for scale.

### Acceptance Criteria
- [ ] Creating entity generates embedding
- [ ] Updating entity updates embedding
- [ ] Deleting entity removes embedding
- [ ] Embedding content is meaningful/searchable
- [ ] No significant latency impact on API responses
- [ ] Error in embedding doesn't fail entity operation

---

## Testing Strategy

Each chunk should include:

1. **Unit Tests** (Vitest)
   - Service method logic
   - Utility functions
   - Type validations

2. **Integration Tests**
   - Database operations
   - API endpoints
   - Embedding generation (mock OpenAI)

3. **Test Files Structure**
```
tests/
├── services/
│   └── context/
│       ├── people-service.test.ts
│       ├── relationships-service.test.ts
│       └── ...
├── api/
│   └── context/
│       ├── people.test.ts
│       └── ...
└── lib/
    └── embeddings/
        └── embedding-service.test.ts
```

---

## Recommended Implementation Order

```
Week 1:
├── Chunk 1: Foundation & Types (Day 1)
├── Chunk 2: People Service (Day 2-3)
├── Chunk 6: Embedding Service Foundation (Day 3-4) [parallel]
└── Chunk 3: Remaining Entity Services (Day 4-5)

Week 2:
├── Chunk 4: Relationship Service (Day 1-2)
├── Chunk 5: API Routes (Day 2-4)
└── Chunk 7: Semantic Search (Day 4-5)

Week 3:
├── Chunk 8: Entity Embedding Integration (Day 1-2)
├── Testing & Bug Fixes (Day 3-4)
└── Documentation & Cleanup (Day 5)
```

---

## Post-Phase 2 Verification

Run these checks after Phase 2 is complete:

```bash
# All tests pass
npm test

# No TypeScript errors
npm run type-check

# No lint errors
npm run lint

# Build succeeds
npm run build

# Manual smoke test
# 1. Create a person via API
# 2. Search for them by name
# 3. Search semantically by related terms
# 4. Create relationship to another person
# 5. Query relationships
```

---

## Notes for Agents

### Code Style
- Follow existing patterns in `src/services/chat/`
- Use Zod for input validation
- Include JSDoc comments on public methods
- Use barrel exports (`index.ts`)

### Error Handling
- Throw typed errors that API routes can catch
- Include helpful error messages
- Log errors with context

### Audit Logging
- All mutations should call audit service
- Include `entitySnapshot` for create/update
- Include `reasoning` when applicable

### Database Queries
- Use Prisma's type-safe queries
- For vector ops, use `$queryRaw` with parameterized queries
- Always filter by `userId` for ownership
- Apply `excludeDeleted()` filter by default

---

## Questions to Resolve

1. **Embedding Model Choice**: `text-embedding-3-small` (cheaper, 1536 dims) vs `text-embedding-3-large` (better, 3072 dims)?
   - **Recommendation**: Start with `text-embedding-3-small` for cost

2. **Background Processing**: Queue embedding generation or inline?
   - **Recommendation**: Inline for MVP, add queue in Phase 6

3. **Search Ranking**: How to blend text match vs semantic similarity?
   - **Recommendation**: Simple approach first - try semantic, fall back to text

---

## Success Criteria

Phase 2 is complete when:

- [ ] All 5 entity types have full CRUD services
- [ ] Relationship service works bidirectionally
- [ ] All API endpoints implemented and tested
- [ ] Semantic search returns relevant results
- [ ] Embeddings auto-generated on entity create/update
- [ ] All audit logging in place
- [ ] Tests pass, build succeeds
- [ ] No TypeScript or lint errors

