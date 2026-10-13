import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, useAnimatedReaction, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import ProductRow from './ProductRow';
import { Product } from '@/types';
import { FONTS, RADIUS } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/context/ThemeContext';

interface Props {
  product: Product;
  onPress: () => void;
  onConsume: () => void;
  onDiscard: () => void;
  /** Assente per gli ospiti: niente lista della spesa, niente swipe a destra. */
  onShop?: () => void;
  /** Una sola volta, sulla prima riga: la riga accenna lo swipe da sola. */
  peek?: boolean;
  /** Prodotto appena aggiunto: la riga si illumina una volta. */
  highlight?: boolean;
}

// Larghezza di ciascun pulsante rivelato dallo swipe a sinistra.
const ACTION_W = 78;
const REVEAL = ACTION_W * 2;
// Oltre questa distanza lo swipe a destra aggiunge alla spesa.
const SHOP_AT = 88;
// Trascinata oltre questa frazione della riga, lo swipe a sinistra segna
// "consumato" senza passare dai pulsanti.
const FULL_AT = 0.55;

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

function haptic() {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
}

// Riga della home con le azioni a portata di pollice, come nella posta:
// - a destra: aggiunge alla lista della spesa e torna al suo posto;
// - a sinistra corto: rivela "Consumato" e "Buttato";
// - a sinistra lungo: consumato direttamente (l'azione più frequente).
// Il gesto vive tutto sul thread UI; si torna su React solo a gesto finito.
export default function SwipeableProductRow({ product, onPress, onConsume, onDiscard, onShop, peek, highlight }: Props) {
  const { T } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const canShop = !!onShop;

  const x = useSharedValue(0);
  const start = useSharedValue(0);
  const width = useSharedValue(360);
  // Fine dell'ultimo trascinamento: col mouse il rilascio genera anche un
  // clic sulla riga, che non va scambiato per un tocco (la richiuderebbe).
  const dragEndedAt = useSharedValue(0);

  const close = () => x.set(withSpring(0, { duration: 300, dampingRatio: 1 }));

  // Le azioni arrivano dalla home come funzioni nuove a ogni render: tenute
  // in un ref, il gesto non va ricreato (e riagganciato) ogni volta.
  const actions = useRef({ onShop, onConsume });
  actions.current = { onShop, onConsume };
  const fireShop = useCallback(() => actions.current.onShop?.(), []);
  const fireConsume = useCallback(() => actions.current.onConsume(), []);

  const pan = useMemo(() => Gesture.Pan()
    // Sul web non c'è un thread UI separato e i callback "worklet" del gesto
    // non vengono mai chiamati: lì girano sul thread JS, sul telefono no.
    .runOnJS(Platform.OS === 'web')
    // Asse dichiarato: senza, il gesto ruberebbe lo scroll verticale.
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onStart(() => { start.set(x.get()); })
    .onUpdate((e) => {
      const next = start.get() + e.translationX;
      // Senza lista della spesa a destra non c'è niente: la riga resiste.
      x.set(next > 0 && !canShop ? next * 0.15 : next);
    })
    .onEnd((e) => {
      const w = width.get();
      if (x.get() > 0) {
        // Anche qui conta il trascinamento, non il colpo: niente aggiunte per sbaglio.
        if (canShop && x.get() > SHOP_AT) scheduleOnRN(fireShop);
        x.set(withSpring(0, { duration: 300, dampingRatio: 0.8, velocity: e.velocityX }));
        return;
      }
      // Il "consumato" diretto vuole un trascinamento vero oltre la soglia,
      // non un colpo veloce: altrimenti ogni colpetto per aprire i pulsanti
      // (proiezione di centinaia di pixel) scatterebbe come swipe lungo.
      if (x.get() < -w * FULL_AT) {
        x.set(withTiming(-w, { duration: 200, easing: EASE_OUT }, (finished) => {
          if (!finished) return;
          scheduleOnRN(fireConsume);
          // Con più unità la riga resta (una in meno): torna al suo posto.
          x.set(withDelay(150, withSpring(0, { duration: 300, dampingRatio: 1 })));
        }));
        return;
      }
      // Aperta, la riga resta ferma sui pulsanti finché non si sceglie o la
      // si richiude (tocco sulla riga o swipe a destra). Decide soprattutto
      // la distanza: un tremolio all'indietro al rilascio non deve richiuderla,
      // solo un colpo deciso nell'altro verso.
      const wasOpen = start.get() <= -REVEAL / 2;
      const dist = x.get();
      const open = e.velocityX < -600
        || (e.velocityX < 600 && dist < (wasOpen ? -REVEAL * 0.65 : -REVEAL * 0.3));
      x.set(withSpring(open ? -REVEAL : 0, { duration: 300, dampingRatio: 1, velocity: e.velocityX }));
    })
    .onFinalize((_e, success) => {
      if (success) dragEndedAt.set(Date.now());
    }), [canShop, fireShop, fireConsume]);

  // Una vibrazione quando il gesto "aggancia" un'azione, non a ogni frame.
  useAnimatedReaction(
    () => {
      const v = x.get();
      if (v > SHOP_AT && canShop) return 1;
      if (v < -width.get() * FULL_AT) return -1;
      return 0;
    },
    (zone, prev) => {
      if (prev !== null && zone !== 0 && zone !== prev) scheduleOnRN(haptic);
    },
    [canShop],
  );

  useEffect(() => {
    if (!peek || reduced) return;
    x.set(withDelay(700, withSequence(
      withTiming(-56, { duration: 380, easing: EASE_OUT }),
      withTiming(0, { duration: 380, easing: EASE_OUT }),
    )));
  }, [peek]);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const shopLayer = useAnimatedStyle(() => ({ opacity: x.get() > 0 ? 1 : 0 }));
  const actionsLayer = useAnimatedStyle(() => ({ opacity: x.get() < 0 ? 1 : 0 }));

  // Toccare la riga aperta la chiude, invece di aprire il dettaglio.
  const handlePress = () => {
    if (Date.now() - dragEndedAt.get() < 400) return;
    if (x.get() !== 0) close();
    else onPress();
  };

  const act = (fn: () => void) => () => { close(); fn(); };

  return (
    <View onLayout={(e: LayoutChangeEvent) => width.set(e.nativeEvent.layout.width)}>
      {canShop && (
        <Animated.View style={[styles.layer, styles.shopLayer, shopLayer]} pointerEvents="none">
          <Ionicons name="cart-outline" size={20} color={T.onPrimary} />
          <Text style={styles.shopText}>{t('home.swipe.shop')}</Text>
        </Animated.View>
      )}
      {/* "Consumato" sul bordo: è il primo che si vede ed è quello che scatta
          con lo swipe lungo, come l'azione principale nella posta. */}
      <Animated.View style={[styles.layer, styles.actionsLayer, actionsLayer]}>
        <Pressable style={[styles.action, { backgroundColor: T.urgent }]} onPress={act(onDiscard)} accessibilityRole="button">
          <Ionicons name="trash-outline" size={19} color={T.onPrimary} />
          <Text style={styles.actionText}>{t('home.swipe.discard')}</Text>
        </Pressable>
        <Pressable style={[styles.action, styles.actionLast, { backgroundColor: T.primary }]} onPress={act(onConsume)} accessibilityRole="button">
          <Ionicons name="checkmark" size={20} color={T.onPrimary} />
          <Text style={styles.actionText}>{t('home.swipe.consume')}</Text>
        </Pressable>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View style={cardStyle}>
          <ProductRow product={product} onPress={handlePress} />
          {highlight && <Glow />}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

// Bagliore unico sopra la riga appena aggiunta: compare e svanisce, una volta.
function Glow() {
  const { T } = useTheme();
  const [done, setDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setDone(true), 1600);
    return () => clearTimeout(id);
  }, []);
  if (done) return null;
  return <Animated.View pointerEvents="none" style={[glowStyle.base, { backgroundColor: T.primary }]} />;
}

// Oggetto semplice: i tipi di React Native non conoscono le animazioni CSS.
const glowStyle = {
  base: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: RADIUS.clay,
    opacity: 0,
    animationName: { from: { opacity: 0 }, '30%': { opacity: 0.22 }, to: { opacity: 0 } },
    animationDuration: '1400ms',
    animationTimingFunction: 'ease-out',
  },
} as const;

const createStyles = ({ T }: Theme) => StyleSheet.create({
  layer: {
    position: 'absolute', top: 0, bottom: 0, left: 0, right: 0,
    borderRadius: RADIUS.clay, overflow: 'hidden',
  },
  shopLayer: {
    backgroundColor: T.primary,
    flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 22,
  },
  shopText: { color: T.onPrimary, fontFamily: FONTS.sansSemiBold, fontSize: 13 },
  actionsLayer: { flexDirection: 'row', justifyContent: 'flex-end' },
  action: {
    width: ACTION_W, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  actionLast: { borderTopRightRadius: RADIUS.clay, borderBottomRightRadius: RADIUS.clay },
  actionText: { color: T.onPrimary, fontFamily: FONTS.sansSemiBold, fontSize: 11 },
});
