import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useRecipes } from '@/context/RecipesContext';
import { showAlert } from '@/lib/alert';
import RecipeDetailView from '@/components/RecipeDetailView';
import Pill from '@/components/Pill';
import { T, FONTS } from '@/constants/theme';

export default function MyRecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { myRecipes, publishMyRecipe, removeMyRecipe } = useRecipes();
  const router = useRouter();

  const recipe = useMemo(() => myRecipes.find((r) => r.id === id) ?? null, [myRecipes, id]);
  const [publishing, setPublishing] = useState(false);

  const handlePublish = () => {
    if (!recipe) return;
    showAlert(
      'Pubblica nella community',
      'La ricetta diventerà visibile a tutti gli utenti di Shelfy, che potranno votarla. Procedo?',
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Pubblica',
          onPress: async () => {
            setPublishing(true);
            try {
              const communityId = await publishMyRecipe(recipe);
              router.replace(`/recipe/${communityId}`);
            } catch (e: any) {
              showAlert('Errore', e?.message ?? 'Pubblicazione non riuscita');
              setPublishing(false);
            }
          },
        },
      ],
    );
  };

  const handleDelete = () => {
    if (!recipe) return;
    showAlert(
      'Elimina ricetta',
      `Vuoi eliminare "${recipe.title}" dalle tue ricette?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Elimina',
          style: 'destructive',
          onPress: async () => {
            await removeMyRecipe(recipe.id);
            router.back();
          },
        },
      ],
    );
  };

  if (!recipe) {
    return (
      <View style={styles.center}>
        <Text style={{ color: T.mute, fontFamily: FONTS.sans }}>Ricetta non trovata.</Text>
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
          <View style={styles.sourceBadge}>
            <Text style={styles.sourceBadgeText}>{recipe.source === 'ai' ? '✦ AI' : 'Mia'}</Text>
          </View>
          <Text style={styles.metaDot}>·</Text>
        </>
      }
      actions={
        <>
          <View style={styles.actionSection}>
            {recipe.published ? (
              <Pill
                variant="ghost"
                size="lg"
                style={{ justifyContent: 'center' }}
                onPress={() => recipe.publishedRecipeId && router.push(`/recipe/${recipe.publishedRecipeId}`)}
              >
                <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 16, color: T.primary }}>
                  ✓ Pubblicata — vedi nella community
                </Text>
              </Pill>
            ) : (
              <Pill
                variant="primary"
                size="lg"
                style={{ justifyContent: 'center' }}
                disabled={publishing}
                onPress={handlePublish}
              >
                {publishing ? (
                  <ActivityIndicator color="#fbfaf3" />
                ) : (
                  <Text style={{ fontFamily: FONTS.sansSemiBold, fontSize: 16, color: '#fbfaf3' }}>
                    ↗ Pubblica nella community
                  </Text>
                )}
              </Pill>
            )}
          </View>
          <View style={styles.actionSection}>
            <TouchableOpacity onPress={handleDelete} activeOpacity={0.85} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>Elimina ricetta</Text>
            </TouchableOpacity>
          </View>
        </>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: T.bg, justifyContent: 'center', alignItems: 'center' },
  metaDot: { color: T.mute, fontSize: 13 },
  sourceBadge: {
    backgroundColor: T.primarySoft, borderRadius: 100, paddingVertical: 3, paddingHorizontal: 9,
  },
  sourceBadgeText: { fontSize: 11, fontFamily: FONTS.sansBold, color: T.primaryInk },
  actionSection: { paddingHorizontal: 20, marginBottom: 12 },
  deleteBtn: { alignItems: 'center', paddingVertical: 10 },
  deleteBtnText: { color: T.warn, fontFamily: FONTS.sansSemiBold, fontSize: 14 },
});
