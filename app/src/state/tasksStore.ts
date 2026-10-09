import { create } from 'zustand';
import { getEpoch } from '../api/client';
import { createTaskRequest, deleteTaskRequest, fetchTasks, updateTaskRequest } from '../api/tasks';
import { describeError } from '../api/errors';
import { NO_FILTERS, type SortMode, type TaskFilters } from '../domain/filters';
import type { Task, TaskInput } from '../domain/types';

interface TasksState {
  tasks: Task[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  filters: TaskFilters;
  sort: SortMode;
  /** ids with a mutation in flight; used to block duplicate taps */
  busy: Record<string, true>;
  load: (opts?: { silent?: boolean }) => Promise<void>;
  create: (input: TaskInput) => Promise<Task>;
  update: (id: string, patch: Partial<TaskInput>) => Promise<Task>;
  setCompleted: (id: string, completed: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setFilters: (f: Partial<TaskFilters>) => void;
  setSort: (s: SortMode) => Promise<void>;
  reset: () => void;
}

/**
 * The server is the source of truth: every mutation is followed by a fresh GET /tasks, so the list
 * (including server-computed ordering) always reflects what is persisted. Mutations are never retried
 * automatically (a retried POST could create a duplicate); the user retries explicitly.
 * Results that arrive after the session changed (sign-out, another user signing in) are discarded.
 */
export const useTasks = create<TasksState>((set, get) => {
  const withBusy = async <T,>(id: string, fn: () => Promise<T>): Promise<T> => {
    if (get().busy[id]) throw new Error('busy');
    set((s) => ({ busy: { ...s.busy, [id]: true } }));
    try {
      return await fn();
    } finally {
      set((s) => {
        const rest = { ...s.busy };
        delete rest[id];
        return { busy: rest };
      });
    }
  };
  return {
    tasks: [],
    status: 'idle',
    error: null,
    filters: NO_FILTERS,
    sort: 'smart',
    busy: {},
    async load(opts) {
      const epoch = getEpoch();
      if (!opts?.silent) set({ status: 'loading', error: null });
      try {
        const tasks = await fetchTasks(get().sort);
        if (epoch !== getEpoch()) return; // signed out / switched user while in flight
        set({ tasks, status: 'ready', error: null });
      } catch (e) {
        if (epoch !== getEpoch()) return;
        set({ status: 'error', error: describeError(e) });
      }
    },
    async create(input) {
      const t = await createTaskRequest(input);
      await get().load({ silent: true });
      return t;
    },
    async update(id, patch) {
      const t = await withBusy(id, () => updateTaskRequest(id, patch));
      await get().load({ silent: true });
      return t;
    },
    async setCompleted(id, completed) {
      await withBusy(id, () => updateTaskRequest(id, { completed }));
      await get().load({ silent: true });
    },
    async remove(id) {
      await withBusy(id, () => deleteTaskRequest(id));
      await get().load({ silent: true });
    },
    setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
    async setSort(sort) {
      set({ sort });
      await get().load({ silent: true });
    },
    reset: () => set({ tasks: [], status: 'idle', error: null, busy: {}, filters: NO_FILTERS, sort: 'smart' }),
  };
});
