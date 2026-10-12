import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomNavigation, Button, FAB, Icon, Snackbar } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { completionPercent } from '../domain/grouping';
import type { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../design/theme';
import { shape, spacing } from '../design/tokens';
import { useAuth } from '../state/authStore';
import { useTasks } from '../state/tasksStore';
import { AppText, ContentSheet, LargeTitle, TonalSurface } from '../ui/primitives';
import { DeleteAccountDialog } from '../ui/DeleteAccountDialog';
import { ProgressHeader } from '../ui/ProgressHeader';
import { SortMenu } from '../ui/FilterBar';
import { TasksList } from './TasksList';

const greeting = (h: number) => (h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : h < 21 ? 'Good evening' : 'Good night');

type Snack = { text: string; undo?: () => void } | null;

export function HomeScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'Home'>) {
  const { colors } = useAppTheme();
  const [tab, setTab] = useState<'tasks' | 'account'>('tasks');
  const [snack, setSnack] = useState<Snack>(null);
  const { tasks, load, setCompleted } = useTasks();
  const percent = completionPercent(tasks);

  useEffect(() => {
    load();
  }, [load]);

  const onToggled = useCallback(
    (t: { id: string; title: string }, nowCompleted: boolean) => {
      setSnack({
        text: nowCompleted ? `“${t.title}” completed` : `“${t.title}” marked incomplete`,
        undo: () => setCompleted(t.id, !nowCompleted).catch(() => setSnack({ text: 'Couldn’t undo. Try again.' })),
      });
    },
    [setCompleted],
  );

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.surfaceContainerHigh }]} edges={['top']}>
      <View style={styles.header}>
        <LargeTitle style={styles.flex}>
          {tab === 'tasks' ? greeting(new Date().getHours()) : 'Account'}
        </LargeTitle>
        {tab === 'tasks' ? <SortMenu /> : null}
      </View>
      {tab === 'tasks' ? <ProgressHeader percent={percent} /> : null}
      <ContentSheet>
        {tab === 'tasks' ? (
          <TasksList
            onEdit={(t) => navigation.navigate('TaskForm', { taskId: t.id })}
            onToggled={onToggled}
            onError={(text) => setSnack({ text })}
          />
        ) : (
          <AccountPane />
        )}
      </ContentSheet>
      {tab === 'tasks' ? (
        <FAB
          icon="plus"
          label=""
          accessibilityLabel="Add task"
          onPress={() => navigation.navigate('TaskForm')}
          style={[styles.fab, { backgroundColor: colors.primary, borderRadius: shape.extraLarge }]}
          color={colors.onPrimary}
          testID="add-task-fab"
        />
      ) : null}
      <Snackbar
        visible={!!snack}
        onDismiss={() => setSnack(null)}
        duration={4000}
        style={styles.snack}
        action={snack?.undo ? { label: 'Undo', onPress: snack.undo } : { label: 'Dismiss', onPress: () => {} }}>
        {snack?.text}
      </Snackbar>
      <BottomNavigation.Bar
        navigationState={{
          index: tab === 'tasks' ? 0 : 1,
          routes: [
            { key: 'tasks', title: 'Tasks', focusedIcon: 'clipboard-text', unfocusedIcon: 'clipboard-text-outline' },
            { key: 'account', title: 'Account', focusedIcon: 'account-circle', unfocusedIcon: 'account-circle-outline' },
          ],
        }}
        onTabPress={({ route }) => setTab(route.key as 'tasks' | 'account')}
        renderIcon={({ route, focused, color }) => (
          <TabIcon name={focused ? route.focusedIcon : route.unfocusedIcon} color={color} />
        )}
        getLabelText={({ route }) => route.title}
        style={{ backgroundColor: colors.surfaceContainerHigh }}
        activeIndicatorStyle={{ backgroundColor: colors.secondaryContainer }}
      />
    </SafeAreaView>
  );
}

const TabIcon = ({ name, color }: { name?: string; color: string }) => <Icon source={name ?? 'circle'} size={24} color={color} />;

function AccountPane() {
  const { colors } = useAppTheme();
  const { user, logout } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const reset = useTasks((s) => s.reset);
  return (
    <View style={styles.account}>
      <TonalSurface>
        <AppText variant="labelMedium" tone="onSurfaceVariant">
          SIGNED IN AS
        </AppText>
        <AppText variant="titleLarge" testID="account-email">
          {user?.email}
        </AppText>
      </TonalSurface>
      <Button
        mode="contained-tonal"
        icon="logout"
        onPress={async () => {
          reset();
          await logout();
        }}
        style={styles.logout}
        contentStyle={styles.logoutContent}
        testID="logout-button">
        Sign out
      </Button>
      <Button
        mode="outlined"
        icon="delete-forever-outline"
        onPress={() => setDeleting(true)}
        style={styles.deleteAccount}
        contentStyle={styles.logoutContent}
        textColor={colors.error}
        testID="delete-account-button">
        Delete account
      </Button>
      <DeleteAccountDialog visible={deleting} onDismiss={() => setDeleting(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md },
  fab: { position: 'absolute', alignSelf: 'center', bottom: 104 },
  snack: { marginBottom: 88 },
  account: { padding: spacing.xl },
  logout: { marginTop: spacing.xl, borderRadius: shape.full },
  deleteAccount: { marginTop: spacing.md, borderRadius: shape.full },
  logoutContent: { minHeight: 56 },
});
