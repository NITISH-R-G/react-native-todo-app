// Production-path smoke test: runs the COMPILED server (dist/server.js) with production-style environment
// variables against a throwaway real mongod, then exercises it over HTTP. Run after `npm run build`.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongod = await MongoMemoryServer.create();
const port = 4590;
const env = {
  ...process.env,
  NODE_ENV: 'production', PORT: String(port), MONGODB_URI: mongod.getUri('smoke'),
  JWT_ACCESS_SECRET: randomBytes(32).toString('hex'), JWT_REFRESH_SECRET: randomBytes(32).toString('hex'),
  TRUST_PROXY: '1', REQUIRE_HTTPS: 'true', LOG_REQUESTS: 'true',
};
const child = spawn(process.execPath, ['dist/server.js'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
let out = '';
child.stdout.on('data', (d) => (out += d));
child.stderr.on('data', (d) => (out += d));
const base = `http://127.0.0.1:${port}`;
const fail = async (m) => { console.error('SMOKE FAIL:', m, '\n--- server output ---\n' + out); child.kill(); await mongod.stop(); process.exit(1); };
const j = async (path, init) => { const r = await fetch(base + path, init); return { status: r.status, body: await r.json().catch(() => null) }; };
const tls = { 'X-Forwarded-Proto': 'https', 'Content-Type': 'application/json' };

let up = false;
child.on('exit', (code) => { if (!up) fail(`server exited early with code ${code}`); });
for (let i = 0; i < 80 && !up; i++) { try { up = (await fetch(base + '/health')).ok; } catch {} if (!up) await new Promise((r) => setTimeout(r, 250)); }
if (!up) await fail('server did not start listening in time');
const checks = [];
const ok = (name, cond) => { checks.push([name, !!cond]); };
ok('health 200', (await j('/health')).status === 200);
ok('ready 200', (await j('/ready')).body?.ready === true);
ok('plain http refused (426)', (await j('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status === 426);
const reg = await j('/auth/register', { method: 'POST', headers: tls, body: JSON.stringify({ email: 'smoke@example.com', password: 'Passw0rdOK' }) });
ok('register 201 over forwarded https', reg.status === 201);
const auth = { ...tls, Authorization: `Bearer ${reg.body?.accessToken}` };
const created = await j('/tasks', { method: 'POST', headers: auth, body: JSON.stringify({ title: 'smoke task', priority: 'high' }) });
ok('create task 201', created.status === 201);
ok('list returns it', (await j('/tasks', { headers: auth })).body?.tasks?.[0]?.title === 'smoke task');
ok('no secrets in request log', !/Passw0rdOK|Bearer|accessToken|refreshToken/.test(out));
ok('request log is JSON lines', /"m":"POST","p":"\/auth\/register","s":201/.test(out));
const failed = checks.filter(([, c]) => !c);
for (const [n, c] of checks) console.log((c ? 'PASS ' : 'FAIL ') + n);
child.kill(); await mongod.stop();
if (failed.length) { console.error('--- server output ---\n' + out); process.exit(1); }
console.log('smoke ok');
