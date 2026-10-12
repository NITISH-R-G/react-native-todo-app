import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { useAppTheme } from '../design/theme';
import { shape, spacing } from '../design/tokens';
import { AppText, LargeTitle } from './primitives';

/** Shown instead of the app when the build has no usable API endpoint (e.g. a release built without a production URL). */
export function ConfigErrorScreen({ message }: { message: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]} accessibilityRole="alert" testID="config-error">
      <View style={[styles.badge, { backgroundColor: colors.errorContainer }]}>
        <Icon source="server-off" size={40} color={colors.onErrorContainer} />
      </View>
      <LargeTitle style={styles.title}>Not configured</LargeTitle>
      <AppText variant="bodyLarge" tone="onSurfaceVariant" style={styles.text}>
        {message}
      </AppText>
      <AppText variant="bodyMedium" tone="onSurfaceVariant" style={styles.text}>
        This is a build problem, not a problem with your account. Install an official release of the app.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  badge: { width: 80, height: 80, borderRadius: shape.full, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: spacing.xl, textAlign: 'center' },
  text: { marginTop: spacing.md, textAlign: 'center' },
});
