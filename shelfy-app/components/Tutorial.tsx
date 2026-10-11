import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS, RADIUS } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/context/ThemeContext';

// Mini-tutorial per le parti complesse. Il testo sta nelle traduzioni:
//   tutorials.<id>.title, tutorials.<id>.steps (array), tutorials.<id>.tip (opzionale)
// Per aggiungerne uno: nuovo id qui, testi nei tre locale, poi nella schermata
// `const tutorial = useTutorial('id')` + <HelpButton onPress={tutorial.open} />
// + <TutorialModal id="id" visible={tutorial.visible} onClose={tutorial.close} />.
export type TutorialId = 'receiptScan' | 'receiptReview' | 'recipeAi' | 'sharedPantry' | 'shopping';

const storageKey = (id: TutorialId) => `shelfy.tutorial.${id}`;

/** Stato del tutorial di una schermata. Con `autoShow` si apre da solo la prima
 *  volta; chiuderlo lo segna come visto. La memoria può essere illeggibile
 *  (finestra privata, dati bloccati): in quel caso non si apre da solo. */
export function useTutorial(id: TutorialId, autoShow = true) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!autoShow) return;
    let cancelled = false;
    AsyncStorage.getItem(storageKey(id))
      .then((seen) => { if (!seen && !cancelled) setVisible(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [id, autoShow]);

  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(storageKey(id), '1').catch(() => {});
  }, [id]);

  return { visible, open, close };
}

/** Bottone tondo "?" da mettere nell'intestazione di una schermata. */
export function HelpButton({ onPress }: { onPress: () => void }) {
  const { T } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.helpBtn}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t('tutorials.helpA11y')}
    >
      <Ionicons name="help-circle-outline" size={22} color={T.ink} />
    </TouchableOpacity>
  );
}

export default function TutorialModal({
  id, visible, onClose,
}: { id: TutorialId; visible: boolean; onClose: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const raw = t(`tutorials.${id}.steps`, { returnObjects: true }) as unknown;
  const steps = Array.isArray(raw) ? (raw as string[]) : [];
  const tip = t(`tutorials.${id}.tip`, { defaultValue: '' });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{t(`tutorials.${id}.title`)}</Text>
          {steps.map((s, i) => (
            <View key={i} style={styles.row}>
              <View style={styles.num}><Text style={styles.numText}>{i + 1}</Text></View>
              <Text style={styles.text}>{s}</Text>
            </View>
          ))}
          {!!tip && <Text style={styles.tip}>{tip}</Text>}
          <TouchableOpacity style={styles.gotIt} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.gotItText}>{t('tutorials.gotIt')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = ({ T, SHADOW }: Theme) => StyleSheet.create({
  helpBtn: {
    width: 40, height: 40, borderRadius: 100, backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.card,
  },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24,
  },
  card: {
    backgroundColor: T.surface, borderRadius: 24, padding: 22, gap: 14,
    borderWidth: 1, borderColor: T.line,
  },
  title: { fontFamily: FONTS.serifItalic, fontSize: 26, color: T.ink, letterSpacing: -0.4 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  num: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: T.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  numText: { fontFamily: FONTS.sansBold, fontSize: 12, color: T.primaryInk },
  text: { flex: 1, fontFamily: FONTS.sans, fontSize: 14, lineHeight: 20, color: T.ink },
  tip: { fontFamily: FONTS.sans, fontSize: 12.5, lineHeight: 18, color: T.mute },
  gotIt: {
    backgroundColor: T.primary, borderRadius: RADIUS.pill, paddingVertical: 13,
    alignItems: 'center', marginTop: 4,
  },
  gotItText: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.onPrimary },
});
