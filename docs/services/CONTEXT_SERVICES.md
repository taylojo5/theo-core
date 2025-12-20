# Context Services Documentation

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [DATA_LAYER.md](../DATA_LAYER.md), [AI_EMBEDDINGS.md](../AI_EMBEDDINGS.md), [SEARCH_SERVICES.md](./SEARCH_SERVICES.md)

---

## Overview

Context Services manage the core entities in Theo: **People**, **Places**, **Events**, **Tasks**, **Deadlines**, and **Relationships**. These services provide CRUD operations with built-in audit logging, soft deletion, pagination, and automatic embedding generation.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONTEXT SERVICES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   People    │  │   Places    │  │   Events    │             │
│  │   Service   │  │   Service   │  │   Service   │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐       │
│  │   Tasks     │  │  Deadlines  │  │   Relationships   │       │
│  │   Service   │  │   Service   │  │      Service      │       │
│  └─────────────┘  └─────────────┘  └───────────────────┘       │
│                          │                                       │
│           ┌──────────────┼──────────────────┐                   │
│           ▼              ▼                  ▼                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐         │
│  │  Utilities  │  │   Audit     │  │   Embedding     │         │
│  │  (utils.ts) │  │   Service   │  │   Integration   │         │
│  └─────────────┘  └─────────────┘  └─────────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Common Patterns

### Service Context

All modifying operations accept an optional `ServiceContext` for audit logging:

```typescript
interface ServiceContext {
  userId: string;
  sessionId?: string;
  conversationId?: string;
}
```

### Pagination

List operations return paginated results:

```typescript
interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  totalCount?: number;
}
```

**Usage:**

```typescript
// First page
const page1 = await listPeople(userId, { limit: 20 });

// Next page
const page2 = await listPeople(userId, {
  limit: 20,
  cursor: page1.nextCursor,
});
```

### Soft Delete

Entities support soft deletion:

```typescript
// Delete (soft)
await deletePerson(userId, personId, context);

// Restore
await restorePerson(userId, personId, context);

// Include deleted in queries
const all = await listPeople(userId, { includeDeleted: true });
```

### Source Tracking

All entities track their origin:

| Source     | Description              |
| ---------- | ------------------------ |
| `manual`   | Created by user directly |
| `gmail`    | Synced from Gmail        |
| `slack`    | Synced from Slack        |
| `calendar` | Synced from calendar     |
| `import`   | Bulk imported            |

---

## Entity Types

### Type Constants

```typescript
type EntityType = "person" | "place" | "event" | "task" | "deadline";
type Source = "manual" | "gmail" | "slack" | "calendar" | "import";

// Person types
type PersonType =
  | "contact"
  | "colleague"
  | "friend"
  | "family"
  | "lead"
  | "client"
  | "vendor";

// Place types
type PlaceType =
  | "location"
  | "home"
  | "office"
  | "restaurant"
  | "venue"
  | "city"
  | "airport"
  | "hotel";

// Event types
type EventType =
  | "meeting"
  | "call"
  | "travel"
  | "deadline"
  | "reminder"
  | "social"
  | "conference";

// Task status
type TaskStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "deferred";

// Task priority
type TaskPriority = "low" | "medium" | "high" | "urgent";

// Deadline status
type DeadlineStatus = "pending" | "completed" | "missed" | "extended";
```

---

## People Service

Manage contacts, colleagues, friends, and other people in your network.

### Import

```typescript
import {
  createPerson,
  getPersonById,
  updatePerson,
  deletePerson,
  restorePerson,
  listPeople,
  searchPeople,
  findPersonByEmail,
  upsertPeopleFromSource,
  PeopleServiceError,
} from "@/services/context";
```

### Create Person

```typescript
const person = await createPerson(
  userId,
  {
    name: "Sarah Chen",
    email: "sarah@acme.com",
    type: "colleague",
    importance: 8,
    company: "Acme Corp",
    title: "Product Manager",
    source: "manual",
    notes: "Met at Q3 planning offsite",
    tags: ["work", "product"],
  },
  context
);
```

