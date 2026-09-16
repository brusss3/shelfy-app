import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useAuth } from '@/context/AuthContext';
import { getOfferings, purchasePackage, restorePurchases, getActiveSubscriptionInfo } from '@/lib/purchases';
import { showAlert } from '@/lib/alert';
import { SubscriptionType } from '@/types';
import PrimaryButton from '@/components/PrimaryButton';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

const isExpoGo = Constants.executionEnvironment === 'storeClient';
const isWeb = Platform.OS === 'web';

export default function PaywallScreen() {
  const { setPremium, setSubscription } = useAuth();
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
      }
    } catch (e: any) {
      showAlert('Errore acquisto', e?.message ?? 'Riprova più tardi.');
    } finally {
      setPurchasing(false);
    }
  };

  const handleWebTestPurchase = async (type: SubscriptionType) => {
    setPurchasing(true);
    try {
      const now = new Date();
      const expiresAt = type === 'annual'
        ? new Date(now.setFullYear(now.getFullYear() + 1)).toISOString()
        : new Date(now.setMonth(now.getMonth() + 1)).toISOString();
      await setSubscription({ type, expiresAt });
    } catch (e: any) {
      alert(e?.message ?? 'Errore simulazione acquisto.');
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
        showAlert('Ripristino completato', 'Abbonamento premium attivato.');
      } else {
        showAlert('Nessun acquisto trovato', 'Nessun abbonamento attivo trovato su questo account.');
      }
    } catch {
      showAlert('Errore', 'Impossibile ripristinare gli acquisti.');
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
          <Text style={styles.premiumBadgeText}>PREMIUM</Text>
        </View>
        <Text style={styles.title}>Ricette AI</Text>
        <Text style={styles.desc}>
          Genera ricette della tradizione italiana con i tuoi ingredienti in scadenza.
          Riduci gli sprechi, scopri nuovi piatti.
        </Text>

        <View style={styles.featureList}>
          {[
            '✨  Ricette AI personalizzate',
            '⏰  Priorità ai prodotti in scadenza',
            '📚  Storico ricette salvate',
            '✓  Segna le ricette cucinate',
          ].map((f) => (
            <View key={f} style={styles.featureRow}>
              <Text style={styles.featureText}>{f}</Text>
            </View>
          ))}
        </View>

        {isExpoGo ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              ℹ️  Gli acquisti in-app richiedono un build nativo.{'\n'}
              Avvia l'app con <Text style={{ fontFamily: FONTS.sansBold }}>expo-dev-client</Text> per testare i pagamenti.
            </Text>
          </View>
        ) : isWeb ? (
          <View style={styles.webTestBox}>
            <Text style={styles.webTestLabel}>🧪  Modalità test — solo sviluppo</Text>
            <Text style={styles.webTestDesc}>
              RevenueCat non supporta acquisti su web. Usa questi pulsanti per simulare un abbonamento e testare l'app.
            </Text>
            <View style={styles.webTestBtns}>
              <TouchableOpacity
                style={[styles.webTestBtn, purchasing && { opacity: 0.55 }]}
                disabled={purchasing}
                onPress={() => handleWebTestPurchase('monthly')}
                activeOpacity={0.85}
              >
                {purchasing
                  ? <ActivityIndicator color="#fbfaf3" size="small" />
                  : <Text style={styles.webTestBtnText}>Mensile (test)</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.webTestBtn, styles.webTestBtnAnnual, purchasing && { opacity: 0.55 }]}
                disabled={purchasing}
                onPress={() => handleWebTestPurchase('annual')}
                activeOpacity={0.85}
              >
                {purchasing
                  ? <ActivityIndicator color="#fbfaf3" size="small" />
                  : <Text style={styles.webTestBtnText}>Annuale (test)</Text>}
              </TouchableOpacity>
            </View>
          </View>
        ) : loadingOfferings ? (
          <ActivityIndicator color={T.primary} style={{ marginVertical: 32 }} />
        ) : offerings.length === 0 ? (
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              ⚠️  Prodotti non configurati.{'\n'}
              Inserisci le API key RevenueCat in <Text style={{ fontFamily: FONTS.sansBold }}>lib/purchases.ts</Text>{'\n'}
              e configura i prodotti su App Store Connect / Google Play Console.
            </Text>
          </View>
        ) : (
          <View style={styles.packages}>
            {offerings.map((pkg) => {
              const isSelected = selectedPkg?.identifier === pkg.identifier;
              const isAnnual = pkg.packageType === 'ANNUAL';
              const monthlyEquiv = isAnnual
                ? `${(pkg.product.price / 12).toFixed(2).replace('.', ',')}€/mese`
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
                      <Text style={styles.bestValueText}>Miglior valore</Text>
                    </View>
                  )}
                  <Text style={[styles.packagePeriod, isSelected && { color: '#fbfaf3' }]}>
                    {pkg.packageType === 'ANNUAL' ? 'Annuale'
                      : pkg.packageType === 'MONTHLY' ? 'Mensile'
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

        {!isExpoGo && !isWeb && offerings.length > 0 && (
          <PrimaryButton
            onPress={handlePurchase}
            disabled={!selectedPkg}
            loading={purchasing}
            label="Sblocca Premium"
            fullWidth
            containerStyle={{ marginBottom: 16 }}
          />
        )}

        <TouchableOpacity
          onPress={handleRestore}
          disabled={purchasing || isExpoGo}
          style={styles.restoreBtn}
        >
          <Text style={styles.restoreText}>Ripristina acquisti</Text>
        </TouchableOpacity>

        <Text style={styles.legal}>
          L'abbonamento si rinnova automaticamente. Puoi disdire in qualsiasi momento dalle
          impostazioni App Store o Google Play.
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

  webTestBox: {
    width: '100%', backgroundColor: '#fdf6e3', borderRadius: RADIUS.lg,
    padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(180,140,40,0.2)',
  },
  webTestLabel: { fontFamily: FONTS.sansBold, fontSize: 13, color: T.warn, marginBottom: 8 },
  webTestDesc: { fontFamily: FONTS.sans, fontSize: 13, color: T.ink2, lineHeight: 19, marginBottom: 16 },
  webTestBtns: { flexDirection: 'row', gap: 10 },
  webTestBtn: {
    flex: 1, backgroundColor: T.primary, borderRadius: RADIUS.md,
    paddingVertical: 12, alignItems: 'center',
  },
  webTestBtnAnnual: { backgroundColor: T.warn },
  webTestBtnText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: '#fbfaf3' },

  legal: {
    fontSize: 11, color: T.mute, textAlign: 'center', lineHeight: 16,
    fontFamily: FONTS.sans,
  },
});
