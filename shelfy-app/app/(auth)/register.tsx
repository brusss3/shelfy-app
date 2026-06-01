import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { authErrorMessage } from '@/lib/authErrors';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert('Errore', 'Compila tutti i campi');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Errore', 'La password deve avere almeno 6 caratteri');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Registrazione fallita', authErrorMessage(e, 'Impossibile completare la registrazione. Riprova.'));
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
          <Text style={styles.tagline}>Inizia a tenere traccia del tuo cibo</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.formTitle}>Crea account</Text>

          {[
            { label: 'Il tuo nome', value: name, onChange: setName, placeholder: 'Mario', autoComplete: 'name' as const, keyboard: 'default' as const },
            { label: 'Email', value: email, onChange: setEmail, placeholder: 'tu@esempio.com', autoComplete: 'email' as const, keyboard: 'email-address' as const },
            { label: 'Password', value: password, onChange: setPassword, placeholder: '••••••••', autoComplete: 'new-password' as const, keyboard: 'default' as const, secure: true },
          ].map((f, i) => (
            <View key={i} style={[styles.field, i > 0 && { marginTop: 12 }]}>
              <Text style={styles.label}>{f.label}</Text>
              <TextInput
                style={styles.input}
                value={f.value}
                onChangeText={f.onChange}
                placeholder={f.placeholder}
                placeholderTextColor={T.mute}
                autoComplete={f.autoComplete}
                keyboardType={f.keyboard}
                secureTextEntry={f.secure}
                autoCapitalize={f.keyboard === 'default' && !f.secure ? 'words' : 'none'}
              />
            </View>
          ))}

          <TouchableOpacity
            style={[styles.btn, loading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Crea account</Text>
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
          <Text style={styles.footerText}>Hai già un account? </Text>
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
  tagline: { fontSize: 14, color: T.mute, marginTop: 4, fontFamily: FONTS.sans },
  card: { backgroundColor: T.surface, borderRadius: RADIUS.xl, padding: 20, ...SHADOW.card },
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
});
