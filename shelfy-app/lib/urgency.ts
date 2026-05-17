import { Urgency } from '@/types';
import { T } from '@/constants/theme';

export function urgencyOf(days: number): Urgency {
  if (days < 0)  return { key: 'scaduto',   label: 'Scaduto',        color: T.urgent, soft: T.urgentSoft, ink: '#4d1a10' };
  if (days === 0) return { key: 'oggi',      label: 'Scade oggi',     color: T.urgent, soft: T.urgentSoft, ink: '#4d1a10' };
  if (days === 1) return { key: 'domani',    label: 'Scade domani',   color: T.warn,   soft: T.warnSoft,   ink: '#4a3414' };
  if (days <= 3)  return { key: 'urgente',   label: `${days} giorni`, color: T.warn,   soft: T.warnSoft,   ink: '#4a3414' };
  if (days <= 7)  return { key: 'prossimo',  label: `${days} giorni`, color: T.ok,     soft: T.okSoft,     ink: '#1b3320' };
  if (days <= 30) return { key: 'ok',        label: `${days} giorni`, color: '#5f7a55', soft: '#e8ede0',   ink: '#2c3a26' };
  return            { key: 'lungo',          label: `${Math.round(days / 30)} mesi`, color: '#7a8473', soft: '#eceee5', ink: '#36392f' };
}

const MONTHS = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];

export function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
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
