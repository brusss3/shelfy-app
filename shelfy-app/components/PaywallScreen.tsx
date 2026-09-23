import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';
import { getOfferings, purchasePackage, restorePurchases, getActiveSubscriptionInfo } from '@/lib/purchases';
import { showAlert } from '@/lib/alert';
import PrimaryButton from '@/components/PrimaryButton';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

const isExpoGo = Constants.executionEnvironment === 'storeClient';

export default function PaywallScreen() {
  const { user, setPremium, setSubscription } = useAuth();
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const [offerings, setOfferings] = useState<any[]>([]);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    if (isExpoGo) { setLoadingOfferings(false); return; }
    getOfferings().then((pkgs) => {
      setOfferings(pkgs);
      const annual = pkgs.find((p) => p.packageType === 'ANNUAL');
      setSelectedPkg(annual ?? pkgs[0] ?? null);
    }).finally(() => setLoadingOfferings(false));
  }, []);

  const handlePurchase = async () => {
    if (!selectedPkg) return;
    setPurchasing(true);
    try {
      const ok = await purchasePackage(selectedPkg);
      if (ok) {
        await setPremium(true);
        const info = await getActiveSubscriptionInfo();
        if (info) await setSubscription(info);
        // Senza questo si resta sui piani come se l'acquisto non fosse
        // avvenuto: il checkout si chiude e la schermata sotto è identica.
        showAlert(t('paywall.purchaseDoneTitle'), t('paywall.purchaseDoneBody'), [
          { text: t('paywall.purchaseDoneCta'), onPress: () => router.back() },
        ]);
      }
    } catch (e: any) {
      showAlert(t('paywall.purchaseErrorTitle'), e?.message ?? t('paywall.purchaseErrorFallback'));
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    try {
      const ok = await restorePurchases();
      if (ok) {
        await setPremium(true);
        showAlert(t('paywall.restoreCompletedTitle'), t('paywall.restoreCompletedBody'));
      } else {
        showAlert(t('paywall.noPurchaseFoundTitle'), t('paywall.noPurchaseFoundBody'));
      }
    } catch {
      showAlert(t('common.error'), t('paywall.restoreFailedBody'));
    } finally {
      setPurchasing(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.lockIcon}>
          <Text style={{ fontSize: 36 }}>🔒</Text>
        </View>
        <View style={styles.premiumBadge}>
          <Text style={styles.premiumBadgeText}>{t('paywall.badge')}</Text>
        </View>
        <Text style={styles.title}>{t('paywall.title')}</Text>
        <Text style={styles.desc}>
          {t('paywall.desc')}
        </Text>

        <View style={styles.featureList}>
          {[
            t('paywall.features.f1'),
            t('paywall.features.f2'),
            t('paywall.features.f3'),
            t('paywall.features.f4'),
          ].map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {user?.isPremium ? (
          <View style={styles.activeBox}>
            <Text style={styles.activeText}>{t('paywall.alreadyPremium')}</Text>
          </View>
        ) : isExpoGo ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              {t('paywall.expoGoNotePrefix')}<Text style={{ fontFamily: FONTS.sansBold }}>expo-dev-client</Text>{t('paywall.expoGoNoteSuffix')}
            </Text>
          </View>
        ) : loadingOfferings ? (
          <ActivityIndicator color={T.primary} style={{ marginVertical: 32 }} />
        ) : offerings.length === 0 ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              {t('paywall.productsNotConfiguredPrefix')}<Text style={{ fontFamily: FONTS.sansBold }}>app.json</Text>{t('paywall.productsNotConfiguredSuffix')}
            </Text>
          </View>
        ) : (
          <View style={styles.packages}>
            {offerings.map((pkg) => {
              const isSelected = selectedPkg?.identifier === pkg.identifier;
              const isAnnual = pkg.packageType === 'ANNUAL';
              const priceValue = (pkg.product.price / 12).toFixed(2);
              const monthlyEquiv = isAnnual
                ? t('paywall.perMonth', { price: i18n.language === 'it' ? priceValue.replace('.', ',') : priceValue })
                : null;
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  onPress={() => setSelectedPkg(pkg)}
                  activeOpacity={0.82}
                  style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                >
                  {isAnnual && (
                    <View style={styles.bestValueBadge}>
                      <Text style={styles.bestValueText}>{t('paywall.bestValue')}</Text>
                    </View>
                  )}
                  <Text style={[styles.packagePeriod, isSelected && { color: '#fbfaf3' }]}>
                    {pkg.packageType === 'ANNUAL' ? t('paywall.annual')
                      : pkg.packageType === 'MONTHLY' ? t('paywall.monthly')
                      : pkg.product.title}
                  </Text>
                  <Text style={[styles.packagePrice, isSelected && { color: '#fbfaf3' }]}>
                    {pkg.product.priceString}
                  </Text>
                  {monthlyEquiv && (
                    <Text style={[styles.packageSub, isSelected && { color: 'rgba(255,255,255,0.7)' }]}>
                      {monthlyEquiv}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {!isExpoGo && !user?.isPremium && offerings.length > 0 && (
          <PrimaryButton
            onPress={handlePurchase}
            disabled={!selectedPkg}
            loading={purchasing}
            label={t('paywall.unlockPremium')}
            fullWidth
            containerStyle={{ marginBottom: 16 }}
          />
        )}

        <TouchableOpacity
          onPress={handleRestore}
          disabled={purchasing || isExpoGo}
          style={styles.restoreBtn}
        >
          <Text style={styles.restoreText}>{t('paywall.restorePurchases')}</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          {t('paywall.legal')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingHorizontal: 28, paddingBottom: 48, alignItems: 'center', paddingTop: 32 },

  lockIcon: {
    width: 80, height: 80, borderRadius: 100, backgroundColor: T.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  premiumBadge: {
    backgroundColor: T.primary, borderRadius: RADIUS.tag,
    paddingVertical: 5, paddingHorizontal: 14, marginBottom: 14,
  },
  premiumBadgeText: { color: '#fbfaf3', fontSize: 11, fontFamily: FONTS.sansBold, letterSpacing: 1.2 },
  title: {
    fontFamily: FONTS.serifItalic, fontSize: 36, color: T.ink,
    letterSpacing: -0.8, textAlign: 'center', marginBottom: 10,
  },
  desc: {
    fontSize: 15, color: T.ink2, textAlign: 'center', lineHeight: 22,
    fontFamily: FONTS.sans, marginBottom: 28,
  },

  featureList: { width: '100%', gap: 8, marginBottom: 28 },
  featureRow: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 14, ...SHADOW.card,
  },
  featureText: { fontSize: 14, color: T.ink, fontFamily: FONTS.sansSemiBold },

  noteBox: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 16,
    width: '100%', marginBottom: 20, ...SHADOW.card,
  },
  noteText: { fontSize: 13, color: T.ink2, lineHeight: 20, fontFamily: FONTS.sans },

  activeBox: {
    backgroundColor: T.okSoft, borderRadius: RADIUS.lg, padding: 16,
    width: '100%', marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(56,140,80,0.25)',
  },
  activeText: {
    fontSize: 14, color: T.ok, lineHeight: 20, fontFamily: FONTS.sansSemiBold,
    textAlign: 'center',
  },

  packages: { flexDirection: 'row', gap: 12, width: '100%', marginBottom: 20 },
  packageCard: {
    flex: 1, backgroundColor: T.surface, borderRadius: RADIUS.lg,
    padding: 16, alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
    ...SHADOW.card, position: 'relative',
  },
  packageCardSelected: { backgroundColor: T.primary, borderColor: T.primary },
  bestValueBadge: {
    position: 'absolute', top: -10, alignSelf: 'center',
    backgroundColor: T.warn, borderRadius: RADIUS.tag,
    paddingVertical: 3, paddingHorizontal: 10,
  },
  bestValueText: { fontSize: 10, color: '#fff', fontFamily: FONTS.sansBold },
  packagePeriod: { fontSize: 13, fontFamily: FONTS.sansSemiBold, color: T.ink, marginTop: 8 },
  packagePrice: { fontSize: 22, fontFamily: FONTS.serifItalic, color: T.ink, marginTop: 4 },
  packageSub: { fontSize: 11, color: T.mute, fontFamily: FONTS.sans, marginTop: 2 },

  restoreBtn: { paddingVertical: 10, marginBottom: 16 },
  restoreText: { fontSize: 13, color: T.primary, fontFamily: FONTS.sansSemiBold, textAlign: 'center' },

  legal: {
    fontSize: 11, color: T.mute, textAlign: 'center', lineHeight: 16,
    fontFamily: FONTS.sans,
  },
});
