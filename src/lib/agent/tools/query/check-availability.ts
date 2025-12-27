// ═══════════════════════════════════════════════════════════════════════════
// Check Availability Tool
// Find free time slots and check for scheduling conflicts
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import type { ToolDefinition } from "../types";
import { defineTool, objectSchema } from "../types";
import { calendarEventRepository } from "@/integrations/calendar/repository";

// ─────────────────────────────────────────────────────────────
// Input/Output Types
// ─────────────────────────────────────────────────────────────

/** Input schema for availability check */
const checkAvailabilityInputSchema = z.object({
  startDate: z.string().refine(
    (val) => !isNaN(new Date(val).getTime()),
    { message: "Invalid start date format" }
  ),
  endDate: z.string().refine(
    (val) => !isNaN(new Date(val).getTime()),
    { message: "Invalid end date format" }
  ).optional(),
  durationMinutes: z.number().int().min(15).max(480).optional().default(60),
  workingHoursStart: z.number().int().min(0).max(23).optional().default(9),
  workingHoursEnd: z.number().int().min(1).max(23).optional().default(17),
  excludeWeekends: z.boolean().optional().default(true),
}).refine(
  (data) => data.workingHoursEnd > data.workingHoursStart,
  {
    message: "workingHoursEnd must be greater than workingHoursStart",
    path: ["workingHoursEnd"],
  }
);

type CheckAvailabilityInput = z.infer<typeof checkAvailabilityInputSchema>;

/** Output type for availability check */
interface CheckAvailabilityOutput {
  date: string;
  freeSlots: FreeSlot[];
  busyPeriods: BusyPeriod[];
  totalFreeMinutes: number;
  summary: string;
}

/** A free time slot */
interface FreeSlot {
  start: string;
  end: string;
  durationMinutes: number;
}

/** A busy period */
interface BusyPeriod {
  start: string;
  end: string;
  title: string;
  allDay: boolean;
}

// ─────────────────────────────────────────────────────────────
// Tool Definition
// ─────────────────────────────────────────────────────────────

