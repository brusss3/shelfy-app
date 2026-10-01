import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue, useAnimatedStyle, withSequence, withTiming, withSpring,
  LinearTransition, FadeOut,
} from 'react-native-reanimated';
import { LatestPrice, ShoppingItem } from '@/types';
import { ageLabel, formatPrice, recencyOf } from '@/lib/prices';
import { T, FONTS, RADIUS, CLAY, SURFACE, GRADIENT } from '@/constants/theme';

interface Props {
  item: ShoppingItem;
  /** Chi l'ha aggiunta, già risolto in un nome — solo in una casa condivisa. */
  addedByName?: string | null;
  /** Prezzo più basso ancora attuale; se manca, il più recente tra quelli vecchi. */
  price?: LatestPrice | null;
  /** Il prezzo si può segnalare solo per i prodotti con barcode. */
  onPricePress?: () => void;
  onToggle: () => void;
  onCountChange: (count: number) => void;
  onRemove: () => void;
}

function tap() {
  if (Platform.OS === 'web') return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

// Il gesto principale della schermata: spuntare. Il cerchio si schiaccia e
// rimbalza come un pezzo di plastilina, e la voce scende nel carrello.
export default function ShoppingRow({ item, addedByName, price, onPricePress, onToggle, onCountChange, onRemove }: Props) {
  const { t } = useTranslation();
  const squish = useSharedValue(1);
  const fill = useSharedValue(item.checked ? 1 : 0);

  useEffect(() => {
    fill.value = withTiming(item.checked ? 1 : 0, { duration: 160 });
  }, [item.checked]);

  const ringStyle = useAnimatedStyle(() => ({ transform: [{ scale: squish.value }] }));
  const checkStyle = useAnimatedStyle(() => ({ opacity: fill.value, transform: [{ scale: 0.6 + fill.value * 0.4 }] }));

  const handleToggle = () => {
    tap();
    squish.value = withSequence(
      withTiming(0.78, { duration: 70 }),
      withSpring(1, { damping: 7, stiffness: 260 }),
    );
    onToggle();
  };

  const sub = [item.qty, item.brand].filter(Boolean).join(' · ');

  return (
    <Animated.View layout={LinearTransition.duration(220)} exiting={FadeOut.duration(140)}>
      <LinearGradient colors={SURFACE.card} style={[styles.card, item.checked && styles.cardChecked]}>
        <Pressable
          onPress={handleToggle}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.checked }}
          accessibilityLabel={item.name}
          style={styles.ringHit}
        >
          <Animated.View style={[styles.ring, ringStyle, item.checked && styles.ringChecked]}>
            <Animated.View style={[StyleSheet.absoluteFill, checkStyle]}>
              <LinearGradient colors={GRADIENT.primary} style={styles.ringFill}>
                <Ionicons name="checkmark" size={18} color="#fbfaf3" />
              </LinearGradient>
            </Animated.View>
          </Animated.View>
        </Pressable>

        <Pressable onPress={handleToggle} style={styles.info}>
          <Text style={[styles.name, item.checked && styles.nameChecked]} numberOfLines={2}>
            {item.name}
          </Text>
          {(sub || addedByName) ? (
            <Text style={styles.sub} numberOfLines={1}>
              {[sub, addedByName].filter(Boolean).join(' · ')}
            </Text>
          ) : null}
          {onPricePress ? (
            <TouchableOpacity onPress={onPricePress} activeOpacity={0.7} hitSlop={6} style={styles.priceChip}>
              <Ionicons name="pricetag-outline" size={12} color={price ? T.primary : T.mute} />
              {price ? (
                <Text style={[styles.priceText, recencyOf(price.observedAt) !== 'fresh' && recencyOf(price.observedAt) !== 'recent' && styles.priceTextOld]} numberOfLines={1}>
                  {formatPrice(price.priceCents)} · {price.chain}
                  <Text style={styles.priceAge}> · {ageLabel(price.observedAt)}</Text>
                </Text>
              ) : (
                <Text style={styles.priceAdd}>{t('prices.addShort')}</Text>
              )}
            </TouchableOpacity>
          ) : null}
        </Pressable>

        {item.checked ? (
          item.count > 1 ? <Text style={styles.countChecked}>×{item.count}</Text> : null
        ) : (
          <View style={styles.stepper}>
            {item.count > 1 ? (
              <TouchableOpacity
                onPress={() => { tap(); onCountChange(item.count - 1); }}
                style={styles.stepBtn}
                accessibilityLabel={t('shopping.a11y.decrease')}
              >
                <Ionicons name="remove" size={16} color={T.ink2} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => { tap(); onRemove(); }}
                style={styles.stepBtn}
                accessibilityLabel={t('shopping.a11y.remove')}
              >
                <Ionicons name="trash-outline" size={15} color={T.ink2} />
              </TouchableOpacity>
            )}
            <Text style={styles.count}>{item.count}</Text>
            <TouchableOpacity
              onPress={() => { tap(); onCountChange(item.count + 1); }}
              style={styles.stepBtn}
              accessibilityLabel={t('shopping.a11y.increase')}
            >
              <Ionicons name="add" size={16} color={T.ink2} />
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
}

const RING = 30;

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.clay,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    boxShadow: CLAY.surface,
  },
  // Nel carrello la voce "si siede": meno rilievo, meno contrasto.
  cardChecked: { opacity: 0.62, boxShadow: CLAY.chip },
  ringHit: { padding: 2 },
  ring: {
    width: RING, height: RING, borderRadius: RING / 2,
    backgroundColor: T.bg,
    boxShadow: CLAY.inset,
    overflow: 'hidden',
  },
  ringChecked: { boxShadow: 'none' },
  ringFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0 },
  name: {
    fontSize: 16, fontFamily: FONTS.sansSemiBold, color: T.ink, letterSpacing: -0.1,
  },
  nameChecked: { textDecorationLine: 'line-through', color: T.mute },
  sub: { fontSize: 12, color: T.mute, marginTop: 2, fontFamily: FONTS.sans },
  priceChip: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, alignSelf: 'flex-start' },
  priceText: { fontSize: 12, fontFamily: FONTS.sansSemiBold, color: T.primary, flexShrink: 1 },
  priceTextOld: { color: T.warn },
  priceAge: { fontFamily: FONTS.sans, color: T.mute },
  priceAdd: { fontSize: 12, fontFamily: FONTS.sansMedium, color: T.mute },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  stepBtn: {
    width: 32, height: 32, borderRadius: RADIUS.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  count: {
    minWidth: 16, textAlign: 'center',
    fontSize: 15, fontFamily: FONTS.sansBold, color: T.ink,
  },
  countChecked: { fontSize: 13, fontFamily: FONTS.sansBold, color: T.mute },
});
