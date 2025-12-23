# AI & Embeddings Documentation

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [DATA_LAYER.md](./DATA_LAYER.md), [services/SEARCH_SERVICES.md](./services/SEARCH_SERVICES.md)

---

## Overview

Theo uses **vector embeddings** for semantic search and context retrieval. The system generates embeddings using **OpenAI's text-embedding-3-small** model and stores them in **PostgreSQL with pgvector** for efficient similarity search.

---

## Technology Stack

| Component       | Technology                    | Purpose                 |
| --------------- | ----------------------------- | ----------------------- |
| Embedding Model | OpenAI text-embedding-3-small | Vector generation       |
| Vector Database | PostgreSQL + pgvector         | Vector storage & search |
| Dimensions      | 1536                          | Vector size             |
| Distance Metric | Cosine similarity             | Similarity calculation  |

---

## Quick Start

### Environment Configuration

```env
# .env.local
OPENAI_API_KEY="sk-your-openai-api-key"
```

### Basic Usage

```typescript
import {
  generateEmbedding,
  storeEmbedding,
  searchSimilar,
} from "@/lib/embeddings";

// Generate embedding for text
const embedding = await generateEmbedding("Hello, world!");

// Store embedding for an entity
await storeEmbedding({
  userId: "user-123",
  entityType: "person",
  entityId: "person-456",
  content: "John Smith is a software engineer at Acme Corp.",
});

// Search for similar content
const results = await searchSimilar({
  userId: "user-123",
  query: "Who works at Acme?",
  limit: 5,
});
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMBEDDING PIPELINE                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────────┐ │
│  │  Entity  │───▶│   Content    │───▶│  Embedding Service    │ │
│  │  CRUD    │    │   Builder    │    │  (OpenAI API)         │ │
│  └──────────┘    └──────────────┘    └───────────────────────┘ │
│                                                │                 │
│                                                ▼                 │
│                                       ┌───────────────────────┐ │
│                                       │    Content Chunker    │ │
│                                       │  (for long content)   │ │
│                                       └───────────────────────┘ │
│                                                │                 │
│                                                ▼                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   PostgreSQL + pgvector                  │   │
│  │  ┌─────────────────────────────────────────────────┐    │   │
│  │  │ Embedding Table (1536-dim vectors)               │    │   │
│  │  │ - userId, entityType, entityId, chunkIndex       │    │   │
│  │  │ - content, contentHash, embedding, metadata      │    │   │
│  │  └─────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  SEMANTIC SEARCH                                                 │
│  ┌────────────┐    ┌──────────────┐    ┌───────────────────┐   │
│  │   Query    │───▶│   Generate   │───▶│  Vector Search    │   │
│  │   Text     │    │  Embedding   │    │  (pgvector <=>)   │   │
│  └────────────┘    └──────────────┘    └───────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Embedding Models

### Supported Models

| Model                    | Dimensions | Quality | Cost   | Notes                      |
| ------------------------ | ---------- | ------- | ------ | -------------------------- |
| `text-embedding-3-small` | 1536       | Good    | Low    | **Default** - Best balance |
| `text-embedding-3-large` | 3072       | Best    | Higher | When quality matters most  |
| `text-embedding-ada-002` | 1536       | Good    | Low    | Legacy model               |

### Configuration

```typescript
import { createOpenAIProvider } from "@/lib/embeddings";

// Custom model configuration
const provider = createOpenAIProvider({
  model: "text-embedding-3-large", // Override default
  apiKey: process.env.OPENAI_API_KEY,
});
```

---

## Embedding Service

### Service Interface

```typescript
interface IEmbeddingService {
  // Generate embedding for text
  generateEmbedding(
    text: string,
    options?: GenerateEmbeddingOptions
  ): Promise<number[]>;

  // Generate embeddings for multiple texts (batched)
  generateEmbeddings(
    texts: string[],
    options?: GenerateEmbeddingOptions
  ): Promise<number[][]>;

  // Store embedding for an entity
  storeEmbedding(input: StoreEmbeddingInput): Promise<StoredEmbedding>;

  // Update embedding when entity changes
  updateEmbedding(
    userId: string,
    entityType: string,
    entityId: string,
    content: string
  ): Promise<void>;

