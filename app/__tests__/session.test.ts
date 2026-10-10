import { dropSession, getSession, setSession } from '../src/api/client';
import { fetchTasks } from '../src/api/tasks';
import { saveSession } from '../src/storage/secureSession';
import { useAuth } from '../src/state/authStore';
import { useTasks } from '../src/state/tasksStore';
import type { Session } from '../src/domain/types';

const stored: Session = { accessToken: 'expired-access', refreshToken: 'good-refresh', user: { id: 'u1', email: 'a@example.com' } };
const json = (status: number, body: unknown) =>
  Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) } as Response);
const htmlError = (status: number) =>
  Promise.resolve({ status, ok: false, json: () => Promise.reject(new SyntaxError('Unexpected token <')) } as Response);
const task = (id: string) => ({ id, title: id, description: '', startAt: '2030-01-01T00:00:00Z', deadline: null, priority: 'medium', tags: [], completed: false, completedAt: null, overdue: false, createdAt: '', updatedAt: '' });

let fetchMock: jest.Mock;
beforeEach(async () => {
  await dropSession();
  useAuth.setState({ status: 'booting', user: null, notice: null });
  useTasks.getState().reset();
  fetchMock = jest.fn();
  (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

// Risk: the app restarts with a session that has expired or been revoked; it must recover or sign out cleanly.
describe('app restart with a stored session', () => {
  it('expired access token + valid refresh token: stays signed in and rotates tokens', async () => {
    await saveSession(stored);
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return json(200, { accessToken: 'fresh-access', refreshToken: 'fresh-refresh' });
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer fresh-access' ? json(200, { tasks: [task('t1')] }) : json(401, { error: { code: 'token_expired', message: 'expired' } });
    });
    await useAuth.getState().boot();
    expect(useAuth.getState().status).toBe('signedIn');
    expect(getSession()?.refreshToken).toBe('fresh-refresh');
  });

  it('revoked refresh token (reuse/rotation elsewhere): signs out with an explanatory notice', async () => {
    await saveSession(stored);
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('/auth/refresh') ? json(401, { error: { code: 'invalid_refresh', message: 'Invalid refresh token' } }) : json(401, { error: { code: 'token_expired', message: 'expired' } }),
    );
    await useAuth.getState().boot();
    expect(useAuth.getState().status).toBe('signedOut');
    expect(useAuth.getState().notice).toMatch(/session expired/i);
    expect(getSession()).toBeNull();
  });

  it('server unreachable at launch: keeps the session instead of signing the user out', async () => {
    await saveSession(stored);
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await useAuth.getState().boot();
    expect(useAuth.getState().status).toBe('signedIn');
    expect(getSession()?.refreshToken).toBe('good-refresh');
  });

  it('no stored session: signed out', async () => {
    await useAuth.getState().boot();
    expect(useAuth.getState().status).toBe('signedOut');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('failure handling', () => {
  beforeEach(() => setSession({ ...stored, accessToken: 'ok' }));

  it('an HTML 502 page becomes a friendly server error, not a crash', async () => {
    fetchMock.mockReturnValue(htmlError(502));
    await expect(fetchTasks()).rejects.toMatchObject({ status: 502, message: expect.stringMatching(/server had a problem/i) });
  });

  it('a 200 with a non-JSON body is rejected as a bad response', async () => {
    fetchMock.mockReturnValue(htmlError(200).then((r) => ({ ...r, ok: true })));
    await expect(fetchTasks()).rejects.toMatchObject({ code: 'bad_response' });
  });

  it.each([
    ['missing tasks array', {}],
    ['tasks not an array', { tasks: 'nope' }],
    ['task without id', { tasks: [{ title: 'x', tags: [] }] }],
    ['task without tags', { tasks: [{ id: '1', title: 'x' }] }],
  ])('a 200 with the wrong shape (%s) is rejected', async (_n, body) => {
    fetchMock.mockReturnValue(json(200, body));
    await expect(fetchTasks()).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('store shows the error state and the error is retryable', async () => {
    fetchMock.mockReturnValueOnce(json(500, { error: { code: 'internal', message: 'Internal server error' } }));
    await useTasks.getState().load();
    expect(useTasks.getState().status).toBe('error');
    fetchMock.mockReturnValueOnce(json(200, { tasks: [task('t1')] }));
    await useTasks.getState().load();
    expect(useTasks.getState().status).toBe('ready');
    expect(useTasks.getState().tasks).toHaveLength(1);
  });

  it('a failed create is attempted exactly once (no automatic retry of non-idempotent mutations)', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await expect(
      useTasks.getState().create({ title: 'x', description: '', startAt: '2030-01-01T00:00:00Z', deadline: null, priority: 'low', tags: ['general'] }),
    ).rejects.toMatchObject({ kind: 'network' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('a task list that arrives after sign-out is discarded (no cross-user leak)', async () => {
    let release: (r: Response) => void = () => {};
    // The task list request stays pending; the logout request (a different URL) is answered normally.
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('/auth/logout') ? json(204, null) : new Promise<Response>((res) => (release = res)),
    );
    const pending = useTasks.getState().load();
    await useAuth.getState().logout();
    release(await json(200, { tasks: [task('someone-elses')] }));
    await pending;
    expect(useTasks.getState().tasks).toEqual([]);
  });
});

describe('sign-out', () => {
  it('revokes the refresh token on the server and clears local state', async () => {
    await setSession(stored);
    useAuth.setState({ status: 'signedIn', user: stored.user });
    fetchMock.mockReturnValue(Promise.resolve({ status: 204, ok: true, json: () => Promise.reject(new Error('no body')) } as Response));
    await useAuth.getState().logout();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/logout$/);
    expect(JSON.parse(init.body)).toEqual({ refreshToken: 'good-refresh' });
    expect(useAuth.getState().status).toBe('signedOut');
    expect(getSession()).toBeNull();
  });

  it('still signs out locally when the server is unreachable', async () => {
    await setSession(stored);
    useAuth.setState({ status: 'signedIn', user: stored.user });
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await useAuth.getState().logout();
    expect(useAuth.getState().status).toBe('signedOut');
    expect(getSession()).toBeNull();
  });
});
