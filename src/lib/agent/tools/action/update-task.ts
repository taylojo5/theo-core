// ═══════════════════════════════════════════════════════════════════════════
// Update Task Tool
// Action tool for modifying existing tasks in the user's context
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { defineTool, objectSchema } from "../types";
import { updateTask, getTaskById } from "@/services/context";
import type { TaskStatus, TaskPriority } from "@/services/context/types";
import { DateTime } from "luxon";

// ─────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────

/** Valid task priorities */
const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

/** Valid task statuses */
const TASK_STATUSES = ["pending", "in_progress", "completed", "cancelled", "deferred"] as const;

/** Input schema for task update */
const updateTaskInputSchema = z.object({
  taskId: z.string().uuid("Invalid task ID format"),
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  dueDate: z
    .string()
    .refine((val) => !val || DateTime.fromISO(val).isValid, {
      message: "Invalid date format. Use ISO 8601 (e.g., 2024-01-15 or 2024-01-15T14:00:00)",
    })
    .optional()
    .nullable(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  notes: z.string().max(10000).optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  estimatedMinutes: z.number().int().min(1).max(10080).optional().nullable(),
  actualMinutes: z.number().int().min(0).max(100000).optional().nullable(),
});

type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>;

/** Output type for task update */
interface UpdateTaskOutput {
  success: boolean;
  task: {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority: string;
    dueDate?: string;
    tags: string[];
    completedAt?: string;
  };
  changes: string[];
  message: string;
}

// ─────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────

export const updateTaskTool: ToolDefinition<UpdateTaskInput, UpdateTaskOutput> = defineTool({
  // ═══════════════════════════════════════════════════════════
  // LLM Interface
  // ═══════════════════════════════════════════════════════════
  name: "update_task",
  description: "Update or modify an existing task",

  whenToUse: `Use when the user wants to:
- Complete a task: "Mark X as done", "I finished X", "Complete the task"
- Change task details: "Change the due date to...", "Update the priority"
- Reschedule: "Move the deadline to...", "Postpone X"
- Update status: "Start working on X", "Defer X", "Cancel the task"
- Add notes or details: "Add a note to the task"

Requires a task ID from prior context or a list_tasks query.
Do NOT use to create new tasks (use create_task instead).`,

  examples: [
    'User: "Mark the report task as done" → update_task({ taskId: "...", status: "completed" })',
    'User: "Change the deadline to Friday" → update_task({ taskId: "...", dueDate: "2024-01-19" })',
    'User: "Make it high priority" → update_task({ taskId: "...", priority: "high" })',
    'User: "I started working on it" → update_task({ taskId: "...", status: "in_progress" })',
    'User: "Defer the task" → update_task({ taskId: "...", status: "deferred" })',
    'User: "Clear the due date" → update_task({ taskId: "...", dueDate: null })',
  ],

  parametersSchema: objectSchema(
    {
      taskId: {
        type: "string",
        format: "uuid",
        description: "The ID of the task to update",
      },
      title: {
        type: "string",
        description: "New title for the task",
        minLength: 1,
        maxLength: 500,
      },
      description: {
        type: "string",
        description: "New description (null to clear)",
        maxLength: 5000,
      },
      dueDate: {
        type: "string",
        format: "date",
        description: "New due date (null to clear)",
      },
      priority: {
        type: "string",
        enum: [...TASK_PRIORITIES],
        description: "New priority level",
      },
      status: {
        type: "string",
        enum: [...TASK_STATUSES],
        description: "New status",
      },
      notes: {
        type: "string",
        description: "Updated notes (null to clear)",
        maxLength: 10000,
      },
      tags: {
        type: "array",
        items: { type: "string", maxLength: 50 },
        description: "New set of tags (replaces existing)",
      },
      estimatedMinutes: {
        type: "integer",
        description: "Updated estimated time (null to clear)",
        minimum: 1,
        maximum: 10080,
      },
      actualMinutes: {
        type: "integer",
        description: "Actual time spent in minutes",
        minimum: 0,
        maximum: 100000,
      },
    },
    ["taskId"] // taskId is required
  ),

  // ═══════════════════════════════════════════════════════════
  // Internal Configuration
  // ═══════════════════════════════════════════════════════════
  category: "update",
  riskLevel: "medium",
  requiresApproval: false, // Tasks are internal, can auto-execute with confirmation
  requiredIntegrations: [], // Works with built-in context

  // ═══════════════════════════════════════════════════════════
  // Validation & Execution
  // ═══════════════════════════════════════════════════════════
  inputValidator: updateTaskInputSchema,

  execute: async (input, context): Promise<UpdateTaskOutput> => {
    const { taskId, ...updates } = input;

    // Verify task exists
    const existingTask = await getTaskById(context.userId, taskId);
    if (!existingTask) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Track what's being changed
    const changes: string[] = [];

    // Parse due date if provided
    let parsedDueDate: Date | undefined;
    let clearDueDate = false;
    if (updates.dueDate !== undefined) {
      if (updates.dueDate === null) {
        clearDueDate = true;
        changes.push("cleared due date");
      } else {
        const dt = DateTime.fromISO(updates.dueDate);
        if (dt.isValid) {
          parsedDueDate = dt.toJSDate();
          changes.push(`due date → ${dt.toLocaleString(DateTime.DATE_MED)}`);
        }
      }
    }

    // Track if this is a completion (for special messaging)
    const isCompletion = updates.status === "completed" && existingTask.status !== "completed";

    // Track other changes
    if (updates.title && updates.title !== existingTask.title) {
      changes.push(`title → "${updates.title}"`);
    }
    if (updates.priority && updates.priority !== existingTask.priority) {
      changes.push(`priority → ${updates.priority}`);
    }
    if (updates.status && updates.status !== existingTask.status) {
      changes.push(`status → ${updates.status}`);
    }
    if (updates.description !== undefined && updates.description !== existingTask.description) {
      changes.push(updates.description === null ? "cleared description" : "updated description");
    }
    if (updates.notes !== undefined && updates.notes !== existingTask.notes) {
      changes.push(updates.notes === null ? "cleared notes" : "updated notes");
    }
    if (updates.tags !== undefined) {
      // Compare tags arrays - check if they're actually different
      const existingTags = existingTask.tags || [];
      const newTags = updates.tags || [];
      const tagsChanged = 
        existingTags.length !== newTags.length ||
        !existingTags.every((tag, i) => newTags[i] === tag);
      
      if (tagsChanged) {
        if (newTags.length === 0) {
          changes.push("cleared tags");
        } else {
          changes.push("updated tags");
        }
      }
    }
    if (updates.estimatedMinutes !== undefined) {
      if (updates.estimatedMinutes === null) {
        changes.push("cleared estimated time");
      } else {
        changes.push(`estimated time → ${updates.estimatedMinutes} minutes`);
      }
    }
    if (updates.actualMinutes !== undefined) {
      if (updates.actualMinutes === null) {
        changes.push("cleared actual time");
      } else {
        changes.push(`actual time → ${updates.actualMinutes} minutes`);
      }
    }

    // Build update data - convert null to undefined for service compatibility
    const updateData = {
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description ?? undefined }),
      ...(parsedDueDate !== undefined && { dueDate: parsedDueDate }),
      ...(clearDueDate && { dueDate: undefined }),
      ...(updates.priority !== undefined && { priority: updates.priority as TaskPriority }),
      ...(updates.status !== undefined && { status: updates.status as TaskStatus }),
      ...(updates.notes !== undefined && { notes: updates.notes ?? undefined }),
      ...(updates.tags !== undefined && { tags: updates.tags }),
      ...(updates.estimatedMinutes !== undefined && { estimatedMinutes: updates.estimatedMinutes ?? undefined }),
      ...(updates.actualMinutes !== undefined && { actualMinutes: updates.actualMinutes ?? undefined }),
    };

    // Perform the update
    const task = await updateTask(context.userId, taskId, updateData, {
      userId: context.userId,
      sessionId: context.sessionId,
      conversationId: context.conversationId,
    });

    // Build response message with friendlier completion wording
    let message: string;
    if (isCompletion) {
      // Replace "status → completed" with friendlier "marked as completed"
      const friendlyChanges = changes.map(c => 
        c === "status → completed" ? "marked as completed" : c
      );
      message = friendlyChanges.length === 1 && friendlyChanges[0] === "marked as completed"
        ? `Completed task: "${task.title}"`
        : `Updated "${task.title}": ${friendlyChanges.join(", ")}`;
    } else if (changes.length > 0) {
      message = `Updated "${task.title}": ${changes.join(", ")}`;
    } else {
      message = `Task "${task.title}" unchanged (no updates specified)`;
    }

    // Use friendlier wording for completion in the changes array too
    const finalChanges = isCompletion
      ? changes.map(c => c === "status → completed" ? "marked as completed" : c)
      : changes;

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
        completedAt: task.completedAt?.toISOString(),
      },
      changes: finalChanges,
      message,
    };
  },
});


