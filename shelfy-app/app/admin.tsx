import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, Switch,
  StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
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
    { text: i18n.t('common.cancel'), style: 'cancel' },
    { text: i18n.t('admin.confirm'), style: destructive ? 'destructive' : 'default', onPress: onYes },
  ]);
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-US';
  return new Date(iso).toLocaleDateString(locale);
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
  if (d <= 0) return i18n.t('admin.relativeToday');
  if (d === 1) return i18n.t('admin.relativeYesterday');
  if (d < 7) return i18n.t('admin.relativeDaysAgo', { count: d });
  return formatDate(iso);
}

export default function AdminScreen() {
  const { user, updateAdminNotifSettings } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
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
      showAlert(t('common.error'), e?.message ?? t('admin.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

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
      next ? t('admin.enableAiTitle') : t('admin.disableAiTitle'),
      next ? t('admin.enableAiBody') : t('admin.disableAiBody'),
      async () => {
        setTogglingAi(true);
        try {
          await adminSetAiEnabled(next);
        } catch (e: any) {
          showAlert(t('common.error'), e?.message ?? t('admin.updateFailed'));
        } finally { setTogglingAi(false); }
      },
      !next,
    );
  };

  const toggleUserAi = (u: AdminUserRecord) => {
    const next = !u.aiDisabled;
    confirm(next ? t('admin.blockAiForUser') : t('admin.unblockAi'), u.email, async () => {
      setUpdating(u.uid);
      try {
        await adminSetUserAiDisabled(u.uid, next);
        setUsers((prev) => prev.map((x) => x.uid === u.uid ? { ...x, aiDisabled: next } : x));
      } catch (e: any) {
        showAlert(t('common.error'), e?.message ?? t('admin.updateFailed'));
      } finally { setUpdating(null); }
    }, next);
  };

  const togglePremium = (u: AdminUserRecord) => {
    const next = !u.isPremium;
    confirm(next ? t('admin.enablePremium') : t('admin.removePremium'), u.email, async () => {
      setUpdating(u.uid);
      try {
        await adminSetPremium(u.uid, next);
        setUsers((prev) => prev.map((x) => x.uid === u.uid ? { ...x, isPremium: next } : x));
      } catch (e: any) {
        showAlert(t('common.error'), e?.message ?? t('admin.updateFailed'));
      } finally { setUpdating(null); }
    }, !next);
  };

  const toggleAdmin = (u: AdminUserRecord) => {
    if (u.uid === user?.uid) {
      showAlert(t('admin.cantChangeOwnRoleTitle'), t('admin.cantChangeOwnRoleBody'));
      return;
    }
    const next = !u.isAdmin;
    confirm(next ? t('admin.makeAdmin') : t('admin.removeAdmin'), u.email, async () => {
      setUpdating(u.uid);
      try {
        await adminSetAdmin(u.uid, next);
        setUsers((prev) => prev.map((x) => x.uid === u.uid ? { ...x, isAdmin: next } : x));
      } catch (e: any) {
        showAlert(t('common.error'), e?.message ?? t('admin.updateFailed'));
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
      showAlert(t('common.error'), e?.message ?? t('admin.updateFailed'));
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
        showAlert(t('admin.pushNotAvailableTitle'), t('admin.pushNotAvailableBody'));
        return;
      }
      await saveUserPushToken(user.uid, token);
      showAlert(t('admin.pushNotAvailableTitle'), t('admin.pushRegisteredBody'));
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('admin.registrationFailed'));
    } finally {
      setRegisteringPush(false);
    }
  };

  const handleTestPush = async () => {
    if (!user?.pushToken) {
      showAlert(t('admin.pushNotAvailableTitle'), t('admin.registerDeviceFirstBody'));
      return;
    }
    setSendingTest(true);
    try {
      await sendAdminTestPushNotification(user.pushToken);
      showAlert(t('admin.pushNotAvailableTitle'), t('admin.testSentBody'));
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('admin.sendFailed'));
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
            <Text style={styles.backText}>{t('admin.back')}</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{t('admin.title')}</Text>
          <Text style={styles.subtitle}>
            {t('admin.subtitle', { users: users.length, premium: premiumCount, feedback: feedback.length })}
            {newFeedbackCount > 0 ? t('admin.newFeedbackSuffix', { count: newFeedbackCount }) : ''}
          </Text>

          <View style={styles.tabs}>
            <TabBtn label={t('admin.tabs.users')} active={tab === 'users'} onPress={() => setTab('users')} />
            <TabBtn label={t('admin.tabs.feedback')} active={tab === 'feedback'} onPress={() => setTab('feedback')} />
            <TabBtn label={t('admin.tabs.notifications')} active={tab === 'notifiche'} onPress={() => setTab('notifiche')} />
            <TabBtn label={aiEnabled ? t('admin.tabs.ai') : `${t('admin.tabs.ai')} ⛔`} active={tab === 'ai'} onPress={() => setTab('ai')} />
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
                    placeholder={t('admin.searchPlaceholder')}
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
                  <Chip label={t('admin.filters.all')} active={filterChip === 'all'} onPress={() => setFilterChip('all')} />
                  <Chip label={t('admin.filters.newUnder', { days: NEW_USER_DAYS })} active={filterChip === 'new'} onPress={() => setFilterChip('new')} />
                  <Chip label={t('admin.filters.premium')} active={filterChip === 'premium'} onPress={() => setFilterChip('premium')} />
                  <Chip label={t('admin.filters.admin')} active={filterChip === 'admin'} onPress={() => setFilterChip('admin')} />
                </View>

                <View style={styles.sortRow}>
                  <SortBtn label={t('admin.sort.newest')} active={sortMode === 'newest'} onPress={() => setSortMode('newest')} />
                  <SortBtn label={t('admin.sort.oldest')} active={sortMode === 'oldest'} onPress={() => setSortMode('oldest')} />
                  <SortBtn label={t('admin.sort.az')} active={sortMode === 'az'} onPress={() => setSortMode('az')} />
                  <SortBtn label={t('admin.sort.za')} active={sortMode === 'za'} onPress={() => setSortMode('za')} />
                </View>

                <Text style={styles.resultCount}>{t('admin.resultCount', { count: visibleUsers.length })}</Text>

                {visibleUsers.length === 0 ? <Text style={styles.empty}>{t('admin.noUsersFound')}</Text> :
                  visibleUsers.map((u) => {
                    const isNew = (() => { const d = daysSince(u.createdAt); return d !== null && d < NEW_USER_DAYS; })();
                    return (
                      <View key={u.uid} style={styles.card}>
                        <View style={styles.cardTop}>
                          <View style={styles.cardInfo}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.name} numberOfLines={1}>{u.displayName || '—'}</Text>
                              {isNew && <View style={styles.newBadge}><Text style={styles.newBadgeText}>{t('admin.newBadge')}</Text></View>}
                            </View>
                            <Text style={styles.email} numberOfLines={1}>{u.email}</Text>
                            {u.createdAt ? <Text style={styles.date}>{t('admin.joined', { when: formatRelative(u.createdAt) })}</Text> : null}
                            {u.isPremium && (
                              <Text style={styles.subInfo}>
                                {u.subscriptionType === 'annual' ? t('admin.subscriptionAnnual') : u.subscriptionType === 'monthly' ? t('admin.subscriptionMonthly') : t('admin.subscriptionGeneric')}
                                {u.subscriptionExpiresAt ? t('admin.renewsOn', { date: formatDate(u.subscriptionExpiresAt) }) : ''}
                              </Text>
                            )}
                          </View>
                          <View style={styles.badges}>
                            {u.isPremium && <View style={[styles.badge, styles.badgePremium]}><Text style={styles.badgeText}>{t('admin.premiumBadge')}</Text></View>}
                            {u.isAdmin && <View style={[styles.badge, styles.badgeAdmin]}><Text style={styles.badgeText}>{t('admin.adminBadge')}</Text></View>}
                            {u.aiDisabled && <View style={[styles.badge, styles.badgeAiOff]}><Text style={[styles.badgeText, { color: T.urgent }]}>{t('admin.aiBlockedBadge')}</Text></View>}
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
                                {u.isPremium ? t('admin.removePremium') : t('admin.enablePremium')}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.btn, u.isAdmin ? styles.btnDestructive : styles.btnSecondary]}
                              onPress={() => toggleAdmin(u)}
                            >
                              <Text style={[styles.btnText, u.isAdmin ? styles.btnTextDanger : styles.btnTextSecondary]}>
                                {u.isAdmin ? t('admin.removeAdmin') : t('admin.makeAdmin')}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.btn, u.aiDisabled ? styles.btnSecondary : styles.btnDestructive]}
                              onPress={() => toggleUserAi(u)}
                            >
                              <Text style={[styles.btnText, u.aiDisabled ? styles.btnTextSecondary : styles.btnTextDanger]}>
                                {u.aiDisabled ? t('admin.unblockAi') : t('admin.blockAiForUser')}
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
                  <Chip label={t('admin.feedbackFilters.all')} active={feedbackFilter === 'all'} onPress={() => setFeedbackFilter('all')} />
                  <Chip label={t('admin.feedbackFilters.new')} active={feedbackFilter === 'nuovo'} onPress={() => setFeedbackFilter('nuovo')} />
                  <Chip label={t('admin.feedbackFilters.read')} active={feedbackFilter === 'letto'} onPress={() => setFeedbackFilter('letto')} />
                  <Chip label={t('admin.feedbackFilters.resolved')} active={feedbackFilter === 'risolto'} onPress={() => setFeedbackFilter('risolto')} />
                </View>

                {visibleFeedback.length === 0 ? <Text style={styles.empty}>{t('admin.noFeedback')}</Text> :
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
                      <Text style={styles.fbFrom}>{f.displayName || t('admin.anonymous')} · {f.email}</Text>

                      {updatingFeedback === f.id ? (
                        <ActivityIndicator color={T.primary} style={{ marginTop: 10 }} />
                      ) : (
                        <View style={styles.actions}>
                          {f.status !== 'nuovo' && (
                            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setFeedbackStatus(f, 'nuovo')}>
                              <Text style={[styles.btnText, styles.btnTextSecondary]}>{t('admin.reopen')}</Text>
                            </TouchableOpacity>
                          )}
                          {f.status === 'nuovo' && (
                            <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setFeedbackStatus(f, 'letto')}>
                              <Text style={[styles.btnText, styles.btnTextSecondary]}>{t('admin.markRead')}</Text>
                            </TouchableOpacity>
                          )}
                          {f.status !== 'risolto' && (
                            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={() => setFeedbackStatus(f, 'risolto')}>
                              <Text style={styles.btnText}>{t('admin.markResolved')}</Text>
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
                      <Text style={styles.notifSectionTitle}>{t('admin.aiAllUsersTitle')}</Text>
                      <Text style={styles.notifSectionDesc}>
                        {t('admin.aiAllUsersDesc')}
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
                  <Text style={styles.notifSectionTitle}>{t('admin.currentStatus')}</Text>
                  <Text style={styles.notifSectionDesc}>
                    {aiEnabled ? t('admin.aiActiveStatus') : t('admin.aiInactiveStatus')}
                  </Text>
                  <Text style={[styles.notifSectionDesc, { marginTop: 10 }]}>
                    {t('admin.blockedUsersCount', { count: users.filter((u) => u.aiDisabled).length })}
                  </Text>
                </View>
              </View>
            )}

            {tab === 'notifiche' && (
              <View style={{ gap: 12 }}>
                <View style={styles.card}>
                  <Text style={styles.notifSectionTitle}>{t('admin.deviceTitle')}</Text>
                  <Text style={styles.notifSectionDesc}>
                    {user.pushToken ? t('admin.deviceRegistered') : t('admin.deviceNotRegistered')}
                  </Text>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnPrimary, { marginTop: 12 }]}
                    onPress={handleRegisterPush}
                    disabled={registeringPush}
                  >
                    {registeringPush ? <ActivityIndicator color="#fbfaf3" /> : (
                      <Text style={styles.btnText}>{user.pushToken ? t('admin.reRegisterDevice') : t('admin.registerDevice')}</Text>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.card}>
                  <View style={styles.switchRow}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.notifSectionTitle}>{t('admin.newUsersTitle')}</Text>
                      <Text style={styles.notifSectionDesc}>{t('admin.newUsersDesc')}</Text>
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
                      <Text style={styles.notifSectionTitle}>{t('admin.newFeedbackTitle')}</Text>
                      <Text style={styles.notifSectionDesc}>{t('admin.newFeedbackDesc')}</Text>
                    </View>
                    <Switch
                      value={user.adminNotifFeedback ?? true}
                      onValueChange={(v) => updateAdminNotifSettings({ adminNotifFeedback: v })}
                      trackColor={{ false: T.line, true: T.primary }}
                    />
                  </View>
                </View>

                <View style={styles.card}>
                  <Text style={styles.notifSectionTitle}>{t('admin.testTitle')}</Text>
                  <Text style={styles.notifSectionDesc}>{t('admin.testDesc')}</Text>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnSecondary, { marginTop: 12 }]}
                    onPress={handleTestPush}
                    disabled={sendingTest}
                  >
                    {sendingTest ? <ActivityIndicator color={T.primaryInk} /> : (
                      <Text style={[styles.btnText, styles.btnTextSecondary]}>{t('admin.sendTestNotification')}</Text>
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
  if (c === 'bug') return i18n.t('admin.fbCategoryBug');
  if (c === 'suggerimento') return i18n.t('admin.fbCategoryIdea');
  if (c === 'prodotto') return i18n.t('admin.fbCategoryBarcode');
  return i18n.t('admin.fbCategoryOther');
}
function fbTagStyle(c: string) {
  if (c === 'bug') return { backgroundColor: T.urgentSoft };
  if (c === 'suggerimento') return { backgroundColor: T.okSoft };
  if (c === 'prodotto') return { backgroundColor: T.warnSoft };
  return { backgroundColor: T.primarySoft };
}

function fbStatusLabel(s: FeedbackStatus) {
  if (s === 'letto') return i18n.t('admin.fbStatusRead');
  if (s === 'risolto') return i18n.t('admin.fbStatusResolved');
  return i18n.t('admin.fbStatusNew');
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
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: RADIUS.md, backgroundColor: T.surface, borderWidth: 1, borderColor: T.line },
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

  newBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: RADIUS.tag, backgroundColor: T.okSoft },
  newBadgeText: { fontFamily: FONTS.sansSemiBold, fontSize: 10, color: T.ok },

  badges: { flexDirection: 'column', gap: 4, alignItems: 'flex-end' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.tag },
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
  fbTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.tag },
  fbTagText: { fontFamily: FONTS.sansSemiBold, fontSize: 12, color: T.ink },
  fbStatusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.tag },
  fbStatusText: { fontFamily: FONTS.sansSemiBold, fontSize: 12, color: T.ink },
  fbMessage: { fontFamily: FONTS.sans, fontSize: 14, color: T.ink, lineHeight: 20 },
  fbFrom: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 8 },

  notifSectionTitle: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
  notifSectionDesc: { fontFamily: FONTS.sans, fontSize: 13, color: T.mute, marginTop: 4, lineHeight: 18 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
