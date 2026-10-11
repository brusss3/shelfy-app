import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { FONTS, RADIUS } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/context/ThemeContext';
import type { AdminStatsSnapshot } from '@/lib/firestore';
import {
  ACTIVATION_TRACKING_SINCE, addDays, dailyDeltas, formatCompact, formatDate, formatDayShort,
  formatNumber, formatPercent, ratio, snapshotDaysAgo,
} from '../adminUtils';
import type { AdminData } from '../useAdminData';
import { ChartCard, DailyLines, HorizontalBars, StackedDailyBars, useSeriesColors } from './Charts';
import { DeltaText, StatTile, deltaAbs, deltaPct, deltaPts } from './StatTile';

export type Range = 30 | 90;

function useHistoryWindow(data: AdminData, range: Range): AdminStatsSnapshot[] {
  return useMemo(() => {
    const end = data.stats?.date ?? new Date().toISOString().slice(0, 10);
    const from = addDays(end, -(range - 1));
    return data.history.filter((s) => s.date >= from && s.date <= end);
  }, [data.history, data.stats?.date, range]);
}

function Grid({ children, min = 420 }: { children: React.ReactNode; min?: number }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
      {React.Children.map(children, (child) => child && (
        <View style={{ flexGrow: 1, flexBasis: min, minWidth: Math.min(min, 360) }}>{child}</View>
      ))}
    </View>
  );
}

export function NoStats({ data }: { data: AdminData }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.heroLabel}>{t('admin.dash.noStatsTitle')}</Text>
      <Text style={styles.body}>{t('admin.dash.noStatsBody')}</Text>
      <Text style={styles.body}>{data.refreshingStats ? t('admin.dash.refreshing') : ''}</Text>
    </View>
  );
}

// --- Panoramica ---

