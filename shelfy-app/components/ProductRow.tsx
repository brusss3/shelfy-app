import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import FoodTile from './FoodTile';
import { Product } from '@/types';
import { urgencyOf } from '@/lib/urgency';
import { T, FONTS, RADIUS, SHADOW } from '@/constants/theme';
import { daysTo } from '@/context/ProductsContext';

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
  const days = daysTo(product.expiry);
  const u = urgencyOf(days);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85} style={styles.card}>
      <FoodTile product={product} size={52} radius={RADIUS.md} />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{product.name}</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {ZONE_ICONS[product.zone]}  {product.qty} · {product.brand}
        </Text>
      </View>
      <View style={[styles.badge, { backgroundColor: u.soft }]}>
        <Text style={[styles.badgeText, { color: u.ink }]}>{u.label}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: T.surface,
    borderRadius: RADIUS.lg,
    padding: 12,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    ...SHADOW.card,
  },
  info: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 15,
    fontFamily: FONTS.sansSemiBold,
    color: T.ink,
    letterSpacing: -0.1,
  },
  sub: {
    fontSize: 12,
    color: T.mute,
    marginTop: 3,
    fontFamily: FONTS.sans,
  },
  badge: {
    borderRadius: 100,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: FONTS.sansBold,
    letterSpacing: 0.1,
  },
});
