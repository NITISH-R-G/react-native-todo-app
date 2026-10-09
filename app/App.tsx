import React, { useEffect } from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppThemeProvider, useAppTheme } from './src/design/theme';
import type { RootStackParamList } from './src/navigation/types';
import { LoginScreen, RegisterScreen } from './src/screens/AuthScreens';
import { HomeScreen } from './src/screens/HomeScreen';
import { TaskFormScreen } from './src/screens/TaskFormScreen';
import { useAuth } from './src/state/authStore';
import { useTasks } from './src/state/tasksStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Auth gate: the protected screens are only mounted while signed in, so a signed-out (or expired)
 * session can never render them. Switching `status` swaps the whole navigator tree.
 */
function Root() {
  const { colors, dark } = useAppTheme();
  const status = useAuth((s) => s.status);
  const boot = useAuth((s) => s.boot);
  const resetTasks = useTasks((s) => s.reset);

  useEffect(() => {
    boot();
  }, [boot]);
  useEffect(() => {
    if (status === 'signedOut') resetTasks(); // never show a previous user's tasks
  }, [status, resetTasks]);

  if (status === 'booting') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} accessibilityLabel="Loading" />
      </View>
    );
  }
  return (
    <NavigationContainer>
      <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }}>
        {status === 'signedIn' ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="TaskForm" component={TaskFormScreen} options={{ animation: 'slide_from_bottom' }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppThemeProvider>
        <Root />
      </AppThemeProvider>
    </SafeAreaProvider>
  );
}
