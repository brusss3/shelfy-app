import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FONTS, RADIUS } from '@/constants/theme';
import { showAlert } from '@/lib/alert';
import { recognizeText } from '@/lib/ocr';
import TutorialModal, { useTutorial } from '@/components/Tutorial';
import { mergeReceipts, parseReceipt, type ParsedReceipt } from '@/lib/parseReceipt';

// Fotocamera full-screen per fotografare uno scontrino: scatta, estrae il
// testo via OCR e ne ricava righe prodotto, prezzi, catena, comune e data
// (euristiche, niente AI). Si possono scattare più foto (intestazione, poi i
// prodotti); con "Fatto" si passa alla schermata di revisione per la conferma.
// Un breve tutorial si apre da solo la prima volta e dal bottone "?".
export default function ReceiptScanScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [permission, requestPermission] = useCameraPermissions();
  const [ocrLoading, setOcrLoading] = useState(false);
  const [parts, setParts] = useState<ParsedReceipt[]>([]);
  const tutorial = useTutorial('receiptScan');
  const [zoom, setZoom] = useState(0);
  const [camKey, setCamKey] = useState(0);
  const [mountError, setMountError] = useState<string | null>(null);
  const camRef = useRef<CameraView>(null);

  const handleMountError = ({ message }: { message: string }) => {
    setMountError(message || t('scanner.cameraUnavailableShort'));
  };

  const retryCamera = () => {
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
      if (!photo) throw new Error(t('receiptScan.captureFailed'));

      const src = photo.base64 ?? photo.uri;
      const text = await recognizeText(src);
      const parsed = parseReceipt(text);

      // Una foto di sola intestazione non ha righe ma porta catena e comune.
      if (parsed.lines.length === 0 && !parsed.chain && !parsed.city) {
        showAlert(
          t('receiptScan.noItemsTitle'),
          t('receiptScan.noItemsBody'),
        );
        return;
      }

      setParts((prev) => [...prev, parsed]);
    } catch (e: any) {
      showAlert(t('dateScanner.ocrErrorTitle'), e?.message ?? t('common.retry'));
    } finally {
      setOcrLoading(false);
    }
  };

  // Più foto dello stesso scontrino (intestazione + prodotti) si fondono in un
  // solo risultato; la revisione resta una sola.
  const handleDone = () => {
    const merged = mergeReceipts(parts);
    if (merged.lines.length === 0) {
      showAlert(t('receiptScan.noItemsTitle'), t('receiptScan.noItemsBody'));
      return;
    }
    router.replace({
      pathname: '/receipt-review',
      params: {
        items: JSON.stringify(merged.lines),
        chain: merged.chain ?? '',
        date: merged.date ?? '',
        city: merged.city ?? '',
      },
    });
  };

  if (!permission) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.center, { gap: 16, padding: 32 }]}>
        <Text style={styles.hint}>
          {t('receiptScan.permissionHint')}
        </Text>
        <TouchableOpacity style={styles.grantBtn} onPress={requestPermission} activeOpacity={0.85}>
          <Text style={styles.grantBtnText}>{t('scanner.grantAccess')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.85}>
          <Text style={styles.closeLink}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {!mountError && (
        <CameraView
          key={camKey}
          ref={camRef}
          style={StyleSheet.absoluteFill}
          facing="back"
          zoom={zoom}
          onMountError={handleMountError}
        />
      )}

      {mountError && (
        <View style={[styles.root, styles.center, { gap: 16, padding: 32 }]}>
          <Text style={styles.hint}>
            {t('scanner.cameraUnavailableHint')}
          </Text>
          <TouchableOpacity style={styles.grantBtn} onPress={retryCamera} activeOpacity={0.85}>
            <Text style={styles.grantBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Zoom control */}
      {!mountError && (
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

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.glassBtn} activeOpacity={0.85}>
          <Text style={styles.glassBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>{t('receiptScan.headerTitle')}</Text>
        <TouchableOpacity onPress={tutorial.open} style={styles.glassBtn} activeOpacity={0.85}>
          <Text style={styles.glassBtnText}>?</Text>
        </TouchableOpacity>
      </View>

      <TutorialModal id="receiptScan" visible={tutorial.visible} onClose={tutorial.close} />

      {/* Status */}
      <View style={styles.statusBox}>
        {ocrLoading ? (
          <>
            <ActivityIndicator color="#fbfaf3" size="large" />
            <Text style={styles.statusSub}>{t('receiptScan.statusReading')}</Text>
          </>
        ) : (
          <>
            <Text style={styles.statusTitle}>{t('receiptScan.statusTitle')}</Text>
            <Text style={styles.statusSub}>
              {parts.length > 0
                ? t('receiptScan.statusSubMore', { count: parts.length })
                : `${t('receiptScan.statusSub')}\n${t('receiptScan.statusSubFirst')}`}
            </Text>
          </>
        )}
      </View>

      {/* Shutter */}
      {!mountError && (
        <View style={styles.shutterWrap}>
          <TouchableOpacity
            style={[styles.shutterBtn, ocrLoading && { opacity: 0.5 }]}
            onPress={handleCapture}
            disabled={ocrLoading}
            activeOpacity={0.85}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>
          {parts.length > 0 && (
            <TouchableOpacity
              style={[styles.doneBtn, ocrLoading && { opacity: 0.5 }]}
              onPress={handleDone}
              disabled={ocrLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.doneBtnText}>{t('receiptScan.doneBtn', { count: parts.length })}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0d09' },
  center: { justifyContent: 'center', alignItems: 'center' },
  hint: { fontFamily: FONTS.sans, color: '#fff', fontSize: 18, textAlign: 'center', lineHeight: 24 },
  closeLink: { fontFamily: FONTS.sansSemiBold, color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  grantBtn: {
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: RADIUS.pill,
    paddingVertical: 12, paddingHorizontal: 22,
  },
  grantBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: '#fbfaf3' },

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

  shutterWrap: { position: 'absolute', bottom: 50, left: 0, right: 0, zIndex: 10, alignItems: 'center' },
  shutterBtn: {
    width: 74, height: 74, borderRadius: 100, borderWidth: 4, borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterInner: { width: 58, height: 58, borderRadius: 100, backgroundColor: '#fbfaf3' },
  doneBtn: {
    position: 'absolute', right: 24, top: 14,
    backgroundColor: '#fbfaf3', borderRadius: RADIUS.pill,
    paddingVertical: 12, paddingHorizontal: 20,
  },
  doneBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: '#0a0d09' },
});