  // Delete embeddings for an entity
  deleteEmbeddings(
    userId: string,
    entityType: string,
    entityId: string
  ): Promise<void>;

  // Chunk long content for embedding
  chunkContent(content: string, options?: ChunkingOptions): string[];

  // Check if content needs re-embedding
  needsReembedding(
    userId: string,
    entityType: string,
    entityId: string,
    content: string
  ): Promise<boolean>;
}
```

### Generating Embeddings

```typescript
import { generateEmbedding, getEmbeddingService } from "@/lib/embeddings";

// Convenience function
const embedding = await generateEmbedding("Your text here");
// Returns: number[] (1536 floats)

// Or use the service directly
const service = getEmbeddingService();
const embedding = await service.generateEmbedding("Your text here", {
  model: "text-embedding-3-small",
  user: "user-123", // For OpenAI abuse monitoring
});
```

### Batch Embedding

For efficiency when embedding multiple texts:

```typescript
const texts = ["First document", "Second document", "Third document"];

const embeddings = await service.generateEmbeddings(texts);
// Returns: number[][] (array of 1536-float arrays)
```

**Batch Limits:**

- OpenAI supports up to 2048 texts per batch
- Service automatically batches larger requests

---

## Content Chunking

Long content is automatically split into chunks for embedding.

### Chunking Options

```typescript
interface ChunkingOptions {
  maxTokens?: number; // Default: 8000
  overlapTokens?: number; // Default: 100
  separator?: "sentence" | "paragraph" | "word"; // Default: "sentence"
}
```

### How Chunking Works

```
┌─────────────────────────────────────────────────────────────┐
│                    LONG DOCUMENT                             │
│                   (50,000 chars)                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Content Chunker                           │
│                                                              │
│  1. Estimate tokens (~chars / 4)                            │
│  2. Split on sentence boundaries                             │
│  3. Build chunks up to maxTokens                            │
│  4. Add overlap between chunks                              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ Chunk 0  │  │ Chunk 1  │  │ Chunk 2  │  │ Chunk 3  │
│ 8000 tok │  │ 8000 tok │  │ 8000 tok │  │ 2000 tok │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
     │             │             │             │
     ▼             ▼             ▼             ▼
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│Embedding │  │Embedding │  │Embedding │  │Embedding │
│ index=0  │  │ index=1  │  │ index=2  │  │ index=3  │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

### Overlap

Chunks overlap by `overlapTokens` to preserve context across boundaries:

```
Chunk 1: [==================|overlap]
Chunk 2:              [overlap|==================|overlap]
Chunk 3:                            [overlap|==================]
```

---

## Storing Embeddings

### Store Embedding Input

```typescript
interface StoreEmbeddingInput {
  userId: string;
  entityType: string; // "person", "task", "event", etc.
  entityId: string;
  content: string; // Text content to embed
  chunkIndex?: number; // For multi-chunk content (default: 0)
  metadata?: Record<string, unknown>;
}
```

### Storage with Deduplication

Embeddings are deduplicated by content hash:

```typescript
await storeEmbedding({
  userId: "user-123",
  entityType: "person",
  entityId: "person-456",
  content: "John Smith is a software engineer.",
});

// If called again with same content, returns existing embedding
// (no API call, no storage write)
```

### Automatic Re-embedding Check

```typescript
const needsUpdate = await needsReembedding(
  userId,
  "person",
  "person-456",
  newContent
);

if (needsUpdate) {
  await service.updateEmbedding(userId, "person", "person-456", newContent);
}
```

---

## Semantic Search

### Search Service Interface

```typescript
interface SemanticSearchParams {
  userId: string; // Required: ownership filter
  query: string; // The search query
  entityTypes?: EntityType[]; // Filter by types (default: all)
  limit?: number; // Max results (default: 10, max: 100)
  minSimilarity?: number; // Threshold (default: 0.5, range: 0-1)
}

interface SemanticSearchResult {
  entityType: EntityType;
  entityId: string;
  content: string;
  chunkIndex: number;
  similarity: number; // 0-1, higher is more similar
  metadata: Record<string, unknown>;
}
```

