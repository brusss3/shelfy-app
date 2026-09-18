import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, Platform, ActivityIndicator, Modal, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { useTranslation } from 'react-i18next';
import { T, FONTS, RADIUS, SHADOW, CLAY } from '@/constants/theme';
import { showAlert } from '@/lib/alert';
import { recognizeText } from '@/lib/ocr';
import { parseExpiry, type DateFormat } from '@/lib/parseExpiry';

// Dimensioni del mirino (vedi styles.reticle/reticleRow più sotto): usate per
// ritagliare lo scatto alla sola area inquadrata invece di passare l'intera
// foto all'OCR, che altrimenti legge anche ingredienti/prezzo/barcode intorno
// alla data e sceglie la scadenza sbagliata.
const RETICLE_W = 280;
const RETICLE_H = 150;

interface CapturedPhoto {
  uri: string;
  width: number;
  height: number;
  base64?: string | null;
}

// Ritaglia lo scatto all'area del mirino (più un margine di sicurezza, per
// compensare il fatto che l'anteprima camera è in "cover" mentre la foto
// scattata può avere un aspect ratio leggermente diverso da quello schermo)
// e la ingrandisce se il ritaglio risulta piccolo, per aiutare l'OCR a
// leggere caratteri piccoli/incisi. In caso di errore ritorna la foto intera
// (comportamento precedente) invece di far fallire lo scatto.
async function cropToReticle(photo: CapturedPhoto): Promise<string> {
  const fallback = photo.base64 ?? photo.uri;
  try {
    const screen = Dimensions.get('window');
    if (!photo.width || !photo.height || !screen.width || !screen.height) return fallback;

    const scaleX = photo.width / screen.width;
    const scaleY = photo.height / screen.height;

    // Layout del mirino in DateScannerModal: riga fissa RETICLE_H centrata,
    // spazio restante diviso flex 1 (sopra) / 2 (sotto) — vedi styles.overlay.
    const sideW = (screen.width - RETICLE_W) / 2;
    const topH = (screen.height - RETICLE_H) / 3;

    const marginX = RETICLE_W * 0.15;
    const marginY = RETICLE_H * 0.35;

    const boxX = Math.max(0, sideW - marginX);
    const boxY = Math.max(0, topH - marginY);
    const boxW = Math.min(screen.width - boxX, RETICLE_W + marginX * 2);
    const boxH = Math.min(screen.height - boxY, RETICLE_H + marginY * 2);

    const originX = Math.round(boxX * scaleX);
    const originY = Math.round(boxY * scaleY);
    const width = Math.min(photo.width - originX, Math.round(boxW * scaleX));
    const height = Math.min(photo.height - originY, Math.round(boxH * scaleY));
    if (width < 20 || height < 20) return fallback;

    const actions: ImageManipulator.Action[] = [{ crop: { originX, originY, width, height } }];
    // Ingrandisce i ritagli piccoli: aiuta l'OCR su testo minuto/inciso senza
    // appesantire inutilmente i ritagli già ad alta risoluzione.
    if (width < 900) actions.push({ resize: { width: 900 } });

    const result = await ImageManipulator.manipulateAsync(photo.uri, actions, {
      compress: 0.92,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: Platform.OS === 'web',
    });
    return result.base64 ? `data:image/jpeg;base64,${result.base64}` : result.uri;
  } catch {
    return fallback;
  }
}

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Chiamata con la data ISO (YYYY-MM-DD) riconosciuta dall'OCR. */
  onResult: (iso: string) => void;
}

// Formati selezionabili prima dello scatto: aiutano l'OCR a disambiguare.
// Conta solo l'ordine dei campi: separatori (/ . -) e anno a 2/4 cifre
// sono sempre accettati.
const FORMATS: { id: DateFormat; labelKey: string }[] = [
  { id: 'auto', labelKey: 'dateScanner.formats.auto' },
  { id: 'dmy', labelKey: 'dateScanner.formats.dmy' },
  { id: 'mdy', labelKey: 'dateScanner.formats.mdy' },
  { id: 'ymd', labelKey: 'dateScanner.formats.ymd' },
  { id: 'my', labelKey: 'dateScanner.formats.my' },
];

