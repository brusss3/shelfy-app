import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { T, FONTS, RADIUS } from '@/constants/theme';

export default function ProfileButton() {
  const { user } = useAuth();
  const router = useRouter();

  const initial = user?.displayName?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U';

  return (
    <TouchableOpacity
      onPress={() => router.push('/settings' as Href)}
      style={styles.avatar}
      activeOpacity={0.75}
      accessibilityLabel="Apri impostazioni"
    >
      <Text style={styles.initial}>{initial}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 42, height: 42, borderRadius: RADIUS.pill,
    backgroundColor: T.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  initial: { fontFamily: FONTS.display, fontSize: 18, color: T.primaryInk },
});
