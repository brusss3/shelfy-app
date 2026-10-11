import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FONTS, RADIUS } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/context/ThemeContext';
import { KpiTiles } from './KpiTiles';
import { UsersPanel } from './UsersPanel';
import { FeedbackPanel } from './FeedbackPanel';
import { SurveysPanel } from './SurveysPanel';
import { SettingsPanel } from './SettingsPanel';
import { FunnelPanel } from './FunnelPanel';
import type { AdminData } from './useAdminData';

type Tab = 'overview' | 'users' | 'feedback' | 'surveys' | 'guides' | 'settings';

// Dashboard per telefono (e web stretto): una panoramica di soli numeri e le
// sezioni di gestione, una per scheda. Nessun grafico: su uno schermo piccolo
// i numeri si leggono prima e meglio.
export function AdminMobile({ data }: { data: AdminData }) {
  const { t } = useTranslation();
  const { T } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: t('admin.dash.nav.overview') },
    { id: 'users', label: t('admin.tabs.users') },
    { id: 'feedback', label: data.counts.newFeedback > 0 ? `${t('admin.tabs.feedback')} · ${data.counts.newFeedback}` : t('admin.tabs.feedback') },
    { id: 'surveys', label: t('admin.tabs.surveys') },
    { id: 'guides', label: t('admin.tabs.guides') },
    { id: 'settings', label: data.aiEnabled ? t('admin.dash.nav.settings') : `${t('admin.dash.nav.settings')} ⛔` },
  ];

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button">
            <Text style={styles.backText}>{t('admin.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('admin.title')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {tabs.map((x) => (
              <TouchableOpacity
                key={x.id}
                onPress={() => setTab(x.id)}
                style={[styles.tab, tab === x.id && styles.tabActive]}
                activeOpacity={0.85}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === x.id }}
              >
                <Text style={[styles.tabText, tab === x.id && styles.tabTextActive]}>{x.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {data.loading ? (
        <View style={styles.center}><ActivityIndicator color={T.primary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={data.refreshing} onRefresh={data.reload} tintColor={T.primary} />}
        >
          <View style={styles.container}>
            {tab === 'overview' && <KpiTiles data={data} />}
            {tab === 'users' && <UsersPanel data={data} />}
            {tab === 'feedback' && <FeedbackPanel data={data} />}
            {tab === 'surveys' && <SurveysPanel data={data} />}
            {tab === 'guides' && <FunnelPanel data={data} />}
            {tab === 'settings' && <SettingsPanel data={data} />}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const createStyles = ({ T }: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { borderBottomWidth: 1, borderBottomColor: T.line, backgroundColor: T.bg },
  headerInner: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 8 },
  back: { marginBottom: 6, alignSelf: 'flex-start' },
  backText: { fontFamily: FONTS.sansMedium, fontSize: 14, color: T.primary },
  title: { fontFamily: FONTS.display, fontSize: 24, color: T.ink, letterSpacing: -0.5 },
  tabs: { flexDirection: 'row', gap: 4, marginTop: 10, paddingBottom: 0 },
  tab: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 2, borderBottomColor: 'transparent', borderRadius: RADIUS.sm },
  tabActive: { borderBottomColor: T.primary },
  tabText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.mute },
  tabTextActive: { color: T.ink },
  list: { padding: 16, paddingBottom: 60 },
  container: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 12 },
});
