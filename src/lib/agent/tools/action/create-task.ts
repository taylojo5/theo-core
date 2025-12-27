// ═══════════════════════════════════════════════════════════════════════════
// Create Task Tool
// Action tool for creating new tasks in the user's context
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { defineTool, objectSchema } from "../types";
import { createTask } from "@/services/context";
import type { TaskStatus, TaskPriority } from "@/services/context/types";
import { DateTime } from "luxon";

// ─────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────

/** Valid task priorities */
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

/** Valid task statuses for creation */
const TASK_STATUSES = ["pending", "in_progress"] as const;

/** Input schema for task creation */
const createTaskInputSchema = z.object({
  title: z.string().min(1, "Task title is required").max(500),
  description: z.string().max(5000).optional(),
  dueDate: z
    .string()
    .refine((val) => !val || DateTime.fromISO(val).isValid, {
      message: "Invalid date format. Use ISO 8601 (e.g., 2024-01-15 or 2024-01-15T14:00:00)",
    })
    .optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  notes: z.string().max(10000).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  estimatedMinutes: z.number().int().min(1).max(10080).optional(), // Max 1 week
});

type CreateTaskInput = z.infer<typeof createTaskInputSchema>;

/** Output type for task creation */
interface CreateTaskOutput {
  success: boolean;
  task: {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    dueDate?: string;
    tags: string[];
    estimatedMinutes?: number;
  };
  message: string;
}

// ─────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────

export const createTaskTool: ToolDefinition<CreateTaskInput, CreateTaskOutput> = defineTool({
  // ═══════════════════════════════════════════════════════════
  // LLM Interface
  // ═══════════════════════════════════════════════════════════
  name: "create_task",
  description: "Create a new task or to-do item for the user",

  whenToUse: `Use when the user wants to:
- Add a new task: "Add a task to...", "Create a task for..."
- Remember something to do: "Remind me to...", "Don't let me forget to..."
- Set up a to-do item: "I need to...", "Put on my list..."
- Track something: "Make note to...", "Add to my tasks..."

This creates a task in the user's personal task list.
Do NOT use for calendar events (use create_calendar_event instead).`,

  examples: [
    'User: "Remind me to call John tomorrow" → create_task({ title: "Call John", dueDate: "2024-01-16" })',
    'User: "Add a task to review the proposal" → create_task({ title: "Review the proposal" })',
    'User: "I need to buy groceries, high priority" → create_task({ title: "Buy groceries", priority: "high" })',
    'User: "Add \'finish report\' to my tasks, due Friday" → create_task({ title: "Finish report", dueDate: "2024-01-19" })',
    'User: "Create a task: prepare presentation, about 2 hours work" → create_task({ title: "Prepare presentation", estimatedMinutes: 120 })',
  ],

  parametersSchema: objectSchema(
    {
      title: {
        type: "string",
        description: "The task title or what needs to be done",
        minLength: 1,
        maxLength: 500,
      },
      description: {
        type: "string",
        description: "Additional details about the task",
        maxLength: 5000,
      },
      dueDate: {
        type: "string",
        format: "date",
        description: "When the task is due (ISO 8601 date or datetime)",
      },
      priority: {
        type: "string",
        enum: [...TASK_PRIORITIES],
        description: "Task priority level (default: medium)",
      },
      status: {
        type: "string",
        enum: [...TASK_STATUSES],
        description: "Initial status (default: pending)",
      },
      notes: {
        type: "string",
        description: "Additional notes or context for the task",
        maxLength: 10000,
      },
      tags: {
        type: "array",
        items: { type: "string", maxLength: 50 },
        description: "Tags or labels for categorization",
      },
      estimatedMinutes: {
        type: "integer",
        description: "Estimated time to complete in minutes",
        minimum: 1,
        maximum: 10080,
      },
    },
    ["title"] // title is required
  ),

  // ═══════════════════════════════════════════════════════════
  // Internal Configuration
  // ═══════════════════════════════════════════════════════════
  category: "create",
  riskLevel: "medium",
  requiresApproval: false, // Tasks are internal, can auto-execute with confirmation
  requiredIntegrations: [], // Works with built-in context

  // ═══════════════════════════════════════════════════════════
  // Validation & Execution
  // ═══════════════════════════════════════════════════════════
  inputValidator: createTaskInputSchema,

  execute: async (input, context): Promise<CreateTaskOutput> => {
    const { title, description, dueDate, notes, tags, estimatedMinutes } = input;
    // Apply defaults for optional fields
    const priority = input.priority ?? "medium";
    const status = input.status ?? "pending";

    // Parse due date if provided
    let parsedDueDate: Date | undefined;
    if (dueDate) {
      const dt = DateTime.fromISO(dueDate);
      if (dt.isValid) {
        parsedDueDate = dt.toJSDate();
      }
    }

    // Create the task
    const task = await createTask(
      context.userId,
      {
        title,
        description,
        dueDate: parsedDueDate,
        priority: priority as TaskPriority,
        status: status as TaskStatus,
        notes,
        tags,
        estimatedMinutes,
        source: "manual", // Tasks from agent are considered manual
      },
      {
        userId: context.userId,
        sessionId: context.sessionId,
        conversationId: context.conversationId,
      }
    );

    // Build response message
    let message = `Created task: "${task.title}"`;
    if (parsedDueDate) {
      const formattedDate = DateTime.fromJSDate(parsedDueDate).toLocaleString(DateTime.DATE_MED);
      message += ` (due ${formattedDate})`;
    }
    if (priority !== "medium") {
      message += `, ${priority} priority`;
    }

    return {
      success: true,
      task: {
        id: task.id,
        title: task.title,
        description: task.description ?? undefined,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate?.toISOString(),
        tags: task.tags,
        estimatedMinutes: task.estimatedMinutes ?? undefined,
      },
      message,
    };
  },
});


