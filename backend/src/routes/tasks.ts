import { Router } from "express";
import { isValidObjectId, type HydratedDocument } from "mongoose";
import { Task, type TaskDoc } from "../models/Task.js";
import { HttpError } from "../errors.js";
import { compareSmart, type Rankable } from "../domain/sort.js";
import { createTaskSchema, listQuerySchema, updateTaskSchema } from "../validation.js";

type TaskHydrated = HydratedDocument<TaskDoc>;

function toDto(t: TaskHydrated, now: Date) {
  const overdue = !t.completed && t.deadline != null && t.deadline.getTime() < now.getTime();
  return {
    id: t.id as string,
    title: t.title,
    description: t.description,
    startAt: t.startAt,
    deadline: t.deadline,
    priority: t.priority,
    tags: t.tags,
    completed: t.completed,
    completedAt: t.completedAt,
    overdue, // derived, never stored: deadline semantics stay a pure function of "now"
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

const rankOf = (d: TaskHydrated): Rankable => ({
  id: d.id as string,
  priority: d.priority,
  startAt: d.startAt,
  deadline: d.deadline ?? null,
  completed: d.completed,
  createdAt: d.createdAt,
});

/** Every query includes userId from the verified token, so ownership is enforced in the database query itself. */
export function tasksRouter(): Router {
  const r = Router();
  const owned = (userId: string | undefined, id: string) => {
    if (!userId) throw new HttpError(401, "unauthorized", "Not authenticated");
    // Malformed ids are indistinguishable from missing ones (404) rather than leaking a cast error.
    if (!isValidObjectId(id)) throw new HttpError(404, "not_found", "Task not found");
    return { _id: id, userId };
  };

  r.get("/", async (req, res) => {
    const q = listQuerySchema.parse(req.query);
    const filter: Record<string, unknown> = { userId: req.userId };
    if (q.status !== "all") filter["completed"] = q.status === "completed";
    if (q.priority) filter["priority"] = q.priority;
    if (q.tag) filter["tags"] = q.tag;
    const now = new Date();
    const docs = await Task.find(filter);
    const byId = (a: Rankable, b: Rankable) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    const cmp =
      q.sort === "smart"
        ? compareSmart(now)
        : q.sort === "deadline"
          ? (a: Rankable, b: Rankable) => (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity) || byId(a, b)
          : (a: Rankable, b: Rankable) => b.createdAt.getTime() - a.createdAt.getTime() || byId(a, b);
    docs.sort((a, b) => cmp(rankOf(a), rankOf(b)));
    res.json({ tasks: docs.map((d) => toDto(d, now)) });
  });

  r.post("/", async (req, res) => {
    const body = createTaskSchema.parse(req.body);
    const t = await Task.create({ ...body, userId: req.userId });
    res.status(201).json({ task: toDto(t, new Date()) });
  });

  r.get("/:id", async (req, res) => {
    const t = await Task.findOne(owned(req.userId, req.params["id"] ?? ""));
    if (!t) throw new HttpError(404, "not_found", "Task not found");
    res.json({ task: toDto(t, new Date()) });
  });

  r.patch("/:id", async (req, res) => {
    const body = updateTaskSchema.parse(req.body);
    const t = await Task.findOne(owned(req.userId, req.params["id"] ?? ""));
    if (!t) throw new HttpError(404, "not_found", "Task not found");
    // The cross-field rule must also hold against stored values (e.g. only deadline changes).
    const startAt = body.startAt ?? t.startAt;
    const deadline = body.deadline !== undefined ? body.deadline : t.deadline;
    if (deadline && deadline.getTime() < startAt.getTime()) {
      throw new HttpError(400, "validation_error", "Validation failed", [
        { path: ["deadline"], message: "Deadline must not be before the start date-time" },
      ]);
    }
    const { completed, ...rest } = body;
    Object.assign(t, rest);
    if (completed !== undefined && completed !== t.completed) {
      t.completed = completed;
      t.completedAt = completed ? new Date() : null;
    }
    await t.save();
    res.json({ task: toDto(t, new Date()) });
  });

  r.delete("/:id", async (req, res) => {
    const out = await Task.deleteOne(owned(req.userId, req.params["id"] ?? ""));
    if (out.deletedCount === 0) throw new HttpError(404, "not_found", "Task not found");
    res.status(204).end();
  });

  return r;
}
