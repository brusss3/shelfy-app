import { useEffect } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts,
  DMSans_400Regular, DMSans_500Medium, DMSans_700Bold,
} from '@expo-google-fonts/dm-sans';
import * as SplashScreen from 'expo-splash-screen';
import * as NavigationBar from 'expo-navigation-bar';
import { AuthProvider } from '@/context/AuthContext';
import { PantryProvider } from '@/context/PantryContext';
import { ProductsProvider } from '@/context/ProductsContext';
import { RecipesProvider } from '@/context/RecipesContext';
import { CommunityProvider } from '@/context/CommunityContext';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { setupNotificationHandler } from '@/lib/notifications';
import NotificationsScheduler from '@/components/NotificationsScheduler';
import { T } from '@/constants/theme';

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

  // Lo splash nativo Android 12+ mostra solo un'icona centrata su sfondo
  // colorato (vincolo della Splash Screen API di sistema, non aggirabile via
  // config): per un vero splash a tutto schermo, dopo il breve lampo nativo
  // mostriamo qui la stessa immagine a piena pagina finché i font non sono
  // pronti, poi passiamo alla UI reale.
  if (!fontsLoaded && !fontError) {
    return (
      <View style={styles.splash}>
        <Image
          source={require('@/assets/splashScreenNew.png')}
          resizeMode="cover"
          style={StyleSheet.absoluteFillObject}
        />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <PantryProvider>
        <NotificationsScheduler />
        <ProductsProvider>
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
            <Stack.Screen name="recipe/request-new" options={{ presentation: 'modal' }} />
            <Stack.Screen name="recipe/request/[id]" />
            <Stack.Screen name="pantry/index" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="pantry/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="pantry/join" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="join/[code]" options={{ headerShown: false }} />
            <Stack.Screen name="settings" options={{ headerShown: false }} />
            <Stack.Screen name="admin" options={{ headerShown: false }} />
            <Stack.Screen name="labels" options={{ headerShown: false, presentation: 'modal' }} />
          </Stack>
          </CommunityProvider>
          </RecipesProvider>
        </ProductsProvider>
        </PantryProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: T.bg },
});
