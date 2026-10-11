import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import PrimaryButton from '@/components/PrimaryButton';
import { FONTS, RADIUS } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/context/ThemeContext';

export type GuestFeature = 'shopping' | 'recipes' | 'pantry';

const ICONS: Record<GuestFeature, string> = { shopping: '🛒', recipes: '🍳', pantry: '🏡' };

// Si vede poche volte (ogni tanto, aprendo una tab chiusa): un ingresso
// morbido spiega che è un invito e non un errore.
const CARD_ENTER = FadeInDown.duration(280).easing(Easing.bezier(0.23, 1, 0.32, 1));

// Al posto di una funzione riservata agli account, per gli ospiti: spiega
// cosa si sblocca invece di nascondere la tab, perché vederla è già un
// motivo per registrarsi.
export default function GuestGate({ feature, children }: { feature: GuestFeature; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user?.isGuest) return <>{children}</>;
  return <GuestGateScreen feature={feature} />;
}

function GuestGateScreen({ feature }: { feature: GuestFeature }) {
  const { SURFACE } = useTheme();
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.center}>
        <Animated.View entering={CARD_ENTER} style={styles.cardWrap}>
        <LinearGradient colors={SURFACE.card} style={styles.card}>
          <Text style={styles.icon}>{ICONS[feature]}</Text>
          <Text style={styles.title}>{t(`guest.gate.${feature}.title`)}</Text>
          <Text style={styles.body}>{t(`guest.gate.${feature}.body`)}</Text>
          <View style={styles.perks}>
            {(['perkProducts', 'perkRecipes', 'perkShared'] as const).map((k) => (
              <Text key={k} style={styles.perk}>✓  {t(`guest.${k}`)}</Text>
            ))}
          </View>
          <PrimaryButton
            label={t('guest.signupCta')}
            onPress={() => router.push('/(auth)/register')}
            fullWidth
            containerStyle={{ marginTop: 20 }}
          />
          <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.loginLink}>
            <Text style={styles.loginText}>{t('guest.haveAccount')}</Text>
          </TouchableOpacity>
        </LinearGradient>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const createStyles = ({ T, SHADOW }: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  // Su schermi larghi (web desktop) resta una colonna leggibile.
  cardWrap: { width: '100%', maxWidth: 440 },
  card: { borderRadius: RADIUS.clay, padding: 24, alignItems: 'center', ...SHADOW.card },
  icon: { fontSize: 44, lineHeight: 56, marginBottom: 8 },
  title: {
    fontFamily: FONTS.serifItalic, fontSize: 26, color: T.ink,
    textAlign: 'center', letterSpacing: -0.4,
  },
  body: {
    fontFamily: FONTS.sans, fontSize: 14, lineHeight: 20, color: T.ink2,
    textAlign: 'center', marginTop: 8,
  },
  perks: { alignSelf: 'stretch', marginTop: 18, gap: 6 },
  perk: { fontFamily: FONTS.sansMedium, fontSize: 13, color: T.ink },
  loginLink: { marginTop: 14, padding: 4 },
  loginText: { fontFamily: FONTS.sansMedium, fontSize: 13, color: T.primary },
});
