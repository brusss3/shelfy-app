import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useProducts } from '@/context/ProductsContext';
import { ScannedProduct, Zone } from '@/types';
import FoodTile from '@/components/FoodTile';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';
import { tintForCategory } from '@/lib/urgency';

const ZONES: { id: Zone; label: string; icon: string }[] = [
  { id: 'frigo',    label: 'Frigo',    icon: '❄️' },
  { id: 'freezer',  label: 'Freezer',  icon: '🧊' },
  { id: 'dispensa', label: 'Dispensa', icon: '📦' },
];

const PRESETS = [
  { d: 3, l: '3 giorni' }, { d: 7, l: '1 settimana' },
  { d: 30, l: '1 mese' }, { d: 180, l: '6 mesi' }, { d: 365, l: '1 anno' },
];

function addDays(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

function daysLeft(iso: string): number {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export default function AddScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { addNewProduct } = useProducts();

  const scanned: ScannedProduct | null = params.scanned
    ? JSON.parse(params.scanned as string)
    : null;

  const [name, setName] = useState(scanned?.name ?? '');
  const [brand, setBrand] = useState(scanned?.brand ?? '');
  const [qty, setQty] = useState(scanned?.qty ?? '');
  const [zone, setZone] = useState<Zone>(scanned?.zone ?? 'frigo');
  const [category, setCategory] = useState(scanned?.category ?? '');
  const [expiry, setExpiry] = useState(addDays(scanned?.suggestExpiry ?? 7));
  const [saving, setSaving] = useState(false);

  const tint = scanned?.tint ?? tintForCategory(category);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Errore', 'Inserisci il nome del prodotto');
      return;
    }
    setSaving(true);
    try {
      await addNewProduct({
        name: name.trim(),
        brand: brand.trim(),
        qty: qty.trim(),
        zone,
        category: category || 'Altro',
        expiry,
        added: new Date().toISOString().slice(0, 10),
        barcode: scanned?.barcode ?? '',
        tint,
        cal: 0,
      });
      router.back();
    } catch (e: any) {
      Alert.alert('Errore', e.message ?? 'Impossibile salvare il prodotto');
    } finally {
      setSaving(false);
    }
  };

  const remaining = daysLeft(expiry);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nuovo prodotto</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Preview */}
        <View style={styles.preview}>
          <FoodTile
            product={{ name: name || 'Nuovo', tint }}
            size={92}
            radius={22}
          />
          <Text style={styles.previewName}>{name || 'Senza nome'}</Text>
          {scanned?.barcode && (
            <View style={styles.barcodePill}>
              <Text style={styles.barcodeText}>📊 {scanned.barcode}</Text>
            </View>
          )}
        </View>

        {/* Info fields */}
        <View style={styles.card}>
          <FieldRow label="Nome">
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="es. Latte intero"
              placeholderTextColor={T.mute}
            />
          </FieldRow>
          <Divider />
          <FieldRow label="Marca">
            <TextInput
              style={styles.input}
              value={brand}
              onChangeText={setBrand}
              placeholder="es. Granarolo"
              placeholderTextColor={T.mute}
            />
          </FieldRow>
          <Divider />
          <FieldRow label="Quantità">
            <TextInput
              style={styles.input}
              value={qty}
              onChangeText={setQty}
              placeholder="es. 1 L"
              placeholderTextColor={T.mute}
            />
          </FieldRow>
          <Divider />
          <FieldRow label="Categoria">
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder="es. Latticini"
              placeholderTextColor={T.mute}
            />
          </FieldRow>
        </View>

        {/* Zone */}
        <Text style={styles.sectionLabel}>CONSERVAZIONE</Text>
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
                <Text style={[styles.zoneLabel, active && styles.zoneLabelActive]}>
                  {z.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Expiry */}
        <Text style={styles.sectionLabel}>SCADENZA</Text>
        <View style={styles.card}>
          <FieldRow label="Data">
            <TextInput
              style={styles.input}
              value={expiry}
              onChangeText={setExpiry}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={T.mute}
            />
          </FieldRow>
          <Divider />
          <View style={styles.remainingRow}>
            <Text style={styles.remainingLabel}>Rimangono</Text>
            <Text style={styles.remainingValue}>
              {remaining >= 0 ? remaining : 0} giorni
            </Text>
          </View>
        </View>

        {/* Quick presets */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presets}
        >
          {PRESETS.map((p) => (
            <TouchableOpacity
              key={p.d}
              style={styles.preset}
              onPress={() => setExpiry(addDays(p.d))}
              activeOpacity={0.85}
            >
              <Text style={styles.presetText}>+ {p.l}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Sticky footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={styles.cancelBtnText}>Annulla</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color="#fbfaf3" />
          ) : (
            <Text style={styles.saveBtnText}>✓ Salva nel diario</Text>
          )}
        </TouchableOpacity>
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
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 16 : 36, paddingBottom: 12,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 100, backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.card,
  },
  closeBtnText: { fontSize: 18, color: T.ink },
  headerTitle: { fontSize: 14, fontFamily: FONTS.sansSemiBold, color: T.ink2 },

  preview: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  previewName: {
    fontFamily: FONTS.serifItalic, fontSize: 28, color: T.ink,
    letterSpacing: -0.4, textAlign: 'center',
  },
  barcodePill: {
    backgroundColor: T.surface, borderRadius: RADIUS.pill,
    paddingVertical: 6, paddingHorizontal: 12, ...SHADOW.card,
  },
  barcodeText: { fontSize: 11, fontFamily: FONTS.sansSemiBold, color: T.mute, letterSpacing: 0.3 },

  card: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg,
    marginHorizontal: 16, overflow: 'hidden', marginBottom: 12, ...SHADOW.card,
  },
  fieldRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  fieldLabel: { fontSize: 13, fontFamily: FONTS.sansSemiBold, color: T.ink2, width: 80 },
  input: {
    flex: 1, fontFamily: FONTS.sans, fontSize: 15, color: T.ink,
    padding: 0, fontWeight: '500',
  },

  sectionLabel: {
    fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.6,
    marginHorizontal: 24, marginBottom: 8, marginTop: 4,
  },
  zoneRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 12 },
  zoneBtn: {
    flex: 1, backgroundColor: T.surface, borderRadius: RADIUS.md,
    paddingVertical: 14, alignItems: 'center', gap: 6, ...SHADOW.card,
  },
  zoneBtnActive: { backgroundColor: T.primary },
  zoneIcon: { fontSize: 22 },
  zoneLabel: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink },
  zoneLabelActive: { color: '#fbfaf3' },

  remainingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  remainingLabel: { fontSize: 13, color: T.mute, fontFamily: FONTS.sans },
  remainingValue: { fontSize: 14, fontFamily: FONTS.sansBold, color: T.primaryInk },

  presets: { paddingHorizontal: 16, gap: 6, marginBottom: 12 },
  preset: {
    backgroundColor: T.surface, borderRadius: RADIUS.pill,
    paddingVertical: 6, paddingHorizontal: 12, ...SHADOW.card,
  },
  presetText: { fontSize: 12, fontFamily: FONTS.sansSemiBold, color: T.ink2 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10, padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 16,
    backgroundColor: T.bg,
    borderTopWidth: 0.5, borderTopColor: T.line,
  },
  cancelBtn: {
    flex: 1, borderRadius: RADIUS.pill, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: T.line,
  },
  cancelBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 16, color: T.primary },
  saveBtn: {
    flex: 1.8, borderRadius: RADIUS.pill, paddingVertical: 16,
    alignItems: 'center', backgroundColor: T.primary, ...SHADOW.fab,
  },
  saveBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 16, color: '#fbfaf3' },
});
