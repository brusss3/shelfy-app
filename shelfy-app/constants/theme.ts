// Palette chiara (crema + verde bosco). I token oltre ai colori base servono al
// tema scuro: `onPrimary` è il testo su un riempimento `primary`, `field` il
// fondo dei campi di testo, `*Ink` il testo sulle tinte "soft" di stato.
const LIGHT_T = {
  ink: '#1a2018',
  ink2: '#525a4f',
  mute: '#8b9387',
  line: 'rgba(40, 50, 35, 0.10)',
  bg: '#f5f3ec',
  surface: '#ffffff',
  primary: '#2f4a31',
  primaryInk: '#0d1f10',
  primarySoft: '#dde6d6',
  sage: '#bdc9ad',
  warn: '#c08833',
  warnSoft: '#f6e7c6',
  urgent: '#bd4a30',
  urgentSoft: '#f3d6c9',
  ok: '#3f7a4a',
  okSoft: '#dce9d5',
  onPrimary: '#fbfaf3',
  field: '#ece8de',
  urgentInk: '#4d1a10',
  warnInk: '#4a3414',
  okInk: '#1b3320',
};

// Palette scura: "la dispensa di notte". Il fondo è un nero-verde caldo (non
// un grigio freddo né il nero puro, che con le ombre "plastilina" farebbe
// sparire il rilievo), le superfici sono qualche gradino più chiare, il testo
// è carta color crema. Il verde bosco, troppo scuro per risaltare, diventa
// verde foglia: il pulsante primario si accende invece di sprofondare.
// Contrasti: ink su bg 14:1, ink2 8:1, mute 4.8:1, onPrimary su primary 8:1.
const DARK_T: typeof LIGHT_T = {
  ink: '#ece9dd',
  ink2: '#b4baa9',
  mute: '#858e7d',
  line: 'rgba(236, 233, 221, 0.10)',
  bg: '#12170f',
  surface: '#1c2319',
  primary: '#8fbf8c',
  primaryInk: '#c4e6bd',
  primarySoft: '#26382a',
  sage: '#4d6147',
  warn: '#e0b050',
  warnSoft: '#3a2f17',
  urgent: '#e8795c',
  urgentSoft: '#3c2119',
  ok: '#7fc68a',
  okSoft: '#1f3524',
  onPrimary: '#0d1f10',
  field: '#0e130c',
  urgentInk: '#f6c4b4',
  warnInk: '#f2d596',
  okInk: '#b9e3be',
};

export const T = LIGHT_T;

export const FONTS = {
  // Display / heading font. Era Instrument Serif (corsivo) — sostituito con
  // DM Sans Bold per coerenza con il resto dell'interfaccia su tutte le piattaforme.
  display: 'DMSans_700Bold',
  serif: 'DMSans_700Bold',
  serifItalic: 'DMSans_700Bold',
  sans: 'DMSans_400Regular',
  sansMedium: 'DMSans_500Medium',
  // Il pacchetto dm-sans non include il peso 600: usiamo il 500 (caricato)
  // così il testo "semibold" non ripiega sul font di sistema.
  sansSemiBold: 'DMSans_500Medium',
  sansBold: 'DMSans_700Bold',
};

// Famiglia di raggi: ogni elemento sta intorno a un terzo della propria
// altezza, così la curvatura è la stessa ovunque invece di alternare capsule
// e spigoli. Il "pill" resta solo per ciò che è davvero un disco (avatar,
// controlli della fotocamera), non per bottoni e campi.
export const RADIUS = {
  sm: 10,
  tag: 9,      // badge, etichette di stato
  md: 14,      // chip, filtri, tile piccole
  input: 16,   // campi di testo e ricerca
  lg: 18,      // bottoni
  clay: 20,    // card in rilievo
  xl: 24,      // fogli modali
  pill: 100,   // solo cerchi veri
};

