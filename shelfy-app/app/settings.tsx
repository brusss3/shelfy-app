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
import { submitFeedback, FeedbackCategory } from '@/lib/firestore';
import { openSubscriptionManagement } from '@/lib/purchases';
import { showAlert } from '@/lib/alert';
import { LanguageOption, getStoredLanguageOption, setAppLanguage } from '@/lib/i18n';
import PrimaryButton from '@/components/PrimaryButton';
import { T, FONTS, RADIUS, SHADOW, CLAY } from '@/constants/theme';

const CATEGORIES: { id: FeedbackCategory; labelKey: string }[] = [
  { id: 'suggerimento', labelKey: 'settings.feedback.categories.idea' },
  { id: 'bug', labelKey: 'settings.feedback.categories.bug' },
  { id: 'prodotto', labelKey: 'settings.feedback.categories.product' },
  { id: 'altro', labelKey: 'settings.feedback.categories.other' },
];

const LANGUAGE_OPTIONS: { id: LanguageOption; labelKey: string }[] = [
  { id: 'system', labelKey: 'settings.language.system' },
  { id: 'it', labelKey: 'settings.language.it' },
  { id: 'en', labelKey: 'settings.language.en' },
];

export default function SettingsScreen() {
  const { user, logOut, setNotificationsEnabled } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();

  const [savingNotif, setSavingNotif] = useState(false);
  const [fbCategory, setFbCategory] = useState<FeedbackCategory>('bug');
  const [fbMessage, setFbMessage] = useState('');
  const [sendingFb, setSendingFb] = useState(false);
  const [langOption, setLangOption] = useState<LanguageOption>('system');

  useEffect(() => {
    getStoredLanguageOption().then(setLangOption);
  }, []);

  const initial = user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';
  const name = user?.displayName ?? '—';
  const email = user?.email ?? '';
  const isPremium = !!user?.isPremium;
  const notifEnabled = user?.notificationsEnabled ?? true;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const formatDate = (iso: string | null | undefined): string => {
    if (!iso) return '';
    const d = new Date(iso);
    const locale = i18n.language === 'it' ? 'it-IT' : 'en-US';
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const onToggleNotif = async (value: boolean) => {
    setSavingNotif(true);
    try {
      await setNotificationsEnabled(value);
    } finally {
      setSavingNotif(false);
    }
  };

  const handleManageSub = () => {
    if (Platform.OS === 'web') {
      alert(t('settings.subscription.manageWebAlert'));
      return;
    }
    openSubscriptionManagement();
  };

  const handleLogout = () => {
    showAlert(t('settings.logout.confirmTitle'), t('settings.logout.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logout.confirm'), style: 'destructive', onPress: () => logOut() },
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

          {/* Lingua */}
          <Section title={t('settings.language.title')}>
            <View style={styles.langRow}>
              {LANGUAGE_OPTIONS.map((opt) => {
                const active = langOption === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => handleChangeLanguage(opt.id)}
                    activeOpacity={0.85}
                    style={[styles.langOpt, active && styles.langOptActive]}
                  >
                    <Text style={[styles.langOptText, active && styles.langOptTextActive]}>{t(opt.labelKey)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Section>

          {/* Notifiche */}
          <Section title={t('settings.notifications.title')}>
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.rowLabel}>{t('settings.notifications.push')}</Text>
                <Text style={styles.rowSub}>
                  {t('settings.notifications.desc')}
                  {Platform.OS === 'web' ? t('settings.notifications.webOnly') : ''}
                </Text>
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

          {/* Strumenti ristorazione */}
          <Section title={t('settings.restaurants.title')}>
            <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/labels')} activeOpacity={0.8}>
              <Text style={styles.rowLabel}>{t('settings.restaurants.labels')}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          </Section>

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
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  premiumBadgeText: { fontFamily: FONTS.sansBold, fontSize: 10, color: '#fbfaf3', letterSpacing: 0.6 },

  section: { gap: 8 },
  sectionTitle: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.mute, marginLeft: 4 },
  card: { backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.card },

  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
  rowSub: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 3, lineHeight: 17 },

  smallBtn: { backgroundColor: T.primarySoft, borderRadius: RADIUS.md, paddingVertical: 9, paddingHorizontal: 14 },
  smallBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.primaryInk },

  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chevron: { fontSize: 22, color: T.mute },

  langRow: { flexDirection: 'row', gap: 8 },
  langOpt: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: RADIUS.md,
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
    backgroundColor: '#ece8de', borderRadius: RADIUS.input, boxShadow: CLAY.inset,
    padding: 12, fontFamily: FONTS.sans, fontSize: 14, color: T.ink, minHeight: 96,
  },
  logoutBtn: {
    backgroundColor: T.urgentSoft, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
  },
  logoutText: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.urgent },

  version: { textAlign: 'center', fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 4 },
});
