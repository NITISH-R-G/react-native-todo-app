// The app project has no @types/node (and gains no dependency for one test), so declare what is used.
declare const require: (m: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
declare const __dirname: string;
import { apiConfigError } from '../src/config/env';

const { spawnSync } = require('child_process');
const { join } = require('path');
const script = join(__dirname, '..', 'scripts', 'check-release-config.mjs');
const check = (url: string) => spawnSync('node', [script, `--url=${url}`], { encoding: 'utf8' });

// Risk: a release must never ship pointing at nothing, at a dev machine, or over plain HTTP.
describe('release API URL gate (scripts/check-release-config.mjs)', () => {
  it.each([
    ['', 'empty'],
    ['http://api.example.com', 'https'],
    ['https://localhost:4000', 'local/private'],
    ['https://10.0.2.2:4000', 'local/private'],
    ['https://192.168.1.20', 'local/private'],
    ['https://api.example.com/', 'slash'],
    ['https://user:pw@api.example.com', 'credentials'],
    ['not a url', 'valid URL'],
  ])('refuses %p', (url, reason) => {
    const r = check(url);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(new RegExp(reason, 'i'));
  });

  it('accepts a public https origin', () => {
    const r = check('https://api.example.com');
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('release config ok');
  });

  it('the committed source value is currently empty, so release builds are blocked until it is set', () => {
    const r = spawnSync('node', [script], { encoding: 'utf8' });
    expect(r.status).toBe(1);
  });
});

describe('runtime guard', () => {
  it('release builds reject empty and non-https URLs; dev allows http', () => {
    expect(apiConfigError('', false)).toMatch(/no API server/);
    expect(apiConfigError('http://api.example.com', false)).toMatch(/https/);
    expect(apiConfigError('https://api.example.com', false)).toBeNull();
    expect(apiConfigError('http://10.0.2.2:4000', true)).toBeNull();
  });
});
