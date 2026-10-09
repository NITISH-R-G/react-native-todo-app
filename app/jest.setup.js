/* Test doubles for native modules only. App code (stores, API client, screens) always runs for real. */

// In-memory stand-in for the Android Keystore-backed keychain.
jest.mock('react-native-keychain', () => {
  const store = new Map();
  return {
    __store: store,
    setGenericPassword: jest.fn(async (username, password, opts = {}) => {
      store.set(opts.service ?? 'default', { username, password });
      return { service: opts.service, storage: 'mock' };
    }),
    getGenericPassword: jest.fn(async (opts = {}) => store.get(opts.service ?? 'default') ?? false),
    resetGenericPassword: jest.fn(async (opts = {}) => store.delete(opts.service ?? 'default')),
  };
});

jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);

// Native date/time dialogs cannot run in Jest; tests drive them through this controllable fake.
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: 'DateTimePicker',
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn() },
}));

// Icon font glyphs are irrelevant in tests; this avoids Paper's "no icon library" warning noise.
jest.mock('@react-native-vector-icons/material-design-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { __esModule: true, default: ({ name }) => React.createElement(Text, null, name), MaterialDesignIcons: ({ name }) => React.createElement(Text, null, name) };
});
