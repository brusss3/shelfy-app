import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LegalScreen } from '@/components/LegalScreen';
import { openUrl } from '@/lib/legal';
import { FONTS, RADIUS } from '@/constants/theme';
import { useThemedStyles, type Theme } from '@/context/ThemeContext';

// Attribuzioni richieste dalle licenze dei dati (ODbL: Open Food Facts, Open
// Prices, OpenStreetMap) e crediti agli altri componenti. Testi in legal.credits_*.
const ENTRIES: { id: string; url?: string }[] = [
  { id: 'off', url: 'https://world.openfoodfacts.org' },
  { id: 'prices', url: 'https://prices.openfoodfacts.org' },
  { id: 'osm', url: 'https://www.openstreetmap.org/copyright' },
  { id: 'community' },
  { id: 'fonts', url: 'https://openfontlicense.org' },
  { id: 'ocr' },
  { id: 'services' },
];

export default function CreditsScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);

  return (
    <LegalScreen title={t('legal.credits')}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <Text style={styles.intro}>{t('legal.creditsIntro')}</Text>
          {ENTRIES.map((e) => (
            <View key={e.id} style={styles.card}>
              <Text style={styles.title}>{t(`legal.credits_${e.id}_title`)}</Text>
              <Text style={styles.body}>{t(`legal.credits_${e.id}_body`)}</Text>
              {e.url && (
                <TouchableOpacity onPress={() => openUrl(e.url!)} accessibilityRole="link">
                  <Text style={styles.link}>{e.url.replace('https://', '')}</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </LegalScreen>
  );
}

const createStyles = ({ T, SHADOW }: Theme) => StyleSheet.create({
  scroll: { paddingVertical: 20, paddingBottom: 60 },
  container: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 16, gap: 12 },
  intro: { fontFamily: FONTS.sans, fontSize: 14, lineHeight: 20, color: T.ink2, paddingHorizontal: 4 },
  card: { backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 16, ...SHADOW.card },
  title: { fontFamily: FONTS.sansBold, fontSize: 15, color: T.ink },
  body: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, color: T.ink2, marginTop: 6 },
  link: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.primary, marginTop: 8 },
});
