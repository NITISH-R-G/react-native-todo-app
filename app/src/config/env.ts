import { PRODUCTION_API_URL } from './productionApiUrl';

/**
 * API endpoint selection.
 *  - Debug builds talk to the host machine's dev API. 10.0.2.2 is the Android emulator's alias for the
 *    host's loopback; a physical device needs the host LAN IP (or `adb reverse tcp:4000 tcp:4000`).
 *    The dev URL only exists inside the __DEV__ branch, so release bundles do not contain it.
 *  - Release builds use PRODUCTION_API_URL (src/config/productionApiUrl.ts), which must be an https URL.
 *    It is empty in source control so a release can never silently point at a development server.
 */
export const API_URL: string = __DEV__ ? 'http://10.0.2.2:4000' : PRODUCTION_API_URL;

/** Returns an error message when the build has no usable API endpoint, otherwise null. */
export function apiConfigError(url: string = API_URL, dev: boolean = __DEV__): string | null {
  if (!url) return 'This build has no API server configured.';
  if (!dev && !url.startsWith('https://')) return 'Release builds require an https API URL.';
  return null;
}
