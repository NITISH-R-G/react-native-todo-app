/**
 * API endpoint selection.
 *  - Debug builds talk to the host machine's dev API. 10.0.2.2 is the Android emulator's alias for the
 *    host's loopback; a physical device needs the host LAN IP (or `adb reverse tcp:4000 tcp:4000`).
 *  - Release builds use PRODUCTION_API_URL, which must be an https URL set at release time.
 *    It is deliberately empty so a release can never silently point at a development server.
 */
const DEV_API_URL = 'http://10.0.2.2:4000';
const PRODUCTION_API_URL = '';

export const API_URL: string = __DEV__ ? DEV_API_URL : PRODUCTION_API_URL;

/** Returns an error message when the build has no usable API endpoint, otherwise null. */
export function apiConfigError(url: string = API_URL, dev: boolean = __DEV__): string | null {
  if (!url) return 'This build has no API server configured.';
  if (!dev && !url.startsWith('https://')) return 'Release builds require an https API URL.';
  return null;
}