export const checkAvailabilityTool: ToolDefinition<CheckAvailabilityInput, CheckAvailabilityOutput> = defineTool({
  // ═══════════════════════════════════════════════════════════
  // LLM Interface
  // ═══════════════════════════════════════════════════════════
  name: "check_availability",
  description: "Find free time slots and check for scheduling conflicts",

  whenToUse: `Use when the user asks about:
- Free time: "When am I free tomorrow?", "Find me an hour to work on X"
- Availability: "Am I available at 2pm?", "Can I schedule a meeting?"
- Scheduling conflicts: "Do I have any conflicts tomorrow?"
- Finding meeting times: "When can I fit in a 30-minute call?"

This analyzes calendar events to find gaps and available time slots.`,

  examples: [
    'User: "When am I free tomorrow?" → check_availability({ startDate: "2024-01-16" })',
    'User: "Find me a 2-hour block this week" → check_availability({ startDate: "2024-01-15", endDate: "2024-01-19", durationMinutes: 120 })',
    'User: "Am I available for a 30-min call?" → check_availability({ startDate: "2024-01-15", durationMinutes: 30 })',
    'User: "Show my free time between 1pm and 6pm" → check_availability({ startDate: "2024-01-15", workingHoursStart: 13, workingHoursEnd: 18 })',
  ],

  parametersSchema: objectSchema(
    {
      startDate: {
        type: "string",
        format: "date",
        description: "Date to check availability (ISO format, required)",
      },
      endDate: {
        type: "string",
        format: "date",
        description: "End of date range (defaults to startDate for single day)",
      },
      durationMinutes: {
        type: "integer",
        description: "Minimum slot duration in minutes (15-480, default 60)",
        minimum: 15,
        maximum: 480,
      },
      workingHoursStart: {
        type: "integer",
        description: "Start of working hours in 24h format (0-23, default 9)",
        minimum: 0,
        maximum: 23,
      },
      workingHoursEnd: {
        type: "integer",
        description: "End of working hours in 24h format (1-23, default 17)",
        minimum: 1,
        maximum: 23,
      },
      excludeWeekends: {
        type: "boolean",
        description: "Exclude Saturday and Sunday (default true)",
      },
    },
    ["startDate"]
  ),

  // ═══════════════════════════════════════════════════════════
  // Internal Configuration
  // ═══════════════════════════════════════════════════════════
  category: "query",
  riskLevel: "low",
  requiresApproval: false,
  requiredIntegrations: ["calendar"],

  // ═══════════════════════════════════════════════════════════
  // Validation & Execution
  // ═══════════════════════════════════════════════════════════
  inputValidator: checkAvailabilityInputSchema,

  execute: async (input, context) => {
    const {
      startDate,
      endDate,
      durationMinutes,
      workingHoursStart,
      workingHoursEnd,
      excludeWeekends,
    } = input;

    // Parse dates - use UTC to avoid timezone drift
    const startDateTime = new Date(startDate);
    startDateTime.setUTCHours(0, 0, 0, 0);

    let endDateTime: Date;
    if (endDate) {
      endDateTime = new Date(endDate);
    } else {
      // Default to same day
      endDateTime = new Date(startDate);
    }
    endDateTime.setUTCHours(23, 59, 59, 999);

    // Determine if this is a single-day or multi-day query
    const isSingleDay = !endDate || startDate === endDate;

    // Check if date is weekend and we're excluding weekends
    // Only apply early rejection for single-day queries
    const dayOfWeek = startDateTime.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (excludeWeekends && isWeekend && isSingleDay) {
      return {
        date: startDate,
        freeSlots: [],
        busyPeriods: [],
        totalFreeMinutes: 0,
        summary: "Weekend day - excluded from availability check",
      };
    }

    // Get events for the date range
    const eventsResult = await calendarEventRepository.search(context.userId, {
      startDate: startDateTime,
      endDate: endDateTime,
      status: "confirmed",
      limit: 100,
      orderBy: "startsAt",
      orderDirection: "asc",
    });

    // Extract busy periods (non-all-day events)
    const busyPeriods: BusyPeriod[] = eventsResult.events
      .filter((e) => !e.allDay)
      .map((event) => ({
        start: event.startsAt.toISOString(),
        end: event.endsAt?.toISOString() ?? event.startsAt.toISOString(),
        title: event.title,
        allDay: false,
      }));

    // Add all-day events as full-day blockers
    const allDayEvents = eventsResult.events
      .filter((e) => e.allDay)
      .map((event) => ({
        start: event.startsAt.toISOString(),
        end: event.endsAt?.toISOString() ?? event.startsAt.toISOString(),
        title: event.title,
        allDay: true,
      }));

    // Calculate free slots within working hours for each day in the range
    const allFreeSlots: FreeSlot[] = [];
    const currentDate = new Date(startDateTime);
    
    // Iterate through each day in the range
    while (currentDate <= endDateTime) {
      const dayOfWeekCurrent = currentDate.getUTCDay();
      const isWeekendDay = dayOfWeekCurrent === 0 || dayOfWeekCurrent === 6;
      
      // Skip weekend days if excludeWeekends is true
      if (excludeWeekends && isWeekendDay) {
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
        continue;
      }
      
      // Set working hours for this specific day (use UTC for consistency)
      const dayWorkStart = new Date(currentDate);
      dayWorkStart.setUTCHours(workingHoursStart, 0, 0, 0);
      
      const dayWorkEnd = new Date(currentDate);
      dayWorkEnd.setUTCHours(workingHoursEnd, 0, 0, 0);
      
      // Filter busy periods that overlap with this day's working hours
      const dayBusyPeriods = busyPeriods.filter((b) => {
        const busyStart = new Date(b.start);
        const busyEnd = new Date(b.end);
        // Check if busy period overlaps with this day's working hours
        return busyStart < dayWorkEnd && busyEnd > dayWorkStart;
      });
      
      // Calculate free slots for this day
      const dayFreeSlots = calculateFreeSlots(
        dayBusyPeriods,
        dayWorkStart,
        dayWorkEnd,
        durationMinutes
      );
      
      allFreeSlots.push(...dayFreeSlots);
      
      // Move to next day
      currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    // Calculate total free time
    const totalFreeMinutes = allFreeSlots.reduce(
      (sum, slot) => sum + slot.durationMinutes,
      0
    );

    // Combine busy periods with all-day events for the response
    const allBusyPeriods = [...busyPeriods, ...allDayEvents];

    // Generate summary using the total count of busy periods (including all-day events)
    const summary = generateSummary(allFreeSlots, allBusyPeriods.length, totalFreeMinutes, durationMinutes);

    return {
      date: startDate,
      freeSlots: allFreeSlots,
      busyPeriods: allBusyPeriods,
      totalFreeMinutes,
      summary,
    };
  },
});

// ─────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────

/**
 * Calculate free slots between busy periods
 */
function calculateFreeSlots(
  busyPeriods: BusyPeriod[],
  workStart: Date,
  workEnd: Date,
  minDurationMinutes: number
): FreeSlot[] {
  const slots: FreeSlot[] = [];

  // Sort busy periods by start time
  const sortedBusy = [...busyPeriods].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  let currentStart = workStart;

  for (const busy of sortedBusy) {
    const busyStart = new Date(busy.start);
    const busyEnd = new Date(busy.end);

    // If there's a gap before this busy period
    if (busyStart > currentStart) {
      const slotEnd = busyStart < workEnd ? busyStart : workEnd;
      const durationMs = slotEnd.getTime() - currentStart.getTime();
      const durationMinutes = Math.floor(durationMs / (1000 * 60));

      if (durationMinutes >= minDurationMinutes) {
        slots.push({
          start: currentStart.toISOString(),
          end: slotEnd.toISOString(),
          durationMinutes,
        });
      }
    }

    // Move current start to after this busy period
    if (busyEnd > currentStart) {
      currentStart = busyEnd;
    }
  }

  // Check for free time after the last busy period
  if (currentStart < workEnd) {
    const durationMs = workEnd.getTime() - currentStart.getTime();
    const durationMinutes = Math.floor(durationMs / (1000 * 60));

    if (durationMinutes >= minDurationMinutes) {
      slots.push({
        start: currentStart.toISOString(),
        end: workEnd.toISOString(),
        durationMinutes,
      });
    }
  }

  return slots;
}

/**
 * Generate a human-readable summary of availability
 */
function generateSummary(
  freeSlots: FreeSlot[],
  busyCount: number,
  totalFreeMinutes: number,
  requestedDuration: number
): string {
  if (freeSlots.length === 0) {
    if (busyCount === 0) {
      return "No events found - your schedule appears open during working hours.";
    }
    return `Fully booked with ${busyCount} event(s). No ${requestedDuration}-minute slots available.`;
  }

  const hours = Math.floor(totalFreeMinutes / 60);
  const minutes = totalFreeMinutes % 60;
  const timeStr = hours > 0 
    ? `${hours}h ${minutes}m`
    : `${minutes} minutes`;

  if (busyCount === 0) {
    return `Completely free during working hours (${timeStr} available).`;
  }

  return `${freeSlots.length} free slot(s) totaling ${timeStr}, with ${busyCount} event(s) scheduled.`;
}


