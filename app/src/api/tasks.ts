import type { Task, TaskInput } from '../domain/types';
import { authedRequest } from './client';

export const fetchTasks = async (): Promise<Task[]> =>
  (await authedRequest<{ tasks: Task[] }>('GET', '/tasks?sort=smart')).tasks;

export const createTaskRequest = async (input: TaskInput): Promise<Task> =>
  (await authedRequest<{ task: Task }>('POST', '/tasks', input)).task;

export const updateTaskRequest = async (
  id: string,
  patch: Partial<TaskInput> & { completed?: boolean },
): Promise<Task> => (await authedRequest<{ task: Task }>('PATCH', `/tasks/${id}`, patch)).task;

export const deleteTaskRequest = (id: string): Promise<void> => authedRequest<void>('DELETE', `/tasks/${id}`);
