import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert, Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProducts } from '@/context/ProductsContext';
import { urgencyOf, shortDate, daysTo } from '@/lib/urgency';
import Pill from '@/components/Pill';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';
import { Zone } from '@/types';

const ZONES: { id: Zone; label: string; icon: string; sub: string }[] = [
  { id: 'frigo',    label: 'Frigo',    icon: '❄️', sub: '4 °C' },
  { id: 'freezer',  label: 'Freezer',  icon: '🧊', sub: '-18 °C' },
  { id: 'dispensa', label: 'Dispensa', icon: '📦', sub: 'Asciutto' },
];

const OPEN_EXPIRY_DAYS: Record<Zone, number> = {
  frigo: 3,
  freezer: 30,
  dispensa: 90,
};

const PRESETS = [
  { d: 1, l: '1 giorno' },
  { d: 3, l: '3 giorni' },
  { d: 7, l: '1 settimana' },
  { d: 30, l: '1 mese' },
  { d: 90, l: '3 mesi' },
];

function addDays(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, removeProduct, changeZone, markOpened } = useProducts();
  const router = useRouter();

  const [showOpenModal, setShowOpenModal] = useState(false);
  const [openPickerDay, setOpenPickerDay] = useState('');
  const [openPickerMonth, setOpenPickerMonth] = useState('');
  const [openPickerYear, setOpenPickerYear] = useState('');
  const [openExpiryPreview, setOpenExpiryPreview] = useState('');

  const product = products.find((p) => p.id === id);
  if (!product) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: T.mute, fontFamily: FONTS.sans }}>Prodotto non trovato.</Text>
      </View>
    );
  }

  const effectiveExpiry = product.openExpiry
    ? daysTo(product.openExpiry) < daysTo(product.expiry) ? product.openExpiry : product.expiry
    : product.expiry;

  const days = daysTo(effectiveExpiry);
  const u = urgencyOf(days);

  const totalDays = Math.max(1,
    Math.round((new Date(product.expiry).getTime() - new Date(product.added).getTime()) / 86400000),
  );
  const elapsed = Math.max(0, Math.min(1,
    (Date.now() - new Date(product.added).getTime()) / (totalDays * 86400000),
  ));

  const openOpenModal = () => {
    const defaultDays = OPEN_EXPIRY_DAYS[product.zone];
    const defaultDate = new Date(Date.now() + defaultDays * 86400000);
    setOpenPickerDay(String(defaultDate.getDate()));
    setOpenPickerMonth(String(defaultDate.getMonth() + 1));
    setOpenPickerYear(String(defaultDate.getFullYear()));
    setOpenExpiryPreview(addDays(defaultDays));
    setShowOpenModal(true);
  };

  const syncPreview = (day: string, month: string, year: string) => {
    const d = Math.max(1, Math.min(31, parseInt(day) || 1));
    const m = Math.max(1, Math.min(12, parseInt(month) || 1));
    const y = parseInt(year) || new Date().getFullYear();
    setOpenExpiryPreview(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  };

  const confirmOpen = async () => {
    const d = Math.max(1, Math.min(31, parseInt(openPickerDay) || 1));
    const m = Math.max(1, Math.min(12, parseInt(openPickerMonth) || 1));
    const y = parseInt(openPickerYear) || new Date().getFullYear();
    const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    setShowOpenModal(false);
    await markOpened(product.id, iso);
  };

  const handleDelete = () => {
    Alert.alert(
      'Rimuovi prodotto',
      `Vuoi rimuovere "${product.name}" dalla dispensa?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rimuovi',
          style: 'destructive',
          onPress: async () => {
            await removeProduct(product.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Nav */}
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.navBtn}>
              <Text style={styles.navBtnText}>↗</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: product.tint || T.primarySoft }]}>
          <Text style={styles.heroInitials}>
            {product.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
          </Text>
          <Text style={styles.heroBrand}>{product.brand.toUpperCase()}</Text>
          <Text style={styles.heroName}>{product.name}</Text>
          <Text style={styles.heroSub}>{product.qty} · {product.category}</Text>
          {product.openedAt && (
            <View style={styles.openedHeroBadge}>
              <Text style={styles.openedHeroBadgeText}>🔓 Aperto il {shortDate(product.openedAt)}</Text>
            </View>
          )}
        </View>

        {/* Expiry card */}
        <View style={styles.section}>
          <View style={[styles.expiryCard, { backgroundColor: u.soft }]}>
            <View style={styles.expiryLeft}>
              <View style={[styles.expiryIcon, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
                <Text style={{ fontSize: 26 }}>⏰</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.expiryLabel, { color: u.ink }]}>{u.label.toUpperCase()}</Text>
                <Text style={[styles.expiryDate, { color: u.ink }]}>{shortDate(effectiveExpiry)}</Text>
                {product.openedAt && product.openExpiry && (
                  <Text style={[styles.expiryAdded, { color: u.ink, opacity: 0.8 }]}>
                    Da consumare entro dopo apertura
                  </Text>
                )}
                {!(product.openedAt && product.openExpiry) && (
                  <Text style={[styles.expiryAdded, { color: u.ink, opacity: 0.7 }]}>
                    Aggiunto il {shortDate(product.added)}
                  </Text>
                )}
                {product.openedAt && product.openExpiry && daysTo(product.expiry) > daysTo(product.openExpiry) && (
                  <Text style={[styles.expiryOriginal, { color: u.ink }]}>
                    Scad. originale: {shortDate(product.expiry)}
                  </Text>
                )}
              </View>
            </View>
            {/* Progress bar */}
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${elapsed * 100}%` as any, backgroundColor: u.color }]}
              />
            </View>
          </View>
        </View>

        {/* Open product action */}
        <View style={styles.section}>
          {!product.openedAt ? (
            <TouchableOpacity style={styles.openBtn} onPress={openOpenModal} activeOpacity={0.85}>
              <Text style={styles.openBtnIcon}>🔓</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.openBtnTitle}>Segna come aperto</Text>
                <Text style={styles.openBtnSub}>
                  {product.zone === 'frigo' && 'Calcola scadenza post-apertura (3 giorni)'}
                  {product.zone === 'dispensa' && 'Calcola scadenza post-apertura (3 mesi)'}
                  {product.zone === 'freezer' && 'Calcola scadenza post-apertura (30 giorni)'}
                </Text>
              </View>
              <Text style={styles.openBtnArrow}>›</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.openBtnActive} onPress={openOpenModal} activeOpacity={0.85}>
              <Text style={styles.openBtnIcon}>🔓</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.openBtnTitleActive}>Prodotto aperto</Text>
                <Text style={styles.openBtnSubActive}>
                  Aperto il {shortDate(product.openedAt)} · consuma entro {product.openExpiry ? shortDate(product.openExpiry) : '—'}
                </Text>
              </View>
              <Text style={styles.openBtnArrowActive}>›</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Zone selector */}
        <Text style={styles.sectionTitle}>Conservazione</Text>
        <View style={styles.section}>
          <View style={styles.card}>
            {ZONES.map((z, i) => {
              const active = product.zone === z.id;
              return (
                <React.Fragment key={z.id}>
                  <TouchableOpacity
                    style={styles.zoneRow}
                    onPress={() => changeZone(product.id, z.id)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.zoneIconBox, { backgroundColor: active ? T.primary : T.primarySoft }]}>
                      <Text style={{ fontSize: 20 }}>{z.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.zoneLabel}>{z.label}</Text>
                      <Text style={styles.zoneSub}>{z.sub}</Text>
                    </View>
                    {active && (
                      <View style={styles.checkBadge}>
                        <Text style={{ color: '#fbfaf3', fontSize: 14 }}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {i < ZONES.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* Details */}
        <Text style={styles.sectionTitle}>Dettagli</Text>
        <View style={styles.section}>
          <View style={styles.card}>
            {[
              { label: 'Codice a barre', value: product.barcode || '—' },
              { label: 'Categoria', value: product.category },
              { label: 'Apporto', value: product.cal ? `${product.cal} kcal / 100g` : '—' },
            ].map((row, i, arr) => (
              <React.Fragment key={row.label}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Delete */}
        <View style={styles.section}>
          <Pill
            variant="ghost"
            size="lg"
            onPress={handleDelete}
            style={{ borderColor: 'rgba(189,74,48,0.2)', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: FONTS.sansSemiBold, color: T.urgent, fontSize: 16 }}>
              🗑 Rimuovi dalla dispensa
            </Text>
          </Pill>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Open product modal */}
      <Modal
        visible={showOpenModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOpenModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowOpenModal(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>Prodotto aperto</Text>
            <Text style={styles.modalSub}>
              Scegli entro quando consumarlo dopo l'apertura
            </Text>

            {/* Quick presets */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
            >
              {PRESETS.map((p) => (
                <TouchableOpacity
                  key={p.d}
                  style={styles.preset}
                  onPress={() => {
                    const d = new Date(Date.now() + p.d * 86400000);
                    const day = String(d.getDate());
                    const month = String(d.getMonth() + 1);
                    const year = String(d.getFullYear());
                    setOpenPickerDay(day);
                    setOpenPickerMonth(month);
                    setOpenPickerYear(year);
                    syncPreview(day, month, year);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={styles.presetText}>+{p.l}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Date inputs */}
            <View style={styles.pickerRow}>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Giorno</Text>
                <TextInput
                  style={styles.pickerInput}
                  value={openPickerDay}
                  onChangeText={(v) => { setOpenPickerDay(v); syncPreview(v, openPickerMonth, openPickerYear); }}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                />
              </View>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Mese</Text>
                <TextInput
                  style={styles.pickerInput}
                  value={openPickerMonth}
                  onChangeText={(v) => { setOpenPickerMonth(v); syncPreview(openPickerDay, v, openPickerYear); }}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                />
              </View>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>Anno</Text>
                <TextInput
                  style={styles.pickerInput}
                  value={openPickerYear}
                  onChangeText={(v) => { setOpenPickerYear(v); syncPreview(openPickerDay, openPickerMonth, v); }}
                  keyboardType="number-pad"
                  maxLength={4}
                  selectTextOnFocus
                />
              </View>
            </View>

            {openExpiryPreview ? (
              <Text style={styles.modalPreviewDate}>
                Scade il {shortDate(openExpiryPreview)} ({daysTo(openExpiryPreview)} giorni)
              </Text>
            ) : null}

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowOpenModal(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.modalCancelText}>Annulla</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={confirmOpen}
                activeOpacity={0.85}
              >
                <Text style={styles.modalConfirmText}>🔓 Conferma apertura</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 32 },

  nav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 8,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 100, backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.card,
  },
  navBtnText: { fontSize: 24, color: T.ink, lineHeight: 28 },

  hero: {
    margin: 16, borderRadius: 28, padding: 24,
    alignItems: 'center', gap: 6,
  },
  heroInitials: {
    fontFamily: FONTS.serifItalic, fontSize: 90, color: 'rgba(20,28,16,0.78)',
    lineHeight: 90, letterSpacing: -3,
  },
  heroBrand: {
    fontSize: 11, fontFamily: FONTS.sansBold, color: 'rgba(20,28,16,0.55)', letterSpacing: 0.5,
  },
  heroName: {
    fontFamily: FONTS.serifItalic, fontSize: 28, color: T.ink, letterSpacing: -0.5, lineHeight: 32,
    textAlign: 'center',
  },
  heroSub: { fontSize: 12, color: T.ink2, fontFamily: FONTS.sans },
  openedHeroBadge: {
    backgroundColor: 'rgba(255,255,255,0.55)', borderRadius: 100,
    paddingVertical: 6, paddingHorizontal: 14, marginTop: 4,
  },
  openedHeroBadgeText: { fontSize: 12, fontFamily: FONTS.sansSemiBold, color: '#2d5c2d' },

  section: { paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 22, color: T.ink, letterSpacing: -0.3,
    paddingHorizontal: 20, marginBottom: 12,
  },

  expiryCard: { borderRadius: RADIUS.xl, padding: 18 },
  expiryLeft: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 14 },
  expiryIcon: { width: 52, height: 52, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  expiryLabel: { fontSize: 12, fontFamily: FONTS.sansBold, letterSpacing: 0.4, textTransform: 'uppercase' },
  expiryDate: { fontFamily: FONTS.serifItalic, fontSize: 28, letterSpacing: -0.4, lineHeight: 32 },
  expiryAdded: { fontSize: 12, fontFamily: FONTS.sans, marginTop: 4 },
  expiryOriginal: { fontSize: 11, fontFamily: FONTS.sans, marginTop: 2, opacity: 0.6 },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 100 },

  openBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 16,
    borderWidth: 1, borderColor: T.line, ...SHADOW.card,
  },
  openBtnActive: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#e8f0e8', borderRadius: RADIUS.lg, padding: 16,
    borderWidth: 1, borderColor: 'rgba(58,107,58,0.2)',
  },
  openBtnIcon: { fontSize: 22 },
  openBtnTitle: { fontSize: 14, fontFamily: FONTS.sansSemiBold, color: T.ink },
  openBtnSub: { fontSize: 12, color: T.mute, marginTop: 1, fontFamily: FONTS.sans },
  openBtnTitleActive: { fontSize: 14, fontFamily: FONTS.sansSemiBold, color: '#2d5c2d' },
  openBtnSubActive: { fontSize: 12, color: '#4a8050', marginTop: 1, fontFamily: FONTS.sans },
  openBtnArrow: { fontSize: 18, color: T.mute },
  openBtnArrowActive: { fontSize: 18, color: '#3a6b3a' },

  card: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.card,
  },
  zoneRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16, gap: 14,
  },
  zoneIconBox: {
    width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  zoneLabel: { fontSize: 14, fontFamily: FONTS.sansSemiBold, color: T.ink },
  zoneSub: { fontSize: 11, color: T.mute, marginTop: 1, fontFamily: FONTS.sans },
  checkBadge: {
    width: 22, height: 22, borderRadius: 100, backgroundColor: T.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 0.5, backgroundColor: T.line, marginLeft: 16 },

  detailRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  detailLabel: { fontSize: 13, color: T.mute, fontFamily: FONTS.sans, flex: 1 },
  detailValue: {
    fontSize: 14, fontFamily: FONTS.sansSemiBold, color: T.ink,
  },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: T.surface, borderRadius: 24, padding: 24,
    width: 320, gap: 14,
  },
  modalTitle: { fontFamily: FONTS.serifItalic, fontSize: 24, color: T.ink, letterSpacing: -0.3 },
  modalSub: { fontSize: 13, color: T.mute, fontFamily: FONTS.sans, marginTop: -6 },
  modalPreviewDate: {
    fontSize: 13, fontFamily: FONTS.sansSemiBold, color: T.primaryInk,
    textAlign: 'center', paddingVertical: 4,
  },
  preset: {
    backgroundColor: T.bg, borderRadius: RADIUS.pill,
    paddingVertical: 6, paddingHorizontal: 12,
    borderWidth: 1, borderColor: T.line,
  },
  presetText: { fontSize: 12, fontFamily: FONTS.sansSemiBold, color: T.ink2 },
  pickerRow: { flexDirection: 'row', gap: 12 },
  pickerCol: { flex: 1, alignItems: 'center', gap: 6 },
  pickerLabel: { fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.4 },
  pickerInput: {
    width: '100%', textAlign: 'center',
    backgroundColor: T.bg, borderRadius: RADIUS.md,
    paddingVertical: 12, fontSize: 20, fontFamily: FONTS.sansBold, color: T.ink,
    borderWidth: 1, borderColor: T.line,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1, borderRadius: RADIUS.pill, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: T.line,
  },
  modalCancelText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.mute },
  modalConfirm: {
    flex: 2, borderRadius: RADIUS.pill, paddingVertical: 14,
    alignItems: 'center', backgroundColor: T.primary, ...SHADOW.fab,
  },
  modalConfirmText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: '#fbfaf3' },
});
