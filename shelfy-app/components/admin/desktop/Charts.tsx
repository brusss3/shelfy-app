import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  LabelList, type TooltipContentProps, type LabelProps,
} from 'recharts';
import { FONTS, RADIUS } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/context/ThemeContext';
import { formatDayShort, formatNumber } from '../adminUtils';
import { chartTheme, type ChartTheme } from './chartTheme';

// Grafici della dashboard desktop (SOLO web: questo file è raggiungibile
// unicamente da AdminDesktop.web.tsx, quindi Recharts non entra mai nel
// bundle nativo). Regole seguite: segni sottili, griglia a filo e solida,
// un solo asse Y, legenda per 2+ serie, etichette solo sull'ultimo punto,
// tooltip con il valore in evidenza, e una vista tabella per ogni grafico.

const FONT = 'DMSans_400Regular, system-ui, sans-serif';
const PLOT_HEIGHT = 240;

export interface SeriesDef { key: string; label: string }

function useChart(): ChartTheme {
  return chartTheme(useTheme());
}

/** Colori delle serie nell'ordine fisso, per costruire le legende. */
export function useSeriesColors(): readonly string[] {
  return useChart().series;
}

// --- Contenitore ---

export function ChartCard({ title, subtitle, legend, table, children, empty }: {
  title: string;
  subtitle?: string;
  /** Serie con il loro colore; omessa per i grafici a serie singola. */
  legend?: { label: string; color: string; kind: 'bar' | 'line' }[];
  table: { columns: string[]; rows: (string | number)[][] };
  children: React.ReactNode;
  /** Messaggio al posto del grafico quando i dati non bastano. */
  empty?: string | null;
}) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const c = useChart();
  const [asTable, setAsTable] = useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {!empty && (
          <TouchableOpacity onPress={() => setAsTable((v) => !v)} style={styles.toggle} accessibilityRole="button">
            <Text style={styles.toggleText}>{asTable ? t('admin.dash.showChart') : t('admin.dash.showTable')}</Text>
          </TouchableOpacity>
        )}
      </View>

      {legend && legend.length > 1 && !asTable && !empty && (
        <View style={styles.legend}>
          {legend.map((l) => (
            <View key={l.label} style={styles.legendItem}>
              <View style={[l.kind === 'line' ? styles.keyLine : styles.keyRect, { backgroundColor: l.color }]} />
              <Text style={styles.legendText}>{l.label}</Text>
            </View>
          ))}
        </View>
      )}

      {empty ? (
        <View style={styles.emptyBox}><Text style={styles.emptyText}>{empty}</Text></View>
      ) : asTable ? (
        <DataTable columns={table.columns} rows={table.rows} c={c} />
      ) : (
        <div style={{ width: '100%', height: PLOT_HEIGHT }}>{children}</div>
      )}
    </View>
  );
}