// "Plastilina": la luce arriva sempre dall'alto — bordo interno chiaro in
// cima, velatura interna in basso, ombra esterna corta sotto — così ogni
// superficie legge come un oggetto appoggiato sul fondo crema invece che come
// un rettangolo disegnato. Il rilievo va SOLO su ciò che è un oggetto (card,
// tile, chip, pulsanti): testo, liste e intestazioni restano piatti,
// altrimenti l'interfaccia diventa un giocattolo.
//
// Nota tecnica: `boxShadow` (RN 0.78+) al posto delle vecchie shadow*/
// elevation separate, che su react-native-web non producono alcuna ombra
// (prop deprecata) e lasciavano il web completamente piatto. `elevation`
// resta solo come rete di sicurezza per Android su old architecture.
export const CLAY = {
  // Ombra corta e un po' più densa invece che larga e tenue: sul fondo crema
  // un blur ampio legge come alone sporco, non come distacco.
  surface:
    '0px 8px 16px rgba(40,50,35,0.09), ' +
    '0px 1px 0px rgba(255,255,255,0.95) inset, ' +
    '0px -3px 6px rgba(40,50,35,0.05) inset',
  chip:
    '0px 4px 10px rgba(40,50,35,0.10), ' +
    '0px 1px 0px rgba(255,255,255,0.85) inset, ' +
    '0px -2px 4px rgba(40,50,35,0.06) inset',
  // Incavo: i campi di input sembrano scavati nella superficie invece che
  // sollevati, così si distingue a colpo d'occhio cosa si preme e cosa si
  // riempie.
  inset:
    '0px 2px 5px rgba(40,50,35,0.12) inset, ' +
    '0px -1px 0px rgba(255,255,255,0.9) inset',
};

// `SHADOW.card` è usato da tutte le schermate: ridefinirlo qui porta il
// rilievo ovunque senza toccare ogni singolo file.
export const SHADOW = {
  card: {
    boxShadow: CLAY.surface,
    elevation: 3,
  },
  fab: {
    boxShadow: '0px 8px 14px rgba(20,40,18,0.45)',
    elevation: 10,
  },
};

// Sfumatura + ombra a più livelli per i pulsanti d'azione primari: luce
// implicita dall'alto (gradiente più chiaro in cima), bordo superiore
// lucido (inset chiaro) e leggero scurimento sul bordo inferiore (inset
// scuro) danno la sensazione di superficie premibile in rilievo, sopra
// l'ombra esterna che la stacca dallo sfondo.
export const GRADIENT = {
  primary: ['#3c5e40', '#2f4a31'] as const,
};

export const DEPTH = {
  button:
    '0px 6px 14px rgba(20,40,18,0.32), ' +
    '0px 1px 0px rgba(255,255,255,0.22) inset, ' +
    '0px -3px 5px rgba(13,31,16,0.20) inset',
  // Stessa idea per i pulsanti secondari chiari (icona su sfondo bianco):
  // bordo interno chiaro più leggero, ombra esterna più contenuta.
  buttonLight:
    '0px 6px 12px rgba(20,40,18,0.16), ' +
    '0px 1px 0px rgba(255,255,255,0.9) inset, ' +
    '0px -2px 4px rgba(20,40,18,0.08) inset',
};


// Sfumature delle superfici chiare: quasi impercettibili, servono solo a dare
// la direzione della luce (più chiaro in alto).
export const SURFACE = {
  card: ['#ffffff', '#f6f4ee'] as const,
  warm: ['#faeacd', '#f2dcb4'] as const,
};

// Materiale delle tre zone: il freddo è vetro/ghiaccio, la dispensa è carta.
// Usato solo dove la zona è il soggetto (chip attivo, etichette), non ovunque.
export const ZONE_MATERIAL = {
  frigo: { surface: ['#e6f0f2', '#d2e2e7'] as const, ink: '#23505b' },
  freezer: { surface: ['#e9f1fa', '#d7e5f4'] as const, ink: '#2a4566' },
  dispensa: { surface: ['#f3e8d6', '#e7d8bf'] as const, ink: '#5a4227' },
};