export function OverviewSection({ data, range }: { data: AdminData; range: Range }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const colors = useSeriesColors();
  const hist = useHistoryWindow(data, range);
  const s = data.stats;

  const series = useMemo(() => {
    if (!s) return null;
    const newUsers = s.newUsersByDay.slice(-range);
    const active = hist.map((h) => ({
      date: h.date, dau: h.users?.active1 ?? null, wau: h.users?.active7 ?? null, mau: h.users?.active30 ?? null,
    }));
    const products = dailyDeltas(hist, (h) => h.users?.productsAddedTotal).map((r) => ({ date: r.date, value: r.value }));
    const conversions = newUsers.map((r) => ({ date: r.date, value: r.conversions ?? 0 }));
    return { newUsers, active, products, conversions };
  }, [s, hist, range]);

  if (!s || !series) return <NoStats data={data} />;
  const u = s.users;
  const week = snapshotDaysAgo(data.history, s.date, 7);
  const wu = week?.users;
  const historyEmpty = t('admin.dash.historyEmpty');

  const retention = ratio(u?.retention7.returned, u?.retention7.eligible);
  const retentionPrev = ratio(wu?.retention7.returned, wu?.retention7.eligible);
  const conversion = ratio(u?.guestCohort30?.converted, u?.guestCohort30?.started);

  const funnelTotals = s.funnel.reduce(
    (acc, r) => ({
      signups: acc.signups + r.signups, first: acc.first + r.firstProduct, third: acc.third + r.thirdProduct,
      eligible: acc.eligible + r.eligible7, returned: acc.returned + r.returned7,
    }),
    { signups: 0, first: 0, third: 0, eligible: 0, returned: 0 },
  );
  const share = (n: number, d: number) => (d > 0 ? `${formatNumber(n)} · ${Math.round((n / d) * 100)}%` : formatNumber(n));
  const funnelRows = [
    { name: t('admin.funnelSignups'), value: funnelTotals.signups },
    { name: t('admin.dash.funnelFirst'), value: funnelTotals.first, display: share(funnelTotals.first, funnelTotals.signups) },
    { name: t('admin.dash.funnelThird'), value: funnelTotals.third, display: share(funnelTotals.third, funnelTotals.signups) },
    { name: t('admin.dash.funnelReturned'), value: funnelTotals.returned, display: share(funnelTotals.returned, funnelTotals.eligible) },
  ];

  const categories = (s.products?.topCategories ?? []).map((c) => ({ name: c.name, value: c.count }));
  const dayCol = t('admin.dash.col.day');

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.topRow}>
        {/* L'unico numero grande della pagina: chi ha usato l'app negli
            ultimi 7 giorni è la misura più onesta della salute del prodotto. */}
        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{t('admin.dash.kpi.active7')}</Text>
          <Text style={styles.heroValue}>{formatNumber(u?.active7)}</Text>
          <DeltaText delta={deltaAbs(u?.active7, wu?.active7)} against={t('admin.dash.vsWeekAgo')} />
          <Text style={styles.body}>
            {t('admin.dash.heroCaption', {
              today: formatNumber(u?.active1), month: formatNumber(u?.active30),
              share: formatPercent(ratio(u?.active7, u?.total)),
            })}
          </Text>
        </View>
        <View style={styles.tiles}>
          <StatTile label={t('admin.dash.kpi.users')} value={formatCompact(u?.total)}
            delta={deltaAbs(u?.total, wu?.total)}
            caption={t('admin.dash.kpi.usersSplit', { registered: formatNumber(u?.registered), guests: formatNumber(u?.guests) })} />
          <StatTile label={t('admin.dash.kpi.new7')} value={formatCompact(u?.new7)}
            delta={deltaPct(u?.new7, u?.newPrev7)} against={t('admin.dash.vsPrevWeek')}
            caption={t('admin.dash.kpi.newToday', { count: u?.newToday ?? 0 })} />
          <StatTile label={t('admin.dash.kpi.retention7')} value={formatPercent(retention)}
            delta={deltaPts(retention, retentionPrev)}
            caption={t('admin.dash.kpi.retention7Caption', { count: u?.retention7.eligible ?? 0 })} />
          <StatTile label={t('admin.dash.kpi.conversion')} value={formatPercent(conversion)}
            caption={t('admin.dash.kpi.conversionCaption', { count: u?.conversions7 ?? 0, total: formatNumber(u?.conversions ?? 0) })} />
          <StatTile label={t('admin.dash.kpi.products')} value={formatCompact(s.products?.inPantries)}
            delta={deltaAbs(s.products?.inPantries, week?.products?.inPantries)}
            caption={t('admin.dash.kpi.productsCaption', { expired: formatNumber(s.products?.expired) })} />
          {/* La metrica di Shelfy: di quello che esce dalla dispensa, quanto
              viene mangiato invece che buttato. */}
          <StatTile label={t('admin.dash.kpi.wasteSaved')}
            value={formatPercent(ratio(u?.productsConsumedTotal, (u?.productsConsumedTotal ?? 0) + (u?.productsWastedTotal ?? 0)))}
            caption={t('admin.dash.kpi.wasteSavedCaption', { eaten: formatNumber(u?.productsConsumedTotal ?? 0), wasted: formatNumber(u?.productsWastedTotal ?? 0) })} />
          <StatTile label={t('admin.dash.kpi.premium')} value={formatCompact(u?.premium)}
            delta={deltaAbs(u?.premium, wu?.premium)}
            caption={t('admin.dash.kpi.waitlistCaption', { count: u?.waitlist ?? 0 })} />
        </View>
      </View>

      <Grid>
        <ChartCard
          title={t('admin.dash.chart.newUsers')}
          subtitle={t('admin.dash.chart.newUsersSub', { days: range })}
          legend={[
            { label: t('admin.dash.registeredLabel'), color: colors[0], kind: 'bar' },
            { label: t('admin.dash.guestsLabel'), color: colors[1], kind: 'bar' },
          ]}
          table={{
            columns: [dayCol, t('admin.dash.registeredLabel'), t('admin.dash.guestsLabel')],
            rows: [...series.newUsers].reverse().map((r) => [formatDayShort(r.date), r.registered, r.guests]),
          }}
        >
          <StackedDailyBars
            rows={series.newUsers}
            series={[
              { key: 'registered', label: t('admin.dash.registeredLabel') },
              { key: 'guests', label: t('admin.dash.guestsLabel') },
            ]}
          />
        </ChartCard>

        <ChartCard
          title={t('admin.dash.chart.active')}
          subtitle={t('admin.dash.chart.activeSub')}
          legend={[
            { label: t('admin.dash.dau'), color: colors[0], kind: 'line' },
            { label: t('admin.dash.wau'), color: colors[1], kind: 'line' },
            { label: t('admin.dash.mau'), color: colors[2], kind: 'line' },
          ]}
          table={{
            columns: [dayCol, t('admin.dash.dau'), t('admin.dash.wau'), t('admin.dash.mau')],
            rows: [...series.active].reverse().map((r) => [formatDayShort(r.date), r.dau ?? '—', r.wau ?? '—', r.mau ?? '—']),
          }}
          empty={series.active.length < 2 ? historyEmpty : null}
        >
          <DailyLines
            rows={series.active}
            series={[
              { key: 'dau', label: t('admin.dash.dau') },
              { key: 'wau', label: t('admin.dash.wau') },
              { key: 'mau', label: t('admin.dash.mau') },
            ]}
          />
        </ChartCard>

        <ChartCard
          title={t('admin.dash.chart.products')}
          subtitle={t('admin.dash.chart.productsSub')}
          table={{
            columns: [dayCol, t('admin.dash.chart.productsShort')],
            rows: [...series.products].reverse().map((r) => [formatDayShort(r.date), r.value ?? '—']),
          }}
          empty={series.products.length < 1 ? historyEmpty : null}
        >
          <StackedDailyBars rows={series.products} series={[{ key: 'value', label: t('admin.dash.chart.productsShort') }]} />
        </ChartCard>

        <ChartCard
          title={t('admin.dash.chart.conversions')}
          subtitle={t('admin.dash.chart.conversionsSub', {
            rate: formatPercent(conversion), started: formatNumber(u?.guestCohort30?.started ?? 0),
          })}
          table={{
            columns: [dayCol, t('admin.dash.chart.conversionsShort')],
            rows: [...series.conversions].reverse().map((r) => [formatDayShort(r.date), r.value]),
          }}
        >
          <StackedDailyBars rows={series.conversions} series={[{ key: 'value', label: t('admin.dash.chart.conversionsShort') }]} />
        </ChartCard>

        <ChartCard
          title={t('admin.dash.chart.categories')}
          subtitle={t('admin.dash.chart.categoriesSub', { other: formatNumber(s.products?.otherCategoriesCount ?? 0) })}
          table={{ columns: [t('admin.dash.col.category'), t('admin.dash.col.products')], rows: categories.map((c) => [c.name, c.value]) }}
          empty={categories.length === 0 ? t('admin.dash.noData') : null}
        >
          <HorizontalBars rows={categories} valueLabel={t('admin.dash.col.products')} />
        </ChartCard>

        <ChartCard
          title={t('admin.dash.chart.funnel')}
          subtitle={t('admin.funnelIntro', { date: formatDate(ACTIVATION_TRACKING_SINCE) })}
          table={{ columns: [t('admin.dash.col.stage'), t('admin.dash.col.users')], rows: funnelRows.map((r) => [r.name, r.display ?? r.value]) }}
          empty={funnelTotals.signups === 0 ? t('admin.funnelEmpty') : null}
        >
          <HorizontalBars rows={funnelRows} valueLabel={t('admin.dash.col.users')} labelWidth={150} />
        </ChartCard>
      </Grid>

      <FunnelBySource data={data} />
    </View>
  );
}

