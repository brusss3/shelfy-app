import i18n, { dateLocale } from '@/lib/i18n';
import { showAlert } from '@/lib/alert';
import { getTheme } from '@/constants/theme';
import type { AdminFunnelRow, AdminStatsSnapshot, AdminUserRecord, FeedbackStatus } from '@/lib/firestore';

// Funzioni pure condivise dalla dashboard mobile e da quella desktop (web).

export const NEW_USER_DAYS = 7;
export const DAY_MS = 1000 * 60 * 60 * 24;
// Da questa data i documenti utente hanno origine (acquisition) e contatori di
// attivazione (productsAdded, lastActiveAt): gli iscritti precedenti non li
// hanno e falserebbero il confronto fra i canali. Il server usa la stessa data.
export const ACTIVATION_TRACKING_SINCE = '2026-09-29';

export type SortMode = 'newest' | 'oldest' | 'az' | 'za' | 'lastActive' | 'products';
export type UserFilter = 'all' | 'new' | 'guest' | 'registered' | 'premium' | 'admin';

/** Ricalcolo lato client, usato solo finché non esiste un'istantanea del server. */
export function buildFunnel(users: AdminUserRecord[]): AdminFunnelRow[] {
  const rows = new Map<string | null, AdminFunnelRow>();
  for (const u of users) {
    if (!u.createdAt || u.createdAt < ACTIVATION_TRACKING_SINCE) continue;
    const key = u.acquisitionSource;
    const row = rows.get(key) ?? { source: key, signups: 0, firstProduct: 0, thirdProduct: 0, eligible7: 0, returned7: 0 };
    row.signups += 1;
    if (u.productsAdded >= 1) row.firstProduct += 1;
    if (u.productsAdded >= 3) row.thirdProduct += 1;
    const created = new Date(u.createdAt).getTime();
    if (Date.now() - created >= 7 * DAY_MS) {
      row.eligible7 += 1;
      if (u.lastActiveAt && new Date(u.lastActiveAt).getTime() - created >= 7 * DAY_MS) row.returned7 += 1;
    }
    rows.set(key, row);
  }
  return [...rows.values()].sort((a, b) =>
    a.source === null ? 1 : b.source === null ? -1 : b.signups - a.signups);
}

export function pct(part: number, total: number): string {
  return total > 0 ? `${part} (${Math.round((part / total) * 100)}%)` : '—';
}

export function ratio(part: number | null | undefined, total: number | null | undefined): number | null {
  if (part == null || !total) return null;
  return part / total;
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  return n.toLocaleString(dateLocale());
}

