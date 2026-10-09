import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { useAppTheme } from '../design/theme';
import { shape, touchTarget, typography } from '../design/tokens';
import { AppText } from './primitives';

export interface Option<T extends string> {
  value: T;
  label: string;
  /** Accent used for the selected state (e.g. priority colour). Defaults to the secondary container. */
  accent?: string;
}

/**
 * Connected segmented button group (Material 3 "connected button group" look):
 * one pill outline, segments share borders, the selected segment shows a check and a tinted fill.
 */
export function ConnectedButtonGroup<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[styles.row, { borderColor: colors.outline, borderRadius: shape.full }]}>
      {options.map((o, i) => {
        const selected = o.value === value;
        const fg = selected ? (o.accent ?? colors.onSecondaryContainer) : colors.onSurface;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${label}: ${o.label}`}
            onPress={() => onChange(o.value)}
            android_ripple={{ color: colors.secondaryContainer }}
            style={[
              styles.segment,
              i > 0 && { borderLeftWidth: 1, borderLeftColor: colors.outline },
              selected && { backgroundColor: o.accent ? `${o.accent}26` : colors.secondaryContainer },
            ]}>
            {selected ? <Icon source="check" size={18} color={fg} /> : null}
            <AppText variant="labelLarge" style={[typography.labelLarge, { color: fg, marginLeft: selected ? 6 : 0 }]}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderWidth: 1, overflow: 'hidden' },
  segment: {
    flex: 1,
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
});
