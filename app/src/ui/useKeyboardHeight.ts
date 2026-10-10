import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';

/**
 * Current on-screen keyboard height (0 when hidden).
 * With Android edge-to-edge (targetSdk 35+) the window is not resized for the keyboard, so a plain
 * ScrollView keeps its full height and fields near the bottom end up under the keyboard. Adding this
 * as bottom padding extends the scroll range so those fields can be scrolled above the keyboard.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return height;
}
