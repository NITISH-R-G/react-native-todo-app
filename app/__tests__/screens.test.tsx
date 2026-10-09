import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AppThemeProvider } from '../src/design/theme';
import { dropSession } from '../src/api/client';
import { useAuth } from '../src/state/authStore';
import { useTasks } from '../src/state/tasksStore';
import { LoginScreen, RegisterScreen } from '../src/screens/AuthScreens';
import { TaskFormScreen } from '../src/screens/TaskFormScreen';
import type { RootStackParamList } from '../src/navigation/types';

const Stack = createNativeStackNavigator<RootStackParamList>();
function Harness({ initial, params }: { initial: keyof RootStackParamList; params?: RootStackParamList['TaskForm'] }) {
  return (
    <AppThemeProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initial} screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="TaskForm" component={TaskFormScreen} initialParams={params} />
        </Stack.Navigator>
      </NavigationContainer>
    </AppThemeProvider>
  );
}

const json = (status: number, body: unknown) =>
  Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) } as Response);
let fetchMock: jest.Mock;
beforeEach(async () => {
  await dropSession();
  useAuth.setState({ status: 'signedOut', user: null, notice: null });
  useTasks.getState().reset();
  fetchMock = jest.fn();
  (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

// Risk: bad input reaching the server, and double-submits creating duplicate accounts.
describe('Register screen', () => {
  it('shows inline errors and sends nothing for an invalid email and weak password', async () => {
    await render(<Harness initial="Register" />);
    await fireEvent.changeText(await screen.findByTestId('email-input'), 'nope');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'short');
    await fireEvent.press(screen.getByTestId('submit-button'));
    expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
    expect(screen.getByText('Use at least 8 characters')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('submits exactly once on rapid double taps, then signs in with the server response', async () => {
    let release: (r: Response) => void = () => {};
    fetchMock.mockImplementation(() => new Promise<Response>((res) => (release = res)));
    await render(<Harness initial="Register" />);
    await fireEvent.changeText(await screen.findByTestId('email-input'), 'new@example.com');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'Passw0rdOK');
    // Two presses in the same tick (before React can re-render the disabled state): only the in-flight guard can stop the second.
    // (keyboard "done" submits through the same handler as the button)
    const press = screen.getByTestId('password-input').props.onSubmitEditing as () => Promise<void>;
    let taps: Promise<void>[] = [];
    await act(async () => {
      taps = [press(), press()];
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'new@example.com', password: 'Passw0rdOK' });
    await act(async () => {
      release(await json(201, { user: { id: 'u1', email: 'new@example.com' }, accessToken: 'a', refreshToken: 'r' }));
    });
    await act(async () => {
      await Promise.all(taps);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(useAuth.getState().status).toBe('signedIn'));
  });

  it('shows a friendly message when the email is already registered', async () => {
    fetchMock.mockReturnValue(json(409, { error: { code: 'email_taken', message: 'Email already registered' } }));
    await render(<Harness initial="Register" />);
    await fireEvent.changeText(await screen.findByTestId('email-input'), 'dup@example.com');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'Passw0rdOK');
    await fireEvent.press(screen.getByTestId('submit-button'));
    expect(await screen.findByText(/already registered/i)).toBeTruthy();
    expect(useAuth.getState().status).toBe('signedOut');
  });
});

describe('Login screen', () => {
  it('shows the server failure without crashing and re-enables the button', async () => {
    fetchMock.mockReturnValue(json(401, { error: { code: 'invalid_credentials', message: 'Invalid email or password' } }));
    await render(<Harness initial="Login" />);
    await fireEvent.changeText(await screen.findByTestId('email-input'), 'a@example.com');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'WrongPass1');
    await fireEvent.press(screen.getByTestId('submit-button'));
    expect(await screen.findByText('Invalid email or password')).toBeTruthy();
    expect(screen.getByTestId('submit-button').props.accessibilityState?.disabled).toBeFalsy();
  });

  it('reports a network failure as a connectivity message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await render(<Harness initial="Login" />);
    await fireEvent.changeText(await screen.findByTestId('email-input'), 'a@example.com');
    await fireEvent.changeText(screen.getByTestId('password-input'), 'Passw0rdOK');
    await fireEvent.press(screen.getByTestId('submit-button'));
    expect(await screen.findByText(/Can’t reach the server/)).toBeTruthy();
  });
});

describe('Task form', () => {
  it('requires a title and sends nothing', async () => {
    await render(<Harness initial="TaskForm" />);
    await fireEvent.press(await screen.findByTestId('save-task'));
    expect(await screen.findByText('Give your task a title')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a deadline before the start time chosen through the date/time pickers', async () => {
    const open = DateTimePickerAndroid.open as jest.Mock;
    await render(<Harness initial="TaskForm" />);
    await fireEvent.changeText(await screen.findByTestId('title-input'), 'Pay rent');
    await fireEvent(screen.getByTestId('deadline-switch'), 'valueChange', true);
    // Drive the deadline row's date -> time dialogs with a moment well before "now".
    await fireEvent.press(await screen.findByLabelText(/^Deadline: /));
    const earlier = new Date('2000-01-01T08:00:00');
    await act(async () => open.mock.calls.at(-1)[0].onValueChange({}, earlier)); // date step opens the time step
    await act(async () => open.mock.calls.at(-1)[0].onValueChange({}, earlier)); // time step commits
    await fireEvent.press(screen.getByTestId('save-task'));
    expect(await screen.findByText('Deadline can’t be before the start time')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates the task with every mandatory field and the selected priority', async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      if (init.method === 'POST') return json(201, { task: { id: 't1' } });
      return json(200, { tasks: [] });
    });
    useAuth.setState({ status: 'signedIn', user: { id: 'u', email: 'a@example.com' } });
    const { setSession } = require('../src/api/client');
    await setSession({ accessToken: 'a', refreshToken: 'r', user: { id: 'u', email: 'a@example.com' } });
    await render(<Harness initial="TaskForm" />);
    await fireEvent.changeText(await screen.findByTestId('title-input'), '  Ship report ');
    await fireEvent.changeText(screen.getByTestId('description-input'), 'Q3 numbers');
    await fireEvent.press(screen.getByLabelText('Priority: High'));
    await fireEvent.press(screen.getByTestId('save-task'));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i.method === 'POST')).toBe(true));
    const post = fetchMock.mock.calls.find(([, i]) => i.method === 'POST')!;
    const body = JSON.parse(post[1].body);
    expect(body).toMatchObject({ title: 'Ship report', description: 'Q3 numbers', priority: 'high', deadline: null });
    expect(new Date(body.startAt).getTime()).not.toBeNaN();
  });
});

