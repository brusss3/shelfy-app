import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FONTS, RADIUS } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/context/ThemeContext';
import { FeedbackPanel } from '../FeedbackPanel';
import { SurveysPanel } from '../SurveysPanel';
import { SettingsPanel } from '../SettingsPanel';
import { formatTime } from '../adminUtils';
import type { AdminData } from '../useAdminData';
import { UsersTable } from './UsersTable';
import { ContentSection, OverviewSection, PricesSection, type Range } from './Sections';

// Dashboard desktop (solo web, viewport larga): barra laterale con le sezioni,
// grafici Recharts nella panoramica. Caricata in differita da
// AdminDesktop.web.tsx, così Recharts finisce in un pezzo di bundle a parte. Le azioni di gestione sono le stesse
// della versione mobile (stesso hook useAdminData).

type Section = 'overview' | 'users' | 'content' | 'prices' | 'feedback' | 'surveys' | 'settings';
const WITH_RANGE: Section[] = ['overview', 'prices'];

export function DesktopShell({ data }: { data: AdminData }) {
  const { t } = useTranslation();
  const { T } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [section, setSection] = useState<Section>('overview');
  const [range, setRange] = useState<Range>(30);

  const nav: { id: Section; label: string; badge?: number }[] = [
    { id: 'overview', label: t('admin.dash.nav.overview') },
    { id: 'users', label: t('admin.dash.nav.users'), badge: data.users.length },
    { id: 'content', label: t('admin.dash.nav.content') },
    { id: 'prices', label: t('admin.dash.nav.prices') },
    { id: 'feedback', label: t('admin.dash.nav.feedback'), badge: data.counts.newFeedback || undefined },
    { id: 'surveys', label: t('admin.dash.nav.surveys') },
    { id: 'settings', label: t('admin.dash.nav.settings') },
  ];
  const current = nav.find((n) => n.id === section)!;

  return (
    <View style={styles.root}>
      <View style={styles.sidebar}>
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" style={styles.back}>
          <Text style={styles.backText}>{t('admin.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.brand}>{t('admin.title')}</Text>
        <View style={styles.navList}>
          {nav.map((n) => {
            const active = n.id === section;
            return (
              <TouchableOpacity
                key={n.id}
                onPress={() => setSection(n.id)}
                style={[styles.navItem, active && styles.navItemActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.navText, active && styles.navTextActive]}>{n.label}</Text>
                {n.badge ? <Text style={[styles.navBadge, n.id === 'feedback' && styles.navBadgeAlert]}>{n.badge}</Text> : null}
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={{ flex: 1 }} />
        {!data.aiEnabled && <Text style={styles.sideWarn}>{t('admin.aiInactiveStatus')}</Text>}
        {data.stats ? (
          <Text style={styles.sideMeta}>
            {t('admin.dash.updatedAt', { when: formatTime(data.stats.generatedAt) })}
            {data.stats.trigger === 'manual' ? ` · ${t('admin.dash.manual')}` : ''}
          </Text>
        ) : null}
      </View>

      <View style={styles.main}>
        <View style={styles.topbar}>
          <Text style={styles.pageTitle}>{current.label}</Text>
          <View style={styles.controls}>
            {WITH_RANGE.includes(section) && (
              <View style={styles.segment} accessibilityRole="radiogroup">
                {([30, 90] as Range[]).map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setRange(r)}
                    style={[styles.segBtn, range === r && styles.segBtnActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: range === r }}
                  >
                    <Text style={[styles.segText, range === r && styles.segTextActive]}>{t('admin.dash.lastDays', { count: r })}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity onPress={data.reload} style={styles.ghostBtn} disabled={data.refreshing} accessibilityRole="button">
              <Text style={styles.ghostText}>{data.refreshing ? t('admin.dash.reloading') : t('admin.dash.reload')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={data.recomputeStats} style={styles.primaryBtn} disabled={data.refreshingStats} accessibilityRole="button">
              {data.refreshingStats
                ? <ActivityIndicator color={T.onPrimary} size="small" />
                : <Text style={styles.primaryText}>{t('admin.dash.refreshStats')}</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {data.loading ? (
          <View style={styles.center}><ActivityIndicator color={T.primary} size="large" /></View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={[styles.inner, data.refreshing && { opacity: 0.6 }]}>
              {section === 'overview' && <OverviewSection data={data} range={range} />}
              {section === 'users' && <UsersTable data={data} />}
              {section === 'content' && <ContentSection data={data} />}
              {section === 'prices' && <PricesSection data={data} range={range} />}
              {section === 'feedback' && <FeedbackPanel data={data} columns={2} />}
              {section === 'surveys' && <View style={styles.narrow}><SurveysPanel data={data} /></View>}
              {section === 'settings' && <View style={styles.narrow}><SettingsPanel data={data} /></View>}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

const createStyles = ({ T, CLAY }: Theme) => StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', backgroundColor: T.bg, minHeight: '100%' },

  // La barra laterale è uno scaffale incassato: le voci stanno "dentro", e
  // quella attiva è l'unica in rilievo.
  sidebar: {
    width: 236, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20,
    backgroundColor: T.field, boxShadow: CLAY.inset, gap: 4,
  },
  back: { alignSelf: 'flex-start', marginBottom: 14 },
  backText: { fontFamily: FONTS.sansMedium, fontSize: 13, color: T.primary },
  brand: { fontFamily: FONTS.display, fontSize: 20, color: T.ink, letterSpacing: -0.4, marginBottom: 18, paddingHorizontal: 10 },
  navList: { gap: 4 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: RADIUS.md,
  },
  navItemActive: { backgroundColor: T.surface, boxShadow: CLAY.chip },
  navText: { fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink2 },
  navTextActive: { color: T.ink, fontFamily: FONTS.sansBold },
  navBadge: {
    fontFamily: FONTS.sansMedium, fontSize: 11, color: T.ink2, backgroundColor: T.primarySoft,
    paddingHorizontal: 7, paddingVertical: 1, borderRadius: RADIUS.tag, overflow: 'hidden',
  },
  navBadgeAlert: { backgroundColor: T.urgentSoft, color: T.urgentInk },
  sideWarn: { fontFamily: FONTS.sansMedium, fontSize: 12, color: T.urgent, lineHeight: 17, paddingHorizontal: 10, marginBottom: 8 },
  sideMeta: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, lineHeight: 17, paddingHorizontal: 10 },

  main: { flex: 1, minWidth: 0 },
  topbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
    paddingHorizontal: 32, paddingTop: 22, paddingBottom: 14,
  },
  pageTitle: { fontFamily: FONTS.display, fontSize: 28, color: T.ink, letterSpacing: -0.6 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  segment: { flexDirection: 'row', backgroundColor: T.field, borderRadius: RADIUS.md, padding: 3, boxShadow: CLAY.inset },
  segBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: RADIUS.sm },
  segBtnActive: { backgroundColor: T.surface, boxShadow: CLAY.chip },
  segText: { fontFamily: FONTS.sansMedium, fontSize: 13, color: T.ink2 },
  segTextActive: { color: T.ink },
  ghostBtn: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: RADIUS.lg, backgroundColor: T.primarySoft },
  ghostText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.primaryInk },
  primaryBtn: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: RADIUS.lg, backgroundColor: T.primary, minWidth: 150, alignItems: 'center' },
  primaryText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.onPrimary },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 32, paddingBottom: 48, paddingTop: 4 },
  inner: { width: '100%', maxWidth: 1320, gap: 16 },
  narrow: { maxWidth: 760 },
});
