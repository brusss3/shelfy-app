import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { T, FONTS, RADIUS } from '@/constants/theme';

interface Props {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}

// Pulsante condiviso "Continua con Google" (presentazionale).
export default function GoogleButtonUI({ onPress, loading, disabled }: Props) {
  return (
    <TouchableOpacity
      style={[styles.btn, (disabled || loading) && { opacity: 0.55 }]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="Continua con Google"
    >
      {loading ? (
        <ActivityIndicator color={T.ink} />
      ) : (
        <View style={styles.inner}>
          <Text style={styles.g}>G</Text>
          <Text style={styles.text}>Continua con Google</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: T.surface,
    borderRadius: RADIUS.pill,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: T.line,
  },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  g: { fontFamily: FONTS.sansBold, fontSize: 17, color: '#4285F4' },
  text: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink },
});
