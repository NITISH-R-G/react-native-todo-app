import type { Session } from '../domain/types';
import { authedRequest, publicRequest } from './client';

export const registerRequest = (email: string, password: string) =>
  publicRequest<Session>('POST', '/auth/register', { email: email.trim(), password });

export const loginRequest = (email: string, password: string) =>
  publicRequest<Session>('POST', '/auth/login', { email: email.trim(), password });

/** Revokes this session's refresh token on the server. Callers must treat failure as non-fatal. */
export const logoutRequest = (refreshToken: string) => publicRequest<void>('POST', '/auth/logout', { refreshToken });

/** Permanently deletes the signed-in account and all its tasks. Requires the password as confirmation. */
export const deleteAccountRequest = (password: string) => authedRequest<void>('DELETE', '/auth/account', { password });
