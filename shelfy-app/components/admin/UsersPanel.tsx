import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import type { AdminUserRecord } from '@/lib/firestore';
import { createAdminStyles } from './adminStyles';
import { Chip, SearchField } from './AdminUi';
import {
  NEW_USER_DAYS, SortMode, UserFilter, filterUsers, formatDate, formatRelative, isNewUser,
} from './adminUtils';
import type { AdminData } from './useAdminData';

// Elenco utenti a schede (mobile e web stretto). Mostra al massimo PAGE
// schede per volta: con migliaia di utenti il render di tutte bloccherebbe
// lo scorrimento.
const PAGE = 50;
const SORT_CYCLE: SortMode[] = ['newest', 'lastActive', 'products', 'az'];

export function UsersPanel({ data }: { data: AdminData }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createAdminStyles);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UserFilter>('all');
  const [sort, setSort] = useState<SortMode>('newest');
  const [shown, setShown] = useState(PAGE);

  const visible = useMemo(
    () => filterUsers(data.users, { search, filter, sort }),
    [data.users, search, filter, sort],
  );

  const filters: { id: UserFilter; label: string }[] = [
    { id: 'all', label: t('admin.filters.all') },
    { id: 'new', label: t('admin.filters.newUnder', { days: NEW_USER_DAYS }) },
    { id: 'guest', label: t('admin.dash.filterGuests') },
    { id: 'premium', label: t('admin.filters.premium') },
    { id: 'admin', label: t('admin.filters.admin') },
  ];

  const nextSort = () => setSort((s) => SORT_CYCLE[(SORT_CYCLE.indexOf(s) + 1) % SORT_CYCLE.length]);

  return (
    <View style={styles.section}>
      <SearchField value={search} onChange={(v) => { setSearch(v); setShown(PAGE); }} placeholder={t('admin.searchPlaceholder')} />
      <View style={styles.chipsRow}>
        {filters.map((f) => (
          <Chip key={f.id} label={f.label} active={filter === f.id} onPress={() => { setFilter(f.id); setShown(PAGE); }} />
        ))}
      </View>

      <View style={[styles.resultRow, { alignItems: 'center' }]}>
        <Text style={styles.resultCount}>{t('admin.resultCount', { count: visible.length })}</Text>
        <TouchableOpacity onPress={nextSort} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.smallBtnText}>{t('admin.dash.sortBy', { mode: t(`admin.dash.sortModes.${sort}`) })}</Text>
        </TouchableOpacity>
      </View>

      {visible.length === 0 ? <Text style={styles.empty}>{t('admin.noUsersFound')}</Text> : (
        visible.slice(0, shown).map((u) => <UserCard key={u.uid} u={u} data={data} />)
      )}

      {visible.length > shown && (
        <TouchableOpacity style={styles.smallBtn} onPress={() => setShown((n) => n + PAGE)} accessibilityRole="button">
          <Text style={[styles.smallBtnText, { textAlign: 'center' }]}>
            {t('admin.dash.showMore', { count: Math.min(PAGE, visible.length - shown) })}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

function UserCard({ u, data }: { u: AdminUserRecord; data: AdminData }) {
  const { t } = useTranslation();
  const { T } = useTheme();
  const styles = useThemedStyles(createAdminStyles);

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardInfo}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{u.displayName || (u.isGuest ? t('admin.dash.guestName') : '—')}</Text>
            {isNewUser(u) && <View style={styles.newBadge}><Text style={styles.newBadgeText}>{t('admin.newBadge')}</Text></View>}
          </View>
          {u.email ? <Text style={styles.email} numberOfLines={1}>{u.email}</Text> : null}
          <Text style={styles.date}>
            {u.createdAt ? t('admin.joined', { when: formatRelative(u.createdAt) }) : ''}
            {u.lastActiveAt ? ` · ${t('admin.dash.lastSeen', { when: formatRelative(u.lastActiveAt) })}` : ''}
            {` · ${t('admin.dash.productsCount', { count: u.productsAdded })}`}
          </Text>
          {u.isPremium && (
            <Text style={styles.subInfo}>
              {u.subscriptionType === 'annual' ? t('admin.subscriptionAnnual') : u.subscriptionType === 'monthly' ? t('admin.subscriptionMonthly') : t('admin.subscriptionGeneric')}
              {u.subscriptionExpiresAt ? t('admin.renewsOn', { date: formatDate(u.subscriptionExpiresAt) }) : ''}
            </Text>
          )}
        </View>
        <View style={styles.badges}>
          {u.isGuest && <View style={[styles.badge, styles.badgeGuest]}><Text style={[styles.badgeText, styles.badgeTextMute]}>{t('admin.dash.guestBadge')}</Text></View>}
          {u.isPremium && <View style={[styles.badge, styles.badgePremium]}><Text style={[styles.badgeText, styles.badgeTextWarn]}>{t('admin.premiumBadge')}</Text></View>}
          {u.isAdmin && <View style={[styles.badge, styles.badgeAdmin]}><Text style={styles.badgeText}>{t('admin.adminBadge')}</Text></View>}
          {u.aiDisabled && <View style={[styles.badge, styles.badgeAiOff]}><Text style={[styles.badgeText, styles.badgeTextUrgent]}>{t('admin.aiBlockedBadge')}</Text></View>}
        </View>
      </View>

      {data.updating === u.uid ? (
        <ActivityIndicator color={T.primary} style={{ marginTop: 12 }} />
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.btn, u.isPremium ? styles.btnDestructive : styles.btnSecondary]}
            onPress={() => data.togglePremium(u)}
            accessibilityRole="button"
          >
            <Text style={[styles.btnText, u.isPremium ? styles.btnTextDanger : styles.btnTextSecondary]}>
              {u.isPremium ? t('admin.removePremium') : t('admin.enablePremium')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, u.isAdmin ? styles.btnDestructive : styles.btnSecondary]}
            onPress={() => data.toggleAdmin(u)}
            accessibilityRole="button"
          >
            <Text style={[styles.btnText, u.isAdmin ? styles.btnTextDanger : styles.btnTextSecondary]}>
              {u.isAdmin ? t('admin.removeAdmin') : t('admin.makeAdmin')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, u.aiDisabled ? styles.btnSecondary : styles.btnDestructive]}
            onPress={() => data.toggleUserAi(u)}
            accessibilityRole="button"
          >
            <Text style={[styles.btnText, u.aiDisabled ? styles.btnTextSecondary : styles.btnTextDanger]}>
              {u.aiDisabled ? t('admin.unblockAi') : t('admin.dash.blockAiShort')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
