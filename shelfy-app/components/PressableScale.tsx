import React, { useState } from 'react';
import { Pressable, StyleProp, ViewStyle, Insets } from 'react-native';
import Animated, { cubicBezier } from 'react-native-reanimated';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Sul Pressable esterno: posizionamento nel layout (margini, alignSelf). */
  style?: StyleProp<ViewStyle>;
  /** Sulla parte che si rimpicciolisce: aspetto e layout interno. */
  contentStyle?: StyleProp<ViewStyle>;
  hitSlop?: number | Insets;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link';
}

// Feedback alla pressione condiviso: si rimpicciolisce del 3% in 120ms al
// tocco, prima ancora del rilascio. È toccato decine di volte al giorno,
// quindi deve restare quasi impercettibile: niente rimbalzi, niente durate
// lunghe. Transizione CSS di Reanimated: gira sul thread UI senza shared value.
export default function PressableScale({
  children, onPress, disabled, style, contentStyle, hitSlop, accessibilityLabel, accessibilityRole = 'button',
}: Props) {
  const [pressed, setPressed] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      hitSlop={hitSlop}
      pressRetentionOffset={16}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={style}
    >
      <Animated.View style={[styles.box, contentStyle, pressed && !disabled && styles.pressed]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// Oggetto semplice e non StyleSheet.create: i tipi di React Native non
// conoscono le proprietà CSS di Reanimated (transition*).
const styles = {
  box: {
    transform: [{ scale: 1 }],
    transitionProperty: 'transform',
    transitionDuration: '120ms',
    transitionTimingFunction: cubicBezier(0.23, 1, 0.32, 1),
  },
  pressed: { transform: [{ scale: 0.97 }] },
} as const;
