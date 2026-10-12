import React, { useRef, useState } from 'react';
import { Button, Dialog, HelperText, Portal, TextInput } from 'react-native-paper';
import { ApiError, describeError } from '../api/errors';
import { useAppTheme } from '../design/theme';
import { shape } from '../design/tokens';
import { useAuth } from '../state/authStore';
import { AppText } from './primitives';
import { useKeyboardHeight } from './useKeyboardHeight';

/** Password-confirmed, irreversible account deletion. Double submits are ignored; failures stay in the dialog. */
export function DeleteAccountDialog({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const { colors } = useAppTheme();
  const deleteAccount = useAuth((s) => s.deleteAccount);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  // Edge-to-edge Android does not resize for the keyboard; a bottom margin equal to its height centres the dialog
  // in the space above it, so the buttons and error text stay visible while typing the password.
  const keyboardHeight = useKeyboardHeight();

  const close = () => {
    if (pending) return;
    setPassword('');
    setError(null);
    onDismiss();
  };

  const confirm = async () => {
    if (inFlight.current) return;
    if (!password) {
      setError('Enter your password to confirm');
      return;
    }
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      await deleteAccount(password); // on success the app signs out and this screen unmounts
    } catch (e) {
      setError(e instanceof ApiError && e.code === 'invalid_credentials' ? 'That password is not correct.' : describeError(e));
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={close} style={{ borderRadius: shape.sheet, marginBottom: keyboardHeight }}>
        <Dialog.Icon icon="alert-outline" color={colors.error} />
        <Dialog.Title style={{ textAlign: 'center' }}>Delete account?</Dialog.Title>
        <Dialog.Content>
          <AppText variant="bodyMedium" tone="onSurfaceVariant">
            This permanently deletes your account and all your tasks. It cannot be undone.
          </AppText>
          <TextInput
            mode="outlined"
            label="Password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setError(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            disabled={pending}
            error={!!error}
            style={{ marginTop: 16 }}
            accessibilityLabel="Password to confirm account deletion"
            testID="delete-password"
          />
          <HelperText type="error" visible={!!error} accessibilityLiveRegion="polite" testID="delete-error">
            {error}
          </HelperText>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={close} disabled={pending} testID="delete-cancel">
            Cancel
          </Button>
          <Button onPress={confirm} loading={pending} disabled={pending} textColor={colors.error} testID="delete-confirm">
            Delete forever
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
