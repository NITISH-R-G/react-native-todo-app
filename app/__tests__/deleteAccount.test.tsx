import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AppThemeProvider } from '../src/design/theme';
import { dropSession, getSession, setSession } from '../src/api/client';
import { useAuth } from '../src/state/authStore';
import { DeleteAccountDialog } from '../src/ui/DeleteAccountDialog';

const json = (status: number, body: unknown) =>
  Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body) } as Response);
let fetchMock: jest.Mock;
const mount = () => render(<AppThemeProvider><DeleteAccountDialog visible onDismiss={() => {}} /></AppThemeProvider>);

beforeEach(async () => {
  await dropSession();
  await setSession({ accessToken: 'a', refreshToken: 'r', user: { id: 'u', email: 'a@example.com' } });
  useAuth.setState({ status: 'signedIn', user: { id: 'u', email: 'a@example.com' }, notice: null });
  fetchMock = jest.fn();
  (globalThis as unknown as { fetch: jest.Mock }).fetch = fetchMock;
});

// Risk: an irreversible action must need the password, show failures, never double-fire, and only sign out after the server confirmed.
describe('delete account', () => {
  it('requires a password before sending anything', async () => {
    await mount();
    await fireEvent.press(await screen.findByTestId('delete-confirm'));
    expect(await screen.findByText('Enter your password to confirm')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useAuth.getState().status).toBe('signedIn');
  });

  it('wrong password: shows the error, keeps the session, deletes nothing locally', async () => {
    fetchMock.mockReturnValue(json(403, { error: { code: 'invalid_credentials', message: 'Invalid password' } }));
    await mount();
    await fireEvent.changeText(await screen.findByTestId('delete-password'), 'WrongPass1');
    await fireEvent.press(screen.getByTestId('delete-confirm'));
    expect(await screen.findByText('That password is not correct.')).toBeTruthy();
    expect(useAuth.getState().status).toBe('signedIn');
    expect(getSession()).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1); // a wrong password must not trigger a token refresh
  });

  it('network failure keeps the user signed in and reports the problem', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    await mount();
    await fireEvent.changeText(await screen.findByTestId('delete-password'), 'Passw0rdOK1');
    await fireEvent.press(screen.getByTestId('delete-confirm'));
    expect(await screen.findByText(/Can’t reach the server/)).toBeTruthy();
    expect(useAuth.getState().status).toBe('signedIn');
  });

  it('success: sends one DELETE with the password, then clears the session and signs out', async () => {
    fetchMock.mockReturnValue(Promise.resolve({ status: 204, ok: true, json: () => Promise.reject(new Error('no body')) } as Response));
    await mount();
    await fireEvent.changeText(await screen.findByTestId('delete-password'), 'Passw0rdOK1');
    await fireEvent.press(screen.getByTestId('delete-confirm'));
    await waitFor(() => expect(useAuth.getState().status).toBe('signedOut'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/auth\/account$/);
    expect(init.method).toBe('DELETE');
    expect(JSON.parse(init.body)).toEqual({ password: 'Passw0rdOK1' });
    expect(getSession()).toBeNull();
    expect(useAuth.getState().notice).toMatch(/deleted/i);
  });

  it('a same-tick double confirm sends a single request', async () => {
    let release: (r: Response) => void = () => {};
    fetchMock.mockImplementation(() => new Promise<Response>((r) => (release = r)));
    await mount();
    await fireEvent.changeText(await screen.findByTestId('delete-password'), 'Passw0rdOK1');
    const press = screen.getByTestId('delete-confirm').props.onClick;
    let taps: Promise<unknown>[] = [];
    await act(async () => { taps = [press(), press()]; });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { release(await json(204, null)); await Promise.all(taps); });
  });
});
