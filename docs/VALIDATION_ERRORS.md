# Validation & Error Handling Documentation

> **Status**: Complete  
> **Last Updated**: December 2024  
> **Related**: [API_REFERENCE.md](./API_REFERENCE.md)

---

## Overview

Theo uses **Zod** for request validation and structured error handling throughout the application. All API errors follow a consistent format.

---

## Request Validation

### Validate Body

```typescript
import { parseAndValidateBody, createPersonSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const validation = await parseAndValidateBody(request, createPersonSchema);

  if (!validation.success) {
    return validation.error; // Returns 400 response
  }

  const data = validation.data; // Typed and validated
  // ...
}
```

### Validate Query Parameters

```typescript
import { validateQuery, listPeopleQuerySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, listPeopleQuerySchema);

  if (!validation.success) {
    return validation.error;
  }

  const { limit, cursor, type } = validation.data;
  // ...
}
```

### Validate Path Parameters

```typescript
import { validateParams } from "@/lib/validation";
import { z } from "zod";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const validation = validateParams(params, paramsSchema);

  if (!validation.success) {
    return validation.error;
  }

  const { id } = validation.data;
  // ...
}
```

---

## Validation Result

```typescript
type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: Response };
```

**Usage Pattern:**

```typescript
const validation = await parseAndValidateBody(request, schema);

if (!validation.success) {
  return validation.error; // 400 Bad Request
}

// TypeScript knows validation.data is the correct type
const typedData = validation.data;
```

---

## Validation Error Response

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
      },
      {
        "path": "importance",
        "message": "Number must be between 1 and 10",
        "code": "too_big"
      }
    ]
  }
}
```

---

## Common Schemas

### Create Person

```typescript
export const createPersonSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  type: z.enum(["contact", "colleague", "friend", "family", "lead"]).optional(),
  importance: z.number().int().min(1).max(10).optional(),
  company: z.string().max(255).optional(),
  title: z.string().max(255).optional(),
  notes: z.string().optional(),
  source: z.enum(["manual", "gmail", "slack", "calendar", "import"]),
  tags: z.array(z.string()).optional(),
});
```

### List Query

```typescript
export const listPeopleQuerySchema = z.object({
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().int().min(1).max(100))
    .optional(),
  cursor: z.string().optional(),
  type: z.string().optional(),
  source: z.string().optional(),
  search: z.string().optional(),
  tags: z.string().optional(), // Comma-separated
  includeDeleted: z
    .string()
    .transform((v) => v === "true")
    .optional(),
});
```

---

## Structured Error Handling

### AppError Type

```typescript
interface AppError {
  code: string;
  message: string;
  details?: unknown;
  timestamp: Date;
}

const error = createAppError("NOT_FOUND", "Person not found", { id });
```

### Common API Errors

```typescript
import { API_ERRORS, apiError } from "@/lib/utils/error-handler";

// Pre-defined errors
return apiError("UNAUTHORIZED"); // 401
return apiError("FORBIDDEN"); // 403
return apiError("NOT_FOUND"); // 404
return apiError("VALIDATION_ERROR"); // 400
return apiError("RATE_LIMIT_EXCEEDED"); // 429
return apiError("INTERNAL_ERROR"); // 500

// With custom message
return apiError("NOT_FOUND", "Person not found");
```

### API Error Response

```typescript
export function apiErrorResponse(
  code: string,
  message: string,
  status: number = 500
): Response {
  return Response.json(
    {
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}
```

---

## Error Logging

```typescript
import { logError } from "@/lib/utils/error-handler";

try {
  await riskyOperation();
} catch (error) {
  logError(error, { userId, operation: "createPerson" });
  throw error;
}
```

**Log Format:**

```json
{
  "message": "Error message",
  "stack": "...",
  "name": "Error",
  "userId": "123",
  "operation": "createPerson",
  "timestamp": "2024-12-20T10:00:00.000Z",
  "environment": "development"
}
```

---

## Service Errors

Each service has typed errors:

```typescript
import { PeopleServiceError } from "@/services/context";

try {
  await createPerson(userId, data);
} catch (error) {
  if (error instanceof PeopleServiceError) {
    switch (error.code) {
      case "DUPLICATE_EMAIL":
        return apiErrorResponse("DUPLICATE_EMAIL", error.message, 409);
      case "INVALID_EMAIL":
        return apiErrorResponse("INVALID_EMAIL", error.message, 400);
      case "NOT_FOUND":
        return apiErrorResponse("NOT_FOUND", error.message, 404);
      default:
        throw error;
    }
  }
  throw error;
}
```

---

## Route Handler Pattern

```typescript
export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth();
    if (!session?.user?.id) {
      return apiError("UNAUTHORIZED");
    }

    // 2. Validate
    const validation = await parseAndValidateBody(request, schema);
    if (!validation.success) {
      return validation.error;
    }

    // 3. Execute
    const result = await service.create(session.user.id, validation.data);

    // 4. Return success
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    // 5. Handle known errors
    if (error instanceof ServiceError) {
      return apiErrorResponse(error.code, error.message, 400);
    }

    // 6. Log and return generic error
    logError(error, { route: "POST /api/..." });
    return apiError("INTERNAL_ERROR");
  }
}
```

---

## Safe JSON Parsing

```typescript
import { safeJsonParse } from "@/lib/utils/error-handler";

const data = safeJsonParse<Config>(jsonString, { default: "value" });
// Returns parsed JSON or fallback value
```

---

## Error Wrapping

```typescript
import { withErrorLogging } from "@/lib/utils/error-handler";

const wrappedFunction = withErrorLogging(
  async (id: string) => {
    return await riskyOperation(id);
  },
  { context: "riskyOperation" }
);

// Errors are automatically logged with context
await wrappedFunction("123");
```

---

## Type Checking Errors

```typescript
import { isAppError } from "@/lib/utils/error-handler";

if (isAppError(error)) {
  // error is typed as AppError
  console.log(error.code, error.message);
}
```

---

## Best Practices

### 1. Validate Early

```typescript
// ✅ Good - validate first
export async function POST(request: NextRequest) {
  const validation = await parseAndValidateBody(request, schema);
  if (!validation.success) return validation.error;

  // Then auth, business logic...
}
```

### 2. Use Typed Errors

```typescript
// ✅ Good - specific error types
if (error instanceof PeopleServiceError) {
  // Handle specifically
}

// ❌ Bad - string checking
if (error.message.includes("duplicate")) {
  // Fragile
}
```

### 3. Include Context in Logs

```typescript
// ✅ Good - rich context
logError(error, {
  userId,
  action: "createPerson",
  input: { name: data.name },
});

// ❌ Bad - no context
console.error(error);
```

### 4. Return Consistent Format

```typescript
// ✅ Good - consistent structure
return Response.json(
  {
    error: {
      code: "ERROR_CODE",
      message: "Description",
    },
  },
  { status: 400 }
);

// ❌ Bad - inconsistent
return Response.json({ error: "Something failed" });
```

---

## Testing Validation

```typescript
describe("Validation", () => {
  it("should reject invalid email", async () => {
    const validation = validateBody(
      { email: "not-an-email" },
      createPersonSchema
    );

    expect(validation.success).toBe(false);
    if (!validation.success) {
      const body = await validation.error.json();
      expect(body.error.issues[0].path).toBe("email");
    }
  });
});
```

---

## Related Documentation

- [API_REFERENCE.md](./API_REFERENCE.md) - API error responses
- [services/CONTEXT_SERVICES.md](./services/CONTEXT_SERVICES.md) - Service errors
- [Zod Documentation](https://zod.dev/) - Validation library
