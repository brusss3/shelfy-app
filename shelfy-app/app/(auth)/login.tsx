import React, { useState } from 'react';
import {
  View, Text, Image, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { authErrorMessage } from '@/lib/authErrors';
import GoogleAuthButton from '@/components/GoogleAuthButton';
import PrimaryButton from '@/components/PrimaryButton';
import { showAlert } from '@/lib/alert';
import { T, FONTS, RADIUS, SHADOW, CLAY } from '@/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert(t('common.error'), t('auth.login.missingFieldsError'));
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      showAlert(t('auth.login.failedTitle'), authErrorMessage(e, t('auth.login.failedFallback')));
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
          <Image source={require('@/assets/icon.png')} style={styles.logoTile} resizeMode="contain" />
          <Text style={styles.appName}>Shelfy</Text>
          <Text style={styles.tagline}>{t('auth.login.tagline')}</Text>
        </View>

        {/* Form */}
        <View style={styles.card}>
          <Text style={styles.formTitle}>{t('auth.login.title')}</Text>

          <View style={styles.field}>
            <Text style={styles.label}>{t('auth.login.emailLabel')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={T.mute}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={[styles.field, { marginTop: 12 }]}>
            <Text style={styles.label}>{t('auth.login.passwordLabel')}</Text>
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
            {t('auth.login.forgotLink')}
          </Link>

          <PrimaryButton
            onPress={handleLogin}
            loading={loading}
            label={t('auth.login.submit')}
            fullWidth
            containerStyle={{ marginTop: 20 }}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.login.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <GoogleAuthButton />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.login.noAccount')}</Text>
          <Link href="/(auth)/register" style={styles.footerLink}>
            {t('auth.login.registerLink')}
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
    width: 84, height: 102, marginBottom: 10,
    boxShadow: SHADOW.fab.boxShadow,
  },
  appName: {
    fontFamily: FONTS.serifItalic, fontSize: 36, color: T.ink,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 14, color: T.mute, marginTop: 4, fontFamily: FONTS.sans,
  },
  card: {
    backgroundColor: T.surface, borderRadius: RADIUS.clay, padding: 20, ...SHADOW.card,
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
    backgroundColor: '#ece8de', borderRadius: RADIUS.input,
    paddingHorizontal: 16, paddingVertical: 13,
    fontFamily: FONTS.sans, fontSize: 15, color: T.ink,
    boxShadow: CLAY.inset,
  },
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
