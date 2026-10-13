import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PRIVACY_URL, TERMS_URL, openUrl } from '@/lib/legal';
import { FONTS } from '@/constants/theme';
import { useThemedStyles, type Theme } from '@/context/ThemeContext';

// Riga sotto i moduli di accesso e registrazione: rimanda ai Termini e
// all'Informativa privacy, che l'utente deve poter leggere prima di usare il servizio.
export default function LegalNotice() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  return (
    <Text style={styles.text}>
      {t('legalNotice.prefix')}
      <Text style={styles.link} onPress={() => openUrl(TERMS_URL)} accessibilityRole="link">{t('legalNotice.terms')}</Text>
      {t('legalNotice.middle')}
      <Text style={styles.link} onPress={() => openUrl(PRIVACY_URL)} accessibilityRole="link">{t('legalNotice.privacy')}</Text>
      {t('legalNotice.suffix')}
    </Text>
  );
}

const createStyles = ({ T }: Theme) => StyleSheet.create({
  text: {
    fontFamily: FONTS.sans, fontSize: 12, lineHeight: 18, color: T.mute,
    textAlign: 'center', marginTop: 18, paddingHorizontal: 8,
  },
  link: { color: T.primary, fontFamily: FONTS.sansSemiBold, textDecorationLine: 'underline' },
});
