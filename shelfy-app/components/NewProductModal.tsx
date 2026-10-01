import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { T, FONTS, RADIUS, CLAY } from '@/constants/theme';
import PrimaryButton from './PrimaryButton';

export interface NewProductData {
  name: string;
  brand: string;
  qty: string;
}

interface Props {
  visible: boolean;
  barcode: string;
  saving?: boolean;
  /** Etichetta del pulsante secondario ("Salta", "Riprova"…). */
  skipLabel: string;
  onSave: (data: NewProductData) => void;
  onSkip: () => void;
}

// Codice a barre sconosciuto: invece di un vicolo cieco, chi scansiona può
// dargli un nome. Da quel momento il prodotto entra nel catalogo Shelfy e lo
// trova chiunque scansioni lo stesso codice.
export default function NewProductModal({ visible, barcode, saving, skipLabel, onSave, onSkip }: Props) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [qty, setQty] = useState('');

  useEffect(() => {
    if (visible) { setName(''); setBrand(''); setQty(''); }
  }, [visible, barcode]);

  const canSave = name.trim().length >= 2 && !saving;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onSkip}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.card}>
          <Text style={styles.title}>{t('catalog.title')}</Text>
          <Text style={styles.body}>{t('catalog.body', { barcode })}</Text>

          <View style={styles.field}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('catalog.namePlaceholder')}
              placeholderTextColor={T.mute}
              style={styles.input}
              maxLength={120}
              autoFocus
              autoCapitalize="sentences"
              returnKeyType="next"
            />
          </View>
          <View style={styles.row}>
            <View style={[styles.field, { flex: 1 }]}>
              <TextInput
                value={brand}
                onChangeText={setBrand}
                placeholder={t('catalog.brandPlaceholder')}
                placeholderTextColor={T.mute}
                style={styles.input}
                maxLength={60}
                autoCapitalize="words"
              />
            </View>
            <View style={[styles.field, { width: 110 }]}>
              <TextInput
                value={qty}
                onChangeText={setQty}
                placeholder={t('catalog.qtyPlaceholder')}
                placeholderTextColor={T.mute}
                style={styles.input}
                maxLength={30}
              />
            </View>
          </View>

          <Text style={styles.note}>{t('catalog.note')}</Text>

          <PrimaryButton
            onPress={() => onSave({ name: name.trim(), brand: brand.trim(), qty: qty.trim() })}
            label={t('catalog.save')}
            disabled={!canSave}
            loading={saving}
            fullWidth
          />
          <TouchableOpacity onPress={onSkip} disabled={saving} style={styles.skip} activeOpacity={0.7}>
            <Text style={styles.skipText}>{skipLabel}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { backgroundColor: T.bg, borderRadius: RADIUS.xl, padding: 22, width: '100%', maxWidth: 380, gap: 10 },
  title: { fontFamily: FONTS.sansBold, fontSize: 20, color: T.ink, letterSpacing: -0.3 },
  body: { fontFamily: FONTS.sans, fontSize: 13, color: T.ink2, lineHeight: 19, marginBottom: 4 },
  row: { flexDirection: 'row', gap: 10 },
  field: {
    height: 48, borderRadius: RADIUS.input, paddingHorizontal: 16,
    justifyContent: 'center', backgroundColor: T.bg, boxShadow: CLAY.inset,
  },
  input: {
    fontSize: 15, fontFamily: FONTS.sans, color: T.ink,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  note: { fontFamily: FONTS.sans, fontSize: 11, color: T.mute, lineHeight: 16, marginBottom: 4 },
  skip: { alignItems: 'center', paddingVertical: 10 },
  skipText: { fontFamily: FONTS.sansSemiBold, fontSize: 14, color: T.mute },
});
