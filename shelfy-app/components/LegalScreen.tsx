import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FONTS } from '@/constants/theme';
import { useThemedStyles, type Theme } from '@/context/ThemeContext';

// Intestazione con "Indietro" e titolo, uguale per tutte le schermate legali.
export function LegalHeader({ title }: { title: string }) {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button">
        <Text style={styles.backText}>{t('settings.back')}</Text>
      </TouchableOpacity>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

export function LegalScreen({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <SafeAreaView style={styles.root}>
      <LegalHeader title={title} />
      {children}
    </SafeAreaView>
  );
}

const createStyles = ({ T }: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: T.line, backgroundColor: T.surface,
  },
  back: { marginBottom: 8, alignSelf: 'flex-start' },
  backText: { fontFamily: FONTS.sansMedium, fontSize: 14, color: T.primary },
  title: { fontFamily: FONTS.display, fontSize: 24, color: T.ink, letterSpacing: -0.4 },
});
