import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { submitFeedback, FeedbackCategory } from '@/lib/firestore';
import ProfileButton from '@/components/ProfileButton';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

const CATEGORIES: { id: FeedbackCategory; label: string; icon: string }[] = [
  { id: 'bug',          label: 'Segnala un bug',  icon: '🐛' },
  { id: 'suggerimento', label: 'Suggerimento',     icon: '💡' },
  { id: 'altro',        label: 'Altro',            icon: '💬' },
];

type Status = 'idle' | 'sending' | 'success' | 'error';

export default function FeedbackScreen() {
  const { user } = useAuth();
  const [category, setCategory] = useState<FeedbackCategory>('suggerimento');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const canSend = message.trim().length >= 10;

  const handleSend = async () => {
    if (!canSend || !user) return;
    setStatus('sending');
    try {
      await submitFeedback({
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? '',
        category,
        message: message.trim(),
      });
      setMessage('');
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  const handleReset = () => setStatus('idle');

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.sub}>Aiutaci a migliorare</Text>
                <Text style={styles.title}>Segnalazioni</Text>
              </View>
              <ProfileButton />
            </View>
          </View>

          {status === 'success' ? (
            <View style={styles.successBox}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successTitle}>Grazie per il feedback!</Text>
              <Text style={styles.successDesc}>
                Il tuo messaggio è stato inviato. Lo leggeremo al più presto.
              </Text>
              <TouchableOpacity style={styles.resetBtn} onPress={handleReset} activeOpacity={0.85}>
                <Text style={styles.resetBtnText}>Invia un altro messaggio</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Category */}
              <Text style={styles.sectionLabel}>Tipo di segnalazione</Text>
              <View style={styles.categories}>
                {CATEGORIES.map((c) => {
                  const active = category === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => setCategory(c.id)}
                      activeOpacity={0.82}
                      style={[styles.categoryCard, active && styles.categoryCardActive]}
                    >
                      <Text style={styles.categoryIcon}>{c.icon}</Text>
                      <Text style={[styles.categoryLabel, active && styles.categoryLabelActive]}>
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Message */}
              <Text style={styles.sectionLabel}>Messaggio</Text>
              <View style={styles.textareaBox}>
                <TextInput
                  value={message}
                  onChangeText={(t) => { setMessage(t); if (status === 'error') setStatus('idle'); }}
                  placeholder="Descrivi il problema o il tuo suggerimento…"
                  placeholderTextColor={T.mute}
                  multiline
                  numberOfLines={6}
                  style={styles.textarea}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{message.trim().length} / min 10</Text>
              </View>

              {status === 'error' && (
                <Text style={styles.errorText}>Errore durante l'invio. Riprova.</Text>
              )}

              <TouchableOpacity
                style={[styles.sendBtn, (!canSend || status === 'sending') && { opacity: 0.45 }]}
                onPress={handleSend}
                disabled={!canSend || status === 'sending'}
                activeOpacity={0.85}
              >
                {status === 'sending'
                  ? <ActivityIndicator color="#fbfaf3" />
                  : <Text style={styles.sendBtnText}>Invia segnalazione</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 48 },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sub: { fontSize: 13, color: T.mute, fontFamily: FONTS.sansMedium },
  title: { fontFamily: FONTS.serifItalic, fontSize: 38, color: T.ink, letterSpacing: -1, lineHeight: 44, marginTop: 2 },

  sectionLabel: {
    fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink2,
    paddingHorizontal: 20, marginBottom: 10,
  },

  categories: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 24 },
  categoryCard: {
    flex: 1, backgroundColor: T.surface, borderRadius: RADIUS.md,
    paddingVertical: 14, alignItems: 'center', gap: 6,
    borderWidth: 2, borderColor: 'transparent', ...SHADOW.card,
  },
  categoryCardActive: { borderColor: T.primary, backgroundColor: T.primarySoft },
  categoryIcon: { fontSize: 22 },
  categoryLabel: { fontFamily: FONTS.sansSemiBold, fontSize: 11, color: T.ink2, textAlign: 'center' },
  categoryLabelActive: { color: T.primaryInk },

  textareaBox: {
    marginHorizontal: 20, backgroundColor: T.surface,
    borderRadius: RADIUS.md, padding: 16, marginBottom: 8, ...SHADOW.card,
  },
  textarea: {
    fontFamily: FONTS.sans, fontSize: 14, color: T.ink,
    minHeight: 130, lineHeight: 22,
  },
  charCount: { fontFamily: FONTS.sans, fontSize: 11, color: T.mute, textAlign: 'right', marginTop: 8 },

  errorText: {
    fontFamily: FONTS.sans, fontSize: 13, color: T.urgent,
    paddingHorizontal: 20, marginBottom: 8,
  },

  sendBtn: {
    marginHorizontal: 20, marginTop: 8,
    backgroundColor: T.primary, borderRadius: RADIUS.pill,
    paddingVertical: 16, alignItems: 'center', ...SHADOW.fab,
  },
  sendBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 16, color: '#fbfaf3' },

  successBox: {
    margin: 20, backgroundColor: T.surface, borderRadius: RADIUS.xl,
    padding: 32, alignItems: 'center', ...SHADOW.card,
  },
  successIcon: {
    width: 64, height: 64, borderRadius: RADIUS.pill,
    backgroundColor: T.okSoft, textAlign: 'center', lineHeight: 64,
    fontSize: 28, color: T.ok, overflow: 'hidden', marginBottom: 16,
  },
  successTitle: { fontFamily: FONTS.sansBold, fontSize: 20, color: T.ink, marginBottom: 8 },
  successDesc: { fontFamily: FONTS.sans, fontSize: 14, color: T.ink2, textAlign: 'center', lineHeight: 21 },
  resetBtn: {
    marginTop: 24, paddingVertical: 12, paddingHorizontal: 24,
    backgroundColor: T.primarySoft, borderRadius: RADIUS.pill,
  },
  resetBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.primaryInk },
});
