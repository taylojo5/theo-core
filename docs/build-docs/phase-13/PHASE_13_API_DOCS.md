# Phase 13: API Documentation with Scalar

## Overview

Implement beautiful, interactive API documentation using [Scalar](https://scalar.com) with OpenAPI 3.1 specification. This provides a modern developer experience for internal use and future public API exposure.

## Goals

1. ✅ Auto-generate OpenAPI spec from existing Zod schemas where possible
2. ✅ Create comprehensive documentation for all 40+ API endpoints
3. ✅ Integrate Scalar into Next.js app for `/docs` route
4. ✅ Support authentication flows in try-it-out functionality
5. ✅ Maintain spec alongside code (not separate files that drift)

---

## Implementation Plan

### Task 1: Install Dependencies

```bash
npm install @scalar/nextjs-api-reference
npm install --save-dev zod-to-openapi
```

**Packages:**
- `@scalar/nextjs-api-reference` - Scalar's Next.js integration
- `zod-to-openapi` - Generate OpenAPI schemas from existing Zod validation schemas

---

### Task 2: Create OpenAPI Spec Structure

```
src/
├── openapi/
│   ├── index.ts              # Main spec generator & export
│   ├── components/
│   │   ├── schemas.ts        # Reusable response/request schemas
│   │   ├── parameters.ts     # Common query/path parameters
│   │   ├── responses.ts      # Standard error responses
│   │   └── security.ts       # Auth scheme definitions
│   └── paths/
│       ├── health.ts         # /api/health
│       ├── chat.ts           # /api/chat/*
│       ├── context.ts        # /api/context/*
│       ├── integrations.ts   # /api/integrations/*
│       ├── search.ts         # /api/search/*
│       └── admin.ts          # /api/admin/*
```

---

### Task 3: Generate Schemas from Zod

Leverage existing Zod schemas in `src/lib/validation/schemas.ts`:

```typescript
// src/openapi/components/schemas.ts
import { extendZodWithOpenApi } from 'zod-to-openapi';
import { z } from 'zod';
import {
  createPersonSchema,
  updatePersonSchema,
  listPeopleQuerySchema,
  // ... other schemas
} from '@/lib/validation';

extendZodWithOpenApi(z);

// Extend existing schemas with OpenAPI metadata
export const PersonCreateSchema = createPersonSchema.openapi('PersonCreate', {
  description: 'Create a new person in the context system',
  example: {
    name: 'John Smith',
    email: 'john@example.com',
    type: 'contact',
    importance: 7,
    company: 'Acme Corp',
    tags: ['work', 'important'],
  },
});
```

---

### Task 4: Define API Paths

Example path definition pattern:

```typescript
// src/openapi/paths/context.ts
import { OpenAPIRegistry } from 'zod-to-openapi';

export function registerContextPaths(registry: OpenAPIRegistry) {
  // GET /api/context/people
  registry.registerPath({
    method: 'get',
    path: '/api/context/people',
    tags: ['Context - People'],
    summary: 'List people',
    description: 'Retrieve a paginated list of people. Supports filtering by type, source, and tags.',
    security: [{ bearerAuth: [] }],
    request: {
      query: listPeopleQuerySchema,
    },
    responses: {
      200: {
        description: 'Paginated list of people',
        content: {
          'application/json': {
            schema: PaginatedPeopleResponseSchema,
          },
        },
      },
      401: { $ref: '#/components/responses/Unauthorized' },
      429: { $ref: '#/components/responses/RateLimited' },
    },
  });

  // POST /api/context/people
  registry.registerPath({
    method: 'post',
    path: '/api/context/people',
    tags: ['Context - People'],
    summary: 'Create person',
    description: 'Create a new person in the context system.',
    security: [{ bearerAuth: [] }],
    request: {
      body: {
        content: {
          'application/json': {
            schema: PersonCreateSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'Person created successfully',
        content: {
          'application/json': {
            schema: PersonResponseSchema,
          },
        },
      },
      400: { $ref: '#/components/responses/ValidationError' },
      401: { $ref: '#/components/responses/Unauthorized' },
      409: { $ref: '#/components/responses/Conflict' },
      429: { $ref: '#/components/responses/RateLimited' },
    },
  });
}
```

---

### Task 5: Create Main Spec Generator

```typescript
// src/openapi/index.ts
import { OpenAPIRegistry, OpenApiGeneratorV31 } from 'zod-to-openapi';
import { registerHealthPaths } from './paths/health';
import { registerChatPaths } from './paths/chat';
import { registerContextPaths } from './paths/context';
import { registerIntegrationPaths } from './paths/integrations';
import { registerSearchPaths } from './paths/search';
import { registerAdminPaths } from './paths/admin';
import { registerSecuritySchemes } from './components/security';
import { registerCommonResponses } from './components/responses';

export function generateOpenAPIDocument() {
  const registry = new OpenAPIRegistry();

  // Register components
  registerSecuritySchemes(registry);
  registerCommonResponses(registry);

  // Register all paths
  registerHealthPaths(registry);
  registerChatPaths(registry);
  registerContextPaths(registry);
  registerIntegrationPaths(registry);
  registerSearchPaths(registry);
  registerAdminPaths(registry);

  const generator = new OpenApiGeneratorV31(registry.definitions);

  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Theo API',
      version: '1.0.0',
      description: `
# Theo Core API

Personal AI assistant API for managing context, conversations, and integrations.

## Authentication

All endpoints (except /api/health) require authentication via session cookie or Bearer token.

## Rate Limiting

API requests are rate-limited per user:
- Standard endpoints: 60 requests/minute
- Search endpoints: 30 requests/minute (due to AI costs)
- Gmail sync: 10 requests/minute

Rate limit headers are included in all responses:
- \`X-RateLimit-Limit\`: Maximum requests allowed
- \`X-RateLimit-Remaining\`: Requests remaining
- \`X-RateLimit-Reset\`: Unix timestamp when limit resets
      `.trim(),
      contact: {
        name: 'Theo Support',
        url: 'https://github.com/your-org/theo-core',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.theo.app',
        description: 'Production server',
      },
    ],
    tags: [
      { name: 'Health', description: 'System health and status endpoints' },
      { name: 'Chat', description: 'Conversation and message management' },
      { name: 'Context - People', description: 'People/contacts management' },
      { name: 'Context - Places', description: 'Location management' },
      { name: 'Context - Events', description: 'Event and calendar management' },
      { name: 'Context - Tasks', description: 'Task management' },
      { name: 'Context - Deadlines', description: 'Deadline tracking' },
      { name: 'Context - Relationships', description: 'Entity relationship management' },
      { name: 'Context - Search', description: 'Unified context search' },
      { name: 'Integrations', description: 'Third-party integration management' },
      { name: 'Gmail', description: 'Gmail integration endpoints' },
      { name: 'Search', description: 'Email and content search' },
      { name: 'Admin', description: 'Administrative endpoints' },
    ],
  });
}
```

---

### Task 6: Create API Route for OpenAPI JSON

```typescript
// src/app/api/openapi.json/route.ts
import { NextResponse } from 'next/server';
import { generateOpenAPIDocument } from '@/openapi';

