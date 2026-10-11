import React, { Suspense, lazy } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '@/context/ThemeContext';
import type { AdminData } from './useAdminData';

// Dashboard desktop, solo web. Il guscio con i grafici si carica in differita:
// Recharts (centinaia di KB) finisce in un pezzo di bundle separato e lo
// scarica solo un admin su schermo largo, non ogni visitatore della web app.
const DesktopShell = lazy(() =>
  import('./desktop/DesktopShell').then((m) => ({ default: m.DesktopShell })));

export function AdminDesktop({ data }: { data: AdminData }) {
  const { T } = useTheme();
  return (
    <Suspense
      fallback={(
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: T.bg }}>
          <ActivityIndicator color={T.primary} size="large" />
        </View>
      )}
    >
      <DesktopShell data={data} />
    </Suspense>
  );
}
