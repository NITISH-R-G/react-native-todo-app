import type { Task } from './types';

export interface TaskSection {
  key: 'overdue' | 'today' | 'upcoming' | 'completed';
  title: string;
  data: Task[];
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * Splits the server-ordered list into display sections. Order inside each section is the server's
 * "smart" order (priority + deadline), so grouping never re-ranks tasks.
 */
export function groupTasks(tasks: Task[], now: Date = new Date()): TaskSection[] {
  const overdue: Task[] = [];
  const today: Task[] = [];
  const upcoming: Task[] = [];
  const completed: Task[] = [];
  for (const t of tasks) {
    if (t.completed) completed.push(t);
    else if (t.overdue) overdue.push(t);
    else if (sameDay(new Date(t.startAt), now) || (t.deadline && sameDay(new Date(t.deadline), now))) today.push(t);
    else upcoming.push(t);
  }
  const sections: TaskSection[] = [
    { key: 'overdue', title: 'Overdue', data: overdue },
    { key: 'today', title: 'Today', data: today },
    { key: 'upcoming', title: 'Upcoming', data: upcoming },
    { key: 'completed', title: 'Completed', data: completed },
  ];
  return sections.filter((s) => s.data.length > 0);
}

/** Percentage of tasks completed (0-100); 0 when there are no tasks. */
export function completionPercent(tasks: Task[]): number {
  if (tasks.length === 0) return 0;
  return Math.round((tasks.filter((t) => t.completed).length / tasks.length) * 100);
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit' });
}
