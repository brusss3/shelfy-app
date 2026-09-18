import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator, Modal, TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import { useTranslation } from 'react-i18next';
import { showAlert } from '@/lib/alert';
import { buildLabelsHtml } from '@/lib/labels';
import PrimaryButton from '@/components/PrimaryButton';
import { T, FONTS, RADIUS, SHADOW, CLAY } from '@/constants/theme';

const DURATIONS = [
  { h: 24, labelKey: 'labels.durations.h24' },
  { h: 48, labelKey: 'labels.durations.h48' },
  { h: 72, labelKey: 'labels.durations.h72' },
  { h: 120, labelKey: 'labels.durations.h120' },
  { h: 168, labelKey: 'labels.durations.h168' },
];

const COPY_PRESETS = [21, 42, 63];

export default function LabelsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();

  const formatDateTime = (d: Date): string => {
    const locale = i18n.language === 'it' ? 'it-IT' : 'en-US';
    const date = d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return `${date} · ${time}`;
  };

  const [packagingDate, setPackagingDate] = useState(new Date());
  const [durationHours, setDurationHours] = useState(72);
  const [copies, setCopies] = useState(21);
  const [generating, setGenerating] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [pickerDay, setPickerDay] = useState('');
  const [pickerMonth, setPickerMonth] = useState('');
  const [pickerYear, setPickerYear] = useState('');
  const [pickerHour, setPickerHour] = useState('');
  const [pickerMinute, setPickerMinute] = useState('');

  const expiryDate = new Date(packagingDate.getTime() + durationHours * 3600 * 1000);

  const openTimePicker = () => {
    setPickerDay(String(packagingDate.getDate()));
    setPickerMonth(String(packagingDate.getMonth() + 1));
    setPickerYear(String(packagingDate.getFullYear()));
    setPickerHour(String(packagingDate.getHours()));
    setPickerMinute(String(packagingDate.getMinutes()));
    setShowTimePicker(true);
  };

  const confirmTimePicker = () => {
    const d = Math.max(1, Math.min(31, parseInt(pickerDay) || 1));
    const m = Math.max(1, Math.min(12, parseInt(pickerMonth) || 1));
    const y = parseInt(pickerYear) || new Date().getFullYear();
    const h = Math.max(0, Math.min(23, parseInt(pickerHour) || 0));
    const min = Math.max(0, Math.min(59, parseInt(pickerMinute) || 0));
    setPackagingDate(new Date(y, m - 1, d, h, min));
    setShowTimePicker(false);
  };

  const resetToNow = () => setPackagingDate(new Date());

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const html = buildLabelsHtml({ packagingDate, expiryDate, copies });
      if (Platform.OS === 'web') {
        const win = window.open('', '_blank');
        if (!win) {
          showAlert(t('labels.popupBlockedTitle'), t('labels.popupBlockedBody'));
          return;
        }
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
      } else {
        await Print.printAsync({ html });
      }
    } catch (e: any) {
      showAlert(t('common.error'), e?.message ?? t('labels.generateFailed'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('labels.headerTitle')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.content}>
        <Text style={styles.intro}>
          {t('labels.intro')}
        </Text>

        <Text style={styles.sectionLabel}>{t('labels.packagedOnSection')}</Text>
        <TouchableOpacity style={styles.card} onPress={openTimePicker} activeOpacity={0.85}>
          <Text style={styles.dateValue}>{formatDateTime(packagingDate)}</Text>
          <Text style={styles.dateEdit}>{t('labels.editDate')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={resetToNow} activeOpacity={0.7}>
          <Text style={styles.nowLink}>{t('labels.useNow')}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>{t('labels.durationSection')}</Text>
        <View style={styles.chipsRow}>
          {DURATIONS.map((d) => {
            const active = durationHours === d.h;
            return (
              <TouchableOpacity
                key={d.h}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setDurationHours(d.h)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{t(d.labelKey)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.card}>
          <Text style={styles.expiryLabel}>{t('labels.expiresOnLabel')}</Text>
          <Text style={styles.expiryValue}>{formatDateTime(expiryDate)}</Text>
        </View>

        <Text style={styles.sectionLabel}>{t('labels.howManySection')}</Text>
        <View style={styles.chipsRow}>
          {COPY_PRESETS.map((n) => {
            const active = copies === n;
            return (
              <TouchableOpacity
                key={n}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setCopies(n)}
                activeOpacity={0.85}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{n} ({t('labels.sheetsCount', { count: Math.round(n / 21) })})</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <View style={styles.stepperRow}>
          <TouchableOpacity style={styles.stepperBtn} onPress={() => setCopies((c) => Math.max(1, c - 1))} activeOpacity={0.85}>
            <Text style={styles.stepperBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepperValue}>{t('labels.labelsCount', { count: copies })}</Text>
          <TouchableOpacity style={styles.stepperBtn} onPress={() => setCopies((c) => c + 1)} activeOpacity={0.85}>
            <Text style={styles.stepperBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <PrimaryButton
          onPress={handleGenerate}
          loading={generating}
          icon="print-outline"
          label={t('labels.generateAndPrint')}
          fullWidth
        />
      </View>

      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowTimePicker(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('labels.pickerTitle')}</Text>
            <View style={styles.pickerRow}>
              <PickerCol label={t('labels.day')} value={pickerDay} onChange={setPickerDay} maxLength={2} />
              <PickerCol label={t('labels.month')} value={pickerMonth} onChange={setPickerMonth} maxLength={2} />
              <PickerCol label={t('labels.year')} value={pickerYear} onChange={setPickerYear} maxLength={4} />
            </View>
            <View style={styles.pickerRow}>
              <PickerCol label={t('labels.hour')} value={pickerHour} onChange={setPickerHour} maxLength={2} />
              <PickerCol label={t('labels.minute')} value={pickerMinute} onChange={setPickerMinute} maxLength={2} />
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setShowTimePicker(false)} activeOpacity={0.85}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <PrimaryButton onPress={confirmTimePicker} label={t('common.datePicker.confirm')} containerStyle={{ flex: 1.5 }} />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function PickerCol({ label, value, onChange, maxLength }: { label: string; value: string; onChange: (v: string) => void; maxLength: number }) {
  return (
    <View style={styles.pickerCol}>
      <Text style={styles.pickerLabel}>{label}</Text>
      <TextInput
        style={styles.pickerInput}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        maxLength={maxLength}
        selectTextOnFocus
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 100, backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.card,
  },
  closeBtnText: { fontSize: 18, color: T.ink },
  headerTitle: { fontSize: 16, fontFamily: FONTS.sansSemiBold, color: T.ink },

  content: { flex: 1, paddingHorizontal: 20 },
  intro: { fontFamily: FONTS.sans, fontSize: 13, color: T.ink2, lineHeight: 19, marginBottom: 20 },

  sectionLabel: {
    fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.6,
    marginBottom: 8, marginTop: 4,
  },
  card: {
    backgroundColor: T.surface, borderRadius: RADIUS.lg, padding: 16,
    marginBottom: 8, ...SHADOW.card,
  },
  dateValue: { fontFamily: FONTS.sansBold, fontSize: 16, color: T.ink },
  dateEdit: { fontFamily: FONTS.sansMedium, fontSize: 13, color: T.primary, marginTop: 4 },
  nowLink: { fontFamily: FONTS.sansMedium, fontSize: 13, color: T.mute, marginBottom: 18 },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: {
    backgroundColor: T.surface, borderRadius: RADIUS.md,
    paddingVertical: 8, paddingHorizontal: 14,
    borderWidth: 1, borderColor: T.line,
  },
  chipActive: { backgroundColor: T.primary, borderColor: T.primary },
  chipText: { fontSize: 13, fontFamily: FONTS.sansSemiBold, color: T.ink2 },
  chipTextActive: { color: '#fbfaf3' },

  expiryLabel: { fontFamily: FONTS.sans, fontSize: 12, color: T.mute },
  expiryValue: { fontFamily: FONTS.sansBold, fontSize: 16, color: T.primaryInk, marginTop: 2 },

  stepperRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20,
    marginTop: 8, marginBottom: 18,
  },
  stepperBtn: {
    width: 40, height: 40, borderRadius: 100, backgroundColor: T.surface,
    alignItems: 'center', justifyContent: 'center', ...SHADOW.card,
  },
  stepperBtnText: { fontSize: 22, fontFamily: FONTS.sansBold, color: T.primary, lineHeight: 24 },
  stepperValue: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.ink, minWidth: 110, textAlign: 'center' },

  footer: {
    paddingHorizontal: 20, paddingTop: 12,
    borderTopWidth: 0.5, borderTopColor: T.line, backgroundColor: T.bg,
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalCard: {
    backgroundColor: T.surface, borderRadius: 24, padding: 24,
    width: 320, gap: 12,
  },
  modalTitle: { fontFamily: FONTS.serifItalic, fontSize: 20, color: T.ink, letterSpacing: -0.3 },
  pickerRow: { flexDirection: 'row', gap: 12 },
  pickerCol: { flex: 1, alignItems: 'center', gap: 6 },
  pickerLabel: { fontSize: 11, fontFamily: FONTS.sansBold, color: T.mute, letterSpacing: 0.4 },
  pickerInput: {
    width: '100%', textAlign: 'center',
    backgroundColor: '#ece8de', borderRadius: RADIUS.input,
    paddingVertical: 12, fontSize: 20, fontFamily: FONTS.sansBold, color: T.ink,
    boxShadow: CLAY.inset,
  },
  modalBtns: { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancel: {
    flex: 1, borderRadius: RADIUS.lg, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: T.line,
  },
  modalCancelText: { fontFamily: FONTS.sansSemiBold, fontSize: 15, color: T.mute },
});
