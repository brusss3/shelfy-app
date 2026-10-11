import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';

export default function AuthLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // L'ospite resta qui: login e registrazione sono proprio il suo modo di
  // diventare account. Appena lo diventa (isGuest false) si torna all'app.
  useEffect(() => {
    if (!loading && user && !user.isGuest) {
      router.replace('/(tabs)');
    }
  }, [user, loading]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
