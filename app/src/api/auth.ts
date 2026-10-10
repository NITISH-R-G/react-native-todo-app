import type { Session } from '../domain/types';
import { publicRequest } from './client';

export const registerRequest = (email: string, password: string) =>
  publicRequest<Session>('POST', '/auth/register', { email: email.trim(), password });

export const loginRequest = (email: string, password: string) =>
  publicRequest<Session>('POST', '/auth/login', { email: email.trim(), password });

/** Revokes this session's refresh token on the server. Callers must treat failure as non-fatal. */
export const logoutRequest = (refreshToken: string) => publicRequest<void>('POST', '/auth/logout', { refreshToken });
