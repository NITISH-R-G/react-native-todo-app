import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppThemeProvider } from '../src/design/theme';
import { dropSession, setSession } from '../src/api/client';
import { TasksList } from '../src/screens/TasksList';
import { useTasks } from '../src/state/tasksStore';

const json = (status: number, body: unknown) =>
  Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) } as Response);
const task = (id: string, o: object = {}) => ({
  id, title: id, description: '', startAt: '2030-01-01T00:00:00.000Z', deadline: null, priority: 'medium', tags: [],
  completed: false, completedAt: null, overdue: false, createdAt: '', updatedAt: '', ...o,
});
let fetchMock: jest.Mock;
const mount = () =>
  render(
    <AppThemeProvider>
      <TasksList onEdit={() => {}} onToggled={() => {}} onError={() => {}} />
    </AppThemeProvider>,
  );

beforeEach(async () => {
  await dropSession();
  await setSession({ accessToken: 'a', refreshToken: 'r', user: { id: 'u', email: 'a@example.com' } });
  useTasks.getState().reset();
  fetchMock = jest.fn();
  (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

// Risk: a failed refresh must be visible (not silent) and recoverable, without hiding the cached tasks.
describe('task list failure and filter states', () => {
  it('failed refresh with cached tasks shows a banner, keeps the tasks, and Retry recovers', async () => {
    useTasks.setState({ tasks: [task('Cached task')] as never, status: 'error', error: 'Can’t reach the server. Check your connection and try again.' });
    await mount();
    expect(await screen.findByTestId('error-banner')).toBeTruthy();
    expect(screen.getByText('Cached task')).toBeTruthy();
    fetchMock.mockReturnValue(json(200, { tasks: [task('Cached task'), task('Fresh task')] }));
    await fireEvent.press(screen.getByTestId('banner-retry'));
    await waitFor(() => expect(screen.queryByTestId('error-banner')).toBeNull());
    expect(screen.getByText('Fresh task')).toBeTruthy();
  });

  it('with no cached tasks, a failed load shows the full error state with a working Try again', async () => {
    useTasks.setState({ tasks: [], status: 'error', error: 'Can’t reach the server. Check your connection and try again.' });
    await mount();
    expect(await screen.findByText(/Can’t reach the server/)).toBeTruthy();
    fetchMock.mockReturnValue(json(200, { tasks: [] }));
    await fireEvent.press(screen.getByTestId('retry-button'));
    expect(await screen.findByTestId('empty-state')).toBeTruthy();
  });

  it('filters that match nothing show a clear message and Clear filters restores the list', async () => {
    useTasks.setState({ tasks: [task('Open one')] as never, status: 'ready', filters: { status: 'completed', category: null } });
    await mount();
    expect(await screen.findByTestId('no-matches')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('clear-filters'));
    expect(await screen.findByText('Open one')).toBeTruthy();
  });

  it('status chips show live counts and apply composed filters', async () => {
    useTasks.setState({
      tasks: [task('A', { tags: ['work'] }), task('B', { tags: ['work'], completed: true }), task('C', { tags: ['home'] })] as never,
      status: 'ready',
    });
    await mount();
    expect(await screen.findByLabelText('All 3')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('filter-category-work'));
    expect(screen.getByLabelText('All 2')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('filter-status-completed'));
    expect(screen.getByText('B')).toBeTruthy();
    expect(screen.queryByText('A')).toBeNull();
    expect(screen.queryByText('C')).toBeNull();
  });
});
