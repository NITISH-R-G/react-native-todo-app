import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { useAppTheme } from '../design/theme';
import { shape, spacing, touchTarget } from '../design/tokens';
import { AppText } from './primitives';

/** Material 3 filter chip: outlined when off, tonal with a check when on. 48dp tall touch target around a 32dp chip. */
export function FilterChip({
  label,
  selected,
  onPress,
  icon,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: string;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  const fg = selected ? colors.onSecondaryContainer : colors.onSurfaceVariant;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      testID={testID}
      style={styles.hit}>
      <View
        style={[
          styles.chip,
          selected
            ? { backgroundColor: colors.secondaryContainer, borderColor: colors.secondaryContainer }
            : { backgroundColor: 'transparent', borderColor: colors.outline },
        ]}>
        {selected ? <Icon source="check" size={16} color={fg} /> : icon ? <Icon source={icon} size={16} color={fg} /> : null}
        <AppText variant="labelLarge" style={{ color: fg, marginLeft: selected || icon ? 6 : 0 }}>
          {label}
        </AppText>
      </View>
    </Pressable>
  );
}

/** Horizontally scrolling row of chips with consistent spacing. */
export function ChipRow({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={label}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.lg, alignItems: 'center' },
  hit: { minHeight: touchTarget, justifyContent: 'center', marginRight: spacing.sm },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: shape.small,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
});
