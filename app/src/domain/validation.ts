import type { Priority } from './types';

export type FieldErrors<K extends string> = Partial<Record<K, string>>;

// Intentionally permissive shape check; the server is the authority on email validity.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Mirrors the backend password rule (>=8 chars, a letter, a digit) so users get instant feedback. */
export function validatePassword(password: string): string | undefined {
  if (password.length < 8) return 'Use at least 8 characters';
  if (!/[A-Za-z]/.test(password)) return 'Include at least one letter';
  if (!/\d/.test(password)) return 'Include at least one digit';
  if (password.length > 128) return 'Use at most 128 characters';
  return undefined;
}

export function validateEmail(email: string): string | undefined {
  const e = email.trim();
  if (!e) return 'Enter your email';
  if (!EMAIL.test(e)) return 'Enter a valid email address';
  return undefined;
}

export function validateRegister(email: string, password: string): FieldErrors<'email' | 'password'> {
  const errors: FieldErrors<'email' | 'password'> = {};
  const e = validateEmail(email);
  const p = validatePassword(password);
  if (e) errors.email = e;
  if (p) errors.password = p;
  return errors;
}

export function validateLogin(email: string, password: string): FieldErrors<'email' | 'password'> {
  const errors: FieldErrors<'email' | 'password'> = {};
  const e = validateEmail(email);
  if (e) errors.email = e;
  if (!password) errors.password = 'Enter your password';
  return errors;
}

export interface TaskDraft {
  title: string;
  description: string;
  startAt: Date;
  deadline: Date | null;
  priority: Priority;
}

/**
 * Task rules (same as backend): title required (<=200), description <=2000,
 * deadline must not be before the start date-time. Past deadlines are allowed (they show as overdue).
 */
export function validateTask(d: TaskDraft): FieldErrors<'title' | 'description' | 'startAt' | 'deadline'> {
  const errors: FieldErrors<'title' | 'description' | 'startAt' | 'deadline'> = {};
  const title = d.title.trim();
  if (!title) errors.title = 'Give your task a title';
  else if (title.length > 200) errors.title = 'Keep the title under 200 characters';
  if (d.description.length > 2000) errors.description = 'Keep the description under 2000 characters';
  if (Number.isNaN(d.startAt.getTime())) errors.startAt = 'Choose a valid date and time';
  if (d.deadline) {
    if (Number.isNaN(d.deadline.getTime())) errors.deadline = 'Choose a valid deadline';
    else if (!errors.startAt && d.deadline.getTime() < d.startAt.getTime()) {
      errors.deadline = 'Deadline can’t be before the start time';
    }
  }
  return errors;
}

export const hasErrors = (e: object): boolean => Object.keys(e).length > 0;