/** Funnel per guida di provenienza: il confronto fra canali vive in tabella. */
function FunnelBySource({ data }: { data: AdminData }) {
  const { t } = useTranslation();
  const { T } = useTheme();
  const styles = useThemedStyles(createStyles);
  const rows = data.funnel;
  if (rows.length === 0) return null;
  const cell: React.CSSProperties = {
    padding: '8px 12px', borderBottom: `1px solid ${T.line}`, fontFamily: 'DMSans_400Regular, system-ui, sans-serif',
    fontSize: 13, color: T.ink, textAlign: 'right', fontVariantNumeric: 'tabular-nums',
  };
  const head: React.CSSProperties = { ...cell, color: T.ink2, fontFamily: 'DMSans_500Medium, system-ui, sans-serif', fontWeight: 500 };
  const pctOf = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('admin.dash.chart.funnelBySource')}</Text>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
          <thead>
            <tr>
              <th style={{ ...head, textAlign: 'left' }}>{t('admin.dash.col.source')}</th>
              <th style={head}>{t('admin.funnelSignups')}</th>
              <th style={head}>{t('admin.dash.funnelFirst')}</th>
              <th style={head}>{t('admin.dash.funnelThird')}</th>
              <th style={head}>{t('admin.dash.funnelReturned')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.source ?? '_other'}>
                <td style={{ ...cell, textAlign: 'left' }}>{r.source ?? t('admin.funnelOtherChannels')}</td>
                <td style={cell}>{formatNumber(r.signups)}</td>
                <td style={cell}>{formatNumber(r.firstProduct)} · {pctOf(r.firstProduct, r.signups)}</td>
                <td style={cell}>{formatNumber(r.thirdProduct)} · {pctOf(r.thirdProduct, r.signups)}</td>
                <td style={cell}>{formatNumber(r.returned7)} / {formatNumber(r.eligible7)} · {pctOf(r.returned7, r.eligible7)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </View>
  );
}