/** 1.284 · 12,9K · 4,2M: per i valori delle tile. */
export function formatCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  try {
    return new Intl.NumberFormat(dateLocale(), { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  } catch {
    return String(n);
  }
}

export function confirm(title: string, message: string, onYes: () => void, destructive = false) {
  showAlert(title, message, [
    { text: i18n.t('common.cancel'), style: 'cancel' },
    { text: i18n.t('admin.confirm'), style: destructive ? 'destructive' : 'default', onPress: onYes },
  ]);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(dateLocale());
}

/** "12/10" da "2026-10-12": etichette compatte sugli assi. */
export function formatDayShort(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.toLocaleDateString(dateLocale())} ${d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })}`;
}

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((Date.now() - then) / DAY_MS);
}

export function formatRelative(iso: string | null | undefined): string {
  const d = daysSince(iso);
  if (d === null) return '';
  if (d <= 0) return i18n.t('admin.relativeToday');
  if (d === 1) return i18n.t('admin.relativeYesterday');
  if (d < 7) return i18n.t('admin.relativeDaysAgo', { count: d });
  return formatDate(iso);
}

export function isNewUser(u: AdminUserRecord): boolean {
  const d = daysSince(u.createdAt);
  return d !== null && d < NEW_USER_DAYS;
}

export function filterUsers(
  users: AdminUserRecord[],
  opts: { search: string; filter: UserFilter; sort: SortMode },
): AdminUserRecord[] {
  let list = users;
  if (opts.filter === 'new') list = list.filter(isNewUser);
  else if (opts.filter === 'guest') list = list.filter((u) => u.isGuest);
  else if (opts.filter === 'registered') list = list.filter((u) => !u.isGuest);
  else if (opts.filter === 'premium') list = list.filter((u) => u.isPremium);
  else if (opts.filter === 'admin') list = list.filter((u) => u.isAdmin);

  const q = opts.search.trim().toLowerCase();
  if (q) {
    list = list.filter((u) =>
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q) ||
      (u.acquisitionSource ?? '').toLowerCase().includes(q),
    );
  }

  const name = (u: AdminUserRecord) => u.displayName || u.email;
  const sorted = [...list];
  switch (opts.sort) {
    case 'newest': sorted.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')); break;
    case 'oldest': sorted.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')); break;
    case 'az': sorted.sort((a, b) => name(a).localeCompare(name(b))); break;
    case 'za': sorted.sort((a, b) => name(b).localeCompare(name(a))); break;
    case 'lastActive': sorted.sort((a, b) => (b.lastActiveAt || '').localeCompare(a.lastActiveAt || '')); break;
    case 'products': sorted.sort((a, b) => b.productsAdded - a.productsAdded); break;
  }
  return sorted;
}

// Un valore che inizia con = + - @ verrebbe interpretato come formula da
// Excel/Sheets (CSV injection): i nomi utente sono testo libero.
function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function usersToCsv(users: AdminUserRecord[]): string {
  const header = [
    'uid', 'displayName', 'email', 'type', 'createdAt', 'upgradedAt', 'lastActiveAt', 'productsAdded',
    'acquisitionSource', 'isPremium', 'subscriptionType', 'subscriptionExpiresAt',
    'premiumWaitlist', 'isAdmin', 'aiDisabled',
  ];
  const rows = users.map((u) => [
    u.uid, u.displayName, u.email, u.isGuest ? 'guest' : 'registered', u.createdAt, u.upgradedAt, u.lastActiveAt,
    u.productsAdded, u.acquisitionSource, u.isPremium, u.subscriptionType, u.subscriptionExpiresAt,
    u.premiumWaitlist, u.isAdmin, u.aiDisabled,
  ].map(csvCell).join(','));
  return [header.join(','), ...rows].join('\r\n');
}

// --- Storico delle istantanee ---

export function addDays(dayKey: string, n: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** L'istantanea di `n` giorni prima di `fromDate`, o la più vicina precedente (max 3 giorni di scarto). */
export function snapshotDaysAgo(
  history: AdminStatsSnapshot[], fromDate: string, n: number,
): AdminStatsSnapshot | null {
  const target = addDays(fromDate, -n);
  const floor = addDays(target, -3);
  let best: AdminStatsSnapshot | null = null;
  for (const s of history) {
    if (s.date <= target && s.date >= floor && (!best || s.date > best.date)) best = s;
  }
  return best;
}

/**
 * Serie giornaliera da un contatore cumulativo (es. prodotti aggiunti in
 * totale): la differenza fra due istantanee consecutive. Un giorno senza
 * istantanea, o con il totale in calo (ospiti cancellati), resta vuoto
 * invece di inventare un valore.
 */
export function dailyDeltas(
  history: AdminStatsSnapshot[],
  pick: (s: AdminStatsSnapshot) => number | null | undefined,
): { date: string; value: number | null }[] {
  const out: { date: string; value: number | null }[] = [];
  for (let i = 1; i < history.length; i++) {
    const prev = history[i - 1];
    const cur = history[i];
    const a = pick(prev);
    const b = pick(cur);
    const consecutive = addDays(prev.date, 1) === cur.date;
    out.push({
      date: cur.date,
      value: consecutive && a != null && b != null && b >= a ? b - a : null,
    });
  }
  return out;
}

// --- Feedback ---

export function fbLabel(c: string) {
  if (c === 'bug') return i18n.t('admin.fbCategoryBug');
  if (c === 'suggerimento') return i18n.t('admin.fbCategoryIdea');
  if (c === 'prodotto') return i18n.t('admin.fbCategoryBarcode');
  return i18n.t('admin.fbCategoryOther');
}

export function fbTagStyle(c: string) {
  const { T } = getTheme();
  if (c === 'bug') return { backgroundColor: T.urgentSoft };
  if (c === 'suggerimento') return { backgroundColor: T.okSoft };
  if (c === 'prodotto') return { backgroundColor: T.warnSoft };
  return { backgroundColor: T.primarySoft };
}

export function fbStatusLabel(s: FeedbackStatus) {
  if (s === 'letto') return i18n.t('admin.fbStatusRead');
  if (s === 'risolto') return i18n.t('admin.fbStatusResolved');
  return i18n.t('admin.fbStatusNew');
}

export function fbStatusStyle(s: FeedbackStatus) {
  const { T } = getTheme();
  if (s === 'letto') return { backgroundColor: T.line };
  if (s === 'risolto') return { backgroundColor: T.okSoft };
  return { backgroundColor: T.urgentSoft };
}
