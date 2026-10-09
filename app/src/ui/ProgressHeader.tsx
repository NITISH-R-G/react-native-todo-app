import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../design/theme';
import { motion, shape, spacing } from '../design/tokens';
import { AppText } from './primitives';

/**
 * Progress label, percentage and a thick rounded bar that animates between values.
 * DECISION: a plain animated bar; the reference's wavy indicator needs an SVG/Skia dependency
 * that is not justified for this sprint (tracked in docs/requirements.md as UI-001 backlog).
 */
export function ProgressHeader({ percent }: { percent: number }) {
  const { colors } = useAppTheme();
  const anim = useRef(new Animated.Value(percent)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: percent,
      duration: motion.emphasized,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [percent, anim]);
  const width = anim.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Task completion progress"
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={styles.wrap}>
      <View style={styles.row}>
        <AppText variant="titleMedium" tone="onSurfaceVariant">
          Progress
        </AppText>
        <AppText variant="titleMedium" tone="primary">
          {percent}%
        </AppText>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
        <Animated.View style={[styles.fill, { width, backgroundColor: colors.primary }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  track: { height: 12, borderRadius: shape.full, overflow: 'hidden' },
  fill: { height: 12, borderRadius: shape.full },
});
