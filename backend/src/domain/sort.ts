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

const PRIORITY_WEIGHT: Record<Priority, number> = { low: 1, medium: 2, high: 3 };
const HOUR = 3_600_000;

/**
 * Smart score (higher = more urgent), range roughly 13..110:
 *   priority component: 10 / 20 / 30  for low / medium / high
 *   deadline component: 0 without deadline; otherwise 70 / (1 + hoursLeft/24),
 *                       decaying from 70 (due now) toward 0; overdue tasks get a flat 80.
 * Tasks scheduled in the future (startAt > now) are not discounted: scheduling and
 * deadline already combine through the tie-break order below.
 */
export function smartScore(t: Rankable, now: Date): number {
  const p = PRIORITY_WEIGHT[t.priority] * 10;
  if (!t.deadline) return p;
  const hoursLeft = (t.deadline.getTime() - now.getTime()) / HOUR;
  const d = hoursLeft < 0 ? 80 : 70 / (1 + hoursLeft / 24);
  return p + d;
}

/**
 * Total order: incomplete before completed; higher smart score first;
 * ties -> earlier deadline (none last) -> earlier startAt -> earlier createdAt -> id.
 */
export function compareSmart(now: Date) {
  return (a: Rankable, b: Rankable): number => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    const s = smartScore(b, now) - smartScore(a, now);
    if (s !== 0) return s;
    const ad = a.deadline?.getTime() ?? Infinity;
    const bd = b.deadline?.getTime() ?? Infinity;
    if (ad !== bd) return ad < bd ? -1 : 1;
    if (a.startAt.getTime() !== b.startAt.getTime()) return a.startAt.getTime() - b.startAt.getTime();
    if (a.createdAt.getTime() !== b.createdAt.getTime()) return a.createdAt.getTime() - b.createdAt.getTime();
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };
}
