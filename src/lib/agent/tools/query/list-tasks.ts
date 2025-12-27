// ═══════════════════════════════════════════════════════════════════════════
// List Tasks Tool
// Query user's tasks with filters for status, priority, and due dates
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { defineTool, objectSchema } from "../types";
import {
  listTasks,
  searchTasks,
  getOverdueTasks,
  getTasksDueSoon,
  getTasksDueOnDate,
} from "@/services/context";
import type { TaskStatus, TaskPriority } from "@/services/context/types";

// ─────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────

/** Valid task statuses - matches TaskStatus from context/types */
const TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled", "deferred"] as const;

/** Valid task priorities */
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

/** Input schema for task query */
const listTasksInputSchema = z.object({
  query: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  dueBefore: z.string().refine(
    (val) => !val || !isNaN(new Date(val).getTime()),
    { message: "Invalid date format" }
  ).optional(),
  dueAfter: z.string().refine(
    (val) => !val || !isNaN(new Date(val).getTime()),
    { message: "Invalid date format" }
  ).optional(),
  showOverdue: z.boolean().optional().default(false),
  showDueSoon: z.boolean().optional().default(false),
  dueSoonDays: z.number().int().min(1).max(30).optional().default(7),
  includeSubtasks: z.boolean().optional().default(false),
  limit: z.number().int().min(1).max(50).optional().default(20),
});

type ListTasksInput = z.infer<typeof listTasksInputSchema>;

/** Output type for task query */
interface ListTasksOutput {
  tasks: TaskResult[];
  totalCount: number;
  hasMore: boolean;
  summary: string;
}

/** Individual task result */
interface TaskResult {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: string;
  isOverdue: boolean;
  completedAt?: string;
  parentId?: string;
  tags: string[];
}

// ─────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────

