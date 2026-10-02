import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useProducts } from '@/context/ProductsContext';
import { Zone } from '@/types';
import { T, FONTS, RADIUS, SHADOW, CLAY } from '@/constants/theme';
import { tintForCategory } from '@/lib/urgency';
import { showAlert } from '@/lib/alert';
import { usePremiumGate, isProductLimitError } from '@/lib/premiumGate';
import PrimaryButton from '@/components/PrimaryButton';
import ProductMatchSheet from '@/components/ProductMatchSheet';
import { CHAINS, loadPricePrefs, savePricePrefs, submitPrice } from '@/lib/prices';
import { ProductSuggestion } from '@/lib/productSearch';
import { ReceiptLine } from '@/lib/parseReceipt';

const ZONES: { id: Zone; labelKey: string; icon: string }[] = [
  { id: 'frigo', labelKey: 'common.zones.frigo', icon: '❄️' },
  { id: 'freezer', labelKey: 'common.zones.freezer', icon: '🧊' },
  { id: 'dispensa', labelKey: 'common.zones.dispensa', icon: '📦' },
];

const PRESETS = [
  { d: 3, labelKey: 'common.presets.d3' }, { d: 7, labelKey: 'common.presets.d7' },
  { d: 30, labelKey: 'common.presets.d30' }, { d: 180, labelKey: 'common.presets.d180' },
  { d: 365, labelKey: 'common.presets.d365' },
];

function addDays(n: number): string {
  return new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
}

interface ReceiptRow {
  name: string;
  expiry: string | null;
  /** Prezzo come testo ("1,29"): si modifica a mano. */
  price: string;
  /** Barcode del prodotto collegato; senza, il prezzo non si può salvare. */
  barcode: string;
  brand: string;
  qty: string;
}

const isoDate = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);

// "1,29" -> 129 centesimi, o null se non è un prezzo valido.
function parsePriceCents(text: string): number | null {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) && n >= 0.01 && n <= 999 ? Math.round(n * 100) : null;
}

