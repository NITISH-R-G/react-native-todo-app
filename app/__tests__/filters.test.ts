import { applyFilters, availableCategories, categoryOf, isOverdue, normalizeCategory, statusCounts, withCategory, NO_FILTERS } from '../src/domain/filters';
import type { Task } from '../src/domain/types';

const now = new Date('2030-01-10T12:00:00Z');
const at = (h: number) => new Date(now.getTime() + h * 3_600_000).toISOString();
const t = (id: string, o: Partial<Task> = {}): Task => ({
  id, title: id, description: '', startAt: at(0), deadline: null, priority: 'medium', tags: [], completed: false,
  completedAt: null, overdue: false, createdAt: at(0), updatedAt: at(0), ...o,
});

const set = [
  t('late-work', { deadline: at(-2), tags: ['work'] }),
  t('late-done', { deadline: at(-2), tags: ['work'], completed: true }),
  t('future-work', { deadline: at(5), tags: ['work'] }),
  t('home-open', { tags: ['home'] }),
  t('untagged'),
  t('now-deadline', { deadline: at(0), tags: ['home'] }),
];
const ids = (xs: Task[]) => xs.map((x) => x.id);

// Risk: filters must compose predictably (AND), keep server order, and share one definition of "overdue".
describe('filters', () => {
  it.each([
    ['all', null, ['late-work', 'late-done', 'future-work', 'home-open', 'untagged', 'now-deadline']],
    ['active', null, ['late-work', 'future-work', 'home-open', 'untagged', 'now-deadline']],
    ['completed', null, ['late-done']],
    ['overdue', null, ['late-work']], // completed late task and deadline == now are NOT overdue
    ['all', 'work', ['late-work', 'late-done', 'future-work']],
    ['active', 'work', ['late-work', 'future-work']],
    ['overdue', 'work', ['late-work']],
    ['overdue', 'home', []],
    ['active', 'general', ['untagged']], // untagged tasks belong to "general"
    ['completed', 'home', []],
  ] as const)('status=%s category=%s', (status, category, expected) => {
    expect(ids(applyFilters(set, { status, category }, now))).toEqual(expected);
  });

  it('counts per status follow the selected category', () => {
    expect(statusCounts(set, null, now)).toEqual({ all: 6, active: 5, completed: 1, overdue: 1 });
    expect(statusCounts(set, 'work', now)).toEqual({ all: 3, active: 2, completed: 1, overdue: 1 });
  });

  it('isOverdue: past deadline, incomplete only', () => {
    expect(isOverdue({ completed: false, deadline: at(-0.01) }, now)).toBe(true);
    expect(isOverdue({ completed: false, deadline: at(0) }, now)).toBe(false);
    expect(isOverdue({ completed: true, deadline: at(-5) }, now)).toBe(false);
    expect(isOverdue({ completed: false, deadline: null }, now)).toBe(false);
  });
});

describe('categories', () => {
  it('lists defaults first, then used categories alphabetically, without duplicates', () => {
    expect(availableCategories(set)).toEqual(['general', 'study', 'shopping', 'home', 'work']);
    expect(availableCategories([])).toEqual(['general', 'study', 'shopping']);
  });
  it('normalises names like the server and keeps extra tags when the category changes', () => {
    expect(normalizeCategory('  Side   Project ')).toBe('side project');
    expect(categoryOf(t('x', { tags: ['a', 'b'] }))).toBe('a');
    expect(withCategory(['a', 'b', 'c'], 'z')).toEqual(['z', 'b', 'c']);
    expect(withCategory(['a', 'b'], 'b')).toEqual(['b']);
    expect(withCategory([], 'general')).toEqual(['general']);
  });
  it('NO_FILTERS is the identity', () => {
    expect(applyFilters(set, NO_FILTERS, now)).toHaveLength(set.length);
  });
});