export async function GET() {
  const spec = generateOpenAPIDocument();
  return NextResponse.json(spec);
}
```

---

### Task 7: Create Scalar Documentation Route

```typescript
// src/app/api/docs/route.ts
import { ApiReference } from '@scalar/nextjs-api-reference';

export const GET = ApiReference({
  spec: {
    url: '/api/openapi.json',
  },
  theme: 'kepler', // Modern dark theme
  layout: 'modern',
  hideDownloadButton: false,
  searchHotKey: 'k',
  metaData: {
    title: 'Theo API Documentation',
    description: 'Interactive API documentation for Theo Core',
  },
  // Custom CSS for branding
  customCss: `
    .scalar-api-reference {
      --scalar-color-1: #7c3aed;
      --scalar-color-accent: #7c3aed;
    }
  `,
});
```

---

### Task 8: Alternative - Static Page Route (Recommended)

For better customization and SSR support:

```typescript
// src/app/docs/page.tsx
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';

export const metadata = {
  title: 'API Documentation | Theo',
  description: 'Interactive API documentation for Theo Core',
};

export default async function DocsPage() {
  return (
    <div className="h-screen">
      <ApiReferenceReact
        configuration={{
          spec: {
            url: '/api/openapi.json',
          },
          theme: 'kepler',
          layout: 'modern',
          hideDownloadButton: false,
        }}
      />
    </div>
  );
}
```

---

## API Endpoint Inventory

### Health & Status
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | System health check |

### Chat (4 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/chat/conversations` | List conversations |
| POST | `/api/chat/conversations` | Create conversation |
| GET | `/api/chat/conversations/{id}` | Get conversation |
| PATCH | `/api/chat/conversations/{id}` | Update conversation |
| DELETE | `/api/chat/conversations/{id}` | Delete conversation |
| GET | `/api/chat/conversations/{id}/messages` | List messages |
| POST | `/api/chat/conversations/{id}/messages` | Send message |
| GET | `/api/chat/conversations/{id}/stream` | SSE stream (realtime) |