export const listTasksTool: ToolDefinition<ListTasksInput, ListTasksOutput> = defineTool({
  // ═══════════════════════════════════════════════════════════
  // LLM Interface
  // ═══════════════════════════════════════════════════════════
  name: "list_tasks",
  description: "Query user's tasks with filters for status, priority, and due dates",

  whenToUse: `Use when the user asks about:
- Their tasks: "What tasks do I have?", "Show my to-do list"
- Specific statuses: "Show incomplete tasks", "What's in progress?"
- Due dates: "Tasks due today", "What's overdue?"
- Priorities: "High priority tasks", "Urgent items"
- Task search: "Find tasks about the project"

This queries tasks stored in the user's context.`,

  examples: [
    'User: "What tasks do I have?" → list_tasks({})',
    'User: "Show me overdue tasks" → list_tasks({ showOverdue: true })',
    'User: "What\'s due this week?" → list_tasks({ showDueSoon: true, dueSoonDays: 7 })',
    'User: "High priority items" → list_tasks({ priority: "high" })',
    'User: "Find tasks about budget" → list_tasks({ query: "budget" })',
    'User: "Show completed tasks" → list_tasks({ status: "completed" })',
  ],

  parametersSchema: objectSchema(
    {
      query: {
        type: "string",
        description: "Text search in task title, description, or notes",
      },
      status: {
        type: "string",
        enum: [...TASK_STATUSES],
        description: "Filter by task status",
      },
      priority: {
        type: "string",
        enum: [...TASK_PRIORITIES],
        description: "Filter by priority level",
      },
      dueBefore: {
        type: "string",
        format: "date",
        description: "Show tasks due before this date",
      },
      dueAfter: {
        type: "string",
        format: "date",
        description: "Show tasks due after this date",
      },
      showOverdue: {
        type: "boolean",
        description: "Show only overdue tasks (default false)",
      },
      showDueSoon: {
        type: "boolean",
        description: "Show tasks due within dueSoonDays (default false)",
      },
      dueSoonDays: {
        type: "integer",
        description: "Days to look ahead for showDueSoon (1-30, default 7)",
        minimum: 1,
        maximum: 30,
      },
      includeSubtasks: {
        type: "boolean",
        description: "Include subtasks in results (default false)",
      },
      limit: {
        type: "integer",
        description: "Maximum results to return (1-50, default 20)",
        minimum: 1,
        maximum: 50,
      },
    },
    [] // No required fields
  ),

  // ═══════════════════════════════════════════════════════════
  // Internal Configuration
  // ═══════════════════════════════════════════════════════════
  category: "query",
  riskLevel: "low",
  requiresApproval: false,
  requiredIntegrations: [], // Works with built-in context

  // ═══════════════════════════════════════════════════════════
  // Validation & Execution
  // ═══════════════════════════════════════════════════════════
  inputValidator: listTasksInputSchema,

  execute: async (input, context) => {
    const {
      query,
      status,
      priority,
      dueBefore,
      dueAfter,
      showOverdue,
      showDueSoon,
      dueSoonDays,
      includeSubtasks,
      limit,
    } = input;

    let tasks;
    let total = 0;
    let hasMore = false;

    // Use specialized functions for overdue/due soon
    if (showOverdue) {
      tasks = await getOverdueTasks(context.userId, limit);
      total = tasks.length;
      // Heuristic: if we got exactly the limit, there might be more
      hasMore = tasks.length === limit;
    } else if (showDueSoon) {
      tasks = await getTasksDueSoon(context.userId, dueSoonDays, limit);
      total = tasks.length;
      hasMore = tasks.length === limit;
    } else if (query) {
      // Text search
      tasks = await searchTasks(context.userId, query, {
        limit,
        includeSubtasks,
      });
      total = tasks.length;
      hasMore = tasks.length === limit;
    } else {
      // General list with filters - use service pagination info
      const result = await listTasks(context.userId, {
        status: status as TaskStatus | undefined,
        priority: priority as TaskPriority | undefined,
        dueBefore: dueBefore ? new Date(dueBefore) : undefined,
        dueAfter: dueAfter ? new Date(dueAfter) : undefined,
        includeSubtasks,
        limit,
      });
      tasks = result.items;
      total = result.totalCount ?? result.items.length;
      hasMore = result.hasMore;
    }

    const now = new Date();

    // Map results to output format
    // Statuses that should not be marked as overdue (terminal/inactive statuses)
    const nonOverdueStatuses = ["completed", "cancelled", "deferred"];
    
    const taskResults: TaskResult[] = tasks.map((task) => {
      const isOverdue = task.dueDate
        ? new Date(task.dueDate) < now && !nonOverdueStatuses.includes(task.status)
        : false;

      return {
        id: task.id,
        title: task.title,
        description: task.description ?? undefined,
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate?.toISOString(),
        isOverdue,
        completedAt: task.completedAt?.toISOString(),
        parentId: task.parentId ?? undefined,
        tags: task.tags,
      };
    });

    // Generate summary
    const overdueCount = taskResults.filter((t) => t.isOverdue).length;
    const summary = generateTaskSummary(taskResults, overdueCount, input);

    return {
      tasks: taskResults,
      totalCount: total,
      hasMore,
      summary,
    };
  },
});

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Generate a human-readable summary of the task query results
 */
function generateTaskSummary(
  tasks: TaskResult[],
  overdueCount: number,
  input: ListTasksInput
): string {
  if (tasks.length === 0) {
    if (input.showOverdue) {
      return "No overdue tasks. You're all caught up!";
    }
    if (input.showDueSoon) {
      return `No tasks due in the next ${input.dueSoonDays} days.`;
    }
    if (input.query) {
      return `No tasks found matching "${input.query}".`;
    }
    if (input.status) {
      return `No ${input.status} tasks found.`;
    }
    return "No tasks found.";
  }

  const parts: string[] = [];
  parts.push(`Found ${tasks.length} task(s)`);

  if (overdueCount > 0) {
    parts.push(`${overdueCount} overdue`);
  }

  const highPriority = tasks.filter(
    (t) => t.priority === "high" || t.priority === "urgent"
  ).length;
  if (highPriority > 0) {
    parts.push(`${highPriority} high priority`);
  }

  return parts.join(", ") + ".";
}


