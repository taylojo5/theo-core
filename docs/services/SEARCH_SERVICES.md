# Search Services Documentation

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [AI_EMBEDDINGS.md](../AI_EMBEDDINGS.md), [CONTEXT_SERVICES.md](./CONTEXT_SERVICES.md), [GMAIL_SERVICE.md](./GMAIL_SERVICE.md)

---

## Overview

Theo provides unified search across all context entities and emails using a combination of **text matching** and **semantic (vector) search**. Results are intelligently merged and ranked to provide the most relevant matches.

This document covers:

- **Context Search** - Search across People, Places, Events, Tasks, Deadlines, Routines, Open Loops, Projects, Notes
- **Email Search** - Semantic and text search across synced emails

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SEARCH PIPELINE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Query: "meetings about product"                                │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              CONTEXT SEARCH SERVICE                      │    │
│  │                                                          │    │
│  │  ┌──────────────────┐    ┌──────────────────┐          │    │
│  │  │   TEXT SEARCH    │    │  SEMANTIC SEARCH │          │    │
│  │  │                  │    │                  │          │    │
│  │  │ • Case-insensitive│   │ • Embed query    │          │    │
│  │  │ • Pattern match  │    │ • Vector search  │          │    │
│  │  │ • Tag matching   │    │ • Cosine similar │          │    │
│  │  └──────────────────┘    └──────────────────┘          │    │
│  │           │                       │                     │    │
│  │           └───────────┬───────────┘                     │    │
│  │                       ▼                                  │    │
│  │              ┌─────────────────┐                        │    │
│  │              │  MERGE & RANK   │                        │    │
│  │              │  (weighted)     │                        │    │
│  │              └─────────────────┘                        │    │
│  │                       │                                  │    │
│  │                       ▼                                  │    │
│  │              ┌─────────────────┐                        │    │
│  │              │    RESULTS      │                        │    │
│  │              │ (deduplicated)  │                        │    │
│  │              └─────────────────┘                        │    │
│  │                                                          │    │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Start

```typescript
import {
  searchContext,
  textSearchContext,
  semanticSearchContext,
} from "@/services/context";

// Unified search (text + semantic)
const results = await searchContext(userId, "product roadmap", {
  entityTypes: ["person", "task", "event"],
  limit: 20,
  useSemanticSearch: true,
});

// Text-only search
const textResults = await textSearchContext(userId, "sarah", {
  entityTypes: ["person"],
  limit: 10,
});

// Semantic-only search
const semanticResults = await semanticSearchContext(
  userId,
  "quarterly planning meetings",
  {
    minSimilarity: 0.6,
    limit: 10,
  }
);
```

---

## Search Types

### 1. Unified Search (Recommended)

Combines text and semantic search with intelligent ranking:

```typescript
const results = await searchContext(userId, query, {
  entityTypes: ["person", "place", "event", "task", "deadline", "routine", "open_loop", "project", "note"],
  limit: 20,
  useSemanticSearch: true,
  minSimilarity: 0.5,
  semanticWeight: 0.7, // 70% weight to semantic results
  includeSnippets: true,
});
```

**Options:**

| Option              | Type         | Default   | Description                    |
| ------------------- | ------------ | --------- | ------------------------------ |
| `entityTypes`       | EntityType[] | All types | Entity types to search         |
| `limit`             | number       | 20        | Max results (max: 100)         |
| `useSemanticSearch` | boolean      | true      | Include semantic search        |
| `minSimilarity`     | number       | 0.5       | Min similarity threshold (0-1) |
| `semanticWeight`    | number       | 0.7       | Weight for semantic scores     |
| `includeSnippets`   | boolean      | true      | Include content snippets       |

### 2. Text Search

Pattern-based text matching:

```typescript
const results = await textSearchContext(userId, query, {
  entityTypes: ["person"],
  limit: 20,
});
```

**Searched Fields by Entity:**

