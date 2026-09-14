import { useEffect } from 'react';
import { useRouter } from 'expo-router';

// Voce della tab bar riservata all'admin: il tap viene normalmente
// intercettato in (tabs)/_layout.tsx (listeners.tabPress) e reindirizzato a
// /admin, la vera dashboard fuori dal gruppo (tabs). Questo effetto è solo
// un fallback nel caso in cui, per qualche motivo, questa route venga
// comunque montata (es. deep link diretto su /admin dentro le tabs).
export default function AdminTabPlaceholder() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin');
  }, []);

  return null;
}
