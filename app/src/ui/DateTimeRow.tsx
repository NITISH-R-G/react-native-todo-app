import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Icon } from 'react-native-paper';
import { useAppTheme } from '../design/theme';
import { shape, spacing, touchTarget } from '../design/tokens';
import { AppText } from './primitives';

/** Opens the native Material date picker, then the time picker, and returns the combined Date. */
export function pickDateTime(initial: Date, onPicked: (d: Date) => void): void {
  DateTimePickerAndroid.open({
    value: initial,
    mode: 'date',
    onValueChange: (_e, date) => {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'time',
        onValueChange: (_e2, time) => {
          const merged = new Date(date);
          merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
          onPicked(merged);
        },
      });
    },
  });
}

const fmt = (d: Date) =>
  d.toLocaleString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Reference-style settings row: tonal icon tile, label, value, trailing pencil. */
export function DateTimeRow({
  label,
  icon,
  value,
  error,
  onChange,
}: {
  label: string;
  icon: string;
  value: Date;
  error?: string;
  onChange: (d: Date) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${fmt(value)}. Double tap to change`}
        onPress={() => pickDateTime(value, onChange)}
        android_ripple={{ color: colors.secondaryContainer }}
        style={[styles.row, { backgroundColor: colors.surfaceContainer, borderRadius: shape.large }]}>
        <View style={[styles.tile, { backgroundColor: colors.secondaryContainer }]}>
          <Icon source={icon} size={24} color={colors.onSecondaryContainer} />
        </View>
        <View style={styles.text}>
          <AppText variant="titleMedium">{label}</AppText>
          <AppText variant="bodyMedium" tone="onSurfaceVariant">
            {fmt(value)}
          </AppText>
        </View>
        <Icon source="pencil" size={22} color={colors.onSurfaceVariant} />
      </Pressable>
      {error ? (
        <AppText variant="bodyMedium" tone="error" style={styles.err} accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, minHeight: touchTarget + 16 },
  tile: { width: 48, height: 48, borderRadius: shape.medium, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, marginLeft: spacing.lg },
  err: { marginTop: spacing.xs, marginLeft: spacing.lg },
});
