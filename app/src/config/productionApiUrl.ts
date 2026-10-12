/**
 * Production API base URL (https, no trailing slash), set by the release engineer BEFORE building a release,
 * e.g. 'https://api.example.com'. Deliberately empty in source control: a release build with an empty or
 * unsafe value is refused by `scripts/check-release-config.mjs` (wired into the Gradle release tasks).
 */
export const PRODUCTION_API_URL = '';
