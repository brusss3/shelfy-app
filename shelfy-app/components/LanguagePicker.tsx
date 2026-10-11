import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FONTS, RADIUS } from '@/constants/theme';
import { useTheme, useThemedStyles, type Theme } from '@/context/ThemeContext';
import type { LanguageOption } from '@/lib/i18n';
import Flag, { FlagCode } from './Flag';

interface Props {
  value: LanguageOption;
  onChange: (option: LanguageOption) => void;
}

const OPTIONS: { id: LanguageOption; flag: FlagCode | null; labelKey: string }[] = [
  { id: 'system', flag: null, labelKey: 'settings.language.system' },
  { id: 'it', flag: 'it', labelKey: 'settings.language.it' },
  { id: 'en', flag: 'en', labelKey: 'settings.language.en' },
  { id: 'es', flag: 'es', labelKey: 'settings.language.es' },
];

function OptionIcon({ flag }: { flag: FlagCode | null }) {
  const { T } = useTheme();
  return flag
    ? <Flag code={flag} />
    : <Ionicons name="phone-portrait-outline" size={22} color={T.ink2} />;
}

// Menu a tendina: mostra la lingua scelta con la bandiera e, al tocco, elenca
// le altre in un foglio. Una `select` nativa non può mostrare bandiere.
export default function LanguagePicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { T } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  const current = OPTIONS.find((o) => o.id === value) ?? OPTIONS[0];

  return (
    <>
      <TouchableOpacity
        style={styles.select}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('settings.language.title')}
      >
        <View style={styles.iconBox}><OptionIcon flag={current.flag} /></View>
        <Text style={styles.selectText} numberOfLines={1}>{t(current.labelKey)}</Text>
        <Ionicons name="chevron-down" size={18} color={T.mute} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.menu} onPress={() => {}}>
            <Text style={styles.menuTitle}>{t('settings.language.title')}</Text>
            {OPTIONS.map((opt) => {
              const active = opt.id === value;
              return (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.option, active && styles.optionActive]}
                  onPress={() => { onChange(opt.id); setOpen(false); }}
                  activeOpacity={0.8}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: active }}
                >
                  <View style={styles.iconBox}><OptionIcon flag={opt.flag} /></View>
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>{t(opt.labelKey)}</Text>
                  {active && <Ionicons name="checkmark" size={20} color={T.primary} />}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = ({ T, CLAY, SHADOW }: Theme) => StyleSheet.create({
  select: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    minHeight: 50, paddingHorizontal: 14, borderRadius: RADIUS.input,
    backgroundColor: T.field, boxShadow: CLAY.inset,
  },
  iconBox: { width: 30, alignItems: 'center' },
  selectText: { flex: 1, fontFamily: FONTS.sansMedium, fontSize: 15, color: T.ink },

  overlay: {
    flex: 1, backgroundColor: 'rgba(8,12,7,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  menu: {
    width: '100%', maxWidth: 360, backgroundColor: T.surface, borderRadius: RADIUS.xl,
    padding: 10, ...SHADOW.card,
  },
  menuTitle: {
    fontFamily: FONTS.sansBold, fontSize: 13, color: T.mute, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6,
  },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: RADIUS.md,
  },
  optionActive: { backgroundColor: T.primarySoft },
  optionText: { flex: 1, fontFamily: FONTS.sansMedium, fontSize: 16, color: T.ink },
  optionTextActive: { fontFamily: FONTS.sansBold, color: T.primaryInk },
});
