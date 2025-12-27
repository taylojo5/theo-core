# Agent Tool Extension Guide

> **Purpose**: A comprehensive guide for adding new tools to Theo's Agent Engine  
> **Audience**: Developers extending Theo's AI capabilities  
> **Last Updated**: December 27, 2024  
> **Architecture**: Based on chunks [T1R], [T2Q], [T3A], [T4E] from Phase 5

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Tool System Components](#tool-system-components)
3. [Creating a New Tool](#creating-a-new-tool)
4. [Tool Categories & Risk Levels](#tool-categories--risk-levels)
5. [Integration Requirements](#integration-requirements)
6. [LLM Interface Design](#llm-interface-design)
7. [Validation & Execution](#validation--execution)
8. [Approval Flow](#approval-flow)
9. [Testing Tools](#testing-tools)
10. [Registration & Discovery](#registration--discovery)
11. [Example: Complete Tool Implementation](#example-complete-tool-implementation)
12. [Best Practices](#best-practices)

---

## Architecture Overview

Theo's Agent Engine uses an **LLM-First Tool Architecture** where tools are designed to be understood and used by Large Language Models. The system follows this flow:

```
User Message → LLM Classification → Tool Selection → Parameter Extraction
     ↓                                                      ↓
LLM Response ← Response Generation ← Tool Execution ← Validation (Zod)
```

### Key Design Principles

1. **LLM-Native Interface**: Tools define their own JSON Schema for the LLM to understand
2. **Runtime Validation**: Zod schemas validate LLM-provided parameters before execution
3. **Risk-Aware Execution**: Tools declare risk levels; high-risk actions require approval
4. **Integration-Gated**: Tools only appear if required integrations are connected
5. **Auditable Actions**: All tool executions are logged with full context

---

## Tool System Components

### Core Files

| File | Purpose |
|------|---------|
| `src/lib/agent/tools/types.ts` | `ToolDefinition` interface, JSON Schema types |
| `src/lib/agent/tools/registry.ts` | `ToolRegistry` class for tool management |
| `src/lib/agent/tools/validation.ts` | Zod validation utilities |
| `src/lib/agent/tools/context.ts` | Execution context utilities |
| `src/lib/agent/tools/index.ts` | Public API exports |

### Tool Directories

```
src/lib/agent/tools/
├── query/           # Read-only query tools
│   ├── index.ts
│   ├── query-context.ts
│   ├── search-emails.ts
│   ├── list-calendar-events.ts
│   ├── check-availability.ts
│   └── list-tasks.ts
├── action/          # Write/mutate action tools
│   ├── index.ts
│   ├── create-task.ts
│   ├── update-task.ts
│   ├── draft-email.ts
│   ├── send-email.ts
│   ├── create-calendar-event.ts
│   └── update-calendar-event.ts
├── types.ts
├── registry.ts
├── validation.ts
├── context.ts
└── index.ts
```

---

## Creating a New Tool

### Step 1: Define Input/Output Types

```typescript
// src/lib/agent/tools/action/my-new-tool.ts

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { defineTool, objectSchema } from "../types";

// ─────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────

/** Input schema using Zod for validation */
const myToolInputSchema = z.object({
  // Define all parameters the LLM can provide
  query: z.string().min(1, "Query cannot be empty"),
  limit: z.number().int().min(1).max(50).optional().default(10),
  includeDrafts: z.boolean().optional().default(false),
});

type MyToolInput = z.infer<typeof myToolInputSchema>;

/** Output type for LLM to understand results */
interface MyToolOutput {
  success: boolean;
  results: Array<{
    id: string;
    title: string;
    // ... other relevant fields
  }>;
  message: string;
}
```

### Step 2: Create the Tool Definition

```typescript
// ─────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────

export const myNewTool: ToolDefinition<MyToolInput, MyToolOutput> = defineTool({
  // ═══════════════════════════════════════════════════════════
  // LLM Interface (what the LLM sees)
  // ═══════════════════════════════════════════════════════════
  name: "my_tool_name",  // snake_case, unique identifier
  description: "Brief description of what this tool does",
  
  whenToUse: `Detailed guidance for the LLM on when to use this tool:
- Scenario 1: "User asks about X..."
- Scenario 2: "When the user wants to Y..."

Do NOT use for:
- Scenario where another tool is better
- Edge cases to avoid`,

  examples: [
    'User: "Find something" → my_tool_name({ query: "something", limit: 5 })',
    'User: "Show me all drafts" → my_tool_name({ query: "drafts", includeDrafts: true })',
  ],

  parametersSchema: objectSchema(
    {
      query: {
        type: "string",
        description: "What to search for",
        minLength: 1,
      },
      limit: {
        type: "integer",
        description: "Maximum results to return (1-50, default 10)",
        minimum: 1,
        maximum: 50,
      },
      includeDrafts: {
        type: "boolean",
        description: "Whether to include draft items (default false)",
      },
    },
    ["query"]  // Required fields
  ),

  // ═══════════════════════════════════════════════════════════
  // Internal Configuration
  // ═══════════════════════════════════════════════════════════
  category: "query",        // See Tool Categories section
  riskLevel: "low",         // See Risk Levels section
  requiresApproval: false,  // true for high-risk external actions
  requiredIntegrations: [], // e.g., ["gmail"], ["calendar"], []

  // ═══════════════════════════════════════════════════════════
  // Validation & Execution
  // ═══════════════════════════════════════════════════════════
  inputValidator: myToolInputSchema,

  execute: async (input, context): Promise<MyToolOutput> => {
    const { query, limit, includeDrafts } = input;
    
    // Access user context
    const { userId, sessionId, conversationId } = context;
    
    // Your implementation here
    // Call services, databases, external APIs, etc.
    
    return {
      success: true,
      results: [...],
      message: `Found ${results.length} items matching "${query}"`,
    };
  },

  // Optional: Undo function for reversible actions
  undo: async (result, context) => {
    // Rollback logic if needed
  },
});
```

---

## Tool Categories & Risk Levels

### Tool Categories

Categories determine the type of operation and influence UI grouping and authorization.

| Category | Description | Examples |
|----------|-------------|----------|
| `query` | Read-only operations | Search, list, get |
| `compute` | Computation/transformation (no side effects) | Calculate, transform |
| `draft` | Create drafts (not sent/published) | Draft email |
| `create` | Create new entities | Create task, create event |
| `update` | Modify existing entities | Update task, reschedule meeting |
| `delete` | Remove entities | Delete task, cancel meeting |
| `external` | External API calls | Send email, post to Slack |

### Risk Levels

Risk levels determine confidence requirements and approval needs.

| Level | Description | Approval Default | Confidence Required |
|-------|-------------|------------------|---------------------|
| `low` | Read-only, no side effects | Never | 0.5 |
| `medium` | Creates/modifies internal data | Optional | 0.7 |
| `high` | Sends external communication | Required | 0.9 |
| `critical` | Irreversible or sensitive | Always required | 0.95 |

```typescript
// Example: High-risk tool configuration
{
  category: "external",
  riskLevel: "high",
  requiresApproval: true,
  requiredIntegrations: ["gmail"],
}
```

---

## Integration Requirements

Tools can require specific integrations to be connected before they're available to the user.

### Common Integrations

| Integration | Description |
|-------------|-------------|
| `gmail` | Gmail email access |
| `calendar` | Google Calendar access |
| `slack` | Slack workspace access |
| `(empty)` | No integration required (built-in context) |

### How It Works

```typescript
// Tool only available if Gmail is connected
requiredIntegrations: ["gmail"]

// Tool available to all users (uses internal context)
requiredIntegrations: []

// Tool requires multiple integrations
requiredIntegrations: ["gmail", "calendar"]
```

The registry filters tools based on user's connected integrations:

```typescript
// Get tools available to this user
const availableTools = toolRegistry.getAvailableTools(["gmail", "calendar"]);
```

---

## LLM Interface Design

The `parametersSchema` uses JSON Schema format, which is native to LLMs. This schema is sent directly to the LLM during classification and planning.

### JSON Schema Types

```typescript
import { objectSchema, type JSONSchemaProperty } from "../types";

// String with constraints
const stringField: JSONSchemaProperty = {
  type: "string",
  description: "User-facing description",
  minLength: 1,
  maxLength: 500,
  format: "email",  // or: "date", "date-time", "uri", "uuid"
  pattern: "^[A-Z]+$",  // Regex pattern
};

// Number/integer
const numberField: JSONSchemaProperty = {
  type: "integer",  // or "number" for floats
  description: "Count of items",
  minimum: 1,
  maximum: 100,
};

// Boolean
const boolField: JSONSchemaProperty = {
  type: "boolean",
  description: "Include archived items",
};

// Enum (string with fixed options)
const enumField: JSONSchemaProperty = {
  type: "string",
  enum: ["low", "medium", "high", "urgent"],
  description: "Priority level",
};

// Array
const arrayField: JSONSchemaProperty = {
  type: "array",
  items: { type: "string", format: "email" },
  description: "Recipient email addresses",
  minItems: 1,
  maxItems: 50,
};

// Nested object
const objectField: JSONSchemaProperty = {
  type: "object",
  properties: {
    name: { type: "string" },
    value: { type: "number" },
  },
  required: ["name"],
};

// Build the complete schema
const schema = objectSchema(
  {
    title: stringField,
    priority: enumField,
    recipients: arrayField,
  },
  ["title"]  // Required fields
);
```

### Writing Effective `whenToUse`

The `whenToUse` field is critical for LLM tool selection. Follow these guidelines:

```typescript
whenToUse: `Use when the user wants to:
- Primary use case with specific trigger phrases
- Secondary use case with different trigger phrases
- [Include 3-5 common scenarios]

Key indicators:
- Specific words/phrases that indicate this tool (e.g., "schedule", "meeting")
- Context clues (e.g., "next week" suggests calendar)

Do NOT use for:
- Explicitly state what this tool is NOT for
- Mention which tool to use instead if relevant

This tool [does X]. It [requires Y context]. [Any other important notes].`,
```

### Writing Good Examples

Examples use few-shot learning format:

```typescript
examples: [
  // Format: 'User: "quoted user message" → tool_name({ explicit_params })'
  'User: "Schedule a meeting with John tomorrow at 2pm" → create_calendar_event({ title: "Meeting with John", startTime: "2024-01-16T14:00:00", duration: 60 })',
  'User: "What meetings do I have this week?" → list_calendar_events({ startDate: "2024-01-15", endDate: "2024-01-21" })',
  // Include edge cases
  'User: "Block off Friday afternoon" → create_calendar_event({ title: "Blocked", startTime: "2024-01-19T13:00:00", duration: 240 })',
],
```

---

## Validation & Execution

### Zod Schema Design

The `inputValidator` Zod schema must match the JSON Schema in `parametersSchema`:

```typescript
import { z } from "zod";
import { DateTime } from "luxon";

const myToolInputSchema = z.object({
  // Required field
  title: z.string().min(1, "Title is required").max(500),
  
  // Optional with default
  limit: z.number().int().min(1).max(100).optional().default(20),
  
  // Date validation with Luxon
  startDate: z
    .string()
    .refine((val) => !val || DateTime.fromISO(val).isValid, {
      message: "Invalid date format. Use ISO 8601",
    })
    .optional(),
  
  // Email validation
  email: z.string().email("Invalid email address"),
  
  // Enum validation
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  
  // Array with item validation
  tags: z.array(z.string().max(50)).max(20).optional(),
  
  // Complex nested object
  options: z.object({
    includeArchived: z.boolean().optional(),
    sortBy: z.enum(["date", "name", "priority"]).optional(),
  }).optional(),
});
```

### Execution Context

The `execute` function receives an `ExecutionContext`:

```typescript
interface ExecutionContext {
  userId: string;          // Current user's ID
  sessionId?: string;      // Session ID
  conversationId?: string; // Conversation ID
  planId?: string;         // Plan ID (if part of a multi-step plan)
  stepIndex?: number;      // Step index in plan
}
```

### Error Handling

```typescript
execute: async (input, context) => {
  try {
    // Validate preconditions
    if (!await checkPrecondition(context.userId)) {
      throw new Error("Precondition not met: reason");
    }
    
    // Execute the action
    const result = await performAction(input);
    
    return {
      success: true,
      result,
      message: "Action completed successfully",
    };
  } catch (error) {
    // Errors are caught by the execution engine
    // They're logged and reported to the LLM for recovery
    throw error;
  }
}
```

---

## Approval Flow

For high-risk actions that require user approval:

### 1. Configure the Tool

```typescript
{
  category: "external",
  riskLevel: "high",
  requiresApproval: true,
  requiredIntegrations: ["gmail"],
}
```

### 2. Create Approval in Execute

```typescript
execute: async (input, context) => {
  // Create a draft/pending state
  const draft = await createDraft(input);
  
  // Request approval (stores in database)
  const approval = await requestApproval(context.userId, {
    actionType: "send_email",
    toolName: "send_email",
    parameters: input,
    draftId: draft.id,
    reasoning: input.sendReason || "User requested to send email",
    riskLevel: "high",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  });
  
  return {
    success: true,
    requiresApproval: true,
    approval: {
      id: approval.id,
      draftId: draft.id,
      expiresAt: approval.expiresAt.toISOString(),
    },
    message: "Created for your approval. Please review before sending.",
  };
}
```

### 3. Approval Response to LLM

The execution result tells the LLM an approval is pending:

```typescript
// The LLM sees this in tool results
{
  toolName: "send_email",
  success: true,
  requiresApproval: true,
  approvalId: "approval-123",
}
```

The LLM then generates a response like:
> "I've drafted an email to john@example.com. Please review and approve it to send."

---

## Testing Tools

### Test File Structure

```typescript
// tests/lib/agent/my-tools.test.ts

import { describe, it, expect, beforeEach, vi } from "vitest";
import { myNewTool, toToolForLLM, validateToolParams } from "@/lib/agent/tools";
import type { ExecutionContext } from "@/lib/agent/types";

// Mock dependencies
vi.mock("@/services/my-service", () => ({
  myService: {
    search: vi.fn().mockResolvedValue([...]),
  },
}));

describe("myNewTool", () => {
  const mockContext: ExecutionContext = {
    userId: "user-123",
    sessionId: "session-456",
    conversationId: "conv-789",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Tool Definition", () => {
    it("should have correct metadata", () => {
      expect(myNewTool.name).toBe("my_tool_name");
      expect(myNewTool.category).toBe("query");
      expect(myNewTool.riskLevel).toBe("low");
      expect(myNewTool.requiresApproval).toBe(false);
    });

    it("should have whenToUse guidance", () => {
      expect(myNewTool.whenToUse).toContain("Use when");
      expect(myNewTool.whenToUse.length).toBeGreaterThan(50);
    });

    it("should have examples", () => {
      expect(myNewTool.examples.length).toBeGreaterThan(0);
      expect(myNewTool.examples[0]).toContain("→");
    });
  });

  describe("LLM Interface", () => {
    it("should convert to ToolForLLM format", () => {
      const llmTool = toToolForLLM(myNewTool);
      
      expect(llmTool).toHaveProperty("name");
      expect(llmTool).toHaveProperty("description");
      expect(llmTool).toHaveProperty("whenToUse");
      expect(llmTool).toHaveProperty("parameters");
      expect(llmTool.parameters).toHaveProperty("type", "object");
    });
  });

  describe("Parameter Validation", () => {
    it("should accept valid parameters", () => {
      const result = validateToolParams(myNewTool, {
        query: "test query",
        limit: 10,
      });
      
      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it("should reject missing required fields", () => {
      const result = validateToolParams(myNewTool, {});
      
      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({ path: "query" })
      );
    });

    it("should apply defaults for optional fields", () => {
      const result = validateToolParams(myNewTool, { query: "test" });
      
      expect(result.success).toBe(true);
      expect(result.data?.limit).toBe(10); // default value
    });
  });

  describe("Execution", () => {
    it("should execute successfully with valid input", async () => {
      const result = await myNewTool.execute(
        { query: "test", limit: 5, includeDrafts: false },
        mockContext
      );
      
      expect(result.success).toBe(true);
      expect(result.results).toBeDefined();
    });

    it("should handle errors gracefully", async () => {
      // Mock an error
      vi.mocked(myService.search).mockRejectedValueOnce(new Error("Service error"));
      
      await expect(
        myNewTool.execute({ query: "test" }, mockContext)
      ).rejects.toThrow("Service error");
    });
  });
});
```

### Running Tests

```bash
# Run all agent tool tests
npm test -- tests/lib/agent/

# Run specific tool tests
npm test -- tests/lib/agent/my-tools.test.ts

# Run with coverage
npm test -- --coverage tests/lib/agent/
```

---

## Registration & Discovery

### Registering a Tool

#### Option 1: Add to Existing Category

```typescript
// src/lib/agent/tools/query/index.ts

import { myNewQueryTool } from "./my-new-query-tool";

// Add to exports
export { myNewQueryTool } from "./my-new-query-tool";

// Add to array
export const queryTools: AnyToolDefinition[] = [
  queryContextTool,
  searchEmailsTool,
  myNewQueryTool,  // Add here
  // ...
];
```

#### Option 2: Create New Category

```typescript
// src/lib/agent/tools/workflow/index.ts

import { toolRegistry } from "../registry";
import type { AnyToolDefinition } from "../types";

export { workflowTool1 } from "./workflow-tool-1";
export { workflowTool2 } from "./workflow-tool-2";

export const workflowTools: AnyToolDefinition[] = [
  workflowTool1,
  workflowTool2,
];

export function registerWorkflowTools(): void {
  toolRegistry.registerAll(workflowTools);
}
```

Then update main index:

```typescript
// src/lib/agent/tools/index.ts

export { registerWorkflowTools, workflowTools } from "./workflow";

// Update registerAllTools
export function registerAllTools(): void {
  registerQueryTools();
  registerActionTools();
  registerWorkflowTools();  // Add new category
}
```

### Initializing at Startup

Tools are registered during application startup in `instrumentation.ts` or during worker initialization:

```typescript
// Somewhere in startup code
import { registerAllTools } from "@/lib/agent/tools";

registerAllTools();
```

---

## Example: Complete Tool Implementation

Here's a complete example of a **Slack Message Tool**:

```typescript
// src/lib/agent/tools/action/send-slack-message.ts

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { defineTool, objectSchema } from "../types";
import { sendSlackMessage } from "@/integrations/slack";
import { getValidAccessToken } from "@/lib/auth/token-refresh";

// ─────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────

const sendSlackMessageInputSchema = z.object({
  channel: z.string().min(1, "Channel is required"),
  message: z.string().min(1, "Message is required").max(4000),
  threadTs: z.string().optional(),
  mentionUsers: z.array(z.string()).max(10).optional(),
});

type SendSlackMessageInput = z.infer<typeof sendSlackMessageInputSchema>;

interface SendSlackMessageOutput {
  success: boolean;
  requiresApproval: boolean;
  messageId?: string;
  channel: string;
  message: string;
}

// ─────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────

export const sendSlackMessageTool: ToolDefinition<
  SendSlackMessageInput,
  SendSlackMessageOutput
> = defineTool({
  // ═══════════════════════════════════════════════════════════
  // LLM Interface
  // ═══════════════════════════════════════════════════════════
  name: "send_slack_message",
  description: "Send a message to a Slack channel (requires approval)",

  whenToUse: `Use when the user explicitly wants to send a message to Slack:
- "Post to #general that the meeting is cancelled"
- "Send a message to the team channel"
- "Reply in the thread about the bug"
- "Notify #engineering about the deploy"

Key indicators:
- Words like "Slack", "post", "notify", "channel", "#channel-name"
- Context about team communication

Do NOT use for:
- Email communication (use send_email)
- Internal notes or tasks (use create_task)
- When user just wants to draft/compose (not send)

This creates a message request that requires user approval before posting.`,

  examples: [
    'User: "Post to #general that I\'ll be out tomorrow" → send_slack_message({ channel: "general", message: "I\'ll be out of office tomorrow" })',
    'User: "Reply in the deployment thread that it\'s complete" → send_slack_message({ channel: "engineering", message: "Deployment complete!", threadTs: "..." })',
    'User: "Notify @john and @jane in #team about the update" → send_slack_message({ channel: "team", message: "...", mentionUsers: ["john", "jane"] })',
  ],

  parametersSchema: objectSchema(
    {
      channel: {
        type: "string",
        description: "Slack channel name (without #) or channel ID",
        minLength: 1,
      },
      message: {
        type: "string",
        description: "Message content to send",
        minLength: 1,
        maxLength: 4000,
      },
      threadTs: {
        type: "string",
        description: "Thread timestamp for replies (optional)",
      },
      mentionUsers: {
        type: "array",
        items: { type: "string" },
        description: "Users to @mention in the message",
      },
    },
    ["channel", "message"]
  ),

  // ═══════════════════════════════════════════════════════════
  // Internal Configuration
  // ═══════════════════════════════════════════════════════════
  category: "external",
  riskLevel: "high",
  requiresApproval: true,
  requiredIntegrations: ["slack"],

  // ═══════════════════════════════════════════════════════════
  // Validation & Execution
  // ═══════════════════════════════════════════════════════════
  inputValidator: sendSlackMessageInputSchema,

  execute: async (input, context): Promise<SendSlackMessageOutput> => {
    const { channel, message, threadTs, mentionUsers } = input;

    // Get OAuth token
    const accessToken = await getValidAccessToken(context.userId, "slack");
    if (!accessToken) {
      throw new Error("Slack not connected. Please connect Slack in settings.");
    }

    // Format mentions into message
    let formattedMessage = message;
    if (mentionUsers && mentionUsers.length > 0) {
      const mentions = mentionUsers.map((u) => `@${u}`).join(" ");
      formattedMessage = `${mentions} ${message}`;
    }

    // For high-risk actions, create approval request
    // (In a real implementation, this would create an approval record)
    
    // Here we'd normally create a pending message and return approval info
    // For this example, we'll show the approval pattern:
    
    return {
      success: true,
      requiresApproval: true,
      channel,
      message: `Created Slack message for #${channel} awaiting your approval: "${formattedMessage.substring(0, 50)}..."`,
    };
  },
});
```

---

## Best Practices

### 1. Naming Conventions

- Tool names: `snake_case` (e.g., `query_context`, `create_task`)
- Be specific: `send_email` not `email`, `list_calendar_events` not `calendar`
- Action verbs: `create_`, `update_`, `delete_`, `query_`, `list_`, `search_`

### 2. Description Quality

```typescript
// ❌ Bad
description: "Handles emails"

// ✅ Good
description: "Send an email to one or more recipients (requires user approval before sending)"
```

### 3. `whenToUse` Completeness

- Include 3-5 positive scenarios
- Include explicit "Do NOT use for" guidance
- Reference related tools when relevant
- Explain what the tool returns

### 4. Parameter Design

```typescript
// ❌ Bad - vague, no validation
data: z.any()

// ✅ Good - specific, well-validated
recipients: z.array(z.string().email()).min(1).max(50)
```

### 5. Error Messages

```typescript
// ❌ Bad
z.string().min(1)

// ✅ Good
z.string().min(1, "Email subject is required")
```

### 6. Output Structure

```typescript
// Always include:
interface ToolOutput {
  success: boolean;           // Did it work?
  message: string;            // Human-readable result
  // ... specific result data
  
  // For approval flows:
  requiresApproval?: boolean;
  approvalId?: string;
}
```

### 7. Integration with Services

```typescript
// ❌ Bad - direct database access
const result = await db.task.findMany({ where: { userId } });

// ✅ Good - use service layer
const result = await listTasks(userId, options, auditContext);
```

### 8. Audit Context

```typescript
// Pass audit context for traceability
await createTask(
  context.userId,
  taskData,
  {
    userId: context.userId,
    sessionId: context.sessionId,
    conversationId: context.conversationId,
  }
);
```

---

## Integration Checklist

When adding a new tool, verify:

- [ ] Tool definition implements all `ToolDefinition` interface fields
- [ ] `name` is unique and follows `snake_case` convention
- [ ] `description` is clear and concise
- [ ] `whenToUse` provides comprehensive guidance
- [ ] `examples` show realistic usage patterns
- [ ] `parametersSchema` matches `inputValidator` exactly
- [ ] `category` and `riskLevel` are appropriate
- [ ] `requiresApproval` is set correctly for risk level
- [ ] `requiredIntegrations` lists all dependencies
- [ ] `execute` function handles errors appropriately
- [ ] Tool is exported from its category's `index.ts`
- [ ] Tool is added to the category's tools array
- [ ] Tests cover definition, validation, and execution
- [ ] Documentation is updated if needed

---

## Future Extensions

The tool system is designed for extensibility:

### Planned Tool Categories

1. **Workflow Tools**: Multi-step automation triggers
2. **Learning Tools**: User preference capture and learning
3. **Integration Tools**: Third-party service connectors
4. **Analytics Tools**: Usage and productivity insights

### Extension Points

- Custom validation functions
- Conditional tool availability
- Tool composition (tools that call other tools)
- Async/long-running tool execution
- Tool versioning for backwards compatibility

---

## Resources

- **Phase 5 Chunk Plan**: `docs/build-docs/phase-5/PHASE_5_CHUNK_PLAN.md`
- **Agent Engine Docs**: `docs/services/AGENT_ENGINE.md`
- **LLM Types**: `src/lib/agent/llm/types.ts`
- **Existing Tools**: `src/lib/agent/tools/`
- **Tool Tests**: `tests/lib/agent/`

