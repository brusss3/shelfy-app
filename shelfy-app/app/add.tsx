import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, ActivityIndicator, Modal,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useProducts } from '@/context/ProductsContext';
import { ScannedProduct, Zone, ScoreGrade } from '@/types';
import FoodTile from '@/components/FoodTile';
import QuantityStepper from '@/components/QuantityStepper';
import DateScannerModal from '@/components/DateScannerModal';
import PrimaryButton from '@/components/PrimaryButton';
import { T, FONTS, RADIUS, SHADOW, CLAY } from '@/constants/theme';
import { tintForCategory } from '@/lib/urgency';
import { ocrAvailable } from '@/lib/ocr';
import { showAlert } from '@/lib/alert';

const ZONES: { id: Zone; labelKey: string; icon: string }[] = [
  { id: 'frigo',    labelKey: 'common.zones.frigo',    icon: '❄️' },
  { id: 'freezer',  labelKey: 'common.zones.freezer',  icon: '🧊' },
  { id: 'dispensa', labelKey: 'common.zones.dispensa', icon: '📦' },
];

const PRESETS = [
  { d: 3, labelKey: 'common.presets.d3' }, { d: 7, labelKey: 'common.presets.d7' },
  { d: 30, labelKey: 'common.presets.d30' }, { d: 180, labelKey: 'common.presets.d180' },
  { d: 365, labelKey: 'common.presets.d365' },
];

