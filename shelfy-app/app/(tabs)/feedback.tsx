import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { submitFeedback, FeedbackCategory } from '@/lib/firestore';
import ProfileButton from '@/components/ProfileButton';
import { showAlert } from '@/lib/alert';
import PrimaryButton from '@/components/PrimaryButton';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

interface CategoryOption {
  id: FeedbackCategory;
  labelKey: string;
  emoji: string;
  descKey: string;
  placeholderKey: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: 'suggerimento',
    labelKey: 'feedback.categories.suggestion.label',
    emoji: '💡',
    descKey: 'feedback.categories.suggestion.desc',
    placeholderKey: 'feedback.categories.suggestion.placeholder',
  },
  {
    id: 'bug',
    labelKey: 'feedback.categories.bug.label',
    emoji: '🐞',
    descKey: 'feedback.categories.bug.desc',
    placeholderKey: 'feedback.categories.bug.placeholder',
  },
  {
    id: 'prodotto',
    labelKey: 'feedback.categories.product.label',
    emoji: '📦',
    descKey: 'feedback.categories.product.desc',
    placeholderKey: 'feedback.categories.product.placeholder',
  },
  {
    id: 'altro',
    labelKey: 'feedback.categories.other.label',
    emoji: '💬',
    descKey: 'feedback.categories.other.desc',
    placeholderKey: 'feedback.categories.other.placeholder',
  },
];

const QUICK_TAG_KEYS = ['feedback.quickTags.widget', 'feedback.quickTags.allergens', 'feedback.quickTags.export'];

const RATING_EMOJIS = ['😡', '😕', '😐', '😊', '🤩'];

