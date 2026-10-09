import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { MD3DarkTheme, MD3LightTheme, PaperProvider, type MD3Theme } from 'react-native-paper';
import { darkColors, lightColors, shape, type ColorRoles } from './tokens';

export interface AppTheme {
  dark: boolean;
  colors: ColorRoles;
}

const AppThemeContext = createContext<AppTheme>({ dark: false, colors: lightColors });

/** Access the typed Material 3 color roles. Prefer this over reaching into Paper's theme. */
export const useAppTheme = (): AppTheme => useContext(AppThemeContext);

function toPaperTheme(dark: boolean, c: ColorRoles): MD3Theme {
  const base = dark ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    roundness: shape.large / 4, // Paper multiplies by 4 for MD3
    colors: {
      ...base.colors,
      primary: c.primary,
      onPrimary: c.onPrimary,
      primaryContainer: c.primaryContainer,
      onPrimaryContainer: c.onPrimaryContainer,
      secondary: c.secondary,
      onSecondary: c.onSecondary,
      secondaryContainer: c.secondaryContainer,
      onSecondaryContainer: c.onSecondaryContainer,
      tertiary: c.tertiary,
      onTertiary: c.onTertiary,
      tertiaryContainer: c.tertiaryContainer,
      onTertiaryContainer: c.onTertiaryContainer,
      error: c.error,
      onError: c.onError,
      errorContainer: c.errorContainer,
      onErrorContainer: c.onErrorContainer,
      background: c.background,
      onBackground: c.onBackground,
      surface: c.surface,
      onSurface: c.onSurface,
      surfaceVariant: c.surfaceVariant,
      onSurfaceVariant: c.onSurfaceVariant,
      outline: c.outline,
      outlineVariant: c.outlineVariant,
      inverseSurface: c.inverseSurface,
      inverseOnSurface: c.inverseOnSurface,
      scrim: c.scrim,
      elevation: {
        level0: 'transparent',
        level1: c.surfaceContainer,
        level2: c.surfaceContainer,
        level3: c.surfaceContainerHigh,
        level4: c.surfaceContainerHigh,
        level5: c.surfaceContainerHigh,
      },
    },
  };
}

/** Provides both the typed app theme and the Paper (Material 3) theme; follows the system light/dark setting. */
export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const value = useMemo<AppTheme>(() => ({ dark, colors: dark ? darkColors : lightColors }), [dark]);
  const paper = useMemo(() => toPaperTheme(dark, value.colors), [dark, value.colors]);
  return (
    <AppThemeContext.Provider value={value}>
      <PaperProvider theme={paper}>{children}</PaperProvider>
    </AppThemeContext.Provider>
  );
}
