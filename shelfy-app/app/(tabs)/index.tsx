import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useProducts } from '@/context/ProductsContext';
import { useAuth } from '@/context/AuthContext';
import { urgencyOf, effectiveDays } from '@/lib/urgency';
import { ocrAvailable } from '@/lib/ocr';
import ProductRow from '@/components/ProductRow';
import StatCard from '@/components/StatCard';
import ProfileButton from '@/components/ProfileButton';
import PrimaryButton from '@/components/PrimaryButton';
import { LinearGradient } from 'expo-linear-gradient';
import {
  T, FONTS, RADIUS, DEPTH, CLAY, SURFACE, GRADIENT, ZONE_MATERIAL,
} from '@/constants/theme';

type Zone = 'all' | 'frigo' | 'freezer' | 'dispensa';

const ZONES: { id: Zone; label: string; icon: string }[] = [
  { id: 'all',      label: 'Tutto',    icon: '' },
  { id: 'frigo',    label: 'Frigo',    icon: '❄️' },
  { id: 'freezer',  label: 'Freezer',  icon: '🧊' },
  { id: 'dispensa', label: 'Dispensa', icon: '📦' },
];

export default function HomeScreen() {
  const { products, loading } = useProducts();
  const { user } = useAuth();
  const router = useRouter();
  const [zone, setZone] = useState<Zone>('all');
  const [query, setQuery] = useState('');

  const firstName = user?.displayName?.split(' ')[0] ?? 'ciao';
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Buongiorno' : hour < 19 ? 'Buon pomeriggio' : 'Buonasera';

  const filtered = useMemo(() => {
    return products
      .filter((p) => zone === 'all' || p.zone === zone)
      .filter((p) =>
        !query || `${p.name} ${p.brand}`.toLowerCase().includes(query.toLowerCase()),
      )
      .sort((a, b) => effectiveDays(a) - effectiveDays(b));
  }, [products, zone, query]);

  const urgentCount = products.filter((p) => { const d = effectiveDays(p); return d >= 0 && d <= 3; }).length;
  const expiredCount = products.filter((p) => effectiveDays(p) < 0).length;

  if (loading) {
    return (
      <SafeAreaView style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator color={T.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greet}>{greet}, {firstName}</Text>
            <Text style={styles.title}>La tua dispensa</Text>
          </View>
          <View style={styles.headerRight}>
            {user?.isAdmin && (
              <TouchableOpacity
                onPress={() => router.push('/admin')}
                style={styles.adminBtn}
              >
                <Ionicons name="shield-outline" size={19} color={T.primaryInk} />
              </TouchableOpacity>
            )}
            <ProfileButton />
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard value={products.length} label="In dispensa" color={T.ink} />
          <StatCard value={urgentCount} label="Urgenti" color={urgentCount > 0 ? T.warn : T.mute} />
          <StatCard value={expiredCount} label="Scaduti" color={expiredCount > 0 ? T.urgent : T.mute} />
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={17} color={T.mute} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Cerca un prodotto…"
            placeholderTextColor={T.mute}
            style={styles.searchInput}
          />
        </View>

        {/* Zone chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {ZONES.map((z) => {
            const active = zone === z.id;
            // Ogni zona ha il suo materiale: freddo per frigo e freezer, carta
            // per la dispensa. "Tutto" non è una zona, quindi resta il verde
            // del marchio.
            const material = z.id === 'all' ? null : ZONE_MATERIAL[z.id];
            const surface = active ? (material?.surface ?? GRADIENT.primary) : SURFACE.card;
            const labelColor = active ? (material?.ink ?? '#fbfaf3') : T.ink;
            return (
              <TouchableOpacity key={z.id} onPress={() => setZone(z.id)} activeOpacity={0.9}>
                <LinearGradient colors={surface} style={styles.chip}>
                  {z.icon ? (
                    <Text style={styles.chipIcon}>{z.icon}</Text>
                  ) : null}
                  <Text style={[styles.chipText, { color: labelColor }]}>
                    {z.label}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Alert banner */}
        {urgentCount + expiredCount > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/notifications')}
            activeOpacity={0.9}
            style={styles.alertWrap}
          >
            <LinearGradient colors={SURFACE.warm} style={styles.alertBanner}>
              <View style={styles.alertIcon}>
                <Text style={{ fontSize: 22 }}>🔥</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.alertTitle}>
                  {urgentCount + expiredCount} prodotti richiedono attenzione
                </Text>
                <Text style={styles.alertSub}>Tocca per vedere i suggerimenti</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#a86322" />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Product list */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>In scadenza prima</Text>
          <Text style={styles.sectionCount}>
            {filtered.length} {filtered.length === 1 ? 'prodotto' : 'prodotti'}
          </Text>
        </View>

        <View style={styles.list}>
          {filtered.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              onPress={() => router.push(`/product/${p.id}`)}
            />
          ))}
          {filtered.length === 0 && (
            <Text style={styles.empty}>Nessun prodotto trovato.</Text>
          )}
        </View>
      </ScrollView>

      {/* Barra azione: lo scan è il gesto primario (come lo scatto di una
          fotocamera), non una voce in un menu da aprire prima. Manuale e
          scontrino restano a un tocco, ma con peso visivo minore. */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionSide}
          onPress={() => router.push('/add')}
          activeOpacity={0.85}
          accessibilityLabel="Aggiungi manualmente"
        >
          <Ionicons name="pencil-outline" size={19} color={T.primary} />
        </TouchableOpacity>

        <PrimaryButton
          onPress={() => router.push('/scanner')}
          icon="camera-outline"
          iconVariant="shutter"
          label="Scansiona"
          subLabel="Aggiungi un prodotto"
          compactOnNative
          containerStyle={styles.scanCta}
          style={styles.scanCtaSurface}
          accessibilityLabel="Scansiona un prodotto"
        />

        {ocrAvailable ? (
          <TouchableOpacity
            style={styles.actionSide}
            onPress={() => router.push('/receipt-scan')}
            activeOpacity={0.85}
            accessibilityLabel="Scansiona uno scontrino"
          >
            <Ionicons name="receipt-outline" size={19} color={T.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.actionSide} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 120 },

  headerRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
  },
  greet: { fontSize: 13, color: T.mute, fontFamily: FONTS.sansMedium },
  title: {
    fontFamily: FONTS.serifItalic, fontSize: 38, color: T.ink,
    letterSpacing: -1, lineHeight: 44, marginTop: 2,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  adminBtn: {
    width: 42, height: 42, borderRadius: 100, backgroundColor: T.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  adminBtnText: { fontSize: 20 },

  statsRow: {
    flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 14,
  },

  // Il campo di ricerca è l'unico elemento "scavato" della schermata: si
  // riempie, non si preme, e l'incavo lo distingue dalle superfici sollevate.
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#ece8de', borderRadius: RADIUS.input,
    paddingHorizontal: 16, paddingVertical: 12,
    marginHorizontal: 20, marginBottom: 12,
    boxShadow: CLAY.inset,
  },
  searchInput: {
    flex: 1, fontFamily: FONTS.sans, fontSize: 14, color: T.ink,
  },

  chips: { paddingHorizontal: 20, gap: 8, paddingTop: 2, paddingBottom: 14 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: RADIUS.md,
    paddingVertical: 9, paddingHorizontal: 15,
    boxShadow: CLAY.chip,
  },
  chipIcon: { fontSize: 15 },
  chipText: { fontFamily: FONTS.sansSemiBold, fontSize: 13 },

  alertWrap: { marginHorizontal: 20, marginBottom: 14 },
  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADIUS.clay, padding: 14,
    boxShadow: CLAY.surface,
  },
  alertIcon: {
    width: 44, height: 44, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0px 2px 4px rgba(120,80,20,0.12)',
  },
  alertTitle: { fontSize: 13, fontFamily: FONTS.sansBold, color: '#4a3414' },
  alertSub: { fontSize: 12, color: '#7a5a26', marginTop: 2, fontFamily: FONTS.sans },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between',
    paddingHorizontal: 20, marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 22, color: T.ink, letterSpacing: -0.3,
  },
  sectionCount: { fontSize: 12, color: T.mute, fontFamily: FONTS.sans },

  list: { paddingHorizontal: 20, gap: 8 },
  empty: { textAlign: 'center', color: T.mute, fontSize: 14, paddingVertical: 32, fontFamily: FONTS.sans },

  actionBar: {
    position: 'absolute', left: 20, right: 20, bottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  actionSide: {
    width: 50, height: 50, borderRadius: RADIUS.input,
    backgroundColor: T.surface, alignItems: 'center', justifyContent: 'center',
    boxShadow: DEPTH.buttonLight,
  },
  scanCta: { flex: 1 },
  scanCtaSurface: { paddingLeft: 6 },
});