### Context - People (3 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/context/people` | List/search people |
| POST | `/api/context/people` | Create person |
| GET | `/api/context/people/{id}` | Get person |
| PATCH | `/api/context/people/{id}` | Update person |
| DELETE | `/api/context/people/{id}` | Soft delete person |

### Context - Places (3 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/context/places` | List places |
| POST | `/api/context/places` | Create place |
| GET | `/api/context/places/{id}` | Get place |
| PATCH | `/api/context/places/{id}` | Update place |
| DELETE | `/api/context/places/{id}` | Soft delete place |

### Context - Events (3 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/context/events` | List events |
| POST | `/api/context/events` | Create event |
| GET | `/api/context/events/{id}` | Get event |
| PATCH | `/api/context/events/{id}` | Update event |
| DELETE | `/api/context/events/{id}` | Soft delete event |

### Context - Tasks (3 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/context/tasks` | List tasks |
| POST | `/api/context/tasks` | Create task |
| GET | `/api/context/tasks/{id}` | Get task |
| PATCH | `/api/context/tasks/{id}` | Update task |
| DELETE | `/api/context/tasks/{id}` | Soft delete task |

### Context - Deadlines (3 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/context/deadlines` | List deadlines |
| POST | `/api/context/deadlines` | Create deadline |
| GET | `/api/context/deadlines/{id}` | Get deadline |
| PATCH | `/api/context/deadlines/{id}` | Update deadline |
| DELETE | `/api/context/deadlines/{id}` | Soft delete deadline |

### Context - Relationships (3 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/context/relationships` | List relationships |
| POST | `/api/context/relationships` | Create relationship |
| GET | `/api/context/relationships/{id}` | Get relationship |
| PATCH | `/api/context/relationships/{id}` | Update relationship |
| DELETE | `/api/context/relationships/{id}` | Delete relationship |

### Context - Search (1 endpoint)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/context/search` | Unified semantic/text search |

### Integrations (1 endpoint)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/integrations/status` | Get all integration statuses |

### Gmail Integration (13 endpoints)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/integrations/gmail/connect` | Check connection status |
| POST | `/api/integrations/gmail/connect` | Initiate Gmail connection |
| POST | `/api/integrations/gmail/disconnect` | Disconnect Gmail |
| POST | `/api/integrations/gmail/sync` | Trigger email sync |
| PATCH | `/api/integrations/gmail/sync` | Update sync config |
| DELETE | `/api/integrations/gmail/sync` | Cancel pending syncs |
| GET | `/api/integrations/gmail/sync/status` | Get sync status |
| GET | `/api/integrations/gmail/sync/stream` | SSE sync progress |
| POST | `/api/integrations/gmail/sync/contacts` | Sync contacts |
| GET | `/api/integrations/gmail/drafts` | List drafts |
| POST | `/api/integrations/gmail/drafts` | Create draft |
| GET | `/api/integrations/gmail/drafts/{id}` | Get draft |
| DELETE | `/api/integrations/gmail/drafts/{id}` | Delete draft |
| GET | `/api/integrations/gmail/approvals` | List approvals |
| POST | `/api/integrations/gmail/approvals` | Request approval |
| GET | `/api/integrations/gmail/approvals/{id}` | Get approval |
| PATCH | `/api/integrations/gmail/approvals/{id}` | Approve/reject |
| POST | `/api/integrations/gmail/send` | Send email |
| GET | `/api/integrations/gmail/threads/{id}` | Get thread |

