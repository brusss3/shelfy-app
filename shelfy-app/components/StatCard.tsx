import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { T, FONTS, SHADOW } from '@/constants/theme';

interface Props {
  value: number;
  label: string;
  color: string;
}

export default function StatCard({ value, label, color }: Props) {
  return (
    <View style={styles.card}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: 18,
    padding: 14,
    paddingHorizontal: 12,
    ...SHADOW.card,
  },
  value: {
    fontFamily: FONTS.serifItalic,
    fontSize: 32,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  label: {
    fontSize: 11,
    color: T.mute,
    marginTop: 4,
    fontFamily: FONTS.sansMedium,
    letterSpacing: 0.1,
  },
});
