import React, { useEffect } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useAdminData } from '@/components/admin/useAdminData';
import { AdminMobile } from '@/components/admin/AdminMobile';
// Su web Metro risolve AdminDesktop.web.tsx (grafici Recharts); su nativo il
// segnaposto AdminDesktop.tsx, così Recharts non finisce nel bundle dell'app.
import { AdminDesktop } from '@/components/admin/AdminDesktop';

// Sotto questa larghezza anche il web usa il layout mobile.
const DESKTOP_MIN_WIDTH = 1024;

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const data = useAdminData();

  useEffect(() => {
    if (!user?.isAdmin) router.replace('/(tabs)');
  }, [user, router]);

  if (!user?.isAdmin) return null;

  if (Platform.OS === 'web' && width >= DESKTOP_MIN_WIDTH) {
    return <AdminDesktop data={data} />;
  }
  return <AdminMobile data={data} />;
}
