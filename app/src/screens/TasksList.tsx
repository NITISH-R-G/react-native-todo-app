import React, { useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, SectionList, StyleSheet, View } from 'react-native';
import { Button, Dialog, Icon, Portal } from 'react-native-paper';
import { describeError } from '../api/errors';
import { groupTasks } from '../domain/grouping';
import type { Task } from '../domain/types';
import { useAppTheme } from '../design/theme';
import { shape, spacing } from '../design/tokens';
import { useTasks } from '../state/tasksStore';
import { AppText } from '../ui/primitives';
import { TaskCard } from '../ui/TaskCard';

/** Task list with explicit loading / error / empty states, pull-to-refresh and delete confirmation. */
export function TasksList({
  onEdit,
  onToggled,
  onError,
}: {
  onEdit: (t: Task) => void;
  onToggled: (t: Task, nowCompleted: boolean) => void;
  onError: (msg: string) => void;
}) {
  const { colors } = useAppTheme();
  const { tasks, status, error, busy, load, setCompleted, remove } = useTasks();
  const [confirm, setConfirm] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const sections = useMemo(() => groupTasks(tasks), [tasks]);

  const toggle = async (t: Task) => {
    try {
      await setCompleted(t.id, !t.completed);
      onToggled(t, !t.completed);
    } catch (e) {
      if (!(e instanceof Error && e.message === 'busy')) onError(describeError(e));
    }
  };

  const doDelete = async () => {
    if (!confirm || deleting) return;
    setDeleting(true);
    try {
      await remove(confirm.id);
      setConfirm(null);
    } catch (e) {
      onError(describeError(e));
      setConfirm(null);
    } finally {
      setDeleting(false);
    }
  };

  if (status === 'loading' || status === 'idle') {
    return (
      <View style={styles.center} accessibilityLabel="Loading tasks" accessibilityLiveRegion="polite">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  if (status === 'error' && tasks.length === 0) {
    return (
      <View style={styles.center} accessibilityLiveRegion="polite">
        <View style={[styles.badge, { backgroundColor: colors.errorContainer }]}>
          <Icon source="cloud-off-outline" size={36} color={colors.onErrorContainer} />
        </View>
        <AppText variant="titleMedium" style={styles.msg}>
          {error ?? 'Couldn’t load your tasks'}
        </AppText>
        <Button mode="contained-tonal" onPress={() => load()} style={styles.retry} testID="retry-button">
          Try again
        </Button>
      </View>
    );
  }
  if (tasks.length === 0) {
    return (
      <View style={styles.center}>
        <View style={[styles.badge, { backgroundColor: colors.primaryContainer }]}>
          <Icon source="check-circle" size={40} color={colors.primary} />
        </View>
        <AppText variant="titleMedium" tone="onSurfaceVariant" style={styles.msg} testID="empty-state">
          No tasks yet. Tap + to add one!
        </AppText>
      </View>
    );
  }
  return (
    <>
      <SectionList
        sections={sections}
        keyExtractor={(t) => t.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={false} onRefresh={() => load({ silent: true })} colors={[colors.primary]} />}
        renderSectionHeader={({ section }) => (
          <AppText variant="titleLarge" tone={section.key === 'overdue' ? 'error' : 'primary'} accessibilityRole="header" style={styles.section}>
            {section.title}
          </AppText>
        )}
        renderItem={({ item }) => (
          <TaskCard task={item} busy={!!busy[item.id]} onToggle={() => toggle(item)} onEdit={() => onEdit(item)} onDelete={() => setConfirm(item)} />
        )}
      />
      <Portal>
        <Dialog visible={!!confirm} onDismiss={() => !deleting && setConfirm(null)} style={{ borderRadius: shape.sheet }}>
          <Dialog.Icon icon="delete-outline" />
          <Dialog.Title style={styles.dialogTitle}>Delete task?</Dialog.Title>
          <Dialog.Content>
            <AppText variant="bodyMedium" tone="onSurfaceVariant">
              “{confirm?.title}” will be permanently deleted.
            </AppText>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setConfirm(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button onPress={doDelete} loading={deleting} disabled={deleting} textColor={colors.error} testID="confirm-delete">
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  badge: { width: 72, height: 72, borderRadius: shape.full, alignItems: 'center', justifyContent: 'center' },
  msg: { marginTop: spacing.lg, textAlign: 'center' },
  retry: { marginTop: spacing.lg },
  list: { padding: spacing.lg, paddingBottom: 140 },
  section: { marginTop: spacing.sm, marginBottom: spacing.md },
  dialogTitle: { textAlign: 'center' },
});
