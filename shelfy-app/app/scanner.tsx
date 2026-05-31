import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { T, FONTS, RADIUS } from '@/constants/theme';
import { ScannedProduct } from '@/types';
import { tintForCategory } from '@/lib/urgency';

// Fetch product info from Open Food Facts
async function lookupBarcode(barcode: string): Promise<ScannedProduct | null> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
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
    };
  } catch {
    return null;
  }
}

export default function ScannerScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState<ScannedProduct | null>(null);
  const lastScan = useRef<string>('');
  const cooldown = useRef(false);

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, []);

  const handleBarcode = async (result: BarcodeScanningResult) => {
    if (cooldown.current || !scanning) return;
    const code = result.data;
    if (code === lastScan.current) return;
    lastScan.current = code;
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
        name: 'Prodotto sconosciuto',
        brand: '',
        barcode: code,
        qty: '',
        category: 'Altro',
        zone: 'dispensa',
        tint: T.primarySoft,
        suggestExpiry: 30,
      });
    }
    setTimeout(() => { cooldown.current = false; }, 2000);
  };

  const handleConfirm = () => {
    if (!found) return;
    router.push({ pathname: '/add', params: { scanned: JSON.stringify(found) } });
  };

  const handleRetry = () => {
    setFound(null);
    setScanning(true);
    lastScan.current = '';
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
          Shelfy ha bisogno dell'accesso alla fotocamera per scansionare i barcode.
        </Text>
        <TouchableOpacity style={styles.manualBtn} onPress={requestPermission}>
          <Text style={styles.manualBtnText}>Concedi accesso</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['ean8', 'ean13', 'upc_a', 'upc_e', 'qr', 'code128'] }}
        onBarcodeScanned={scanning ? handleBarcode : undefined}
      />

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
        <View style={styles.modeLabel}>
          <Text style={styles.modeLabelText}>CODICE A BARRE</Text>
        </View>
        <View style={styles.glassBtn} />
      </View>

      {/* Status text */}
      <View style={styles.statusBox}>
        {loading ? (
          <ActivityIndicator color="#fbfaf3" size="large" />
        ) : (
          <>
            <Text style={styles.statusTitle}>
              {found ? 'Trovato!' : 'Inquadra il codice…'}
            </Text>
            <Text style={styles.statusSub}>
              {found
                ? `${found.brand ? found.brand + ' · ' : ''}${found.name}`
                : 'Tieni fermo per qualche secondo'}
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
                {found.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              {found.brand ? <Text style={styles.sheetBrand}>{found.brand.toUpperCase()}</Text> : null}
              <Text style={styles.sheetName}>{found.name}</Text>
              <Text style={styles.sheetBarcode}>📊 {found.barcode}</Text>
            </View>
          </View>

          <View style={styles.sheetSuggest}>
            <Text>✨ </Text>
            <Text style={styles.sheetSuggestText}>
              <Text style={{ fontFamily: FONTS.sansBold }}>Scadenza suggerita:</Text>
              {' '}circa {found.suggestExpiry} giorni · {found.zone}
            </Text>
          </View>

          <View style={styles.sheetActions}>
            <TouchableOpacity style={styles.sheetGhostBtn} onPress={handleRetry} activeOpacity={0.85}>
              <Text style={styles.sheetGhostBtnText}>Rifai scansione</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetPrimaryBtn} onPress={handleConfirm} activeOpacity={0.85}>
              <Text style={styles.sheetPrimaryBtnText}>Aggiungi ›</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Manual entry */}
      {!found && !loading && (
        <TouchableOpacity
          style={styles.manualBtn}
          onPress={() => router.push('/add')}
          activeOpacity={0.85}
        >
          <Text style={styles.manualBtnText}>✏️ Inserisci manualmente</Text>
        </TouchableOpacity>
      )}
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
  modeLabel: {
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: RADIUS.pill,
    paddingVertical: 8, paddingHorizontal: 14,
  },
  modeLabelText: { fontSize: 12, fontFamily: FONTS.sansBold, color: '#fbfaf3', letterSpacing: 0.3 },

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

  sheetSuggest: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: T.primarySoft, borderRadius: 14, padding: 12,
    marginBottom: 14,
  },
  sheetSuggestText: { fontSize: 12, color: T.primaryInk, flex: 1, fontFamily: FONTS.sans },

  sheetActions: { flexDirection: 'row', gap: 10 },
  sheetGhostBtn: {
    flex: 1, borderRadius: RADIUS.pill, paddingVertical: 16, alignItems: 'center',
    borderWidth: 1, borderColor: T.line,
  },
  sheetGhostBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 16, color: T.primary },
  sheetPrimaryBtn: {
    flex: 1.4, borderRadius: RADIUS.pill, paddingVertical: 16,
    alignItems: 'center', backgroundColor: T.primary,
  },
  sheetPrimaryBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 16, color: '#fbfaf3' },

  manualBtn: {
    position: 'absolute', bottom: 50, alignSelf: 'center', zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: RADIUS.pill,
    paddingVertical: 12, paddingHorizontal: 22,
  },
  manualBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: '#fbfaf3' },
  hint: { fontFamily: FONTS.sans, color: '#fff', lineHeight: 24 },
});