// Revisione della lista letta dallo scontrino: l'utente corregge ogni nome,
// imposta una scadenza per riga (o applica un preset a tutte quelle vuote),
// rimuove le righe sbagliate e conferma l'inserimento in blocco.
export default function ReceiptReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { addNewProducts } = useProducts();
  const { onProductLimit } = usePremiumGate();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const initialItems: ReceiptLine[] = params.items ? JSON.parse(params.items as string) : [];
  const detectedDate = typeof params.date === 'string' && params.date ? params.date : '';
  const detectedChain = typeof params.chain === 'string' ? params.chain : '';

  const [rows, setRows] = useState<ReceiptRow[]>(
    initialItems.map((l) => ({
      name: l.name, expiry: null, barcode: '', brand: '', qty: '',
      price: l.priceCents !== null ? (l.priceCents / 100).toFixed(2).replace('.', ',') : '',
    })),
  );
  const [matchRow, setMatchRow] = useState<number | null>(null);
  const [city, setCity] = useState('');
  const [chain, setChain] = useState(detectedChain);
  const [customChain, setCustomChain] = useState(
    !!detectedChain && !(CHAINS as readonly string[]).includes(detectedChain),
  );
  const [dateIso, setDateIso] = useState(detectedDate || isoDate(0));
  const [zone, setZone] = useState<Zone | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [pickerYear, setPickerYear] = useState('');
  const [pickerMonth, setPickerMonth] = useState('');
  const [pickerDay, setPickerDay] = useState('');

  // Il comune dell'ultima volta: davanti allo scontrino si vuole solo confermare.
  useEffect(() => {
    loadPricePrefs().then((p) => setCity((c) => c || p.city));
  }, []);

  const updateRow = (index: number, patch: Partial<ReceiptRow>) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const pickMatch = (p: ProductSuggestion) => {
    if (matchRow === null) return;
    updateRow(matchRow, { barcode: p.barcode, brand: p.brand, qty: p.qty });
    setMatchRow(null);
  };

  const updateRowName = (index: number, name: string) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, name } : r)));
  };

  const removeRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setRows((prev) => [...prev, { name: '', expiry: null, price: '', barcode: '', brand: '', qty: '' }]);
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
  const storeReady = chain.trim().length > 0 && city.trim().length > 0;
  const priceRows = validRows.filter((r) => !!r.barcode && parsePriceCents(r.price) !== null);
  const canSave = !!zone && validRows.length > 0 && validRows.every((r) => !!r.expiry);

  // Invia i prezzi delle righe collegate a un prodotto, tre alla volta. Un
  // limite giornaliero raggiunto interrompe l'invio: il resto non si perde in
  // silenzio, lo si dice all'utente.
  const sendPrices = async (): Promise<{ title: string; body: string } | null> => {
    if (priceRows.length === 0) return null;
    const store = { chain: chain.trim(), name: '', city: city.trim() };
    const observedAt = dateIso === isoDate(0)
      ? new Date().toISOString()
      : new Date(`${dateIso}T12:00:00`).toISOString();
    let saved = 0;
    let held = 0;
    let stopped = false;
    const queue = [...priceRows];
    const worker = async () => {
      for (let r = queue.shift(); r && !stopped; r = queue.shift()) {
        try {
          const res = await submitPrice({
            barcode: r.barcode,
            productName: [r.brand, r.name.trim()].filter(Boolean).join(' '),
            priceCents: parsePriceCents(r.price) as number,
            store,
            observedAt,
          });
          if (res.status === 'held') held += 1; else saved += 1;
        } catch (e: any) {
          if (e?.code === 'functions/resource-exhausted') stopped = true;
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (saved + held > 0) savePricePrefs(city.trim(), store);
    const failed = priceRows.length - saved - held;
    if (saved + held === 0) {
      return { title: t('receiptReview.pricesFailedTitle'), body: t('receiptReview.pricesFailedBody') };
    }
    return {
      title: t('receiptReview.pricesSavedTitle'),
      body: [
        t('receiptReview.pricesSavedBody', { count: saved + held }),
        failed > 0 ? t('receiptReview.pricesPartial', { count: failed }) : null,
      ].filter(Boolean).join(' '),
    };
  };

  const handleSave = async () => {
    if (!zone) {
      showAlert(t('common.error'), t('receiptReview.missingZoneError'));
      return;
    }
    if (validRows.length === 0) {
      showAlert(t('common.error'), t('receiptReview.missingProductError'));
      return;
    }
    if (!validRows.every((r) => !!r.expiry)) {
      showAlert(t('common.error'), t('receiptReview.missingExpiryError'));
      return;
    }

    setSaving(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      await addNewProducts(
        validRows.map((r) => ({
          name: r.name.trim(),
          brand: r.brand,
          qty: r.qty,
          count: 1,
          zone,
          category: 'Altro',
          expiry: r.expiry as string,
          added: today,
          barcode: r.barcode,
          tint: tintForCategory('Altro'),
          cal: 0,
        })),
      );
      // I prodotti sono già salvati: un errore sui prezzi non deve annullarli.
      const summary = storeReady ? await sendPrices() : null;
      if (summary) {
        showAlert(summary.title, summary.body, [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]);
      } else {
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      if (isProductLimitError(e)) { onProductLimit(); } else {
        showAlert(t('common.error'), e?.message ?? t('receiptReview.saveFailed'));
      }
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
          <Text style={styles.headerTitle}>{t('receiptReview.headerTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.intro}>
          {t('receiptReview.intro', { count: initialItems.length })}
        </Text>

        {/* Zone */}
        <Text style={styles.sectionLabel}>{t('receiptReview.storageSection')}</Text>
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
                <Text style={[styles.zoneLabel, active && styles.zoneLabelActive]}>{t(z.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Preset rapido per righe senza scadenza */}
        <Text style={styles.sectionLabel}>{t('receiptReview.applyToEmptySection')}</Text>
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
              <Text style={styles.presetText}>+ {t(p.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Negozio e data: servono a salvare i prezzi */}
        <Text style={styles.sectionLabel}>{t('receiptReview.storeSection')}</Text>
        <View style={styles.storeCard}>
          <Text style={styles.storeHint}>{t('receiptReview.storeHint')}</Text>
          <TextInput
            style={styles.storeInput}
            value={city}
            onChangeText={setCity}
            placeholder={t('prices.cityPlaceholder')}
            placeholderTextColor={T.mute}
            autoCapitalize="words"
          />
          <View style={styles.chipsWrap}>
            {CHAINS.map((c) => {
              const active = !customChain && chain === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.miniChip, active && styles.miniChipActive]}
                  onPress={() => { setCustomChain(false); setChain(c); }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.miniChipText, active && styles.miniChipTextActive]}>{c}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.miniChip, customChain && styles.miniChipActive]}
              onPress={() => { setCustomChain(true); setChain(''); }}
              activeOpacity={0.85}
            >
              <Text style={[styles.miniChipText, customChain && styles.miniChipTextActive]}>{t('prices.otherChain')}</Text>
            </TouchableOpacity>
          </View>
          {customChain && (
            <TextInput
              style={styles.storeInput}
              value={chain}
              onChangeText={setChain}
              placeholder={t('prices.chainPlaceholder')}
              placeholderTextColor={T.mute}
              maxLength={30}
              autoCapitalize="words"
            />
          )}
          <View style={styles.chipsWrap}>
            {[
              ...(detectedDate && detectedDate !== isoDate(0) && detectedDate !== isoDate(1)
                ? [{ iso: detectedDate, label: detectedDate.split('-').reverse().join('/') }]
                : []),
              { iso: isoDate(0), label: t('prices.date.today') },
              { iso: isoDate(1), label: t('prices.date.yesterday') },
            ].map((d) => {
              const active = dateIso === d.iso;
              return (
                <TouchableOpacity
                  key={d.iso}
                  style={[styles.miniChip, active && styles.miniChipActive]}
                  onPress={() => setDateIso(d.iso)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.miniChipText, active && styles.miniChipTextActive]}>{d.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.storeHint}>
            {priceRows.length > 0 && storeReady
              ? t('receiptReview.pricesReady', { count: priceRows.length })
              : t('receiptReview.pricesNone')}
          </Text>
        </View>

        {/* Rows */}
        <Text style={styles.sectionLabel}>{t('receiptReview.productsSection', { count: rows.length })}</Text>
        <View style={styles.rowsWrap}>
          {rows.map((row, index) => (
            <View key={index} style={styles.rowCard}>
              <View style={styles.rowMain}>
                <TextInput
                  style={styles.rowNameInput}
                  value={row.name}
                  onChangeText={(v) => updateRowName(index, v)}
                  placeholder={t('receiptReview.namePlaceholder')}
                  placeholderTextColor={T.mute}
                />
                <TouchableOpacity
                  onPress={() => openDatePicker(index)}
                  activeOpacity={0.85}
                  style={styles.rowDateBtn}
                >
                  <Text style={[styles.rowDateText, !row.expiry && styles.rowDatePlaceholder]}>
                    {row.expiry ?? t('receiptReview.expiryPlaceholder')}
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
              <View style={styles.rowPriceLine}>
                <View style={styles.priceBox}>
                  <TextInput
                    style={styles.priceInput}
                    value={row.price}
                    onChangeText={(v) => updateRow(index, { price: v })}
                    placeholder="0,00"
                    placeholderTextColor={T.mute}
                    keyboardType="decimal-pad"
                  />
                  <Text style={styles.priceCurrency}>€</Text>
                </View>
                <TouchableOpacity
                  onPress={() => setMatchRow(index)}
                  activeOpacity={0.85}
                  style={[styles.linkBtn, !!row.barcode && styles.linkBtnDone]}
                >
                  <Text style={[styles.linkBtnText, !!row.barcode && styles.linkBtnTextDone]} numberOfLines={1}>
                    {row.barcode ? `✓ ${t('receiptReview.linked')}` : t('receiptReview.link')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addRowBtn} onPress={addRow} activeOpacity={0.85}>
            <Text style={styles.addRowBtnText}>{t('receiptReview.addRow')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      <ProductMatchSheet
        visible={matchRow !== null}
        initialQuery={matchRow !== null ? rows[matchRow]?.name ?? '' : ''}
        onPick={pickMatch}
        onClose={() => setMatchRow(null)}
      />

      {/* Date picker modal, condiviso da tutte le righe */}
      <Modal visible={showDatePicker} transparent animationType="fade" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowDatePicker(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('common.datePicker.title')}</Text>
            <View style={styles.pickerRow}>
              <View style={styles.pickerCol}>
                <Text style={styles.pickerLabel}>{t('common.datePicker.day')}</Text>
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
                <Text style={styles.pickerLabel}>{t('common.datePicker.month')}</Text>
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
                <Text style={styles.pickerLabel}>{t('common.datePicker.year')}</Text>
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
                  <Text style={styles.presetText}>+ {t(p.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDatePicker(false)} activeOpacity={0.85}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <PrimaryButton onPress={confirmDate} label={t('common.datePicker.confirm')} containerStyle={{ flex: 1.5 }} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <PrimaryButton
          onPress={handleSave}
          disabled={!canSave}
          loading={saving}
          icon="checkmark"
          label={t('receiptReview.addCount', { count: validRows.length })}
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
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  rowMain: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowPriceLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  priceBox: {
    flexDirection: 'row', alignItems: 'center', width: 96, height: 36, borderRadius: RADIUS.input,
    paddingHorizontal: 12, backgroundColor: T.bg, boxShadow: CLAY.inset,
  },
  priceInput: { flex: 1, fontSize: 14, fontFamily: FONTS.sansMedium, color: T.ink, padding: 0 },
  priceCurrency: { fontFamily: FONTS.sansBold, fontSize: 13, color: T.mute, marginLeft: 4 },
  linkBtn: {
    flex: 1, height: 36, borderRadius: RADIUS.md, borderWidth: 1, borderColor: T.line,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10,
  },
  linkBtnDone: { backgroundColor: T.okSoft, borderColor: T.okSoft },
  linkBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.primary },
  linkBtnTextDone: { color: T.ok },

  storeCard: { marginHorizontal: 16, marginBottom: 20, gap: 10 },
  storeHint: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, lineHeight: 17 },
  storeInput: {
    height: 44, borderRadius: RADIUS.input, paddingHorizontal: 16, backgroundColor: T.bg,
    boxShadow: CLAY.inset, fontSize: 15, fontFamily: FONTS.sans, color: T.ink,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  miniChip: {
    paddingVertical: 7, paddingHorizontal: 12, borderRadius: RADIUS.md,
    backgroundColor: T.surface, ...SHADOW.card,
  },
  miniChipActive: { backgroundColor: T.primary },
  miniChipText: { fontFamily: FONTS.sansMedium, fontSize: 13, color: T.ink },
  miniChipTextActive: { color: '#fbfaf3' },
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
