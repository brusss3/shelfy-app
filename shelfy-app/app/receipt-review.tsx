import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProducts } from '@/context/ProductsContext';
import { Zone } from '@/types';
import { T, FONTS, RADIUS, SHADOW, CLAY } from '@/constants/theme';
import { tintForCategory } from '@/lib/urgency';
import { showAlert } from '@/lib/alert';
import PrimaryButton from '@/components/PrimaryButton';

const ZONES: { id: Zone; label: string; icon: string }[] = [
  { id: 'frigo', label: 'Frigo', icon: '❄️' },
  { id: 'freezer', label: 'Freezer', icon: '🧊' },
  { id: 'dispensa', label: 'Dispensa', icon: '📦' },
];

const PRESETS = [
  { d: 3, l: '3 giorni' }, { d: 7, l: '1 settimana' },
  { d: 30, l: '1 mese' }, { d: 180, l: '6 mesi' }, { d: 365, l: '1 anno' },
];

function addDays(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

interface ReceiptRow {
  name: string;
  expiry: string | null;
}

// Revisione della lista letta dallo scontrino: l'utente corregge ogni nome,
// imposta una scadenza per riga (o applica un preset a tutte quelle vuote),
// rimuove le righe sbagliate e conferma l'inserimento in blocco.
export default function ReceiptReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { addNewProducts } = useProducts();
  const insets = useSafeAreaInsets();

  const initialItems: string[] = params.items ? JSON.parse(params.items as string) : [];

  const [rows, setRows] = useState<ReceiptRow[]>(
    initialItems.map((name) => ({ name, expiry: null })),
  );
  const [zone, setZone] = useState<Zone | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [pickerYear, setPickerYear] = useState('');
  const [pickerMonth, setPickerMonth] = useState('');
  const [pickerDay, setPickerDay] = useState('');

  const updateRowName = (index: number, name: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, name } : r)));
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { name: '', expiry: null }]);
  };

  const setRowExpiry = (index: number, iso: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, expiry: iso } : r)));
  };

  const applyPresetToEmpty = (days: number) => {
    const iso = addDays(days);
    setRows((prev) => prev.map((r) => (r.expiry ? r : { ...r, expiry: iso })));
  };

  const openDatePicker = (index: number) => {
    const current = rows[index].expiry;
    const d = current ? new Date(current + 'T00:00:00') : new Date();
    setPickerYear(String(d.getFullYear()));
    setPickerMonth(String(d.getMonth() + 1));
    setPickerDay(String(d.getDate()));
    setActiveRow(index);
    setShowDatePicker(true);
  };

  const confirmDate = () => {
    if (activeRow === null) return;
    const d = Math.max(1, Math.min(31, parseInt(pickerDay) || 1));
    const m = Math.max(1, Math.min(12, parseInt(pickerMonth) || 1));
    const y = parseInt(pickerYear) || new Date().getFullYear();
    setRowExpiry(activeRow, `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    setShowDatePicker(false);
    setActiveRow(null);
  };

  const validRows = rows.filter((r) => r.name.trim().length > 0);
  const canSave = !!zone && validRows.length > 0 && validRows.every((r) => !!r.expiry);

  const handleSave = async () => {
    if (!zone) {
      showAlert('Errore', 'Seleziona dove conservi questi prodotti (Frigo, Freezer o Dispensa)');
      return;
    }
    if (validRows.length === 0) {
      showAlert('Errore', 'Aggiungi almeno un prodotto');
      return;
    }
    if (!validRows.every((r) => !!r.expiry)) {
      showAlert('Errore', 'Imposta la scadenza per ogni prodotto');
      return;
    }

    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await addNewProducts(
        validRows.map((r) => ({
          name: r.name.trim(),
          brand: '',
          qty: '',
          count: 1,
          zone,
          category: 'Altro',
          expiry: r.expiry as string,
          added: today,
          barcode: '',
          tint: tintForCategory('Altro'),
          cal: 0,
        })),
      );
      router.replace('/(tabs)');
    } catch (e: any) {
      showAlert('Errore', e?.message ?? 'Impossibile salvare i prodotti');
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
          <Text style={styles.headerTitle}>Controlla la lista</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.intro}>
          Ho letto {initialItems.length} righe dallo scontrino. Correggi i nomi, imposta le scadenze e rimuovi quello che non serve.
        </Text>

        {/* Zone */}
        <Text style={styles.sectionLabel}>DOVE LI CONSERVI</Text>
        <View style={styles.zoneRow}>
          {ZONES.map((z) => {
            const active = zone === z.id;
            return (
              <TouchableOpacity
                key={z.id}
                style={[styles.zoneBtn, active && styles.zoneBtnActive]}
                onPress={() => setZone(z.id)}
                activeOpacity={0.85}
              >
                <Text style={styles.zoneIcon}>{z.icon}</Text>
                <Text style={[styles.zoneLabel, active && styles.zoneLabelActive]}>{z.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Preset rapido per righe senza scadenza */}
        <Text style={styles.sectionLabel}>APPLICA SCADENZA A TUTTE LE RIGHE VUOTE</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presets}
        >
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.d}
              style={styles.preset}
              onPress={() => applyPresetToEmpty(p.d)}
              activeOpacity={0.85}
            >
              <Text style={styles.presetText}>+ {p.l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Rows */}
        <Text style={styles.sectionLabel}>PRODOTTI ({rows.length})</Text>
        <View style={styles.rowsWrap}>
          {rows.map((row, index) => (
            <View key={index} style={styles.rowCard}>
              <TextInput
                style={styles.rowNameInput}
                value={row.name}
                onChangeText={(v) => updateRowName(index, v)}
                placeholder="Nome prodotto"
                placeholderTextColor={T.mute}
              />
              <TouchableOpacity
                onPress={() => openDatePicker(index)}
                activeOpacity={0.85}
                style={styles.rowDateBtn}
              >
                <Text style={[styles.rowDateText, !row.expiry && styles.rowDatePlaceholder]}>
                  {row.expiry ?? 'Scadenza'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => removeRow(index)}
                activeOpacity={0.85}
                style={styles.rowDeleteBtn}
              >
                <Text style={styles.rowDeleteText}>✕</Text>
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addRowBtn} onPress={addRow} activeOpacity={0.85}>
            <Text style={styles.addRowBtnText}>+ Aggiungi riga</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Date picker modal, condiviso da tutte le righe */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Scegli la data</Text>
            <View style={styles.pickerRow}>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Giorno</Text>
                <TextInput
                  style={styles.pickerInput}
                  value={pickerDay}
                  onChangeText={setPickerDay}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                />
              </View>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Mese</Text>
                <TextInput
                  style={styles.pickerInput}
                  value={pickerMonth}
                  onChangeText={setPickerMonth}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                />
              </View>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Anno</Text>
                <TextInput
                  style={styles.pickerInput}
                  value={pickerYear}
                  onChangeText={setPickerYear}
                  keyboardType="number-pad"
                  maxLength={4}
                  selectTextOnFocus
                />
              </View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 8 }}>
              {PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.d}
                  style={styles.preset}
                  onPress={() => {
                    const d = new Date(Date.now() + p.d * 86400000);
                    setPickerDay(String(d.getDate()));
                    setPickerMonth(String(d.getMonth() + 1));
                    setPickerYear(String(d.getFullYear()));
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.presetText}>+ {p.l}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDatePicker(false)} activeOpacity={0.85}>
                <Text style={styles.modalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <PrimaryButton onPress={confirmDate} label="Conferma" containerStyle={{ flex: 1.5 }} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.cancelBtnText}>Annulla</Text>
        </TouchableOpacity>
        <PrimaryButton
          onPress={handleSave}
          disabled={!canSave}
          loading={saving}
          icon="checkmark"
          label={`Aggiungi ${validRows.length} prodott${validRows.length === 1 ? 'o' : 'i'}`}
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

  sectionLabel: {
    fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.6,
    marginHorizontal: 20, marginBottom: 8, marginTop: 4,
  },

  zoneRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 20 },
  zoneBtn: {
    flex: 1, backgroundColor: T.surface, borderRadius: RADIUS.md,
    paddingVertical: 14, alignItems: 'center', gap: 6, ...SHADOW.card,
  },
  zoneBtnActive: { backgroundColor: T.primary },
  zoneIcon: { fontSize: 22 },
  zoneLabel: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink },
  zoneLabelActive: { color: '#fbfaf3' },

  presets: { paddingHorizontal: 16, gap: 6, marginBottom: 20 },
  preset: {
    backgroundColor: T.surface, borderRadius: RADIUS.md,
    paddingVertical: 6, paddingHorizontal: 12, ...SHADOW.card,
  },
  presetText: { fontSize: 12, fontFamily: FONTS.sansSemiBold, color: T.ink2 },

  rowsWrap: { paddingHorizontal: 16, gap: 8 },
  rowCard: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, ...SHADOW.card,
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  rowNameInput: {
    flex: 1.4, fontFamily: FONTS.sans, fontSize: 14, color: T.ink, padding: 0, fontWeight: '500',
  },
  rowDateBtn: {
    flex: 1, alignItems: 'flex-end',
  },
  rowDateText: { fontFamily: FONTS.sansMedium, fontSize: 13, color: T.ink },
  rowDatePlaceholder: { color: T.mute },
  rowDeleteBtn: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: T.warnSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  rowDeleteText: { fontSize: 13, color: T.warn, fontFamily: FONTS.sansBold },

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
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: T.surface, borderRadius: 24, padding: 24, width: 320, gap: 12,
  },
  modalTitle: { fontFamily: FONTS.serifItalic, fontSize: 22, color: T.ink, letterSpacing: -0.3 },
  pickerRow: { flexDirection: 'row', gap: 12 },
  pickerCol: { flex: 1, alignItems: 'center', gap: 6 },
  pickerLabel: { fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.4 },
  pickerInput: {
    width: '100%', textAlign: 'center', backgroundColor: '#ece8de', borderRadius: RADIUS.input,
    paddingVertical: 12, fontSize: 20, fontFamily: FONTS.sansBold, color: T.ink,
    boxShadow: CLAY.inset,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1, borderRadius: RADIUS.lg, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: T.line,
  },
  modalCancelText: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.mute },
});