export default function FeedbackScreen() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const [category, setCategory] = useState<FeedbackCategory>('suggerimento');
  const [rating, setRating] = useState<number | null>(5);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const activeCategory = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];
  const RATING_LABELS = [
    t('feedback.ratingLabel1'), t('feedback.ratingLabel2'), t('feedback.ratingLabel3'),
    t('feedback.ratingLabel4'), t('feedback.ratingLabel5'),
  ];

  const handleSelectQuickTag = (tag: string) => {
    setMessage((prev) => {
      const clean = tag.replace(/ [^\s]+$/, ''); // remove trailing emoji if needed
      if (!prev.trim()) return t('feedback.quickTagPrefix', { clean });
      if (prev.includes(clean)) return prev;
      return t('feedback.quickTagAppend', { prev: prev.trim(), clean });
    });
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      showAlert(t('feedback.missingMessageTitle'), t('feedback.missingMessageBody'));
      return;
    }

    if (!user) {
      showAlert(t('feedback.notLoggedInTitle'), t('feedback.notLoggedInBody'));
      return;
    }

    setSubmitting(true);
    try {
      await submitFeedback({
        uid: user.uid,
        email: user.email ?? '',
        displayName: user.displayName ?? '',
        category,
        message: message.trim(),
        rating: rating ?? undefined,
      });

      setSubmitted(true);
      setMessage('');

      showAlert(t('feedback.sentTitle'), t('feedback.sentBody'));
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('feedback.genericErrorBody'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.tagline}>{t('feedback.tagline')}</Text>
                <Text style={styles.title}>{t('feedback.title')}</Text>
              </View>
              <ProfileButton />
            </View>

            {/* Intro Banner */}
            <View style={styles.introCard}>
              <View style={styles.introIcon}>
                <Text style={{ fontSize: 26 }}>✨</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.introTitle}>{t('feedback.introTitle')}</Text>
                <Text style={styles.introDesc}>
                  {t('feedback.introDesc')}
                </Text>
              </View>
            </View>

            {/* Success Box if just submitted */}
            {submitted && (
              <View style={styles.successCard}>
                <Text style={styles.successEmoji}>🎉</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>{t('feedback.successTitle')}</Text>
                  <Text style={styles.successText}>
                    {t('feedback.successText')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSubmitted(false)}
                  style={styles.newFeedbackBtn}
                >
                  <Text style={styles.newFeedbackBtnText}>{t('feedback.newFeedback')}</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 1: Categoria */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('feedback.step1Title')}</Text>
              <View style={styles.grid}>
                {CATEGORIES.map((cat) => {
                  const isSelected = category === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.categoryCard, isSelected && styles.categoryCardActive]}
                      onPress={() => setCategory(cat.id)}
                      activeOpacity={0.85}
                    >
                      <View style={styles.catCardTop}>
                        <Text style={styles.catEmoji}>{cat.emoji}</Text>
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                      <Text style={[styles.catLabel, isSelected && styles.catLabelActive]}>
                        {t(cat.labelKey)}
                      </Text>
                      <Text style={styles.catDesc} numberOfLines={2}>
                        {t(cat.descKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 2: Valutazione complessiva */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('feedback.step2Title')}</Text>
              <View style={styles.ratingCard}>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const isSelected = (rating ?? 0) >= star;
                    return (
                      <TouchableOpacity
                        key={star}
                        style={styles.starBtn}
                        onPress={() => setRating(star)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.starText, isSelected ? styles.starTextActive : styles.starTextDim]}>
                          ★
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {rating ? (
                  <Text style={styles.ratingSub}>
                    {RATING_EMOJIS[rating - 1]} {RATING_LABELS[rating - 1]} ({rating}/5)
                  </Text>
                ) : (
                  <Text style={styles.ratingSub}>{t('feedback.ratingPrompt')}</Text>
                )}
              </View>
            </View>

            {/* Quick Suggestions Chips */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('feedback.quickSuggestionsTitle')}</Text>
              <View style={styles.chipsWrap}>
                {QUICK_TAG_KEYS.map((key) => {
                  const tag = t(key);
                  return (
                    <TouchableOpacity
                      key={key}
                      style={styles.chip}
                      onPress={() => handleSelectQuickTag(tag)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.chipText}>{tag}</Text>
                      <Text style={styles.chipPlus}>+</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 3: Messaggio */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('feedback.step3Title')}</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textArea}
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t(activeCategory.placeholderKey)}
                  placeholderTextColor={T.mute}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
                <View style={styles.inputFooter}>
                  <Text style={styles.charCount}>
                    {t('feedback.charCount', { count: message.length })}
                  </Text>
                  {message.length > 0 && (
                    <TouchableOpacity onPress={() => setMessage('')}>
                      <Text style={styles.clearText}>{t('feedback.clear')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            {/* Pulsante Invia */}
            <PrimaryButton
              onPress={handleSubmit}
              disabled={!message.trim()}
              loading={submitting}
              icon="send-outline"
              label={t('feedback.submit')}
              fullWidth
            />

            {/* Roadmap / Prossime novità */}
            <View style={styles.roadmapCard}>
              <Text style={styles.roadmapHeader}>{t('feedback.roadmapHeader')}</Text>
              <Text style={styles.roadmapSub}>
                {t('feedback.roadmapSub')}
              </Text>
              <View style={styles.roadmapList}>
                <View style={styles.roadmapItem}>
                  <Text style={styles.roadmapStatusTag}>{t('feedback.comingSoon')}</Text>
                  <Text style={styles.roadmapText}>
                    👨‍👩‍👧 <Text style={styles.roadmapBold}>{t('feedback.roadmapSharedHomes')}</Text> {t('feedback.roadmapSharedHomesDesc')}
                  </Text>
                </View>
                <View style={styles.roadmapItem}>
                  <Text style={[styles.roadmapStatusTag, { backgroundColor: T.okSoft }]}>{t('feedback.active')}</Text>
                  <Text style={styles.roadmapText}>
                    🍳 <Text style={styles.roadmapBold}>{t('feedback.roadmapAiRecipe')}</Text> {t('feedback.roadmapAiRecipeDesc')}
                  </Text>
                </View>
                <View style={styles.roadmapItem}>
                  <Text style={[styles.roadmapStatusTag, { backgroundColor: T.okSoft }]}>{t('feedback.active')}</Text>
                  <Text style={styles.roadmapText}>
                    🧾 <Text style={styles.roadmapBold}>{t('feedback.roadmapReceiptScan')}</Text> {t('feedback.roadmapReceiptScanDesc')}
                  </Text>
                </View>
                <View style={styles.roadmapItem}>
                  <Text style={[styles.roadmapStatusTag, { backgroundColor: T.okSoft }]}>{t('feedback.active')}</Text>
                  <Text style={styles.roadmapText}>
                    🔔 <Text style={styles.roadmapBold}>{t('feedback.roadmapNotifications')}</Text> {t('feedback.roadmapNotificationsDesc')}
                  </Text>
                </View>
              </View>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  scroll: {
    paddingVertical: 16,
    paddingBottom: 48,
  },
  container: {
    width: '100%',
    maxWidth: 620,
    alignSelf: 'center',
    paddingHorizontal: 16,
    gap: 20,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  headerText: {
    flex: 1,
  },
  tagline: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: T.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 28,
    color: T.ink,
    letterSpacing: -0.5,
    marginTop: 2,
  },

  introCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.primarySoft,
    borderRadius: RADIUS.lg,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(56,120,74,0.15)',
  },
  introIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOW.card,
  },
  introTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 15,
    color: T.primaryInk,
  },
  introDesc: {
    fontFamily: FONTS.sans,
    fontSize: 13,
    color: T.primaryInk,
    lineHeight: 18,
    marginTop: 3,
    opacity: 0.9,
  },

  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.okSoft,
    borderRadius: RADIUS.lg,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(56,140,80,0.2)',
  },
  successEmoji: {
    fontSize: 28,
  },
  successTitle: {
    fontFamily: FONTS.sansBold,
    fontSize: 15,
    color: T.ok,
  },
  successText: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: T.ink2,
    marginTop: 2,
    lineHeight: 16,
  },
  newFeedbackBtn: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    ...SHADOW.card,
  },
  newFeedbackBtnText: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 12,
    color: T.ink,
  },

  section: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: FONTS.sansSemiBold,
    fontSize: 14,
    color: T.ink2,
    marginLeft: 4,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '48.3%',
    backgroundColor: T.surface,
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1.5,
    borderColor: T.line,
    ...SHADOW.card,
  },
  categoryCardActive: {
    borderColor: T.primary,
    backgroundColor: '#fff',
    shadowColor: T.primary,
    shadowOpacity: 0.15,
  },
  catCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  catEmoji: {
    fontSize: 24,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: T.primary,
  },
  catLabel: {
    fontFamily: FONTS.sansBold,
    fontSize: 14,
    color: T.ink,
    marginBottom: 4,
  },
  catLabelActive: {
    color: T.primary,
  },
  catDesc: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: T.mute,
    lineHeight: 15,
  },

  ratingCard: {
    backgroundColor: T.surface,
    borderRadius: RADIUS.md,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.line,
    ...SHADOW.card,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  starBtn: {
    padding: 4,
  },
  starText: {
    fontSize: 34,
  },
  starTextActive: {
    color: '#f59e0b',
  },
  starTextDim: {
    color: '#e2e8f0',
  },
  ratingSub: {
    fontFamily: FONTS.sansMedium,
    fontSize: 13,
    color: T.ink2,
    marginTop: 8,
  },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: RADIUS.md,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  chipText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: T.ink,
  },
  chipPlus: {
    fontFamily: FONTS.sansBold,
    fontSize: 13,
    color: T.primary,
  },

  inputContainer: {
    backgroundColor: T.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: T.line,
    padding: 12,
    ...SHADOW.card,
  },
  textArea: {
    fontFamily: FONTS.sans,
    fontSize: 14,
    color: T.ink,
    minHeight: 110,
    lineHeight: 20,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: T.line,
  },
  charCount: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: T.mute,
  },
  clearText: {
    fontFamily: FONTS.sansMedium,
    fontSize: 12,
    color: T.urgent,
  },


  roadmapCard: {
    backgroundColor: T.surface,
    borderRadius: RADIUS.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: T.line,
    marginTop: 6,
    ...SHADOW.card,
  },
  roadmapHeader: {
    fontFamily: FONTS.sansBold,
    fontSize: 15,
    color: T.ink,
  },
  roadmapSub: {
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: T.mute,
    marginTop: 4,
    marginBottom: 12,
  },
  roadmapList: {
    gap: 10,
  },
  roadmapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roadmapStatusTag: {
    fontFamily: FONTS.sansBold,
    fontSize: 10,
    color: T.primaryInk,
    backgroundColor: T.warnSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
  },
  roadmapText: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: 12,
    color: T.ink2,
    lineHeight: 16,
  },
  roadmapBold: {
    fontFamily: FONTS.sansSemiBold,
    color: T.ink,
  },
});
