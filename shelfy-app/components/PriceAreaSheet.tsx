import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView, Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { T, FONTS, RADIUS, CLAY } from '@/constants/theme';
import { RADIUS_CHOICES_KM } from '@/lib/prices';
import PrimaryButton from './PrimaryButton';

interface Props {
  visible: boolean;
  city: string;
  radiusKm: number;
  onSave: (city: string, radiusKm: number) => void;
  onClose: () => void;
}

// Comune e raggio entro cui cercare i prezzi di Open Prices: si impostano una
// volta e si ricordano sul dispositivo.
export default function PriceAreaSheet({ visible, city, radiusKm, onSave, onClose }: Props) {
  const { t } = useTranslation();
  const [cityText, setCityText] = useState(city);
  const [radius, setRadius] = useState(radiusKm);

  useEffect(() => {
    if (visible) { setCityText(city); setRadius(radiusKm); }
  }, [visible, city, radiusKm]);

  const canSave = cityText.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            <View style={styles.header}>
              <Text style={styles.title}>{t('prices.areaTitle')}</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
                <Ionicons name="close" size={24} color={T.ink2} />
              </TouchableOpacity>
            </View>

            <View style={styles.body}>
              <Text style={styles.hint}>{t('prices.areaHint')}</Text>

              <Text style={styles.label}>{t('prices.cityLabel')}</Text>
              <View style={styles.inputWrap}>
                <TextInput
                  value={cityText}
                  onChangeText={setCityText}
                  placeholder={t('prices.cityPlaceholder')}
                  placeholderTextColor={T.mute}
                  style={styles.input}
                  autoCapitalize="words"
                  maxLength={60}
                />
              </View>

              <Text style={styles.label}>{t('prices.radiusLabel')}</Text>
              <View style={styles.chips}>
                {RADIUS_CHOICES_KM.map((km) => {
                  const active = radius === km;
                  return (
                    <TouchableOpacity
                      key={km}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => setRadius(km)}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{t('prices.radiusKm', { km })}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <PrimaryButton
                onPress={() => onSave(cityText.trim(), radius)}
                label={t('prices.areaSave')}
                disabled={!canSave}
                fullWidth
                containerStyle={{ marginTop: 18 }}
              />
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(20,28,18,0.42)', justifyContent: 'flex-end' },
  kav: { width: '100%', alignItems: 'center' },
  sheet: {
    width: '100%', maxWidth: 560,
    backgroundColor: T.bg, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl,
    paddingTop: 8,
  },
  grabber: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: T.line, marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontFamily: FONTS.sansBold, fontSize: 20, color: T.ink, letterSpacing: -0.3 },
  body: { paddingHorizontal: 16, paddingBottom: 28, gap: 8 },
  hint: { fontFamily: FONTS.sans, fontSize: 13, color: T.ink2, lineHeight: 19, marginHorizontal: 2 },
  label: { fontFamily: FONTS.sansSemiBold, fontSize: 13, color: T.ink2, marginTop: 8, marginLeft: 2 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', height: 48, borderRadius: RADIUS.input,
    paddingHorizontal: 16, backgroundColor: T.bg, boxShadow: CLAY.inset,
  },
  input: {
    flex: 1, fontSize: 16, fontFamily: FONTS.sans, color: T.ink,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: RADIUS.md,
    backgroundColor: T.surface, boxShadow: CLAY.chip,
  },
  chipActive: { backgroundColor: T.primary },
  chipText: { fontFamily: FONTS.sansMedium, fontSize: 14, color: T.ink },
  chipTextActive: { color: '#fbfaf3' },
});
