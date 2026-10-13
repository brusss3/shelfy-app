import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Platform, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { submitFeedback, FeedbackCategory, saveUserWebPushToken } from '@/lib/firestore';
import { openSubscriptionManagement } from '@/lib/purchases';
import { downloadMyData, deleteMyAccount, needsRecentLogin } from '@/lib/account';
import { registerWebPush, needsHomeScreenInstall } from '@/lib/webPush';
import { showAlert } from '@/lib/alert';
import { LanguageOption, getStoredLanguageOption, setAppLanguage, dateLocale } from '@/lib/i18n';
import LanguagePicker from '@/components/LanguagePicker';
import { Ionicons } from '@expo/vector-icons';
import PrimaryButton from '@/components/PrimaryButton';
import { FONTS, RADIUS } from '@/constants/theme';
import { useTheme, useThemedStyles, useThemeMode, type ThemeMode, type Theme } from '@/context/ThemeContext';

const CATEGORIES: { id: FeedbackCategory; labelKey: string }[] = [
  { id: 'suggerimento', labelKey: 'settings.feedback.categories.idea' },
  { id: 'bug', labelKey: 'settings.feedback.categories.bug' },
  { id: 'prodotto', labelKey: 'settings.feedback.categories.product' },
  { id: 'altro', labelKey: 'settings.feedback.categories.other' },
];

const THEME_OPTIONS: { id: ThemeMode; icon: 'phone-portrait-outline' | 'sunny-outline' | 'moon-outline'; labelKey: string }[] = [
  { id: 'system', icon: 'phone-portrait-outline', labelKey: 'settings.theme.system' },
  { id: 'light', icon: 'sunny-outline', labelKey: 'settings.theme.light' },
  { id: 'dark', icon: 'moon-outline', labelKey: 'settings.theme.dark' },
];

