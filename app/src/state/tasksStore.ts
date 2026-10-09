import { create } from 'zustand';
import { createTaskRequest, deleteTaskRequest, fetchTasks, updateTaskRequest } from '../api/tasks';
import { describeError } from '../api/errors';
import type { Task, TaskInput } from '../domain/types';

interface TasksState {
  tasks: Task[];
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  /** ids with a mutation in flight; used to block duplicate taps */
  busy: Record<string, true>;
  load: (opts?: { silent?: boolean }) => Promise<void>;
  create: (input: TaskInput) => Promise<Task>;
  update: (id: string, patch: Partial<TaskInput>) => Promise<Task>;
  setCompleted: (id: string, completed: boolean) => Promise<void>;
  remove: (id: string) => Promise<void>;
  reset: () => void;
}

/**
 * The server is the source of truth: every mutation is followed by a fresh GET /tasks, so the list
 * (including server-computed ordering and `overdue`) always reflects what is persisted.
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
    busy: {},
    async load(opts) {
      if (!opts?.silent) set({ status: 'loading', error: null });
      try {
        set({ tasks: await fetchTasks(), status: 'ready', error: null });
      } catch (e) {
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
    reset: () => set({ tasks: [], status: 'idle', error: null, busy: {} }),
  };
});