// ---------------------------------------------------------------------------
// Temi
// ---------------------------------------------------------------------------
// Ogni schermata legge i colori da `useTheme()` (context/ThemeContext.tsx): gli
// export statici qui sopra restano la palette chiara, usata come valore di
// partenza e dal codice che non è un componente.

const DARK_CLAY = {
  surface:
    '0px 8px 16px rgba(0,0,0,0.45), ' +
    '0px 1px 0px rgba(255,255,255,0.07) inset, ' +
    '0px -3px 6px rgba(0,0,0,0.25) inset',
  chip:
    '0px 4px 10px rgba(0,0,0,0.45), ' +
    '0px 1px 0px rgba(255,255,255,0.06) inset, ' +
    '0px -2px 4px rgba(0,0,0,0.25) inset',
  inset:
    '0px 2px 5px rgba(0,0,0,0.55) inset, ' +
    '0px -1px 0px rgba(255,255,255,0.05) inset',
};

const DARK_DEPTH = {
  button:
    '0px 6px 14px rgba(0,0,0,0.5), ' +
    '0px 1px 0px rgba(255,255,255,0.28) inset, ' +
    '0px -3px 5px rgba(20,50,25,0.25) inset',
  buttonLight:
    '0px 6px 12px rgba(0,0,0,0.45), ' +
    '0px 1px 0px rgba(255,255,255,0.08) inset, ' +
    '0px -2px 4px rgba(0,0,0,0.3) inset',
};

type Pair = readonly [string, string];

export interface Theme {
  scheme: 'light' | 'dark';
  T: typeof LIGHT_T;
  CLAY: { surface: string; chip: string; inset: string };
  SHADOW: {
    card: { boxShadow: string; elevation: number };
    fab: { boxShadow: string; elevation: number };
  };
  GRADIENT: { primary: Pair };
  DEPTH: { button: string; buttonLight: string };
  SURFACE: { card: Pair; warm: Pair };
  ZONE_MATERIAL: Record<'frigo' | 'freezer' | 'dispensa', { surface: Pair; ink: string }>;
}

export const LIGHT_THEME: Theme = {
  scheme: 'light',
  T: LIGHT_T,
  CLAY,
  SHADOW,
  GRADIENT,
  DEPTH,
  SURFACE,
  ZONE_MATERIAL,
};

export const DARK_THEME: Theme = {
  scheme: 'dark',
  T: DARK_T,
  CLAY: DARK_CLAY,
  SHADOW: {
    card: { boxShadow: DARK_CLAY.surface, elevation: 3 },
    fab: { boxShadow: '0px 8px 14px rgba(0,0,0,0.6)', elevation: 10 },
  },
  GRADIENT: { primary: ['#a3cf9f', '#8fbf8c'] as const },
  DEPTH: DARK_DEPTH,
  SURFACE: {
    card: ['#222b1e', '#1a2117'] as const,
    warm: ['#3a3020', '#2e2618'] as const,
  },
  ZONE_MATERIAL: {
    frigo: { surface: ['#1d2f33', '#17262a'] as const, ink: '#9fd0dc' },
    freezer: { surface: ['#1c2a3c', '#16212f'] as const, ink: '#a9c6ee' },
    dispensa: { surface: ['#352b1d', '#2b2217'] as const, ink: '#e0c49a' },
  },
};

// Tema in uso: lo imposta ThemeProvider a ogni cambio. Serve alle funzioni che
// non sono componenti (es. urgencyOf) e che sono chiamate durante il render.
let currentTheme: Theme = LIGHT_THEME;
export const getTheme = (): Theme => currentTheme;
export const setCurrentTheme = (theme: Theme): void => { currentTheme = theme; };
