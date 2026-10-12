import { API_URL, apiConfigError } from '../config/env';
import type { Session } from '../domain/types';
import { clearSession, loadSession, saveSession } from '../storage/secureSession';
import { ApiError, fromResponseBody } from './errors';

const TIMEOUT_MS = 15000;

let current: Session | null = null;
let onSessionLost: (() => void) | null = null;
let refreshing: Promise<Session> | null = null;
/** Bumps on sign-in and sign-out (not on token refresh) so results from a previous session can be discarded. */
let epoch = 0;
/** True when the newest tokens exist only in memory because the secure-storage write failed; retried later. */
let unpersisted = false;
export const getEpoch = (): number => epoch;

/** Registers a callback fired when the session can no longer be refreshed (expired/revoked). */
export function setSessionLostHandler(fn: (() => void) | null): void {
  onSessionLost = fn;
}

export async function setSession(s: Session): Promise<void> {
  current = s;
  await saveSession(s);
}

/** Starts a brand-new session (sign-in / registration). */
export async function beginSession(s: Session): Promise<void> {
  epoch += 1;
  await setSession(s);
}

export async function dropSession(): Promise<void> {
  epoch += 1;
  unpersisted = false;
  current = null;
  await clearSession();
}

export async function restoreSession(): Promise<Session | null> {
  current = await loadSession();
  return current;
}

export const getSession = (): Session | null => current;

async function rawRequest(method: string, path: string, body: unknown, token: string | null): Promise<Response> {
  const configErr = apiConfigError();
  if (configErr) throw new ApiError('config', configErr);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError('network', 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  let json: unknown = null;
  let parsed = true;
  try {
    json = await res.json();
  } catch {
    parsed = false; // e.g. an HTML error page from a proxy
  }
  if (!res.ok) throw fromResponseBody(res.status, json);
  if (!parsed) throw new ApiError('http', 'The server sent an unexpected response. Please try again.', res.status, 'bad_response');
  return json as T;
}

/** Rotating refresh: the server accepts each refresh token once, so concurrent callers must share one call. */
function refreshSession(): Promise<Session> {
  if (!refreshing) {
    refreshing = (async () => {
      const s = current;
      if (!s) throw new ApiError('http', 'Not signed in', 401, 'unauthorized');
      try {
        const res = await rawRequest('POST', '/auth/refresh', { refreshToken: s.refreshToken }, null);
        const tokens = await parse<{ accessToken: string; refreshToken: string }>(res);
        const next: Session = { ...s, ...tokens };
        // The server has already rotated. Never lose the new tokens or fail the user's request because the
        // secure-storage write failed: keep them in memory and retry persisting (see persistIfNeeded).
        current = next;
        try {
          await saveSession(next);
          unpersisted = false;
        } catch {
          unpersisted = true;
        }
        return next;
      } catch (e) {
        // Only an explicit rejection ends the session; a network blip must not log the user out.
        if (e instanceof ApiError && e.kind === 'http' && e.status === 401) {
          await dropSession();
          onSessionLost?.();
        }
        throw e;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

/** Authenticated JSON request with one transparent refresh+retry on an expired/invalid access token. */
export async function authedRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!current) throw new ApiError('http', 'Please sign in', 401, 'unauthorized');
  let res = await rawRequest(method, path, body, current.accessToken);
  if (res.status === 401) {
    const next = await refreshSession();
    res = await rawRequest(method, path, body, next.accessToken);
  }
  const out = await parse<T>(res);
  await persistIfNeeded();
  return out;
}

/** Retries a previously failed secure-storage write after any request that proved the session is healthy. */
async function persistIfNeeded(): Promise<void> {
  if (!unpersisted || !current) return;
  try {
    await saveSession(current);
    unpersisted = false;
  } catch {
    // still failing: stay in memory-only mode and try again next time
  }
}

/** Unauthenticated JSON request (register / login). */
export async function publicRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  return parse<T>(await rawRequest(method, path, body, null));
}
