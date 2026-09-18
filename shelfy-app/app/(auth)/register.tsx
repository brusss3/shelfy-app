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

export default function RegisterScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();

  const handleRegister = async () => {
    if (!name || !email || !password) {
      showAlert(t('common.error'), t('auth.register.missingFieldsError'));
      return;
    }
    if (password.length < 6) {
      showAlert(t('common.error'), t('auth.register.weakPasswordError'));
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, name.trim());
      router.replace('/(tabs)');
    } catch (e: any) {
      showAlert(t('auth.register.failedTitle'), authErrorMessage(e, t('auth.register.failedFallback')));
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
          <Image source={require('@/assets/icon.png')} style={styles.logoTile} resizeMode="contain" />
          <Text style={styles.appName}>Shelfy</Text>
          <Text style={styles.tagline}>{t('auth.register.tagline')}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.formTitle}>{t('auth.register.title')}</Text>

          {[
            { label: t('auth.register.nameLabel'), value: name, onChange: setName, placeholder: t('auth.register.namePlaceholder'), autoComplete: 'name' as const, keyboard: 'default' as const },
            { label: t('auth.register.emailLabel'), value: email, onChange: setEmail, placeholder: t('auth.emailPlaceholder'), autoComplete: 'email' as const, keyboard: 'email-address' as const },
            { label: t('auth.register.passwordLabel'), value: password, onChange: setPassword, placeholder: '••••••••', autoComplete: 'new-password' as const, keyboard: 'default' as const, secure: true },
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

          <PrimaryButton
            onPress={handleRegister}
            loading={loading}
            label={t('auth.register.submit')}
            fullWidth
            containerStyle={{ marginTop: 20 }}
          />

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.register.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          <GoogleAuthButton />
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.register.haveAccount')}</Text>
          <Link href="/(auth)/login" style={styles.footerLink}>{t('auth.register.loginLink')}</Link>
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
  appName: { fontFamily: FONTS.serifItalic, fontSize: 36, color: T.ink, letterSpacing: -1 },
  tagline: { fontSize: 14, color: T.mute, marginTop: 4, fontFamily: FONTS.sans },
  card: { backgroundColor: T.surface, borderRadius: RADIUS.clay, padding: 20, ...SHADOW.card },
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
});
