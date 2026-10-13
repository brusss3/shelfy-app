import React, { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';
import { FONTS, RADIUS } from '@/constants/theme';
import { useThemedStyles, type Theme } from '@/context/ThemeContext';

// Scritto da scripts/publish-apk.ps1 a ogni pubblicazione dell'APK.
const VERSION_URL = 'https://shelfy-632e0.web.app/download/version.json';
const DISMISSED_KEY = 'shelfy.update.dismissed';

interface RemoteVersion {
  runtimeVersion: string | null;
  apkUrl: string;
}

// Due casi, entrambi solo per l'APK scaricato dal sito (canale "preview"):
// 1. Un aggiornamento in volo (solo JavaScript) è già stato scaricato: basta
//    riavviare. Lo scarica expo-updates da solo all'avvio.
// 2. Esiste un APK con codice nativo diverso: gli aggiornamenti in volo non
//    lo raggiungono, quindi si rimanda al download. Android chiede comunque
//    all'utente di confermare l'installazione.
// Sul Play Store (canale "production") aggiorna lo store: qui non compare.
export default function UpdateBanner() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const { isUpdatePending } = Updates.useUpdates();
  const [remote, setRemote] = useState<RemoteVersion | null>(null);

  const active = Platform.OS === 'android' && Updates.isEnabled && Updates.channel === 'preview';

  useEffect(() => {
    if (!active || !Updates.runtimeVersion) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${VERSION_URL}?t=${Date.now()}`);
        if (!res.ok) return;
        const v = (await res.json()) as RemoteVersion;
        if (!v.runtimeVersion || !v.apkUrl || v.runtimeVersion === Updates.runtimeVersion) return;
        // "Più tardi" vale per quella versione: alla prossima ricompare.
        const dismissed = await AsyncStorage.getItem(DISMISSED_KEY).catch(() => null);
        if (!cancelled && dismissed !== v.runtimeVersion) setRemote(v);
      } catch {
        // Senza rete non c'è niente da proporre.
      }
    })();
    return () => { cancelled = true; };
  }, [active]);

  if (!active) return null;

  if (isUpdatePending) {
    return (
      <View style={styles.banner} accessibilityLiveRegion="polite">
        <Text style={styles.text}>{t('update.ready')}</Text>
        <Pressable onPress={() => Updates.reloadAsync().catch(() => {})} hitSlop={8} accessibilityRole="button">
          <Text style={styles.action}>{t('update.restart')}</Text>
        </Pressable>
      </View>
    );
  }

  if (remote) {
    const later = () => {
      AsyncStorage.setItem(DISMISSED_KEY, remote.runtimeVersion ?? '').catch(() => {});
      setRemote(null);
    };
    return (
      <View style={styles.banner} accessibilityLiveRegion="polite">
        <Text style={styles.text}>{t('update.newVersion')}</Text>
        <Pressable onPress={later} hitSlop={8} accessibilityRole="button">
          <Text style={styles.later}>{t('update.later')}</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(remote.apkUrl).catch(() => {})} hitSlop={8} accessibilityRole="button">
          <Text style={styles.action}>{t('update.download')}</Text>
        </Pressable>
      </View>
    );
  }

  return null;
}

const createStyles = ({ T }: Theme) => StyleSheet.create({
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: T.primarySoft, borderRadius: RADIUS.md,
    paddingVertical: 10, paddingHorizontal: 14, marginBottom: 12,
  },
  text: { flex: 1, color: T.primaryInk, fontSize: 13, fontFamily: FONTS.sansMedium },
  action: { color: T.primary, fontSize: 13, fontFamily: FONTS.sansBold },
  later: { color: T.mute, fontSize: 13, fontFamily: FONTS.sansMedium },
});
