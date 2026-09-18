import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useCommunity } from '@/context/CommunityContext';
import { useRecipes } from '@/context/RecipesContext';
import { createProposal } from '@/lib/firestore';
import { showAlert } from '@/lib/alert';
import PrimaryButton from '@/components/PrimaryButton';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';
import { RecipeIngredient } from '@/types';

const TINTS = ['#e6efde', '#f1ede0', '#f3e9e0', '#f4e9c8', '#e8dcc6', '#eceee5', '#f4dad0', '#e6dfd1'];
const DIFFICULTIES = ['Facile', 'Media', 'Difficile'];

export default function CreateRecipeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { createRecipe } = useCommunity();
  const { addMyRecipe } = useRecipes();
  const params = useLocalSearchParams<{ requestId?: string; prefillIngredients?: string }>();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const prefill: string[] = params.prefillIngredients ? JSON.parse(params.prefillIngredients) : [];

  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [time, setTime] = useState('20 min');
  const [difficulty, setDifficulty] = useState('Facile');
  const [tag, setTag] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    prefill.length > 0 ? prefill.map((name) => ({ name, qty: '' })) : [{ name: '', qty: '' }],
  );
  const [steps, setSteps] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  // Rispondere a una richiesta d'aiuto implica per forza la pubblicazione.
  const [publish, setPublish] = useState(!!params.requestId);

  const updateIngredient = (i: number, field: 'name' | 'qty', value: string) => {
    setIngredients((prev) => prev.map((ing, idx) => (idx === i ? { ...ing, [field]: value } : ing)));
  };
  const removeIngredient = (i: number) => setIngredients((prev) => prev.filter((_, idx) => idx !== i));
  const addIngredient = () => setIngredients((prev) => [...prev, { name: '', qty: '' }]);

  const updateStep = (i: number, value: string) => {
    setSteps((prev) => prev.map((s, idx) => (idx === i ? value : s)));
  };
  const removeStep = (i: number) => setSteps((prev) => prev.filter((_, idx) => idx !== i));
  const addStep = () => setSteps((prev) => [...prev, '']);

  const validIngredients = ingredients.filter((i) => i.name.trim().length > 0);
  const validSteps = steps.filter((s) => s.trim().length > 0);
  const canSave = title.trim().length > 0 && validIngredients.length > 0 && validSteps.length > 0;

  const handleSave = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    try {
      const tint = TINTS[Math.floor(Math.random() * TINTS.length)];
      const payload = {
        title: title.trim(),
        desc: desc.trim(),
        time: time.trim() || '20 min',
        difficulty,
        tag: tag.trim() || difficulty,
        tint,
        ingredients: validIngredients.map((i) => ({ name: i.name.trim(), qty: i.qty.trim() })),
        steps: validSteps.map((s) => s.trim()),
      };

      if (!publish) {
        const myId = await addMyRecipe({ ...payload, source: 'manual' });
        router.replace(`/recipe/mine/${myId}`);
        return;
      }

      const recipeId = await createRecipe(payload);

      if (params.requestId) {
        await createProposal(params.requestId, {
          recipeId,
          authorId: user.uid,
          authorName: user.displayName ?? t('common.shelfyUser'),
        });
        router.replace(`/recipe/request/${params.requestId}`);
      } else {
        router.replace(`/recipe/${recipeId}`);
      }
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('recipeCreate.publishFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {params.requestId ? t('recipeCreate.titlePropose') : t('recipeCreate.titleNew')}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.card}>
          <FieldRow label={t('recipeCreate.fields.title')}>
            <TextInput
              style={styles.input}
              value={title}
              onChangeText={setTitle}
              placeholder={t('recipeCreate.fields.titlePlaceholder')}
              placeholderTextColor={T.mute}
            />
          </FieldRow>
          <Divider />
          <FieldRow label={t('recipeCreate.fields.desc')}>
            <TextInput
              style={styles.input}
              value={desc}
              onChangeText={setDesc}
              placeholder={t('recipeCreate.fields.descPlaceholder')}
              placeholderTextColor={T.mute}
            />
          </FieldRow>
          <Divider />
          <FieldRow label={t('recipeCreate.fields.time')}>
            <TextInput
              style={styles.input}
              value={time}
              onChangeText={setTime}
              placeholder={t('recipeCreate.fields.timePlaceholder')}
              placeholderTextColor={T.mute}
            />
          </FieldRow>
          <Divider />
          <FieldRow label={t('recipeCreate.fields.tag')}>
            <TextInput
              style={styles.input}
              value={tag}
              onChangeText={setTag}
              placeholder={t('recipeCreate.fields.tagPlaceholder')}
              placeholderTextColor={T.mute}
            />
          </FieldRow>
        </View>

        <Text style={styles.sectionLabel}>{t('recipeCreate.difficultySection')}</Text>
        <View style={styles.chipRow}>
          {DIFFICULTIES.map((d) => {
            const active = difficulty === d;
            return (
              <TouchableOpacity
                key={d}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setDifficulty(d)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{d}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!params.requestId && (
          <>
            <Text style={styles.sectionLabel}>{t('recipeCreate.visibilitySection')}</Text>
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[styles.chip, !publish && styles.chipActive]}
                onPress={() => setPublish(false)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, !publish && styles.chipTextActive]}>{t('recipeCreate.onlyMe')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, publish && styles.chipActive]}
                onPress={() => setPublish(true)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, publish && styles.chipTextActive]}>{t('recipeCreate.community')}</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.visibilityHint}>
              {publish
                ? t('recipeCreate.visibilityHintPublish')
                : t('recipeCreate.visibilityHintPrivate')}
            </Text>
          </>
        )}

        <Text style={styles.sectionLabel}>{t('recipeCreate.ingredientsSection')}</Text>
        <View style={styles.rowsWrap}>
          {ingredients.map((ing, i) => (
            <View key={i} style={styles.ingredientRow}>
              <TextInput
                style={styles.ingredientNameInput}
                value={ing.name}
                onChangeText={(v) => updateIngredient(i, 'name', v)}
                placeholder={t('recipeCreate.ingredientPlaceholder')}
                placeholderTextColor={T.mute}
              />
              <TextInput
                style={styles.ingredientQtyInput}
                value={ing.qty}
                onChangeText={(v) => updateIngredient(i, 'qty', v)}
                placeholder={t('recipeCreate.qtyPlaceholder')}
                placeholderTextColor={T.mute}
              />
              <TouchableOpacity onPress={() => removeIngredient(i)} style={styles.rowDeleteBtn} activeOpacity={0.85}>
                <Text style={styles.rowDeleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addRowBtn} onPress={addIngredient} activeOpacity={0.85}>
            <Text style={styles.addRowBtnText}>{t('recipeCreate.addIngredient')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionLabel}>{t('recipeCreate.stepsSection')}</Text>
        <View style={styles.rowsWrap}>
          {steps.map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <Text style={styles.stepRowNum}>{i + 1}</Text>
              <TextInput
                style={styles.stepInput}
                value={step}
                onChangeText={(v) => updateStep(i, v)}
                placeholder={t('recipeCreate.stepPlaceholder', { n: i + 1 })}
                placeholderTextColor={T.mute}
                multiline
              />
              <TouchableOpacity onPress={() => removeStep(i)} style={styles.rowDeleteBtn} activeOpacity={0.85}>
                <Text style={styles.rowDeleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity style={styles.addRowBtn} onPress={addStep} activeOpacity={0.85}>
            <Text style={styles.addRowBtnText}>{t('recipeCreate.addStep')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <PrimaryButton
          onPress={handleSave}
          disabled={!canSave}
          loading={saving}
          icon="checkmark"
          label={publish ? t('recipeCreate.publish') : t('recipeCreate.save')}
          containerStyle={{ flex: 1.8 }}
        />
      </View>
    </View>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

function Divider() {
  return <View style={{ height: 0.5, backgroundColor: T.line, marginLeft: 16 }} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 20 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 100, backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.card,
  },
  closeBtnText: { fontSize: 18, color: T.ink },
  headerTitle: { fontSize: 14, fontFamily: FONTS.sansSemiBold, color: T.ink2 },

  card: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg,
    marginHorizontal: 16, overflow: 'hidden', marginBottom: 12, ...SHADOW.card,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  fieldLabel: { fontSize: 13, fontFamily: FONTS.sansSemiBold, color: T.ink2, width: 90 },
  input: { flex: 1, fontFamily: FONTS.sans, fontSize: 15, color: T.ink, padding: 0, fontWeight: '500' },

  sectionLabel: {
    fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.6,
    marginHorizontal: 20, marginBottom: 8, marginTop: 4,
  },

  chipRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 20 },
  chip: {
    flex: 1, backgroundColor: T.surface, borderRadius: RADIUS.md,
    paddingVertical: 12, alignItems: 'center', ...SHADOW.card,
  },
  chipActive: { backgroundColor: T.primary },
  chipText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink },
  chipTextActive: { color: '#fbfaf3' },
  visibilityHint: {
    fontSize: 12, color: T.mute, fontFamily: FONTS.sans,
    marginHorizontal: 20, marginTop: -12, marginBottom: 20, lineHeight: 16,
  },

  rowsWrap: { paddingHorizontal: 16, gap: 8, marginBottom: 20 },
  ingredientRow: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, ...SHADOW.card,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  ingredientNameInput: { flex: 1.6, fontFamily: FONTS.sans, fontSize: 14, color: T.ink, padding: 0 },
  ingredientQtyInput: { flex: 1, fontFamily: FONTS.sans, fontSize: 13, color: T.ink2, padding: 0, textAlign: 'right' },

  stepRow: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, ...SHADOW.card,
    flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 12, paddingVertical: 10, gap: 10,
  },
  stepRowNum: {
    fontFamily: FONTS.serifItalic, fontSize: 16, color: T.primary, width: 18, marginTop: 2,
  },
  stepInput: { flex: 1, fontFamily: FONTS.sans, fontSize: 14, color: T.ink, padding: 0, lineHeight: 19 },

  rowDeleteBtn: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: T.warnSoft,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  rowDeleteText: { fontSize: 12, color: T.warn, fontFamily: FONTS.sansBold },

  addRowBtn: {
    borderRadius: RADIUS.lg, borderWidth: 1, borderColor: T.line, borderStyle: 'dashed',
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  addRowBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.primary },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 16,
    backgroundColor: T.bg, borderTopWidth: 0.5, borderTopColor: T.line,
  },
  cancelBtn: {
    flex: 1, borderRadius: RADIUS.lg, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: T.line,
  },
  cancelBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 16, color: T.primary },
});
