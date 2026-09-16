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
import { useAuth } from '@/context/AuthContext';
import { submitFeedback, FeedbackCategory } from '@/lib/firestore';
import ProfileButton from '@/components/ProfileButton';
import { showAlert } from '@/lib/alert';
import PrimaryButton from '@/components/PrimaryButton';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

interface CategoryOption {
  id: FeedbackCategory;
  label: string;
  emoji: string;
  desc: string;
  placeholder: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: 'suggerimento',
    label: 'Nuova Idea',
    emoji: '💡',
    desc: 'Funzioni o miglioramenti che vorresti vedere',
    placeholder: 'Descrivi la tua idea o la funzione che renderebbe Shelfy perfetta per te…',
  },
  {
    id: 'bug',
    label: 'Segnala Bug',
    emoji: '🐞',
    desc: 'Problemi grafici, blocchi o errori di funzionamento',
    placeholder: 'Cosa è successo? Su quale schermata? Descrivi i passaggi per riprodurre il problema…',
  },
  {
    id: 'prodotto',
    label: 'Barcode/Cibo',
    emoji: '📦',
    desc: 'Prodotti non riconosciuti o dati incompleti',
    placeholder: 'Indica il codice a barre o il nome del prodotto e i dettagli mancanti…',
  },
  {
    id: 'altro',
    label: 'Altro',
    emoji: '💬',
    desc: 'Domande, complimenti o commenti generali',
    placeholder: 'Scrivi qui qualsiasi tuo pensiero o suggerimento per il team…',
  },
];

const QUICK_TAGS = [
  'Widget per schermata home 📱',
  'Condivisione dispensa in famiglia 👨‍👩‍👧',
  'Filtro allergeni & bio 🌿',
  'Esportazione lista spesa 🛒',
];

const RATING_EMOJIS = ['😡', '😕', '😐', '😊', '🤩'];
const RATING_LABELS = ['Pessima', 'Da migliorare', 'Sufficiente', 'Buona', 'Eccellente!'];

export default function FeedbackScreen() {
  const { user } = useAuth();

  const [category, setCategory] = useState<FeedbackCategory>('suggerimento');
  const [rating, setRating] = useState<number | null>(5);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const activeCategory = CATEGORIES.find((c) => c.id === category) ?? CATEGORIES[0];

  const handleSelectQuickTag = (tag: string) => {
    setMessage((prev) => {
      const clean = tag.replace(/ [^\s]+$/, ''); // remove trailing emoji if needed
      if (!prev.trim()) return `Vorrei suggerire: ${clean}. `;
      if (prev.includes(clean)) return prev;
      return `${prev.trim()} + ${clean}. `;
    });
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      showAlert('Campo obbligatorio', 'Inserisci un messaggio prima di inviare.');
      return;
    }

    if (!user) {
      showAlert('Attenzione', 'Devi aver effettuato l\'accesso per inviare un feedback.');
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

      showAlert('Inviato con successo 🎉', 'Grazie di cuore! Il tuo feedback è stato inviato ed è fondamentale per far crescere Shelfy.');
    } catch (e: any) {
      showAlert('Errore', e?.message ?? 'Errore durante l\'invio. Riprova più tardi.');
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
                <Text style={styles.tagline}>La tua voce conta</Text>
                <Text style={styles.title}>Idee & Feedback</Text>
              </View>
              <ProfileButton />
            </View>

            {/* Intro Banner */}
            <View style={styles.introCard}>
              <View style={styles.introIcon}>
                <Text style={{ fontSize: 26 }}>✨</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.introTitle}>Aiutaci a costruire Shelfy</Text>
                <Text style={styles.introDesc}>
                  Stiamo sviluppando costantemente l'app. Raccontaci quali funzioni ti servono o cosa possiamo migliorare!
                </Text>
              </View>
            </View>

            {/* Success Box if just submitted */}
            {submitted && (
              <View style={styles.successCard}>
                <Text style={styles.successEmoji}>🎉</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>Feedback inviato!</Text>
                  <Text style={styles.successText}>
                    Abbiamo ricevuto la tua segnalazione. Grazie per aiutarci a combattere lo spreco alimentare.
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSubmitted(false)}
                  style={styles.newFeedbackBtn}
                >
                  <Text style={styles.newFeedbackBtnText}>Nuovo</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Step 1: Categoria */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>1. Cosa desideri segnalare?</Text>
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
                        {cat.label}
                      </Text>
                      <Text style={styles.catDesc} numberOfLines={2}>
                        {cat.desc}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Step 2: Valutazione complessiva */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>2. Come valuti la tua esperienza con Shelfy?</Text>
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
                  <Text style={styles.ratingSub}>Tocca una stella per valutare</Text>
                )}
              </View>
            </View>

            {/* Quick Suggestions Chips */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Suggerimenti rapidi più richiesti</Text>
              <View style={styles.chipsWrap}>
                {QUICK_TAGS.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    style={styles.chip}
                    onPress={() => handleSelectQuickTag(tag)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.chipText}>{tag}</Text>
                    <Text style={styles.chipPlus}>+</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Step 3: Messaggio */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>3. Dettagli del tuo messaggio</Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.textArea}
                  value={message}
                  onChangeText={setMessage}
                  placeholder={activeCategory.placeholder}
                  placeholderTextColor={T.mute}
                  multiline
                  numberOfLines={5}
                  textAlignVertical="top"
                />
                <View style={styles.inputFooter}>
                  <Text style={styles.charCount}>
                    {message.length} caratteri
                  </Text>
                  {message.length > 0 && (
                    <TouchableOpacity onPress={() => setMessage('')}>
                      <Text style={styles.clearText}>Cancella</Text>
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
              label="Invia suggerimento"
              fullWidth
            />

            {/* Roadmap / Prossime novità */}
            <View style={styles.roadmapCard}>
              <Text style={styles.roadmapHeader}>🗺️ Roadmap della Community</Text>
              <Text style={styles.roadmapSub}>
                Ecco cosa stiamo preparando grazie ai feedback ricevuti:
              </Text>
              <View style={styles.roadmapList}>
                <View style={styles.roadmapItem}>
                  <Text style={styles.roadmapStatusTag}>In arrivo</Text>
                  <Text style={styles.roadmapText}>
                    👨‍👩‍👧 <Text style={styles.roadmapBold}>Condivisione della dispensa</Text> tra più account (famiglia, coinquilini)
                  </Text>
                </View>
                <View style={styles.roadmapItem}>
                  <Text style={[styles.roadmapStatusTag, { backgroundColor: T.okSoft }]}>Attivo</Text>
                  <Text style={styles.roadmapText}>
                    🍳 <Text style={styles.roadmapBold}>Ricetta del giorno con AI</Text> basata sugli ingredienti in scadenza
                  </Text>
                </View>
                <View style={styles.roadmapItem}>
                  <Text style={[styles.roadmapStatusTag, { backgroundColor: T.okSoft }]}>Attivo</Text>
                  <Text style={styles.roadmapText}>
                    🧾 <Text style={styles.roadmapBold}>Scansione scontrino & data di scadenza</Text> dalla fotocamera
                  </Text>
                </View>
                <View style={styles.roadmapItem}>
                  <Text style={[styles.roadmapStatusTag, { backgroundColor: T.okSoft }]}>Attivo</Text>
                  <Text style={styles.roadmapText}>
                    🔔 <Text style={styles.roadmapBold}>Avvisi e notifiche</Text> per non dimenticare mai un cibo
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
