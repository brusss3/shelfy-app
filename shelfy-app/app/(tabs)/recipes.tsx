import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useProducts } from '@/context/ProductsContext';
import { RECIPES } from '@/constants/recipes';
import { daysTo } from '@/context/ProductsContext';
import FoodTile from '@/components/FoodTile';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

export default function RecipesScreen() {
  const { products } = useProducts();
  const router = useRouter();

  const ranked = RECIPES.map((r) => {
    const expiring = r.uses.filter((name) => {
      const p = products.find((pp) => pp.name === name);
      return p && daysTo(p.expiry) <= 7;
    });
    return { recipe: r, expiring, matchCount: expiring.length };
  }).sort((a, b) => b.matchCount - a.matchCount);

  const featured = ranked[0];
  const rest = ranked.slice(1);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.sub}>Salva il cibo, ispirati</Text>
          <Text style={styles.title}>Ricette per te</Text>
          <Text style={styles.desc}>
            Basate su {featured?.matchCount ?? 0} ingredienti in scadenza nella tua dispensa.
          </Text>
        </View>

        {/* Featured */}
        {featured && (
          <TouchableOpacity
            style={[styles.featured, { backgroundColor: featured.recipe.tint }]}
            onPress={() => router.push(`/recipe/${featured.recipe.id}`)}
            activeOpacity={0.9}
          >
            <View style={styles.featuredHeader}>
              <View style={styles.suggeritaBadge}>
                <Text style={styles.suggeritaText}>✨ Suggerita</Text>
              </View>
              {featured.matchCount > 0 && (
                <View style={styles.matchBadge}>
                  <Text style={styles.matchText}>{featured.matchCount} in scadenza</Text>
                </View>
              )}
            </View>

            <Text style={styles.featuredTitle}>{featured.recipe.title}</Text>
            <Text style={styles.featuredDesc} numberOfLines={2}>{featured.recipe.desc}</Text>

            <View style={styles.featuredMeta}>
              <Text style={styles.metaItem}>⏱ {featured.recipe.time}</Text>
              <Text style={styles.metaItem}>🔥 {featured.recipe.difficulty}</Text>
            </View>

            <View style={styles.featuredFooter}>
              <View style={styles.ingredientStack}>
                {featured.recipe.uses.slice(0, 3).map((name, i) => {
                  const p = products.find((pp) => pp.name === name);
                  return (
                    <View key={i} style={[styles.stackItem, { marginLeft: i === 0 ? 0 : -10 }]}>
                      <FoodTile product={p ?? { name, tint: '#e6efde' }} size={36} radius={12} />
                    </View>
                  );
                })}
              </View>
              <Text style={styles.ingredientCount}>
                {featured.recipe.uses.length} ingredienti dalla tua dispensa
              </Text>
              <View style={styles.openBtn}>
                <Text style={styles.openBtnText}>Apri ›</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Altre idee</Text>
        </View>

        <View style={styles.list}>
          {rest.map(({ recipe, matchCount }) => {
            const inPantry = recipe.uses.filter((n) => products.find((p) => p.name === n)).length;
            return (
              <TouchableOpacity
                key={recipe.id}
                style={styles.recipeRow}
                onPress={() => router.push(`/recipe/${recipe.id}`)}
                activeOpacity={0.85}
              >
                <View style={[styles.recipeTile, { backgroundColor: recipe.tint }]}>
                  <Text style={styles.recipeTileText}>{recipe.title[0]}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.recipeTitle} numberOfLines={1}>{recipe.title}</Text>
                  <Text style={styles.recipeMeta}>⏱ {recipe.time} · {inPantry}/{recipe.uses.length} in dispensa</Text>
                </View>
                {matchCount > 0 && (
                  <View style={styles.urgentBadge}>
                    <Text style={styles.urgentBadgeText}>{matchCount} urgente{matchCount > 1 ? 'i' : ''}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 110 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 14 },
  sub: { fontSize: 13, color: T.mute, fontFamily: FONTS.sansMedium },
  title: {
    fontFamily: FONTS.serifItalic, fontSize: 38, color: T.ink,
    letterSpacing: -1, lineHeight: 44, marginTop: 2,
  },
  desc: { fontSize: 14, color: T.ink2, marginTop: 8, lineHeight: 20, fontFamily: FONTS.sans },

  featured: {
    marginHorizontal: 20, marginBottom: 20, borderRadius: 28, padding: 20,
    shadowColor: 'rgba(40,50,35,1)', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 16, elevation: 6,
  },
  featuredHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8,
  },
  suggeritaBadge: {
    backgroundColor: 'rgba(20,28,16,0.85)', borderRadius: RADIUS.pill,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  suggeritaText: { color: '#fbfaf3', fontSize: 10, fontFamily: FONTS.sansBold, letterSpacing: 0.4 },
  matchBadge: {
    backgroundColor: 'rgba(255,255,255,0.7)', borderRadius: RADIUS.pill,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  matchText: { color: T.ink, fontSize: 11, fontFamily: FONTS.sansBold },
  featuredTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 34, color: T.ink,
    letterSpacing: -0.6, lineHeight: 38, marginTop: 12, marginBottom: 6,
  },
  featuredDesc: { fontSize: 13, color: 'rgba(20,28,16,0.75)', lineHeight: 18, fontFamily: FONTS.sans },
  featuredMeta: { flexDirection: 'row', gap: 14, marginTop: 12 },
  metaItem: { fontSize: 12, color: 'rgba(20,28,16,0.75)', fontFamily: FONTS.sans },
  featuredFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16,
  },
  ingredientStack: { flexDirection: 'row' },
  stackItem: { zIndex: 1 },
  ingredientCount: { flex: 1, fontSize: 12, fontFamily: FONTS.sansSemiBold, color: T.ink },
  openBtn: {
    backgroundColor: T.primary, borderRadius: RADIUS.pill,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  openBtnText: { color: '#fbfaf3', fontSize: 12, fontFamily: FONTS.sansSemiBold },

  sectionHeader: { paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontFamily: FONTS.serifItalic, fontSize: 22, color: T.ink, letterSpacing: -0.3 },

  list: { paddingHorizontal: 20, gap: 10 },
  recipeRow: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 12,
    flexDirection: 'row', gap: 12, alignItems: 'center', ...SHADOW.card,
  },
  recipeTile: {
    width: 64, height: 64, borderRadius: 16, flexShrink: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  recipeTileText: { fontFamily: FONTS.serifItalic, fontSize: 32, color: 'rgba(20,28,16,0.78)' },
  recipeTitle: { fontSize: 15, fontFamily: FONTS.sansBold, color: T.ink, letterSpacing: -0.1 },
  recipeMeta: { fontSize: 12, color: T.mute, marginTop: 4, fontFamily: FONTS.sans },
  urgentBadge: {
    backgroundColor: T.warnSoft, borderRadius: RADIUS.pill,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  urgentBadgeText: { fontSize: 10, fontFamily: FONTS.sansBold, color: '#4a3414', letterSpacing: 0.3 },
});
