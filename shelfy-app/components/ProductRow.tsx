import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import FoodTile from './FoodTile';
import { Product } from '@/types';
import { urgencyOf, effectiveDays } from '@/lib/urgency';
import { T, FONTS, RADIUS, CLAY, SURFACE } from '@/constants/theme';

interface Props {
  product: Product;
  onPress: () => void;
}

const ZONE_ICONS: Record<string, string> = {
  frigo: '❄️',
  freezer: '🧊',
  dispensa: '📦',
};

export default function ProductRow({ product, onPress }: Props) {
  const days = effectiveDays(product);
  const u = urgencyOf(days);
  const isOpened = !!product.openedAt;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
      <LinearGradient colors={SURFACE.card} style={styles.card}>
        <FoodTile product={product} size={52} radius={RADIUS.md} />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
            {product.count > 1 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>×{product.count}</Text>
              </View>
            )}
            {isOpened && (
              <View style={styles.openedBadge}>
                <Text style={styles.openedBadgeText}>Aperto</Text>
              </View>
            )}
          </View>
          <Text style={styles.sub} numberOfLines={1}>
            {ZONE_ICONS[product.zone]}  {product.qty} · {product.brand}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: u.soft }]}>
          <Text style={[styles.badgeText, { color: u.ink }]}>{u.label}</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.clay,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    boxShadow: CLAY.surface,
  },
  info: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: {
    fontSize: 15,
    fontFamily: FONTS.sansSemiBold,
    color: T.ink,
    letterSpacing: -0.1,
    flexShrink: 1,
  },
  countBadge: {
    backgroundColor: T.primarySoft,
    borderRadius: 9,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  countBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.sansBold,
    color: T.primaryInk,
    letterSpacing: 0.2,
  },
  openedBadge: {
    backgroundColor: '#e8f0e8',
    borderRadius: 9,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  openedBadgeText: {
    fontSize: 10,
    fontFamily: FONTS.sansBold,
    color: '#3a6b3a',
    letterSpacing: 0.2,
  },
  sub: {
    fontSize: 12,
    color: T.mute,
    marginTop: 3,
    fontFamily: FONTS.sans,
  },
  badge: {
    borderRadius: 9,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: FONTS.sansBold,
    letterSpacing: 0.1,
  },
});
