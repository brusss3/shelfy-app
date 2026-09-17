import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { usePantry } from '@/context/PantryContext';
import PrimaryButton from '@/components/PrimaryButton';
import { showAlert } from '@/lib/alert';
import {
  T, FONTS, RADIUS, CLAY, SURFACE, GRADIENT,
} from '@/constants/theme';

export default function PantryHubScreen() {
  const router = useRouter();
  const { pantries, loading, activePantryId, setActivePantryId } = usePantry();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const { createPantry } = usePantry();

  const handleCreate = async () => {
    if (!name.trim()) {
      showAlert('Errore', 'Dai un nome alla casa');
      return;
    }
    setCreating(true);
    try {
      const result = await createPantry(name.trim());
      setShowCreate(false);
      setName('');
      router.push(`/pantry/${result.id}`);
    } catch (e: any) {
      showAlert('Errore', e?.message ?? 'Impossibile creare la casa');
    } finally {
      setCreating(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={20} color={T.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Le tue case</Text>
        <View style={styles.navBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>SPAZIO ATTIVO</Text>

        <TouchableOpacity onPress={() => setActivePantryId(null)} activeOpacity={0.9}>
          <LinearGradient
            colors={activePantryId === null ? GRADIENT.primary : SURFACE.card}
            style={styles.row}
          >
            <View style={[styles.rowIcon, activePantryId !== null && styles.rowIconSoft]}>
              <Ionicons name="person-outline" size={20} color={activePantryId === null ? '#fbfaf3' : T.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, activePantryId === null && styles.rowTitleActive]}>Personale</Text>
              <Text style={[styles.rowSub, activePantryId === null && styles.rowSubActive]}>Solo tua, come sempre</Text>
            </View>
            {activePantryId === null && <Ionicons name="checkmark-circle" size={22} color="#fbfaf3" />}
          </LinearGradient>
        </TouchableOpacity>

        {loading ? (
          <ActivityIndicator color={T.primary} style={{ marginTop: 24 }} />
        ) : pantries.length > 0 ? (
          <>
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>LE TUE CASE</Text>
            {pantries.map((p) => {
              const active = p.id === activePantryId;
              return (
                <TouchableOpacity key={p.id} onPress={() => router.push(`/pantry/${p.id}`)} activeOpacity={0.9}>
                  <LinearGradient colors={active ? GRADIENT.primary : SURFACE.card} style={styles.row}>
                    <View style={[styles.rowIcon, !active && styles.rowIconSoft]}>
                      <Ionicons name="people-outline" size={20} color={active ? '#fbfaf3' : T.primary} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.rowTitle, active && styles.rowTitleActive]} numberOfLines={1}>{p.name}</Text>
                      <Text style={[styles.rowSub, active && styles.rowSubActive]}>
                        {p.memberIds.length} {p.memberIds.length === 1 ? 'persona' : 'persone'}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={active ? '#fbfaf3' : T.mute} />
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </>
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Nessuna casa condivisa</Text>
            <Text style={styles.emptyText}>
              Crea una casa per gestirla insieme a chi vuoi tu, o entra con un codice che ti hanno dato.
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <PrimaryButton
            onPress={() => setShowCreate(true)}
            icon="add-outline"
            label="Nuova casa"
            fullWidth
          />
          <TouchableOpacity
            style={styles.joinBtn}
            onPress={() => router.push('/pantry/join')}
            activeOpacity={0.85}
          >
            <Ionicons name="key-outline" size={17} color={T.primary} />
            <Text style={styles.joinBtnText}>Ho un codice d'invito</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCreate(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuova casa</Text>
            <Text style={styles.modalSub}>Es. "Casa di Via Roma" o "Famiglia Rossi"</Text>
            <TextInput
              style={styles.modalInput}
              value={name}
              onChangeText={setName}
              placeholder="Nome della casa"
              placeholderTextColor={T.mute}
              autoFocus
              maxLength={60}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowCreate(false)} activeOpacity={0.85}>
                <Text style={styles.modalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <PrimaryButton onPress={handleCreate} loading={creating} label="Crea" containerStyle={{ flex: 1.3 }} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: RADIUS.input, backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center', boxShadow: CLAY.chip,
  },
  title: { fontFamily: FONTS.serifItalic, fontSize: 20, color: T.ink, letterSpacing: -0.3 },

  scroll: { padding: 20, paddingTop: 8, gap: 10 },
  sectionLabel: {
    fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.6, marginBottom: 4,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADIUS.clay, padding: 14, boxShadow: CLAY.surface, marginBottom: 8,
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(251,250,243,0.16)',
  },
  rowIconSoft: { backgroundColor: T.primarySoft },
  rowTitle: { fontFamily: FONTS.sansBold, fontSize: 15, color: T.ink },
  rowTitleActive: { color: '#fbfaf3' },
  rowSub: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 2 },
  rowSubActive: { color: 'rgba(251,250,243,0.72)' },

  emptyBox: {
    backgroundColor: T.surface, borderRadius: RADIUS.clay, padding: 20,
    alignItems: 'center', boxShadow: CLAY.surface, marginTop: 12,
  },
  emptyTitle: { fontFamily: FONTS.sansBold, fontSize: 15, color: T.ink, marginBottom: 6 },
  emptyText: { fontFamily: FONTS.sans, fontSize: 13, color: T.mute, textAlign: 'center', lineHeight: 19 },

  actions: { marginTop: 20, gap: 12 },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14,
  },
  joinBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.primary },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: T.surface, borderRadius: RADIUS.clay, padding: 24, width: 320, gap: 12,
  },
  modalTitle: { fontFamily: FONTS.serifItalic, fontSize: 22, color: T.ink, letterSpacing: -0.3 },
  modalSub: { fontSize: 13, color: T.mute, fontFamily: FONTS.sans, marginTop: -6 },
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
