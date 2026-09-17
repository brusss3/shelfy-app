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

function shortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short' });
}

export default function PantryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
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
      showAlert('Errore', e?.message ?? 'Impossibile rinominare');
    } finally {
      setBusy(null);
    }
  };

  const handleUseAsActive = () => setActivePantryId(pantry.id);

  const handleCopyCode = async () => {
    if (!invite?.code) return;
    await Clipboard.setStringAsync(invite.code);
    showAlert('Copiato', 'Codice copiato negli appunti.');
  };

  const handleShareCode = async () => {
    if (!invite?.code) return;
    try {
      await Share.share({
        message: `Unisciti alla mia casa "${pantry.name}" su Shelfy! Codice: ${invite.code}\nScade il ${shortDate(invite.expiresAt)}.`,
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
      showAlert('Errore', e?.message ?? 'Impossibile rigenerare il codice');
    } finally {
      setBusy(null);
    }
  };

  const handleDisableCode = () => {
    showAlert('Disattivare il codice?', 'Chi non è ancora entrato non potrà più usarlo. Potrai generarne uno nuovo quando vuoi.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Disattiva', style: 'destructive',
        onPress: async () => {
          setBusy('disable');
          try { await disableInviteCode(pantry.id); }
          catch (e: any) { showAlert('Errore', e?.message ?? 'Impossibile disattivare il codice'); }
          finally { setBusy(null); }
        },
      },
    ]);
  };

  const handleRemoveMember = (uid: string, name: string) => {
    showAlert(`Rimuovere ${name}?`, 'Perderà l\'accesso a questa casa condivisa.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Rimuovi', style: 'destructive',
        onPress: async () => {
          setBusy(`remove-${uid}`);
          try { await removeMember(pantry.id, uid); }
          catch (e: any) { showAlert('Errore', e?.message ?? 'Impossibile rimuovere'); }
          finally { setBusy(null); }
        },
      },
    ]);
  };

  const handleLeave = () => {
    showAlert('Abbandonare questa casa?', 'Non vedrai più i suoi prodotti finché non torni a entrarci con un nuovo codice.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Abbandona', style: 'destructive',
        onPress: async () => {
          setBusy('leave');
          try {
            await leavePantry(pantry.id);
            if (isActive) setActivePantryId(null);
            router.back();
          } catch (e: any) {
            showAlert('Errore', e?.message ?? 'Impossibile abbandonare');
            setBusy(null);
          }
        },
      },
    ]);
  };

  const handleDelete = () => {
    showAlert(`Eliminare "${pantry.name}"?`, 'Tutti i prodotti condivisi andranno persi per sempre, per tutti i membri. Non si può annullare.', [
      { text: 'Annulla', style: 'cancel' },
      {
        text: 'Elimina', style: 'destructive',
        onPress: async () => {
          setBusy('delete');
          try {
            await deletePantry(pantry.id);
            if (isActive) setActivePantryId(null);
            router.back();
          } catch (e: any) {
            showAlert('Errore', e?.message ?? 'Impossibile eliminare');
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
            {members.length} {members.length === 1 ? 'persona' : 'persone'} · creata da{' '}
            {pantry.members[pantry.ownerId]?.name ?? '—'}
          </Text>

          {isActive ? (
            <View style={styles.activeBadge}>
              <Ionicons name="checkmark-circle" size={16} color={T.ok} />
              <Text style={styles.activeBadgeText}>È la tua casa attiva</Text>
            </View>
          ) : (
            <PrimaryButton
              onPress={handleUseAsActive}
              icon="swap-horizontal-outline"
              label="Usa questa casa"
              fullWidth
              containerStyle={{ marginTop: 14 }}
            />
          )}
        </View>

        {/* Codice invito — solo il creatore lo vede */}
        {isOwner && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>CODICE INVITO</Text>
            <Text style={styles.sectionHint}>Solo tu lo vedi. Condividilo con chi vuoi far entrare.</Text>

            {invite?.code ? (
              <>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{invite.code}</Text>
                </View>

                <View style={styles.qrBox}>
                  <QRCode value={`shelfy://join/${invite.code}`} size={148} backgroundColor="#ffffff" color={T.ink} />
                </View>
                <Text style={styles.qrHint}>Chi lo inquadra con Shelfy entra subito</Text>

                <Text style={[styles.codeExpiry, { textAlign: 'center' }]}>Scade il {shortDate(invite.expiresAt)}</Text>
                <View style={styles.codeActionsRow}>
                  <TouchableOpacity style={styles.codeActionBtn} onPress={handleCopyCode} activeOpacity={0.85}>
                    <Ionicons name="copy-outline" size={17} color={T.primary} />
                    <Text style={styles.codeActionText}>Copia</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.codeActionBtn} onPress={handleShareCode} activeOpacity={0.85}>
                    <Ionicons name="share-outline" size={17} color={T.primary} />
                    <Text style={styles.codeActionText}>Condividi</Text>
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
                      : <Text style={styles.codeActionGhostText}>Rigenera</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.codeActionBtnGhost}
                    onPress={handleDisableCode}
                    disabled={busy === 'disable'}
                    activeOpacity={0.85}
                  >
                    {busy === 'disable'
                      ? <ActivityIndicator size="small" color={T.urgent} />
                      : <Text style={[styles.codeActionGhostText, { color: T.urgent }]}>Disattiva</Text>}
                  </TouchableOpacity>
                </View>
              </>
            ) : invite === null ? (
              <ActivityIndicator color={T.primary} style={{ marginVertical: 12 }} />
            ) : (
              <View style={{ alignItems: 'flex-start', gap: 10 }}>
                <Text style={styles.codeExpiry}>Il codice è disattivato: nessuno può entrare con un vecchio codice.</Text>
                <TouchableOpacity onPress={handleRotateCode} disabled={busy === 'rotate'} activeOpacity={0.85}>
                  <Text style={[styles.codeActionText, { color: T.primary }]}>
                    {busy === 'rotate' ? 'Genero…' : 'Genera un nuovo codice'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Membri */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>MEMBRI</Text>
          <View style={{ gap: 8, marginTop: 8 }}>
            {members.map(([uid, m]) => (
              <View key={uid} style={styles.memberRow}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>{m.name.charAt(0).toUpperCase() || '?'}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {m.name} {uid === user?.uid ? '(tu)' : ''}
                  </Text>
                  <Text style={styles.memberRole}>{m.role === 'owner' ? 'Creatore' : 'Membro'}</Text>
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
              {busy === 'delete' ? 'Elimino…' : 'Elimina casa'}
            </Pill>
          ) : (
            <Pill variant="danger" size="lg" onPress={handleLeave} disabled={busy === 'leave'} style={{ justifyContent: 'center' }}>
              {busy === 'leave' ? 'Esco…' : 'Abbandona casa'}
            </Pill>
          )}
        </View>
      </ScrollView>

      <Modal visible={renaming} transparent animationType="fade" onRequestClose={() => setRenaming(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setRenaming(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Rinomina casa</Text>
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="Nome della casa"
              placeholderTextColor={T.mute}
              autoFocus
              maxLength={60}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setRenaming(false)} activeOpacity={0.85}>
                <Text style={styles.modalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <PrimaryButton onPress={confirmRename} loading={busy === 'rename'} label="Salva" containerStyle={{ flex: 1.3 }} />
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