| Entity    | Fields                                                  |
| --------- | ------------------------------------------------------- |
| Person    | name, email, company, title, bio, notes, tags           |
| Place     | name, address, city, country, notes, tags               |
| Event     | title, description, location, notes, tags               |
| Task      | title, description, notes, tags                         |
| Deadline  | title, description, notes, consequences, tags           |
| Routine   | name, description, notes, tags                          |
| Open Loop | title, description, notes, tags                         |
| Project   | name, description, notes, tags                          |
| Note      | title, content, tags                                    |

### 3. Semantic Search

Vector-based similarity search:

```typescript
const results = await semanticSearchContext(userId, query, {
  entityTypes: ["task", "event"],
  limit: 20,
  minSimilarity: 0.6,
});
```

**How it works:**

1. Query is embedded using OpenAI
2. Vector similarity search with pgvector
3. Results ranked by cosine similarity

---

## Search Results

### Result Structure

```typescript
interface ContextSearchResult {
  entityType: EntityType; // "person", "place", etc.
  entityId: string; // Entity ID
  entity: Entity; // Full entity object
  score: number; // Relevance score (0-1)
  matchType: "text" | "semantic" | "both";
  snippet?: string; // Matching content snippet
}
```

### Match Types

| Type       | Description                    |
| ---------- | ------------------------------ |
| `text`     | Found only by text search      |
| `semantic` | Found only by semantic search  |
| `both`     | Found by both (highest scores) |

### Example Result

```json
{
  "entityType": "person",
  "entityId": "person-123",
  "entity": {
    "id": "person-123",
    "name": "Sarah Chen",
    "email": "sarah@acme.com",
    "company": "Acme Corp",
    ...
  },
  "score": 0.85,
  "matchType": "both",
  "snippet": "...Product Manager at Acme Corp..."
}
```

---

## Scoring & Ranking

### Text Search Scoring

Text matches are scored based on:

1. **Position** in results (earlier = higher)
2. **Match quality**:
   - Exact title match: +0.3
   - Title starts with query: +0.2
   - Title contains query: +0.1

### Semantic Search Scoring

Semantic scores are the cosine similarity (0-1) from pgvector.

### Merged Ranking

When combining text and semantic results:

```
final_score = (text_score × text_weight) + (semantic_score × semantic_weight)
```

Where `semantic_weight` defaults to 0.7 (70% weight on semantic).

### Deduplication

If an entity is found by both search types:

- Scores are combined
- Match type is set to `"both"`
- Entity appears once in results

---

## Service Interface

```typescript
interface IContextSearchService {
  // Unified search
  search(
    userId: string,
    query: string,
    options?: UnifiedSearchOptions
  ): Promise<ContextSearchResult[]>;

  // Text-only search
  textSearch(
    userId: string,
    query: string,
    options?: ContextSearchOptions
  ): Promise<ContextSearchResult[]>;

  // Semantic-only search
  semanticSearch(
    userId: string,
    query: string,
    options?: ContextSearchOptions & { minSimilarity?: number }
  ): Promise<ContextSearchResult[]>;
}
```

### Getting the Service

```typescript
import {
  getContextSearchService,
  createContextSearchService,
} from "@/services/context";

// Get singleton instance
const service = getContextSearchService();

// Or create new instance
const customService = createContextSearchService();
```

---

## API Endpoint

### `GET /api/context/search`

```
GET /api/context/search?q=product+roadmap&types=person,event&limit=20
```

**Query Parameters:**

| Param               | Type    | Required | Description                  |
| ------------------- | ------- | -------- | ---------------------------- |
| `q`                 | string  | Yes      | Search query                 |
| `types`             | string  | No       | Comma-separated entity types |
| `limit`             | number  | No       | Max results (default: 20)    |
| `useSemanticSearch` | boolean | No       | Include semantic search      |
| `minSimilarity`     | number  | No       | Min similarity (0-1)         |

**Response:**

```json
{
  "results": [
    {
      "entityType": "person",
      "entityId": "...",
      "entity": { ... },
      "score": 0.85,
      "matchType": "both",
      "snippet": "..."
    }
  ]
}
```

---

## Performance Considerations

### Optimizations

