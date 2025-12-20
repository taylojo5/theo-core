# API Reference

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [AUTH_SECURITY.md](./AUTH_SECURITY.md), [RATE_LIMITING.md](./RATE_LIMITING.md)

---

## Overview

Theo exposes a REST API built with Next.js App Router. All endpoints (except public routes) require authentication via NextAuth.js session.

**Base URL**: `/api`

---

## Common Patterns

### Authentication

All protected endpoints require a valid session:

```bash
# Session cookie is automatically included by the browser
# For API clients, include the session token in headers
```

### Response Format

**Success Response:**

```json
{
  "id": "...",
  "field": "value",
  ...
}
```

**Paginated Response:**

```json
{
  "items": [...],
  "nextCursor": "cursor-string",
  "hasMore": true
}
```

**Error Response:**

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "issues": [...]  // For validation errors
  }
}
```

### HTTP Status Codes

| Status | Meaning                        |
| ------ | ------------------------------ |
| 200    | Success                        |
| 201    | Created                        |
| 400    | Bad Request / Validation Error |
| 401    | Unauthorized                   |
| 403    | Forbidden                      |
| 404    | Not Found                      |
| 409    | Conflict (e.g., duplicate)     |
| 429    | Rate Limited                   |
| 500    | Server Error                   |
| 503    | Service Unavailable            |

### Rate Limiting

See [RATE_LIMITING.md](./RATE_LIMITING.md) for details.

Response headers include:

- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset timestamp
- `Retry-After`: Seconds until retry (when rate limited)

---

## Health Check

### `GET /api/health`

System health check for monitoring and load balancers.

**Authentication**: None required

**Response:**

```json
{
  "status": "healthy",
  "checks": {
    "database": true,
    "redis": true
  },
  "timestamp": "2024-12-20T10:00:00.000Z",
  "version": "0.1.0",
  "environment": "development"
}
```

**Status Values:**

- `healthy` - All systems operational
- `degraded` - Database up, Redis down (memory fallback active)
- `unhealthy` - Database unavailable

---

## Authentication

### `GET /api/auth/[...nextauth]`

NextAuth.js authentication handlers.

| Endpoint                    | Purpose             |
| --------------------------- | ------------------- |
| `/api/auth/signin`          | Sign in page        |
| `/api/auth/signout`         | Sign out            |
| `/api/auth/callback/google` | OAuth callback      |
| `/api/auth/session`         | Get current session |
| `/api/auth/csrf`            | Get CSRF token      |

### `GET /api/auth/token-status`

Check OAuth token health.

**Authentication**: Required

**Response:**

```json
{
  "hasAccount": true,
  "hasRefreshToken": true,
  "hasAccessToken": true,
  "isExpired": false,
  "expiresIn": 3400,
  "expiresInHuman": "56m",
  "recommendations": []
}
```

### `POST /api/auth/token-status`

Force OAuth token refresh.

**Authentication**: Required

**Response:**

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "hasAccount": true,
  "hasRefreshToken": true,
  ...
}
```

---

## Chat

### Conversations

#### `POST /api/chat/conversations`

Create a new conversation.

**Authentication**: Required

**Request Body:**

```json
{
  "title": "Optional title"
}
```

**Response (201):**

```json
{
  "id": "conversation-id",
  "userId": "user-id",
  "title": "Optional title",
  "summary": null,
  "createdAt": "2024-12-20T10:00:00.000Z",
  "updatedAt": "2024-12-20T10:00:00.000Z"
}
```

#### `GET /api/chat/conversations`

List user's conversations.

**Authentication**: Required

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 20 | Max results (1-100) |
| `cursor` | string | - | Pagination cursor |
| `includeMessages` | boolean | false | Include message preview |
| `messageLimit` | number | 1 | Messages per conversation |

**Response:**

```json
{
  "conversations": [
    {
      "id": "...",
      "title": "...",
      "messages": [...]  // If includeMessages=true
    }
  ],
  "nextCursor": "...",
  "hasMore": true
}
```

#### `GET /api/chat/conversations/[id]`

Get a specific conversation.

**Authentication**: Required

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `includeMessages` | boolean | false | Include all messages |
| `messageLimit` | number | - | Limit messages |

**Response:**

```json
{
  "id": "...",
  "userId": "...",
  "title": "...",
  "summary": "...",
  "messages": [...],
  "createdAt": "...",
  "updatedAt": "..."
}
```

#### `PATCH /api/chat/conversations/[id]`

Update a conversation.

**Request Body:**

```json
{
  "title": "New title",
  "summary": "Updated summary"
}
```

#### `DELETE /api/chat/conversations/[id]`

Delete a conversation (and all its messages).

**Response:**

```json
{
  "success": true
}
```

### Messages