// --- Contenuti: ricette community, dispense, case condivise ---

export function ContentSection({ data }: { data: AdminData }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const s = data.stats;
  if (!s) return <NoStats data={data} />;
  const week = snapshotDaysAgo(data.history, s.date, 7);
  const c = s.community;
  const p = s.products;
  const avgMembers = s.pantries && s.pantries.shared > 0 ? (s.pantries.members / s.pantries.shared).toFixed(1) : '—';

  return (
    <View style={{ gap: 16 }}>
      <Text style={styles.groupTitle}>{t('admin.dash.groupRecipes')}</Text>
      <View style={styles.tiles}>
        <StatTile label={t('admin.dash.kpi.recipes')} value={formatCompact(c?.recipes)}
          delta={deltaAbs(c?.recipes, week?.community?.recipes)}
          caption={t('admin.dash.kpi.recipes7d', { count: c?.recipes7d ?? 0 })} />
        <StatTile label={t('admin.dash.kpi.rating')} value={c?.ratingAvg != null ? c.ratingAvg.toFixed(2) : '—'}
          caption={t('admin.dash.kpi.ratingCaption', { count: c?.ratingCount ?? 0 })} />
        <StatTile label={t('admin.dash.kpi.requests')} value={formatCompact(c?.requests)}
          caption={t('admin.dash.kpi.requestsCaption', { open: formatNumber(c?.requestsOpen), proposals: formatNumber(c?.proposals) })} />
        <StatTile label={t('admin.dash.kpi.myRecipes')} value={formatCompact(c?.myRecipes)}
          caption={t('admin.dash.kpi.savedCaption', { count: c?.savedRecipes ?? 0 })} />
      </View>

      <Text style={styles.groupTitle}>{t('admin.dash.groupPantry')}</Text>
      <View style={styles.tiles}>
        <StatTile label={t('admin.dash.kpi.products')} value={formatCompact(p?.inPantries)}
          delta={deltaAbs(p?.inPantries, week?.products?.inPantries)}
          caption={t('admin.dash.kpi.zones', {
            fridge: formatNumber(p?.byZone?.frigo), freezer: formatNumber(p?.byZone?.freezer), pantry: formatNumber(p?.byZone?.dispensa),
          })} />
        <StatTile label={t('admin.dash.kpi.expired')} value={formatCompact(p?.expired)}
          delta={deltaAbs(p?.expired, week?.products?.expired, false)}
          caption={t('admin.dash.kpi.expiredCaption', { share: formatPercent(ratio(p?.expired, p?.inPantries)) })} />
        <StatTile label={t('admin.dash.kpi.expiringSoon')} value={formatCompact(p?.expiringSoon)}
          caption={t('admin.dash.kpi.expiringSoonCaption')} />
        <StatTile label={t('admin.dash.kpi.sharedHomes')} value={formatCompact(s.pantries?.shared)}
          delta={deltaAbs(s.pantries?.shared, week?.pantries?.shared)}
          caption={t('admin.dash.kpi.sharedCaption', { avg: avgMembers, products: formatNumber(p?.inShared) })} />
      </View>
    </View>
  );
}

