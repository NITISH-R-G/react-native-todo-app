const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Gradle creates and deletes thousands of files under android/**/build and android/.gradle while building;
    // Metro's file watcher must ignore them (watching them produced "Cannot read properties of undefined
    // (reading 'get')" inside Metro's DependencyGraph during a concurrent release build).
    blockList: [/android[\\/].*[\\/]build[\\/].*/, /android[\\/]\.gradle[\\/].*/, /ios[\\/]Pods[\\/].*/],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
