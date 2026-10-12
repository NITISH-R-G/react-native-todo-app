// Release gate: fails (exit 1) unless the production API URL is a safe https URL.
// Run automatically by Gradle before assembleRelease / bundleRelease / packageRelease.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src/config/productionApiUrl.ts'), 'utf8');
const override = process.argv.find((a) => a.startsWith('--url='));
const url = override ? override.slice(6) : ((src.match(/PRODUCTION_API_URL\s*=\s*'([^']*)'/) ?? [])[1] ?? '');

const problems = [];
if (!url) problems.push('PRODUCTION_API_URL is empty');
else {
  let u;
  try { u = new URL(url); } catch { problems.push('PRODUCTION_API_URL is not a valid URL'); }
  if (u) {
    if (u.protocol !== 'https:') problems.push('PRODUCTION_API_URL must use https');
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.0\.0\.0|\[?::1)/i.test(u.hostname) || u.hostname.endsWith('.local'))
      problems.push('PRODUCTION_API_URL points at a local/private address');
    if (url.endsWith('/')) problems.push('PRODUCTION_API_URL must not end with a slash');
    if (u.username || u.password) problems.push('PRODUCTION_API_URL must not contain credentials');
  }
}
if (problems.length) {
  console.error('RELEASE CONFIG CHECK FAILED:\n  - ' + problems.join('\n  - '));
  console.error('Set PRODUCTION_API_URL in app/src/config/productionApiUrl.ts (or pass -PallowEmptyApiUrl=true to verify packaging only; that artifact is NOT shippable).');
  process.exit(1);
}
console.log('release config ok: ' + new URL(url).origin);
