import { z } from "zod";
import type { ReclaimTaskEventCategory } from "./types.js";

const HOUR_MINUTE_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const ReclaimHabitDaySchema = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday"
]);

export const ReclaimHabitInputSchema = z.object({
  title: z.string().min(1),
  notes: z.string().optional(),
  durationMinutes: z.number().int().positive(),
  eventCategory: z.enum(["PERSONAL", "WORK"]).optional(),
  cadence: z.enum(["daily", "weekly"]).default("daily"),
  daysOfWeek: z.array(ReclaimHabitDaySchema).min(1).optional(),
  windowStart: z.string().regex(HOUR_MINUTE_PATTERN, "Expected HH:MM in 24-hour time.").optional(),
  windowEnd: z.string().regex(HOUR_MINUTE_PATTERN, "Expected HH:MM in 24-hour time.").optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  alwaysPrivate: z.boolean().default(true)
}).superRefine((habit, context) => {
  if (habit.cadence === "daily" && habit.daysOfWeek !== undefined) {
    context.addIssue({
      code: "custom",
      path: ["daysOfWeek"],
      message: "Daily habits should omit daysOfWeek."
    });
  }

  if (habit.cadence === "weekly" && habit.daysOfWeek === undefined) {
    context.addIssue({
      code: "custom",
      path: ["daysOfWeek"],
      message: "Weekly habits require at least one dayOfWeek."
    });
  }

  if (
    habit.windowStart !== undefined &&
    habit.windowEnd !== undefined &&
    habit.windowStart >= habit.windowEnd
  ) {
    context.addIssue({
      code: "custom",
      path: ["windowEnd"],
      message: "windowEnd must be later than windowStart."
    });
  }
});

export const ReclaimHabitInputListSchema = z.union([
  z.array(ReclaimHabitInputSchema),
  z.object({ habits: z.array(ReclaimHabitInputSchema) })
]).transform((value) => Array.isArray(value) ? value : value.habits);

export type ReclaimHabitDay = z.infer<typeof ReclaimHabitDaySchema>;
export type ReclaimHabitInput = z.input<typeof ReclaimHabitInputSchema>;

export interface ReclaimHabitCreatePreviewRequest {
  title: string;
  notes?: string;
  durationMinutes: number;
  eventCategory: ReclaimTaskEventCategory;
  cadence: "daily" | "weekly";
  daysOfWeek?: ReclaimHabitDay[];
  windowStart?: string;
  windowEnd?: string;
  startDate?: string;
  endDate?: string;
  alwaysPrivate: boolean;
}

export interface PreviewHabitCreate {
  title: string;
  request: ReclaimHabitCreatePreviewRequest;
}

export interface HabitCreatePreview {
  habitCount: number;
  habits: PreviewHabitCreate[];
  writeSafety: "preview_only";
}

export function parseReclaimHabitInputs(raw: unknown): ReclaimHabitInput[] {
  return ReclaimHabitInputListSchema.parse(raw);
}

function buildHabitPreviewRequest(
  habit: ReclaimHabitInput,
  options: {
    eventCategory?: ReclaimTaskEventCategory;
  } = {}
): ReclaimHabitCreatePreviewRequest {
  const parsed = ReclaimHabitInputSchema.parse(habit);
  return {
    title: parsed.title,
    notes: parsed.notes,
    durationMinutes: parsed.durationMinutes,
    eventCategory: parsed.eventCategory ?? options.eventCategory ?? "PERSONAL",
    cadence: parsed.cadence,
    daysOfWeek: parsed.daysOfWeek,
    windowStart: parsed.windowStart,
    windowEnd: parsed.windowEnd,
    startDate: parsed.startDate,
    endDate: parsed.endDate,
    alwaysPrivate: parsed.alwaysPrivate
  };
}

export function previewHabitCreates(
  habitInputs: ReclaimHabitInput[],
  options: {
    eventCategory?: ReclaimTaskEventCategory;
  } = {}
): HabitCreatePreview {
  return {
    habitCount: habitInputs.length,
    habits: habitInputs.map((habit) => ({
      title: habit.title,
      request: buildHabitPreviewRequest(habit, options)
    })),
    writeSafety: "preview_only"
  };
}

export const habits = {
  previewCreates: previewHabitCreates
};
