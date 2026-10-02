import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { T, FONTS, RADIUS, CLAY } from '@/constants/theme';

// Link fisso all'ultimo APK (vedi scripts/publish-apk.ps1). Sul web è relativo,
// così funziona sia su shelfy-app.it sia sul dominio Firebase.
const APK_PATH = '/download/shelfy.apk';

// Solo sul web e non su iPhone/iPad, dove un APK non si può installare.
function canOfferApk(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return !/iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function download() {
  // L'header Content-Disposition fa scaricare il file senza lasciare la pagina.
  window.location.href = APK_PATH;
}

interface Props {
  /** `full`: pulsante con testo e avviso (login). `icon`: tondo, accanto all'avatar. */
  variant: 'full' | 'icon';
}

export default function ApkDownloadButton({ variant }: Props) {
  const { t } = useTranslation();
  if (!canOfferApk()) return null;

  if (variant === 'icon') {
    return (
      <TouchableOpacity
        onPress={download}
        style={styles.iconBtn}
        activeOpacity={0.75}
        accessibilityLabel={t('apk.label')}
        accessibilityRole="link"
      >
        <Ionicons name="logo-android" size={20} color={T.primaryInk} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.fullWrap}>
      <TouchableOpacity onPress={download} style={styles.fullBtn} activeOpacity={0.85} accessibilityRole="link">
        <Ionicons name="logo-android" size={18} color={T.primaryInk} />
        <Text style={styles.fullText}>{t('apk.button')}</Text>
      </TouchableOpacity>
      <Text style={styles.hint}>{t('apk.hint')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 42, height: 42, borderRadius: RADIUS.pill,
    backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center', boxShadow: CLAY.chip,
  },
  fullWrap: { alignItems: 'center', marginTop: 20, gap: 8 },
  fullBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 12, paddingHorizontal: 20, borderRadius: RADIUS.pill,
    backgroundColor: T.primarySoft,
  },
  fullText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.primaryInk },
  hint: {
    fontFamily: FONTS.sans, fontSize: 11, color: T.mute, textAlign: 'center',
    lineHeight: 16, maxWidth: 280,
  },
});
