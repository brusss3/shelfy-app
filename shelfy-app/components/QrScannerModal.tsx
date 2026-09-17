import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { T, FONTS, RADIUS } from '@/constants/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Chiamata col codice a 6 caratteri estratto da un QR `shelfy://join/CODE`. */
  onResult: (code: string) => void;
}

// Riconosce un QR d'invito nel testo scansionato: sia il deep link completo
// (shelfy://join/ABC123, quello che genera il QR in app/pantry/[id].tsx) sia,
// per tolleranza, un QR che contenesse solo il codice nudo.
function extractInviteCode(raw: string): string | null {
  const deepLink = raw.match(/shelfy:\/\/join\/([A-Z0-9]{6})/i);
  if (deepLink) return deepLink[1].toUpperCase();
  const bare = raw.trim();
  if (/^[A-Z0-9]{6}$/i.test(bare)) return bare.toUpperCase();
  return null;
}

// Fotocamera a tutto schermo dedicata a leggere il QR di un invito — niente
// scatto/OCR come DateScannerModal, il riconoscimento QR è continuo e nativo
// (expo-camera), basta filtrare i risultati che non sono un invito valido.
export default function QrScannerModal({ visible, onClose, onResult }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mountError, setMountError] = useState<string | null>(null);
  const [notAnInvite, setNotAnInvite] = useState(false);
  const cooldown = useRef(false);

  useEffect(() => {
    if (visible) {
      setMountError(null);
      setNotAnInvite(false);
      cooldown.current = false;
    }
  }, [visible]);

  if (!visible) return null;

  const handleMountError = ({ message }: { message: string }) => {
    setMountError(message || 'Fotocamera non disponibile.');
  };

  const handleScan = (result: BarcodeScanningResult) => {
    if (cooldown.current) return;
    const code = extractInviteCode(result.data);
    if (!code) {
      // QR di qualcos'altro (es. un prodotto): lo segnaliamo senza chiudere,
      // l'utente può ricentrare quello giusto.
      setNotAnInvite(true);
      return;
    }
    cooldown.current = true;
    setNotAnInvite(false);
    onResult(code);
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
            <Text style={styles.hint}>Shelfy ha bisogno della fotocamera per leggere il QR d'invito.</Text>
            <TouchableOpacity style={styles.grantBtn} onPress={requestPermission} activeOpacity={0.85}>
              <Text style={styles.grantBtnText}>Concedi accesso</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.closeLink}>Annulla</Text>
            </TouchableOpacity>
          </View>
        ) : mountError ? (
          <View style={[styles.center, { gap: 16, padding: 32 }]}>
            <Text style={styles.hint}>Fotocamera non disponibile.</Text>
            <TouchableOpacity onPress={onClose} activeOpacity={0.85}>
              <Text style={styles.closeLink}>Chiudi</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFillObject}
              facing="back"
              onMountError={handleMountError}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleScan}
            />

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

            <View style={styles.topBar}>
              <TouchableOpacity onPress={onClose} style={styles.glassBtn} activeOpacity={0.85}>
                <Text style={styles.glassBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.statusBox}>
              <Text style={styles.statusTitle}>Inquadra il QR d'invito</Text>
              <Text style={styles.statusSub}>
                {notAnInvite ? 'Questo QR non è un invito Shelfy — riprova.' : 'Te lo mostra chi ha creato la casa'}
              </Text>
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
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: RADIUS.lg,
    paddingVertical: 12, paddingHorizontal: 22,
  },
  grantBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: '#fbfaf3' },

  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 1 },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  reticleRow: { flexDirection: 'row', height: 240 },
  dimSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  reticle: { width: 240, height: 240, position: 'relative' },
  corner: { position: 'absolute', width: 32, height: 32, borderColor: '#bdc9ad' },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 10 },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 20,
  },
  glassBtn: {
    width: 40, height: 40, borderRadius: 100, backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  glassBtnText: { color: '#fff', fontSize: 18, fontFamily: FONTS.sans },

  statusBox: {
    position: 'absolute', left: 0, right: 0, zIndex: 5,
    bottom: '18%', alignItems: 'center', paddingHorizontal: 40,
  },
  statusTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 24, color: '#fbfaf3',
    letterSpacing: -0.4, textAlign: 'center',
  },
  statusSub: {
    fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 8,
    textAlign: 'center', fontFamily: FONTS.sans,
  },
});
