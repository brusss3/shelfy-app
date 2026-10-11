import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import {
  getAllUsers, adminSetPremium, adminSetAdmin, AdminUserRecord,
  getAllFeedback, FeedbackRecord, FeedbackStatus, updateFeedbackStatus, saveUserPushToken,
  subscribeToAiEnabled, adminSetAiEnabled, adminSetUserAiDisabled,
  subscribeToMonetizationEnabled, adminSetMonetizationEnabled,
  subscribeToSurveys, adminCreateSurvey, adminSetSurveyActive, adminDeleteSurvey,
  adminGetSurveyResults,
  getAdminStatsLatest, getAdminStatsHistory, refreshAdminStats,
  AdminStatsSnapshot, AdminFunnelRow,
} from '@/lib/firestore';
import { Survey } from '@/types';
import { registerForPushNotifications, sendAdminTestPushNotification } from '@/lib/notifications';
import { showAlert } from '@/lib/alert';
import { addDays, buildFunnel, confirm } from './adminUtils';

/** Giorni di storico caricati: copre l'intervallo più lungo dei grafici. */
export const HISTORY_DAYS = 90;

export type SurveyResults = Record<string, { counts: number[]; dismissed: number }>;

// Tutto lo stato e le azioni della dashboard admin, in un posto solo: la
// versione mobile e quella desktop sono solo due modi di mostrarli.
export function useAdminData() {
  const { user, updateAdminNotifSettings } = useAuth();
  const { t } = useTranslation();

  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [stats, setStats] = useState<AdminStatsSnapshot | null>(null);
  const [history, setHistory] = useState<AdminStatsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [updatingFeedback, setUpdatingFeedback] = useState<string | null>(null);

  const [aiEnabled, setAiEnabled] = useState(true);
  const [togglingAi, setTogglingAi] = useState(false);
  const [monetization, setMonetization] = useState(false);
  const [togglingMonetization, setTogglingMonetization] = useState(false);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyResults, setSurveyResults] = useState<SurveyResults>({});
  const [creatingSurvey, setCreatingSurvey] = useState(false);
  const [registeringPush, setRegisteringPush] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);

  const isAdmin = user?.isAdmin === true;

  const load = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      // Le statistiche sono facoltative: se mancano (funzione non ancora
      // eseguita) la dashboard resta usabile per la gestione degli utenti.
      const [u, f, latest, hist] = await Promise.all([
        getAllUsers(),
        getAllFeedback().catch(() => [] as FeedbackRecord[]),
        getAdminStatsLatest().catch(() => null),
        getAdminStatsHistory(addDays(today, -HISTORY_DAYS)).catch(() => [] as AdminStatsSnapshot[]),
      ]);
      setUsers(u);
      setFeedback(f);
      setStats(latest);
      setHistory(hist);
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('admin.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  useEffect(() => (isAdmin ? subscribeToAiEnabled(setAiEnabled, () => {}) : undefined), [isAdmin]);
  useEffect(() => (isAdmin ? subscribeToMonetizationEnabled(setMonetization, () => {}) : undefined), [isAdmin]);
  useEffect(() => (isAdmin ? subscribeToSurveys(setSurveys, () => {}) : undefined), [isAdmin]);

  // I conteggi si ricaricano a ogni cambio nella lista: sono letture puntuali
  // sulla sottocollezione risposte, non un listener permanente.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      surveys.map(async (s) => [s.id, await adminGetSurveyResults(s.id, s.options.length)] as const),
    )
      .then((entries) => { if (!cancelled) setSurveyResults(Object.fromEntries(entries)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [surveys]);

  const reload = useCallback(() => { setRefreshing(true); load(); }, [load]);

  const recomputeStats = useCallback(async () => {
    setRefreshingStats(true);
    try {
      const snap = await refreshAdminStats();
      setStats(snap);
      setHistory((prev) => [...prev.filter((s) => s.date !== snap.date), snap]
        .sort((a, b) => a.date.localeCompare(b.date)));
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('admin.dash.refreshFailed'));
    } finally {
      setRefreshingStats(false);
    }
  }, [t]);

  const toggleGlobalAi = useCallback((next: boolean) => {
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
  }, [t]);

  const toggleMonetization = useCallback((next: boolean) => {
    confirm(
      next ? t('admin.enableMonetizationTitle') : t('admin.disableMonetizationTitle'),
      next ? t('admin.enableMonetizationBody') : t('admin.disableMonetizationBody'),
      async () => {
        setTogglingMonetization(true);
        try {
          await adminSetMonetizationEnabled(next);
        } catch (e: any) {
          showAlert(t('common.error'), e?.message ?? t('admin.updateFailed'));
        } finally { setTogglingMonetization(false); }
      },
    );
  }, [t]);

  // Le tre azioni sul singolo utente hanno la stessa forma: conferma,
  // scrittura, aggiornamento ottimistico della riga.
  const patchUser = useCallback((
    u: AdminUserRecord,
    title: string,
    destructive: boolean,
    write: () => Promise<void>,
    patch: Partial<AdminUserRecord>,
  ) => {
    confirm(title, u.email || u.uid, async () => {
      setUpdating(u.uid);
      try {
        await write();
        setUsers((prev) => prev.map((x) => (x.uid === u.uid ? { ...x, ...patch } : x)));
      } catch (e: any) {
        showAlert(t('common.error'), e?.message ?? t('admin.updateFailed'));
      } finally { setUpdating(null); }
    }, destructive);
  }, [t]);

  const toggleUserAi = useCallback((u: AdminUserRecord) => {
    const next = !u.aiDisabled;
    patchUser(u, next ? t('admin.blockAiForUser') : t('admin.unblockAi'), next,
      () => adminSetUserAiDisabled(u.uid, next), { aiDisabled: next });
  }, [patchUser, t]);

  const togglePremium = useCallback((u: AdminUserRecord) => {
    const next = !u.isPremium;
    patchUser(u, next ? t('admin.enablePremium') : t('admin.removePremium'), !next,
      () => adminSetPremium(u.uid, next), { isPremium: next });
  }, [patchUser, t]);

  const toggleAdmin = useCallback((u: AdminUserRecord) => {
    if (u.uid === user?.uid) {
      showAlert(t('admin.cantChangeOwnRoleTitle'), t('admin.cantChangeOwnRoleBody'));
      return;
    }
    const next = !u.isAdmin;
    patchUser(u, next ? t('admin.makeAdmin') : t('admin.removeAdmin'), true,
      () => adminSetAdmin(u.uid, next), { isAdmin: next });
  }, [patchUser, t, user?.uid]);

  const setFeedbackStatus = useCallback(async (f: FeedbackRecord, status: FeedbackStatus) => {
    setUpdatingFeedback(f.id);
    try {
      await updateFeedbackStatus(f.id, status);
      setFeedback((prev) => prev.map((x) => (x.id === f.id ? { ...x, status } : x)));
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('admin.updateFailed'));
    } finally {
      setUpdatingFeedback(null);
    }
  }, [t]);

  /** True se il sondaggio è stato creato (il chiamante svuota il modulo). */
  const createSurvey = useCallback(async (question: string, options: string[]): Promise<boolean> => {
    const q = question.trim();
    const opts = options.map((o) => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) {
      showAlert(t('common.error'), t('admin.surveyIncomplete'));
      return false;
    }
    setCreatingSurvey(true);
    try {
      await adminCreateSurvey(q, opts);
      showAlert(t('admin.surveyCreatedTitle'), t('admin.surveyCreatedHint'));
      return true;
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('admin.updateFailed'));
      return false;
    } finally {
      setCreatingSurvey(false);
    }
  }, [t]);

  const setSurveyActive = useCallback((id: string, active: boolean) => {
    adminSetSurveyActive(id, active).catch(() => {});
  }, []);

  const deleteSurvey = useCallback((id: string) => {
    confirm(t('admin.surveyDeleteTitle'), t('admin.surveyDeleteBody'),
      () => { adminDeleteSurvey(id).catch(() => {}); }, true);
  }, [t]);

  const registerPush = useCallback(async () => {
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
  }, [t, user]);

  const sendTestPush = useCallback(async () => {
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
  }, [t, user?.pushToken]);

  // Il funnel arriva dal server; finché non esiste un'istantanea si ricalcola
  // dagli utenti già caricati, così la sezione Guide non resta vuota.
  const funnel: AdminFunnelRow[] = useMemo(
    () => (stats && stats.users ? stats.funnel : buildFunnel(users)),
    [stats, users],
  );

  const counts = useMemo(() => ({
    users: users.length,
    premium: users.filter((u) => u.isPremium).length,
    waitlist: users.filter((u) => u.premiumWaitlist).length,
    aiBlocked: users.filter((u) => u.aiDisabled).length,
    newFeedback: feedback.filter((f) => f.status === 'nuovo').length,
  }), [users, feedback]);

  return {
    user, updateAdminNotifSettings,
    users, feedback, stats, history, funnel, counts,
    loading, refreshing, refreshingStats, updating, updatingFeedback,
    aiEnabled, togglingAi, monetization, togglingMonetization,
    surveys, surveyResults, creatingSurvey, registeringPush, sendingTest,
    reload, recomputeStats,
    toggleGlobalAi, toggleMonetization, toggleUserAi, togglePremium, toggleAdmin,
    setFeedbackStatus, createSurvey, setSurveyActive, deleteSurvey,
    registerPush, sendTestPush,
  };
}

export type AdminData = ReturnType<typeof useAdminData>;
