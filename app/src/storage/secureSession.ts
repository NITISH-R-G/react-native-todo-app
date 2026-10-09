import * as Keychain from 'react-native-keychain';
import type { Session } from '../domain/types';

// Tokens live in the Android Keystore-backed Keychain, never in AsyncStorage.
const SERVICE = 'todo.session';

export async function saveSession(session: Session): Promise<void> {
  await Keychain.setGenericPassword('session', JSON.stringify(session), { service: SERVICE });
}

/** Returns the stored session, or null when absent or unreadable (treated as signed out). */
export async function loadSession(): Promise<Session | null> {
  try {
    const found = await Keychain.getGenericPassword({ service: SERVICE });
    if (!found) return null;
    const s = JSON.parse(found.password) as Partial<Session>;
    if (typeof s.accessToken === 'string' && typeof s.refreshToken === 'string' && s.user?.id && s.user.email) {
      return s as Session;
    }
    return null;
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
