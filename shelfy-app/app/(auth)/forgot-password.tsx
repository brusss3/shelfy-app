import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { authErrorMessage } from '@/lib/authErrors';
import { showAlert } from '@/lib/alert';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();
  const router = useRouter();

  const handleReset = async () => {
    if (!email.trim()) {
      showAlert('Errore', 'Inserisci la tua email');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(email.trim());
      // Per motivi di sicurezza Firebase non rivela se l'email esiste o meno:
      // mostriamo sempre lo stesso messaggio di conferma.
      setSent(true);
    } catch (e: any) {
      showAlert('Invio non riuscito', authErrorMessage(e, 'Impossibile inviare l\'email. Riprova.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logoTile}>
            <Text style={styles.logoText}>Sf</Text>
          </View>
          <Text style={styles.appName}>Shelfy</Text>
          <Text style={styles.tagline}>Recupera l'accesso al tuo account</Text>
        </View>

        <View style={styles.card}>
          {sent ? (
            <>
              <Text style={styles.formTitle}>Controlla la tua email</Text>
              <Text style={styles.infoText}>
                Se esiste un account associato a <Text style={{ fontFamily: FONTS.sansSemiBold }}>{email.trim()}</Text>,
                {' '}riceverai a breve un'email con le istruzioni per reimpostare la password.
              </Text>
              <TouchableOpacity
                style={styles.btn}
                onPress={() => router.replace('/(auth)/login')}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>Torna al login</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.formTitle}>Password dimenticata</Text>
              <Text style={styles.infoText}>
                Inserisci l'email con cui ti sei registrato: ti mandiamo un link per crearne una nuova.
              </Text>

              <View style={[styles.field, { marginTop: 16 }]}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="tu@esempio.com"
                  placeholderTextColor={T.mute}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && { opacity: 0.7 }]}
                onPress={handleReset}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Invia link di reset</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Ti sei ricordato la password? </Text>
          <Link href="/(auth)/login" style={styles.footerLink}>Accedi</Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoTile: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: T.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 14, ...SHADOW.fab,
  },
  logoText: { fontFamily: FONTS.serifItalic, fontSize: 36, color: '#fbfaf3' },
  appName: { fontFamily: FONTS.serifItalic, fontSize: 36, color: T.ink, letterSpacing: -1 },
  tagline: { fontSize: 14, color: T.mute, marginTop: 4, fontFamily: FONTS.sans, textAlign: 'center' },
  card: { backgroundColor: T.surface, borderRadius: RADIUS.xl, padding: 20, ...SHADOW.card },
  formTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 26, color: T.ink,
    marginBottom: 10, letterSpacing: -0.4,
  },
  infoText: { fontFamily: FONTS.sans, fontSize: 14, color: T.ink2, lineHeight: 20 },
  field: {},
  label: {
    fontSize: 12, fontFamily: FONTS.sansSemiBold, color: T.ink2,
    marginBottom: 6, letterSpacing: 0.1,
  },
  input: {
    backgroundColor: T.bg, borderRadius: RADIUS.md,
    paddingHorizontal: 16, paddingVertical: 12,
    fontFamily: FONTS.sans, fontSize: 15, color: T.ink,
    borderWidth: 1, borderColor: T.line,
  },
  btn: {
    backgroundColor: T.primary, borderRadius: RADIUS.pill,
    paddingVertical: 16, alignItems: 'center', marginTop: 20, ...SHADOW.fab,
  },
  btnText: { fontFamily: FONTS.sansSemiBold, fontSize: 16, color: '#fbfaf3' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { fontFamily: FONTS.sans, fontSize: 14, color: T.mute },
  footerLink: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.primary },
});
