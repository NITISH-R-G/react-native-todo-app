/*
 * Runs before each test file's tests (setupFilesAfterEnv), outside any test's timeout.
 * The first render of a file otherwise pays the cold module-loading cost of React Native, Paper and
 * Testing Library INSIDE the first test, which exceeded the timeout on slow or busy machines.
 * Preloading changes timing only; it has no effect on what any test asserts.
 */
require('react-native');
require('react-native-paper');
require('@react-navigation/native');
require('@react-navigation/native-stack');
require('@testing-library/react-native');