// Stima per prodotti senza una scadenza stampata (frutta, verdura sfusa,
// ecc.): non è una data reale, solo un'indicazione ragionevole in base a
// dove viene conservato il prodotto.
const ESTIMATE_DAYS: Record<Zone, number> = { frigo: 7, freezer: 90, dispensa: 180 };

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
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const scanned: ScannedProduct | null = params.scanned
    ? JSON.parse(params.scanned as string)
    : null;

  const [name, setName] = useState(scanned?.name ?? '');
  const [brand, setBrand] = useState(scanned?.brand ?? '');
  const [qty, setQty] = useState(scanned?.qty ?? '');
  const [count, setCount] = useState(1);
  // Zona e scadenza NON vengono precompilate dal barcode: non sono dati letti
  // dal codice a barre (solo un suggerimento euristico) e l'utente deve
  // sceglierle esplicitamente per non pensare che siano state "lette".
  const [zone, setZone] = useState<Zone | null>(null);
  const [category, setCategory] = useState(scanned?.category ?? '');
  const [expiry, setExpiry] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showOcr, setShowOcr] = useState(false);
  const [showNutrition, setShowNutrition] = useState(false);

  const [pickerYear, setPickerYear] = useState('');
  const [pickerMonth, setPickerMonth] = useState('');
  const [pickerDay, setPickerDay] = useState('');

  const confirmDate = () => {
    const d = Math.max(1, Math.min(31, parseInt(pickerDay) || 1));
    const m = Math.max(1, Math.min(12, parseInt(pickerMonth) || 1));
    const y = parseInt(pickerYear) || new Date().getFullYear();
    setExpiry(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    setShowDatePicker(false);
  };

  const openDatePicker = () => {
    const d = expiry ? new Date(expiry + 'T00:00:00') : new Date();
    setPickerYear(String(d.getFullYear()));
    setPickerMonth(String(d.getMonth() + 1));
    setPickerDay(String(d.getDate()));
    setShowDatePicker(true);
  };

  const handleEstimate = () => {
    if (!zone) {
      showAlert(t('common.estimate.chooseZoneTitle'), t('common.estimate.chooseZoneBody'));
      return;
    }
    setExpiry(addDays(ESTIMATE_DAYS[zone]));
  };

  const tint = scanned?.tint ?? tintForCategory(category);

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert(t('common.error'), t('add.errors.missingName'));
      return;
    }
    if (!zone) {
      showAlert(t('common.error'), t('add.errors.missingZone'));
      return;
    }
    if (!expiry) {
      showAlert(t('common.error'), t('add.errors.missingExpiry'));
      return;
    }
    setSaving(true);
    try {
      await addNewProduct({
        name: name.trim(),
        brand: brand.trim(),
        qty: qty.trim(),
        count,
        zone,
        category: category || 'Altro',
        expiry,
        added: new Date().toISOString().slice(0, 10),
        barcode: scanned?.barcode ?? '',
        tint,
        cal: scanned?.nutrition?.calories ?? 0,
        nutrition: scanned?.nutrition,
        allergens: scanned?.allergens,
        nutriscore: scanned?.nutriscore,
        ecoscore: scanned?.ecoscore,
      });
      router.back();
    } catch (e: any) {
      showAlert(t('common.error'), e.message ?? t('add.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const remaining = expiry ? daysLeft(expiry) : null;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('add.headerTitle')}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Preview */}
        <View style={styles.preview}>
          <FoodTile
            product={{ name: name || t('add.newFallbackName'), tint }}
            size={92}
            radius={22}
          />
          <Text style={styles.previewName}>{name || t('add.noNameFallback')}</Text>
          {scanned?.barcode && (
            <View style={styles.barcodePill}>
              <Text style={styles.barcodeText}>📊 {scanned.barcode}</Text>
            </View>
          )}
        </View>

        {/* Info fields */}
        <View style={styles.card}>
          <FieldRow label={t('add.fields.name')}>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder={t('add.fields.namePlaceholder')}
              placeholderTextColor={T.mute}
            />
          </FieldRow>
          <Divider />
          <FieldRow label={t('add.fields.brand')}>
            <TextInput
              style={styles.input}
              value={brand}
              onChangeText={setBrand}
              placeholder={t('add.fields.brandPlaceholder')}
              placeholderTextColor={T.mute}
            />
          </FieldRow>
          <Divider />
          <FieldRow label={t('add.fields.qty')}>
            <TextInput
              style={styles.input}
              value={qty}
              onChangeText={setQty}
              placeholder={t('add.fields.qtyPlaceholder')}
              placeholderTextColor={T.mute}
            />
          </FieldRow>
          <Divider />
          <FieldRow label={t('add.fields.unit')}>
            <View style={{ alignItems: 'flex-start' }}>
              <QuantityStepper value={count} onChange={setCount} />
            </View>
          </FieldRow>
          <Divider />
          <FieldRow label={t('add.fields.category')}>
            <TextInput
              style={styles.input}
              value={category}
              onChangeText={setCategory}
              placeholder={t('add.fields.categoryPlaceholder')}
              placeholderTextColor={T.mute}
            />
          </FieldRow>
        </View>

        {/* Info nutrizionali (solo se il prodotto scansionato le ha) — richiudibile,
            per non ingombrare il flusso di salvataggio. */}
        {(scanned?.nutrition || scanned?.allergens || scanned?.nutriscore || scanned?.ecoscore) && (
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.nutritionToggle}
              onPress={() => setShowNutrition((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={styles.nutritionToggleText}>🥗 {t('common.nutrition.title')}</Text>
              <Text style={styles.nutritionToggleIcon}>{showNutrition ? '▲' : '▼'}</Text>
            </TouchableOpacity>

            {showNutrition && (
              <View style={styles.nutritionBody}>
                {(scanned?.nutriscore || scanned?.ecoscore) && (
                  <View style={styles.scoreRow}>
                    {scanned?.nutriscore && <ScoreBadge label="Nutri-Score" grade={scanned.nutriscore} />}
                    {scanned?.ecoscore && <ScoreBadge label="Eco-Score" grade={scanned.ecoscore} />}
                  </View>
                )}

                {scanned?.nutrition && (
                  <View style={styles.nutritionGrid}>
                    <Text style={styles.nutritionCaption}>{t('common.nutrition.per100')}</Text>
                    <NutritionRow label={t('common.nutrition.calories')} value={scanned.nutrition.calories} unit="kcal" />
                    <NutritionRow label={t('common.nutrition.proteins')} value={scanned.nutrition.proteins} unit="g" />
                    <NutritionRow label={t('common.nutrition.fat')} value={scanned.nutrition.fat} unit="g" />
                    <NutritionRow label={t('common.nutrition.carbs')} value={scanned.nutrition.carbs} unit="g" />
                    <NutritionRow label={t('common.nutrition.sugars')} value={scanned.nutrition.sugars} unit="g" />
                    <NutritionRow label={t('common.nutrition.salt')} value={scanned.nutrition.salt} unit="g" />
                  </View>
                )}

                {scanned?.allergens && scanned.allergens.length > 0 && (
                  <View style={styles.allergensBlock}>
                    <Text style={styles.nutritionCaption}>{t('common.nutrition.allergens')}</Text>
                    <View style={styles.allergensRow}>
                      {scanned.allergens.map((a) => (
                        <View key={a} style={styles.allergenPill}>
                          <Text style={styles.allergenPillText}>{a}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Zone */}
        <Text style={styles.sectionLabel}>{t('add.storageSection')}</Text>
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
                  {t(z.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Stima per prodotti senza scadenza stampata (frutta, verdura...) */}
        <TouchableOpacity style={styles.estimateBtn} onPress={handleEstimate} activeOpacity={0.85}>
          <Text style={styles.estimateBtnIcon}>🥬</Text>
          <Text style={styles.estimateBtnText}>{t('common.estimate.cta')}</Text>
        </TouchableOpacity>
        <Text style={styles.estimateDisclaimer}>
          {t('common.estimate.disclaimer')}
        </Text>

        {/* Expiry */}
        <Text style={styles.sectionLabel}>{t('add.expirySection')}</Text>
        <View style={styles.card}>
          <FieldRow label={t('add.fields.date')}>
            <TouchableOpacity onPress={openDatePicker} activeOpacity={0.85} style={styles.dateBtn}>
              <Text style={[styles.dateBtnText, !expiry && styles.dateBtnPlaceholder]}>
                {expiry ?? t('add.selectDate')}
              </Text>
              <Text style={styles.dateBtnIcon}>📅</Text>
            </TouchableOpacity>
          </FieldRow>
          {remaining !== null && (
            <>
              <Divider />
              <View style={styles.remainingRow}>
                <Text style={styles.remainingLabel}>{t('add.remainingLabel')}</Text>
                <Text style={styles.remainingValue}>
                  {t('add.remainingDays', { count: remaining >= 0 ? remaining : 0 })}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* OCR: scansiona la data dalla confezione. Disponibile solo dove l'OCR
            è supportato (build nativa o web), nascosto in Expo Go. */}
        {ocrAvailable && (
          <TouchableOpacity
            style={styles.ocrBtn}
            onPress={() => setShowOcr(true)}
            activeOpacity={0.85}
          >
            <Text style={styles.ocrBtnIcon}>📷</Text>
            <Text style={styles.ocrBtnText}>{t('add.ocrButton')}</Text>
          </TouchableOpacity>
        )}

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
              <Text style={styles.presetText}>+ {t(p.labelKey)}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Date picker modal */}
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
            {/* Quick offsets */}
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

      {/* OCR camera modal */}
      <DateScannerModal
        visible={showOcr}
        onClose={() => setShowOcr(false)}
        onResult={(iso) => setExpiry(iso)}
      />

      {/* Sticky footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={() => router.back()}
          activeOpacity={0.85}
        >
          <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <PrimaryButton
          onPress={handleSave}
          loading={saving}
          icon="checkmark"
          label={t('add.save')}
          containerStyle={{ flex: 1.8 }}
        />
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

// Colori standard UE per Nutri-Score / Eco-Score (scala A-E).
const GRADE_COLORS: Record<ScoreGrade, string> = {
  a: '#038141', b: '#85bb2f', c: '#fecb02', d: '#ee8100', e: '#e63e11',
};

function ScoreBadge({ label, grade }: { label: string; grade: ScoreGrade }) {
  return (
    <View style={styles.scoreBadge}>
      <View style={[styles.scoreCircle, { backgroundColor: GRADE_COLORS[grade] }]}>
        <Text style={styles.scoreCircleText}>{grade.toUpperCase()}</Text>
      </View>
      <Text style={styles.scoreLabel}>{label}</Text>
    </View>
  );
}

function NutritionRow({ label, value, unit }: { label: string; value?: number; unit: string }) {
  if (value === undefined) return null;
  return (
    <View style={styles.nutritionRow}>
      <Text style={styles.nutritionRowLabel}>{label}</Text>
      <Text style={styles.nutritionRowValue}>{value} {unit}</Text>
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

  preview: { alignItems: 'center', paddingVertical: 20, gap: 10 },
  previewName: {
    fontFamily: FONTS.serifItalic, fontSize: 28, color: T.ink,
    letterSpacing: -0.4, textAlign: 'center',
  },
  barcodePill: {
    backgroundColor: T.surface, borderRadius: RADIUS.tag,
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

  nutritionToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  nutritionToggleText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.ink },
  nutritionToggleIcon: { fontSize: 11, color: T.mute },
  nutritionBody: { paddingHorizontal: 16, paddingBottom: 16, gap: 14 },

  scoreRow: { flexDirection: 'row', gap: 24 },
  scoreBadge: { alignItems: 'center', gap: 4 },
  scoreCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  scoreCircleText: { fontFamily: FONTS.sansBold, fontSize: 15, color: '#fff' },
  scoreLabel: { fontSize: 11, fontFamily: FONTS.sansMedium, color: T.mute },

  nutritionCaption: {
    fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.4,
    marginBottom: 4,
  },
  nutritionGrid: { gap: 2 },
  nutritionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 5, borderBottomWidth: 0.5, borderBottomColor: T.line,
  },
  nutritionRowLabel: { fontSize: 13, fontFamily: FONTS.sans, color: T.ink2 },
  nutritionRowValue: { fontSize: 13, fontFamily: FONTS.sansSemiBold, color: T.ink },

  allergensBlock: {},
  allergensRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  allergenPill: {
    backgroundColor: T.warnSoft, borderRadius: RADIUS.tag,
    paddingVertical: 5, paddingHorizontal: 10,
  },
  allergenPillText: { fontSize: 12, fontFamily: FONTS.sansMedium, color: T.warn },
  zoneRow: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 12 },
  zoneBtn: {
    flex: 1, backgroundColor: T.surface, borderRadius: RADIUS.md,
    paddingVertical: 14, alignItems: 'center', gap: 6, ...SHADOW.card,
  },
  zoneBtnActive: { backgroundColor: T.primary },
  zoneIcon: { fontSize: 22 },
  zoneLabel: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink },
  zoneLabelActive: { color: '#fbfaf3' },

  estimateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: T.surface, borderRadius: RADIUS.lg,
    marginHorizontal: 16, marginBottom: 6, paddingVertical: 12,
    borderWidth: 1, borderColor: T.line,
  },
  estimateBtnIcon: { fontSize: 16 },
  estimateBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink2 },
  estimateDisclaimer: {
    fontSize: 11, fontFamily: FONTS.sans, color: T.mute,
    marginHorizontal: 16, marginBottom: 14, lineHeight: 15,
  },

  remainingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  remainingLabel: { fontSize: 13, color: T.mute, fontFamily: FONTS.sans },
  remainingValue: { fontSize: 14, fontFamily: FONTS.sansBold, color: T.primaryInk },

  presets: { paddingHorizontal: 16, gap: 6, marginBottom: 12 },
  preset: {
    backgroundColor: T.surface, borderRadius: RADIUS.md,
    paddingVertical: 6, paddingHorizontal: 12, ...SHADOW.card,
  },
  presetText: { fontSize: 12, fontFamily: FONTS.sansSemiBold, color: T.ink2 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 16,
    backgroundColor: T.bg,
    borderTopWidth: 0.5, borderTopColor: T.line,
  },
  cancelBtn: {
    flex: 1, borderRadius: RADIUS.lg, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: T.line,
  },
  cancelBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 16, color: T.primary },
  ocrBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: T.primarySoft, borderRadius: RADIUS.lg,
    marginHorizontal: 16, marginBottom: 12, paddingVertical: 14,
  },
  ocrBtnIcon: { fontSize: 18 },
  ocrBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.primaryInk },

  dateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  dateBtnText: { fontFamily: FONTS.sansMedium, fontSize: 15, color: T.ink },
  dateBtnPlaceholder: { color: T.mute },
  dateBtnIcon: { fontSize: 18 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: T.surface, borderRadius: 24, padding: 24,
    width: 320, gap: 12,
  },
  modalTitle: { fontFamily: FONTS.serifItalic, fontSize: 22, color: T.ink, letterSpacing: -0.3 },
  pickerRow: { flexDirection: 'row', gap: 12 },
  pickerCol: { flex: 1, alignItems: 'center', gap: 6 },
  pickerLabel: { fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.4 },
  pickerInput: {
    width: '100%', textAlign: 'center',
    backgroundColor: '#ece8de', borderRadius: RADIUS.input,
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
