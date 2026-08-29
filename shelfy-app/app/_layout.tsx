import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts,
  DMSans_400Regular, DMSans_500Medium, DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import { AuthProvider } from '@/context/AuthContext';
import { ProductsProvider } from '@/context/ProductsContext';
import { RecipesProvider } from '@/context/RecipesContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setupNotificationHandler } from '@/lib/notifications';

SplashScreen.preventAutoHideAsync();
setupNotificationHandler();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    // Nasconde la barra di navigazione Android (tasti indietro/home/recenti):
    // riappare temporaneamente con uno swipe dal bordo e si richiude da sola
    // ("overlay-swipe" = immersive sticky). No-op su iOS/web.
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
      NavigationBar.setBehaviorAsync('overlay-swipe');
    }
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ProductsProvider>
          <RecipesProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="scanner" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="add" options={{ presentation: 'modal' }} />
            <Stack.Screen name="product/[id]" />
            <Stack.Screen name="recipe/[id]" />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
          </Stack>
          </RecipesProvider>
        </ProductsProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
