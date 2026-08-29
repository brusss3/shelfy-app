import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { authErrorMessage } from '@/lib/authErrors';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import { showAlert } from '@/lib/alert';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert('Errore', 'Inserisci email e password');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      showAlert('Accesso fallito', authErrorMessage(e, 'Controlla le tue credenziali e riprova.'));
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
        {/* Logo / header */}
        <View style={styles.header}>
          <View style={styles.logoTile}>
            <Text style={styles.logoText}>Sf</Text>
          </View>
          <Text style={styles.appName}>Shelfy</Text>
          <Text style={styles.tagline}>La tua dispensa intelligente</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.formTitle}>Accedi</Text>

          <View style={styles.field}>
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

          <View style={[styles.field, { marginTop: 12 }]}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={T.mute}
              secureTextEntry
              autoComplete="password"
            />
          </View>

          <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
            Password dimenticata?
          </Link>

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Accedi</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>oppure</Text>
            <View style={styles.dividerLine} />
          </View>

          <GoogleAuthButton />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Non hai un account? </Text>
          <Link href="/(auth)/register" style={styles.footerLink}>
            Registrati
          </Link>
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
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    ...SHADOW.fab,
  },
  logoText: {
    fontFamily: FONTS.serifItalic, fontSize: 36, color: '#fbfaf3',
  },
  appName: {
    fontFamily: FONTS.serifItalic, fontSize: 36, color: T.ink,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14, color: T.mute, marginTop: 4, fontFamily: FONTS.sans,
  },
  card: {
    backgroundColor: T.surface, borderRadius: RADIUS.xl, padding: 20, ...SHADOW.card,
  },
  formTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 26, color: T.ink,
    marginBottom: 20, letterSpacing: -0.4,
  },
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
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 16 },
  dividerLine: { flex: 1, height: 1, backgroundColor: T.line },
  dividerText: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  footerText: { fontFamily: FONTS.sans, fontSize: 14, color: T.mute },
  footerLink: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.primary },
  forgotLink: {
    fontFamily: FONTS.sansMedium, fontSize: 13, color: T.primary,
    textAlign: 'right', marginTop: 10,
  },
});
