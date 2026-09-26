import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import {
  subscribeToActiveSurvey, hasRespondedToSurvey, submitSurveyResponse,
} from '@/lib/firestore';
import { Survey } from '@/types';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

// Popup del sondaggio attivo, montato una volta sola in _layout.
// Compare all'avvio se l'utente non ha ancora risposto; chiuderlo senza
// rispondere conta come risposta vuota, così non torna più.
export default function SurveyModal() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [visible, setVisible] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!user) { setSurvey(null); setVisible(false); return; }
    return subscribeToActiveSurvey(setSurvey, () => {});
  }, [user?.uid]);

  useEffect(() => {
    if (!survey || !user) return;
    let cancelled = false;
    hasRespondedToSurvey(survey.id, user.uid)
      .then((responded) => { if (!cancelled && !responded) setVisible(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [survey?.id, user?.uid]);

  const close = async (optionIndex: number | null) => {
    if (!survey || !user || sending) return;
    setSending(true);
    try {
      await submitSurveyResponse(survey.id, user.uid, optionIndex);
    } catch {
      // Se la scrittura fallisce il popup si chiude lo stesso: insistere su un
      // sondaggio facoltativo darebbe più fastidio che valore.
    } finally {
      setSending(false);
      setVisible(false);
    }
  };

  if (!survey) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => close(null)}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.badge}>{t('survey.badge')}</Text>
          <Text style={styles.question}>{survey.question}</Text>

          <View style={styles.options}>
            {survey.options.map((opt, i) => (
              <TouchableOpacity
                key={`${opt}-${i}`}
                style={styles.option}
                onPress={() => close(i)}
                disabled={sending}
                activeOpacity={0.85}
              >
                <Text style={styles.optionText}>{opt}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {sending ? (
            <ActivityIndicator color={T.primary} style={{ marginTop: 6 }} />
          ) : (
            <TouchableOpacity onPress={() => close(null)} style={styles.skip} activeOpacity={0.7}>
              <Text style={styles.skipText}>{t('survey.skip')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  card: {
    width: '100%', maxWidth: 420, backgroundColor: T.surface,
    borderRadius: 24, padding: 24, ...SHADOW.card,
  },
  badge: {
    fontFamily: FONTS.sansBold, fontSize: 11, color: T.primary,
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8,
  },
  question: {
    fontFamily: FONTS.serifItalic, fontSize: 24, color: T.ink,
    lineHeight: 30, letterSpacing: -0.3, marginBottom: 20,
  },
  options: { gap: 10 },
  option: {
    backgroundColor: T.primarySoft, borderRadius: RADIUS.lg,
    paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: 'rgba(56,120,74,0.18)',
  },
  optionText: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.primaryInk },
  skip: { paddingVertical: 12, marginTop: 6 },
  skipText: { fontFamily: FONTS.sansMedium, fontSize: 13, color: T.mute, textAlign: 'center' },
});
