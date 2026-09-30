import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import { useRecipes } from '@/context/RecipesContext';
import { parseRecipeJson, RecipeImportError, ImportedRecipe } from '@/lib/recipePrompt';
import { showAlert } from '@/lib/alert';
import PrimaryButton from '@/components/PrimaryButton';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

type ParseState =
  | { kind: 'empty' }
  | { kind: 'ok'; recipes: ImportedRecipe[] }
  | { kind: 'error'; message: string };

export default function ImportRecipeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { addMyRecipe } = useRecipes();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  // Validazione live: l'utente vede subito se il testo incollato è buono,
  // prima di premere Salva.
  const parsed = useMemo<ParseState>(() => {
    if (!text.trim()) return { kind: 'empty' };
    try {
      return { kind: 'ok', recipes: parseRecipeJson(text) };
    } catch (e) {
      return {
        kind: 'error',
        message: e instanceof RecipeImportError ? e.message : t('recipeImport.errors.invalidJson'),
      };
    }
  }, [text, t]);

  const handlePaste = async () => {
    const value = await Clipboard.getStringAsync().catch(() => '');
    if (value) setText(value);
    else showAlert(t('recipeImport.clipboardEmptyTitle'), t('recipeImport.clipboardEmptyBody'));
  };

  const handleSave = async () => {
    if (parsed.kind !== 'ok') return;
    setSaving(true);
    try {
      const ids: string[] = [];
      for (const recipe of parsed.recipes) ids.push(await addMyRecipe(recipe));
      if (ids.length === 1) router.replace(`/recipe/mine/${ids[0]}`);
      else router.back();
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('recipeImport.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const count = parsed.kind === 'ok' ? parsed.recipes.length : 0;

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
          <Text style={styles.headerTitle}>{t('recipeImport.title')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.intro}>{t('recipeImport.intro')}</Text>

        <View style={styles.inputCard}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={t('recipeImport.placeholder')}
            placeholderTextColor={T.mute}
            multiline
            autoCorrect={false}
            autoCapitalize="none"
            textAlignVertical="top"
          />
        </View>

        <View style={styles.inlineActions}>
          <TouchableOpacity style={styles.inlineBtn} onPress={handlePaste} activeOpacity={0.85}>
            <Text style={styles.inlineBtnText}>{t('recipeImport.paste')}</Text>
          </TouchableOpacity>
          {text.length > 0 && (
            <TouchableOpacity style={styles.inlineBtn} onPress={() => setText('')} activeOpacity={0.85}>
              <Text style={styles.inlineBtnText}>{t('recipeImport.clear')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {parsed.kind === 'error' && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{parsed.message}</Text>
          </View>
        )}

        {parsed.kind === 'ok' && (
          <>
            <Text style={styles.sectionLabel}>{t('recipeImport.previewSection', { count })}</Text>
            <View style={styles.list}>
              {parsed.recipes.map((recipe, i) => (
                <View key={i} style={styles.recipeRow}>
                  <View style={[styles.tileBox, { backgroundColor: recipe.tint }]}>
                    <Text style={styles.tileLetter}>{recipe.title.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.recipeRowTitle} numberOfLines={1}>{recipe.title}</Text>
                    <Text style={styles.metaSub}>
                      {t('recipeImport.previewMeta', {
                        time: recipe.time,
                        ingredients: recipe.ingredients.length,
                        steps: recipe.steps.length,
                      })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <PrimaryButton
          onPress={handleSave}
          disabled={parsed.kind !== 'ok'}
          loading={saving}
          icon="checkmark"
          label={count > 1 ? t('recipeImport.saveMany', { count }) : t('recipeImport.saveOne')}
          containerStyle={{ flex: 1.8 }}
        />
      </View>
    </View>
  );
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

  intro: {
    fontSize: 13, color: T.ink2, fontFamily: FONTS.sans, lineHeight: 18,
    marginHorizontal: 20, marginBottom: 14,
  },

  inputCard: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, marginHorizontal: 16,
    padding: 14, ...SHADOW.card,
  },
  input: {
    minHeight: 200, maxHeight: 360, fontFamily: FONTS.sans, fontSize: 13,
    color: T.ink, padding: 0, lineHeight: 18,
  },

  inlineActions: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 10, marginBottom: 16 },
  inlineBtn: {
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: T.line,
    paddingVertical: 10, paddingHorizontal: 14,
  },
  inlineBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.primary },

  errorBox: {
    backgroundColor: T.warnSoft, borderRadius: RADIUS.md, marginHorizontal: 16,
    padding: 12, marginBottom: 16,
  },
  errorText: { fontSize: 13, color: '#4a3414', fontFamily: FONTS.sansMedium, lineHeight: 18 },

  sectionLabel: {
    fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.6,
    marginHorizontal: 20, marginBottom: 8,
  },
  list: { paddingHorizontal: 16, gap: 10 },
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
  metaSub: { fontSize: 12, color: T.mute, fontFamily: FONTS.sans, marginTop: 3 },

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
