import type { Session } from '../domain/types';
import { publicRequest } from './client';

export const registerRequest = (email: string, password: string) =>
  publicRequest<Session>('POST', '/auth/register', { email: email.trim(), password });

export const loginRequest = (email: string, password: string) =>
  publicRequest<Session>('POST', '/auth/login', { email: email.trim(), password });