**Input Schema:**

```typescript
interface CreatePersonInput {
  name: string; // Required
  email?: string; // Validated and normalized
  phone?: string;
  avatarUrl?: string;
  type?: PersonType; // Default: "contact"
  importance?: number; // 1-10, default: 5
  company?: string;
  title?: string;
  location?: string;
  timezone?: string;
  bio?: string;
  notes?: string;
  preferences?: Record<string, unknown>;
  source: Source; // Required
  sourceId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
}
```

### Get Person

```typescript
const person = await getPersonById(userId, personId);

if (!person) {
  throw new Error("Person not found");
}
```

### Update Person

```typescript
const updated = await updatePerson(
  userId,
  personId,
  {
    title: "Senior Product Manager",
    importance: 9,
  },
  context
);
```

### List People

```typescript
const result = await listPeople(userId, {
  limit: 20,
  type: "colleague",
  company: "Acme Corp",
  minImportance: 7,
  search: "product",
  sortBy: "name",
  sortOrder: "asc",
  tags: ["work"],
});
```

**Options:**

```typescript
interface ListPeopleOptions {
  limit?: number; // Default: 20, max: 100
  cursor?: string; // Pagination cursor
  sortBy?: string; // Default: "createdAt"
  sortOrder?: "asc" | "desc";
  search?: string; // Full-text search
  source?: Source;
  tags?: string[];
  type?: PersonType;
  company?: string;
  minImportance?: number;
  includeDeleted?: boolean;
}
```

### Search People

```typescript
const results = await searchPeople(userId, "product manager", {
  type: "colleague",
  limit: 10,
});
```

### Find by Email

```typescript
const person = await findPersonByEmail(userId, "sarah@acme.com");
```

### Upsert from Source

Bulk sync from external sources with deduplication:

```typescript
const result = await upsertPeopleFromSource(userId, "gmail", [
  {
    sourceId: "gmail-123",
    data: { name: "John Doe", email: "john@example.com", source: "gmail" },
  },
  {
    sourceId: "gmail-456",
    data: { name: "Jane Doe", email: "jane@example.com", source: "gmail" },
  },
]);

console.log(
  `Created: ${result.created.length}, Updated: ${result.updated.length}`
);
```

---

## Places Service

Manage locations like offices, restaurants, venues, and cities.

### Import

```typescript
import {
  createPlace,
  getPlaceById,
  updatePlace,
  deletePlace,
  listPlaces,
  searchPlaces,
  findPlacesByCity,
  findPlacesNearby,
  PlacesServiceError,
} from "@/services/context";
```

### Create Place

```typescript
const place = await createPlace(
  userId,
  {
    name: "Acme HQ",
    type: "office",
    address: "123 Tech Street",
    city: "San Francisco",
    state: "CA",
    country: "USA",
    latitude: 37.7749,
    longitude: -122.4194,
    timezone: "America/Los_Angeles",
    source: "manual",
    tags: ["work", "hq"],
  },
  context
);
```

### List Places

```typescript
const result = await listPlaces(userId, {
  type: "restaurant",
  city: "San Francisco",
  limit: 20,
});
```

### Find Nearby

```typescript
const nearby = await findPlacesNearby(userId, {
  latitude: 37.7749,
  longitude: -122.4194,
  radiusKm: 5,
  limit: 10,
});
```

---

## Events Service

Manage meetings, calls, travel, and other calendar events.

### Import

```typescript
import {
  createEvent,
  getEventById,
  updateEvent,
  deleteEvent,
  listEvents,
  getUpcomingEvents,
  getPastEvents,
  getEventsOnDate,
  getEventsByTimeRange,
  cancelEvent,
  confirmEvent,
  EventsServiceError,
} from "@/services/context";
```

### Create Event

```typescript
const event = await createEvent(
  userId,
  {
    title: "Product Review",
    description: "Quarterly product review meeting",
    type: "meeting",
    startsAt: new Date("2024-12-20T10:00:00Z"),
    endsAt: new Date("2024-12-20T11:00:00Z"),
    location: "Conference Room A",
    placeId: place.id,
    status: "confirmed",
    source: "manual",
    tags: ["product", "quarterly"],
  },
  context
);
```

