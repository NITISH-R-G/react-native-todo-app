import React, { useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { Icon, Menu } from 'react-native-paper';
import { categoryOf, displayCategory, isOverdue } from '../domain/filters';
import { formatWhen } from '../domain/grouping';
import type { Task } from '../domain/types';
import { useAppTheme } from '../design/theme';
import { shape, spacing, touchTarget } from '../design/tokens';
import { AppText } from './primitives';
import { useReduceMotion } from './useReduceMotion';

function Chip({ icon, label, tone }: { icon: string; label: string; tone?: 'error' }) {
  const { colors } = useAppTheme();
  const bg = tone === 'error' ? colors.errorContainer : colors.surfaceVariant;
  const fg = tone === 'error' ? colors.onErrorContainer : colors.onSurfaceVariant;
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Icon source={icon} size={14} color={fg} />
      <AppText variant="labelMedium" style={[styles.chipText, { color: fg }]}>
        {label}
      </AppText>
    </View>
  );
}

/** Rounded-square checkbox tile with a small spring on toggle. */
function CheckTile({ checked, disabled, onPress, title }: { checked: boolean; disabled: boolean; onPress: () => void; title: string }) {
  const { colors } = useAppTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const reduceMotion = useReduceMotion();
  const press = () => {
    if (!reduceMotion) Animated.sequence([
      Animated.timing(scale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
    onPress();
  };
  return (
    <Pressable
      onPress={press}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="checkbox"
      accessibilityLabel={`${checked ? 'Mark incomplete' : 'Mark complete'}: ${title}`}
      accessibilityState={{ checked, disabled }}
      style={styles.tileHit}>
      <Animated.View
        style={[
          styles.tile,
          { backgroundColor: colors.secondaryContainer, borderRadius: shape.medium, transform: [{ scale }], opacity: disabled ? 0.5 : 1 },
        ]}>
        <View
          style={[
            styles.box,
            checked ? { backgroundColor: colors.primary, borderColor: colors.primary } : { borderColor: colors.onSurfaceVariant },
          ]}>
          {checked ? <Icon source="check" size={18} color={colors.onPrimary} /> : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

export function TaskCard({
  task,
  busy,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { colors } = useAppTheme();
  const [menu, setMenu] = useState(false);
  const accent = { high: colors.priorityHigh, medium: colors.priorityMedium, low: colors.priorityLow }[task.priority];
  return (
    <View
      style={[styles.card, { backgroundColor: colors.surfaceContainer, borderRadius: shape.extraLarge }]}
      accessible={false}>
      <View style={[styles.stripe, { backgroundColor: accent }]} accessibilityElementsHidden importantForAccessibility="no" />
      <CheckTile checked={task.completed} disabled={busy} onPress={onToggle} title={task.title} />
      <Pressable style={styles.body} onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${task.title}, ${task.priority} priority`}>
        <AppText
          variant="titleMedium"
          style={task.completed ? { textDecorationLine: 'line-through', opacity: 0.6 } : undefined}
          numberOfLines={2}>
          {task.title}
        </AppText>
        {task.description ? (
          <AppText variant="bodyMedium" tone="onSurfaceVariant" numberOfLines={1}>
            {task.description}
          </AppText>
        ) : null}
        <View style={styles.chips}>
          <Chip icon="flag" label={task.priority[0]!.toUpperCase() + task.priority.slice(1)} />
          <Chip icon="tag-outline" label={displayCategory(categoryOf(task))} />
          <Chip icon="calendar-start" label={formatWhen(task.startAt)} />
          {task.deadline ? <Chip icon="calendar-alert" label={`Due ${formatWhen(task.deadline)}`} tone={isOverdue(task, new Date()) ? 'error' : undefined} /> : null}
        </View>
      </Pressable>
      <Menu
        visible={menu}
        onDismiss={() => setMenu(false)}
        anchor={
          <Pressable onPress={() => setMenu(true)} accessibilityRole="button" accessibilityLabel={`More options for ${task.title}`} style={styles.more}>
            <Icon source="dots-vertical" size={24} color={colors.onSurfaceVariant} />
          </Pressable>
        }>
        <Menu.Item
          leadingIcon="pencil"
          title="Edit"
          onPress={() => {
            setMenu(false);
            onEdit();
          }}
        />
        <Menu.Item
          leadingIcon="delete-outline"
          title="Delete"
          onPress={() => {
            setMenu(false);
            onDelete();
          }}
        />
      </Menu>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, paddingVertical: spacing.md, paddingRight: spacing.sm, overflow: 'hidden' },
  stripe: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 8 },
  tileHit: { minWidth: touchTarget, minHeight: touchTarget, justifyContent: 'center', alignItems: 'center', marginLeft: spacing.lg },
  tile: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: spacing.md, minHeight: touchTarget },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 3, minHeight: 26, borderRadius: shape.full, flexShrink: 0, maxWidth: '100%' },
  // letterSpacing is zeroed and a little right padding added: on Android the measured width of letter-spaced
  // bold text can come up a pixel short and clip the last glyph (seen as "Wor" for "Work" on a 360dp screen).
  chipText: { marginLeft: 4, flexShrink: 1, letterSpacing: 0, paddingRight: 2 },
  more: { width: touchTarget, height: touchTarget, alignItems: 'center', justifyContent: 'center' },
});