// Fotocamera a tutto schermo che scatta una foto della scadenza, ne estrae
// la data via OCR e la restituisce al chiamante. Usata dalla form prodotto.
export default function DateScannerModal({ visible, onClose, onResult }: Props) {
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [ocrLoading, setOcrLoading] = useState(false);
  const [format, setFormat] = useState<DateFormat>('auto');
  const [zoom, setZoom] = useState(0);
  const [camKey, setCamKey] = useState(0);
  const [mountError, setMountError] = useState<string | null>(null);
  // 'camera': inquadra e scatta. 'confirm': la data letta (o inserita a mano)
  // è mostrata modificabile prima di essere restituita al chiamante — un
  // OCR letto male (es. 16→18) altrimenti finiva salvato senza controllo.
  const [stage, setStage] = useState<'camera' | 'confirm'>('camera');
  const [pickerDay, setPickerDay] = useState('');
  const [pickerMonth, setPickerMonth] = useState('');
  const [pickerYear, setPickerYear] = useState('');
  const camRef = useRef<CameraView>(null);

  useEffect(() => {
    if (visible) {
      setMountError(null);
      setStage('camera');
    }
  }, [visible]);

  const openManualEntry = () => {
    const d = new Date();
    setPickerDay(String(d.getDate()));
    setPickerMonth(String(d.getMonth() + 1));
    setPickerYear(String(d.getFullYear()));
    setStage('confirm');
  };

  const confirmDate = () => {
    const d = Math.max(1, Math.min(31, parseInt(pickerDay) || 1));
    const m = Math.max(1, Math.min(12, parseInt(pickerMonth) || 1));
    const y = parseInt(pickerYear) || new Date().getFullYear();
    onResult(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    onClose();
  };

  if (!visible) return null;

  const handleMountError = ({ message }: { message: string }) => {
    setMountError(message || 'Fotocamera non disponibile.');
  };

  const retryCamera = () => {
    // Se il permesso è già concesso, basta rimontare CameraView (cambia
    // camKey): richiede da sola un nuovo stream. Chiamare anche
    // requestPermission() qui creerebbe una seconda richiesta concorrente
    // di getUserMedia, causa comune di un nuovo onMountError su web.
    setMountError(null);
    if (permission?.granted) {
      setCamKey((k) => k + 1);
    } else {
      requestPermission();
    }
  };

  const handleCapture = async () => {
    if (ocrLoading) return;
    setOcrLoading(true);
    try {
      const photo = await camRef.current?.takePictureAsync({
        quality: 1,
        base64: Platform.OS === 'web',
      });
      if (!photo) throw new Error(t('dateScanner.captureFailed'));

      const src = await cropToReticle(photo);
      const text = await recognizeText(src);
      const iso = parseExpiry(text, format);

      if (iso) {
        const [y, m, dd] = iso.split('-');
        setPickerYear(y);
        setPickerMonth(String(parseInt(m, 10)));
        setPickerDay(String(parseInt(dd, 10)));
        setStage('confirm');
      } else {
        showAlert(
          t('dateScanner.notFoundTitle'),
          t('dateScanner.notFoundBody'),
        );
      }
    } catch (e: any) {
      showAlert(t('dateScanner.ocrErrorTitle'), e?.message ?? t('common.retry'));
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {!permission ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : !permission.granted ? (
          <View style={[styles.center, { gap: 16, padding: 32 }]}>
            <Text style={styles.hint}>
              {t('dateScanner.permissionHint')}
            </Text>
            <TouchableOpacity style={styles.grantBtn} onPress={requestPermission} activeOpacity={0.85}>
              <Text style={styles.grantBtnText}>{t('scanner.grantAccess')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.closeLink}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : mountError ? (
          <View style={[styles.center, { gap: 16, padding: 32 }]}>
            <Text style={styles.hint}>
              {t('scanner.cameraUnavailableHint')}
            </Text>
            <TouchableOpacity style={styles.grantBtn} onPress={retryCamera} activeOpacity={0.85}>
              <Text style={styles.grantBtnText}>{t('common.retry')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.closeLink}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        ) : stage === 'confirm' ? (
          <View style={styles.confirmRoot}>
            <View style={styles.confirmCard}>
              <Text style={styles.confirmTitle}>{t('dateScanner.confirmTitle')}</Text>
              <Text style={styles.confirmSub}>{t('dateScanner.confirmSub')}</Text>
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
              <View style={styles.confirmBtns}>
                <TouchableOpacity style={styles.confirmGhost} onPress={() => setStage('camera')} activeOpacity={0.85}>
                  <Text style={styles.confirmGhostText}>{t('dateScanner.retakePhoto')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmPrimary} onPress={confirmDate} activeOpacity={0.85}>
                  <Text style={styles.confirmPrimaryText}>{t('common.datePicker.confirm')}</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={onClose} activeOpacity={0.85} style={{ alignSelf: 'center', marginTop: 4 }}>
                <Text style={styles.closeLink}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <CameraView
              key={camKey}
              ref={camRef}
              style={StyleSheet.absoluteFillObject}
              facing="back"
              zoom={zoom}
              onMountError={handleMountError}
            />

            {/* Controllo zoom */}
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

            {/* Overlay con mirino */}
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.dim} />
              <View style={styles.reticleRow}>
                <View style={styles.dimSide} />
                <View style={styles.reticle}>
                  <View style={[styles.corner, styles.tl]} />
                  <View style={[styles.corner, styles.tr]} />
                  <View style={[styles.corner, styles.bl]} />
                  <View style={[styles.corner, styles.br]} />
                </View>
                <View style={styles.dimSide} />
              </View>
              <View style={[styles.dim, { flex: 2 }]} />
            </View>

            {/* Top bar */}
            <View style={styles.topBar}>
              <TouchableOpacity onPress={onClose} style={styles.glassBtn} activeOpacity={0.85}>
                <Text style={styles.glassBtnText}>✕</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={openManualEntry} style={styles.glassBtnWide} activeOpacity={0.85}>
                <Ionicons name="pencil-outline" size={15} color="#fbfaf3" />
                <Text style={styles.glassBtnWideText}>{t('dateScanner.manualEntry')}</Text>
              </TouchableOpacity>
            </View>

            {/* Status */}
            <View style={styles.statusBox}>
              {ocrLoading ? (
                <>
                  <ActivityIndicator color="#fbfaf3" size="large" />
                  <Text style={styles.statusSub}>{t('dateScanner.statusReading')}</Text>
                </>
              ) : (
                <>
                  <Text style={styles.statusTitle}>{t('dateScanner.statusTitle')}</Text>
                  <Text style={styles.statusSub}>{t('dateScanner.statusSub')}</Text>
                </>
              )}
            </View>

            {/* Selettore formato data */}
            <View style={styles.formatBar}>
              <Text style={styles.formatHint}>{t('dateScanner.formatHint')}</Text>
              <View style={styles.formatChips}>
                {FORMATS.map((f) => {
                  const active = format === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.formatChip, active && styles.formatChipActive]}
                      onPress={() => setFormat(f.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.formatChipText, active && styles.formatChipTextActive]}>
                        {t(f.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Shutter */}
            <View style={styles.shutterWrap}>
              <TouchableOpacity
                style={[styles.shutterBtn, ocrLoading && { opacity: 0.5 }]}
                onPress={handleCapture}
                disabled={ocrLoading}
                activeOpacity={0.85}
              >
                <View style={styles.shutterInner} />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0d09' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  hint: { fontFamily: FONTS.sans, color: '#fff', fontSize: 18, textAlign: 'center', lineHeight: 24 },
  closeLink: { fontFamily: FONTS.sansSemiBold, color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  grantBtn: {
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: RADIUS.pill,
    paddingVertical: 12, paddingHorizontal: 22,
  },
  grantBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: '#fbfaf3' },

  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  reticleRow: { flexDirection: 'row', height: 150 },
  dimSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  reticle: { width: 280, height: 150, position: 'relative' },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: '#bdc9ad' },
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
  glassBtnWide: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 40, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
  },
  glassBtnWideText: { color: '#fbfaf3', fontSize: 13, fontFamily: FONTS.sansSemiBold },

  confirmRoot: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  confirmCard: {
    width: '100%', maxWidth: 340, backgroundColor: T.surface, borderRadius: RADIUS.clay,
    padding: 24, gap: 14, ...SHADOW.card,
  },
  confirmTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 24, color: T.ink, letterSpacing: -0.4,
  },
  confirmSub: { fontSize: 13, fontFamily: FONTS.sans, color: T.mute, marginTop: -8 },
  pickerRow: { flexDirection: 'row', gap: 12 },
  pickerCol: { flex: 1, alignItems: 'center', gap: 6 },
  pickerLabel: { fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.4 },
  pickerInput: {
    width: '100%', textAlign: 'center', backgroundColor: '#ece8de', borderRadius: RADIUS.input,
    paddingVertical: 12, fontSize: 20, fontFamily: FONTS.sansBold, color: T.ink,
    boxShadow: CLAY.inset,
  },
  confirmBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  confirmGhost: {
    flex: 1, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center',
    borderWidth: 1, borderColor: T.line,
  },
  confirmGhostText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.mute },
  confirmPrimary: {
    flex: 1.5, borderRadius: RADIUS.lg, paddingVertical: 14, alignItems: 'center',
    backgroundColor: T.primary,
  },
  confirmPrimaryText: { fontFamily: FONTS.sansBold, fontSize: 15, color: '#fbfaf3' },

  zoomControl: {
    position: 'absolute', right: 16, top: '30%', zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: RADIUS.pill,
    paddingVertical: 8, alignItems: 'center', gap: 6,
  },
  zoomBtn: {
    width: 36, height: 36, borderRadius: 100, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 6,
  },
  zoomBtnText: { fontSize: 20, color: '#fbfaf3', fontFamily: FONTS.sansBold, lineHeight: 22 },
  zoomLabel: { fontSize: 11, color: '#fbfaf3', fontFamily: FONTS.sansSemiBold },

  statusBox: {
    position: 'absolute', left: 0, right: 0, zIndex: 5,
    top: '58%', alignItems: 'center', paddingHorizontal: 40,
  },
  statusTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 26, color: '#fbfaf3',
    letterSpacing: -0.4, textAlign: 'center',
  },
  statusSub: {
    fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 6,
    textAlign: 'center', fontFamily: FONTS.sans,
  },

  formatBar: { position: 'absolute', bottom: 150, left: 0, right: 0, zIndex: 10, alignItems: 'center', gap: 8 },
  formatHint: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontFamily: FONTS.sans },
  formatChips: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, flexWrap: 'wrap', justifyContent: 'center' },
  formatChip: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: RADIUS.pill,
    paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  formatChipActive: { backgroundColor: '#bdc9ad', borderColor: '#bdc9ad' },
  formatChipText: { fontSize: 13, fontFamily: FONTS.sansSemiBold, color: 'rgba(255,255,255,0.85)' },
  formatChipTextActive: { color: '#141c10' },

  shutterWrap: { position: 'absolute', bottom: 50, left: 0, right: 0, zIndex: 10, alignItems: 'center' },
  shutterBtn: {
    width: 74, height: 74, borderRadius: 100, borderWidth: 4, borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 100, backgroundColor: '#fbfaf3' },
});
