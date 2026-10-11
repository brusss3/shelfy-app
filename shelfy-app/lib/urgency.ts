import { Urgency, Product } from '@/types';
import { getTheme } from '@/constants/theme';
import i18n, { dateLocale } from '@/lib/i18n';

export function daysTo(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(iso);
  expiry.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - today.getTime()) / 86400000);
}

// Data di scadenza "reale": se il prodotto è stato aperto e la scadenza
// post-apertura cade prima di quella stampata, vale quella post-apertura.
export function effectiveExpiry(product: Pick<Product, 'expiry' | 'openExpiry'>): string {
  if (product.openExpiry && daysTo(product.openExpiry) < daysTo(product.expiry)) {
    return product.openExpiry;
  }
  return product.expiry;
}

// Giorni rimanenti tenendo conto della scadenza post-apertura.
export function effectiveDays(product: Pick<Product, 'expiry' | 'openExpiry'>): number {
  return daysTo(effectiveExpiry(product));
}

export function urgencyOf(days: number): Urgency {
  // Chiamata durante il render: legge il tema in uso (chiaro o scuro).
  const { T, scheme } = getTheme();
  const dark = scheme === 'dark';
  if (days < 0)  return { key: 'scaduto',   label: i18n.t('common.urgency.expired'),  color: T.urgent, soft: T.urgentSoft, ink: T.urgentInk };
  if (days === 0) return { key: 'oggi',      label: i18n.t('common.urgency.today'),    color: T.urgent, soft: T.urgentSoft, ink: T.urgentInk };
  if (days === 1) return { key: 'domani',    label: i18n.t('common.urgency.tomorrow'), color: T.warn,   soft: T.warnSoft,   ink: T.warnInk };
  if (days <= 3)  return { key: 'urgente',   label: i18n.t('add.remainingDays', { count: days }), color: T.warn,   soft: T.warnSoft,   ink: T.warnInk };
  if (days <= 7)  return { key: 'prossimo',  label: i18n.t('add.remainingDays', { count: days }), color: T.ok,     soft: T.okSoft,     ink: T.okInk };
  if (days <= 30) {
    return dark
      ? { key: 'ok', label: i18n.t('add.remainingDays', { count: days }), color: '#8fae84', soft: '#26332a', ink: '#c2dbb8' }
      : { key: 'ok', label: i18n.t('add.remainingDays', { count: days }), color: '#5f7a55', soft: '#e8ede0', ink: '#2c3a26' };
  }
  const label = i18n.t('common.urgency.monthsCount', { count: Math.round(days / 30) });
  return dark
    ? { key: 'lungo', label, color: '#98a190', soft: '#232a20', ink: '#cfd5c6' }
    : { key: 'lungo', label, color: '#7a8473', soft: '#eceee5', ink: '#36392f' };
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
}

export function tintForCategory(category: string): string {
  const map: Record<string, string> = {
    Latticini: '#f1ede0',
    Verdura: '#e6efde',
    Carne: '#f3e9e0',
    Pesce: '#f3e0d8',
    Uova: '#f6efde',
    Pasta: '#f4e9c8',
    Riso: '#f4ecdc',
    Condimenti: '#eaeac2',
    Conserve: '#f4dad0',
    Bevande: '#e6dfd1',
    Dolci: '#e8dcc6',
    Farine: '#f4ecdc',
    Pane: '#f5ecdc',
    Dessert: '#f4ecdc',
  };
  return map[category] ?? '#dde6d6';
}
