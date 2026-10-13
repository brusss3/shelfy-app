import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { setAcquisitionConsent, useConsentPrompt } from '@/lib/acquisition';
import { PRIVACY_URL, openUrl } from '@/lib/legal';
import { FONTS, RADIUS } from '@/constants/theme';
import { useThemedStyles, type Theme } from '@/context/ThemeContext';

// Compare solo a chi arriva da una guida (?src=…) e non ha ancora risposto.
// "Accetta" e "Rifiuta" hanno lo stesso peso: il rifiuto non deve costare un clic in più.
export default function ConsentBanner() {
  const show = useConsentPrompt();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  if (!show) return null;

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card} accessibilityRole="alert">
        <Text style={styles.title}>{t('consent.title')}</Text>
        <Text style={styles.body}>
          {t('consent.body')}{' '}
          <Text style={styles.link} onPress={() => openUrl(PRIVACY_URL)} accessibilityRole="link">{t('consent.more')}</Text>
        </Text>
        <View style={styles.buttons}>
          <Pressable style={styles.btn} onPress={() => setAcquisitionConsent('denied')} accessibilityRole="button">
            <Text style={styles.btnText}>{t('consent.reject')}</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={() => setAcquisitionConsent('granted')} accessibilityRole="button">
            <Text style={styles.btnText}>{t('consent.accept')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const createStyles = ({ T, SHADOW }: Theme) => StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', padding: 16, zIndex: 1000 },
  card: {
    width: '100%', maxWidth: 520, backgroundColor: T.surface, borderRadius: RADIUS.lg,
    padding: 16, borderWidth: 1, borderColor: T.line, ...SHADOW.card,
  },
  title: { fontFamily: FONTS.sansBold, fontSize: 15, color: T.ink },
  body: { fontFamily: FONTS.sans, fontSize: 13, lineHeight: 19, color: T.ink2, marginTop: 6 },
  link: { color: T.primary, fontFamily: FONTS.sansSemiBold, textDecorationLine: 'underline' },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: {
    flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: RADIUS.md,
    backgroundColor: T.primarySoft,
  },
  btnText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.primaryInk },
});
