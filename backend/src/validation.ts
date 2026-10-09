import { z } from "zod";
import { PRIORITIES } from "./models/Task.js";

const email = z.string().trim().toLowerCase().max(254).email();
// Weak = <8 chars or no letter/digit mix. Upper bound avoids hashing-DoS with huge inputs.
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(128)
  .regex(/[A-Za-z]/, "Password must contain a letter")
  .regex(/\d/, "Password must contain a digit");

export const registerSchema = z.object({ email, password }).strict();
export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();
export const refreshSchema = z.object({ refreshToken: z.string().min(1) }).strict();

const isoDate = z.string().datetime({ offset: true }).transform((s) => new Date(s));
const tag = z.string().trim().toLowerCase().min(1).max(30);

const taskFields = {
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().max(2000),
  startAt: isoDate,
  deadline: isoDate.nullable(),
  priority: z.enum(PRIORITIES),
  tags: z
    .array(tag)
    .max(10)
    .transform((t) => [...new Set(t)]),
};

const deadlineAfterStart = (v: { startAt?: Date; deadline?: Date | null }) =>
  !v.startAt || !v.deadline || v.deadline.getTime() >= v.startAt.getTime();
const deadlineMsg = { message: "Deadline must not be before the start date-time", path: ["deadline"] };

/** Past deadlines are accepted on purpose (backfilling / already-late work); they surface as `overdue`. */
export const createTaskSchema = z
  .object({
    title: taskFields.title,
    description: taskFields.description.default(""),
    startAt: taskFields.startAt.default(() => new Date()),
    deadline: taskFields.deadline.default(null),
    priority: taskFields.priority.default("medium"),
    tags: taskFields.tags.default([]),
  })
  .strict()
  .refine(deadlineAfterStart, deadlineMsg);

export const updateTaskSchema = z
  .object({
    title: taskFields.title,
    description: taskFields.description,
    startAt: taskFields.startAt,
    deadline: taskFields.deadline,
    priority: taskFields.priority,
    tags: taskFields.tags,
    completed: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" })
  .refine(deadlineAfterStart, deadlineMsg);

export const listQuerySchema = z.object({
  status: z.enum(["all", "active", "completed"]).default("all"),
  priority: z.enum(PRIORITIES).optional(),
  tag: tag.optional(),
  sort: z.enum(["smart", "deadline", "created"]).default("smart"),
});
