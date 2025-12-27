// ═══════════════════════════════════════════════════════════════════════════
// Check Availability Tool
// Find free time slots and check for scheduling conflicts
// Uses Luxon for accurate date/time calculations (DST-safe)
// ═══════════════════════════════════════════════════════════════════════════

import { z } from "zod";
import { DateTime } from "luxon";
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

    // Parse dates using Luxon (UTC to avoid timezone drift)
    const startDt = DateTime.fromISO(startDate, { zone: "UTC" }).startOf("day");
    const endDt = endDate 
      ? DateTime.fromISO(endDate, { zone: "UTC" }).endOf("day")
      : startDt.endOf("day");

    // Determine if this is a single-day or multi-day query
    const isSingleDay = !endDate || startDate === endDate;

    // Check if date is weekend and we're excluding weekends
    // Luxon: weekday 6 = Saturday, 7 = Sunday
    const isWeekend = startDt.weekday === 6 || startDt.weekday === 7;

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
      startDate: startDt.toJSDate(),
      endDate: endDt.toJSDate(),
      status: "confirmed",
      limit: 100,
      orderBy: "startsAt",
      orderDirection: "asc",
    });

    // Extract busy periods (non-all-day events)
    const busyPeriods: BusyPeriod[] = eventsResult.events
      .filter((e) => !e.allDay)
      .map((event) => ({
        start: DateTime.fromJSDate(event.startsAt).toISO() ?? event.startsAt.toISOString(),
        end: event.endsAt 
          ? (DateTime.fromJSDate(event.endsAt).toISO() ?? event.endsAt.toISOString())
          : (DateTime.fromJSDate(event.startsAt).toISO() ?? event.startsAt.toISOString()),
        title: event.title,
        allDay: false,
      }));

    // Add all-day events as full-day blockers
    const allDayEvents = eventsResult.events
      .filter((e) => e.allDay)
      .map((event) => ({
        start: DateTime.fromJSDate(event.startsAt).toISO() ?? event.startsAt.toISOString(),
        end: event.endsAt 
          ? (DateTime.fromJSDate(event.endsAt).toISO() ?? event.endsAt.toISOString())
          : (DateTime.fromJSDate(event.startsAt).toISO() ?? event.startsAt.toISOString()),
        title: event.title,
        allDay: true,
      }));

    // Calculate free slots within working hours for each day in the range
    const allFreeSlots: FreeSlot[] = [];
    let currentDt = startDt;
    
    // Iterate through each day in the range using Luxon
    while (currentDt <= endDt) {
      // Luxon: weekday 6 = Saturday, 7 = Sunday
      const isWeekendDay = currentDt.weekday === 6 || currentDt.weekday === 7;
      
      // Skip weekend days if excludeWeekends is true
      if (excludeWeekends && isWeekendDay) {
        currentDt = currentDt.plus({ days: 1 });
        continue;
      }
      
      // Set working hours for this specific day (using Luxon)
      const dayWorkStart = currentDt.set({ hour: workingHoursStart, minute: 0, second: 0, millisecond: 0 });
      const dayWorkEnd = currentDt.set({ hour: workingHoursEnd, minute: 0, second: 0, millisecond: 0 });
      
      // Filter busy periods that overlap with this day's working hours
      const dayBusyPeriods = busyPeriods.filter((b) => {
        const busyStart = DateTime.fromISO(b.start);
        const busyEnd = DateTime.fromISO(b.end);
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
      
      // Move to next day using Luxon (DST-safe)
      currentDt = currentDt.plus({ days: 1 });
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
// Helper Functions (Luxon-based)
// ─────────────────────────────────────────────────────────────

/**
 * Calculate free slots between busy periods
 * Uses Luxon for accurate duration calculations
 */
function calculateFreeSlots(
  busyPeriods: BusyPeriod[],
  workStart: DateTime,
  workEnd: DateTime,
  minDurationMinutes: number
): FreeSlot[] {
  const slots: FreeSlot[] = [];

  // Sort busy periods by start time using Luxon
  const sortedBusy = [...busyPeriods].sort((a, b) => {
    const aStart = DateTime.fromISO(a.start);
    const bStart = DateTime.fromISO(b.start);
    return aStart.toMillis() - bStart.toMillis();
  });

  let currentStart = workStart;

  for (const busy of sortedBusy) {
    const busyStart = DateTime.fromISO(busy.start);
    const busyEnd = DateTime.fromISO(busy.end);

    // If there's a gap before this busy period
    if (busyStart > currentStart) {
      const slotEnd = busyStart < workEnd ? busyStart : workEnd;
      const durationMinutes = Math.floor(slotEnd.diff(currentStart, "minutes").minutes);

      if (durationMinutes >= minDurationMinutes) {
        slots.push({
          start: currentStart.toISO() ?? currentStart.toJSDate().toISOString(),
          end: slotEnd.toISO() ?? slotEnd.toJSDate().toISOString(),
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
    const durationMinutes = Math.floor(workEnd.diff(currentStart, "minutes").minutes);

    if (durationMinutes >= minDurationMinutes) {
      slots.push({
        start: currentStart.toISO() ?? currentStart.toJSDate().toISOString(),
        end: workEnd.toISO() ?? workEnd.toJSDate().toISOString(),
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