function DataTable({ columns, rows, c }: { columns: string[]; rows: (string | number)[][]; c: ChartTheme }) {
  const cell: React.CSSProperties = {
    padding: '6px 10px', borderBottom: `1px solid ${c.grid}`, fontFamily: FONT, fontSize: 13,
    color: c.ink, fontVariantNumeric: 'tabular-nums',
  };
  return (
    <div style={{ maxHeight: PLOT_HEIGHT, overflowY: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th key={col} style={{ ...cell, color: c.ink2, fontWeight: 500, textAlign: i === 0 ? 'left' : 'right', position: 'sticky', top: 0, background: c.surface }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((v, j) => (
                <td key={j} style={{ ...cell, textAlign: j === 0 ? 'left' : 'right' }}>
                  {typeof v === 'number' ? formatNumber(v) : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Pezzi comuni ---

function axisProps(c: ChartTheme) {
  return {
    tick: { fill: c.tick, fontSize: 11, fontFamily: FONT },
    tickLine: false,
    axisLine: { stroke: c.axis },
  } as const;
}

function yAxisProps(c: ChartTheme) {
  return {
    tick: { fill: c.tick, fontSize: 11, fontFamily: FONT },
    tickLine: false,
    axisLine: false,
    allowDecimals: false,
    width: 40,
    tickFormatter: (v: number) => formatNumber(v),
  } as const;
}

/** Tooltip: il valore è l'elemento forte, il nome della serie segue. */
function makeTooltip(c: ChartTheme, labelFormat: (l: string) => string, kind: 'bar' | 'line') {
  return function ChartTooltip(props: TooltipContentProps) {
    const { active, payload, label } = props;
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div style={{
        background: c.surface, border: `1px solid ${c.grid}`, borderRadius: 10, padding: '8px 10px',
        boxShadow: '0 6px 16px rgba(0,0,0,0.12)', fontFamily: FONT, minWidth: 120,
      }}>
        <div style={{ fontSize: 12, color: c.ink2, marginBottom: 4 }}>{labelFormat(String(label ?? ''))}</div>
        {payload.map((p) => (
          <div key={String(p.dataKey)} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
            <span style={{
              display: 'inline-block', width: kind === 'line' ? 12 : 10, height: kind === 'line' ? 2 : 10,
              borderRadius: kind === 'line' ? 1 : 2, background: String(p.color ?? c.series[0]),
            }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: c.ink, fontVariantNumeric: 'tabular-nums' }}>
              {p.value == null ? '—' : formatNumber(Number(p.value))}
            </span>
            <span style={{ fontSize: 12, color: c.ink2 }}>{String(p.name ?? '')}</span>
          </div>
        ))}
      </div>
    );
  };
}

/** Etichetta solo sull'ultimo punto della linea, in inchiostro (mai nel colore della serie). */
function endLabel(lastIndex: number, c: ChartTheme) {
  return function EndLabel(props: LabelProps) {
    const { x, y, value, index } = props;
    if (index !== lastIndex || value == null) return null;
    return (
      <text x={Number(x) + 8} y={Number(y)} dy={4} fill={c.ink2} fontSize={12} fontFamily={FONT}>
        {formatNumber(Number(value))}
      </text>
    );
  };
}

// --- Grafici ---

/** Colonne giornaliere impilate (es. nuovi registrati + nuovi ospiti). */
export function StackedDailyBars({ rows, series }: {
  rows: object[];
  series: SeriesDef[];
}) {
  const c = useChart();
  const Tip = makeTooltip(c, formatDayShort, 'bar');
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="date" {...axisProps(c)} tickFormatter={formatDayShort} minTickGap={24} />
        <YAxis {...yAxisProps(c)} />
        <Tooltip content={Tip} cursor={{ fill: c.hover }} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            stackId="stack"
            fill={c.series[i]}
            maxBarSize={24}
            // Spazio di 2px nel colore della superficie fra i segmenti.
            stroke={c.surface}
            strokeWidth={series.length > 1 ? 1 : 0}
            radius={i === series.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Linee giornaliere con etichetta finale (es. DAU / WAU / MAU). */
export function DailyLines({ rows, series }: {
  rows: object[];
  series: SeriesDef[];
}) {
  const c = useChart();
  const Tip = makeTooltip(c, formatDayShort, 'line');
  const last = rows.length - 1;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={rows} margin={{ top: 8, right: 44, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke={c.grid} />
        <XAxis dataKey="date" {...axisProps(c)} tickFormatter={formatDayShort} minTickGap={24} />
        <YAxis {...yAxisProps(c)} />
        <Tooltip content={Tip} cursor={{ stroke: c.axis, strokeWidth: 1 }} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={c.series[i]}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={rows.length <= 2 ? { r: 4, fill: c.series[i], stroke: c.surface, strokeWidth: 2 } : false}
            activeDot={{ r: 5, fill: c.series[i], stroke: c.surface, strokeWidth: 2 }}
            connectNulls={false}
            isAnimationActive={false}
          >
            <LabelList dataKey={s.key} content={endLabel(last, c)} />
          </Line>
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Barre orizzontali con il valore in punta (categorie, funnel). */
export function HorizontalBars({ rows, valueLabel, labelWidth = 120 }: {
  rows: { name: string; value: number; display?: string }[];
  valueLabel: string;
  labelWidth?: number;
}) {
  const c = useChart();
  const Tip = makeTooltip(c, (l) => l, 'bar');
  const data = rows.map((r) => ({ ...r, display: r.display ?? formatNumber(r.value) }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 72, bottom: 0, left: 0 }} barCategoryGap="25%">
        <CartesianGrid horizontal={false} stroke={c.grid} />
        <XAxis type="number" {...axisProps(c)} allowDecimals={false} tickFormatter={(v: number) => formatNumber(v)} />
        <YAxis
          type="category"
          dataKey="name"
          width={labelWidth}
          tick={{ fill: c.ink2, fontSize: 12, fontFamily: FONT }}
          tickLine={false}
          axisLine={{ stroke: c.axis }}
          interval={0}
        />
        <Tooltip content={Tip} cursor={{ fill: c.hover }} />
        <Bar dataKey="value" name={valueLabel} fill={c.series[0]} maxBarSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
          <LabelList dataKey="display" position="right" fill={c.ink2} fontSize={12} fontFamily={FONT} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

const createStyles = ({ T, SHADOW }: Theme) => StyleSheet.create({
  card: { backgroundColor: T.surface, borderRadius: RADIUS.clay, padding: 18, gap: 10, ...SHADOW.card },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  title: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
  subtitle: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 2, lineHeight: 17 },
  toggle: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: RADIUS.sm, backgroundColor: T.primarySoft },
  toggleText: { fontFamily: FONTS.sansMedium, fontSize: 12, color: T.primaryInk },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyRect: { width: 10, height: 10, borderRadius: 2 },
  keyLine: { width: 14, height: 2, borderRadius: 1 },
  legendText: { fontFamily: FONTS.sans, fontSize: 12, color: T.ink2 },
  emptyBox: { height: PLOT_HEIGHT, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyText: { fontFamily: FONTS.sans, fontSize: 13, color: T.mute, textAlign: 'center', lineHeight: 19 },
});
