import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FONTS, RADIUS } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/context/ThemeContext';
import { formatCompact, formatPercent, formatTime, ratio } from './adminUtils';
import type { AdminData } from './useAdminData';

// Panoramica compatta per il telefono: solo numeri, nessun grafico. Legge
// l'istantanea `adminStats/latest`, quindi costa una lettura sola.
export function KpiTiles({ data }: { data: AdminData }) {
  const { t } = useTranslation();
  const { T } = useTheme();
  const styles = useThemedStyles(createStyles);
  const s = data.stats;
  const u = s?.users;

  if (!s) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>{t('admin.dash.noStatsTitle')}</Text>
        <Text style={styles.emptyBody}>{t('admin.dash.noStatsBody')}</Text>
        <RefreshLink data={data} />
      </View>
    );
  }

  const tiles: { label: string; value: string; caption: string }[] = [
    {
      label: t('admin.dash.kpi.users'),
      value: formatCompact(u?.total),
      caption: t('admin.dash.kpi.usersCaption', { guests: formatCompact(u?.guests) }),
    },
    {
      label: t('admin.dash.kpi.new7'),
      value: formatCompact(u?.new7),
      caption: t('admin.dash.kpi.new7Caption', { prev: formatCompact(u?.newPrev7) }),
    },
    {
      label: t('admin.dash.kpi.active7'),
      value: formatCompact(u?.active7),
      caption: t('admin.dash.kpi.active7Caption', { today: formatCompact(u?.active1) }),
    },
    {
      label: t('admin.dash.kpi.retention7'),
      value: formatPercent(ratio(u?.retention7.returned, u?.retention7.eligible)),
      caption: t('admin.dash.kpi.retention7Caption', { count: u?.retention7.eligible ?? 0 }),
    },
    {
      label: t('admin.dash.kpi.products'),
      value: formatCompact(s.products?.inPantries),
      caption: t('admin.dash.kpi.productsCaption', { expired: formatCompact(s.products?.expired) }),
    },
    {
      label: t('admin.dash.kpi.wasteSaved'),
      value: formatPercent(ratio(u?.productsConsumedTotal, (u?.productsConsumedTotal ?? 0) + (u?.productsWastedTotal ?? 0))),
      caption: t('admin.dash.kpi.wasteSavedCaption', { eaten: formatCompact(u?.productsConsumedTotal ?? 0), wasted: formatCompact(u?.productsWastedTotal ?? 0) }),
    },
    {
      label: t('admin.dash.kpi.feedbackOpen'),
      // Dal vivo, non dall'istantanea: è la coda di lavoro dell'admin.
      value: formatCompact(data.counts.newFeedback),
      caption: t('admin.dash.kpi.feedbackCaption', { total: formatCompact(data.feedback.length) }),
    },
  ];

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.grid}>
        {tiles.map((tile) => (
          <View key={tile.label} style={styles.tile} accessible accessibilityLabel={`${tile.label}: ${tile.value}. ${tile.caption}`}>
            <Text style={styles.label} numberOfLines={1}>{tile.label}</Text>
            <Text style={styles.value}>{tile.value}</Text>
            <Text style={styles.caption} numberOfLines={1}>{tile.caption}</Text>
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <Text style={styles.updated}>{t('admin.dash.updatedAt', { when: formatTime(s.generatedAt) })}</Text>
        {data.refreshingStats ? <ActivityIndicator color={T.primary} size="small" /> : <RefreshLink data={data} />}
      </View>
    </View>
  );
}

function RefreshLink({ data }: { data: AdminData }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  return (
    <TouchableOpacity onPress={data.recomputeStats} disabled={data.refreshingStats} accessibilityRole="button" hitSlop={8}>
      <Text style={styles.link}>{data.refreshingStats ? t('admin.dash.refreshing') : t('admin.dash.refresh')}</Text>
    </TouchableOpacity>
  );
}

const createStyles = ({ T, SHADOW }: Theme) => StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexGrow: 1, flexBasis: '46%', minWidth: 140,
    backgroundColor: T.surface, borderRadius: RADIUS.clay, paddingVertical: 14, paddingHorizontal: 14,
    ...SHADOW.card,
  },
  label: { fontFamily: FONTS.sansMedium, fontSize: 12, color: T.ink2 },
  value: { fontFamily: FONTS.sansBold, fontSize: 26, color: T.ink, marginTop: 4, letterSpacing: -0.5 },
  caption: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 2 },
  updated: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, flex: 1 },
  link: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.primary },
  emptyCard: { backgroundColor: T.surface, borderRadius: RADIUS.clay, padding: 16, gap: 6, ...SHADOW.card },
  emptyTitle: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
  emptyBody: { fontFamily: FONTS.sans, fontSize: 13, color: T.mute, lineHeight: 18, marginBottom: 6 },
});
