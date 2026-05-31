import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Switch, Platform, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuth } from '@/context/AuthContext';
import { submitFeedback, FeedbackCategory } from '@/lib/firestore';
import { openSubscriptionManagement } from '@/lib/purchases';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
}

const CATEGORIES: { id: FeedbackCategory; label: string }[] = [
  { id: 'bug', label: '🐞 Bug' },
  { id: 'suggerimento', label: '💡 Idea' },
  { id: 'altro', label: '💬 Altro' },
];

export default function SettingsScreen() {
  const { user, logOut, setNotificationsEnabled } = useAuth();
  const router = useRouter();

  const [savingNotif, setSavingNotif] = useState(false);
  const [fbCategory, setFbCategory] = useState<FeedbackCategory>('bug');
  const [fbMessage, setFbMessage] = useState('');
  const [sendingFb, setSendingFb] = useState(false);

  const initial = user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';
  const name = user?.displayName ?? '—';
  const email = user?.email ?? '';
  const isPremium = !!user?.isPremium;
  const notifEnabled = user?.notificationsEnabled ?? true;
  const version = Constants.expoConfig?.version ?? '1.0.0';

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
      alert("Gestisci l'abbonamento dall'App Store o Google Play sul tuo dispositivo.");
      return;
    }
    openSubscriptionManagement();
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (window.confirm("Vuoi uscire dall'account?")) logOut();
      return;
    }
    Alert.alert('Logout', "Vuoi uscire dall'account?", [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Esci', style: 'destructive', onPress: () => logOut() },
    ]);
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
      const ok = 'Grazie! La tua segnalazione è stata inviata.';
      if (Platform.OS === 'web') alert(ok); else Alert.alert('Inviato', ok);
    } catch {
      const err = 'Invio non riuscito. Riprova più tardi.';
      if (Platform.OS === 'web') alert(err); else Alert.alert('Errore', err);
    } finally {
      setSendingFb(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backText}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Impostazioni</Text>
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
                <Text style={styles.premiumBadgeText}>✦ PREMIUM</Text>
              </View>
            )}
          </View>

          {/* Abbonamento */}
          {isPremium && (
            <Section title="Abbonamento">
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>
                    {user?.subscriptionType === 'annual' ? 'Piano annuale' :
                     user?.subscriptionType === 'monthly' ? 'Piano mensile' : 'Premium attivo'}
                  </Text>
                  {user?.subscriptionExpiresAt ? (
                    <Text style={styles.rowSub}>Rinnovo il {formatDate(user.subscriptionExpiresAt)}</Text>
                  ) : null}
                </View>
                <TouchableOpacity style={styles.smallBtn} onPress={handleManageSub} activeOpacity={0.8}>
                  <Text style={styles.smallBtnText}>Gestisci</Text>
                </TouchableOpacity>
              </View>
            </Section>
          )}

          {/* Notifiche */}
          <Section title="Notifiche">
            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: 12 }}>
                <Text style={styles.rowLabel}>Notifiche push</Text>
                <Text style={styles.rowSub}>
                  Avvisi quando un prodotto sta per scadere.
                  {Platform.OS === 'web' ? ' Disponibili su app iOS e Android.' : ''}
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
          <Section title="Segnala un problema o un'idea">
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
                    <Text style={[styles.fbCatText, active && styles.fbCatTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={styles.fbInput}
              value={fbMessage}
              onChangeText={setFbMessage}
              placeholder="Descrivi il problema o la tua proposta…"
              placeholderTextColor={T.mute}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!fbMessage.trim() || sendingFb) && { opacity: 0.5 }]}
              onPress={handleSendFeedback}
              disabled={!fbMessage.trim() || sendingFb}
              activeOpacity={0.85}
            >
              {sendingFb ? <ActivityIndicator color="#fff" /> : <Text style={styles.sendBtnText}>Invia segnalazione</Text>}
            </TouchableOpacity>
          </Section>

          {/* Admin */}
          {user?.isAdmin && (
            <Section title="Amministrazione">
              <TouchableOpacity style={styles.linkRow} onPress={() => router.push('/admin')} activeOpacity={0.8}>
                <Text style={styles.rowLabel}>⚙  Dashboard admin</Text>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            </Section>
          )}

          {/* Logout */}
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
            <Text style={styles.logoutText}>Esci dall'account</Text>
          </TouchableOpacity>

          <Text style={styles.version}>Shelfy v{version}</Text>
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
    backgroundColor: T.primary, borderRadius: RADIUS.pill, paddingVertical: 4, paddingHorizontal: 10,
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

  fbCats: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  fbCat: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: RADIUS.md,
    backgroundColor: T.bg, borderWidth: 1, borderColor: T.line,
  },
  fbCatActive: { backgroundColor: T.primarySoft, borderColor: T.primary },
  fbCatText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink2 },
  fbCatTextActive: { color: T.primaryInk },
  fbInput: {
    backgroundColor: T.bg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: T.line,
    padding: 12, fontFamily: FONTS.sans, fontSize: 14, color: T.ink, minHeight: 96,
  },
  sendBtn: {
    backgroundColor: T.primary, borderRadius: RADIUS.pill, paddingVertical: 13,
    alignItems: 'center', marginTop: 12,
  },
  sendBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: '#fbfaf3' },

  logoutBtn: {
    backgroundColor: T.urgentSoft, borderRadius: RADIUS.md, paddingVertical: 14, alignItems: 'center',
  },
  logoutText: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.urgent },

  version: { textAlign: 'center', fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 4 },
});
