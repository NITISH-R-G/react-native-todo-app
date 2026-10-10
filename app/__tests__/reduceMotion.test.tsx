import React from 'react';
import { AccessibilityInfo, Text } from 'react-native';
import { render, screen, waitFor } from '@testing-library/react-native';
import { useReduceMotion } from '../src/ui/useReduceMotion';

function Probe() {
  return <Text testID="rm">{String(useReduceMotion())}</Text>;
}

// Risk: animations must follow the system "remove animations" setting, including when it changes while open.
describe('useReduceMotion', () => {
  it('reflects the system setting and live changes', async () => {
    let listener: (v: boolean) => void = () => {};
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_: string, cb: (v: boolean) => void) => {
      listener = cb;
      return { remove: jest.fn() };
    }) as never);
    await render(<Probe />);
    await waitFor(() => expect(screen.getByTestId('rm').props.children).toBe('true'));
    const { act } = require('@testing-library/react-native');
    await act(async () => listener(false));
    expect(screen.getByTestId('rm').props.children).toBe('false');
  });
});
