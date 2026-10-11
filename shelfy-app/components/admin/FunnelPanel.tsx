import React from 'react';
import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemedStyles } from '@/context/ThemeContext';
import { createAdminStyles } from './adminStyles';
import { ACTIVATION_TRACKING_SINCE, formatDate, pct } from './adminUtils';
import type { AdminData } from './useAdminData';

// Funnel di attivazione per guida di provenienza, in numeri (mobile).
export function FunnelPanel({ data }: { data: AdminData }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createAdminStyles);
  const funnel = data.funnel;

  return (
    <View style={styles.section}>
      <Text style={styles.cardDesc}>{t('admin.funnelIntro', { date: formatDate(ACTIVATION_TRACKING_SINCE) })}</Text>
      {funnel.length === 0 ? (
        <Text style={styles.empty}>{t('admin.funnelEmpty')}</Text>
      ) : funnel.map((r) => (
        <View key={r.source ?? '_other'} style={[styles.card, { gap: 6 }]}>
          <Text style={styles.cardTitle}>{r.source ?? t('admin.funnelOtherChannels')}</Text>
          <Row label={t('admin.funnelSignups')} value={String(r.signups)} />
          <Row label={t('admin.funnelFirstProduct')} value={pct(r.firstProduct, r.signups)} />
          <Row label={t('admin.funnelThirdProduct')} value={pct(r.thirdProduct, r.signups)} />
          <Row label={t('admin.funnelReturned7', { count: r.eligible7 })} value={pct(r.returned7, r.eligible7)} />
        </View>
      ))}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createAdminStyles);
  return (
    <View style={styles.resultRow}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={styles.resultValue}>{value}</Text>
    </View>
  );
}