export default function SettingsScreen() {
  const { T } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user, logOut, setNotificationsEnabled, monetizationEnabled } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();

  const [savingNotif, setSavingNotif] = useState(false);
  const [fbCategory, setFbCategory] = useState<FeedbackCategory>('bug');
  const [fbMessage, setFbMessage] = useState('');
  const [sendingFb, setSendingFb] = useState(false);
  const [langOption, setLangOption] = useState<LanguageOption>('system');
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getStoredLanguageOption().then(setLangOption);
  }, []);

  const isGuest = !!user?.isGuest;
  const name = isGuest ? t('guest.profileName') : user?.displayName ?? '—';
  const initial = isGuest
    ? name[0].toUpperCase()
    : user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';
  const email = user?.email ?? '';
  const isPremium = !!user?.isPremium;
  const notifEnabled = user?.notificationsEnabled ?? true;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const formatDate = (iso: string | null | undefined): string => {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const onToggleNotif = async (value: boolean) => {
    setSavingNotif(true);
    try {
      if (Platform.OS === 'web' && value && user) {
        const token = await registerWebPush();
        if (!token) {
          showAlert(t('settings.notifications.webBlockedTitle'), t('settings.notifications.webBlockedBody'));
          return;
        }
        await saveUserWebPushToken(user.uid, token);
      }
      await setNotificationsEnabled(value);
    } finally {
      setSavingNotif(false);
    }
  };

  const handleManageSub = async () => {
    await openSubscriptionManagement();
  };

  // Un ospite che esce perde la dispensa: non c'è un account per rientrare.
  const handleLogout = () => {
    showAlert(t('settings.logout.confirmTitle'), isGuest ? t('guest.logoutWarning') : t('settings.logout.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logout.confirm'), style: 'destructive', onPress: () => logOut() },
    ]);
  };

  // Portabilità (GDPR art. 20): tutti i dati dell'utente in un file JSON.
  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadMyData();
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('account.exportFailed'));
    } finally {
      setExporting(false);
    }
  };

  // Cancellazione (GDPR art. 17): irreversibile, quindi due passaggi chiari.
  // L'abbonamento non si disdice da qui: lo dice il testo, se ce n'è uno attivo.
  const handleDeleteAccount = () => {
    const hasSubscription = !!user?.isPremium || !!user?.subscriptionType;
    const body = [
      isGuest ? t('account.deleteBodyGuest') : t('account.deleteBody'),
      hasSubscription ? t('account.deleteSubscriptionWarning') : null,
    ].filter(Boolean).join('\n\n');
    showAlert(t('account.deleteTitle'), body, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteMyAccount();
            await logOut();
            showAlert(t('account.deletedTitle'), t('account.deletedBody'));
          } catch (e: any) {
            if (needsRecentLogin(e)) {
              showAlert(t('account.recentLoginTitle'), t('account.recentLoginBody'), [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('account.recentLoginCta'), onPress: () => logOut() },
              ]);
            } else {
              showAlert(t('common.error'), e?.message ?? t('account.deleteFailed'));
            }
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const handleChangeLanguage = async (option: LanguageOption) => {
    setLangOption(option);
    await setAppLanguage(option);
  };

  const handleSendFeedback = async () => {
    if (!fbMessage.trim() || !user) return;
    setSendingFb(true);
    try {
      await submitFeedback({
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? '',
        category: fbCategory,
        message: fbMessage.trim(),
      });
      setFbMessage('');
      showAlert(t('settings.feedback.sentTitle'), t('settings.feedback.sentBody'));
    } catch {
      showAlert(t('common.error'), t('settings.feedback.errorBody'));
    } finally {
      setSendingFb(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>{t('settings.back')}</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>

          {/* Profilo */}
          <View style={styles.profileCard}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={1}>{name}</Text>
              {email ? <Text style={styles.email} numberOfLines={1}>{email}</Text> : null}
            </View>
            {isPremium && (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumBadgeText}>{t('settings.premium')}</Text>
              </View>
            )}
          </View>

          {/* Abbonamento */}
          {isPremium && (
            <Section title={t('settings.subscription.title')}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>
                    {user?.subscriptionType === 'annual' ? t('settings.subscription.annual') :
                     user?.subscriptionType === 'monthly' ? t('settings.subscription.monthly') : t('settings.subscription.activeGeneric')}
                  </Text>
                  {user?.subscriptionExpiresAt ? (
                    <Text style={styles.rowSub}>
                      {t('settings.subscription.renewsOn', { date: formatDate(user.subscriptionExpiresAt) })}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity style={styles.smallBtn} onPress={handleManageSub} activeOpacity={0.8}>
                  <Text style={styles.smallBtnText}>{t('settings.subscription.manage')}</Text>
                </TouchableOpacity>
              </View>
            </Section>
          )}

          {/* Senza piani in vendita l'invito sparisce del tutto: in
              Impostazioni non c'è un limite da spiegare, sarebbe solo una
              promessa di qualcosa che non si può ancora comprare. */}
          {isGuest && (
            <TouchableOpacity
              style={styles.upsellCard}
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.upsellTitle}>{t('guest.settingsTitle')}</Text>
                <Text style={styles.upsellDesc}>{t('guest.settingsDesc')}</Text>
              </View>
              <Text style={styles.chevronLarge}>›</Text>
            </TouchableOpacity>
          )}

          {!isPremium && !isGuest && monetizationEnabled && (
            <TouchableOpacity
              style={styles.upsellCard}
              onPress={() => router.push('/paywall')}
              activeOpacity={0.85}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.upsellTitle}>{t('settings.upsell.title')}</Text>
                <Text style={styles.upsellDesc}>{t('settings.upsell.desc')}</Text>
              </View>
              <Text style={styles.chevronLarge}>›</Text>
            </TouchableOpacity>
          )}

          {/* Lingua */}
          <Section title={t('settings.language.title')}>
            <LanguagePicker value={langOption} onChange={handleChangeLanguage} />
          </Section>

          {/* Tema */}
          <Section title={t('settings.theme.title')}>
            <View style={styles.langRow}>
              {THEME_OPTIONS.map((opt) => {
                const active = themeMode === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => setThemeMode(opt.id)}
                    activeOpacity={0.85}
                    style={[styles.langOpt, active && styles.langOptActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons name={opt.icon} size={18} color={active ? T.primaryInk : T.ink2} />
                    <Text style={[styles.langOptText, active && styles.langOptTextActive]}>{t(opt.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Notifiche */}
          <Section title={t('settings.notifications.title')}>
            {Platform.OS === 'web' && needsHomeScreenInstall() ? (
              <Text style={styles.rowSub}>{t('settings.notifications.iosInstallHint')}</Text>
            ) : (
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text style={styles.rowLabel}>{t('settings.notifications.push')}</Text>
                  <Text style={styles.rowSub}>{t('settings.notifications.desc')}</Text>
                </View>
                {savingNotif ? (
                  <ActivityIndicator color={T.primary} />
                ) : (
                  <Switch
                    value={notifEnabled}
                    onValueChange={onToggleNotif}
                    trackColor={{ false: T.line, true: T.primary }}
                    thumbColor="#fff"
                  />
                )}
              </View>
            )}
          </Section>

          {/* Feedback */}
          <Section title={t('settings.feedback.title')}>
            <View style={styles.fbCats}>
              {CATEGORIES.map((c) => {
                const active = fbCategory === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setFbCategory(c.id)}
                    activeOpacity={0.85}
                    style={[styles.fbCat, active && styles.fbCatActive]}
                  >
                    <Text style={[styles.fbCatText, active && styles.fbCatTextActive]}>{t(c.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.fbInput}
              value={fbMessage}
              onChangeText={setFbMessage}
              placeholder={t('settings.feedback.placeholder')}
              placeholderTextColor={T.mute}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <PrimaryButton
              onPress={handleSendFeedback}
              disabled={!fbMessage.trim()}
              loading={sendingFb}
              label={t('settings.feedback.send')}
              fullWidth
              style={{ marginTop: 12 }}
            />
          </Section>

          {/* Account: i diritti dell'utente sui propri dati, sempre a portata di mano. */}
          <Section title={t('account.title')}>
            <TouchableOpacity style={styles.row} onPress={handleExport} disabled={exporting} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{t('account.export')}</Text>
                <Text style={styles.rowSub}>{t('account.exportDesc')}</Text>
              </View>
              {exporting ? <ActivityIndicator color={T.primary} /> : <Ionicons name="download-outline" size={20} color={T.primary} />}
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} disabled={deleting} activeOpacity={0.8}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowLabel, { color: T.urgent }]}>{t('account.delete')}</Text>
                <Text style={styles.rowSub}>{t('account.deleteDesc')}</Text>
              </View>
              {deleting ? <ActivityIndicator color={T.urgent} /> : <Ionicons name="trash-outline" size={20} color={T.urgent} />}
            </TouchableOpacity>
          </Section>

          {/* Note legali, licenze e crediti. */}
          <TouchableOpacity style={styles.legalRow} onPress={() => router.push('/legal')} activeOpacity={0.85}>
            <Ionicons name="document-text-outline" size={20} color={T.primary} />
            <Text style={styles.legalRowText}>{t('legal.title')}</Text>
            <Ionicons name="chevron-forward" size={18} color={T.mute} />
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <Text style={styles.logoutText}>{t('settings.logout.button')}</Text>
          </TouchableOpacity>

          <Text style={styles.version}>{t('settings.version', { version })}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const createStyles = ({ T, CLAY, SHADOW }: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },

  header: {
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: T.line, backgroundColor: T.surface,
  },
  back: { marginBottom: 8 },
  backText: { fontFamily: FONTS.sansMedium, fontSize: 14, color: T.primary },
  title: { fontFamily: FONTS.display, fontSize: 26, color: T.ink, letterSpacing: -0.5 },

  scroll: { paddingVertical: 20, paddingBottom: 60 },
  // Centrato e con larghezza massima → leggibile su web/desktop.
  container: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 16, gap: 18 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.card,
  },
  avatar: {
    width: 56, height: 56, borderRadius: RADIUS.pill, backgroundColor: T.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: FONTS.display, fontSize: 24, color: T.primaryInk },
  name: { fontFamily: FONTS.sansBold, fontSize: 18, color: T.ink },
  email: { fontFamily: FONTS.sans, fontSize: 13, color: T.mute, marginTop: 2 },
  premiumBadge: {
    backgroundColor: T.primary, borderRadius: RADIUS.tag, paddingVertical: 4, paddingHorizontal: 10,
  },
  premiumBadgeText: { fontFamily: FONTS.sansBold, fontSize: 10, color: T.onPrimary, letterSpacing: 0.6 },

  section: { gap: 8 },
  sectionTitle: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.mute, marginLeft: 4 },
  card: { backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.card },

  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
  rowSub: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 3, lineHeight: 17 },

  divider: { height: 1, backgroundColor: T.line, marginVertical: 14 },
  legalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.card,
  },
  legalRowText: { flex: 1, fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },

  smallBtn: { backgroundColor: T.primarySoft, borderRadius: RADIUS.md, paddingVertical: 9, paddingHorizontal: 14 },
  smallBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.primaryInk },

  upsellCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.primary, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.card,
  },
  upsellTitle: { fontFamily: FONTS.sansBold, fontSize: 15, color: T.onPrimary },
  upsellDesc: { fontFamily: FONTS.sans, fontSize: 12, color: T.onPrimary, opacity: 0.8, marginTop: 2 },
  chevronLarge: { fontSize: 22, color: T.onPrimary },

  langRow: { flexDirection: 'row', gap: 8 },
  langOpt: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: RADIUS.md,
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.line,
  },
  langOptActive: { backgroundColor: T.primarySoft, borderColor: T.primary },
  langOptText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink2 },
  langOptTextActive: { color: T.primaryInk },

  fbCats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  fbCat: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: RADIUS.md,
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.line,
  },
  fbCatActive: { backgroundColor: T.primarySoft, borderColor: T.primary },
  fbCatText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink2 },
  fbCatTextActive: { color: T.primaryInk },
  fbInput: {
    backgroundColor: T.field, borderRadius: RADIUS.input, boxShadow: CLAY.inset,
    padding: 12, fontFamily: FONTS.sans, fontSize: 14, color: T.ink, minHeight: 96,
  },
  logoutBtn: {
    backgroundColor: T.urgentSoft, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
  },
  logoutText: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.urgent },

  version: { textAlign: 'center', fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 4 },
});
