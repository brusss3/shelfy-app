import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FONTS, RADIUS } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/context/ThemeContext';
import type { AdminUserRecord } from '@/lib/firestore';
import { Chip, SearchField } from '../AdminUi';
import {
  NEW_USER_DAYS, SortMode, UserFilter, filterUsers, formatDate, formatRelative, isNewUser, usersToCsv,
} from '../adminUtils';
import type { AdminData } from '../useAdminData';

// Tabella utenti per il desktop (solo web): ricerca, filtri, ordinamento per
// colonna, paginazione ed esportazione CSV di ciò che è filtrato.
const PAGE = 50;
const FONT = 'DMSans_400Regular, system-ui, sans-serif';
const FONT_MEDIUM = 'DMSans_500Medium, system-ui, sans-serif';

type Column = { id: string; label: string; sort?: SortMode; align?: 'left' | 'right' };

function downloadCsv(filename: string, csv: string) {
  // BOM: senza, Excel apre gli accenti come caratteri sbagliati.
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function UsersTable({ data }: { data: AdminData }) {
  const { t } = useTranslation();
  const { T } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [page, setPage] = useState(0);

  const visible = useMemo(
    () => filterUsers(data.users, { search, filter, sort }),
    [data.users, search, filter, sort],
  );
  const pages = Math.max(1, Math.ceil(visible.length / PAGE));
  const current = Math.min(page, pages - 1);
  const rows = visible.slice(current * PAGE, current * PAGE + PAGE);

  const filters: { id: UserFilter; label: string }[] = [
    { id: 'all', label: t('admin.filters.all') },
    { id: 'new', label: t('admin.filters.newUnder', { days: NEW_USER_DAYS }) },
    { id: 'registered', label: t('admin.dash.filterRegistered') },
    { id: 'guest', label: t('admin.dash.filterGuests') },
    { id: 'premium', label: t('admin.filters.premium') },
    { id: 'admin', label: t('admin.filters.admin') },
  ];

  const columns: Column[] = [
    { id: 'name', label: t('admin.dash.col.user'), sort: 'az' },
    { id: 'type', label: t('admin.dash.col.type') },
    { id: 'joined', label: t('admin.dash.col.joined'), sort: 'newest' },
    { id: 'active', label: t('admin.dash.col.lastActive'), sort: 'lastActive' },
    { id: 'products', label: t('admin.dash.col.products'), sort: 'products', align: 'right' },
    { id: 'source', label: t('admin.dash.col.source') },
    { id: 'status', label: t('admin.dash.col.status') },
    { id: 'actions', label: t('admin.dash.col.actions'), align: 'right' },
  ];

  const onSort = (s: SortMode) => {
    // Un secondo clic su "Iscritto" o sul nome inverte l'ordine.
    if (s === 'newest' && sort === 'newest') setSort('oldest');
    else if (s === 'az' && sort === 'az') setSort('za');
    else setSort(s);
    setPage(0);
  };
  const sortedBy = (col: Column) =>
    col.sort === sort || (col.sort === 'newest' && sort === 'oldest') || (col.sort === 'az' && sort === 'za');
  const arrow = (col: Column) => {
    if (!sortedBy(col)) return '';
    return sort === 'oldest' || sort === 'az' ? ' ↑' : ' ↓';
  };

  const exportCsv = () => {
    const day = new Date().toISOString().slice(0, 10);
    downloadCsv(`shelfy-users-${day}.csv`, usersToCsv(visible));
  };

  const th: React.CSSProperties = {
    textAlign: 'left', padding: '10px 12px', fontFamily: FONT_MEDIUM, fontSize: 12, fontWeight: 500,
    color: T.ink2, borderBottom: `1px solid ${T.line}`, position: 'sticky', top: 0, background: T.surface,
    whiteSpace: 'nowrap', zIndex: 1,
  };
  const td: React.CSSProperties = {
    padding: '10px 12px', fontFamily: FONT, fontSize: 13, color: T.ink,
    borderBottom: `1px solid ${T.line}`, verticalAlign: 'middle',
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.toolbar}>
        <View style={{ flex: 1, minWidth: 260, maxWidth: 420 }}>
          <SearchField value={search} onChange={(v) => { setSearch(v); setPage(0); }} placeholder={t('admin.searchPlaceholder')} />
        </View>
        <TouchableOpacity style={styles.exportBtn} onPress={exportCsv} accessibilityRole="button">
          <Text style={styles.exportText}>{t('admin.dash.exportCsv', { count: visible.length })}</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.chips}>
        {filters.map((f) => (
          <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => { setFilter(f.id); setPage(0); }} />
        ))}
        <Text style={styles.count}>{t('admin.resultCount', { count: visible.length })}</Text>
      </View>

      <View style={styles.tableCard}>
        <div style={{ overflowX: 'auto', maxHeight: 'calc(100vh - 300px)', overflowY: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.id}
                    style={{ ...th, textAlign: col.align ?? 'left' }}
                    aria-sort={sortedBy(col) ? (arrow(col).includes('↑') ? 'ascending' : 'descending') : undefined}
                  >
                    {col.sort ? (
                      <button type="button" onClick={() => onSort(col.sort!)} style={headerBtn(T.ink2)}>
                        {col.label}{arrow(col)}
                      </button>
                    ) : col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={columns.length} style={{ ...td, textAlign: 'center', color: T.mute, padding: 32 }}>{t('admin.noUsersFound')}</td></tr>
              ) : rows.map((u) => (
                <UserRow key={u.uid} u={u} data={data} td={td} />
              ))}
            </tbody>
          </table>
        </div>
      </View>

      {pages > 1 && (
        <View style={styles.pager}>
          <TouchableOpacity disabled={current === 0} onPress={() => setPage(current - 1)} style={[styles.pageBtn, current === 0 && { opacity: 0.4 }]}>
            <Text style={styles.pageText}>{t('admin.dash.prevPage')}</Text>
          </TouchableOpacity>
          <Text style={styles.count}>{t('admin.dash.pageOf', { page: current + 1, pages })}</Text>
          <TouchableOpacity disabled={current >= pages - 1} onPress={() => setPage(current + 1)} style={[styles.pageBtn, current >= pages - 1 && { opacity: 0.4 }]}>
            <Text style={styles.pageText}>{t('admin.dash.nextPage')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function headerBtn(color: string): React.CSSProperties {
  return {
    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
    font: 'inherit', color, fontFamily: FONT_MEDIUM, fontSize: 12,
  };
}

function UserRow({ u, data, td }: { u: AdminUserRecord; data: AdminData; td: React.CSSProperties }) {
  const { t } = useTranslation();
  const { T } = useTheme();
  const busy = data.updating === u.uid;

  const tag = (label: string, bg: string, color: string) => (
    <span key={label} style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 9, background: bg, color,
      fontFamily: FONT_MEDIUM, fontSize: 11, marginRight: 4, marginBottom: 2, whiteSpace: 'nowrap',
    }}>{label}</span>
  );

  const action = (label: string, onClick: () => void, danger: boolean) => (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      style={{
        border: 'none', borderRadius: 8, padding: '5px 9px', marginLeft: 6, cursor: busy ? 'default' : 'pointer',
        background: danger ? T.urgentSoft : T.primarySoft, color: danger ? T.urgent : T.primaryInk,
        fontFamily: FONT_MEDIUM, fontSize: 12, whiteSpace: 'nowrap', opacity: busy ? 0.5 : 1,
      }}
    >{label}</button>
  );

  return (
    <tr>
      <td style={td}>
        <div style={{ fontFamily: FONT_MEDIUM, color: T.ink, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {u.displayName || (u.isGuest ? t('admin.dash.guestName') : '—')}
          {isNewUser(u) ? <span style={{ marginLeft: 6 }}>{tag(t('admin.newBadge'), T.okSoft, T.okInk)}</span> : null}
        </div>
        <div style={{ color: T.mute, fontSize: 12, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {u.email || u.uid}
        </div>
      </td>
      <td style={td}>
        {u.isGuest ? t('admin.dash.guestBadge') : t('admin.dash.registeredLabel')}
        {u.upgradedAt ? <div style={{ color: T.mute, fontSize: 12 }}>{t('admin.dash.upgradedOn', { date: formatDate(u.upgradedAt) })}</div> : null}
      </td>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>{formatDate(u.createdAt)}</td>
      <td style={{ ...td, whiteSpace: 'nowrap' }}>{u.lastActiveAt ? formatRelative(u.lastActiveAt) : '—'}</td>
      <td style={{ ...td, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{u.productsAdded}</td>
      <td style={{ ...td, color: u.acquisitionSource ? T.ink : T.mute }}>{u.acquisitionSource ?? '—'}</td>
      <td style={td}>
        {u.isPremium && tag(
          u.subscriptionType === 'annual' ? t('admin.subscriptionAnnual') : u.subscriptionType === 'monthly' ? t('admin.subscriptionMonthly') : t('admin.premiumBadge'),
          T.warnSoft, T.warnInk,
        )}
        {u.isAdmin && tag(t('admin.adminBadge'), T.primarySoft, T.primaryInk)}
        {u.aiDisabled && tag(t('admin.aiBlockedBadge'), T.urgentSoft, T.urgentInk)}
        {u.premiumWaitlist && !u.isPremium && tag(t('admin.dash.waitlistBadge'), T.field, T.ink2)}
      </td>
      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
        {action(u.isPremium ? t('admin.removePremium') : t('admin.enablePremium'), () => data.togglePremium(u), u.isPremium)}
        {action(u.isAdmin ? t('admin.removeAdmin') : t('admin.makeAdmin'), () => data.toggleAdmin(u), u.isAdmin)}
        {action(u.aiDisabled ? t('admin.unblockAi') : t('admin.dash.blockAiShort'), () => data.toggleUserAi(u), !u.aiDisabled)}
      </td>
    </tr>
  );
}

const createStyles = ({ T, SHADOW }: Theme) => StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  count: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginLeft: 4 },
  exportBtn: { backgroundColor: T.primary, borderRadius: RADIUS.lg, paddingVertical: 10, paddingHorizontal: 16 },
  exportText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.onPrimary },
  tableCard: { backgroundColor: T.surface, borderRadius: RADIUS.clay, overflow: 'hidden', ...SHADOW.card },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 },
  pageBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: RADIUS.sm, backgroundColor: T.primarySoft },
  pageText: { fontFamily: FONTS.sansMedium, fontSize: 13, color: T.primaryInk },
});
