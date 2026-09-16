import React from 'react';
import {
  ActivityIndicator, Platform, StyleProp, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { DEPTH, FONTS, GRADIENT, RADIUS, T } from '@/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

interface PrimaryButtonProps {
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** 'pill' per bottoni testo/CTA, 'circle' per FAB icona-sola. */
  shape?: 'pill' | 'circle';
  /** Lato del cerchio quando shape='circle'. */
  size?: number;
  icon?: IoniconName;
  /** 'inline': icona piccola accanto al testo (default). 'shutter': badge
   *  circolare chiaro con l'icona dentro — riservato al bottone scan della
   *  home, richiama l'otturatore di una fotocamera. */
  iconVariant?: 'inline' | 'shutter';
  label?: string;
  subLabel?: string;
  /** Su nativo (non web) nasconde label/subLabel e mostra solo l'icona,
   *  centrata e ingrandita — per la CTA scan della home su mobile. */
  compactOnNative?: boolean;
  /** Riempie la larghezza del contenitore (stretch sull'asse trasversale). */
  fullWidth?: boolean;
  /** Stile sul wrapper esterno — usalo per `flex: 1` dentro una row. */
  containerStyle?: StyleProp<ViewStyle>;
  /** Stile sulla superficie sfumata interna (solo look, non il layout esterno). */
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

// Pulsante primario condiviso: stessa sfumatura verde + stack di ombre
// (esterna + bordi interni chiaro/scuro) ovunque nell'app, così il "senso
// di rilievo" dei bottoni è uniforme invece di essere ridisegnato a mano
// schermata per schermata. Icone sempre Ionicons flat (mai emoji): le emoji
// restano solo per elementi decorativi/informativi (tab bar, zone, badge),
// non per le azioni nei bottoni.
export default function PrimaryButton({
  onPress, disabled, loading, shape = 'pill', size = 56,
  icon, iconVariant = 'inline', label, subLabel, compactOnNative,
  fullWidth, containerStyle, style, labelStyle, accessibilityLabel,
}: PrimaryButtonProps) {
  const isCircle = shape === 'circle';
  const compact = compactOnNative && Platform.OS !== 'web';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityLabel={accessibilityLabel ?? label}
      style={[fullWidth && { alignSelf: 'stretch' }, containerStyle, (disabled || loading) && styles.disabled]}
    >
      <LinearGradient
        colors={GRADIENT.primary}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          isCircle
            ? { width: size, height: size, borderRadius: size / 2 }
            : [styles.pill, compact && styles.pillCompact],
          styles.depth,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color="#fbfaf3" />
        ) : isCircle ? (
          icon ? <Ionicons name={icon} size={20} color="#fbfaf3" /> : null
        ) : compact ? (
          icon ? (
            iconVariant === 'shutter' ? (
              <View style={styles.shutter}>
                <Ionicons name={icon} size={22} color={T.primary} />
              </View>
            ) : (
              <Ionicons name={icon} size={22} color="#fbfaf3" />
            )
          ) : null
        ) : (
          <View style={styles.pillContent}>
            {icon ? (
              iconVariant === 'shutter' ? (
                <View style={styles.shutter}>
                  <Ionicons name={icon} size={20} color={T.primary} />
                </View>
              ) : (
                <Ionicons name={icon} size={18} color="#fbfaf3" />
              )
            ) : null}
            <View>
              <Text style={[styles.label, labelStyle]}>{label}</Text>
              {subLabel ? <Text style={styles.subLabel}>{subLabel}</Text> : null}
            </View>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  disabled: { opacity: 0.5 },
  depth: { boxShadow: DEPTH.button },
  pill: {
    borderRadius: RADIUS.lg, paddingVertical: 16, paddingHorizontal: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  pillCompact: { paddingVertical: 14, paddingHorizontal: 14 },
  pillContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shutter: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: T.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  label: {
    fontFamily: FONTS.sansBold, fontSize: 16, color: '#fbfaf3', letterSpacing: -0.1,
    textAlign: 'center',
  },
  subLabel: {
    fontFamily: FONTS.sans, fontSize: 11, color: 'rgba(251,250,243,0.72)', marginTop: 1,
  },
});
