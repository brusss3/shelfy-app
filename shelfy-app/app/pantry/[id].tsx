import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
  TextInput, Share, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { usePantry } from '@/context/PantryContext';
import { subscribeToPantry, subscribeToPantryInvite } from '@/lib/pantry';
import { Pantry, PantryInvite } from '@/types';
import PrimaryButton from '@/components/PrimaryButton';
import Pill from '@/components/Pill';
import { showAlert } from '@/lib/alert';
import {
  T, FONTS, RADIUS, CLAY,
} from '@/constants/theme';

export default function PantryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();

  const shortDate = (iso: string | null): string => {
    if (!iso) return '';
    const d = new Date(iso);
    const locale = i18n.language === 'it' ? 'it-IT' : 'en-US';
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  };
  const {
    activePantryId, setActivePantryId, renamePantry, rotateInviteCode,
    disableInviteCode, leavePantry, removeMember, deletePantry,
  } = usePantry();

  const [pantry, setPantry] = useState<Pantry | null | undefined>(undefined);
  const [invite, setInvite] = useState<PantryInvite | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    return subscribeToPantry(id, setPantry, () => setPantry(null));
  }, [id]);

  const isOwner = !!pantry && !!user && pantry.ownerId === user.uid;

  useEffect(() => {
    if (!id || !isOwner) { setInvite(null); return; }
    return subscribeToPantryInvite(id, setInvite, (e) => console.warn('[pantry] invito:', e));
  }, [id, isOwner]);

  // Rimosso/uscito mentre la schermata è aperta: non c'è più niente da
  // mostrare, si torna indietro da soli.
  useEffect(() => {
    if (pantry === null) router.back();
  }, [pantry]);

  if (pantry === undefined) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <ActivityIndicator color={T.primary} />
      </SafeAreaView>
    );
  }
  if (!pantry) return null;

  const isActive = activePantryId === pantry.id;
  const members = Object.entries(pantry.members).sort(([, a], [, b]) => {
    if (a.role === 'owner') return -1;
    if (b.role === 'owner') return 1;
    return a.name.localeCompare(b.name);
  });

  const startRename = () => { setNewName(pantry.name); setRenaming(true); };
  const confirmRename = async () => {
    if (!newName.trim()) return;
    setBusy('rename');
    try {
      await renamePantry(pantry.id, newName.trim());
      setRenaming(false);
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('pantry.detail.renameFailed'));
    } finally {
      setBusy(null);
    }
  };

  const handleUseAsActive = () => setActivePantryId(pantry.id);

  const handleCopyCode = async () => {
    if (!invite?.code) return;
    await Clipboard.setStringAsync(invite.code);
    showAlert(t('pantry.detail.copiedTitle'), t('pantry.detail.copiedBody'));
  };

  const handleShareCode = async () => {
    if (!invite?.code) return;
    try {
      await Share.share({
        message: t('pantry.detail.shareMessage', { name: pantry.name, code: invite.code, date: shortDate(invite.expiresAt) }),
      });
    } catch {
      // L'utente ha chiuso il foglio di condivisione: nessuna azione.
    }
  };

  const handleRotateCode = async () => {
    setBusy('rotate');
    try {
      await rotateInviteCode(pantry.id);
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('pantry.detail.regenerateFailed'));
    } finally {
      setBusy(null);
    }
  };

  const handleDisableCode = () => {
    showAlert(t('pantry.detail.deactivateTitle'), t('pantry.detail.deactivateBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('pantry.detail.deactivate'), style: 'destructive',
        onPress: async () => {
          setBusy('disable');
          try { await disableInviteCode(pantry.id); }
          catch (e: any) { showAlert(t('common.error'), e?.message ?? t('pantry.detail.deactivateFailed')); }
          finally { setBusy(null); }
        },
      },
    ]);
  };

  const handleRemoveMember = (uid: string, name: string) => {
    showAlert(t('pantry.detail.removeMemberTitle', { name }), t('pantry.detail.removeMemberBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          setBusy(`remove-${uid}`);
          try { await removeMember(pantry.id, uid); }
          catch (e: any) { showAlert(t('common.error'), e?.message ?? t('pantry.detail.removeMemberFailed')); }
          finally { setBusy(null); }
        },
      },
    ]);
  };

  const handleLeave = () => {
    showAlert(t('pantry.detail.leaveTitle'), t('pantry.detail.leaveBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('pantry.detail.leaveHome'), style: 'destructive',
        onPress: async () => {
          setBusy('leave');
          try {
            await leavePantry(pantry.id);
            if (isActive) setActivePantryId(null);
            router.back();
          } catch (e: any) {
            showAlert(t('common.error'), e?.message ?? t('pantry.detail.leaveFailed'));
            setBusy(null);
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    showAlert(t('pantry.detail.deleteTitle', { name: pantry.name }), t('pantry.detail.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          try {
            await deletePantry(pantry.id);
            if (isActive) setActivePantryId(null);
            router.back();
          } catch (e: any) {
            showAlert(t('common.error'), e?.message ?? t('pantry.detail.deleteFailed'));
            setBusy(null);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={20} color={T.ink} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{pantry.name}</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Nome + attivazione */}
        <View style={styles.card}>
          <View style={styles.nameRow}>
            <Text style={styles.pantryName} numberOfLines={1}>{pantry.name}</Text>
            {isOwner && (
              <TouchableOpacity onPress={startRename} style={styles.editBtn} activeOpacity={0.85}>
                <Ionicons name="pencil-outline" size={16} color={T.primary} />
              </TouchableOpacity>
            )}
          </View>
          <Text style={styles.cardSub}>
            {t('pantry.detail.memberCountCreatedBy', { count: members.length, owner: pantry.members[pantry.ownerId]?.name ?? '—' })}
          </Text>

          {isActive ? (
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={16} color={T.ok} />
              <Text style={styles.activeBadgeText}>{t('pantry.detail.activeBadge')}</Text>
            </View>
          ) : (
            <PrimaryButton
              onPress={handleUseAsActive}
              icon="swap-horizontal-outline"
              label={t('pantry.detail.useThisHome')}
              fullWidth
              containerStyle={{ marginTop: 14 }}
            />
          )}
        </View>

        {/* Codice invito — solo il creatore lo vede */}
        {isOwner && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t('pantry.detail.inviteCodeTitle')}</Text>
            <Text style={styles.sectionHint}>{t('pantry.detail.inviteCodeHint')}</Text>

            {invite?.code ? (
              <>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{invite.code}</Text>
                </View>

                <View style={styles.qrBox}>
                  <QRCode value={`shelfy://join/${invite.code}`} size={148} backgroundColor="#ffffff" color={T.ink} />
                </View>
                <Text style={styles.qrHint}>{t('pantry.detail.qrHint')}</Text>

                <Text style={[styles.codeExpiry, { textAlign: 'center' }]}>{t('pantry.detail.codeExpiresOn', { date: shortDate(invite.expiresAt) })}</Text>
                <View style={styles.codeActionsRow}>
                  <TouchableOpacity style={styles.codeActionBtn} onPress={handleCopyCode} activeOpacity={0.85}>
                    <Ionicons name="copy-outline" size={17} color={T.primary} />
                    <Text style={styles.codeActionText}>{t('pantry.detail.copy')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.codeActionBtn} onPress={handleShareCode} activeOpacity={0.85}>
                    <Ionicons name="share-outline" size={17} color={T.primary} />
                    <Text style={styles.codeActionText}>{t('pantry.detail.share')}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.codeActionsRow}>
                  <TouchableOpacity
                    style={styles.codeActionBtnGhost}
                    onPress={handleRotateCode}
                    disabled={busy === 'rotate'}
                    activeOpacity={0.85}
                  >
                    {busy === 'rotate'
                      ? <ActivityIndicator size="small" color={T.mute} />
                      : <Text style={styles.codeActionGhostText}>{t('pantry.detail.regenerate')}</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.codeActionBtnGhost}
                    onPress={handleDisableCode}
                    disabled={busy === 'disable'}
                    activeOpacity={0.85}
                  >
                    {busy === 'disable'
                      ? <ActivityIndicator size="small" color={T.urgent} />
                      : <Text style={[styles.codeActionGhostText, { color: T.urgent }]}>{t('pantry.detail.deactivate')}</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : invite === null ? (
              <ActivityIndicator color={T.primary} style={{ marginVertical: 12 }} />
            ) : (
              <View style={{ alignItems: 'flex-start', gap: 10 }}>
                <Text style={styles.codeExpiry}>{t('pantry.detail.codeDisabledHint')}</Text>
                <TouchableOpacity onPress={handleRotateCode} disabled={busy === 'rotate'} activeOpacity={0.85}>
                  <Text style={[styles.codeActionText, { color: T.primary }]}>
                    {busy === 'rotate' ? t('pantry.detail.regenerating') : t('pantry.detail.generateNewCode')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Membri */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>{t('pantry.detail.membersTitle')}</Text>
          <View style={{ gap: 8, marginTop: 8 }}>
            {members.map(([uid, m]) => (
              <View key={uid} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{m.name.charAt(0).toUpperCase() || '?'}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {m.name} {uid === user?.uid ? t('pantry.detail.youSuffix') : ''}
                  </Text>
                  <Text style={styles.memberRole}>{m.role === 'owner' ? t('pantry.detail.roleOwner') : t('pantry.detail.roleMember')}</Text>
                </View>
                {isOwner && uid !== user?.uid && (
                  <TouchableOpacity
                    onPress={() => handleRemoveMember(uid, m.name)}
                    disabled={busy === `remove-${uid}`}
                    style={styles.removeMemberBtn}
                    activeOpacity={0.85}
                  >
                    {busy === `remove-${uid}`
                      ? <ActivityIndicator size="small" color={T.urgent} />
                      : <Ionicons name="close" size={16} color={T.urgent} />}
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Zona pericolosa */}
        <View style={{ marginTop: 8 }}>
          {isOwner ? (
            <Pill variant="danger" size="lg" onPress={handleDelete} disabled={busy === 'delete'} style={{ justifyContent: 'center' }}>
              {busy === 'delete' ? t('pantry.detail.deleting') : t('pantry.detail.deleteHome')}
            </Pill>
          ) : (
            <Pill variant="danger" size="lg" onPress={handleLeave} disabled={busy === 'leave'} style={{ justifyContent: 'center' }}>
              {busy === 'leave' ? t('pantry.detail.leaving') : t('pantry.detail.leaveHome')}
            </Pill>
          )}
        </View>
      </ScrollView>

      <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRenaming(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('pantry.detail.renameTitle')}</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={t('pantry.hub.namePlaceholder')}
              placeholderTextColor={T.mute}
              autoFocus
              maxLength={60}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRenaming(false)} activeOpacity={0.85}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <PrimaryButton onPress={confirmRename} loading={busy === 'rename'} label={t('common.save')} containerStyle={{ flex: 1.3 }} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, gap: 12,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: RADIUS.input, backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center', boxShadow: CLAY.chip, flexShrink: 0,
  },
  title: { flex: 1, fontFamily: FONTS.serifItalic, fontSize: 18, color: T.ink, textAlign: 'center' },

  scroll: { padding: 20, paddingTop: 8, gap: 14, paddingBottom: 40 },

  card: {
    backgroundColor: T.surface, borderRadius: RADIUS.clay, padding: 18, boxShadow: CLAY.surface,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pantryName: { flex: 1, fontFamily: FONTS.serifItalic, fontSize: 22, color: T.ink, letterSpacing: -0.3 },
  editBtn: {
    width: 32, height: 32, borderRadius: RADIUS.sm, backgroundColor: T.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  cardSub: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 4 },

  activeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14,
    backgroundColor: T.okSoft, borderRadius: RADIUS.md, paddingVertical: 10, paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  activeBadgeText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ok },

  sectionLabel: { fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.6 },
  sectionHint: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 4, marginBottom: 14 },

  codeBox: {
    backgroundColor: '#ece8de', borderRadius: RADIUS.md, paddingVertical: 16,
    boxShadow: CLAY.inset, alignItems: 'center',
  },
  codeText: {
    fontFamily: FONTS.sansBold, fontSize: 28, color: T.ink, letterSpacing: 8,
  },
  qrBox: {
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
    backgroundColor: '#ffffff', borderRadius: RADIUS.md, padding: 14,
    marginTop: 14, boxShadow: CLAY.chip,
  },
  qrHint: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, textAlign: 'center', marginTop: 8 },
  codeExpiry: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 8 },

  codeActionsRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  codeActionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: T.primarySoft, borderRadius: RADIUS.md, paddingVertical: 11,
  },
  codeActionText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.primaryInk },
  codeActionBtnGhost: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10,
    borderRadius: RADIUS.md, borderWidth: 1, borderColor: T.line,
  },
  codeActionGhostText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink2 },

  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  memberAvatar: {
    width: 36, height: 36, borderRadius: RADIUS.sm, backgroundColor: T.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  memberAvatarText: { fontFamily: FONTS.sansBold, fontSize: 14, color: T.primaryInk },
  memberName: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.ink },
  memberRole: { fontFamily: FONTS.sans, fontSize: 11, color: T.mute, marginTop: 1 },
  removeMemberBtn: {
    width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: T.urgentSoft,
    alignItems: 'center', justifyContent: 'center',
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: T.surface, borderRadius: RADIUS.clay, padding: 24, width: 320, gap: 12,
  },
  modalTitle: { fontFamily: FONTS.serifItalic, fontSize: 22, color: T.ink, letterSpacing: -0.3 },
  modalInput: {
    backgroundColor: '#ece8de', borderRadius: RADIUS.input,
    paddingHorizontal: 14, paddingVertical: 12,
    fontFamily: FONTS.sans, fontSize: 15, color: T.ink,
    boxShadow: CLAY.inset,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1, borderRadius: RADIUS.lg, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: T.line,
  },
  modalCancelText: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.mute },
});
