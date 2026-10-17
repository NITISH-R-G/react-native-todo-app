module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.warmup.js'],
  // A cold transform cache makes the first test of a file slow (seen: 5s timeout on a clean run), so allow more.
  testTimeout: 20000,
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|react-native-.*|@react-navigation|@react-native-vector-icons)/)',
  ],
};
