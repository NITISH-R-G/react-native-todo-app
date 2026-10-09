import * as Keychain from 'react-native-keychain';
import { authedRequest, dropSession, getSession, setSession, setSessionLostHandler, restoreSession } from '../src/api/client';
import { ApiError } from '../src/api/errors';
import type { Session } from '../src/domain/types';

const session: Session = { accessToken: 'old-access', refreshToken: 'old-refresh', user: { id: 'u1', email: 'a@example.com' } };
const json = (status: number, body: unknown) =>
  Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) } as Response);

let calls: { url: string; auth?: string; body?: string }[];
function fakeServer(handler: (url: string, auth: string | undefined, body?: string) => Promise<Response>) {
  calls = [];
  (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn((url: string, init: RequestInit) => {
    const auth = (init.headers as Record<string, string>).Authorization;
    calls.push({ url, auth, body: init.body as string | undefined });
    return handler(url, auth, init.body as string | undefined);
  });
}

beforeEach(async () => {
  await setSession(session);
  setSessionLostHandler(null);
});

// Risk: the server rotates refresh tokens (single use), so parallel 401s must trigger exactly ONE refresh.
describe('authedRequest token handling', () => {
  it('refreshes once for concurrent 401s, retries with the new token, and persists the rotated tokens', async () => {
    fakeServer(async (url, auth) => {
      if (url.endsWith('/auth/refresh')) return json(200, { accessToken: 'new-access', refreshToken: 'new-refresh' });
      return auth === 'Bearer new-access' ? json(200, { tasks: [] }) : json(401, { error: { code: 'token_expired', message: 'Access token expired' } });
    });
    const [a, b] = await Promise.all([authedRequest('GET', '/tasks'), authedRequest('GET', '/tasks')]);
    expect(a).toEqual({ tasks: [] });
    expect(b).toEqual({ tasks: [] });
    expect(calls.filter((c) => c.url.endsWith('/auth/refresh'))).toHaveLength(1);
    expect(getSession()?.refreshToken).toBe('new-refresh');
    const stored = JSON.parse((await Keychain.getGenericPassword({ service: 'todo.session' }) as { password: string }).password);
    expect(stored.accessToken).toBe('new-access');
  });

  it('clears the session and notifies when the refresh token is rejected', async () => {
    const lost = jest.fn();
    setSessionLostHandler(lost);
    fakeServer(async (url) =>
      url.endsWith('/auth/refresh') ? json(401, { error: { code: 'invalid_refresh', message: 'Invalid refresh token' } }) : json(401, { error: { code: 'token_expired', message: 'x' } }),
    );
    await expect(authedRequest('GET', '/tasks')).rejects.toMatchObject({ status: 401 });
    expect(lost).toHaveBeenCalledTimes(1);
    expect(getSession()).toBeNull();
    expect(await restoreSession()).toBeNull();
  });

  it('keeps the session when the network fails (offline is not logout)', async () => {
    (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn(() => Promise.reject(new TypeError('Network request failed')));
    await expect(authedRequest('GET', '/tasks')).rejects.toMatchObject({ kind: 'network' });
    expect(getSession()?.accessToken).toBe('old-access');
  });

  it('refuses protected calls with no session and sends nothing', async () => {
    await dropSession();
    fakeServer(async () => json(200, {}));
    await expect(authedRequest('GET', '/tasks')).rejects.toBeInstanceOf(ApiError);
    expect(calls).toHaveLength(0);
  });

  it('maps backend validation details to field errors', async () => {
    fakeServer(async () =>
      json(400, { error: { code: 'validation_error', message: 'Validation failed', details: [{ path: ['deadline'], message: 'Deadline must not be before the start date-time' }] } }),
    );
    await expect(authedRequest('POST', '/tasks', {})).rejects.toMatchObject({ fieldErrors: { deadline: 'Deadline must not be before the start date-time' } });
  });
});