### Search (1 endpoint)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search/emails` | Search emails (semantic + text) |

### Admin (1 endpoint)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/queues` | Get queue statistics |

**Total: ~45 endpoints**

---

## File Structure (Final)

```
src/
├── openapi/
│   ├── index.ts                    # Main generator
│   ├── components/
│   │   ├── schemas/
│   │   │   ├── common.ts           # Pagination, errors
│   │   │   ├── person.ts           # Person schemas
│   │   │   ├── place.ts            # Place schemas
│   │   │   ├── event.ts            # Event schemas
│   │   │   ├── task.ts             # Task schemas
│   │   │   ├── deadline.ts         # Deadline schemas
│   │   │   ├── relationship.ts     # Relationship schemas
│   │   │   ├── chat.ts             # Chat/message schemas
│   │   │   ├── gmail.ts            # Gmail-specific schemas
│   │   │   └── index.ts            # Re-export all
│   │   ├── parameters.ts           # Common query/path params
│   │   ├── responses.ts            # Standard responses
│   │   └── security.ts             # Auth schemes
│   └── paths/
│       ├── health.ts
│       ├── chat.ts
│       ├── context/
│       │   ├── people.ts
│       │   ├── places.ts
│       │   ├── events.ts
│       │   ├── tasks.ts
│       │   ├── deadlines.ts
│       │   ├── relationships.ts
│       │   ├── search.ts
│       │   └── index.ts
│       ├── integrations/
│       │   ├── status.ts
│       │   ├── gmail/
│       │   │   ├── connect.ts
│       │   │   ├── sync.ts
│       │   │   ├── drafts.ts
│       │   │   ├── approvals.ts
│       │   │   ├── send.ts
│       │   │   ├── threads.ts
│       │   │   └── index.ts
│       │   └── index.ts
│       ├── search.ts
│       ├── admin.ts
│       └── index.ts
├── app/
│   ├── api/
│   │   └── openapi.json/
│   │       └── route.ts            # Serves OpenAPI JSON
│   └── docs/
│       └── page.tsx                # Scalar UI page
```

---

## Implementation Timeline

| Task | Effort | Priority |
|------|--------|----------|
| Install dependencies | 5 min | P0 |
| Create base structure & security | 30 min | P0 |
| Common schemas & responses | 1 hr | P0 |
| Context paths (People) | 1 hr | P0 |
| Context paths (remaining 5 entities) | 2 hr | P1 |
| Chat paths | 1 hr | P1 |
| Gmail integration paths | 2 hr | P1 |
| Search & Admin paths | 30 min | P2 |
| Scalar route setup | 15 min | P0 |
| Testing & polish | 1 hr | P1 |

**Total Estimated Effort: ~9 hours**

---

## Configuration Options

### Scalar Themes
- `default` - Clean light theme
- `alternate` - Alternate light
- `moon` - Dark purple
- `purple` - Purple accent
- `solarized` - Solarized dark
- `kepler` - Modern dark (recommended)
- `mars` - Red accent dark
- `deepSpace` - Deep dark

### Layout Options
- `modern` - Side-by-side layout (recommended)
- `classic` - Traditional three-column

---

## Success Criteria

1. ✅ `/docs` route renders Scalar UI with full API documentation
2. ✅ All 45+ endpoints are documented with request/response schemas
3. ✅ "Try it out" works for authenticated endpoints
4. ✅ Zod schemas are the source of truth (no schema drift)
5. ✅ Rate limit documentation is accurate
6. ✅ SSE endpoints are properly documented

---

## Future Enhancements

1. **Webhook documentation** - When webhooks are added
2. **SDK generation** - Use OpenAPI spec to generate TypeScript client
3. **Changelog** - Version API changes in spec
4. **API versioning** - `/v1/` prefix when needed