// --- Prezzi ---

export function PricesSection({ data, range }: { data: AdminData; range: Range }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const hist = useHistoryWindow(data, range);
  const s = data.stats;
  const perDay = useMemo(
    () => dailyDeltas(hist, (h) => h.prices?.submissions).map((r) => ({ date: r.date, value: r.value })),
    [hist],
  );
  if (!s) return <NoStats data={data} />;
  const pr = s.prices;
  const week = snapshotDaysAgo(data.history, s.date, 7);

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.tiles}>
        <StatTile label={t('admin.dash.kpi.submissions')} value={formatCompact(pr?.submissions)}
          delta={deltaAbs(pr?.submissions, week?.prices?.submissions)}
          caption={t('admin.dash.kpi.submissions7d', { count: pr?.submissions7d ?? 0 })} />
        <StatTile label={t('admin.dash.kpi.suspicious')} value={formatCompact(pr?.suspicious)}
          caption={t('admin.dash.kpi.suspiciousCaption', { share: formatPercent(ratio(pr?.suspicious, pr?.submissions)) })} />
        <StatTile label={t('admin.dash.kpi.latestPrices')} value={formatCompact(pr?.latest)}
          caption={t('admin.dash.kpi.observations', { count: pr?.observations ?? 0 })} />
        <StatTile label={t('admin.dash.kpi.stores')} value={formatCompact(pr?.stores)}
          delta={deltaAbs(pr?.stores, week?.prices?.stores)} />
        <StatTile label={t('admin.dash.kpi.catalog')} value={formatCompact(pr?.catalogProducts)}
          caption={t('admin.dash.kpi.catalogCaption')} />
        <StatTile label={t('admin.dash.kpi.shoppingItems')} value={formatCompact(pr?.shoppingItems)}
          caption={t('admin.dash.kpi.shoppingCaption')} />
      </View>
      <ChartCard
        title={t('admin.dash.chart.prices')}
        subtitle={t('admin.dash.chart.pricesSub')}
        table={{
          columns: [t('admin.dash.col.day'), t('admin.dash.chart.pricesShort')],
          rows: [...perDay].reverse().map((r) => [formatDayShort(r.date), r.value ?? '—']),
        }}
        empty={perDay.length < 1 ? t('admin.dash.historyEmpty') : null}
      >
        <StackedDailyBars rows={perDay} series={[{ key: 'value', label: t('admin.dash.chart.pricesShort') }]} />
      </ChartCard>
    </View>
  );
}

const createStyles = ({ T, SHADOW }: Theme) => StyleSheet.create({
  topRow: { flexDirection: 'row', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' },
  hero: {
    flexGrow: 1, flexBasis: 280, minWidth: 260, maxWidth: 420,
    backgroundColor: T.surface, borderRadius: RADIUS.clay, padding: 22, gap: 4, justifyContent: 'center',
    ...SHADOW.card,
  },
  heroLabel: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
  heroValue: { fontFamily: FONTS.sansBold, fontSize: 64, lineHeight: 70, color: T.primary, letterSpacing: -2 },
  body: { fontFamily: FONTS.sans, fontSize: 13, color: T.mute, lineHeight: 19, marginTop: 6 },
  tiles: { flexGrow: 3, flexBasis: 560, flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  card: { backgroundColor: T.surface, borderRadius: RADIUS.clay, padding: 18, gap: 10, ...SHADOW.card },
  cardTitle: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
  groupTitle: { fontFamily: FONTS.sansSemiBold, fontSize: 16, color: T.ink, marginTop: 4 },
  emptyCard: { backgroundColor: T.surface, borderRadius: RADIUS.clay, padding: 24, gap: 4, maxWidth: 560, ...SHADOW.card },
});
