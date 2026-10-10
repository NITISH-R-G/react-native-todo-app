import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Icon } from 'react-native-paper';
import { useAppTheme } from '../design/theme';
import { shape, spacing } from '../design/tokens';
import { AppText } from './primitives';

/**
 * Inline notice for a failed background refresh while cached tasks are still shown.
 * (Offline task creation/sync is NOT implemented: the list is a read-only cache until the server answers.)
 */
export function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.box, { backgroundColor: colors.errorContainer, borderRadius: shape.large }]}
      testID="error-banner">
      <Icon source="cloud-off-outline" size={22} color={colors.onErrorContainer} />
      <AppText variant="bodyMedium" style={[styles.text, { color: colors.onErrorContainer }]}>
        {message} Showing your last loaded tasks.
      </AppText>
      <Button compact mode="text" textColor={colors.onErrorContainer} onPress={onRetry} testID="banner-retry">
        Retry
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.sm, paddingVertical: spacing.sm, paddingLeft: spacing.md, paddingRight: spacing.xs },
  text: { flex: 1, marginHorizontal: spacing.sm },
});
