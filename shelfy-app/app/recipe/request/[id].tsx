import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { useCommunity } from '@/context/CommunityContext';
import {
  getRecipeRequest, subscribeToProposals, createProposal, getCommunityRecipe,
} from '@/lib/firestore';
import { showAlert } from '@/lib/alert';
import PrimaryButton from '@/components/PrimaryButton';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';
import { CommunityRecipe, RecipeProposal, RecipeRequest } from '@/types';

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { requests, recipes, closeRequest } = useCommunity();
  const router = useRouter();
  const { t } = useTranslation();

  const fromContext = useMemo(() => requests.find((r) => r.id === id) ?? null, [requests, id]);
  const [request, setRequest] = useState<RecipeRequest | null>(fromContext);
  const [loading, setLoading] = useState(!fromContext);
  const [proposals, setProposals] = useState<RecipeProposal[]>([]);
  const [proposalRecipes, setProposalRecipes] = useState<Record<string, CommunityRecipe>>({});
  const [closing, setClosing] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [linking, setLinking] = useState(false);

  useEffect(() => {
    if (fromContext) { setRequest(fromContext); setLoading(false); }
  }, [fromContext]);

  useEffect(() => {
    if (fromContext || !id) return;
    setLoading(true);
    getRecipeRequest(id).then((r) => { setRequest(r); setLoading(false); }).catch(() => setLoading(false));
  }, [id, fromContext]);

  useEffect(() => {
    if (!id) return;
    return subscribeToProposals(id, setProposals);
  }, [id]);

  useEffect(() => {
    proposals.forEach((p) => {
      if (proposalRecipes[p.recipeId]) return;
      const cached = recipes.find((r) => r.id === p.recipeId);
      if (cached) {
        setProposalRecipes((prev) => ({ ...prev, [p.recipeId]: cached }));
      } else {
        getCommunityRecipe(p.recipeId).then((r) => {
          if (r) setProposalRecipes((prev) => ({ ...prev, [p.recipeId]: r }));
        }).catch(() => {});
      }
    });
  }, [proposals, recipes]);

  const isAuthor = !!user && request?.authorId === user.uid;
  const myRecipes = useMemo(
    () => (user ? recipes.filter((r) => r.authorId === user.uid) : []),
    [recipes, user],
  );

  const handleClose = async () => {
    if (!request) return;
    setClosing(true);
    try {
      await closeRequest(request.id);
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('recipeRequestDetail.closeFailed'));
    } finally {
      setClosing(false);
    }
  };

  const handleLinkExisting = async (recipeId: string) => {
    if (!request || !user) return;
    setLinking(true);
    try {
      await createProposal(request.id, {
        recipeId,
        authorId: user.uid,
        authorName: user.displayName ?? t('common.shelfyUser'),
      });
      setPickerVisible(false);
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('recipeRequestDetail.proposeFailed'));
    } finally {
      setLinking(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={T.primary} />
      </View>
    );
  }

  if (!request) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: T.mute, fontFamily: FONTS.sans }}>{t('recipeRequestDetail.notFound')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: Platform.OS === 'ios' ? 60 : 40 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <View style={[styles.statusPill, request.status === 'open' ? styles.statusOpen : styles.statusClosed]}>
            <Text style={[styles.statusPillText, request.status === 'open' ? styles.statusOpenText : styles.statusClosedText]}>
              {request.status === 'open' ? t('recipes.statusOpen') : t('recipes.statusClosed')}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.author}>{t('recipeRequestDetail.asksHelpFor', { name: request.authorName })}</Text>
          <View style={styles.ingredientChipsRow}>
            {request.ingredients.map((name) => (
              <View key={name} style={styles.ingredientChip}>
                <Text style={styles.ingredientChipText}>{name}</Text>
              </View>
            ))}
          </View>
          {!!request.note && <Text style={styles.note}>{request.note}</Text>}
        </View>

        <Text style={styles.sectionTitle}>
          {t('recipeRequestDetail.proposalsTitle')} {proposals.length > 0 ? `(${proposals.length})` : ''}
        </Text>
        <View style={styles.section}>
          {proposals.length === 0 && (
            <Text style={styles.emptyText}>{t('recipeRequestDetail.emptyProposals')}</Text>
          )}
          {proposals.map((p) => {
            const r = proposalRecipes[p.recipeId];
            return (
              <TouchableOpacity
                key={p.id}
                style={styles.proposalCard}
                onPress={() => r && router.push(`/recipe/${r.id}`)}
                activeOpacity={0.85}
                disabled={!r}
              >
                <View style={[styles.tileBox, { backgroundColor: r?.tint ?? '#eceee5' }]}>
                  <Text style={styles.tileLetter}>{(r?.title ?? '?').charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.proposalTitle} numberOfLines={1}>{r?.title ?? t('recipeRequestDetail.loadingTitle')}</Text>
                  <Text style={styles.proposalSub}>{t('recipeRequestDetail.proposedBy', { name: p.authorName })}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {!isAuthor && (
          <View style={styles.section}>
            <PrimaryButton
              onPress={() => router.push({
                pathname: '/recipe/create',
                params: { requestId: request.id, prefillIngredients: JSON.stringify(request.ingredients) },
              })}
              icon="create-outline"
              label={t('recipeRequestDetail.writeNewRecipe')}
              fullWidth
            />
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setPickerVisible(true)}
              activeOpacity={0.85}
              disabled={myRecipes.length === 0}
            >
              <Ionicons name="book-outline" size={17} color={T.primary} style={myRecipes.length === 0 ? { opacity: 0.5 } : undefined} />
              <Text style={[styles.secondaryBtnText, myRecipes.length === 0 && { opacity: 0.5 }]}>
                {t('recipeRequestDetail.proposeMine')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isAuthor && request.status === 'open' && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleClose} disabled={closing} activeOpacity={0.85}>
              {!closing && <Ionicons name="checkmark" size={17} color={T.primary} />}
              <Text style={styles.secondaryBtnText}>{closing ? t('recipeRequestDetail.waiting') : t('recipeRequestDetail.markResolved')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <Modal visible={pickerVisible} transparent animationType="fade" onRequestClose={() => setPickerVisible(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('recipeRequestDetail.pickRecipeTitle')}</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              {myRecipes.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.modalRow}
                  onPress={() => handleLinkExisting(r.id)}
                  disabled={linking}
                  activeOpacity={0.85}
                >
                  <View style={[styles.tileBox, { backgroundColor: r.tint, width: 40, height: 40 }]}>
                    <Text style={[styles.tileLetter, { fontSize: 18 }]}>{r.title.charAt(0).toUpperCase()}</Text>
                  </View>
                  <Text style={styles.modalRowText} numberOfLines={1}>{r.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setPickerVisible(false)} activeOpacity={0.85}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 32 },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 100, backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.card,
  },
  backBtnText: { fontSize: 24, color: T.ink, lineHeight: 28 },

  statusPill: { borderRadius: RADIUS.tag, paddingVertical: 6, paddingHorizontal: 12 },
  statusOpen: { backgroundColor: T.primarySoft },
  statusClosed: { backgroundColor: T.line },
  statusPillText: { fontSize: 11, fontFamily: FONTS.sansBold, textTransform: 'uppercase' },
  statusOpenText: { color: T.primaryInk },
  statusClosedText: { color: T.mute },

  section: { paddingHorizontal: 20, marginBottom: 20, gap: 10 },
  author: { fontSize: 15, fontFamily: FONTS.sansBold, color: T.ink },
  ingredientChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  ingredientChip: {
    backgroundColor: T.surface, borderRadius: RADIUS.md, paddingVertical: 5, paddingHorizontal: 12,
    borderWidth: 1, borderColor: T.line,
  },
  ingredientChipText: { fontSize: 12, fontFamily: FONTS.sansMedium, color: T.ink2 },
  note: { fontSize: 14, color: T.ink2, fontFamily: FONTS.sans, lineHeight: 20 },

  sectionTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 22, color: T.ink, letterSpacing: -0.3,
    paddingHorizontal: 20, marginBottom: 12,
  },
  emptyText: { fontSize: 13, color: T.mute, fontFamily: FONTS.sans },

  proposalCard: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12, ...SHADOW.card,
  },
  tileBox: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileLetter: { fontFamily: FONTS.serifItalic, fontSize: 22, color: 'rgba(20,28,16,0.75)' },
  proposalTitle: { fontFamily: FONTS.sansBold, fontSize: 14, color: T.ink },
  proposalSub: { fontSize: 12, color: T.mute, fontFamily: FONTS.sans, marginTop: 2 },

  secondaryBtn: {
    borderRadius: RADIUS.lg, paddingVertical: 15,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: T.line, marginTop: 10,
  },
  secondaryBtnText: { color: T.primary, fontFamily: FONTS.sansBold, fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: T.surface, borderRadius: 24, padding: 20, width: 320, gap: 12 },
  modalTitle: { fontFamily: FONTS.serifItalic, fontSize: 20, color: T.ink, letterSpacing: -0.3 },
  modalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  modalRowText: { flex: 1, fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.ink },
  modalCancel: { alignItems: 'center', paddingVertical: 10 },
  modalCancelText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.mute },
});