### Get Upcoming Events

```typescript
// Next 7 days
const upcoming = await getUpcomingEvents(userId, {
  days: 7,
  limit: 20,
  type: "meeting",
});
```

### Get Events by Time Range

```typescript
const events = await getEventsByTimeRange(userId, {
  start: new Date("2024-12-01"),
  end: new Date("2024-12-31"),
  type: "meeting",
});
```

### Get Events on Date

```typescript
const todayEvents = await getEventsOnDate(userId, new Date());
```

### Event Status Updates

```typescript
// Cancel an event
await cancelEvent(userId, eventId, context);

// Confirm a tentative event
await confirmEvent(userId, eventId, context);

// Update status directly
await updateEventStatus(userId, eventId, "cancelled", context);
```

---

## Tasks Service

Manage tasks with hierarchy, priorities, and due dates.

### Import

```typescript
import {
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
  listTasks,
  completeTask,
  startTask,
  deferTask,
  cancelTask,
  reopenTask,
  getSubtasks,
  getOverdueTasks,
  getTasksDueSoon,
  TasksServiceError,
} from "@/services/context";
```

### Create Task

```typescript
const task = await createTask(
  userId,
  {
    title: "Review Q4 roadmap",
    description: "Go through the product roadmap and provide feedback",
    priority: "high",
    status: "pending",
    dueDate: new Date("2024-12-25"),
    estimatedMinutes: 120,
    assignedToId: personId,
    source: "manual",
    tags: ["planning", "q4"],
  },
  context
);
```

### Create Subtask

```typescript
const subtask = await createTask(
  userId,
  {
    title: "Review mobile section",
    parentId: task.id,
    priority: "medium",
    source: "manual",
  },
  context
);
```

### Task Status Workflow

```typescript
// Start working
await startTask(userId, taskId, context);
// Task status: "in_progress"

// Complete
await completeTask(userId, taskId, context);
// Task status: "completed", completedAt set

// Defer to later
await deferTask(userId, taskId, context);
// Task status: "deferred"

// Cancel
await cancelTask(userId, taskId, context);
// Task status: "cancelled"

// Reopen a completed/cancelled task
await reopenTask(userId, taskId, context);
// Task status: "pending"
```

### List Tasks

```typescript
const result = await listTasks(userId, {
  status: "pending",
  priority: "high",
  parentId: null, // Top-level tasks only
  dueBefore: new Date("2024-12-31"),
  sortBy: "dueDate",
  sortOrder: "asc",
});
```

### Get Overdue Tasks

```typescript
const overdue = await getOverdueTasks(userId, {
  limit: 20,
  priority: "high",
});
```

### Get Tasks Due Soon

```typescript
// Due within 3 days
const dueSoon = await getTasksDueSoon(userId, {
  days: 3,
  status: "pending",
});
```

---

## Deadlines Service

Manage deadlines, milestones, and reminders tied to tasks or events.

### Import

```typescript
import {
  createDeadline,
  getDeadlineById,
  updateDeadline,
  deleteDeadline,
  listDeadlines,
  completeDeadline,
  markDeadlineMissed,
  extendDeadline,
  getOverdueDeadlines,
  getApproachingDeadlines,
  getDeadlinesByUrgency,
  calculateDeadlineUrgency,
  DeadlinesServiceError,
} from "@/services/context";
```

### Create Deadline

```typescript
const deadline = await createDeadline(
  userId,
  {
    title: "Submit Q4 report",
    type: "deadline",
    dueAt: new Date("2024-12-31T17:00:00Z"),
    reminderAt: new Date("2024-12-30T09:00:00Z"),
    importance: 9,
    taskId: task.id,
    consequences: "Delay in quarterly review",
    source: "manual",
  },
  context
);
```

### Deadline Status Updates

```typescript
// Mark as completed
await completeDeadline(userId, deadlineId, context);

// Mark as missed
await markDeadlineMissed(userId, deadlineId, context);

// Extend the deadline
await extendDeadline(userId, deadlineId, new Date("2025-01-05"), context);
```

