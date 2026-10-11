import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_THEME, LIGHT_THEME, Theme, setCurrentTheme } from '@/constants/theme';

export type { Theme } from '@/constants/theme';
export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_STORAGE_KEY = 'shelfy_theme';

/** Preferenza salvata, da leggere prima del primo render: altrimenti chi ha
 *  scelto il tema scuro vedrebbe un lampo di chiaro a ogni avvio. */
export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  } catch {
    return 'system';
  }
}

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: LIGHT_THEME,
  mode: 'system',
  setMode: () => {},
});

export function ThemeProvider({ initialMode, children }: { initialMode: ThemeMode; children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const system = useColorScheme();

  const scheme = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode;
  const theme = scheme === 'dark' ? DARK_THEME : LIGHT_THEME;
  // Va aggiornato durante il render, prima dei figli: le funzioni che non sono
  // componenti (es. urgencyOf) leggono il tema da qui.
  setCurrentTheme(theme);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    AsyncStorage.setItem(THEME_STORAGE_KEY, next).catch(() => {});
  }, []);

  useEffect(() => {
    // Il fondo dietro l'app (sotto le transizioni, dietro la tastiera) segue il tema.
    SystemUI.setBackgroundColorAsync(theme.T.bg).catch(() => {});
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.backgroundColor = theme.T.bg;
      document.body.style.backgroundColor = theme.T.bg;
      document.documentElement.style.colorScheme = theme.scheme;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.scheme === 'dark' ? theme.T.bg : '#2f4a31');
    }
  }, [theme]);

  const value = useMemo(() => ({ theme, mode, setMode }), [theme, mode, setMode]);

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

export function useThemeMode(): Pick<ThemeContextValue, 'mode' | 'setMode'> {
  const { mode, setMode } = useContext(ThemeContext);
  return { mode, setMode };
}

/** Stili che dipendono dal tema: `const styles = useThemedStyles(createStyles)`,
 *  con `createStyles = (theme: Theme) => StyleSheet.create({...})` a livello di
 *  modulo. Si ricalcolano solo quando il tema cambia. */
export function useThemedStyles<S>(factory: (theme: Theme) => S): S {
  const theme = useTheme();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => factory(theme), [theme]);
}
