import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useProducts } from '@/context/ProductsContext';
import { useAuth } from '@/context/AuthContext';
import { useRecipes } from '@/context/RecipesContext';
import { effectiveDays } from '@/lib/urgency';
import { generateRecipe } from '@/lib/recipeAI';
import FoodTile from '@/components/FoodTile';
import ProfileButton from '@/components/ProfileButton';
import PaywallScreen from '@/components/PaywallScreen';
import { showAlert } from '@/lib/alert';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';
import { Recipe } from '@/types';

// Ricette classiche predefinite come base/fallback
const BASE_RECIPES: Recipe[] = [
  {
    id: 'r1',
    title: 'Frittata di verdure e formaggio',
    time: '20 min',
    difficulty: 'Facile',
    tint: '#e6efde',
    uses: ['Spinaci freschi', 'Uova', 'Parmigiano', 'Zucchine', 'Uova fresche x6', 'Parmigiano 24 mesi'],
    tag: 'Salva ingredienti',
    desc: 'Una frittata morbida e saporita per recuperare verdure, uova e formaggi in dispensa.',
    steps: [
      'Sbatti 3-4 uova in una ciotola con un pizzico di sale, pepe e formaggio grattugiato.',
      'Salta le verdure a cubetti in padella con un filo d\'olio finché non sono tenere.',
      'Versa le uova uniformemente, copri e cuoci a fuoco basso 5-6 minuti per lato.',
    ],
  },
  {
    id: 'r2',
    title: 'Pasta al pomodoro e basilico',
    time: '20 min',
    difficulty: 'Facile',
    tint: '#f4dad0',
    uses: ['Pomodori ciliegia', 'Pasta Penne', 'Olio EVO', 'Pelati San Marzano', 'Pasta'],
    tag: 'Pronta in 20 min',
    desc: 'Il classico primo piatto italiano per esaltare i pomodori maturi in scadenza.',
    steps: [
      'Fai rosolare uno spicchio d\'aglio in olio extravergine, unisci i pomodorini tagliati a metà.',
      'Cuoci a fiamma vivace per 10 minuti fino a ottenere un sughetto profumato.',
      'Scola la pasta al dente e saltala in padella mantecando con parmigiano fresco.',
    ],
  },
  {
    id: 'r3',
    title: 'Risotto saporito alla parmigiana',
    time: '30 min',
    difficulty: 'Media',
    tint: '#f6f0dc',
    uses: ['Riso Arborio', 'Parmigiano 24 mesi', 'Olio EVO', 'Burro'],
    tag: 'Comfort food',
    desc: 'Cremoso, ricco e perfetto per valorizzare riso e formaggi aperti.',
    steps: [
      'Tosta il riso a secco per 2 minuti, poi sfuma con un goccio di vino bianco o brodo caldo.',
      'Aggiungi brodo caldo poco alla volta mescolando con cura.',
      'A fine cottura, spegni il fuoco e manteca vigorosamente con burro freddo e parmigiano.',
    ],
  },
  {
    id: 'r4',
    title: 'Pollo dorato alle erbe',
    time: '25 min',
    difficulty: 'Facile',
    tint: '#f3e9e0',
    uses: ['Pollo a fette', 'Olio EVO', 'Limone'],
    tag: 'Secondo veloce',
    desc: 'Bocconcini o fettine di pollo dorate in padella con profumo di limone ed erbe.',
    steps: [
      'Infarina leggermente il pollo e insaporiscilo con sale ed erbe aromatiche.',
      'Scalda una noce di burro o un cucchiaio d\'olio e rosola il pollo 3-4 minuti per lato.',
      'Sfuma con succo di limone fresco e servi con il suo fondo di cottura.',
    ],
  },
  {
    id: 'r5',
    title: 'Yogurt bowl proteica con frutta',
    time: '5 min',
    difficulty: 'Velocissima',
    tint: '#f1ede0',
    uses: ['Yogurt greco', 'Latte intero', 'Miele', 'Frutta'],
    tag: 'Pronta in 5 min',
    desc: 'L\'opzione più rapida e sana per consumare lo yogurt prima della data di scadenza.',
    steps: [
      'Versa lo yogurt in una ciotola capiente.',
      'Arricchisci con frutta fresca a pezzi, un filo di miele o frutta secca.',
      'Gusta subito a colazione o merenda.',
    ],
  },
];

