import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, Modal, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { T, FONTS, RADIUS, CLAY } from '@/constants/theme';
import { ScannedProduct, Zone, NutritionInfo, ScoreGrade } from '@/types';
import { tintForCategory } from '@/lib/urgency';
import { useProducts } from '@/context/ProductsContext';
import { showAlert } from '@/lib/alert';
import { ocrAvailable } from '@/lib/ocr';
import DateScannerModal from '@/components/DateScannerModal';
import PrimaryButton from '@/components/PrimaryButton';
import { getInitials } from '@/lib/text';

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

function parseGrade(g: unknown): ScoreGrade | undefined {
  const v = typeof g === 'string' ? g.toLowerCase() : '';
  return (['a', 'b', 'c', 'd', 'e'] as const).includes(v as ScoreGrade) ? (v as ScoreGrade) : undefined;
}

// Estrae i valori nutrizionali per 100g/100ml; undefined se il prodotto non
// ne ha nessuno compilato (evita di mostrare una sezione vuota).
function parseNutrition(nutriments: Record<string, unknown> | undefined): NutritionInfo | undefined {
  if (!nutriments) return undefined;
  const num = (k: string) => (typeof nutriments[k] === 'number' ? (nutriments[k] as number) : undefined);
  const info: NutritionInfo = {
    calories: num('energy-kcal_100g'),
    proteins: num('proteins_100g'),
    fat: num('fat_100g'),
    carbs: num('carbohydrates_100g'),
    sugars: num('sugars_100g'),
    salt: num('salt_100g'),
  };
  return Object.values(info).some((v) => v !== undefined) ? info : undefined;
}

function parseAllergens(p: Record<string, any>): string[] | undefined {
  const raw: string = p.allergens ?? '';
  if (raw.trim()) {
    return raw.split(',').map((a) => a.trim()).filter(Boolean);
  }
  const tags: string[] = p.allergens_tags ?? [];
  if (tags.length === 0) return undefined;
  return tags.map((t) => {
    const clean = t.replace(/^[a-z]{2,3}:/, '').replace(/-/g, ' ');
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  });
}

