import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { describeError, ApiError } from '../api/errors';
import { hasErrors, validateLogin, validateRegister, type FieldErrors } from '../domain/validation';
import { useAppTheme } from '../design/theme';
import { shape, spacing, touchTarget } from '../design/tokens';
import { useAuth } from '../state/authStore';
import { AppText, LargeTitle, TonalSurface } from './primitives';
import { useKeyboardHeight } from './useKeyboardHeight';

type Mode = 'login' | 'register';

/**
 * Shared email+password form for Login and Register. Validation runs on submit (and re-runs as the
 * user edits a field that had an error); duplicate submits are blocked while a request is pending.
 */
export function AuthForm({ mode, onSwitch }: { mode: Mode; onSwitch: () => void }) {
  const { colors } = useAppTheme();
  const { login, register, notice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<'email' | 'password'>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const isRegister = mode === 'register';
  const keyboardHeight = useKeyboardHeight();

  const validate = (e: string, p: string) => (isRegister ? validateRegister(e, p) : validateLogin(e, p));

  const submit = async () => {
    if (inFlight.current) return; // guards double taps before state flushes
    const v = validate(email, password);
    setErrors(v);
    setFormError(null);
    if (hasErrors(v)) return;
    inFlight.current = true;
    setPending(true);
    try {
      await (isRegister ? register : login)(email, password);
    } catch (err) {
      // Map server field errors (e.g. weak password) inline; everything else becomes a form-level message.
      if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
        setErrors({ email: err.fieldErrors.email, password: err.fieldErrors.password });
      }
      setFormError(
        err instanceof ApiError && err.code === 'email_taken'
          ? 'That email is already registered. Try signing in instead.'
          : describeError(err),
      );
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: colors.surfaceContainerHigh }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: spacing.xl + keyboardHeight }]} keyboardShouldPersistTaps="handled">
          <LargeTitle>{isRegister ? 'Create account' : 'Welcome back'}</LargeTitle>
          <AppText variant="bodyLarge" tone="onSurfaceVariant" style={styles.sub}>
            {isRegister ? 'Sign up to keep your tasks safe and in sync.' : 'Sign in to pick up where you left off.'}
          </AppText>

          {notice && !isRegister ? (
            <TonalSurface style={[styles.banner, { backgroundColor: colors.primaryContainer }]}>
              <AppText variant="bodyMedium" style={{ color: colors.onPrimaryContainer }} accessibilityLiveRegion="polite">
                {notice}
              </AppText>
            </TonalSurface>
          ) : null}

          <TonalSurface style={styles.card}>
            <TextInput
              mode="outlined"
              label="Email"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errors.email) setErrors({ ...errors, email: validate(t, password).email });
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              textContentType="emailAddress"
              returnKeyType="next"
              submitBehavior="submit"
              error={!!errors.email}
              disabled={pending}
              outlineStyle={styles.outline}
              accessibilityLabel="Email"
              testID="email-input"
            />
            <HelperText type="error" visible={!!errors.email} accessibilityLiveRegion="polite">
              {errors.email}
            </HelperText>

            <TextInput
              mode="outlined"
              label="Password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (errors.password) setErrors({ ...errors, password: validate(email, t).password });
              }}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              textContentType={isRegister ? 'newPassword' : 'password'}
              returnKeyType="done"
              onSubmitEditing={submit}
              error={!!errors.password}
              disabled={pending}
              outlineStyle={styles.outline}
              right={
                <TextInput.Icon
                  icon={show ? 'eye-off' : 'eye'}
                  onPress={() => setShow((s) => !s)}
                  accessibilityLabel={show ? 'Hide password' : 'Show password'}
                />
              }
              accessibilityLabel="Password"
              testID="password-input"
            />
            <HelperText type={errors.password ? 'error' : 'info'} visible={!!errors.password || isRegister} accessibilityLiveRegion="polite">
              {errors.password ?? 'At least 8 characters with a letter and a digit'}
            </HelperText>

            {formError ? (
              <View style={[styles.formError, { backgroundColor: colors.errorContainer }]} accessibilityLiveRegion="assertive">
                <AppText variant="bodyMedium" style={{ color: colors.onErrorContainer }} testID="form-error">
                  {formError}
                </AppText>
              </View>
            ) : null}

            <Button
              mode="contained"
              onPress={submit}
              loading={pending}
              disabled={pending}
              contentStyle={styles.buttonContent}
              style={styles.button}
              labelStyle={styles.buttonLabel}
              accessibilityLabel={isRegister ? 'Create account' : 'Sign in'}
              testID="submit-button">
              {pending ? (isRegister ? 'Creating…' : 'Signing in…') : isRegister ? 'Create account' : 'Sign in'}
            </Button>
          </TonalSurface>

          <Button mode="text" onPress={onSwitch} disabled={pending} contentStyle={styles.buttonContent} testID="switch-mode">
            {isRegister ? 'Already have an account? Sign in' : 'New here? Create an account'}
          </Button>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: spacing.xl, paddingTop: spacing.xxl * 2 },
  sub: { marginTop: spacing.sm, marginBottom: spacing.xl },
  card: { padding: spacing.xl, marginBottom: spacing.lg },
  banner: { marginBottom: spacing.lg },
  outline: { borderRadius: shape.large },
  button: { marginTop: spacing.lg, borderRadius: shape.full },
  buttonContent: { minHeight: touchTarget + 8 },
  buttonLabel: { fontSize: 16, fontWeight: '700' },
  formError: { padding: spacing.md, borderRadius: shape.large, marginTop: spacing.sm },
});