export default function RecipesScreen() {
  const { products } = useProducts();
  const { user } = useAuth();
  const { saveRecipe } = useRecipes();
  const router = useRouter();

  const [generating, setGenerating] = useState(false);
  const [selectedIngredients, setSelectedIngredients] = useState<string[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);

  // Ingredienti in scadenza (entro 7 giorni o scaduti da pochissimo)
  const expiringProducts = useMemo(() => {
    return products.filter((p) => {
      const d = effectiveDays(p);
      return d <= 7;
    });
  }, [products]);

  // Calcolo delle ricette ordinate per ingredienti combacianti
  const rankedRecipes = useMemo(() => {
    return BASE_RECIPES.map((recipe) => {
      const expiringMatches = recipe.uses.filter((name) =>
        expiringProducts.some((p) =>
          p.name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(p.name.toLowerCase())
        )
      );
      const allMatches = recipe.uses.filter((name) =>
        products.some((p) =>
          p.name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(p.name.toLowerCase())
        )
      );
      return {
        recipe,
        expiringMatches,
        matchCount: expiringMatches.length,
        inPantryCount: allMatches.length,
      };
    }).sort((a, b) => b.matchCount - a.matchCount || b.inPantryCount - a.inPantryCount);
  }, [products, expiringProducts]);

  const featured = rankedRecipes[0]?.recipe;
  const featuredMatches = rankedRecipes[0]?.matchCount ?? 0;
  const otherRecipes = rankedRecipes.slice(1);

  const openRecipe = (recipe: Recipe) => {
    router.push({
      pathname: '/recipe/[id]',
      params: { id: recipe.id, data: JSON.stringify(recipe) },
    });
  };

  const toggleIngredient = (name: string) => {
    setSelectedIngredients((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleGenerateAI = async () => {
    if (!user?.isPremium) {
      setShowPaywall(true);
      return;
    }

    if (products.length === 0) {
      showAlert('Dispensa vuota', 'Aggiungi prima qualche prodotto alla tua dispensa per generare ricette su misura.');
      return;
    }

    const ingredientsToUse = selectedIngredients.length > 0
      ? selectedIngredients
      : expiringProducts.slice(0, 4).map((p) => p.name);

    if (ingredientsToUse.length === 0) {
      showAlert('Nessun ingrediente', 'Seleziona almeno un ingrediente dalla dispensa per l\'AI.');
      return;
    }

    setGenerating(true);
    try {
      const aiRecipe = await generateRecipe(products, ingredientsToUse);
      await saveRecipe(aiRecipe);
      openRecipe(aiRecipe);
    } catch (e: any) {
      showAlert('Generazione non riuscita', e?.message ?? 'Riprova tra poco.');
    } finally {
      setGenerating(false);
    }
  };

  if (showPaywall) {
    return (
      <View style={{ flex: 1, backgroundColor: T.bg }}>
        <TouchableOpacity
          onPress={() => setShowPaywall(false)}
          style={styles.closePaywallBtn}
        >
          <Text style={styles.closePaywallText}>✕</Text>
        </TouchableOpacity>
        <PaywallScreen />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.sub}>Salva il cibo, ispirati</Text>
            <Text style={styles.title}>Ricette per te</Text>
          </View>
          <ProfileButton />
        </View>

        <Text style={styles.intro}>
          Suggerimenti basati su <Text style={{ fontFamily: FONTS.sansBold, color: T.primary }}>{expiringProducts.length}</Text> ingredienti in scadenza nella tua dispensa.
        </Text>

        {/* AI Chef Box */}
        <View style={styles.aiCard}>
          <View style={styles.aiHeader}>
            <View style={styles.aiBadge}>
              <Text style={styles.aiBadgeText}>✦ AI CHEF</Text>
            </View>
            {user?.isPremium && (
              <Text style={styles.aiPremiumActive}>Premium attivo</Text>
            )}
          </View>
          <Text style={styles.aiTitle}>Crea una ricetta su misura</Text>
          <Text style={styles.aiDesc}>
            L'intelligenza artificiale inventa un piatto della tradizione usando esattamente ciò che hai in dispensa.
          </Text>

          {products.length > 0 && (
            <View style={styles.ingredientSelector}>
              <Text style={styles.selectHint}>Tocca gli ingredienti che vuoi includere:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ingredientChips}>
                {products.slice(0, 10).map((p) => {
                  const active = selectedIngredients.includes(p.name);
                  const isExpiring = effectiveDays(p) <= 3;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      onPress={() => toggleIngredient(p.name)}
                      activeOpacity={0.85}
                      style={[
                        styles.ingChip,
                        active && styles.ingChipActive,
                        isExpiring && !active && styles.ingChipExpiring,
                      ]}
                    >
                      <Text style={[styles.ingChipText, active && styles.ingChipTextActive]}>
                        {isExpiring ? '⏰ ' : ''}{p.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <TouchableOpacity
            style={[styles.aiBtn, generating && { opacity: 0.7 }]}
            onPress={handleGenerateAI}
            disabled={generating}
            activeOpacity={0.85}
          >
            {generating ? (
              <ActivityIndicator color="#fbfaf3" />
            ) : (
              <Text style={styles.aiBtnText}>
                {user?.isPremium ? '✨ Genera ricetta con AI' : '🔒 Sblocca Ricette AI (Premium)'}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Featured Recipe */}
        {featured && (
          <View style={styles.featuredWrap}>
            <Text style={styles.sectionLabel}>IN PRIMO PIANO</Text>
            <TouchableOpacity
              style={[styles.featuredCard, { backgroundColor: featured.tint }]}
              onPress={() => openRecipe(featured)}
              activeOpacity={0.88}
            >
              <View style={styles.featuredTop}>
                <View style={styles.featuredBadge}>
                  <Text style={styles.featuredBadgeText}>✨ Suggerita</Text>
                </View>
                {featuredMatches > 0 && (
                  <View style={styles.expiringBadge}>
                    <Text style={styles.expiringBadgeText}>{featuredMatches} in scadenza</Text>
                  </View>
                )}
              </View>

              <Text style={styles.featuredTitle}>{featured.title}</Text>
              <Text style={styles.featuredDesc} numberOfLines={2}>{featured.desc}</Text>

              <View style={styles.featuredMeta}>
                <Text style={styles.metaText}>⏱ {featured.time}</Text>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>🔥 {featured.difficulty}</Text>
              </View>

              <View style={styles.featuredBottom}>
                <View style={styles.ingredientIcons}>
                  {featured.uses.slice(0, 3).map((name, i) => {
                    const p = products.find((pp) => pp.name.toLowerCase().includes(name.toLowerCase()));
                    return (
                      <View key={i} style={[styles.avatarStack, { marginLeft: i === 0 ? 0 : -8 }]}>
                        <FoodTile product={p ?? { name, tint: '#e6efde' }} size={34} radius={10} />
                      </View>
                    );
                  })}
                </View>
                <View style={styles.openBtnPill}>
                  <Text style={styles.openBtnText}>Vedi ricetta ›</Text>
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Other Ideas */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>ALTRE IDEE DALLA DISPENSA</Text>
        <View style={styles.list}>
          {otherRecipes.map(({ recipe, inPantryCount, matchCount }) => (
            <TouchableOpacity
              key={recipe.id}
              style={styles.recipeRow}
              onPress={() => openRecipe(recipe)}
              activeOpacity={0.85}
            >
              <View style={[styles.tileBox, { backgroundColor: recipe.tint }]}>
                <Text style={styles.tileLetter}>{recipe.title.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.recipeRowTitle} numberOfLines={1}>{recipe.title}</Text>
                <View style={styles.recipeRowMeta}>
                  <Text style={styles.metaSub}>⏱ {recipe.time}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaSub}>{inPantryCount}/{recipe.uses.length} in dispensa</Text>
                </View>
              </View>
              {matchCount > 0 && (
                <View style={styles.urgentBadge}>
                  <Text style={styles.urgentBadgeText}>{matchCount} urgente{matchCount > 1 ? 'i' : ''}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 120 },

  headerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4,
  },
  sub: { fontSize: 13, color: T.mute, fontFamily: FONTS.sansMedium },
  title: {
    fontFamily: FONTS.serifItalic, fontSize: 38, color: T.ink,
    letterSpacing: -1, lineHeight: 44, marginTop: 2,
  },
  intro: {
    fontSize: 14, color: T.ink2, paddingHorizontal: 20, marginTop: 4,
    marginBottom: 16, fontFamily: FONTS.sans, lineHeight: 20,
  },

  aiCard: {
    backgroundColor: '#263b28', borderRadius: RADIUS.xl, marginHorizontal: 20,
    padding: 20, marginBottom: 20, ...SHADOW.fab,
  },
  aiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  aiBadge: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  aiBadgeText: { color: '#fbfaf3', fontSize: 10, fontFamily: FONTS.sansBold, letterSpacing: 0.8 },
  aiPremiumActive: { color: '#bdc9ad', fontSize: 12, fontFamily: FONTS.sansMedium },
  aiTitle: { fontFamily: FONTS.serifItalic, fontSize: 26, color: '#fbfaf3', letterSpacing: -0.4 },
  aiDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 6, lineHeight: 18, fontFamily: FONTS.sans },

  ingredientSelector: { marginTop: 14 },
  selectHint: { color: '#bdc9ad', fontSize: 11, fontFamily: FONTS.sansSemiBold, marginBottom: 8 },
  ingredientChips: { gap: 8, paddingBottom: 4 },
  ingChip: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: RADIUS.pill,
    paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  ingChipActive: { backgroundColor: '#fbfaf3', borderColor: '#fbfaf3' },
  ingChipExpiring: { borderColor: '#d9822b' },
  ingChipText: { color: '#fbfaf3', fontSize: 12, fontFamily: FONTS.sansMedium },
  ingChipTextActive: { color: '#1a2018', fontFamily: FONTS.sansBold },

  aiBtn: {
    backgroundColor: '#fbfaf3', borderRadius: RADIUS.pill, paddingVertical: 14,
    alignItems: 'center', marginTop: 16,
  },
  aiBtnText: { color: '#1a2018', fontFamily: FONTS.sansBold, fontSize: 15 },

  featuredWrap: { paddingHorizontal: 20 },
  sectionLabel: {
    fontFamily: FONTS.sansBold, fontSize: 11, color: T.mute,
    letterSpacing: 0.6, paddingHorizontal: 20, marginBottom: 10,
  },
  featuredCard: {
    borderRadius: RADIUS.xl, padding: 20, ...SHADOW.card,
  },
  featuredTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  featuredBadge: {
    backgroundColor: 'rgba(20,28,16,0.85)', borderRadius: RADIUS.pill,
    paddingVertical: 4, paddingHorizontal: 10,
  },
  featuredBadgeText: { color: '#fbfaf3', fontSize: 11, fontFamily: FONTS.sansBold },
  expiringBadge: {
    backgroundColor: 'rgba(255,255,255,0.8)', borderRadius: RADIUS.pill,
    paddingVertical: 4, paddingHorizontal: 10,
  },
  expiringBadgeText: { color: '#1a2018', fontSize: 11, fontFamily: FONTS.sansBold },
  featuredTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 32, color: '#1a2018',
    letterSpacing: -0.5, lineHeight: 34,
  },
  featuredDesc: { fontSize: 13, color: 'rgba(20,28,16,0.75)', marginTop: 8, lineHeight: 18, fontFamily: FONTS.sans },
  featuredMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  metaText: { fontSize: 12, color: 'rgba(20,28,16,0.7)', fontFamily: FONTS.sans },
  metaDot: { color: 'rgba(20,28,16,0.4)', fontSize: 12 },

  featuredBottom: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 18, paddingTop: 14, borderTopWidth: 0.5, borderTopColor: 'rgba(20,28,16,0.12)',
  },
  ingredientIcons: { flexDirection: 'row', alignItems: 'center' },
  avatarStack: { borderWidth: 2, borderColor: '#fff', borderRadius: 12, overflow: 'hidden' },
  openBtnPill: {
    backgroundColor: T.primary, borderRadius: RADIUS.pill,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  openBtnText: { color: '#fbfaf3', fontFamily: FONTS.sansSemiBold, fontSize: 13 },

  list: { paddingHorizontal: 20, gap: 10 },
  recipeRow: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12, ...SHADOW.card,
  },
  tileBox: {
    width: 54, height: 54, borderRadius: 14, alignItems: 'center',
    justifyContent: 'center', flexShrink: 0,
  },
  tileLetter: { fontFamily: FONTS.serifItalic, fontSize: 26, color: 'rgba(20,28,16,0.75)' },
  recipeRowTitle: { fontFamily: FONTS.sansBold, fontSize: 15, color: T.ink },
  recipeRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  metaSub: { fontSize: 12, color: T.mute, fontFamily: FONTS.sans },
  urgentBadge: {
    backgroundColor: T.warnSoft, borderRadius: RADIUS.pill,
    paddingVertical: 4, paddingHorizontal: 8,
  },
  urgentBadgeText: { fontSize: 10, fontFamily: FONTS.sansBold, color: '#4a3414', textTransform: 'uppercase' },

  closePaywallBtn: {
    position: 'absolute', top: 50, right: 20, zIndex: 100,
    width: 36, height: 36, borderRadius: 18, backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.card,
  },
  closePaywallText: { fontSize: 16, color: T.ink, fontFamily: FONTS.sansBold },
});

