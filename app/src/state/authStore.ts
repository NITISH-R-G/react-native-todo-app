import { create } from 'zustand';
import { loginRequest, logoutRequest, registerRequest } from '../api/auth';
import { beginSession, dropSession, getSession, restoreSession, setSessionLostHandler } from '../api/client';
import { ApiError } from '../api/errors';
import { fetchTasks } from '../api/tasks';
import type { Session, User } from '../domain/types';

type Status = 'booting' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  user: User | null;
  /** Set when a previously valid session ended on its own (expired / revoked). */
  notice: string | null;
  boot: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => {
  const enter = async (s: Session) => {
    await beginSession(s);
    set({ status: 'signedIn', user: s.user, notice: null });
  };
  setSessionLostHandler(() =>
    set({ status: 'signedOut', user: null, notice: 'Your session expired. Please sign in again.' }),
  );
  return {
    status: 'booting',
    user: null,
    notice: null,
    async boot() {
      const s = await restoreSession();
      if (!s) {
        set({ status: 'signedOut', user: null });
        return;
      }
      try {
        // Validates the stored session against the server (refreshing transparently if needed).
        await fetchTasks();
        set({ status: 'signedIn', user: getSession()?.user ?? s.user });
      } catch (e) {
        // Offline at launch: keep the session and let the task screen show its retry state.
        if (e instanceof ApiError && e.kind === 'network') set({ status: 'signedIn', user: s.user });
        else if (getSession()) set({ status: 'signedIn', user: s.user });
        else set({ status: 'signedOut', user: null });
      }
    },
    async register(email, password) {
      await enter(await registerRequest(email, password));
    },
    async login(email, password) {
      await enter(await loginRequest(email, password));
    },
    async logout() {
      // Best effort: revoke the refresh token server-side, but never block or fail local sign-out
      // (offline users must still be able to sign out; the local session is always cleared).
      const refreshToken = getSession()?.refreshToken;
      if (refreshToken) await logoutRequest(refreshToken).catch(() => undefined);
      await dropSession();
      set({ status: 'signedOut', user: null, notice: null });
    },
  };
});
