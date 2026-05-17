import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useProducts } from '@/context/ProductsContext';
import { useAuth } from '@/context/AuthContext';
import { urgencyOf, daysTo } from '@/lib/urgency';
import ProductRow from '@/components/ProductRow';
import StatCard from '@/components/StatCard';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';

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
      .sort((a, b) => daysTo(a.expiry) - daysTo(b.expiry));
  }, [products, zone, query]);

  const urgentCount = products.filter((p) => { const d = daysTo(p.expiry); return d >= 0 && d <= 3; }).length;
  const expiredCount = products.filter((p) => daysTo(p.expiry) < 0).length;

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
          <TouchableOpacity
            onPress={() => router.push('/(auth)/login')}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>
              {firstName[0]?.toUpperCase() ?? 'U'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <StatCard value={products.length} label="In dispensa" color={T.ink} />
          <StatCard value={urgentCount} label="Urgenti" color={urgentCount > 0 ? T.warn : T.mute} />
          <StatCard value={expiredCount} label="Scaduti" color={expiredCount > 0 ? T.urgent : T.mute} />
        </View>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
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
            return (
              <TouchableOpacity
                key={z.id}
                onPress={() => setZone(z.id)}
                activeOpacity={0.85}
                style={[styles.chip, active && styles.chipActive]}
              >
                {z.icon ? (
                  <Text style={styles.chipIcon}>{z.icon}</Text>
                ) : null}
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {z.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Alert banner */}
        {urgentCount + expiredCount > 0 && (
          <TouchableOpacity
            style={styles.alertBanner}
            onPress={() => router.push('/(tabs)/notifications')}
            activeOpacity={0.88}
          >
            <View style={styles.alertIcon}>
              <Text style={{ fontSize: 22 }}>🔥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alertTitle}>
                {urgentCount + expiredCount} prodotti richiedono attenzione
              </Text>
              <Text style={styles.alertSub}>Tocca per vedere i suggerimenti</Text>
            </View>
            <Text style={{ color: '#a86322', fontSize: 18 }}>›</Text>
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

      {/* FAB - scan */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/scanner')}
        activeOpacity={0.9}
      >
        <Text style={styles.fabIcon}>📷</Text>
        <Text style={styles.fabText}>Scansiona</Text>
      </TouchableOpacity>
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
  avatar: {
    width: 42, height: 42, borderRadius: 100, backgroundColor: T.primarySoft,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  avatarText: { fontFamily: FONTS.serifItalic, fontSize: 20, color: T.primaryInk },

  statsRow: {
    flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 14,
  },

  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: T.surface, borderRadius: RADIUS.pill,
    paddingHorizontal: 16, paddingVertical: 10,
    marginHorizontal: 20, marginBottom: 12, ...SHADOW.card,
  },
  searchIcon: { fontSize: 16 },
  searchInput: {
    flex: 1, fontFamily: FONTS.sans, fontSize: 14, color: T.ink,
  },

  chips: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: T.surface, borderRadius: RADIUS.pill,
    paddingVertical: 8, paddingHorizontal: 14, ...SHADOW.card,
  },
  chipActive: { backgroundColor: T.primary },
  chipIcon: { fontSize: 15 },
  chipText: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink },
  chipTextActive: { color: '#fbfaf3' },

  alertBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    marginHorizontal: 20, marginBottom: 14,
    backgroundColor: '#f9e6c8', borderRadius: RADIUS.lg,
    padding: 14, borderWidth: 0.5, borderColor: 'rgba(140,90,30,0.15)',
  },
  alertIcon: {
    width: 44, height: 44, borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center',
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

  fab: {
    position: 'absolute', bottom: 100, right: 20,
    backgroundColor: T.primary, borderRadius: RADIUS.pill,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 14, paddingHorizontal: 18, ...SHADOW.fab,
  },
  fabIcon: { fontSize: 20 },
  fabText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: '#fbfaf3', letterSpacing: -0.1 },
});
