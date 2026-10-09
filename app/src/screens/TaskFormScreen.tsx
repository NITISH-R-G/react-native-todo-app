import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, IconButton, Switch, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ApiError, describeError } from '../api/errors';
import { PRIORITIES, type Priority, type TaskInput } from '../domain/types';
import { hasErrors, validateTask, type FieldErrors } from '../domain/validation';
import type { RootStackParamList } from '../navigation/types';
import { useAppTheme } from '../design/theme';
import { shape, spacing, touchTarget } from '../design/tokens';
import { useTasks } from '../state/tasksStore';
import { ConnectedButtonGroup, type Option } from '../ui/ConnectedButtonGroup';
import { DateTimeRow } from '../ui/DateTimeRow';
import { AppText, LargeTitle, SectionLabel, TonalSurface } from '../ui/primitives';

type Errors = FieldErrors<'title' | 'description' | 'startAt' | 'deadline'>;

const hourFrom = (d: Date) => new Date(d.getTime() + 60 * 60 * 1000);

/** Create / edit form. All mandatory fields: title, description, start date-time, deadline, priority. */
export function TaskFormScreen({ navigation, route }: NativeStackScreenProps<RootStackParamList, 'TaskForm'>) {
  const { colors } = useAppTheme();
  const taskId = route.params?.taskId;
  const existing = useTasks((s) => s.tasks.find((t) => t.id === taskId));
  const { create, update } = useTasks();

  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [priority, setPriority] = useState<Priority>(existing?.priority ?? 'medium');
  const [startAt, setStartAt] = useState(existing ? new Date(existing.startAt) : new Date());
  const [hasDeadline, setHasDeadline] = useState(!!existing?.deadline);
  const [deadline, setDeadline] = useState(existing?.deadline ? new Date(existing.deadline) : hourFrom(new Date()));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);

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
    };
    inFlight.current = true;
    setPending(true);
    try {
      if (taskId) await update(taskId, input);
      else await create(input);
      navigation.goBack();
    } catch (e) {
      if (e instanceof ApiError) setErrors({ ...e.fieldErrors } as Errors);
      setFormError(describeError(e));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.surfaceContainerHigh }]}>
      <View style={styles.top}>
        <IconButton icon="arrow-left" size={24} mode="outlined" onPress={() => navigation.goBack()} accessibilityLabel="Back" disabled={pending} />
        <LargeTitle style={styles.title}>{taskId ? 'Edit Task' : 'New Task'}</LargeTitle>
        <Button
          mode="outlined"
          icon="check"
          onPress={save}
          loading={pending}
          disabled={pending}
          contentStyle={styles.saveContent}
          accessibilityLabel={taskId ? 'Save task' : 'Add task'}
          testID="save-task">
          {taskId ? 'Save' : 'Add'}
        </Button>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={[styles.sheet, { backgroundColor: colors.background }]}
          contentContainerStyle={styles.scroll}
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
            <View style={[styles.switchRow, { backgroundColor: colors.surfaceContainer }]}>
              <View style={styles.flex}>
                <AppText variant="titleMedium">Deadline</AppText>
                <AppText variant="bodyMedium" tone="onSurfaceVariant">
                  {hasDeadline ? 'Must finish by the time below' : 'No deadline'}
                </AppText>
              </View>
              <Switch
                value={hasDeadline}
                onValueChange={(v) => {
                  setHasDeadline(v);
                  if (v && deadline.getTime() < startAt.getTime()) setDeadline(hourFrom(startAt));
                  setErrors({ ...errors, deadline: undefined });
                }}
                disabled={pending}
                accessibilityLabel="Set a deadline"
                testID="deadline-switch"
              />
            </View>
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

          {formError ? (
            <View style={[styles.formError, { backgroundColor: colors.errorContainer }]} accessibilityLiveRegion="assertive">
              <AppText variant="bodyMedium" style={{ color: colors.onErrorContainer }} testID="form-error">
                {formError}
              </AppText>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  title: { flex: 1, fontSize: 30, lineHeight: 38 },
  saveContent: { minHeight: touchTarget - 4 },
  sheet: { borderTopLeftRadius: shape.sheet, borderTopRightRadius: shape.sheet },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },
  group: { marginTop: spacing.sm },
  outline: { borderRadius: shape.large },
  rows: { gap: spacing.sm, marginTop: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: shape.large, minHeight: touchTarget + 16 },
  formError: { padding: spacing.md, borderRadius: shape.large, marginTop: spacing.lg },
});