1. **Parallel Searches**: Text and semantic run concurrently
2. **Per-Type Limits**: Internal limits prevent over-fetching
3. **Early Termination**: Stops when limit reached
4. **Fallback**: Semantic search gracefully degrades if unavailable

### Limits

| Parameter      | Value |
| -------------- | ----- |
| Max limit      | 100   |
| Default limit  | 20    |
| Min similarity | 0     |
| Max similarity | 1     |

### When to Use Each Type

| Scenario                 | Recommended     |
| ------------------------ | --------------- |
| Quick lookups by name    | Text search     |
| Finding related concepts | Semantic search |
| General search           | Unified (both)  |
| No embeddings available  | Text search     |

---

## Error Handling

### Semantic Search Fallback

If semantic search fails (e.g., no OpenAI API key):

```typescript
try {
  const results = await semanticService.searchSimilar(...);
} catch (error) {
  console.warn("Semantic search failed, returning empty results:", error);
  return [];
}
```

The unified search will still return text-based results.

### Empty Results

```typescript
const results = await searchContext(userId, "nonexistent query");
// results = []
```

---

## Examples

### Find Related People

```typescript
// Find people related to a project
const people = await searchContext(userId, "mobile app project", {
  entityTypes: ["person"],
  limit: 10,
  useSemanticSearch: true,
});
```

### Find Upcoming Events

```typescript
// Find events about a topic
const events = await searchContext(userId, "quarterly review", {
  entityTypes: ["event"],
  useSemanticSearch: true,
  minSimilarity: 0.6,
});
```

### Quick Person Lookup

```typescript
// Fast text search for name
const person = await textSearchContext(userId, "sarah chen", {
  entityTypes: ["person"],
  limit: 1,
});
```

### Find All Mentions

```typescript
// Find everything related to a topic
const all = await searchContext(userId, "product launch", {
  // All entity types
  useSemanticSearch: true,
  limit: 50,
  includeSnippets: true,
});

// Group by type
const byType = all.reduce((acc, result) => {
  acc[result.entityType] = acc[result.entityType] || [];
  acc[result.entityType].push(result);
  return acc;
}, {});
```

---

## Testing

### Mocking the Search Service

```typescript
import { vi } from "vitest";
import * as contextSearch from "@/services/context/context-search";

vi.mock("@/services/context/context-search", () => ({
  searchContext: vi.fn().mockResolvedValue([
    {
      entityType: "person",
      entityId: "test-id",
      entity: { name: "Test Person" },
      score: 0.9,
      matchType: "text",
    },
  ]),
}));
```

### Integration Tests

```typescript
describe("Context Search", () => {
  it("should find people by name", async () => {
    // Create test person
    const person = await createPerson(testUserId, {
      name: "Searchable Person",
      source: "manual",
    });

    // Search
    const results = await searchContext(testUserId, "Searchable", {
      entityTypes: ["person"],
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].entity.name).toBe("Searchable Person");
  });

  it("should combine text and semantic results", async () => {
    const results = await searchContext(testUserId, "product manager", {
      useSemanticSearch: true,
    });

    const hasTextMatches = results.some((r) => r.matchType === "text");
    const hasSemanticMatches = results.some((r) => r.matchType === "semantic");

    // Should have both types (if embeddings exist)
    expect(hasTextMatches || hasSemanticMatches).toBe(true);
  });
});
```

---

## Email Search Service

Email search provides semantic and text-based search across synced Gmail emails.

### Quick Start

```typescript
import {
  searchEmails,
  semanticSearchEmails,
  findSimilarEmails,
} from "@/services/search";

// Combined text + semantic search
const results = await searchEmails(userId, "quarterly report", {
  limit: 20,
  useSemanticSearch: true,
  minSimilarity: 0.5,
});

// Find emails similar to a specific email
const similar = await findSimilarEmails(userId, emailId, {
  limit: 10,
  minSimilarity: 0.6,
});
```

### Email Search Options

