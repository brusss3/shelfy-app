import { useEffect, useRef, useState } from 'react';
import { Product } from '@/types';
import { subscribeToProducts } from '@/lib/firestore';
import { scheduleExpiryNotifications, NotificationPantryGroup } from '@/lib/notifications';
import { useAuth } from '@/context/AuthContext';
import { usePantry } from '@/context/PantryContext';

interface ScopeEntry {
  pantryId: string | null;
  pantryName: string;
  products: Product[];
}

// Componente "headless" (nessuna UI): tiene le notifiche di scadenza sempre
// aggiornate per TUTTE le case dell'utente — personale e ogni casa condivisa
// di cui è membro — non solo quella attiva sulla home in quel momento.
// Sottoscrive un listener Firestore per ciascuna in parallelo, aggrega, e
// rischedula (vedi lib/notifications.ts per il perché delle notifiche
// raggruppate per casa invece che per singolo prodotto).
export default function NotificationsScheduler() {
  const { user } = useAuth();
  const { pantries, loading: pantriesLoading } = usePantry();
  const [byScope, setByScope] = useState<Record<string, ScopeEntry>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user) {
      setByScope({});
      return;
    }

    const scopes: { key: string; pantryId: string | null; pantryName: string }[] = [
      { key: 'personal', pantryId: null, pantryName: 'Personale' },
      ...pantries.map((p) => ({ key: p.id, pantryId: p.id, pantryName: p.name })),
    ];
    const validKeys = new Set(scopes.map((s) => s.key));

    const unsubs = scopes.map(({ key, pantryId, pantryName }) =>
      subscribeToProducts(
        user.uid,
        pantryId,
        (products) => {
          setByScope((prev) => ({ ...prev, [key]: { pantryId, pantryName, products } }));
        },
        (err) => console.warn('[NotificationsScheduler] errore scope', key, err),
      ),
    );

    // Una casa abbandonata/eliminata sparisce anche dalle notifiche,
    // anche se il suo listener non è mai arrivato a emettere di nuovo.
    setByScope((prev) => {
      const next: Record<string, ScopeEntry> = {};
      for (const [k, v] of Object.entries(prev)) if (validKeys.has(k)) next[k] = v;
      return next;
    });

    return () => unsubs.forEach((u) => u());
  }, [user, pantries.map((p) => p.id).join(',')]);

  useEffect(() => {
    if (!user || pantriesLoading) return;

    // Le sottoscrizioni di più dispense arrivano quasi in contemporanea
    // all'avvio: un piccolo debounce evita di rischedulare tutto una volta
    // per ciascuna, invece che una volta sola quando si sono assestate.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const groups: NotificationPantryGroup[] = Object.values(byScope).map((s) => ({
        pantryId: s.pantryId,
        pantryName: s.pantryName,
        products: s.products,
      }));
      scheduleExpiryNotifications(groups, user.notificationsEnabled ?? true).catch(console.warn);
    }, 300);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [byScope, user, pantriesLoading]);

  return null;
}