### Get by Urgency

```typescript
const urgent = await getDeadlinesByUrgency(userId, {
  minUrgency: "high", // "low" | "medium" | "high" | "critical"
  limit: 10,
});
```

### Calculate Urgency

```typescript
const urgency = calculateDeadlineUrgency(deadline);
// Returns: { level: "high", daysUntilDue: 2, hoursUntilDue: 48 }
```

---

## Relationships Service

Manage connections between entities.

### Import

```typescript
import {
  createRelationship,
  getRelationshipById,
  updateRelationship,
  deleteRelationship,
  listRelationships,
  getRelationshipsFor,
  getRelatedEntities,
  findRelationshipBetween,
  relationshipExists,
  syncRelationships,
  RelationshipsServiceError,
} from "@/services/context";
```

### Relationship Types

| Source → Target | Relationship                                                    |
| --------------- | --------------------------------------------------------------- |
| Person → Person | `works_with`, `manages`, `reports_to`, `knows`, `introduced_by` |
| Person → Place  | `works_at`, `lives_at`, `frequents`                             |
| Person → Event  | `attends`, `organizes`, `declined`, `invited_to`                |
| Person → Task   | `assigned_to`, `created_by`, `mentioned_in`                     |
| Event → Place   | `located_at`                                                    |
| Task → Event    | `scheduled_for`, `discussed_in`                                 |

### Create Relationship

```typescript
const rel = await createRelationship(
  userId,
  {
    sourceType: "person",
    sourceId: person1Id,
    targetType: "person",
    targetId: person2Id,
    relationship: "works_with",
    strength: 8,
    bidirectional: true,
    notes: "Same product team",
  },
  context
);
```

### Get Related Entities

```typescript
const related = await getRelatedEntities(userId, "person", personId, {
  targetTypes: ["person", "event"],
  relationships: ["works_with", "attends"],
  limit: 20,
});

for (const { entity, relationship, direction } of related) {
  console.log(`${direction}: ${relationship.relationship}`);
}
```

### Check Relationship Exists

```typescript
const exists = await relationshipExists(userId, {
  sourceType: "person",
  sourceId: person1Id,
  targetType: "person",
  targetId: person2Id,
  relationship: "works_with",
});
```

---

## Utility Functions

### Import

```typescript
import {
  // Soft Delete
  excludeDeleted,
  onlyDeleted,
  softDeleteFilter,

  // Pagination
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  normalizePagination,
  processPaginatedResults,
  buildOrderBy,

  // Email
  normalizeEmail,
  extractEmailDomain,
  isValidEmail,

  // Content Hash
  generateContentHash,
  generateEntityHash,

  // Text
  buildSearchableContent,
  truncateText,
  extractSnippet,

  // Tags
  normalizeTags,
  mergeTags,

  // Dates
  isPast,
  isFuture,
  isWithinDays,
  getDateRange,

  // Importance
  validateImportance,
  getImportanceLabel,
} from "@/services/context";
```

### Soft Delete Filters

```typescript
// In Prisma queries
const activePeople = await db.person.findMany({
  where: { userId, ...excludeDeleted() },
});

const deletedPeople = await db.person.findMany({
  where: { userId, ...onlyDeleted() },
});
```

### Pagination Helpers

```typescript
const { take, skip, cursor } = normalizePagination({ limit: 20, cursor: "abc" });

const rawItems = await db.person.findMany({ take, skip, cursor, ... });

const { items, nextCursor, hasMore } = processPaginatedResults(rawItems, 20);
```

### Email Utilities

```typescript
const normalized = normalizeEmail("  Sarah@ACME.com  ");
// "sarah@acme.com"

const domain = extractEmailDomain("sarah@acme.com");
// "acme.com"

const valid = isValidEmail("sarah@acme.com");
// true
```

### Date Utilities

```typescript
const { start, end } = getDateRange("week");
// Current week boundaries

const soon = isWithinDays(dueDate, 7);
// true if within next 7 days
```

### Tag Utilities