### Basic Search

```typescript
import { searchSimilar } from "@/lib/embeddings";

const results = await searchSimilar({
  userId: "user-123",
  query: "meetings about product roadmap",
  limit: 10,
  minSimilarity: 0.6,
});

for (const result of results) {
  console.log(`${result.entityType}:${result.entityId} - ${result.similarity}`);
}
```

### Filter by Entity Type

```typescript
// Only search people and events
const results = await searchSimilar({
  userId: "user-123",
  query: "project manager at Acme",
  entityTypes: ["person", "event"],
});
```

### Find Similar Entities

Find entities similar to an existing entity:

```typescript
import { findSimilarToEntity } from "@/lib/embeddings";

const similar = await findSimilarToEntity({
  userId: "user-123",
  entityType: "person",
  entityId: "person-456", // Find entities similar to this person
  targetTypes: ["person", "event"],
  limit: 5,
  excludeSelf: true, // Don't include the source entity
});
```

---

## Vector Operations (pgvector)

### Distance Operators

pgvector provides several distance operators:

| Operator | Distance Metric | Usage                            |
| -------- | --------------- | -------------------------------- |
| `<->`    | L2 (Euclidean)  | General distance                 |
| `<=>`    | Cosine          | **Used by Theo** - Best for text |
| `<#>`    | Inner product   | Normalized vectors               |

### Similarity Calculation

Cosine distance to similarity conversion:

```sql
-- Cosine distance (0 = identical, 2 = opposite)
embedding <=> query_vector

-- Convert to similarity (0 = opposite, 1 = identical)
1 - (embedding <=> query_vector) AS similarity
```

### Raw SQL Query Example

```typescript
const vectorString = `[${embedding.join(",")}]`;

const results = await db.$queryRaw`
  SELECT 
    "entityType",
    "entityId",
    content,
    1 - (embedding <=> ${vectorString}::vector) as similarity
  FROM "Embedding"
  WHERE "userId" = ${userId}
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> ${vectorString}::vector) >= ${minSimilarity}
  ORDER BY embedding <=> ${vectorString}::vector ASC
  LIMIT ${limit}
`;
```

---

## Rate Limiting & Error Handling

### Rate Limit Configuration

```typescript
interface RateLimitConfig {
  requestsPerMinute: number; // Default: 3000
  tokensPerMinute: number; // Default: 1,000,000
  initialRetryDelay: number; // Default: 1000ms
  maxRetryDelay: number; // Default: 60000ms
  maxRetries: number; // Default: 5
}
```

### Automatic Retry

The OpenAI provider automatically retries on rate limits with exponential backoff:

```typescript
// Internally handles:
// - 429 rate limit responses
// - Exponential backoff
// - Retry-After header respect
// - Maximum retry attempts

const embedding = await generateEmbedding(text);
// Transparently retries if rate limited
```

### Error Types

```typescript
type EmbeddingErrorType =
  | "rate_limit" // OpenAI rate limit exceeded
  | "invalid_input" // Bad input data
  | "api_error" // OpenAI API error
  | "network_error" // Connection issues
  | "content_too_long" // Content exceeds limits
  | "empty_content"; // Empty input text

class EmbeddingError extends Error {
  type: EmbeddingErrorType;
  retryable: boolean;
  retryAfter?: number;
}
```

### Error Handling Example

```typescript
import { EmbeddingError } from "@/lib/embeddings";

try {
  await generateEmbedding(text);
} catch (error) {
  if (error instanceof EmbeddingError) {
    if (error.retryable) {
      // Can retry after error.retryAfter ms
    }
    switch (error.type) {
      case "rate_limit":
        // Wait and retry
        break;
      case "empty_content":
        // Skip this content
        break;
      case "api_error":
        // Log and alert
        break;
    }
  }
}
```

---

## Entity Lifecycle Integration

### Content Builders

Each entity type has a content builder for embedding:

```typescript
import {
  buildPersonContent,
  buildEventContent,
  buildTaskContent,
} from "@/services/context";

const personContent = buildPersonContent(person);
// "Sarah Chen. colleague. works at Acme Corp as Product Manager.
//  Met at the Q3 planning offsite. Very collaborative. work, product"
```

