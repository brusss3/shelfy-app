import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts,
  DMSans_400Regular, DMSans_500Medium, DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import { initI18n } from '@/lib/i18n';
import { AuthProvider } from '@/context/AuthContext';
import { PantryProvider } from '@/context/PantryContext';
import { ProductsProvider } from '@/context/ProductsContext';
import { ShoppingProvider } from '@/context/ShoppingContext';
import { RecipesProvider } from '@/context/RecipesContext';
import { CommunityProvider } from '@/context/CommunityContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setupNotificationHandler, setupNotificationCategories } from '@/lib/notifications';
import NotificationsScheduler from '@/components/NotificationsScheduler';
import SurveyModal from '@/components/SurveyModal';
import { captureAcquisitionSource } from '@/lib/acquisition';

SplashScreen.preventAutoHideAsync();
setupNotificationHandler();
// Prima di qualsiasi redirect, finché `?src=` è ancora nell'URL.
captureAcquisitionSource();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
  });
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initI18n().then(() => {
      // Il titolo del pulsante "Consumato" è tradotto: si registra solo a
      // lingua caricata, altrimenti arriva undefined e Android rifiuta la categoria.
      setupNotificationCategories();
      setI18nReady(true);
    });
  }, []);

  const appReady = (fontsLoaded || fontError) && i18nReady;

  useEffect(() => {
    // Lo splash nativo resta su finché font e lingua non sono pronti: ora
    // mostra l'icona dell'app, quindi non serve più duplicarlo con
    // un'immagine a schermo intero lato JS (che causava un doppio splash).
    if (appReady) SplashScreen.hideAsync();
  }, [appReady]);

  useEffect(() => {
    // Nasconde la barra di navigazione Android (tasti indietro/home/recenti).
    // Il comportamento "riappare con swipe e si richiude da sola" è ora
    // imposto di default dal sistema (Android 16 non permette più di
    // configurarlo via API — setBehaviorAsync è stata rimossa). No-op su iOS/web.
    if (Platform.OS === 'android') {
      NavigationBar.setVisibilityAsync('hidden');
    }
  }, []);

  // Niente da disegnare finché non siamo pronti: sopra c'è ancora lo splash
  // nativo, che si chiude da solo nell'effect qui sopra.
  if (!appReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <PantryProvider>
        <NotificationsScheduler />
        <SurveyModal />
        <ProductsProvider>
          <ShoppingProvider>
          <RecipesProvider>
          <CommunityProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="scanner" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="receipt-scan" options={{ presentation: 'fullScreenModal' }} />
            <Stack.Screen name="receipt-review" options={{ presentation: 'modal' }} />
            <Stack.Screen name="add" options={{ presentation: 'modal' }} />
            <Stack.Screen name="product/[id]" />
            <Stack.Screen name="recipe/[id]" />
            <Stack.Screen name="recipe/mine/[id]" />
            <Stack.Screen name="recipe/create" options={{ presentation: 'modal' }} />
            <Stack.Screen name="recipe/import" options={{ presentation: 'modal' }} />
            <Stack.Screen name="recipe/request-new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="recipe/request/[id]" />
            <Stack.Screen name="pantry/index" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="pantry/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="pantry/join" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="join/[code]" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
            <Stack.Screen name="paywall" options={{ headerShown: false, presentation: 'modal' }} />
          </Stack>
          </CommunityProvider>
          </RecipesProvider>
          </ShoppingProvider>
        </ProductsProvider>
        </PantryProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

