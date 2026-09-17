import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { usePantry } from '@/context/PantryContext';
import PrimaryButton from '@/components/PrimaryButton';
import { T, FONTS, RADIUS, CLAY } from '@/constants/theme';

// Destinazione del deep link shelfy://join/CODE — sia da QR letto da
// un'altra fotocamera (es. quella di sistema) sia da un link condiviso via
// chat. A differenza di app/pantry/join.tsx (inserimento manuale, sempre
// raggiungibile dall'hub), questa route tenta l'ingresso in automatico
// appena atterra, e gestisce da sola il caso "utente non loggato" — cosa che
// pantry/join.tsx non deve fare perché è sempre dietro l'auth gate delle tab.
export default function JoinByLinkScreen() {
  const { code: rawCode } = useLocalSearchParams<{ code: string }>();
  const code = (rawCode ?? '').toUpperCase();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { joinPantry, setActivePantryId } = usePantry();

  const [status, setStatus] = useState<'idle' | 'joining' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const [pantryName, setPantryName] = useState('');

  useEffect(() => {
    if (authLoading || !user || status !== 'idle') return;
    if (code.length !== 6) {
      setStatus('error');
      setError('Questo link d\'invito non è valido.');
      return;
    }

    setStatus('joining');
    joinPantry(code)
      .then((result) => {
        setActivePantryId(result.id);
        setPantryName(result.name);
        setStatus('done');
      })
      .catch((e: any) => {
        const errCode: string = e?.code ?? '';
        setError(
          errCode.includes('not-found')
            ? 'Codice non valido o scaduto. Chiedi un invito nuovo a chi ha creato la casa.'
            : errCode.includes('resource-exhausted')
              ? (e?.message ?? 'Troppi tentativi, riprova più tardi.')
              : (e?.message ?? 'Impossibile entrare nella casa'),
        );
        setStatus('error');
      });
  }, [authLoading, user, status, code]);

  if (authLoading) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <ActivityIndicator color={T.primary} />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name="log-in-outline" size={26} color={T.primary} />
          </View>
          <Text style={styles.title}>Accedi prima di entrare</Text>
          <Text style={styles.body}>
            Questo link ti invita a una casa condivisa su Shelfy. Accedi (o registrati) e poi tocca di nuovo
            il link per entrare.
          </Text>
          <PrimaryButton
            onPress={() => router.replace('/(auth)/login')}
            label="Vai al login"
            fullWidth
            containerStyle={{ marginTop: 18 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: T.urgentSoft }]}>
            <Ionicons name="alert-circle-outline" size={26} color={T.urgent} />
          </View>
          <Text style={styles.title}>Non sono riuscito a farti entrare</Text>
          <Text style={styles.body}>{error}</Text>
          <PrimaryButton
            onPress={() => router.replace('/(tabs)')}
            label="Torna alla home"
            fullWidth
            containerStyle={{ marginTop: 18 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'done') {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: T.okSoft }]}>
            <Ionicons name="checkmark-circle-outline" size={26} color={T.ok} />
          </View>
          <Text style={styles.title}>Sei entrato in "{pantryName}"</Text>
          <Text style={styles.body}>È ora la tua casa attiva.</Text>
          <PrimaryButton
            onPress={() => router.replace('/(tabs)')}
            label="Vai alla dispensa"
            fullWidth
            containerStyle={{ marginTop: 18 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, styles.center]}>
      <ActivityIndicator color={T.primary} />
      <Text style={[styles.body, { marginTop: 16 }]}>Sto entrando nella casa…</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  center: { justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    backgroundColor: T.surface, borderRadius: RADIUS.clay, padding: 24,
    width: '100%', maxWidth: 360, alignItems: 'center', boxShadow: CLAY.surface,
  },
  iconWrap: {
    width: 56, height: 56, borderRadius: RADIUS.clay, backgroundColor: T.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  title: {
    fontFamily: FONTS.serifItalic, fontSize: 21, color: T.ink,
    letterSpacing: -0.3, textAlign: 'center',
  },
  body: {
    fontFamily: FONTS.sans, fontSize: 14, color: T.mute,
    textAlign: 'center', lineHeight: 20, marginTop: 8,
  },
});
