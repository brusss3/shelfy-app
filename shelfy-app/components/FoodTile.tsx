import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Product } from '@/types';
import { T, FONTS, CLAY } from '@/constants/theme';
import { getInitials } from '@/lib/text';
import { lighten, darken } from '@/lib/color';

interface Props {
  product: Partial<Product> & { name: string; tint?: string };
  size?: number;
  radius?: number;
}

export default function FoodTile({ product, size = 56, radius = 16 }: Props) {
  const initials = getInitials(product.name);
  const base = product.tint || T.primarySoft;

  return (
    <LinearGradient
      colors={[lighten(base, 0.14), base, darken(base, 0.13)]}
      locations={[0, 0.5, 1]}
      style={[styles.tile, { width: size, height: size, borderRadius: radius }]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.44 }]}>{initials}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    boxShadow: CLAY.chip,
  },
  initial: {
    fontFamily: FONTS.serifItalic,
    color: 'rgba(20, 28, 16, 0.82)',
    letterSpacing: -0.5,
    // Iniziali "incise": una sottile luce sotto al glifo lo fa sembrare
    // scavato nella superficie invece che scritto sopra.
    textShadowColor: 'rgba(255,255,255,0.65)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 0,
  },
});