// Fetch product info from Open Food Facts
async function lookupBarcode(barcode: string): Promise<ScannedProduct | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json?lc=it`);
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    const p = data.product;
    const category = p.food_groups_tags?.[0]?.replace('en:', '') ?? 'Altro';
    const name = p.product_name_it ?? p.product_name ?? 'Prodotto sconosciuto';
    const brand = p.brands ?? '';
    const qty = p.quantity ?? '';
    const zone = ['carne', 'pesce', 'latticini', 'yogourt'].some((k) =>
      (p.categories_tags ?? []).some((t: string) => t.includes(k)),
    ) ? 'frigo' : 'dispensa';
    return {
      name, brand, barcode, qty,
      category: category.charAt(0).toUpperCase() + category.slice(1),
      zone: zone as any,
      tint: tintForCategory(category),
      suggestExpiry: zone === 'frigo' ? 7 : 180,
      nutrition: parseNutrition(p.nutriments),
      allergens: parseAllergens(p),
      nutriscore: parseGrade(p.nutriscore_grade),
      ecoscore: parseGrade(p.ecoscore_grade),
    };
  } catch {
    return null;
  }
}

export default function ScannerScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const { t } = useTranslation();
  const { addNewProduct } = useProducts();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<ScannedProduct | null>(null);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [selectedExpiry, setSelectedExpiry] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDateScanner, setShowDateScanner] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDay, setPickerDay] = useState('');
  const [pickerMonth, setPickerMonth] = useState('');
  const [pickerYear, setPickerYear] = useState('');
  const [zoom, setZoom] = useState(0);
  const [camKey, setCamKey] = useState(0);
  const [mountError, setMountError] = useState<string | null>(null);
  const lastScan = useRef<string>('');
  const cooldown = useRef(false);

  useEffect(() => {
    // Su web CameraView richiede da sola lo stream camera al mount: chiamare
    // qui anche requestPermission() genera una seconda richiesta concorrente
    // che su alcuni browser/webcam va in conflitto con la prima (onMountError).
    // Su nativo invece il prompt di sistema è sicuro da anticipare.
    if (!permission?.granted && Platform.OS !== 'web') requestPermission();
  }, []);

  // Su web una fotocamera "bloccata" (es. permesso "consenti una volta" già
  // consumato) fallisce silenziosamente: onMountError la intercetta e permette
  // di riprovare forzando un remount completo del componente.
  const handleMountError = ({ message }: { message: string }) => {
    setMountError(message || t('scanner.cameraUnavailableShort'));
  };

  const retryCamera = () => {
    // Se il permesso è già concesso basta rimontare CameraView (camKey):
    // chiamare anche requestPermission() qui farebbe partire una seconda
    // richiesta concorrente di getUserMedia, causa comune di un nuovo
    // onMountError su web.
    setMountError(null);
    if (permission?.granted) {
      setCamKey((k) => k + 1);
    } else {
      requestPermission();
    }
  };

  // Quando lo schermo torna a fuoco, resetta lo stato dello scanner per consentire nuove scansioni
  useEffect(() => {
    if (isFocused) {
      setScanning(true);
      setLoading(false);
      setFound(null);
      setSelectedZone(null);
      setSelectedExpiry(null);
      setShowDateScanner(false);
      setMountError(null);
      setZoom(0);
      lastScan.current = '';
      cooldown.current = false;
    } else {
      setScanning(false);
    }
  }, [isFocused]);

  const handleBarcode = async (result: BarcodeScanningResult) => {
    if (cooldown.current || !scanning || !isFocused) return;
    const code = result.data;
    if (code === lastScan.current) return;
    lastScan.current = code;

    // Questo scanner legge anche i QR (serve per i barcode EAN/UPC dei
    // prodotti, ma barcodeTypes include 'qr'): un QR d'invito a una casa
    // condivisa ci può finire per sbaglio, e va smistato al join invece che
    // cercato come se fosse un codice a barre di un prodotto.
    const inviteMatch = code.match(/^shelfy:\/\/join\/([A-Z0-9]{6})$/i);
    if (inviteMatch) {
      router.replace(`/join/${inviteMatch[1].toUpperCase()}`);
      return;
    }

    cooldown.current = true;
    setScanning(false);
    setLoading(true);

    const product = await lookupBarcode(code);
    setLoading(false);

    if (product) {
      setFound(product);
    } else {
      // Not found — set minimal mock
      setFound({
        name: t('scanner.unknownProduct'),
        brand: '',
        barcode: code,
        qty: '',
        category: 'Altro',
        zone: 'dispensa',
        tint: T.primarySoft,
        suggestExpiry: 30,
      });
    }
    // Barcode letto: passiamo subito alla fotocamera per la data di scadenza,
    // invece di far scegliere manualmente una preset. Se l'OCR non è
    // disponibile (Expo Go) restano le preset nella scheda sottostante.
    if (ocrAvailable) setShowDateScanner(true);
    setTimeout(() => { cooldown.current = false; }, 2000);
  };

  const handleEditDetails = () => {
    if (!found) return;
    router.replace({ pathname: '/add', params: { scanned: JSON.stringify(found) } });
  };

  const handleRetry = () => {
    setFound(null);
    setSelectedZone(null);
    setSelectedExpiry(null);
    setShowDateScanner(false);
    setScanning(true);
    lastScan.current = '';
  };

  const openDatePicker = () => {
    const d = selectedExpiry ? new Date(selectedExpiry + 'T00:00:00') : new Date();
    setPickerYear(String(d.getFullYear()));
    setPickerMonth(String(d.getMonth() + 1));
    setPickerDay(String(d.getDate()));
    setShowDatePicker(true);
  };

  const confirmDate = () => {
    const d = Math.max(1, Math.min(31, parseInt(pickerDay) || 1));
    const m = Math.max(1, Math.min(12, parseInt(pickerMonth) || 1));
    const y = parseInt(pickerYear) || new Date().getFullYear();
    setSelectedExpiry(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    setShowDatePicker(false);
  };

  const handleEstimate = () => {
    if (!selectedZone) {
      showAlert(t('common.estimate.chooseZoneTitle'), t('common.estimate.chooseZoneBody'));
      return;
    }
    setSelectedExpiry(addDays(ESTIMATE_DAYS[selectedZone]));
  };

  const handleQuickSave = async () => {
    if (!found || !selectedZone || !selectedExpiry) return;
    setSaving(true);
    try {
      await addNewProduct({
        name: found.name,
        brand: found.brand,
        qty: found.qty,
        count: 1,
        zone: selectedZone,
        category: found.category || 'Altro',
        expiry: selectedExpiry,
        added: new Date().toISOString().slice(0, 10),
        barcode: found.barcode,
        tint: found.tint,
        cal: found.nutrition?.calories ?? 0,
        nutrition: found.nutrition,
        allergens: found.allergens,
        nutriscore: found.nutriscore,
        ecoscore: found.ecoscore,
      });
      router.back();
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('add.errors.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 }]}>
        <Text style={[styles.hint, { fontSize: 18, textAlign: 'center' }]}>
          {t('scanner.permissionNeeded')}
        </Text>
        <TouchableOpacity style={styles.manualBtn} onPress={requestPermission}>
          <Text style={styles.manualBtnText}>{t('scanner.grantAccess')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {isFocused && !mountError && (
        <CameraView
          key={camKey}
          style={StyleSheet.absoluteFillObject}
          facing="back"
          zoom={zoom}
          onMountError={handleMountError}
          barcodeScannerSettings={{ barcodeTypes: ['ean8', 'ean13', 'upc_a', 'upc_e', 'qr', 'code128'] }}
          onBarcodeScanned={scanning ? handleBarcode : undefined}
        />
      )}

      {mountError && (
        <View style={[styles.root, styles.mountErrorBox]}>
          <Text style={[styles.hint, { fontSize: 16, textAlign: 'center' }]}>
            {t('scanner.cameraUnavailableHint')}
          </Text>
          <TouchableOpacity style={styles.manualBtn} onPress={retryCamera}>
            <Text style={styles.manualBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Dark overlay with cutout */}
      <View style={styles.overlay}>
        <View style={styles.topOverlay} />
        <View style={styles.middleRow}>
          <View style={styles.sideOverlay} />
          <View style={styles.reticle}>
            {/* Corner brackets */}
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
          </View>
          <View style={styles.sideOverlay} />
        </View>
        <View style={styles.bottomOverlay} />
      </View>

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.glassBtn}>
          <Text style={styles.glassBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('scanner.headerTitle')}</Text>
        <View style={styles.glassBtn} />
      </View>

      {/* Status text */}
      <View style={styles.statusBox}>
        {loading ? (
          <ActivityIndicator color="#fbfaf3" size="large" />
        ) : (
          <>
            <Text style={styles.statusTitle}>
              {found ? t('scanner.statusFound') : t('scanner.statusScanning')}
            </Text>
            <Text style={styles.statusSub}>
              {found
                ? `${found.brand ? found.brand + ' · ' : ''}${found.name}`
                : t('scanner.statusHoldStill')}
            </Text>
          </>
        )}
      </View>

      {/* Bottom sheet on found */}
      {found && (
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetProduct}>
            <View style={[styles.sheetTile, { backgroundColor: found.tint }]}>
              <Text style={styles.sheetTileText}>
                {getInitials(found.name)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              {found.brand ? <Text style={styles.sheetBrand}>{found.brand.toUpperCase()}</Text> : null}
              <Text style={styles.sheetName}>{found.name}</Text>
              <Text style={styles.sheetBarcode}>📊 {found.barcode}</Text>
            </View>
          </View>

          <Text style={styles.sheetSectionLabel}>{t('scanner.sheetStorageSection')}</Text>
          <View style={styles.sheetZoneRow}>
            {ZONES.map((z) => {
              const active = selectedZone === z.id;
              return (
                <TouchableOpacity
                  key={z.id}
                  style={[styles.sheetZoneBtn, active && styles.sheetZoneBtnActive]}
                  onPress={() => setSelectedZone(z.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.sheetZoneIcon}>{z.icon}</Text>
                  <Text style={[styles.sheetZoneLabel, active && styles.sheetZoneLabelActive]}>{t(z.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity style={styles.estimateBtn} onPress={handleEstimate} activeOpacity={0.85}>
            <Text style={styles.estimateBtnIcon}>🥬</Text>
            <Text style={styles.estimateBtnText}>{t('common.estimate.cta')}</Text>
          </TouchableOpacity>
          <Text style={styles.estimateDisclaimer}>
            {t('common.estimate.disclaimer')}
          </Text>

          <View style={styles.sheetExpiryHeader}>
            <Text style={styles.sheetSectionLabel}>{t('scanner.sheetExpirySection')}</Text>
            <View style={styles.sheetHeaderLinks}>
              {ocrAvailable && (
                <TouchableOpacity onPress={() => setShowDateScanner(true)} activeOpacity={0.85}>
                  <Text style={styles.sheetRescanLink}>
                    {selectedExpiry ? t('scanner.rescanLink') : t('scanner.scanDateLink')}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={openDatePicker} activeOpacity={0.85}>
                <Text style={styles.sheetRescanLink}>{t('scanner.preciseDateLink')}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.sheetPresetsRow}>
            {PRESETS.map((p) => {
              const iso = addDays(p.d);
              const active = selectedExpiry === iso;
              return (
                <TouchableOpacity
                  key={p.d}
                  style={[styles.sheetPreset, active && styles.sheetPresetActive]}
                  onPress={() => setSelectedExpiry(iso)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.sheetPresetText, active && styles.sheetPresetTextActive]}>+ {t(p.labelKey)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.sheetGhostBtn} onPress={handleRetry} activeOpacity={0.85}>
              <Text style={styles.sheetGhostBtnText}>{t('scanner.retryAction')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetGhostBtn} onPress={handleEditDetails} activeOpacity={0.85}>
              <Text style={styles.sheetGhostBtnText}>{t('scanner.editDetails')}</Text>
            </TouchableOpacity>
          </View>

          <PrimaryButton
            onPress={handleQuickSave}
            disabled={!selectedZone || !selectedExpiry}
            loading={saving}
            icon="checkmark"
            label={t('add.save')}
            fullWidth
          />
        </View>
      )}

      {/* Zoom control */}
      {!found && !mountError && (
        <View style={styles.zoomControl}>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoom((z) => Math.max(0, +(z - 0.1).toFixed(2)))}
            activeOpacity={0.85}
          >
            <Text style={styles.zoomBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
          <TouchableOpacity
            style={styles.zoomBtn}
            onPress={() => setZoom((z) => Math.min(1, +(z + 0.1).toFixed(2)))}
            activeOpacity={0.85}
          >
            <Text style={styles.zoomBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manual entry */}
      {!found && !loading && (
        <TouchableOpacity
          style={styles.manualBtn}
          onPress={() => router.push('/add')}
          activeOpacity={0.85}
        >
          <Ionicons name="pencil-outline" size={16} color="#fbfaf3" />
          <Text style={styles.manualBtnText}>{t('scanner.manualEntry')}</Text>
        </TouchableOpacity>
      )}

      <DateScannerModal
        visible={showDateScanner}
        onClose={() => setShowDateScanner(false)}
        onResult={(iso) => setSelectedExpiry(iso)}
      />

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
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowDatePicker(false)} activeOpacity={0.85}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <PrimaryButton onPress={confirmDate} label={t('common.datePicker.confirm')} containerStyle={{ flex: 1.5 }} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0d09' },

  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  topOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  middleRow: { flexDirection: 'row', height: 180 },
  sideOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  reticle: { width: 280, height: 180, position: 'relative' },
  bottomOverlay: { flex: 2, backgroundColor: 'rgba(0,0,0,0.55)' },

  corner: {
    position: 'absolute', width: 32, height: 32,
    borderColor: '#bdc9ad', borderStyle: 'solid',
  },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20,
  },
  glassBtn: {
    width: 40, height: 40, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  glassBtnText: { color: '#fff', fontSize: 18, fontFamily: FONTS.sans },
  topBarTitle: { color: '#fbfaf3', fontSize: 15, fontFamily: FONTS.sansSemiBold, letterSpacing: 0.2 },

  statusBox: {
    position: 'absolute', left: 0, right: 0, zIndex: 5,
    top: '60%', alignItems: 'center', paddingHorizontal: 40,
  },
  statusTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 26, color: '#fbfaf3',
    letterSpacing: -0.4, textAlign: 'center',
  },
  statusSub: {
    fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6,
    textAlign: 'center', fontFamily: FONTS.sans,
  },

  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 20,
    backgroundColor: T.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: Platform.OS === 'ios' ? 44 : 28,
  },
  sheetHandle: {
    width: 36, height: 4, backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 100, alignSelf: 'center', marginBottom: 18,
  },
  sheetProduct: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
  sheetTile: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  sheetTileText: { fontFamily: FONTS.serifItalic, fontSize: 28, color: 'rgba(20,28,16,0.78)' },
  sheetBrand: { fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.4 },
  sheetName: { fontSize: 17, fontFamily: FONTS.sansBold, color: T.ink, letterSpacing: -0.2, marginTop: 2 },
  sheetBarcode: { fontSize: 12, color: T.mute, marginTop: 4, fontFamily: FONTS.sans },

  sheetSectionLabel: {
    fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.6,
    marginBottom: 8, marginTop: 4,
  },
  sheetExpiryHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sheetHeaderLinks: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  sheetRescanLink: {
    fontSize: 12, fontFamily: FONTS.sansSemiBold, color: T.primary, marginBottom: 8,
  },
  sheetZoneRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  sheetZoneBtn: {
    flex: 1, backgroundColor: T.surface, borderRadius: RADIUS.md,
    paddingVertical: 12, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: T.line,
  },
  sheetZoneBtnActive: { backgroundColor: T.primary, borderColor: T.primary },
  sheetZoneIcon: { fontSize: 20 },
  sheetZoneLabel: { fontFamily: FONTS.sansSemiBold, fontSize: 12, color: T.ink },
  sheetZoneLabelActive: { color: '#fbfaf3' },

  estimateBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: T.surface, borderRadius: RADIUS.lg,
    marginBottom: 6, paddingVertical: 12,
    borderWidth: 1, borderColor: T.line,
  },
  estimateBtnIcon: { fontSize: 16 },
  estimateBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink2 },
  estimateDisclaimer: {
    fontSize: 11, fontFamily: FONTS.sans, color: T.mute,
    marginBottom: 14, lineHeight: 15,
  },

  sheetPresetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  sheetPreset: {
    backgroundColor: T.surface, borderRadius: RADIUS.md,
    paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: T.line,
  },
  sheetPresetActive: { backgroundColor: T.primary, borderColor: T.primary },
  sheetPresetText: { fontSize: 13, fontFamily: FONTS.sansSemiBold, color: T.ink2 },
  sheetPresetTextActive: { color: '#fbfaf3' },

  sheetActions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  sheetGhostBtn: {
    flex: 1, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: T.line,
  },
  sheetGhostBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.primary },


  manualBtn: {
    position: 'absolute', bottom: 50, alignSelf: 'center', zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: RADIUS.lg,
    paddingVertical: 12, paddingHorizontal: 22,
  },
  manualBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: '#fbfaf3' },
  hint: { fontFamily: FONTS.sans, color: '#fff', lineHeight: 24 },

  mountErrorBox: { justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32, zIndex: 30 },

  zoomControl: {
    position: 'absolute', right: 16, top: '38%', zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: RADIUS.pill,
    paddingVertical: 8, alignItems: 'center', gap: 6,
  },
  zoomBtn: {
    width: 36, height: 36, borderRadius: 100, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 6,
  },
  zoomBtnText: { fontSize: 20, color: '#fbfaf3', fontFamily: FONTS.sansBold, lineHeight: 22 },
  zoomLabel: { fontSize: 11, color: '#fbfaf3', fontFamily: FONTS.sansSemiBold },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { backgroundColor: T.surface, borderRadius: 24, padding: 24, width: 320, gap: 12 },
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
    flex: 1, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: T.line,
  },
  modalCancelText: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.mute },
});
