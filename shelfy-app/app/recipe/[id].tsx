import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useRecipes } from '@/context/RecipesContext';
import { useCommunity } from '@/context/CommunityContext';
import { getCommunityRecipe, getMyRecipeRating } from '@/lib/firestore';
import { showAlert } from '@/lib/alert';
import RecipeDetailView from '@/components/RecipeDetailView';
import Pill from '@/components/Pill';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';
import { CommunityRecipe } from '@/types';

const STARS = [1, 2, 3, 4, 5];

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { savedRecipes, saveRecipe, markCompleted } = useRecipes();
  const { recipes, rateRecipe, deleteRecipe } = useCommunity();
  const router = useRouter();
  const { t } = useTranslation();

  const fromContext = useMemo(() => recipes.find((r) => r.id === id) ?? null, [recipes, id]);
  const [recipe, setRecipe] = useState<CommunityRecipe | null>(fromContext);
  const [loading, setLoading] = useState(!fromContext);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [rating, setRating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (fromContext) { setRecipe(fromContext); setLoading(false); }
  }, [fromContext]);

  useEffect(() => {
    if (fromContext || !id) return;
    setLoading(true);
    getCommunityRecipe(id).then((r) => { setRecipe(r); setLoading(false); }).catch(() => setLoading(false));
  }, [id, fromContext]);

  useEffect(() => {
    if (!id || !user) return;
    getMyRecipeRating(id, user.uid).then(setMyRating).catch(() => {});
  }, [id, user?.uid]);

  const saved = savedRecipes.find((r) => r.id === recipe?.id);
  const isCompleted = saved?.completed ?? false;
  const isAuthor = !!user && recipe?.authorId === user.uid;
  const avg = recipe && recipe.ratingCount > 0 ? (recipe.ratingSum / recipe.ratingCount).toFixed(1) : null;

  const handleRate = async (value: number) => {
    if (!recipe || rating) return;
    setRating(true);
    try {
      await rateRecipe(recipe.id, value);
      setRecipe((r) => r ? {
        ...r,
        ratingSum: myRating === null ? r.ratingSum + value : r.ratingSum - myRating + value,
        ratingCount: myRating === null ? r.ratingCount + 1 : r.ratingCount,
      } : r);
      setMyRating(value);
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('recipeDetail.rateFailed'));
    } finally {
      setRating(false);
    }
  };

  const handleSave = async () => {
    if (!recipe) return;
    try {
      await saveRecipe(recipe);
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('recipeDetail.saveFailed'));
    }
  };

  const handleDelete = async () => {
    if (!recipe) return;
    setDeleting(true);
    try {
      await deleteRecipe(recipe.id);
      router.back();
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('recipeDetail.deleteFailed'));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={T.primary} />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.center}>
        <Text style={{ color: T.mute, fontFamily: FONTS.sans }}>{t('recipeDetail.notFound')}</Text>
      </View>
    );
  }

  return (
    <RecipeDetailView
      title={recipe.title}
      tint={recipe.tint}
      desc={recipe.desc}
      time={recipe.time}
      difficulty={recipe.difficulty}
      ingredients={recipe.ingredients}
      steps={recipe.steps}
      meta={
        <>
          <Text style={styles.metaItem}>{t('recipes.byAuthor', { name: recipe.authorName })}</Text>
          <Text style={styles.metaDot}>·</Text>
        </>
      }
      beforeIngredients={
        <View style={styles.ratingCard}>
          <View>
            <Text style={styles.ratingAvg}>{avg ? `⭐ ${avg}` : t('recipeDetail.noRatingYet')}</Text>
            <Text style={styles.ratingCountText}>
              {t('recipeDetail.voteCount', { count: recipe.ratingCount })}
            </Text>
          </View>
          <View style={styles.starsRow}>
            {STARS.map((s) => (
              <TouchableOpacity key={s} onPress={() => handleRate(s)} disabled={rating} activeOpacity={0.7}>
                <Text style={[styles.star, myRating !== null && s <= myRating && styles.starActive]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      }
      actions={
        <>
          <View style={styles.actionSection}>
            <Pill
              variant={isCompleted ? 'ghost' : 'primary'}
              size="lg"
              style={{ justifyContent: 'center' }}
              disabled={isCompleted}
              onPress={saved ? () => markCompleted(recipe.id) : handleSave}
            >
              <Text style={{
                fontFamily: FONTS.sansSemiBold, fontSize: 16,
                color: isCompleted ? T.primary : '#fbfaf3',
              }}>
                {isCompleted ? t('recipes.alreadyCooked') : saved ? t('recipeDetail.markCooked') : t('recipeDetail.saveRecipe')}
              </Text>
            </Pill>
          </View>
          {isAuthor && (
            <View style={styles.actionSection}>
              <TouchableOpacity onPress={handleDelete} disabled={deleting} activeOpacity={0.85} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>{deleting ? t('recipeDetail.deleting') : t('recipeDetail.deleteRecipe')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' },
  metaItem: { fontSize: 13, color: T.ink2, fontFamily: FONTS.sans },
  metaDot: { color: T.mute, fontSize: 13 },

  ratingCard: {
    marginHorizontal: 20, marginBottom: 20, backgroundColor: T.surface, borderRadius: RADIUS.lg,
    padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', ...SHADOW.card,
  },
  ratingAvg: { fontFamily: FONTS.sansBold, fontSize: 16, color: T.ink },
  ratingCountText: { fontSize: 12, color: T.mute, fontFamily: FONTS.sans, marginTop: 2 },
  starsRow: { flexDirection: 'row', gap: 4 },
  star: { fontSize: 24, color: T.line },
  starActive: { color: '#d9822b' },

  actionSection: { paddingHorizontal: 20, marginBottom: 12 },
  deleteBtn: { alignItems: 'center', paddingVertical: 10 },
  deleteBtnText: { color: T.warn, fontFamily: FONTS.sansSemiBold, fontSize: 14 },
});
