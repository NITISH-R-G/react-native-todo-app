export type Priority = 'low' | 'medium' | 'high';
export const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low'];

/** Task as returned by the backend (ISO-8601 strings; see backend/src/routes/tasks.ts toDto). */
export interface Task {
  id: string;
  title: string;
  description: string;
  startAt: string;
  deadline: string | null;
  priority: Priority;
  tags: string[];
  completed: boolean;
  completedAt: string | null;
  overdue: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Fields the client may send when creating or editing a task. */
export interface TaskInput {
  title: string;
  description: string;
  startAt: string;
  deadline: string | null;
  priority: Priority;
}

export interface User {
  id: string;
  email: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: User;
}
