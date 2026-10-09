import type { Task } from './types';

export type StatusFilter = 'all' | 'active' | 'completed' | 'overdue';
export type SortMode = 'smart' | 'deadline' | 'created';

export interface TaskFilters {
  status: StatusFilter;
  /** lowercase category key, or null for every category */
  category: string | null;
}

export const NO_FILTERS: TaskFilters = { status: 'all', category: null };
export const DEFAULT_CATEGORIES = ['general', 'study', 'shopping'] as const;
export const DEFAULT_CATEGORY = 'general';

/**
 * Overdue = not completed AND the deadline is strictly in the past (a deadline equal to "now" is not
 * overdue). Same rule as the backend (`isOverdue` in backend/src/domain/sort.ts); computed against the
 * device clock so the list does not go stale between fetches.
 */
export function isOverdue(t: Pick<Task, 'completed' | 'deadline'>, now: Date): boolean {
  return !t.completed && t.deadline !== null && new Date(t.deadline).getTime() < now.getTime();
}

/** A task's category is its first tag; untagged tasks belong to "general". */
export const categoryOf = (t: Pick<Task, 'tags'>): string => t.tags[0] ?? DEFAULT_CATEGORY;

/**
 * Filters compose with AND (status AND category). Order is preserved, so the server's sort is never
 * disturbed by filtering.
 */
export function applyFilters(tasks: Task[], f: TaskFilters, now: Date): Task[] {
  return tasks.filter((t) => {
    if (f.category !== null && categoryOf(t) !== f.category) return false;
    switch (f.status) {
      case 'active':
        return !t.completed;
      case 'completed':
        return t.completed;
      case 'overdue':
        return isOverdue(t, now);
      default:
        return true;
    }
  });
}

/** Counts shown on the status chips, computed over the category-filtered set so chips stay consistent with the list. */
export function statusCounts(tasks: Task[], category: string | null, now: Date): Record<StatusFilter, number> {
  const base = applyFilters(tasks, { status: 'all', category }, now);
  return {
    all: base.length,
    active: base.filter((t) => !t.completed).length,
    completed: base.filter((t) => t.completed).length,
    overdue: base.filter((t) => isOverdue(t, now)).length,
  };
}

/** Categories the user can pick: the defaults plus every category already used on their tasks. */
export function availableCategories(tasks: Task[]): string[] {
  const used = new Set<string>(DEFAULT_CATEGORIES);
  for (const t of tasks) used.add(categoryOf(t));
  const extras = [...used].filter((c) => !(DEFAULT_CATEGORIES as readonly string[]).includes(c)).sort();
  return [...DEFAULT_CATEGORIES, ...extras];
}

/** Normalises user text to the stored category key (the server also lowercases and trims tags). */
export function normalizeCategory(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 30);
}

export const displayCategory = (c: string): string => c.charAt(0).toUpperCase() + c.slice(1);

/** Replaces the primary category while keeping any extra tags set through the API. */
export function withCategory(existingTags: string[], category: string): string[] {
  const rest = existingTags.slice(1).filter((t) => t !== category);
  return [category, ...rest].slice(0, 10);
}
