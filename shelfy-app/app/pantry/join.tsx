import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { usePantry } from '@/context/PantryContext';
import PrimaryButton from '@/components/PrimaryButton';
import QrScannerModal from '@/components/QrScannerModal';
import { showAlert } from '@/lib/alert';
import { T, FONTS, RADIUS, CLAY } from '@/constants/theme';

export default function PantryJoinScreen() {
  const router = useRouter();
  const { joinPantry, setActivePantryId } = usePantry();
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [showScanner, setShowScanner] = useState(false);

  const attemptJoin = async (rawCode: string) => {
    if (rawCode.length !== 6) {
      showAlert('Codice incompleto', 'Il codice è di 6 caratteri.');
      return;
    }
    setJoining(true);
    try {
      const result = await joinPantry(rawCode);
      setActivePantryId(result.id);
      showAlert(
        result.alreadyMember ? 'Fatto' : 'Benvenuto! 🎉',
        result.alreadyMember
          ? `Eri già in "${result.name}". L'ho impostata come casa attiva.`
          : `Sei entrato in "${result.name}" ed è ora la tua casa attiva.`,
      );
      router.replace('/(tabs)');
    } catch (e: any) {
      const errCode: string = e?.code ?? '';
      const message = errCode.includes('not-found')
        ? 'Codice non valido o scaduto. Chiedi un codice nuovo a chi ha creato la casa.'
        : errCode.includes('resource-exhausted')
          ? (e?.message ?? 'Troppi tentativi, riprova più tardi.')
          : (e?.message ?? 'Impossibile entrare nella casa');
      showAlert('Errore', message);
    } finally {
      setJoining(false);
    }
  };

  const handleJoin = () => attemptJoin(code.trim());

  const handleScanResult = (scannedCode: string) => {
    setShowScanner(false);
    setCode(scannedCode);
    attemptJoin(scannedCode);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.navBtn} activeOpacity={0.85}>
          <Ionicons name="chevron-back" size={20} color={T.ink} />
        </TouchableOpacity>
        <Text style={styles.title}>Entra con un codice</Text>
        <View style={styles.navBtn} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.body}>
          <View style={styles.iconWrap}>
            <Ionicons name="key-outline" size={28} color={T.primary} />
          </View>
          <Text style={styles.lead}>Chiedi il codice a 6 caratteri a chi ha creato la casa</Text>
          <Text style={styles.sub}>O inquadra il suo QR d'invito</Text>

          <TouchableOpacity
            style={styles.scanBtn}
            onPress={() => setShowScanner(true)}
            activeOpacity={0.85}
          >
            <Ionicons name="qr-code-outline" size={18} color={T.primary} />
            <Text style={styles.scanBtnText}>Scansiona il QR</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>oppure digita il codice</Text>
            <View style={styles.dividerLine} />
          </View>

          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
            placeholder="ABC123"
            placeholderTextColor={T.mute}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
          />

          <PrimaryButton
            onPress={handleJoin}
            loading={joining}
            disabled={code.length !== 6}
            icon="log-in-outline"
            label="Entra nella casa"
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>

      <QrScannerModal
        visible={showScanner}
        onClose={() => setShowScanner(false)}
        onResult={handleScanResult}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: RADIUS.input, backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center', boxShadow: CLAY.chip,
  },
  title: { fontFamily: FONTS.serifItalic, fontSize: 20, color: T.ink, letterSpacing: -0.3 },

  body: { flex: 1, alignItems: 'center', padding: 24, paddingTop: 32 },
  iconWrap: {
    width: 64, height: 64, borderRadius: RADIUS.clay, backgroundColor: T.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20, boxShadow: CLAY.chip,
  },
  lead: {
    fontFamily: FONTS.sansSemiBold, fontSize: 16, color: T.ink,
    textAlign: 'center', lineHeight: 22,
  },
  sub: {
    fontFamily: FONTS.sans, fontSize: 13, color: T.mute,
    textAlign: 'center', marginTop: 6, marginBottom: 20,
  },
  scanBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%', backgroundColor: T.primarySoft, borderRadius: RADIUS.lg,
    paddingVertical: 14,
  },
  scanBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.primaryInk },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, width: '100%', marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: T.line },
  dividerText: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute },
  codeInput: {
    width: '100%', backgroundColor: '#ece8de', borderRadius: RADIUS.clay,
    paddingVertical: 18, marginBottom: 24, boxShadow: CLAY.inset,
    fontFamily: FONTS.sansBold, fontSize: 30, color: T.ink,
    textAlign: 'center', letterSpacing: 8,
  },
});
