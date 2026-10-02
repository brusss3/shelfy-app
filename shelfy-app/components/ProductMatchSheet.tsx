import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, ScrollView, StyleSheet, Platform,
  KeyboardAvoidingView, ActivityIndicator, Pressable,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { T, FONTS, RADIUS, CLAY } from '@/constants/theme';
import { useProducts } from '@/context/ProductsContext';
import { searchProducts, ProductSuggestion } from '@/lib/productSearch';

interface Props {
  visible: boolean;
  /** Nome letto dallo scontrino: è il punto di partenza della ricerca. */
  initialQuery: string;
  onPick: (p: ProductSuggestion) => void;
  onClose: () => void;
}

// Collega una riga dello scontrino a un prodotto con barcode: i nomi stampati
// sono abbreviati ("SEM BARILLA 500"), quindi si propongono prodotti simili
// (dalla dispensa e da Open Food Facts) e, se non basta, si scansiona la
// confezione. Senza barcode un prezzo non può essere salvato.
export default function ProductMatchSheet({ visible, initialQuery, onPick, onClose }: Props) {
  const { t } = useTranslation();
  const { products } = useProducts();
  const [query, setQuery] = useState(initialQuery);
  const [remote, setRemote] = useState<ProductSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);

  useEffect(() => {
    if (visible) {
      setQuery(initialQuery);
      setRemote([]);
      setScanning(false);
      scanned.current = false;
    }
  }, [visible, initialQuery]);

  // Open Food Facts concede ~10 ricerche al minuto: si cerca solo quando
  // l'utente smette di scrivere.
  useEffect(() => {
    if (!visible || query.trim().length < 3) { setRemote([]); setSearching(false); return; }
    setSearching(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      searchProducts(query, ctrl.signal).then((res) => {
        if (ctrl.signal.aborted) return;
        setRemote(res);
        setSearching(false);
      });
    }, 700);
    return () => { clearTimeout(timer); ctrl.abort(); };
  }, [query, visible]);

  // Prima ciò che hai già in casa con un barcode: è quasi sempre lo stesso articolo.
  const pantryMatches = useMemo<ProductSuggestion[]>(() => {
    const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
    if (words.length === 0) return [];
    const seen = new Set<string>();
    const out: ProductSuggestion[] = [];
    for (const p of products) {
      if (!p.barcode || seen.has(p.barcode)) continue;
      const hay = `${p.name} ${p.brand ?? ''}`.toLowerCase();
      if (!words.some((w) => hay.includes(w))) continue;
      seen.add(p.barcode);
      out.push({ barcode: p.barcode, name: p.name, brand: p.brand ?? '', qty: p.qty ?? '' });
      if (out.length >= 3) break;
    }
    return out;
  }, [query, products]);

  const suggestions = useMemo(() => {
    const seen = new Set(pantryMatches.map((p) => p.barcode));
    return [...pantryMatches, ...remote.filter((r) => !seen.has(r.barcode))];
  }, [pantryMatches, remote]);

  const handleScan = (r: BarcodeScanningResult) => {
    if (scanned.current || !/^\d{8,14}$/.test(r.data)) return;
    scanned.current = true;
    onPick({ barcode: r.data, name: '', brand: '', qty: '' });
  };

  const startScan = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) return;
    }
    scanned.current = false;
    setScanning(true);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text style={styles.title}>{t('receiptReview.match.title')}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
                <Ionicons name="close" size={24} color={T.ink2} />
              </TouchableOpacity>
            </View>

            {scanning ? (
              <View style={styles.cameraWrap}>
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['ean8', 'ean13', 'upc_a', 'upc_e'] }}
                  onBarcodeScanned={handleScan}
                  onMountError={() => setScanning(false)}
                />
                <Text style={styles.cameraHint}>{t('receiptReview.match.scanHint')}</Text>
                <TouchableOpacity style={styles.cameraBack} onPress={() => setScanning(false)} activeOpacity={0.85}>
                  <Text style={styles.cameraBackText}>{t('receiptReview.match.backToSearch')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.body}>
                <View style={styles.inputWrap}>
                  <Ionicons name="search" size={16} color={T.mute} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={t('receiptReview.match.searchPlaceholder')}
                    placeholderTextColor={T.mute}
                    style={styles.input}
                    autoCapitalize="none"
                  />
                </View>

                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 260 }}>
                  {suggestions.map((s) => (
                    <TouchableOpacity key={s.barcode} style={styles.row} onPress={() => onPick(s)} activeOpacity={0.7}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rowName} numberOfLines={1}>{s.name}</Text>
                        <Text style={styles.rowSub} numberOfLines={1}>
                          {[pantryMatches.some((p) => p.barcode === s.barcode) ? t('shopping.fromPantry') : null, s.brand, s.qty]
                            .filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                  {searching && (
                    <View style={styles.searching}>
                      <ActivityIndicator size="small" color={T.mute} />
                      <Text style={styles.rowSub}>{t('shopping.searching')}</Text>
                    </View>
                  )}
                  {!searching && suggestions.length === 0 && query.trim().length >= 3 && (
                    <Text style={styles.empty}>{t('receiptReview.match.noResults')}</Text>
                  )}
                </ScrollView>

                <TouchableOpacity style={styles.scanBtn} onPress={startScan} activeOpacity={0.85}>
                  <Ionicons name="barcode-outline" size={18} color={T.primary} />
                  <Text style={styles.scanBtnText}>{t('receiptReview.match.scan')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(20,28,18,0.42)', justifyContent: 'flex-end' },
  kav: { width: '100%', alignItems: 'center' },
  sheet: {
    width: '100%', maxWidth: 560, maxHeight: '88%',
    backgroundColor: T.bg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingTop: 8, paddingBottom: 20,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: T.line, marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontFamily: FONTS.sansBold, fontSize: 20, color: T.ink, letterSpacing: -0.3 },
  body: { paddingHorizontal: 16, gap: 10 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: RADIUS.input,
    paddingHorizontal: 16, backgroundColor: T.bg, boxShadow: CLAY.inset,
  },
  input: {
    flex: 1, fontSize: 16, fontFamily: FONTS.sans, color: T.ink,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  row: { paddingVertical: 11, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: T.line },
  rowName: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
  rowSub: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute, marginTop: 1 },
  searching: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  empty: { fontFamily: FONTS.sans, fontSize: 13, color: T.mute, paddingVertical: 12 },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 13, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: T.line,
  },
  scanBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.primary },
  cameraWrap: { height: 320, marginHorizontal: 16, borderRadius: RADIUS.lg, overflow: 'hidden', backgroundColor: '#0a0d09' },
  cameraHint: {
    position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center',
    fontFamily: FONTS.sansSemiBold, fontSize: 14, color: '#fbfaf3',
  },
  cameraBack: {
    position: 'absolute', bottom: 14, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: RADIUS.pill, paddingVertical: 9, paddingHorizontal: 18,
  },
  cameraBackText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: '#fbfaf3' },
});