const existingTask = {
  id: 't-1', title: 'Original title', description: 'Original desc', startAt: '2030-03-01T10:00:00.000Z', deadline: '2030-03-02T10:00:00.000Z',
  priority: 'low', tags: ['work', 'extra'], completed: false, completedAt: null, overdue: false, createdAt: '', updatedAt: '',
};
async function signedInWithTask() {
  const { setSession } = require('../src/api/client');
  await setSession({ accessToken: 'a', refreshToken: 'r', user: { id: 'u', email: 'a@example.com' } });
  useAuth.setState({ status: 'signedIn', user: { id: 'u', email: 'a@example.com' } });
  useTasks.setState({ tasks: [existingTask as never], status: 'ready' });
}

// Risk: editing must show current values, send only a valid change, never mutate on cancel, and survive a task deleted elsewhere.
describe('Task edit', () => {
  it('pre-fills every field from the stored task and keeps extra tags when saving', async () => {
    await signedInWithTask();
    fetchMock.mockImplementation((_u: string, init: RequestInit) => (init.method === 'PATCH' ? json(200, { task: existingTask }) : json(200, { tasks: [existingTask] })));
    await render(<Harness initial="TaskForm" params={{ taskId: 't-1' }} />);
    expect((await screen.findByTestId('title-input')).props.value).toBe('Original title');
    expect(screen.getByTestId('description-input').props.value).toBe('Original desc');
    expect(screen.getByLabelText('Priority: Low').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('category-work')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('title-input'), 'Edited title');
    await fireEvent.press(screen.getByTestId('category-study'));
    await fireEvent.press(screen.getByTestId('save-task'));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => i.method === 'PATCH')).toBe(true));
    const [url, init] = fetchMock.mock.calls.find(([, i]) => i.method === 'PATCH')!;
    expect(url).toMatch(/\/tasks\/t-1$/);
    expect(JSON.parse(init.body)).toMatchObject({ title: 'Edited title', priority: 'low', tags: ['study', 'extra'], deadline: '2030-03-02T10:00:00.000Z' });
  });

  it('cancelling (Back) sends no request and leaves the stored task untouched', async () => {
    await signedInWithTask();
    await render(<Harness initial="TaskForm" params={{ taskId: 't-1' }} />);
    await fireEvent.changeText(await screen.findByTestId('title-input'), 'Unsaved change');
    await fireEvent.press(screen.getByLabelText('Back'));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useTasks.getState().tasks[0]!.title).toBe('Original title');
  });

  it('clearing the title shows an error and sends nothing', async () => {
    await signedInWithTask();
    await render(<Harness initial="TaskForm" params={{ taskId: 't-1' }} />);
    await fireEvent.changeText(await screen.findByTestId('title-input'), '   ');
    await fireEvent.press(screen.getByTestId('save-task'));
    expect(await screen.findByText('Give your task a title')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a same-tick double save sends a single PATCH', async () => {
    await signedInWithTask();
    let release: (r: Response) => void = () => {};
    fetchMock.mockImplementation((_u: string, init: RequestInit) => (init.method === 'PATCH' ? new Promise<Response>((r) => (release = r)) : json(200, { tasks: [existingTask] })));
    await render(<Harness initial="TaskForm" params={{ taskId: 't-1' }} />);
    await fireEvent.changeText(await screen.findByTestId('title-input'), 'Once only');
    const save = screen.getByTestId('save-task').props.onPress ?? screen.getByTestId('save-task').props.onClick;
    let taps: Promise<unknown>[] = [];
    await act(async () => {
      taps = [save?.(), save?.()];
    });
    expect(fetchMock.mock.calls.filter(([, i]) => i.method === 'PATCH')).toHaveLength(1);
    await act(async () => {
      release(await json(200, { task: existingTask }));
      await Promise.all(taps);
    });
  });

  it('a task deleted elsewhere (404) shows a clear message, refreshes the list and disables Save', async () => {
    await signedInWithTask();
    fetchMock.mockImplementation((_u: string, init: RequestInit) =>
      init.method === 'PATCH' ? json(404, { error: { code: 'not_found', message: 'Task not found' } }) : json(200, { tasks: [] }),
    );
    await render(<Harness initial="TaskForm" params={{ taskId: 't-1' }} />);
    await fireEvent.changeText(await screen.findByTestId('title-input'), 'Too late');
    await fireEvent.press(screen.getByTestId('save-task'));
    expect(await screen.findByText(/no longer exists/i)).toBeTruthy();
    await waitFor(() => expect(useTasks.getState().tasks).toEqual([]));
    expect(screen.getByTestId('save-task').props.accessibilityState?.disabled).toBe(true);
  });

  it('opening the editor for a task that is not in the list explains it instead of crashing', async () => {
    useTasks.setState({ tasks: [], status: 'ready' });
    await render(<Harness initial="TaskForm" params={{ taskId: 'missing' }} />);
    expect(await screen.findByText(/no longer exists/i)).toBeTruthy();
  });
});

describe('Task create duplicate protection', () => {
  it('a same-tick double save of a NEW task sends a single POST (no duplicate task)', async () => {
    await signedInWithTask();
    useTasks.setState({ tasks: [], status: 'ready' });
    let release: (r: Response) => void = () => {};
    fetchMock.mockImplementation((_u: string, init: RequestInit) => (init.method === 'POST' ? new Promise<Response>((r) => (release = r)) : json(200, { tasks: [] })));
    await render(<Harness initial="TaskForm" />);
    await fireEvent.changeText(await screen.findByTestId('title-input'), 'Only once');
    const save = screen.getByTestId('save-task').props.onClick;
    let taps: Promise<unknown>[] = [];
    await act(async () => {
      taps = [save(), save()];
    });
    expect(fetchMock.mock.calls.filter(([, i]) => i.method === 'POST')).toHaveLength(1);
    await act(async () => {
      release(await json(201, { task: existingTask }));
      await Promise.all(taps);
    });
  });
});
