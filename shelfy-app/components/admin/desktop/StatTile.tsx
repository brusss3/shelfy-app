import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FONTS, RADIUS } from '@/constants/theme';
import { useThemedStyles, type Theme } from '@/context/ThemeContext';
import { formatNumber } from '../adminUtils';

export interface Delta {
  /** Variazione già formattata, senza segno (il segno lo dà la freccia). */
  text: string;
  direction: 'up' | 'down' | 'flat';
  /** Se salire è un bene: decide il colore, insieme alla direzione. */
  upIsGood: boolean;
}

/** Differenza assoluta fra due valori; null se manca il termine di confronto. */
export function deltaAbs(cur: number | null | undefined, prev: number | null | undefined, upIsGood = true): Delta | null {
  if (cur == null || prev == null) return null;
  const d = cur - prev;
  return { text: formatNumber(Math.abs(d)), direction: d > 0 ? 'up' : d < 0 ? 'down' : 'flat', upIsGood };
}

/** Variazione percentuale (es. nuovi iscritti rispetto alla settimana prima). */
export function deltaPct(cur: number | null | undefined, prev: number | null | undefined, upIsGood = true): Delta | null {
  if (cur == null || prev == null || prev === 0) return null;
  const d = (cur - prev) / prev;
  return { text: `${Math.abs(Math.round(d * 100))}%`, direction: d > 0 ? 'up' : d < 0 ? 'down' : 'flat', upIsGood };
}

/** Differenza in punti percentuali fra due rapporti. */
export function deltaPts(cur: number | null, prev: number | null, upIsGood = true): Delta | null {
  if (cur == null || prev == null) return null;
  const d = Math.round((cur - prev) * 100);
  return { text: `${Math.abs(d)} pt`, direction: d > 0 ? 'up' : d < 0 ? 'down' : 'flat', upIsGood };
}

export function DeltaText({ delta, against }: { delta: Delta | null; against: string }) {
  const styles = useThemedStyles(createStyles);
  if (!delta) return null;
  const good = delta.direction === 'flat' ? null : (delta.direction === 'up') === delta.upIsGood;
  const arrow = delta.direction === 'up' ? '▲' : delta.direction === 'down' ? '▼' : '=';
  return (
    <Text style={[styles.delta, good === true && styles.good, good === false && styles.bad]}>
      {arrow} {delta.direction === 'flat' ? '' : delta.text} <Text style={styles.against}>{against}</Text>
    </Text>
  );
}

export function StatTile({ label, value, caption, delta, against }: {
  label: string;
  value: string;
  caption?: string;
  delta?: Delta | null;
  against?: string;
}) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      {delta ? <DeltaText delta={delta} against={against ?? t('admin.dash.vsWeekAgo')} /> : null}
      {caption ? <Text style={styles.caption} numberOfLines={2}>{caption}</Text> : null}
    </View>
  );
}

const createStyles = ({ T, SHADOW }: Theme) => StyleSheet.create({
  tile: {
    flexGrow: 1, flexBasis: 180, minWidth: 160,
    backgroundColor: T.surface, borderRadius: RADIUS.clay, padding: 16, gap: 2, ...SHADOW.card,
  },
  label: { fontFamily: FONTS.sansMedium, fontSize: 12, color: T.ink2 },
  value: { fontFamily: FONTS.sansBold, fontSize: 28, color: T.ink, letterSpacing: -0.6, marginTop: 2 },
  caption: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 2, lineHeight: 16 },
  delta: { fontFamily: FONTS.sansMedium, fontSize: 12, color: T.ink2, marginTop: 2 },
  good: { color: T.ok },
  bad: { color: T.urgent },
  against: { fontFamily: FONTS.sans, color: T.mute },
});
