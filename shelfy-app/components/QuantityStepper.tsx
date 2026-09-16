import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { T, FONTS, RADIUS } from '@/constants/theme';

interface Props {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

export default function QuantityStepper({ value, onChange, min = 1, max = 99 }: Props) {
  const canDecrease = value > min;
  const canIncrease = value < max;

  return (
    <View style={styles.row}>
      <TouchableOpacity
        style={[styles.btn, !canDecrease && styles.btnDisabled]}
        onPress={() => canDecrease && onChange(value - 1)}
        disabled={!canDecrease}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>−</Text>
      </TouchableOpacity>
      <Text style={styles.value}>{value}</Text>
      <TouchableOpacity
        style={[styles.btn, !canIncrease && styles.btnDisabled]}
        onPress={() => canIncrease && onChange(value + 1)}
        disabled={!canIncrease}
        activeOpacity={0.85}
      >
        <Text style={styles.btnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  btn: {
    width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: T.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 18, lineHeight: 22, color: T.primaryInk, fontFamily: FONTS.sansBold },
  value: { fontSize: 16, fontFamily: FONTS.sansBold, color: T.ink, minWidth: 24, textAlign: 'center' },
});