#### `POST /api/chat/conversations/[id]/messages`

Add a message to a conversation.

**Request Body:**

```json
{
  "role": "user",
  "content": "Hello, Theo!"
}
```

**Response (201):**

```json
{
  "id": "message-id",
  "conversationId": "...",
  "role": "user",
  "content": "Hello, Theo!",
  "createdAt": "..."
}
```

#### `GET /api/chat/conversations/[id]/messages`

Get messages for a conversation.

**Query Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | number | 50 | Max messages |
| `before` | string | - | Get messages before this ID |
| `after` | string | - | Get messages after this ID |

### Streaming

#### `GET /api/chat/conversations/[id]/stream`

Server-Sent Events stream for real-time updates.

**Authentication**: Required

**Response**: `text/event-stream`

**Events:**

```
event: message
data: {"id": "...", "role": "assistant", "content": "Hello!"}

event: typing
data: {"isTyping": true}

event: done
data: {"conversationId": "..."}
```

---

## Context Entities

All context endpoints follow the same patterns for CRUD operations.

### People

#### `POST /api/context/people`

Create a new person.

**Request Body:**

```json
{
  "name": "Sarah Chen",
  "email": "sarah@acme.com",
  "phone": "+1-555-0123",
  "type": "colleague",
  "importance": 8,
  "company": "Acme Corp",
  "title": "Product Manager",
  "location": "San Francisco, CA",
  "timezone": "America/Los_Angeles",
  "bio": "Product leader with 10 years experience",
  "notes": "Met at Q3 planning offsite",
  "source": "manual",
  "sourceId": null,
  "tags": ["work", "product"]
}
```

**Required fields:** `name`, `source`

**Response (201):** Full person object

#### `GET /api/context/people`

List people with optional filters.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `limit` | number | Max results (default: 20, max: 100) |
| `cursor` | string | Pagination cursor |
| `type` | string | Filter by type (colleague, friend, etc.) |
| `source` | string | Filter by source (manual, gmail, etc.) |
| `search` | string | Full-text search |
| `tags` | string | Comma-separated tags |
| `includeDeleted` | boolean | Include soft-deleted |

**Response:**

```json
{
  "items": [...],
  "nextCursor": "...",
  "hasMore": true
}
```

#### `GET /api/context/people/[id]`

Get a specific person.

#### `PATCH /api/context/people/[id]`

Update a person.

#### `DELETE /api/context/people/[id]`

Soft delete a person.

### Places

#### `POST /api/context/places`

**Request Body:**

```json
{
  "name": "Acme HQ",
  "type": "office",
  "address": "123 Tech Street",
  "city": "San Francisco",
  "state": "CA",
  "country": "USA",
  "postalCode": "94105",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "timezone": "America/Los_Angeles",
  "source": "manual",
  "tags": ["work"]
}
```

#### `GET /api/context/places`

**Query Parameters:** Same as people, plus:
| Param | Type | Description |
|-------|------|-------------|
| `city` | string | Filter by city |
| `country` | string | Filter by country |

### Events

#### `POST /api/context/events`

**Request Body:**

```json
{
  "title": "Product Review",
  "description": "Quarterly review meeting",
  "type": "meeting",
  "startsAt": "2024-12-20T10:00:00Z",
  "endsAt": "2024-12-20T11:00:00Z",
  "allDay": false,
  "timezone": "America/Los_Angeles",
  "location": "Conference Room A",
  "placeId": "place-id",
  "virtualUrl": "https://meet.google.com/...",
  "status": "confirmed",
  "visibility": "private",
  "importance": 7,
  "source": "manual",
  "tags": ["product", "quarterly"]
}
```

#### `GET /api/context/events`

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `type` | string | Event type |
| `status` | string | tentative, confirmed, cancelled |
| `startsAfter` | ISO date | Filter by start date |
| `startsBefore` | ISO date | Filter by start date |
| `placeId` | string | Filter by place |

### Tasks

#### `POST /api/context/tasks`

**Request Body:**

```json
{
  "title": "Review roadmap",
  "description": "Go through Q4 roadmap",
  "parentId": null,
  "status": "pending",
  "priority": "high",
  "dueDate": "2024-12-25T17:00:00Z",
  "startDate": null,
  "estimatedMinutes": 120,
  "assignedToId": "person-id",
  "source": "manual",
  "tags": ["planning"]
}
```

#### `GET /api/context/tasks`

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `status` | string | pending, in_progress, completed, cancelled, deferred |
| `priority` | string | low, medium, high, urgent |
| `parentId` | string | Filter by parent (null for top-level) |
| `assignedToId` | string | Filter by assigned person |
| `dueBefore` | ISO date | Tasks due before date |
| `dueAfter` | ISO date | Tasks due after date |

