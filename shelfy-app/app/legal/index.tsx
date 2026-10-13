import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';
import { LegalScreen } from '@/components/LegalScreen';
import { useAcquisitionConsent, setAcquisitionConsent } from '@/lib/acquisition';
import { PRIVACY_URL, TERMS_URL, DELETE_ACCOUNT_URL, CONTACT_EMAIL, openUrl } from '@/lib/legal';
import { FONTS, RADIUS } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/context/ThemeContext';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function Row({ icon, label, onPress, external }: { icon: IconName; label: string; onPress: () => void; external?: boolean }) {
  const { T } = useTheme();
  const styles = useThemedStyles(createStyles);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.8} accessibilityRole="link">
      <Ionicons name={icon} size={20} color={T.primary} />
      <Text style={styles.rowText}>{label}</Text>
      <Ionicons name={external ? 'open-outline' : 'chevron-forward'} size={17} color={T.mute} />
    </TouchableOpacity>
  );
}

// Punto unico per documenti legali, licenze, crediti e contatti: raggiungibile
// da Impostazioni, come richiesto da Google Play e App Store.
export default function LegalIndexScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const consent = useAcquisitionConsent();

  const version = Constants.expoConfig?.version ?? '1.0.0';
  // L'aggiornamento in volo in uso, se c'è: utile a chi ci scrive per un problema.
  const build = Updates.updateId ? Updates.updateId.slice(0, 8) : null;

  return (
    <LegalScreen title={t('legal.title')}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.container}>
          <View style={styles.card}>
            <Row icon="shield-checkmark-outline" label={t('legal.privacy')} onPress={() => openUrl(PRIVACY_URL)} external />
            <View style={styles.sep} />
            <Row icon="document-text-outline" label={t('legal.terms')} onPress={() => openUrl(TERMS_URL)} external />
            <View style={styles.sep} />
            <Row icon="trash-bin-outline" label={t('legal.deleteInfo')} onPress={() => openUrl(DELETE_ACCOUNT_URL)} external />
          </View>

          <View style={styles.card}>
            <Row icon="code-slash-outline" label={t('legal.licenses')} onPress={() => router.push('/legal/licenses')} />
            <View style={styles.sep} />
            <Row icon="heart-outline" label={t('legal.credits')} onPress={() => router.push('/legal/credits')} />
          </View>

          {/* Consenso al tracciamento delle guide: esiste solo sul web, e solo se l'utente ha già risposto. */}
          {Platform.OS === 'web' && consent !== null && (
            <View style={styles.card}>
              <Text style={styles.label}>{t('legal.consentRow')}</Text>
              <Text style={styles.sub}>{consent === 'granted' ? t('legal.consentGranted') : t('legal.consentDenied')}</Text>
              <TouchableOpacity onPress={() => setAcquisitionConsent(null)} style={styles.smallBtn} accessibilityRole="button">
                <Text style={styles.smallBtnText}>{t('legal.consentReset')}</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={styles.card}>
            <Row icon="mail-outline" label={`${t('legal.contact')} · ${CONTACT_EMAIL}`} onPress={() => openUrl(`mailto:${CONTACT_EMAIL}`)} external />
          </View>

          <Text style={styles.note}>{t('legal.foodNotice')}</Text>
          <Text style={styles.note}>{t('legal.controller')} · {CONTACT_EMAIL}</Text>
          <Text style={styles.version}>
            {t('settings.version', { version })}{build ? ` · ${build}` : ''}
          </Text>
        </View>
      </ScrollView>
    </LegalScreen>
  );
}

const createStyles = ({ T, SHADOW }: Theme) => StyleSheet.create({
  scroll: { paddingVertical: 20, paddingBottom: 60 },
  container: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 16, gap: 14 },
  card: { backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 6, ...SHADOW.card },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 12 },
  rowText: { flex: 1, fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
  sep: { height: 1, backgroundColor: T.line, marginHorizontal: 12 },
  label: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink, paddingTop: 12, paddingHorizontal: 12 },
  sub: { fontFamily: FONTS.sans, fontSize: 13, color: T.mute, paddingHorizontal: 12, marginTop: 3 },
  smallBtn: {
    alignSelf: 'flex-start', margin: 12, backgroundColor: T.primarySoft,
    borderRadius: RADIUS.md, paddingVertical: 9, paddingHorizontal: 14,
  },
  smallBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.primaryInk },
  note: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 18, color: T.mute, paddingHorizontal: 4 },
  version: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, textAlign: 'center', marginTop: 6 },
});
