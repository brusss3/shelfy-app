import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import { createAdminStyles } from './adminStyles';
import { SwitchCard } from './AdminUi';
import type { AdminData } from './useAdminData';

// Interruttori globali (AI, pagamenti) e notifiche admin: prima erano tre
// schede separate, ora un'unica pagina "Impostazioni".
export function SettingsPanel({ data }: { data: AdminData }) {
  const { t } = useTranslation();
  const { T } = useTheme();
  const styles = useThemedStyles(createAdminStyles);
  const { user } = data;
  if (!user) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.groupLabel}>{t('admin.dash.settingsAppGroup')}</Text>
      <SwitchCard
        title={t('admin.aiAllUsersTitle')}
        desc={t('admin.aiAllUsersDesc')}
        value={data.aiEnabled}
        onChange={data.toggleGlobalAi}
        disabled={data.togglingAi}
      >
        <Text style={[styles.cardDesc, { marginTop: 10 }]}>
          {data.aiEnabled ? t('admin.aiActiveStatus') : t('admin.aiInactiveStatus')}
        </Text>
        <Text style={styles.cardDesc}>{t('admin.blockedUsersCount', { count: data.counts.aiBlocked })}</Text>
      </SwitchCard>

      {/* Interruttore dei pagamenti: acceso qui, il paywall e gli inviti
          all'acquisto compaiono nell'app senza ripubblicarla. */}
      <SwitchCard
        title={t('admin.monetizationTitle')}
        desc={t('admin.monetizationDesc')}
        value={data.monetization}
        onChange={data.toggleMonetization}
        disabled={data.togglingMonetization}
      >
        <Text style={[styles.cardDesc, { marginTop: 10 }]}>{t('admin.waitlistCount', { count: data.counts.waitlist })}</Text>
      </SwitchCard>

      <Text style={styles.groupLabel}>{t('admin.dash.settingsNotifGroup')}</Text>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t('admin.deviceTitle')}</Text>
        <Text style={styles.cardDesc}>{user.pushToken ? t('admin.deviceRegistered') : t('admin.deviceNotRegistered')}</Text>
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={data.registerPush} disabled={data.registeringPush} accessibilityRole="button">
            {data.registeringPush ? <ActivityIndicator color={T.onPrimary} /> : (
              <Text style={styles.btnText}>{user.pushToken ? t('admin.reRegisterDevice') : t('admin.registerDevice')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={data.sendTestPush} disabled={data.sendingTest} accessibilityRole="button">
            {data.sendingTest ? <ActivityIndicator color={T.primaryInk} /> : (
              <Text style={[styles.btnText, styles.btnTextSecondary]}>{t('admin.sendTestNotification')}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <SwitchCard
        title={t('admin.newUsersTitle')}
        desc={t('admin.newUsersDesc')}
        value={user.adminNotifNewUsers ?? true}
        onChange={(v) => data.updateAdminNotifSettings({ adminNotifNewUsers: v })}
      />
      <SwitchCard
        title={t('admin.newFeedbackTitle')}
        desc={t('admin.newFeedbackDesc')}
        value={user.adminNotifFeedback ?? true}
        onChange={(v) => data.updateAdminNotifSettings({ adminNotifFeedback: v })}
      />
    </View>
  );
}
