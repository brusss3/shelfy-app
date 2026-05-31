import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, RefreshControl, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  getAllUsers, adminSetPremium, adminSetAdmin, AdminUserRecord,
  getAllFeedback, FeedbackRecord,
} from '@/lib/firestore';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

type Tab = 'users' | 'feedback';

function confirm(title: string, message: string, onYes: () => void, destructive = false) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Conferma', style: destructive ? 'destructive' : 'default', onPress: onYes },
  ]);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('it-IT');
}

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [u, f] = await Promise.all([getAllUsers(), getAllFeedback().catch(() => [])]);
      u.sort((a, b) => a.email.localeCompare(b.email));
      setUsers(u);
      setFeedback(f);
    } catch (e: any) {
      Alert.alert('Errore', e?.message ?? 'Impossibile caricare i dati.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.isAdmin) {
      router.replace('/(tabs)');
      return;
    }
    load();
  }, [user, load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const togglePremium = (u: AdminUserRecord) => {
    const next = !u.isPremium;
    confirm(next ? 'Abilita Premium' : 'Rimuovi Premium', u.email, async () => {
      setUpdating(u.uid);
      try {
        await adminSetPremium(u.uid, next);
        setUsers((prev) => prev.map((x) => x.uid === u.uid ? { ...x, isPremium: next } : x));
      } catch (e: any) {
        Alert.alert('Errore', e?.message ?? 'Aggiornamento fallito.');
      } finally { setUpdating(null); }
    }, !next);
  };

  const toggleAdmin = (u: AdminUserRecord) => {
    if (u.uid === user?.uid) {
      Alert.alert('Attenzione', 'Non puoi modificare il tuo ruolo admin.');
      return;
    }
    const next = !u.isAdmin;
    confirm(next ? 'Rendi Admin' : 'Rimuovi Admin', u.email, async () => {
      setUpdating(u.uid);
      try {
        await adminSetAdmin(u.uid, next);
        setUsers((prev) => prev.map((x) => x.uid === u.uid ? { ...x, isAdmin: next } : x));
      } catch (e: any) {
        Alert.alert('Errore', e?.message ?? 'Aggiornamento fallito.');
      } finally { setUpdating(null); }
    }, true);
  };

  if (!user?.isAdmin) return null;

  const premiumCount = users.filter((u) => u.isPremium).length;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Indietro</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Dashboard admin</Text>
          <Text style={styles.subtitle}>{users.length} utenti · {premiumCount} premium · {feedback.length} segnalazioni</Text>

          <View style={styles.tabs}>
            <TabBtn label="Utenti" active={tab === 'users'} onPress={() => setTab('users')} />
            <TabBtn label="Feedback" active={tab === 'feedback'} onPress={() => setTab('feedback')} />
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={T.primary} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.primary} />}
        >
          <View style={styles.container}>
            {tab === 'users' ? (
              users.length === 0 ? <Text style={styles.empty}>Nessun utente.</Text> :
              users.map((u) => (
                <View key={u.uid} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.name} numberOfLines={1}>{u.displayName || '—'}</Text>
                      <Text style={styles.email} numberOfLines={1}>{u.email}</Text>
                      {u.createdAt ? <Text style={styles.date}>Iscritto {formatDate(u.createdAt)}</Text> : null}
                      {u.isPremium && (
                        <Text style={styles.subInfo}>
                          {u.subscriptionType === 'annual' ? 'Annuale' : u.subscriptionType === 'monthly' ? 'Mensile' : 'Premium'}
                          {u.subscriptionExpiresAt ? ` · rinnovo ${formatDate(u.subscriptionExpiresAt)}` : ''}
                        </Text>
                      )}
                    </View>
                    <View style={styles.badges}>
                      {u.isPremium && <View style={[styles.badge, styles.badgePremium]}><Text style={styles.badgeText}>Premium</Text></View>}
                      {u.isAdmin && <View style={[styles.badge, styles.badgeAdmin]}><Text style={styles.badgeText}>Admin</Text></View>}
                    </View>
                  </View>

                  {updating === u.uid ? (
                    <ActivityIndicator color={T.primary} style={{ marginTop: 10 }} />
                  ) : (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.btn, u.isPremium ? styles.btnDestructive : styles.btnPrimary]}
                        onPress={() => togglePremium(u)}
                      >
                        <Text style={[styles.btnText, u.isPremium && styles.btnTextDanger]}>
                          {u.isPremium ? 'Rimuovi Premium' : 'Abilita Premium'}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.btn, u.isAdmin ? styles.btnDestructive : styles.btnSecondary]}
                        onPress={() => toggleAdmin(u)}
                      >
                        <Text style={[styles.btnText, u.isAdmin ? styles.btnTextDanger : styles.btnTextSecondary]}>
                          {u.isAdmin ? 'Rimuovi Admin' : 'Rendi Admin'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            ) : (
              feedback.length === 0 ? <Text style={styles.empty}>Nessuna segnalazione.</Text> :
              feedback.map((f) => (
                <View key={f.id} style={styles.card}>
                  <View style={styles.fbHeader}>
                    <View style={[styles.fbTag, fbTagStyle(f.category)]}>
                      <Text style={styles.fbTagText}>{fbLabel(f.category)}</Text>
                    </View>
                    {f.createdAt ? <Text style={styles.date}>{formatDate(f.createdAt)}</Text> : null}
                  </View>
                  <Text style={styles.fbMessage}>{f.message}</Text>
                  <Text style={styles.fbFrom}>{f.displayName || 'Anonimo'} · {f.email}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.tab, active && styles.tabActive]} activeOpacity={0.85}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function fbLabel(c: string) {
  return c === 'bug' ? '🐞 Bug' : c === 'suggerimento' ? '💡 Idea' : '💬 Altro';
}
function fbTagStyle(c: string) {
  return c === 'bug' ? { backgroundColor: T.urgentSoft } : c === 'suggerimento' ? { backgroundColor: T.okSoft } : { backgroundColor: T.primarySoft };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { borderBottomWidth: 1, borderBottomColor: T.line, backgroundColor: T.surface },
  headerInner: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 0 },
  back: { marginBottom: 8 },
  backText: { fontFamily: FONTS.sansMedium, fontSize: 14, color: T.primary },
  title: { fontFamily: FONTS.display, fontSize: 24, color: T.ink, letterSpacing: -0.5 },
  subtitle: { fontFamily: FONTS.sans, fontSize: 13, color: T.mute, marginTop: 2 },

  tabs: { flexDirection: 'row', gap: 8, marginTop: 14 },
  tab: { paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: T.primary },
  tabText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.mute },
  tabTextActive: { color: T.ink },

  list: { padding: 16, paddingBottom: 60 },
  container: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 12 },
  empty: { textAlign: 'center', color: T.mute, fontFamily: FONTS.sans, paddingVertical: 40 },

  card: { backgroundColor: T.surface, borderRadius: RADIUS.md, padding: 16, ...SHADOW.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1, marginRight: 8 },
  name: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
  email: { fontFamily: FONTS.sans, fontSize: 13, color: T.ink2, marginTop: 2 },
  date: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 4 },
  subInfo: { fontFamily: FONTS.sansMedium, fontSize: 12, color: T.primary, marginTop: 4 },

  badges: { flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill },
  badgePremium: { backgroundColor: T.warnSoft },
  badgeAdmin: { backgroundColor: T.primarySoft },
  badgeText: { fontFamily: FONTS.sansSemiBold, fontSize: 11, color: T.primaryInk },

  actions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  btn: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.sm, alignItems: 'center' },
  btnPrimary: { backgroundColor: T.primary },
  btnSecondary: { backgroundColor: T.primarySoft },
  btnDestructive: { backgroundColor: T.urgentSoft },
  btnText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: '#fbfaf3' },
  btnTextSecondary: { color: T.primaryInk },
  btnTextDanger: { color: T.urgent },

  fbHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  fbTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  fbTagText: { fontFamily: FONTS.sansSemiBold, fontSize: 12, color: T.ink },
  fbMessage: { fontFamily: FONTS.sans, fontSize: 14, color: T.ink, lineHeight: 20 },
  fbFrom: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 8 },
});
