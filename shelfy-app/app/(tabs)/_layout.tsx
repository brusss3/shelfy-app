import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useShopping } from '@/context/ShoppingContext';
import { registerForPushNotifications } from '@/lib/notifications';
import { saveUserPushToken } from '@/lib/firestore';

type TabIconProps = { focused: boolean; icon: string; badge?: number };

function TabIcon({ focused, icon, badge }: TabIconProps) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabEmoji, { opacity: focused ? 1 : 0.5 }]}>{icon}</Text>
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function TabsLayout() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { openCount } = useShopping();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, loading]);

  useEffect(() => {
    registerForPushNotifications()
      .then((token) => {
        if (token && user?.isAdmin) {
          saveUserPushToken(user.uid, token).catch(console.warn);
        }
      })
      .catch(console.warn);
  }, [user?.isAdmin]);

  if (!user) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: T.surface,
          borderTopColor: T.line,
          borderTopWidth: 0.5,
          height: Platform.OS === 'ios' ? 88 : 64 + insets.bottom,
          paddingBottom: Platform.OS === 'ios' ? 28 : insets.bottom > 0 ? insets.bottom : 14,
          paddingTop: 10,
          elevation: 0,
          shadowColor: 'rgba(40,50,35,1)',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.06,
          shadowRadius: 10,
        },
        tabBarActiveTintColor: T.primary,
        tabBarInactiveTintColor: T.mute,
        tabBarShowLabel: false,
        // React Navigation racchiude l'icona in un contenitore fisso a 28px
        // di altezza indipendente dalla tabBarStyle: alcuni emoji (🔔, 💡)
        // ci restano tagliati sotto. Lo allarghiamo esplicitamente.
        tabBarIconStyle: { height: 36, width: 36 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="🏠" />,
        }}
      />
      {/* La spesa sta subito dopo la dispensa: il ciclo è dispensa → spesa →
          ricette. Il badge conta le voci ancora da comprare. */}
      <Tabs.Screen
        name="shopping"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="🛒" badge={openCount} />,
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="🍳" />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="🔔" />,
        }}
      />
      {/* Idee & Feedback non è più una tab: è raggiungibile da Impostazioni
          (stesso invio di feedback), così la barra resta a 4 voci + admin. */}
      <Tabs.Screen name="feedback" options={{ href: null }} />
      {/* Scorciatoia alla dashboard admin, visibile solo agli admin. Il tap
          non cambia tab: apre /admin (fuori dal gruppo tabs) e resta lì. */}
      <Tabs.Screen
        name="admin-link"
        options={{
          href: user?.isAdmin ? undefined : null,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="🛡️" />,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.push('/admin');
          },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: { alignItems: 'center', justifyContent: 'center' },
  // lineHeight esplicito: senza, i glifi emoji vengono tagliati in basso su
  // Android (metriche del font più alte del box di riga di default).
  tabEmoji: { fontSize: 26, lineHeight: 34 },
  badge: {
    position: 'absolute', top: -2, right: -8, minWidth: 18, height: 18,
    borderRadius: 9, paddingHorizontal: 5, backgroundColor: T.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fbfaf3', fontSize: 10, fontWeight: '700', lineHeight: 13 },
});
