import { groupTasks, completionPercent } from '../src/domain/grouping';
import type { Task } from '../src/domain/types';
import { validateLogin, validateRegister, validateTask } from '../src/domain/validation';

const task = (o: Partial<Task>): Task => ({
  id: 'x',
  title: 't',
  description: '',
  startAt: '2030-01-01T10:00:00.000Z',
  deadline: null,
  priority: 'medium',
  tags: [],
  completed: false,
  completedAt: null,
  overdue: false,
  createdAt: '2030-01-01T00:00:00.000Z',
  updatedAt: '2030-01-01T00:00:00.000Z',
  ...o,
});

// Risk: client-side rules drifting from the backend rules (which would show wrong inline errors).
describe('validation mirrors backend rules', () => {
  it.each([
    ['', 'Enter your email'],
    ['not-an-email', 'Enter a valid email address'],
    ['a@b', 'Enter a valid email address'],
  ])('rejects email %p', (email, msg) => {
    expect(validateRegister(email, 'Passw0rdOK').email).toBe(msg);
  });

  it.each([
    ['short1', 'Use at least 8 characters'],
    ['allletters', 'Include at least one digit'],
    ['12345678', 'Include at least one letter'],
  ])('rejects password %p', (pw, msg) => {
    expect(validateRegister('a@example.com', pw).password).toBe(msg);
  });

  it('login only requires a non-empty password (server decides correctness)', () => {
    expect(validateLogin('a@example.com', 'x')).toEqual({});
    expect(validateLogin('a@example.com', '').password).toBeTruthy();
  });

  it('task: title required, deadline may not precede start, past deadline is allowed', () => {
    const start = new Date('2030-01-02T10:00:00Z');
    const base = { title: 'x', description: '', startAt: start, deadline: null, priority: 'medium' as const };
    expect(validateTask({ ...base, title: '   ' }).title).toBeTruthy();
    expect(validateTask({ ...base, deadline: new Date('2030-01-02T09:59:00Z') }).deadline).toBeTruthy();
    expect(validateTask({ ...base, deadline: start })).toEqual({}); // equal is allowed (matches server >=)
    expect(validateTask({ ...base, startAt: new Date('2000-01-01'), deadline: new Date('2000-01-02') })).toEqual({});
    expect(validateTask({ ...base, startAt: new Date('nope') }).startAt).toBeTruthy();
  });
});

describe('task grouping', () => {
  const now = new Date('2030-01-01T12:00:00');
  it('keeps server order inside sections and orders sections overdue, today, upcoming, completed', () => {
    const sections = groupTasks(
      [
        task({ id: 'c', completed: true }),
        task({ id: 'u1', startAt: '2030-02-01T10:00:00' }),
        task({ id: 'o', overdue: true, deadline: '2029-12-01T10:00:00' }),
        task({ id: 't', startAt: '2030-01-01T18:00:00' }),
        task({ id: 'u2', startAt: '2030-03-01T10:00:00' }),
      ],
      now,
    );
    expect(sections.map((s) => s.key)).toEqual(['overdue', 'today', 'upcoming', 'completed']);
    expect(sections[2]!.data.map((t) => t.id)).toEqual(['u1', 'u2']);
  });
  it('omits empty sections and computes progress', () => {
    expect(groupTasks([], now)).toEqual([]);
    expect(completionPercent([])).toBe(0);
    expect(completionPercent([task({ completed: true }), task({}), task({}), task({})])).toBe(25);
  });
});
