import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { RADIUS } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/context/ThemeContext';
import ApkDownloadButton from './ApkDownloadButton';

// Pulsante in alto a destra delle schermate principali: apre le impostazioni
// (profilo, lingua, tema, notifiche). Per questo è un ingranaggio, non l'iniziale.
export default function ProfileButton() {
  const { T } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <View style={styles.row}>
      {/* Solo sul web: scarica l'app Android. Altrove non rende nulla. */}
      <ApkDownloadButton variant="icon" />
      <TouchableOpacity
        onPress={() => router.push('/settings' as Href)}
        style={styles.button}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={t('settings.title')}
      >
        <Ionicons name="settings-outline" size={22} color={T.primaryInk} />
      </TouchableOpacity>
    </View>
  );
}

const createStyles = ({ T }: Theme) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: {
    width: 42, height: 42, borderRadius: RADIUS.pill,
    backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
});
