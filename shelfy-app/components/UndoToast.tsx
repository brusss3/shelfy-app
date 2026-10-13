import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { Easing, FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { FONTS, RADIUS } from '@/constants/theme';
import { useThemedStyles, type Theme } from '@/context/ThemeContext';

export interface ToastAction {
  label: string;
  onPress: () => void;
}

interface Props {
  message: string;
  actions?: ToastAction[];
  /** Distanza dal fondo dello schermo (sopra la barra azioni della home). */
  bottom: number;
}

const ENTER = FadeInDown.duration(220).easing(Easing.bezier(0.23, 1, 0.32, 1));
const EXIT = FadeOutDown.duration(160);

// Avviso in basso dopo un'azione rapida (swipe): conferma cosa è successo e,
// per qualche secondo, permette di tornare indietro. Il tempo lo gestisce chi
// lo mostra: qui c'è solo l'aspetto.
export default function UndoToast({ message, actions = [], bottom }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <Animated.View entering={ENTER} exiting={EXIT} style={[styles.wrap, { bottom }]} pointerEvents="box-none">
      <View style={styles.toast} accessibilityLiveRegion="polite">
        <Text style={styles.text} numberOfLines={2}>{message}</Text>
        {actions.map((a) => (
          <Pressable key={a.label} onPress={a.onPress} hitSlop={8} accessibilityRole="button" style={styles.action}>
            <Text style={styles.actionText}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

const createStyles = ({ T }: Theme) => StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    maxWidth: 520, backgroundColor: T.ink, borderRadius: RADIUS.md,
    paddingVertical: 10, paddingLeft: 16, paddingRight: 12,
    boxShadow: '0px 6px 18px rgba(0,0,0,0.18)',
  },
  text: { flexShrink: 1, color: T.bg, fontSize: 13, fontFamily: FONTS.sansMedium },
  action: { paddingVertical: 4 },
  actionText: { color: T.primarySoft, fontSize: 13, fontFamily: FONTS.sansBold },
});
