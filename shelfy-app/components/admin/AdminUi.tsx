import React from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch } from 'react-native';
import { useTheme, useThemedStyles } from '@/context/ThemeContext';
import { createAdminStyles } from './adminStyles';

// Mattoncini comuni ai pannelli admin.

export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const styles = useThemedStyles(createAdminStyles);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function SearchField({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder: string;
}) {
  const { T } = useTheme();
  const styles = useThemedStyles(createAdminStyles);
  return (
    <View style={styles.searchRow}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={T.mute}
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChange('')} style={styles.clearBtn} accessibilityRole="button">
          <Text style={styles.clearBtnText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

/** Card con titolo, descrizione e interruttore a destra. */
export function SwitchCard({ title, desc, value, onChange, disabled, children }: {
  title: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const { T } = useTheme();
  const styles = useThemedStyles(createAdminStyles);
  return (
    <View style={styles.card}>
      <View style={styles.switchRow}>
        <View style={styles.switchText}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDesc}>{desc}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          trackColor={{ false: T.line, true: T.primary }}
          accessibilityLabel={title}
        />
      </View>
      {children}
    </View>
  );
}