### Deadlines

#### `POST /api/context/deadlines`

**Request Body:**

```json
{
  "title": "Submit Q4 report",
  "description": "Final quarterly report",
  "type": "deadline",
  "dueAt": "2024-12-31T17:00:00Z",
  "reminderAt": "2024-12-30T09:00:00Z",
  "importance": 9,
  "taskId": "task-id",
  "eventId": null,
  "consequences": "Delay in quarterly review",
  "source": "manual",
  "tags": ["reporting"]
}
```

#### `GET /api/context/deadlines`

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `type` | string | deadline, milestone, reminder |
| `status` | string | pending, completed, missed, extended |
| `dueBefore` | ISO date | Due before date |
| `dueAfter` | ISO date | Due after date |
| `taskId` | string | Filter by task |
| `eventId` | string | Filter by event |
| `minImportance` | number | Minimum importance (1-10) |

### Relationships

#### `POST /api/context/relationships`

**Request Body:**

```json
{
  "sourceType": "person",
  "sourceId": "person-1-id",
  "targetType": "person",
  "targetId": "person-2-id",
  "relationship": "works_with",
  "strength": 8,
  "bidirectional": true,
  "notes": "Same product team"
}
```

#### `GET /api/context/relationships`

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `sourceType` | string | Source entity type |
| `sourceId` | string | Source entity ID |
| `targetType` | string | Target entity type |
| `targetId` | string | Target entity ID |
| `relationship` | string | Relationship type |

### Context Search

#### `GET /api/context/search`

Unified search across all context entities.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Search query (required) |
| `types` | string | Comma-separated entity types |
| `limit` | number | Max results (default: 20) |
| `useSemanticSearch` | boolean | Include semantic search |
| `minSimilarity` | number | Min similarity score (0-1) |

**Response:**

```json
{
  "results": [
    {
      "entityType": "person",
      "entityId": "...",
      "entity": { ... },
      "score": 0.85,
      "matchType": "semantic",
      "snippet": "...matching text..."
    }
  ]
}
```

---

## Admin

### `GET /api/admin/queues`

Get queue statistics.

**Authentication**: Required (admin role recommended)

**Response:**

```json
{
  "queues": {
    "embeddings": {
      "waiting": 5,
      "active": 2,
      "completed": 150,
      "failed": 3,
      "delayed": 1
    },
    "email-sync": { ... },
    "notifications": { ... }
  }
}
```

---

## Error Codes

### Validation Errors

| Code               | Description                    |
| ------------------ | ------------------------------ |
| `VALIDATION_ERROR` | Request data failed validation |
| `INVALID_JSON`     | Request body is not valid JSON |

### Authentication Errors

| Code           | Description                    |
| -------------- | ------------------------------ |
| `UNAUTHORIZED` | No valid session               |
| `FORBIDDEN`    | Not allowed to access resource |

### Resource Errors

| Code              | Description                   |
| ----------------- | ----------------------------- |
| `NOT_FOUND`       | Resource does not exist       |
| `DUPLICATE_EMAIL` | Email already exists (People) |
| `INVALID_EMAIL`   | Email format invalid          |
| `ALREADY_DELETED` | Entity already soft-deleted   |

### Rate Limiting

| Code                  | Description       |
| --------------------- | ----------------- |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

---

## Validation Schemas

Request bodies are validated using Zod schemas. Invalid requests return:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "issues": [
      {
        "path": "email",
        "message": "Invalid email format",
        "code": "invalid_string"
      }
    ]
  }
}
```

---

## SDKs & Client Libraries

### Fetch Example

```typescript
async function createPerson(data: CreatePersonInput) {
  const response = await fetch("/api/context/people", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
    credentials: "include", // Include session cookie
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || "Request failed");
  }

  return response.json();
}
```

### With React Query

```typescript
import { useMutation, useQuery } from "@tanstack/react-query";

function usePeople(options = {}) {
  return useQuery({
    queryKey: ["people", options],
    queryFn: () =>
      fetch(`/api/context/people?${new URLSearchParams(options)}`).then((r) =>
        r.json()
      ),
  });
}

function useCreatePerson() {
  return useMutation({
    mutationFn: (data) =>
      fetch("/api/context/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
  });
}
```

---

## Related Documentation

- [AUTH_SECURITY.md](./AUTH_SECURITY.md) - Authentication details
- [RATE_LIMITING.md](./RATE_LIMITING.md) - Rate limit configuration
- [VALIDATION_ERRORS.md](./VALIDATION_ERRORS.md) - Validation schemas
- [services/CONTEXT_SERVICES.md](./services/CONTEXT_SERVICES.md) - Service layer
- [services/CHAT_SERVICES.md](./services/CHAT_SERVICES.md) - Chat services
