import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { T, FONTS, RADIUS, CLAY, SURFACE } from '@/constants/theme';

interface Props {
  value: number;
  label: string;
  color: string;
}

export default function StatCard({ value, label, color }: Props) {
  return (
    <LinearGradient colors={SURFACE.card} style={styles.card}>
      <Text style={[styles.value, { color }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  // Rilievo più contenuto delle righe prodotto: sono numeri di contorno, non
  // il contenuto principale della schermata, e con lo stesso peso delle righe
  // la pagina "grida" tutta uguale.
  card: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: 14,
    paddingHorizontal: 12,
    boxShadow: CLAY.chip,
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
