import React from 'react';
import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { AppThemeProvider } from '../src/design/theme';

let mockError: string | null = null;
jest.mock('../src/config/env', () => ({ API_URL: '', apiConfigError: () => mockError }));
import { ConfigGate } from '../src/ui/ConfigGate';

const mount = () =>
  render(
    <AppThemeProvider>
      <ConfigGate>
        <Text testID="app-root">the app</Text>
      </ConfigGate>
    </AppThemeProvider>,
  );

// Risk: an unconfigured release must show an explanation immediately, never the app (or a login that fails later).
describe('ConfigGate', () => {
  it('shows the config error and NOT the app when the build has no usable API URL', async () => {
    mockError = 'This build has no API server configured.';
    await mount();
    expect(await screen.findByTestId('config-error')).toBeTruthy();
    expect(screen.getByText('This build has no API server configured.')).toBeTruthy();
    expect(screen.queryByTestId('app-root')).toBeNull();
  });

  it('renders the app when the configuration is valid', async () => {
    mockError = null;
    await mount();
    expect(await screen.findByTestId('app-root')).toBeTruthy();
    expect(screen.queryByTestId('config-error')).toBeNull();
  });
});
