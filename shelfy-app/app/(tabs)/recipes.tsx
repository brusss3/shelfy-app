import React, { useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useProducts } from '@/context/ProductsContext';
import { useCommunity } from '@/context/CommunityContext';
import { useRecipes } from '@/context/RecipesContext';
import { generateDailyRecipe, AiRecipeError } from '@/lib/aiRecipe';
import { effectiveDays } from '@/lib/urgency';
import { showAlert } from '@/lib/alert';
import ProfileButton from '@/components/ProfileButton';
import PrimaryButton from '@/components/PrimaryButton';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';
import { CommunityRecipe, RecipeRequest } from '@/types';

type View_ = 'recipes' | 'requests' | 'mine';

function matchCount(recipe: CommunityRecipe, expiringNames: string[]): number {
  return recipe.ingredients.filter((ing) =>
    expiringNames.some((name) =>
      name.toLowerCase().includes(ing.name.toLowerCase()) || ing.name.toLowerCase().includes(name.toLowerCase()),
    ),
  ).length;
}

export default function RecipesScreen() {
  const { products } = useProducts();
  const { recipes, requests, loading } = useCommunity();
  const { myRecipes, savedRecipes, aiUsedToday, aiEnabled, refreshAiUsage } = useRecipes();
  const router = useRouter();
  const { t } = useTranslation();
  const [view, setView] = useState<View_>('recipes');

  const expiringProducts = useMemo(
    () => products.filter((p) => effectiveDays(p) <= 7),
    [products],
  );
  const expiringNames = useMemo(() => expiringProducts.map((p) => p.name), [expiringProducts]);

  const openRequests = useMemo(() => requests.filter((r) => r.status === 'open'), [requests]);
  const closedRequests = useMemo(() => requests.filter((r) => r.status === 'closed'), [requests]);

  // ─── Generazione AI ──────────────────────────────────────────────────────
  const [aiSelection, setAiSelection] = useState<string[] | null>(null);
  const [generating, setGenerating] = useState(false);
  const [aiFallback, setAiFallback] = useState<CommunityRecipe[]>([]);

  // Preselezione: i più urgenti in scadenza, al massimo 5.
  const selectedIngredients = aiSelection ?? expiringNames.slice(0, 5);

  const toggleIngredient = (name: string) => {
    const next = selectedIngredients.includes(name)
      ? selectedIngredients.filter((n) => n !== name)
      : [...selectedIngredients, name];
    setAiSelection(next);
  };

  const handleGenerate = async () => {
    if (selectedIngredients.length === 0) {
      showAlert(t('recipes.noIngredientTitle'), t('recipes.noIngredientBody'));
      return;
    }
    setGenerating(true);
    setAiFallback([]);
    try {
      const recipe = await generateDailyRecipe(selectedIngredients);
      await refreshAiUsage();
      router.push(`/recipe/mine/${recipe.id}`);
    } catch (e) {
      const err = e as AiRecipeError;
      if (err.kind === 'quota') await refreshAiUsage();
      // Se l'AI non è disponibile proponiamo ricette della community che usano
      // gli stessi ingredienti, così la richiesta non resta senza risposta.
      if (err.kind === 'unavailable') {
        setAiFallback(
          recipes
            .filter((r) => matchCount(r, selectedIngredients) > 0)
            .slice(0, 5),
        );
      }
      showAlert(t('recipes.aiErrorTitle'), err.message ?? t('recipes.aiErrorFallback'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.sub}>{t('recipes.communitySubtitle')}</Text>
            <Text style={styles.title}>{t('recipes.title')}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              onPress={() => setView('mine')}
              style={styles.aiHeaderBtn}
              activeOpacity={0.85}
              accessibilityLabel={t('recipes.aiHeaderA11y')}
            >
              <Ionicons name="sparkles" size={19} color="#fbfaf3" />
            </TouchableOpacity>
            <ProfileButton />
          </View>
        </View>

        {/* Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'recipes' && styles.toggleBtnActive]}
            onPress={() => setView('recipes')}
            activeOpacity={0.85}
          >
            <Text style={[styles.toggleText, view === 'recipes' && styles.toggleTextActive]}>
              {t('recipes.tabRecipes', { count: recipes.length })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'requests' && styles.toggleBtnActive]}
            onPress={() => setView('requests')}
            activeOpacity={0.85}
          >
            <Text style={[styles.toggleText, view === 'requests' && styles.toggleTextActive]}>
              {t('recipes.tabHelp', { count: openRequests.length })}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === 'mine' && styles.toggleBtnActive]}
            onPress={() => setView('mine')}
            activeOpacity={0.85}
          >
            <Text style={[styles.toggleText, view === 'mine' && styles.toggleTextActive]}>
              {t('recipes.tabMine', { count: myRecipes.length })}
            </Text>
          </TouchableOpacity>
        </View>

        {view === 'recipes' && (
          <>
            <PrimaryButton
              onPress={() => router.push('/recipe/create')}
              icon="add-outline"
              label={t('recipes.newRecipe')}
              containerStyle={styles.primaryBtn}
            />

            {!loading && recipes.length === 0 && (
              <Text style={styles.emptyText}>
                {t('recipes.emptyPublished')}
              </Text>
            )}

            <View style={styles.list}>
              {recipes.map((recipe) => {
                const matches = matchCount(recipe, expiringNames);
                const avg = recipe.ratingCount > 0 ? (recipe.ratingSum / recipe.ratingCount).toFixed(1) : null;
                return (
                  <TouchableOpacity
                    key={recipe.id}
                    style={styles.recipeRow}
                    onPress={() => router.push(`/recipe/${recipe.id}`)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.tileBox, { backgroundColor: recipe.tint }]}>
                      <Text style={styles.tileLetter}>{recipe.title.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.recipeRowTitle} numberOfLines={1}>{recipe.title}</Text>
                      <View style={styles.recipeRowMeta}>
                        <Text style={styles.metaSub}>{t('recipes.byAuthor', { name: recipe.authorName })}</Text>
                        {avg && (
                          <>
                            <Text style={styles.metaDot}>·</Text>
                            <Text style={styles.metaSub}>⭐ {avg}</Text>
                          </>
                        )}
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.metaSub}>⏱ {recipe.time}</Text>
                      </View>
                    </View>
                    {matches > 0 && (
                      <View style={styles.urgentBadge}>
                        <Text style={styles.urgentBadgeText}>{t('recipes.expiringMatch', { count: matches })}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {view === 'requests' && (
          <>
            <PrimaryButton
              onPress={() => router.push('/recipe/request-new')}
              icon="help-buoy-outline"
              label={t('recipes.askHelp')}
              containerStyle={styles.primaryBtn}
            />

            <Text style={styles.introRequests}>
              {t('recipes.requestsIntro')}
            </Text>

            {!loading && requests.length === 0 && (
              <Text style={styles.emptyText}>
                {t('recipes.emptyRequests')}
              </Text>
            )}

            <View style={styles.list}>
              {[...openRequests, ...closedRequests].map((req: RecipeRequest) => (
                <TouchableOpacity
                  key={req.id}
                  style={styles.requestCard}
                  onPress={() => router.push(`/recipe/request/${req.id}`)}
                  activeOpacity={0.85}
                >
                  <View style={styles.requestTop}>
                    <Text style={styles.requestAuthor}>{req.authorName}</Text>
                    <View style={[styles.statusPill, req.status === 'open' ? styles.statusOpen : styles.statusClosed]}>
                      <Text style={[styles.statusPillText, req.status === 'open' ? styles.statusOpenText : styles.statusClosedText]}>
                        {req.status === 'open' ? t('recipes.statusOpen') : t('recipes.statusClosed')}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.ingredientChipsRow}>
                    {req.ingredients.slice(0, 5).map((name) => (
                      <View key={name} style={styles.ingredientChip}>
                        <Text style={styles.ingredientChipText}>{name}</Text>
                      </View>
                    ))}
                  </View>
                  {!!req.note && (
                    <Text style={styles.requestNote} numberOfLines={2}>{req.note}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {view === 'mine' && (
          <>
            {/* Ricetta AI del giorno */}
            <View style={styles.aiCard}>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>{t('recipes.aiDailyBadge')}</Text>
              </View>
              <Text style={styles.aiTitle}>{t('recipes.aiDailyTitle')}</Text>
              <Text style={styles.aiDesc}>
                {t('recipes.aiDailyDesc')}
              </Text>

              {expiringProducts.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.aiChips}>
                  {expiringProducts.map((p) => {
                    const active = selectedIngredients.includes(p.name);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        onPress={() => toggleIngredient(p.name)}
                        activeOpacity={0.85}
                        style={[styles.aiChip, active && styles.aiChipActive]}
                      >
                        <Text style={[styles.aiChipText, active && styles.aiChipTextActive]}>{p.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={styles.aiEmpty}>{t('recipes.aiEmptyIngredients')}</Text>
              )}

              <TouchableOpacity
                style={[styles.aiBtn, (generating || aiUsedToday || !aiEnabled) && { opacity: 0.6 }]}
                onPress={handleGenerate}
                disabled={generating || aiUsedToday || !aiEnabled}
                activeOpacity={0.85}
              >
                {generating ? (
                  <ActivityIndicator color="#1a2018" />
                ) : (
                  <Text style={styles.aiBtnText}>
                    {!aiEnabled
                      ? t('recipes.aiUnavailable')
                      : aiUsedToday
                        ? t('recipes.aiAlreadyToday')
                        : t('recipes.aiGenerate')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            {aiFallback.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>{t('recipes.fromCommunity')}</Text>
                <View style={styles.list}>
                  {aiFallback.map((recipe) => (
                    <TouchableOpacity
                      key={recipe.id}
                      style={styles.recipeRow}
                      onPress={() => router.push(`/recipe/${recipe.id}`)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.tileBox, { backgroundColor: recipe.tint }]}>
                        <Text style={styles.tileLetter}>{recipe.title.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.recipeRowTitle} numberOfLines={1}>{recipe.title}</Text>
                        <Text style={styles.metaSub}>{t('recipes.byAuthor', { name: recipe.authorName })}</Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <Text style={styles.sectionLabel}>{t('recipes.createdByMe')}</Text>
            {myRecipes.length === 0 ? (
              <Text style={styles.emptyText}>
                {t('recipes.emptyMine')}
              </Text>
            ) : (
              <View style={styles.list}>
                {myRecipes.map((recipe) => (
                  <TouchableOpacity
                    key={recipe.id}
                    style={styles.recipeRow}
                    onPress={() => router.push(`/recipe/mine/${recipe.id}`)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.tileBox, { backgroundColor: recipe.tint }]}>
                      <Text style={styles.tileLetter}>{recipe.title.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.recipeRowTitle} numberOfLines={1}>{recipe.title}</Text>
                      <View style={styles.recipeRowMeta}>
                        <Text style={styles.metaSub}>{recipe.source === 'ai' ? '✦ AI' : t('recipes.writtenByYou')}</Text>
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.metaSub}>⏱ {recipe.time}</Text>
                      </View>
                    </View>
                    {recipe.published && (
                      <View style={styles.publishedBadge}>
                        <Text style={styles.publishedBadgeText}>{t('recipes.published')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {savedRecipes.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>{t('recipes.savedFromCommunity')}</Text>
                <View style={styles.list}>
                  {savedRecipes.map((recipe) => (
                    <TouchableOpacity
                      key={recipe.id}
                      style={styles.recipeRow}
                      onPress={() => router.push(`/recipe/${recipe.id}`)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.tileBox, { backgroundColor: recipe.tint }]}>
                        <Text style={styles.tileLetter}>{recipe.title.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.recipeRowTitle} numberOfLines={1}>{recipe.title}</Text>
                        <Text style={styles.metaSub}>
                          {recipe.completed ? t('recipes.alreadyCooked') : t('recipes.byAuthor', { name: recipe.authorName })}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  aiHeaderBtn: {
    width: 42, height: 42, borderRadius: RADIUS.pill,
    backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center',
  },
  sub: { fontSize: 13, color: T.mute, fontFamily: FONTS.sansMedium },
  title: {
    fontFamily: FONTS.serifItalic, fontSize: 38, color: T.ink,
    letterSpacing: -1, lineHeight: 44, marginTop: 2,
  },

  toggleRow: {
    flexDirection: 'row', gap: 8, marginHorizontal: 20, marginTop: 18, marginBottom: 16,
    backgroundColor: T.surface, borderRadius: RADIUS.md, padding: 4, ...SHADOW.card,
  },
  toggleBtn: { flex: 1, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: 'center' },
  toggleBtnActive: { backgroundColor: T.primary },
  toggleText: { fontSize: 13, fontFamily: FONTS.sansSemiBold, color: T.ink2 },
  toggleTextActive: { color: '#fbfaf3' },

  primaryBtn: { marginHorizontal: 20, marginBottom: 16 },

  introRequests: {
    fontSize: 13, color: T.ink2, paddingHorizontal: 20, marginBottom: 16,
    fontFamily: FONTS.sans, lineHeight: 18,
  },

  emptyText: {
    fontSize: 13, color: T.mute, paddingHorizontal: 20, marginBottom: 16,
    fontFamily: FONTS.sans, lineHeight: 18, textAlign: 'center',
  },

  sectionLabel: {
    fontFamily: FONTS.sansBold, fontSize: 11, color: T.mute,
    letterSpacing: 0.6, paddingHorizontal: 20, marginBottom: 10, marginTop: 20,
  },

  aiCard: {
    backgroundColor: '#263b28', borderRadius: RADIUS.xl, marginHorizontal: 20,
    padding: 20, marginBottom: 4, ...SHADOW.fab,
  },
  aiBadge: {
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: RADIUS.tag, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10,
  },
  aiBadgeText: { color: '#fbfaf3', fontSize: 10, fontFamily: FONTS.sansBold, letterSpacing: 0.8 },
  aiTitle: { fontFamily: FONTS.serifItalic, fontSize: 26, color: '#fbfaf3', letterSpacing: -0.4 },
  aiDesc: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 6, lineHeight: 18, fontFamily: FONTS.sans },
  aiChips: { gap: 8, paddingVertical: 14 },
  aiChip: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: RADIUS.md,
    paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  aiChipActive: { backgroundColor: '#fbfaf3', borderColor: '#fbfaf3' },
  aiChipText: { color: '#fbfaf3', fontSize: 12, fontFamily: FONTS.sansMedium },
  aiChipTextActive: { color: '#1a2018', fontFamily: FONTS.sansBold },
  aiEmpty: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: FONTS.sans, marginTop: 12 },
  aiBtn: {
    backgroundColor: '#fbfaf3', borderRadius: RADIUS.lg, paddingVertical: 14,
    alignItems: 'center', marginTop: 12,
  },
  aiBtnText: { color: '#1a2018', fontFamily: FONTS.sansBold, fontSize: 15 },

  publishedBadge: {
    backgroundColor: T.okSoft, borderRadius: RADIUS.tag, paddingVertical: 4, paddingHorizontal: 8,
  },
  publishedBadgeText: { fontSize: 10, fontFamily: FONTS.sansBold, color: '#1b3320', textTransform: 'uppercase' },

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
  recipeRowMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  metaSub: { fontSize: 12, color: T.mute, fontFamily: FONTS.sans },
  metaDot: { color: T.mute, fontSize: 12 },
  urgentBadge: {
    backgroundColor: T.warnSoft, borderRadius: RADIUS.tag,
    paddingVertical: 4, paddingHorizontal: 8,
  },
  urgentBadgeText: { fontSize: 10, fontFamily: FONTS.sansBold, color: '#4a3414', textTransform: 'uppercase' },

  requestCard: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 14, gap: 8, ...SHADOW.card,
  },
  requestTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  requestAuthor: { fontFamily: FONTS.sansBold, fontSize: 14, color: T.ink },
  statusPill: { borderRadius: RADIUS.tag, paddingVertical: 4, paddingHorizontal: 10 },
  statusOpen: { backgroundColor: T.primarySoft },
  statusClosed: { backgroundColor: T.line },
  statusPillText: { fontSize: 10, fontFamily: FONTS.sansBold, textTransform: 'uppercase' },
  statusOpenText: { color: T.primaryInk },
  statusClosedText: { color: T.mute },
  ingredientChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ingredientChip: {
    backgroundColor: T.bg, borderRadius: RADIUS.tag, paddingVertical: 4, paddingHorizontal: 10,
    borderWidth: 1, borderColor: T.line,
  },
  ingredientChipText: { fontSize: 12, fontFamily: FONTS.sansMedium, color: T.ink2 },
  requestNote: { fontSize: 13, color: T.ink2, fontFamily: FONTS.sans, lineHeight: 18 },
});
