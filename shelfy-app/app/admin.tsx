import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Switch,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import {
  getAllUsers, adminSetPremium, adminSetAdmin, AdminUserRecord,
  getAllFeedback, FeedbackRecord, FeedbackStatus, updateFeedbackStatus, saveUserPushToken,
  subscribeToAiEnabled, adminSetAiEnabled, adminSetUserAiDisabled,
} from '@/lib/firestore';
import { registerForPushNotifications, sendAdminTestPushNotification } from '@/lib/notifications';
import { showAlert } from '@/lib/alert';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

type Tab = 'users' | 'feedback' | 'notifiche' | 'ai';
type SortMode = 'newest' | 'oldest' | 'az' | 'za';
type FilterChip = 'all' | 'new' | 'premium' | 'admin';
type FeedbackFilterChip = 'all' | FeedbackStatus;

const NEW_USER_DAYS = 7;

function confirm(title: string, message: string, onYes: () => void, destructive = false) {
  showAlert(title, message, [
    { text: 'Annulla', style: 'cancel' },
    { text: 'Conferma', style: destructive ? 'destructive' : 'default', onPress: onYes },
  ]);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('it-IT');
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
}

function formatRelative(iso: string | null | undefined): string {
  const d = daysSince(iso);
  if (d === null) return '';
  if (d <= 0) return 'Oggi';
  if (d === 1) return 'Ieri';
  if (d < 7) return `${d} giorni fa`;
  return formatDate(iso);
}

