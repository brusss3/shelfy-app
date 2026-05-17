import React from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProducts } from '@/context/ProductsContext';
import { urgencyOf, shortDate } from '@/lib/urgency';
import { daysTo } from '@/context/ProductsContext';
import FoodTile from '@/components/FoodTile';
import Pill from '@/components/Pill';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';
import { Zone } from '@/types';

const ZONES: { id: Zone; label: string; icon: string; sub: string }[] = [
  { id: 'frigo',    label: 'Frigo',    icon: '❄️', sub: '4 °C' },
  { id: 'freezer',  label: 'Freezer',  icon: '🧊', sub: '-18 °C' },
  { id: 'dispensa', label: 'Dispensa', icon: '📦', sub: 'Asciutto' },
];

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { products, removeProduct, changeZone } = useProducts();
  const router = useRouter();

  const product = products.find((p) => p.id === id);
  if (!product) {
    return (
      <View style={[styles.root, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: T.mute, fontFamily: FONTS.sans }}>Prodotto non trovato.</Text>
      </View>
    );
  }

  const days = daysTo(product.expiry);
  const u = urgencyOf(days);

  const totalDays = Math.max(1,
    Math.round((new Date(product.expiry).getTime() - new Date(product.added).getTime()) / 86400000),
  );
  const elapsed = Math.max(0, Math.min(1,
    (Date.now() - new Date(product.added).getTime()) / (totalDays * 86400000),
  ));

  const handleDelete = () => {
    Alert.alert(
      'Rimuovi prodotto',
      `Vuoi rimuovere "${product.name}" dalla dispensa?`,
      [
        { text: 'Annulla', style: 'cancel' },
        {
          text: 'Rimuovi',
          style: 'destructive',
          onPress: async () => {
            await removeProduct(product.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Nav */}
        <View style={styles.nav}>
          <TouchableOpacity onPress={() => router.back()} style={styles.navBtn}>
            <Text style={styles.navBtnText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity style={styles.navBtn}>
              <Text style={styles.navBtnText}>↗</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: product.tint || T.primarySoft }]}>
          <Text style={styles.heroInitials}>
            {product.name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
          </Text>
          <Text style={styles.heroBrand}>{product.brand.toUpperCase()}</Text>
          <Text style={styles.heroName}>{product.name}</Text>
          <Text style={styles.heroSub}>{product.qty} · {product.category}</Text>
        </View>

        {/* Expiry card */}
        <View style={styles.section}>
          <View style={[styles.expiryCard, { backgroundColor: u.soft }]}>
            <View style={styles.expiryLeft}>
              <View style={[styles.expiryIcon, { backgroundColor: 'rgba(255,255,255,0.6)' }]}>
                <Text style={{ fontSize: 26 }}>⏰</Text>
              </View>
              <View>
                <Text style={[styles.expiryLabel, { color: u.ink }]}>{u.label.toUpperCase()}</Text>
                <Text style={[styles.expiryDate, { color: u.ink }]}>{shortDate(product.expiry)}</Text>
                <Text style={[styles.expiryAdded, { color: u.ink, opacity: 0.7 }]}>
                  Aggiunto il {shortDate(product.added)}
                </Text>
              </View>
            </View>
            {/* Progress bar */}
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${elapsed * 100}%` as any, backgroundColor: u.color }]}
              />
            </View>
          </View>
        </View>

        {/* Zone selector */}
        <Text style={styles.sectionTitle}>Conservazione</Text>
        <View style={styles.section}>
          <View style={styles.card}>
            {ZONES.map((z, i) => {
              const active = product.zone === z.id;
              return (
                <React.Fragment key={z.id}>
                  <TouchableOpacity
                    style={styles.zoneRow}
                    onPress={() => changeZone(product.id, z.id)}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.zoneIconBox, { backgroundColor: active ? T.primary : T.primarySoft }]}>
                      <Text style={{ fontSize: 20 }}>{z.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.zoneLabel}>{z.label}</Text>
                      <Text style={styles.zoneSub}>{z.sub}</Text>
                    </View>
                    {active && (
                      <View style={styles.checkBadge}>
                        <Text style={{ color: '#fbfaf3', fontSize: 14 }}>✓</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                  {i < ZONES.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              );
            })}
          </View>
        </View>

        {/* Details */}
        <Text style={styles.sectionTitle}>Dettagli</Text>
        <View style={styles.section}>
          <View style={styles.card}>
            {[
              { label: 'Codice a barre', value: product.barcode || '—' },
              { label: 'Categoria', value: product.category },
              { label: 'Apporto', value: product.cal ? `${product.cal} kcal / 100g` : '—' },
            ].map((row, i, arr) => (
              <React.Fragment key={row.label}>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>{row.label}</Text>
                  <Text style={styles.detailValue}>{row.value}</Text>
                </View>
                {i < arr.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {/* Delete */}
        <View style={styles.section}>
          <Pill
            variant="ghost"
            size="lg"
            onPress={handleDelete}
            style={{ borderColor: 'rgba(189,74,48,0.2)', justifyContent: 'center' }}
          >
            <Text style={{ fontFamily: FONTS.sansSemiBold, color: T.urgent, fontSize: 16 }}>
              🗑 Rimuovi dalla dispensa
            </Text>
          </Pill>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  scroll: { paddingBottom: 32 },

  nav: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 8,
  },
  navBtn: {
    width: 40, height: 40, borderRadius: 100, backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.card,
  },
  navBtnText: { fontSize: 24, color: T.ink, lineHeight: 28 },

  hero: {
    margin: 16, borderRadius: 28, padding: 24,
    alignItems: 'center', gap: 6,
  },
  heroInitials: {
    fontFamily: FONTS.serifItalic, fontSize: 90, color: 'rgba(20,28,16,0.78)',
    lineHeight: 90, letterSpacing: -3,
  },
  heroBrand: {
    fontSize: 11, fontFamily: FONTS.sansBold, color: 'rgba(20,28,16,0.55)', letterSpacing: 0.5,
  },
  heroName: {
    fontFamily: FONTS.serifItalic, fontSize: 28, color: T.ink, letterSpacing: -0.5, lineHeight: 32,
    textAlign: 'center',
  },
  heroSub: { fontSize: 12, color: T.ink2, fontFamily: FONTS.sans },

  section: { paddingHorizontal: 20, marginBottom: 14 },
  sectionTitle: {
    fontFamily: FONTS.serifItalic, fontSize: 22, color: T.ink, letterSpacing: -0.3,
    paddingHorizontal: 20, marginBottom: 12,
  },

  expiryCard: { borderRadius: RADIUS.xl, padding: 18 },
  expiryLeft: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginBottom: 14 },
  expiryIcon: { width: 52, height: 52, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  expiryLabel: { fontSize: 12, fontFamily: FONTS.sansBold, letterSpacing: 0.4, textTransform: 'uppercase' },
  expiryDate: { fontFamily: FONTS.serifItalic, fontSize: 28, letterSpacing: -0.4, lineHeight: 32 },
  expiryAdded: { fontSize: 12, fontFamily: FONTS.sans, marginTop: 4 },
  progressBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: 100, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 100 },

  card: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, overflow: 'hidden', ...SHADOW.card,
  },
  zoneRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16, gap: 14,
  },
  zoneIconBox: {
    width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  zoneLabel: { fontSize: 14, fontFamily: FONTS.sansSemiBold, color: T.ink },
  zoneSub: { fontSize: 11, color: T.mute, marginTop: 1, fontFamily: FONTS.sans },
  checkBadge: {
    width: 22, height: 22, borderRadius: 100, backgroundColor: T.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  divider: { height: 0.5, backgroundColor: T.line, marginLeft: 16 },

  detailRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  detailLabel: { fontSize: 13, color: T.mute, fontFamily: FONTS.sans, flex: 1 },
  detailValue: {
    fontSize: 14, fontFamily: FONTS.sansSemiBold, color: T.ink,
    fontVariantNumeric: 'tabular-nums',
  },
});
