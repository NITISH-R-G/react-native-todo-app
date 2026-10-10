// Seeds the Sprint 1 test user with tasks that exercise overdue / completed / categories / priority lead.
// Usage: node seed.mjs <email> <password>   (dev API on http://localhost:4000)
const [email, password] = process.argv.slice(2);
const base = 'http://localhost:4000';
const h = (n) => new Date(Date.now() + n * 3_600_000).toISOString();
const j = async (path, init) => (await fetch(base + path, init)).json();
const { accessToken } = await j('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
const post = async (b) => (await j('/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(b) })).task;
const seeds = [
  { title: 'Overdue invoice', priority: 'medium', startAt: h(-72), deadline: h(-5), tags: ['work'] },
  { title: 'Study for exam', priority: 'high', deadline: h(48), tags: ['study'] },
  { title: 'Buy groceries', priority: 'low', deadline: h(30), tags: ['shopping'] },
  { title: 'Call mom', priority: 'low', tags: ['general'] },
];
for (const s of seeds) console.log('created', (await post(s)).title);
const done = await post({ title: 'Book flights', priority: 'high', tags: ['travel'] });
await j(`/tasks/${done.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ completed: true }) });
console.log('created + completed', done.title);