export default function AdminScreen() {
  const { user, updateAdminNotifSettings } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('users');
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [filterChip, setFilterChip] = useState<FilterChip>('all');
  const [feedbackFilter, setFeedbackFilter] = useState<FeedbackFilterChip>('all');
  const [updatingFeedback, setUpdatingFeedback] = useState<string | null>(null);

  const [registeringPush, setRegisteringPush] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [togglingAi, setTogglingAi] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, f] = await Promise.all([getAllUsers(), getAllFeedback().catch(() => [])]);
      // getAllUsers ora ritorna già ordinato per data iscrizione decrescente
      setUsers(u);
      setFeedback(f);
    } catch (e: any) {
      showAlert('Errore', e?.message ?? 'Impossibile caricare i dati.');
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

  useEffect(() => subscribeToAiEnabled(setAiEnabled, () => {}), []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const toggleGlobalAi = (next: boolean) => {
    confirm(
      next ? 'Riattiva ricette AI' : 'Disattiva ricette AI',
      next
        ? 'Tutti gli utenti potranno di nuovo generare la ricetta del giorno.'
        : 'Nessun utente potrà generare ricette AI finché non riattivi. Le chiamate a Groq si fermano subito.',
      async () => {
        setTogglingAi(true);
        try {
          await adminSetAiEnabled(next);
        } catch (e: any) {
          showAlert('Errore', e?.message ?? 'Aggiornamento fallito.');
        } finally { setTogglingAi(false); }
      },
      !next,
    );
  };

  const toggleUserAi = (u: AdminUserRecord) => {
    const next = !u.aiDisabled;
    confirm(next ? 'Blocca AI per questo utente' : 'Sblocca AI', u.email, async () => {
      setUpdating(u.uid);
      try {
        await adminSetUserAiDisabled(u.uid, next);
        setUsers((prev) => prev.map((x) => x.uid === u.uid ? { ...x, aiDisabled: next } : x));
      } catch (e: any) {
        showAlert('Errore', e?.message ?? 'Aggiornamento fallito.');
      } finally { setUpdating(null); }
    }, next);
  };

  const togglePremium = (u: AdminUserRecord) => {
    const next = !u.isPremium;
    confirm(next ? 'Abilita Premium' : 'Rimuovi Premium', u.email, async () => {
      setUpdating(u.uid);
      try {
        await adminSetPremium(u.uid, next);
        setUsers((prev) => prev.map((x) => x.uid === u.uid ? { ...x, isPremium: next } : x));
      } catch (e: any) {
        showAlert('Errore', e?.message ?? 'Aggiornamento fallito.');
      } finally { setUpdating(null); }
    }, !next);
  };

  const toggleAdmin = (u: AdminUserRecord) => {
    if (u.uid === user?.uid) {
      showAlert('Attenzione', 'Non puoi modificare il tuo ruolo admin.');
      return;
    }
    const next = !u.isAdmin;
    confirm(next ? 'Rendi Admin' : 'Rimuovi Admin', u.email, async () => {
      setUpdating(u.uid);
      try {
        await adminSetAdmin(u.uid, next);
        setUsers((prev) => prev.map((x) => x.uid === u.uid ? { ...x, isAdmin: next } : x));
      } catch (e: any) {
        showAlert('Errore', e?.message ?? 'Aggiornamento fallito.');
      } finally { setUpdating(null); }
    }, true);
  };

  const visibleUsers = useMemo(() => {
    let list = users;

    if (filterChip === 'new') {
      list = list.filter((u) => { const d = daysSince(u.createdAt); return d !== null && d < NEW_USER_DAYS; });
    } else if (filterChip === 'premium') {
      list = list.filter((u) => u.isPremium);
    } else if (filterChip === 'admin') {
      list = list.filter((u) => u.isAdmin);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((u) =>
        u.displayName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.uid.toLowerCase().includes(q),
      );
    }

    const sorted = [...list];
    if (sortMode === 'newest') sorted.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    else if (sortMode === 'oldest') sorted.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    else if (sortMode === 'az') sorted.sort((a, b) => (a.displayName || a.email).localeCompare(b.displayName || b.email));
    else if (sortMode === 'za') sorted.sort((a, b) => (b.displayName || b.email).localeCompare(a.displayName || a.email));
    return sorted;
  }, [users, search, sortMode, filterChip]);

  const visibleFeedback = useMemo(() => {
    if (feedbackFilter === 'all') return feedback;
    return feedback.filter((f) => f.status === feedbackFilter);
  }, [feedback, feedbackFilter]);

  const setFeedbackStatus = async (f: FeedbackRecord, status: FeedbackStatus) => {
    setUpdatingFeedback(f.id);
    try {
      await updateFeedbackStatus(f.id, status);
      setFeedback((prev) => prev.map((x) => x.id === f.id ? { ...x, status } : x));
    } catch (e: any) {
      showAlert('Errore', e?.message ?? 'Aggiornamento fallito.');
    } finally {
      setUpdatingFeedback(null);
    }
  };

  const handleRegisterPush = async () => {
    if (!user) return;
    setRegisteringPush(true);
    try {
      const token = await registerForPushNotifications();
      if (!token) {
        showAlert('Notifiche push', 'Permesso non concesso o non disponibile su questo dispositivo/browser.');
        return;
      }
      await saveUserPushToken(user.uid, token);
      showAlert('Notifiche push', 'Dispositivo registrato con successo.');
    } catch (e: any) {
      showAlert('Errore', e?.message ?? 'Registrazione fallita.');
    } finally {
      setRegisteringPush(false);
    }
  };

  const handleTestPush = async () => {
    if (!user?.pushToken) {
      showAlert('Notifiche push', 'Registra prima il dispositivo per ricevere notifiche.');
      return;
    }
    setSendingTest(true);
    try {
      await sendAdminTestPushNotification(user.pushToken);
      showAlert('Notifiche push', 'Notifica di test inviata.');
    } catch (e: any) {
      showAlert('Errore', e?.message ?? 'Invio fallito.');
    } finally {
      setSendingTest(false);
    }
  };

  if (!user?.isAdmin) return null;

  const premiumCount = users.filter((u) => u.isPremium).length;
  const newFeedbackCount = feedback.filter((f) => f.status === 'nuovo').length;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerInner}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back}>
            <Text style={styles.backText}>← Indietro</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Dashboard admin</Text>
          <Text style={styles.subtitle}>
            {users.length} utenti · {premiumCount} premium · {feedback.length} segnalazioni
            {newFeedbackCount > 0 ? ` (${newFeedbackCount} nuove)` : ''}
          </Text>

          <View style={styles.tabs}>
            <TabBtn label="Utenti" active={tab === 'users'} onPress={() => setTab('users')} />
            <TabBtn label="Feedback" active={tab === 'feedback'} onPress={() => setTab('feedback')} />
            <TabBtn label="Notifiche" active={tab === 'notifiche'} onPress={() => setTab('notifiche')} />
            <TabBtn label={aiEnabled ? 'AI' : 'AI ⛔'} active={tab === 'ai'} onPress={() => setTab('ai')} />
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
            {tab === 'users' && (
              <>
                <View style={styles.searchRow}>
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Cerca per nome, email o UID..."
                    placeholderTextColor={T.mute}
                    style={styles.searchInput}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  {search.length > 0 && (
                    <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
                      <Text style={styles.clearBtnText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.chipsRow}>
                  <Chip label="Tutti" active={filterChip === 'all'} onPress={() => setFilterChip('all')} />
                  <Chip label={`Nuovi < ${NEW_USER_DAYS}gg`} active={filterChip === 'new'} onPress={() => setFilterChip('new')} />
                  <Chip label="Premium ✦" active={filterChip === 'premium'} onPress={() => setFilterChip('premium')} />
                  <Chip label="Admin 🛡️" active={filterChip === 'admin'} onPress={() => setFilterChip('admin')} />
                </View>

                <View style={styles.sortRow}>
                  <SortBtn label="Più recenti" active={sortMode === 'newest'} onPress={() => setSortMode('newest')} />
                  <SortBtn label="Meno recenti" active={sortMode === 'oldest'} onPress={() => setSortMode('oldest')} />
                  <SortBtn label="A-Z" active={sortMode === 'az'} onPress={() => setSortMode('az')} />
                  <SortBtn label="Z-A" active={sortMode === 'za'} onPress={() => setSortMode('za')} />
                </View>

                <Text style={styles.resultCount}>{visibleUsers.length} risultat{visibleUsers.length === 1 ? 'o' : 'i'}</Text>

                {visibleUsers.length === 0 ? <Text style={styles.empty}>Nessun utente trovato.</Text> :
                  visibleUsers.map((u) => {
                    const isNew = (() => { const d = daysSince(u.createdAt); return d !== null && d < NEW_USER_DAYS; })();
                    return (
                      <View key={u.uid} style={styles.card}>
                        <View style={styles.cardTop}>
                          <View style={styles.cardInfo}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.name} numberOfLines={1}>{u.displayName || '—'}</Text>
                              {isNew && <View style={styles.newBadge}><Text style={styles.newBadgeText}>Nuovo</Text></View>}
                            </View>
                            <Text style={styles.email} numberOfLines={1}>{u.email}</Text>
                            {u.createdAt ? <Text style={styles.date}>Iscritto {formatRelative(u.createdAt)}</Text> : null}
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
                            {u.aiDisabled && <View style={[styles.badge, styles.badgeAiOff]}><Text style={[styles.badgeText, { color: T.urgent }]}>AI bloccata</Text></View>}
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
                            <TouchableOpacity
                              style={[styles.btn, u.aiDisabled ? styles.btnSecondary : styles.btnDestructive]}
                              onPress={() => toggleUserAi(u)}
                            >
                              <Text style={[styles.btnText, u.aiDisabled ? styles.btnTextSecondary : styles.btnTextDanger]}>
                                {u.aiDisabled ? 'Sblocca AI' : 'Blocca AI'}
                              </Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })
                }
              </>
            )}

            {tab === 'feedback' && (
              <>
                <View style={styles.chipsRow}>
                  <Chip label="Tutti" active={feedbackFilter === 'all'} onPress={() => setFeedbackFilter('all')} />
                  <Chip label="Nuovi" active={feedbackFilter === 'nuovo'} onPress={() => setFeedbackFilter('nuovo')} />
                  <Chip label="Letti" active={feedbackFilter === 'letto'} onPress={() => setFeedbackFilter('letto')} />
                  <Chip label="Risolti" active={feedbackFilter === 'risolto'} onPress={() => setFeedbackFilter('risolto')} />
                </View>

                {visibleFeedback.length === 0 ? <Text style={styles.empty}>Nessuna segnalazione.</Text> :
                  visibleFeedback.map((f) => (
                    <View key={f.id} style={styles.card}>
                      <View style={styles.fbHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <View style={[styles.fbTag, fbTagStyle(f.category)]}>
                            <Text style={styles.fbTagText}>{fbLabel(f.category)}</Text>
                          </View>
                          <View style={[styles.fbStatusTag, fbStatusStyle(f.status)]}>
                            <Text style={styles.fbStatusText}>{fbStatusLabel(f.status)}</Text>
                          </View>
                          {f.rating ? (
                            <Text style={{ fontSize: 12, color: '#f59e0b', fontFamily: FONTS.sansSemiBold }}>
                              {'★'.repeat(f.rating)}
                            </Text>
                          ) : null}
                        </View>
                        {f.createdAt ? <Text style={styles.date}>{formatDate(f.createdAt)}</Text> : null}
                      </View>
                      <Text style={styles.fbMessage}>{f.message}</Text>
                      <Text style={styles.fbFrom}>{f.displayName || 'Anonimo'} · {f.email}</Text>

                      {updatingFeedback === f.id ? (
                        <ActivityIndicator color={T.primary} style={{ marginTop: 10 }} />
                      ) : (
                        <View style={styles.actions}>
                          {f.status !== 'nuovo' && (
                            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setFeedbackStatus(f, 'nuovo')}>
                              <Text style={[styles.btnText, styles.btnTextSecondary]}>Riapri</Text>
                            </TouchableOpacity>
                          )}
                          {f.status === 'nuovo' && (
                            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setFeedbackStatus(f, 'letto')}>
                              <Text style={[styles.btnText, styles.btnTextSecondary]}>Segna come letto</Text>
                            </TouchableOpacity>
                          )}
                          {f.status !== 'risolto' && (
                            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => setFeedbackStatus(f, 'risolto')}>
                              <Text style={styles.btnText}>✓ Segna come risolto</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      )}
                    </View>
                  ))
                }
              </>
            )}

            {tab === 'ai' && (
              <View style={{ gap: 12 }}>
                <View style={styles.card}>
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.notifSectionTitle}>Ricette AI (tutti gli utenti)</Text>
                      <Text style={styles.notifSectionDesc}>
                        Interruttore globale: da spento nessuno può generare ricette e le chiamate a Groq
                        si fermano subito. Il blocco è applicato lato server, non solo nell'app.
                      </Text>
                    </View>
                    <Switch
                      value={aiEnabled}
                      onValueChange={toggleGlobalAi}
                      disabled={togglingAi}
                      trackColor={{ false: T.line, true: T.primary }}
                    />
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.notifSectionTitle}>Stato attuale</Text>
                  <Text style={styles.notifSectionDesc}>
                    {aiEnabled
                      ? 'Attive · 1 generazione al giorno per utente (reset a mezzanotte, ora italiana).'
                      : 'Disattivate · gli utenti vedono "Momentaneamente non disponibile".'}
                  </Text>
                  <Text style={[styles.notifSectionDesc, { marginTop: 10 }]}>
                    {users.filter((u) => u.aiDisabled).length} utent
                    {users.filter((u) => u.aiDisabled).length === 1 ? 'e bloccato' : 'i bloccati'} singolarmente
                    (dalla scheda Utenti, pulsante “Blocca AI”).
                  </Text>
                </View>
              </View>
            )}

            {tab === 'notifiche' && (
              <View style={{ gap: 12 }}>
                <View style={styles.card}>
                  <Text style={styles.notifSectionTitle}>Dispositivo</Text>
                  <Text style={styles.notifSectionDesc}>
                    {user.pushToken ? 'Dispositivo registrato per le notifiche push.' : 'Nessun dispositivo registrato.'}
                  </Text>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
                    onPress={handleRegisterPush}
                    disabled={registeringPush}
                  >
                    {registeringPush ? <ActivityIndicator color="#fbfaf3" /> : (
                      <Text style={styles.btnText}>{user.pushToken ? 'Ri-registra dispositivo' : 'Registra dispositivo'}</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.card}>
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.notifSectionTitle}>Nuovi Utenti Iscritti</Text>
                      <Text style={styles.notifSectionDesc}>Ricevi un avviso push ogni volta che un nuovo utente si registra a Shelfy.</Text>
                    </View>
                    <Switch
                      value={user.adminNotifNewUsers ?? true}
                      onValueChange={(v) => updateAdminNotifSettings({ adminNotifNewUsers: v })}
                      trackColor={{ false: T.line, true: T.primary }}
                    />
                  </View>
                </View>

                <View style={styles.card}>
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.notifSectionTitle}>Nuove Segnalazioni / Feedback</Text>
                      <Text style={styles.notifSectionDesc}>Ricevi un avviso push per ogni nuovo feedback o segnalazione inviata.</Text>
                    </View>
                    <Switch
                      value={user.adminNotifFeedback ?? true}
                      onValueChange={(v) => updateAdminNotifSettings({ adminNotifFeedback: v })}
                      trackColor={{ false: T.line, true: T.primary }}
                    />
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.notifSectionTitle}>Test</Text>
                  <Text style={styles.notifSectionDesc}>Invia una notifica push di prova al tuo dispositivo registrato.</Text>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSecondary, { marginTop: 12 }]}
                    onPress={handleTestPush}
                    disabled={sendingTest}
                  >
                    {sendingTest ? <ActivityIndicator color={T.primaryInk} /> : (
                      <Text style={[styles.btnText, styles.btnTextSecondary]}>Invia notifica di test</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
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

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]} activeOpacity={0.85}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SortBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.sortBtn, active && styles.sortBtnActive]} activeOpacity={0.85}>
      <Text style={[styles.sortBtnText, active && styles.sortBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function fbLabel(c: string) {
  if (c === 'bug') return '🐞 Bug';
  if (c === 'suggerimento') return '💡 Idea';
  if (c === 'prodotto') return '📦 Barcode';
  return '💬 Altro';
}
function fbTagStyle(c: string) {
  if (c === 'bug') return { backgroundColor: T.urgentSoft };
  if (c === 'suggerimento') return { backgroundColor: T.okSoft };
  if (c === 'prodotto') return { backgroundColor: T.warnSoft };
  return { backgroundColor: T.primarySoft };
}

function fbStatusLabel(s: FeedbackStatus) {
  if (s === 'letto') return 'Letto';
  if (s === 'risolto') return '✓ Risolto';
  return 'Nuovo';
}
function fbStatusStyle(s: FeedbackStatus) {
  if (s === 'letto') return { backgroundColor: T.line };
  if (s === 'risolto') return { backgroundColor: T.okSoft };
  return { backgroundColor: T.urgentSoft };
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

  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: T.surface, borderRadius: RADIUS.sm, borderWidth: 1, borderColor: T.line, paddingHorizontal: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontFamily: FONTS.sans, fontSize: 14, color: T.ink },
  clearBtn: { paddingHorizontal: 6, paddingVertical: 6 },
  clearBtnText: { color: T.mute, fontSize: 14, fontFamily: FONTS.sansSemiBold },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: RADIUS.pill, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line },
  chipActive: { backgroundColor: T.primary, borderColor: T.primary },
  chipText: { fontFamily: FONTS.sansMedium, fontSize: 13, color: T.ink2 },
  chipTextActive: { color: '#fbfaf3' },

  sortRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortBtn: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: RADIUS.sm, backgroundColor: T.primarySoft },
  sortBtnActive: { backgroundColor: T.primary },
  sortBtnText: { fontFamily: FONTS.sansMedium, fontSize: 12, color: T.primaryInk },
  sortBtnTextActive: { color: '#fbfaf3' },

  resultCount: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute },

  card: { backgroundColor: T.surface, borderRadius: RADIUS.md, padding: 16, ...SHADOW.card },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardInfo: { flex: 1, marginRight: 8 },
  name: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
  email: { fontFamily: FONTS.sans, fontSize: 13, color: T.ink2, marginTop: 2 },
  date: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 4 },
  subInfo: { fontFamily: FONTS.sansMedium, fontSize: 12, color: T.primary, marginTop: 4 },

  newBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.pill, backgroundColor: T.okSoft },
  newBadgeText: { fontFamily: FONTS.sansSemiBold, fontSize: 10, color: T.ok },

  badges: { flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.pill },
  badgePremium: { backgroundColor: T.warnSoft },
  badgeAdmin: { backgroundColor: T.primarySoft },
  badgeAiOff: { backgroundColor: T.urgentSoft },
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
  fbStatusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.pill },
  fbStatusText: { fontFamily: FONTS.sansSemiBold, fontSize: 12, color: T.ink },
  fbMessage: { fontFamily: FONTS.sans, fontSize: 14, color: T.ink, lineHeight: 20 },
  fbFrom: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 8 },

  notifSectionTitle: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
  notifSectionDesc: { fontFamily: FONTS.sans, fontSize: 13, color: T.mute, marginTop: 4, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
