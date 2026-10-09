import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useAppTheme } from '../design/theme';
import { shape, spacing, typography, type TypeStyle } from '../design/tokens';

/** Large bold primary-coloured heading, the signature of the Expressive screens. */
export function LargeTitle({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useAppTheme();
  return (
    <Text accessibilityRole="header" style={[typography.displayTitle, { color: colors.primary }, style]}>
      {children}
    </Text>
  );
}

/** Small all-caps primary label that introduces a form section. */
export function SectionLabel({ children }: { children: string }) {
  const { colors } = useAppTheme();
  return (
    <Text accessibilityRole="header" style={[typography.sectionLabel, { color: colors.primary, marginTop: spacing.xl }]}>
      {children.toUpperCase()}
    </Text>
  );
}

export function AppText({
  variant = 'bodyLarge',
  tone = 'onSurface',
  style,
  children,
  ...rest
}: {
  variant?: TypeStyle;
  tone?: 'onSurface' | 'onSurfaceVariant' | 'primary' | 'error';
  style?: StyleProp<TextStyle>;
  children: React.ReactNode;
} & Omit<React.ComponentProps<typeof Text>, 'style'>) {
  const { colors } = useAppTheme();
  return (
    <Text {...rest} style={[typography[variant], { color: colors[tone] }, style]}>
      {children}
    </Text>
  );
}

/** Large-radius tonal container used for form groups and cards. */
export function TonalSurface({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  return (
    <View style={[{ backgroundColor: colors.surfaceContainer, borderRadius: shape.extraLarge, padding: spacing.lg }, style]}>
      {children}
    </View>
  );
}

/** Content sheet with large top corners that sits under the heading (as in the reference home screen). */
export function ContentSheet({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={[
        styles.sheet,
        { backgroundColor: colors.background, borderTopLeftRadius: shape.sheet, borderTopRightRadius: shape.sheet },
        style,
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ sheet: { flex: 1 } });
