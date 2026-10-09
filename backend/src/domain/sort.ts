import type { Priority } from "../models/Task.js";

/** Minimal shape the ranking needs; keeps the algorithm independent of Mongoose. */
export interface Rankable {
  id: string;
  priority: Priority;
  startAt: Date;
  deadline: Date | null;
  completed: boolean;
  createdAt: Date;
}

const HOUR = 3_600_000;
const PRIORITY_RANK: Record<Priority, number> = { low: 1, medium: 2, high: 3 };

/**
 * Priority "lead time": a task of this priority is treated as due this much EARLIER than its real
 * deadline when ordering. This is how time, deadline and priority are mixed in one order.
 * Rationale: high = one full day (a high task due tomorrow ranks with a low task due today),
 * medium = one working day (8h), low = no shift. These are tuning constants, covered by table tests.
 */
export const PRIORITY_LEAD_MS: Record<Priority, number> = { high: 24 * HOUR, medium: 8 * HOUR, low: 0 };

/** A task with no deadline is treated as softly due this long after it is scheduled to start. */
export const NO_DEADLINE_HORIZON_MS = 7 * 24 * HOUR;

/** Overdue = not completed and the deadline is strictly in the past. A deadline equal to "now" is not overdue. */
export function isOverdue(t: Pick<Rankable, "completed" | "deadline">, now: Date): boolean {
  return !t.completed && t.deadline !== null && t.deadline.getTime() < now.getTime();
}

/** The instant the task is ranked by among non-overdue tasks (smaller = more urgent). */
export function effectiveDue(t: Rankable): number {
  const base = t.deadline ? t.deadline.getTime() : t.startAt.getTime() + NO_DEADLINE_HORIZON_MS;
  return base - PRIORITY_LEAD_MS[t.priority];
}

const cmpNum = (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Total, deterministic order ("smart" sort). Precedence, highest first:
 *  1. Incomplete before completed.
 *  2. Overdue before not overdue.
 *  3a. Among overdue: higher priority first, then the earlier (more overdue) deadline.
 *  3b. Among not overdue: earlier effectiveDue (deadline minus priority lead; no deadline = startAt + 7 days minus lead).
 *  4. Ties: higher priority, earlier deadline (none last), earlier startAt, earlier createdAt, then id.
 * Completed tasks are ordered among themselves by the same rules from step 3b (their overdue flag is false).
 */
export function compareSmart(now: Date) {
  return (a: Rankable, b: Rankable): number => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const ao = isOverdue(a, now);
    const bo = isOverdue(b, now);
    if (ao !== bo) return ao ? -1 : 1;
    if (ao && bo) {
      const p = cmpNum(PRIORITY_RANK[b.priority], PRIORITY_RANK[a.priority]);
      if (p !== 0) return p;
      const d = cmpNum(a.deadline!.getTime(), b.deadline!.getTime());
      if (d !== 0) return d;
    } else {
      const e = cmpNum(effectiveDue(a), effectiveDue(b));
      if (e !== 0) return e;
    }
    const p = cmpNum(PRIORITY_RANK[b.priority], PRIORITY_RANK[a.priority]);
    if (p !== 0) return p;
    const d = cmpNum(a.deadline?.getTime() ?? Infinity, b.deadline?.getTime() ?? Infinity);
    if (d !== 0) return d;
    const s = cmpNum(a.startAt.getTime(), b.startAt.getTime());
    if (s !== 0) return s;
    const c = cmpNum(a.createdAt.getTime(), b.createdAt.getTime());
    if (c !== 0) return c;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}
