import React, { useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LegalScreen } from '@/components/LegalScreen';
import { openUrl } from '@/lib/legal';
import { FONTS, RADIUS } from '@/constants/theme';
import { useThemedStyles, type Theme } from '@/context/ThemeContext';
// Generato da scripts/generate-licenses.mjs: solo i pacchetti che finiscono
// davvero nei bundle (non gli strumenti di build). Da rilanciare se cambiano le dipendenze.
import data from '@/lib/legal/licenses.json';

interface Pkg { name: string; version: string; license: string; url?: string; copyright: string[] }
const PACKAGES = data.packages as Pkg[];
const TEXTS = data.texts as Record<string, string>;

export default function LicensesScreen() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState<string | null>(null);

  // Una voce per licenza usata (le doppie, "MIT AND ISC", si spezzano).
  const licenseIds = useMemo(
    () => [...new Set(PACKAGES.flatMap((p) => p.license.split(' AND ')))].filter((l) => TEXTS[l]).sort(),
    [],
  );

  const header = (
    <View style={styles.pad}>
      <Text style={styles.intro}>{t('legal.licensesIntro')}</Text>
      <Text style={styles.small}>{t('legal.licensesFonts')}</Text>
      <Text style={styles.small}>{t('legal.licensesServices')}</Text>
      <Text style={styles.count}>{t('legal.licensesCount', { count: PACKAGES.length })}</Text>
    </View>
  );

  const footer = (
    <View style={styles.pad}>
      <Text style={styles.sectionTitle}>{t('legal.licensesTexts')}</Text>
      {licenseIds.map((id) => (
        <View key={id} style={styles.licenseCard}>
          <TouchableOpacity onPress={() => setOpen(open === id ? null : id)} accessibilityRole="button">
            <Text style={styles.licenseName}>{id}</Text>
          </TouchableOpacity>
          {open === id && <Text style={styles.licenseText}>{TEXTS[id]}</Text>}
        </View>
      ))}
    </View>
  );

  return (
    <LegalScreen title={t('legal.licenses')}>
      <FlatList
        data={PACKAGES}
        keyExtractor={(p) => `${p.name}@${p.version}`}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        contentContainerStyle={styles.list}
        initialNumToRender={20}
        renderItem={({ item: p }) => (
          <View style={styles.item}>
            <View style={styles.itemHead}>
              <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
              <Text style={styles.version}>{p.version}</Text>
              <Text style={styles.badge}>{p.license}</Text>
            </View>
            {p.copyright.map((c) => <Text key={c} style={styles.copyright} numberOfLines={2}>{c}</Text>)}
            {p.url && p.url.startsWith('http') && (
              <TouchableOpacity onPress={() => openUrl(p.url!)} accessibilityRole="link">
                <Text style={styles.link} numberOfLines={1}>{p.url.replace(/^https?:\/\//, '')}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </LegalScreen>
  );
}

const createStyles = ({ T }: Theme) => StyleSheet.create({
  list: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingBottom: 60 },
  pad: { paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  intro: { fontFamily: FONTS.sans, fontSize: 14, lineHeight: 20, color: T.ink2 },
  small: { fontFamily: FONTS.sans, fontSize: 12, lineHeight: 18, color: T.mute },
  count: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink, marginTop: 6 },
  item: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.line },
  itemHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.ink },
  version: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute },
  badge: {
    marginLeft: 'auto', fontFamily: FONTS.sansSemiBold, fontSize: 11, color: T.primaryInk,
    backgroundColor: T.primarySoft, borderRadius: RADIUS.tag, paddingVertical: 2, paddingHorizontal: 8, overflow: 'hidden',
  },
  copyright: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 3 },
  link: { fontFamily: FONTS.sans, fontSize: 12, color: T.primary, marginTop: 3 },
  sectionTitle: { fontFamily: FONTS.sansBold, fontSize: 16, color: T.ink, marginTop: 18 },
  licenseCard: { backgroundColor: T.surface, borderRadius: RADIUS.md, padding: 14 },
  licenseName: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.primary },
  licenseText: { fontFamily: FONTS.sans, fontSize: 11, lineHeight: 16, color: T.ink2, marginTop: 10 },
});
