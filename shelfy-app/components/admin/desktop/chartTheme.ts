import type { Theme } from '@/context/ThemeContext';

// Colori dei grafici. Tre serie al massimo per grafico, sempre nello stesso
// ordine (verde bosco, ambra, viola): verificati con il validatore della
// skill dataviz contro la superficie delle card (#ffffff chiaro, #1c2319
// scuro), tutte le coppie, anche per daltonismo. L'ambra chiara sta sotto
// 3:1 sul bianco: per questo ogni grafico ha legenda, etichette dirette e la
// vista tabella.
const SERIES = {
  light: ['#2e7d4f', '#d9a21e', '#6d5bd0'],
  dark: ['#4aa870', '#b07f10', '#8775e6'],
} as const;

export interface ChartTheme {
  series: readonly [string, string, string];
  surface: string;
  grid: string;
  axis: string;
  tick: string;
  ink: string;
  ink2: string;
  hover: string;
}

export function chartTheme({ T, scheme }: Theme): ChartTheme {
  return {
    series: SERIES[scheme],
    surface: T.surface,
    grid: T.line,
    axis: scheme === 'dark' ? 'rgba(236,233,221,0.22)' : 'rgba(40,50,35,0.22)',
    tick: T.mute,
    ink: T.ink,
    ink2: T.ink2,
    hover: scheme === 'dark' ? 'rgba(236,233,221,0.06)' : 'rgba(40,50,35,0.05)',
  };
}
