import React, { useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, IconButton, Switch, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiError, describeError } from '../api/errors';
import { availableCategories, categoryOf, DEFAULT_CATEGORY, withCategory } from '../domain/filters';
import { PRIORITIES, type Priority, type TaskInput } from '../domain/types';
import { hasErrors, validateTask, type FieldErrors } from '../domain/validation';
import type { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../design/theme';
import { shape, spacing, touchTarget } from '../design/tokens';
import { useTasks } from '../state/tasksStore';
import { CategoryPicker } from '../ui/CategoryPicker';
import { ConnectedButtonGroup, type Option } from '../ui/ConnectedButtonGroup';
import { DateTimeRow } from '../ui/DateTimeRow';
import { AppText, LargeTitle, SectionLabel, TonalSurface } from '../ui/primitives';
import { useKeyboardHeight } from '../ui/useKeyboardHeight';

type Errors = FieldErrors<'title' | 'description' | 'startAt' | 'deadline'>;

const hourFrom = (d: Date) => new Date(d.getTime() + 60 * 60 * 1000);

/** Create / edit form. All mandatory fields: title, description, start date-time, deadline, priority. */
export function TaskFormScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'TaskForm'>) {
  const { colors } = useAppTheme();
  const taskId = route.params?.taskId;
  const existing = useTasks((s) => s.tasks.find((t) => t.id === taskId));
  const { create, update, load } = useTasks();
  const allTasks = useTasks((s) => s.tasks);
  const categories = availableCategories(allTasks);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? 'medium');
  const [category, setCategory] = useState(existing ? categoryOf(existing) : DEFAULT_CATEGORY);
  // True once the server says this task no longer exists (deleted elsewhere): saving is pointless.
  const [gone, setGone] = useState(!!taskId && !existing);
  const [startAt, setStartAt] = useState(existing ? new Date(existing.startAt) : new Date());
  const [hasDeadline, setHasDeadline] = useState(!!existing?.deadline);
  const [deadline, setDeadline] = useState(existing?.deadline ? new Date(existing.deadline) : hourFrom(new Date()));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(
    taskId && !existing ? 'This task no longer exists. It may have been deleted. Go back to see your current list.' : null,
  );
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const keyboardHeight = useKeyboardHeight();
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const categoryY = useRef(0);

  // The keyboard shrinks the viewport (adjustResize), and a scroll issued before that is clamped to the
  // old, shorter scroll range. So wait for the keyboard to be shown, then scroll the category field up.
  const scrollCategoryIntoView = () => {
    const go = () => {
      scrollRef.current?.scrollTo({ y: Math.max(0, categoryY.current + 140), animated: true });
    };
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      sub.remove();
      setTimeout(go, 50);
    });
    setTimeout(() => sub.remove(), 2000); // keyboard already open: no event will come
    if (Keyboard.isVisible()) setTimeout(go, 50);
  };

  const options: Option<Priority>[] = PRIORITIES.map((p) => ({
    value: p,
    label: p[0]!.toUpperCase() + p.slice(1),
    accent: { high: colors.priorityHigh, medium: colors.priorityMedium, low: colors.priorityLow }[p],
  }));

  const draft = () => ({ title, description, startAt, deadline: hasDeadline ? deadline : null, priority });

  const save = async () => {
    if (inFlight.current) return;
    const d = draft();
    const v = validateTask(d);
    setErrors(v);
    setFormError(null);
    if (hasErrors(v)) return;
    const input: TaskInput = {
      title: d.title.trim(),
      description: d.description,
      startAt: d.startAt.toISOString(),
      deadline: d.deadline ? d.deadline.toISOString() : null,
      priority: d.priority,
      tags: withCategory(existing?.tags ?? [], category),
    };
    inFlight.current = true;
    setPending(true);
    try {
      if (taskId) await update(taskId, input);
      else await create(input);
      navigation.goBack();
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // Deleted (or never owned): say so, refresh the list, and stop offering Save.
        setGone(true);
        setFormError('This task no longer exists. It may have been deleted. Go back to see your current list.');
        load({ silent: true });
      } else {
        if (e instanceof ApiError) setErrors({ ...e.fieldErrors } as Errors);
        setFormError(describeError(e));
      }
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.surfaceContainerHigh }]}>
      <View style={styles.top}>
        <IconButton
          icon="arrow-left"
          size={24}
          mode="outlined"
          style={{ width: touchTarget + 6, height: touchTarget + 6 }}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Back"
          disabled={pending}
        />
        <LargeTitle style={styles.title}>{taskId ? 'Edit Task' : 'New Task'}</LargeTitle>
        <Button
          mode="outlined"
          icon="check"
          onPress={save}
          loading={pending}
          disabled={pending || gone}
          contentStyle={styles.saveContent}
          accessibilityLabel={taskId ? 'Save task' : 'Add task'}
          testID="save-task">
          {taskId ? 'Save' : 'Add'}
        </Button>
      </View>
      {formError ? (
        <View style={[styles.formError, { backgroundColor: colors.errorContainer }]} accessibilityLiveRegion="assertive">
          <AppText variant="bodyMedium" style={{ color: colors.onErrorContainer }} testID="form-error">
            {formError}
          </AppText>
        </View>
      ) : null}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          style={[styles.sheet, { backgroundColor: colors.background }]}
          contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xxl * 2 + keyboardHeight }]}
          keyboardShouldPersistTaps="handled">
          <SectionLabel>What is in your mind?</SectionLabel>
          <TonalSurface style={styles.group}>
            <TextInput
              mode="outlined"
              label="Title*"
              value={title}
              onChangeText={(t) => {
                setTitle(t);
                if (errors.title) setErrors({ ...errors, title: undefined });
              }}
              error={!!errors.title}
              disabled={pending}
              maxLength={200}
              outlineStyle={styles.outline}
              accessibilityLabel="Title, required"
              testID="title-input"
            />
            <HelperText type="error" visible={!!errors.title} accessibilityLiveRegion="polite">
              {errors.title}
            </HelperText>
            <TextInput
              mode="outlined"
              label="Description (optional)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              error={!!errors.description}
              disabled={pending}
              outlineStyle={styles.outline}
              accessibilityLabel="Description, optional"
              testID="description-input"
            />
            <HelperText type="error" visible={!!errors.description}>
              {errors.description}
            </HelperText>
          </TonalSurface>

          <SectionLabel>Priority</SectionLabel>
          <TonalSurface style={styles.group}>
            <ConnectedButtonGroup label="Priority" options={options} value={priority} onChange={setPriority} />
          </TonalSurface>

          <SectionLabel>Category</SectionLabel>
          <View style={styles.categoryWrap} onLayout={(e) => (categoryY.current = e.nativeEvent.layout.y)}>
            <CategoryPicker
              value={category}
              categories={categories}
              onChange={setCategory}
              disabled={pending}
              onStartAdding={scrollCategoryIntoView}
            />
          </View>

          <SectionLabel>Schedule & deadline</SectionLabel>
          <View style={styles.rows}>
            <DateTimeRow
              label="Start"
              icon="calendar-clock"
              value={startAt}
              error={errors.startAt}
              onChange={(d) => {
                setStartAt(d);
                setErrors({ ...errors, deadline: undefined });
              }}
            />
            {/* The whole row is one 48dp+ touch target; the Switch inside is purely visual. */}
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Set a deadline"
              accessibilityState={{ checked: hasDeadline, disabled: pending }}
              disabled={pending}
              onPress={() => {
                const v = !hasDeadline;
                setHasDeadline(v);
                if (v && deadline.getTime() < startAt.getTime()) setDeadline(hourFrom(startAt));
                setErrors({ ...errors, deadline: undefined });
              }}
              style={[styles.switchRow, { backgroundColor: colors.surfaceContainer }]}
              testID="deadline-switch">
              <View style={styles.flex}>
                <AppText variant="titleMedium">Deadline</AppText>
                <AppText variant="bodyMedium" tone="onSurfaceVariant">
                  {hasDeadline ? 'Must finish by the time below' : 'No deadline'}
                </AppText>
              </View>
              <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Switch value={hasDeadline} />
              </View>
            </Pressable>
            {hasDeadline ? (
              <DateTimeRow
                label="Deadline"
                icon="calendar-alert"
                value={deadline}
                error={errors.deadline}
                onChange={(d) => {
                  setDeadline(d);
                  setErrors({ ...errors, deadline: undefined });
                }}
              />
            ) : null}
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  title: { flex: 1, fontSize: 30, lineHeight: 38 },
  saveContent: { minHeight: touchTarget },
  sheet: { borderTopLeftRadius: shape.sheet, borderTopRightRadius: shape.sheet },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  group: { marginTop: spacing.sm },
  outline: { borderRadius: shape.large },
  categoryWrap: { marginTop: spacing.sm, marginHorizontal: -spacing.lg },
  rows: { gap: spacing.sm, marginTop: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: shape.large, minHeight: touchTarget + 16 },
  formError: { padding: spacing.md, borderRadius: shape.large, marginHorizontal: spacing.lg, marginBottom: spacing.sm },
});
