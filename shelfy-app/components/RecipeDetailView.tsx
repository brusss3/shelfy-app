import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useProducts, daysTo } from '@/context/ProductsContext';
import FoodTile from '@/components/FoodTile';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';
import { RecipeIngredient } from '@/types';

interface Props {
  title: string;
  tint: string;
  desc: string;
  time: string;
  difficulty: string;
  ingredients: RecipeIngredient[];
  steps: string[];
  /** Riga di meta extra sopra la descrizione (autore, badge AI…). */
  meta?: React.ReactNode;
  /** Blocco inserito tra descrizione e ingredienti (es. widget rating). */
  beforeIngredients?: React.ReactNode;
  /** Azioni in fondo alla schermata. */
  actions?: React.ReactNode;
}

// Corpo comune del dettaglio ricetta: usato sia dalle ricette della community
// sia da quelle personali, che cambiano solo meta e azioni.
export default function RecipeDetailView({
  title, tint, desc, time, difficulty, ingredients, steps, meta, beforeIngredients, actions,
}: Props) {
  const { products } = useProducts();
  const router = useRouter();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: tint }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.heroTitle}>{title}</Text>
        </View>

        <View style={styles.metaRow}>
          {meta}
          <Text style={styles.metaItem}>⏱ {time}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaItem}>🔥 {difficulty}</Text>
        </View>
        {!!desc && <Text style={styles.desc}>{desc}</Text>}

        {beforeIngredients}

        <Text style={styles.sectionTitle}>Ingredienti</Text>
        <View style={styles.section}>
          {ingredients.map((ing, i) => {
            const p = products.find((pp) => pp.name.toLowerCase() === ing.name.toLowerCase());
            const days = p ? daysTo(p.expiry) : null;
            return (
              <View key={`${ing.name}-${i}`} style={styles.ingredientCard}>
                <FoodTile product={p ?? { name: ing.name, tint: '#eceee5' }} size={42} radius={12} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.ingredientName}>{ing.name}</Text>
                  <Text style={styles.ingredientSub}>
                    {ing.qty}{p ? ' · in dispensa' : ''}
                  </Text>
                </View>
                {p && (
                  <View style={[styles.statusBadge, { backgroundColor: days! <= 3 ? T.warnSoft : T.okSoft }]}>
                    <Text style={{ fontSize: 11, fontFamily: FONTS.sansBold, color: days! <= 3 ? '#4a3414' : '#1b3320' }}>
                      {days! <= 3 ? 'usa subito' : 'ok'}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Procedimento</Text>
        <View style={styles.section}>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepCard}>
              <View style={styles.stepNum}>
                <Text style={styles.stepNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>

        {actions}

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 32 },

  hero: { height: 240, position: 'relative', justifyContent: 'flex-end', padding: 24 },
  backBtn: {
    position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 16,
    width: 40, height: 40, borderRadius: 100, backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.card,
  },
  backBtnText: { fontSize: 24, color: T.ink, lineHeight: 28 },
  heroTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 36, color: '#1a2018',
    letterSpacing: -0.6, lineHeight: 40,
  },

  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    paddingHorizontal: 20, paddingTop: 16, marginBottom: 8,
  },
  metaItem: { fontSize: 13, color: T.ink2, fontFamily: FONTS.sans },
  metaDot: { color: T.mute, fontSize: 13 },
  desc: {
    fontSize: 14, color: T.ink2, lineHeight: 20,
    paddingHorizontal: 20, marginBottom: 16, fontFamily: FONTS.sans,
  },

  sectionTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 22, color: T.ink, letterSpacing: -0.3,
    paddingHorizontal: 20, marginBottom: 12,
  },
  section: { paddingHorizontal: 20, gap: 8, marginBottom: 20 },

  ingredientCard: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12, ...SHADOW.card,
  },
  ingredientName: { fontSize: 14, fontFamily: FONTS.sansSemiBold, color: T.ink },
  ingredientSub: { fontSize: 11, color: T.mute, marginTop: 2, fontFamily: FONTS.sans },
  statusBadge: { borderRadius: RADIUS.pill, paddingVertical: 4, paddingHorizontal: 9 },

  stepCard: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 14,
    flexDirection: 'row', gap: 14, alignItems: 'flex-start', ...SHADOW.card,
  },
  stepNum: {
    width: 30, height: 30, borderRadius: 100, backgroundColor: T.primary,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  stepNumText: { fontFamily: FONTS.serifItalic, fontSize: 17, color: '#fbfaf3' },
  stepText: { fontSize: 14, color: T.ink, lineHeight: 20, flex: 1, fontFamily: FONTS.sans },
});
