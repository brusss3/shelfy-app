import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { T, FONTS } from '@/constants/theme';

type Variant = 'primary' | 'ghost' | 'soft' | 'warn' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  style?: ViewStyle;
  disabled?: boolean;
}

const variantStyles: Record<Variant, { bg: string; color: string; border?: string }> = {
  primary: { bg: T.primary, color: '#fbfaf3' },
  ghost:   { bg: 'transparent', color: T.primary, border: T.line },
  soft:    { bg: T.primarySoft, color: T.primaryInk },
  warn:    { bg: T.warn, color: '#fff' },
  danger:  { bg: T.urgent, color: '#fff' },
};

const sizeStyles: Record<Size, { paddingV: number; paddingH: number; fontSize: number }> = {
  sm: { paddingV: 8, paddingH: 14, fontSize: 13 },
  md: { paddingV: 12, paddingH: 18, fontSize: 14 },
  lg: { paddingV: 16, paddingH: 24, fontSize: 16 },
};

export default function Pill({ children, onPress, variant = 'primary', size = 'md', style, disabled }: Props) {
  const v = variantStyles[variant];
  const s = sizeStyles[size];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.base,
        {
          backgroundColor: v.bg,
          paddingVertical: s.paddingV,
          paddingHorizontal: s.paddingH,
          borderWidth: v.border ? 1 : 0,
          borderColor: v.border ?? 'transparent',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {typeof children === 'string' ? (
        <Text style={[styles.text, { color: v.color, fontSize: s.fontSize }]}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 100,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  text: {
    fontFamily: FONTS.sansSemiBold,
    letterSpacing: -0.1,
  },
});
