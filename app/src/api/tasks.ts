import type { Task, TaskInput } from '../domain/types';
import type { SortMode } from '../domain/filters';
import { ApiError } from './errors';
import { authedRequest } from './client';

const badResponse = () => new ApiError('http', 'The server sent an unexpected response. Please try again.', 502, 'bad_response');

const isTask = (t: unknown): t is Task =>
  typeof t === 'object' && t !== null && typeof (t as Task).id === 'string' && typeof (t as Task).title === 'string' && Array.isArray((t as Task).tags);

/** Rejects payloads that do not have the documented shape instead of letting the UI crash on them. */
function expectTask(body: unknown): Task {
  const t = (body as { task?: unknown } | null)?.task;
  if (!isTask(t)) throw badResponse();
  return t;
}

export async function fetchTasks(sort: SortMode = 'smart'): Promise<Task[]> {
  const body = await authedRequest<{ tasks?: unknown }>('GET', `/tasks?sort=${sort}`);
  if (!Array.isArray(body?.tasks) || !body.tasks.every(isTask)) throw badResponse();
  return body.tasks;
}

export const createTaskRequest = async (input: TaskInput): Promise<Task> =>
  expectTask(await authedRequest('POST', '/tasks', input));

export const updateTaskRequest = async (id: string, patch: Partial<TaskInput> & { completed?: boolean }): Promise<Task> =>
  expectTask(await authedRequest('PATCH', `/tasks/${id}`, patch));

export const deleteTaskRequest = (id: string): Promise<void> => authedRequest<void>('DELETE', `/tasks/${id}`);