### Lifecycle Hooks

Automatically manage embeddings on entity changes:

```typescript
import {
  afterEntityCreate,
  afterEntityUpdate,
  afterEntityDelete,
} from "@/services/context";

// After creating a person
await afterEntityCreate(userId, "person", person);
// → Generates and stores embedding

// After updating
await afterEntityUpdate(userId, "person", person);
// → Updates embedding if content changed

// After deleting
await afterEntityDelete(userId, "person", personId);
// → Removes embedding
```

### Convenience Functions

```typescript
import { embedPerson, removePersonEmbedding } from "@/services/context";

// Embed a person
await embedPerson(userId, person);

// Remove embedding
await removePersonEmbedding(userId, personId);
```

---

## Background Processing

For high-volume embedding operations, use the queue:

```typescript
import { addJob, QUEUE_NAMES } from "@/lib/queue";

// Queue embedding job
await addJob(QUEUE_NAMES.EMBEDDINGS, "embed-entity", {
  userId: "user-123",
  entityType: "person",
  entityId: "person-456",
});
```

See [QUEUE_WORKERS.md](./QUEUE_WORKERS.md) for details.

---

## Performance Optimization

### Indexing

Create an IVFFlat index for faster similarity search:

```sql
CREATE INDEX idx_embeddings_vector ON "Embedding"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

**Index Tuning:**

- `lists`: Number of clusters (recommended: sqrt(n_rows))
- More lists = faster search, slightly lower recall

### Query Optimization

1. **Filter before vector search**: Use WHERE clauses to reduce candidates
2. **Limit results**: Always use LIMIT to avoid scanning all vectors
3. **Batch operations**: Use batch embedding for multiple texts

### Caching Considerations

- Content hash prevents redundant API calls
- Consider caching frequently-searched queries
- Embedding vectors are immutable (same input = same output)

---

## Testing

### Mocking the Embedding Service

```typescript
import { createEmbeddingService } from "@/lib/embeddings";

// Create mock provider
const mockProvider = {
  generateEmbedding: vi.fn().mockResolvedValue({
    embedding: new Array(1536).fill(0),
    model: "text-embedding-3-small",
    tokensUsed: 10,
  }),
  generateEmbeddings: vi.fn(),
  getModel: () => "text-embedding-3-small",
  getDimensions: () => 1536,
};

const service = createEmbeddingService(mockProvider);
```

### Testing Search

```typescript
describe("Semantic Search", () => {
  it("should find similar content", async () => {
    // Setup: Create embeddings for test entities
    await storeEmbedding({
      userId: testUserId,
      entityType: "person",
      entityId: "test-person",
      content: "John is a software engineer",
    });

    // Search
    const results = await searchSimilar({
      userId: testUserId,
      query: "software developer",
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].similarity).toBeGreaterThan(0.5);
  });
});
```

---

## Troubleshooting

### Common Issues

| Issue                     | Cause                  | Solution                             |
| ------------------------- | ---------------------- | ------------------------------------ |
| Empty results             | No embeddings for user | Check if entities have been embedded |
| Low similarity scores     | Content mismatch       | Improve content builders             |
| Rate limit errors         | Too many API calls     | Implement batching, use queue        |
| Vector dimension mismatch | Model change           | Re-embed all content with new model  |

### Debugging

```typescript
// Check if entity has embedding
const hasEmbed = await hasEmbedding(userId, "person", personId);

// Get embedding count
const count = await getSemanticSearchService().getEmbeddingCount(userId);

// Verify content hash
import { generateContentHash } from "@/services/context/utils";
const hash = generateContentHash(content);
```

---

## Related Documentation

- [DATA_LAYER.md](./DATA_LAYER.md) - Embedding table schema
- [QUEUE_WORKERS.md](./QUEUE_WORKERS.md) - Background embedding jobs
- [services/SEARCH_SERVICES.md](./services/SEARCH_SERVICES.md) - Context search integration
- [services/CONTEXT_SERVICES.md](./services/CONTEXT_SERVICES.md) - Entity lifecycle hooks
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [pgvector Documentation](https://github.com/pgvector/pgvector)
