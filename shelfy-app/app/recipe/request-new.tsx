import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useProducts } from '@/context/ProductsContext';
import { useCommunity } from '@/context/CommunityContext';
import { showAlert } from '@/lib/alert';
import PrimaryButton from '@/components/PrimaryButton';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

// Richiesta d'aiuto: l'utente seleziona ingredienti dalla propria dispensa
// (preselezionati quelli in scadenza) e chiede alla community un'idea.
export default function RequestNewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { products } = useProducts();
  const { createRequest } = useCommunity();
  const { t } = useTranslation();

  const expiringIds = useMemo(() => {
    const now = Date.now();
    return new Set(
      products.filter((p) => (new Date(p.expiry).getTime() - now) <= 7 * 86400000).map((p) => p.id),
    );
  }, [products]);

  const [selected, setSelected] = useState<Set<string>>(new Set(expiringIds));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedNames = products.filter((p) => selected.has(p.id)).map((p) => p.name);
  const canSave = selectedNames.length > 0;

  const handleSave = async () => {
    if (!canSave) {
      showAlert(t('common.error'), t('recipeRequest.missingIngredientError'));
      return;
    }
    setSaving(true);
    try {
      const id = await createRequest({ ingredients: selectedNames, note: note.trim() });
      router.replace(`/recipe/request/${id}`);
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('recipeRequest.publishFailed'));
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
          <Text style={styles.headerTitle}>{t('recipeRequest.headerTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.intro}>
          {t('recipeRequest.intro')}
        </Text>

        {products.length === 0 ? (
          <Text style={styles.emptyText}>{t('recipeRequest.emptyProducts')}</Text>
        ) : (
          <View style={styles.chipsWrap}>
            {products.map((p) => {
              const active = selected.has(p.id);
              const isExpiring = expiringIds.has(p.id);
              return (
                <TouchableOpacity
                  key={p.id}
                  onPress={() => toggle(p.id)}
                  activeOpacity={0.85}
                  style={[styles.chip, active && styles.chipActive, isExpiring && !active && styles.chipExpiring]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {isExpiring ? '⏰ ' : ''}{p.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.sectionLabel}>{t('recipeRequest.noteSection')}</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder={t('recipeRequest.notePlaceholder')}
            placeholderTextColor={T.mute}
            multiline
          />
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
          icon="help-buoy-outline"
          label={t('recipeRequest.publishRequest')}
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
    fontSize: 14, color: T.ink2, paddingHorizontal: 20, marginBottom: 16,
    fontFamily: FONTS.sans, lineHeight: 20,
  },
  emptyText: {
    fontSize: 13, color: T.mute, paddingHorizontal: 20, marginBottom: 16,
    fontFamily: FONTS.sans, lineHeight: 18,
  },

  chipsWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 20,
  },
  chip: {
    backgroundColor: T.surface, borderRadius: RADIUS.md, paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: T.line,
  },
  chipActive: { backgroundColor: T.primary, borderColor: T.primary },
  chipExpiring: { borderColor: '#d9822b' },
  chipText: { fontSize: 13, fontFamily: FONTS.sansSemiBold, color: T.ink2 },
  chipTextActive: { color: '#fbfaf3' },

  sectionLabel: {
    fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.6,
    marginHorizontal: 20, marginBottom: 8,
  },
  card: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, marginHorizontal: 16,
    padding: 14, ...SHADOW.card,
  },
  noteInput: { fontFamily: FONTS.sans, fontSize: 14, color: T.ink, minHeight: 60, textAlignVertical: 'top' },

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