```typescript
interface EmailSearchOptions {
  limit?: number; // Max results (default: 20)
  minSimilarity?: number; // Min similarity (0-1, default: 0.5)
  useSemanticSearch?: boolean; // Enable semantic search (default: true)
  semanticWeight?: number; // Semantic weight in ranking (default: 0.7)

  // Filters
  labelIds?: string[]; // Filter by Gmail labels
  startDate?: Date; // Filter by date range start
  endDate?: Date; // Filter by date range end
  fromEmail?: string; // Filter by sender
  isRead?: boolean; // Filter by read status
  isStarred?: boolean; // Filter by starred status
  hasAttachments?: boolean; // Filter by attachments
}
```

### Email Search Result

```typescript
interface EmailSearchResult {
  email: Email; // Full email record
  score: number; // Relevance score (0-1)
  matchType: "text" | "semantic" | "both"; // How match was found
  snippet?: string; // Matched content snippet
}
```

### API Endpoint

#### `GET /api/search/emails`

Search emails:

```
GET /api/search/emails?q=budget+meeting&limit=20&isRead=false
```

**Query Parameters:**

| Param               | Type    | Required | Description               |
| ------------------- | ------- | -------- | ------------------------- |
| `q`                 | string  | Yes      | Search query              |
| `limit`             | number  | No       | Max results (default: 20) |
| `useSemanticSearch` | boolean | No       | Enable semantic search    |
| `minSimilarity`     | number  | No       | Min similarity (0-1)      |
| `semanticWeight`    | number  | No       | Semantic weight (0-1)     |
| `labelIds`          | string  | No       | Comma-separated labels    |
| `startDate`         | string  | No       | ISO date                  |
| `endDate`           | string  | No       | ISO date                  |
| `fromEmail`         | string  | No       | Sender email filter       |
| `isRead`            | boolean | No       | Filter by read status     |
| `isStarred`         | boolean | No       | Filter by starred         |
| `hasAttachments`    | boolean | No       | Filter by attachments     |

Find similar emails:

```
GET /api/search/emails?similarTo=email-id-123&limit=10
```

**Response:**

```json
{
  "query": "budget meeting",
  "totalResults": 15,
  "usedSemanticSearch": true,
  "results": [
    {
      "email": {
        "id": "email-123",
        "subject": "Q4 Budget Meeting Notes",
        "fromEmail": "cfo@company.com",
        "snippet": "..."
      },
      "score": 0.89,
      "matchType": "both",
      "snippet": "...discussed the Q4 budget allocations..."
    }
  ]
}
```

### Email Embedding Generation

Emails are automatically embedded when synced:

```typescript
import {
  generateEmailEmbedding,
  generateEmailEmbeddings,
  deleteEmailEmbedding,
} from "@/integrations/gmail";

// Generate embedding for a single email
const result = await generateEmailEmbedding(email);

// Bulk generate embeddings
const bulkResult = await generateEmailEmbeddings(emails);

// Delete embedding when email is removed
await deleteEmailEmbedding(userId, emailId);
```

### Email Content for Embeddings

The embedding content includes:

- Subject line
- Sender name and email
- Recipients
- Email snippet
- Body text (truncated to 2000 chars)
- Meaningful labels (excluding INBOX, UNREAD, etc.)

### Background Processing

Email embeddings are queued as background jobs during sync:

1. **Full Sync**: Batches of 20 emails queued with low priority
2. **Incremental Sync**: Smaller batches of 10 with higher priority
3. **Delete**: Embeddings cleaned up when emails are deleted

```typescript
// Job types for email embeddings
type EmailEmbeddingJobData = {
  userId: string;
  emailId: string;
  operation: "create" | "update" | "delete";
};

type BulkEmailEmbedJobData = {
  userId: string;
  emailIds: string[];
};
```

---

## Related Documentation

- [AI_EMBEDDINGS.md](../AI_EMBEDDINGS.md) - Vector embeddings & semantic search
- [CONTEXT_SERVICES.md](./CONTEXT_SERVICES.md) - Entity services
- [GMAIL_SERVICE.md](./GMAIL_SERVICE.md) - Gmail integration
- [API_REFERENCE.md](../API_REFERENCE.md) - Search API endpoint
- [DATA_LAYER.md](../DATA_LAYER.md) - Database indexing