```typescript
const normalized = normalizeTags(["  Work  ", "PRODUCT", "work"]);
// ["work", "product"]

const merged = mergeTags(existing, ["new-tag"]);
// Deduplicated combined tags
```

---

## Error Handling

Each service has a specific error class:

```typescript
import {
  PeopleServiceError,
  PlacesServiceError,
  EventsServiceError,
  TasksServiceError,
  DeadlinesServiceError,
  RelationshipsServiceError,
} from "@/services/context";
```

### Error Codes

**People Service:**

- `INVALID_EMAIL` - Email format invalid
- `DUPLICATE_EMAIL` - Email already exists for user
- `NOT_FOUND` - Person not found
- `ALREADY_DELETED` - Already soft-deleted

**Tasks Service:**

- `INVALID_STATUS` - Invalid status transition
- `CIRCULAR_PARENT` - Task can't be its own parent
- `NOT_FOUND` - Task not found

### Handling Errors

```typescript
try {
  await createPerson(userId, data, context);
} catch (error) {
  if (error instanceof PeopleServiceError) {
    switch (error.code) {
      case "DUPLICATE_EMAIL":
        // Handle duplicate
        break;
      case "INVALID_EMAIL":
        // Handle invalid email
        break;
    }
  }
  throw error;
}
```

---

## Embedding Integration

Entities are automatically embedded for semantic search:

```typescript
import {
  // Content builders
  buildPersonContent,
  buildEventContent,
  buildTaskContent,

  // Manual embedding
  embedPerson,
  embedEvent,
  embedTask,

  // Lifecycle hooks (called automatically)
  afterEntityCreate,
  afterEntityUpdate,
  afterEntityDelete,
} from "@/services/context";
```

### How It Works

1. **On Create**: Entity content is built and embedded
2. **On Update**: If content changed, embedding is regenerated
3. **On Delete**: Embedding is removed

### Manual Embedding

```typescript
// Build searchable content
const content = buildPersonContent(person);
// "Sarah Chen. colleague. works at Acme Corp as Product Manager. Met at Q3 offsite."

// Manually embed
await embedPerson(userId, person);
```

---

## Testing

### Mocking Services

```typescript
import { vi } from "vitest";
import * as peopleService from "@/services/context/people";

vi.mock("@/services/context/people", () => ({
  createPerson: vi.fn().mockResolvedValue({ id: "test-id", name: "Test" }),
  getPersonById: vi.fn().mockResolvedValue(null),
}));
```

### Test Utilities

```typescript
// Create test data
const testPerson = await createPerson(testUserId, {
  name: "Test Person",
  email: "test@example.com",
  source: "manual",
});

// Clean up
await deletePerson(testUserId, testPerson.id);
```

---

## Best Practices

### 1. Always Pass Context

```typescript
// ✅ Good - audit trail maintained
await createTask(userId, data, { userId, sessionId });

// ❌ Missing context - no audit logging
await createTask(userId, data);
```

### 2. Use Specific Error Types

```typescript
// ✅ Good - proper error handling
try {
  await createPerson(userId, data);
} catch (e) {
  if (e instanceof PeopleServiceError && e.code === "DUPLICATE_EMAIL") {
    // Handle duplicate
  }
}
```

### 3. Prefer Soft Delete

```typescript
// ✅ Good - recoverable
await deletePerson(userId, personId);

// Later...
await restorePerson(userId, personId);
```

### 4. Use Pagination

```typescript
// ✅ Good - paginated
const page = await listTasks(userId, { limit: 20 });

// ❌ Bad - unbounded query
const all = await db.task.findMany();
```

---

## Related Documentation

- [DATA_LAYER.md](../DATA_LAYER.md) - Database models
- [AI_EMBEDDINGS.md](../AI_EMBEDDINGS.md) - Embedding generation
- [SEARCH_SERVICES.md](./SEARCH_SERVICES.md) - Context search
- [AUDIT_SERVICE.md](./AUDIT_SERVICE.md) - Audit logging
- [API_REFERENCE.md](../API_REFERENCE.md) - REST API endpoints
