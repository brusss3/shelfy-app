import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Product } from '@/types';
import { T, FONTS } from '@/constants/theme';

interface Props {
  product: Partial<Product> & { name: string; tint?: string };
  size?: number;
  radius?: number;
}

export default function FoodTile({ product, size = 56, radius = 14 }: Props) {
  const initials = product.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

  const bg = product.tint || T.primarySoft;

  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: radius, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.46 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  initial: {
    fontFamily: FONTS.serifItalic,
    color: 'rgba(20, 28, 16, 0.78)',
    letterSpacing: -0.5,
  },
});
