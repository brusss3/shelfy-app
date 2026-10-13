import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useProducts } from '@/context/ProductsContext';
import { useShopping } from '@/context/ShoppingContext';
import { useAuth } from '@/context/AuthContext';
import { shoppingItemOf } from '@/lib/shopping';
import type { ToastAction } from '@/components/UndoToast';
import { Product } from '@/types';

// Quanto resta annullabile un "consumato"/"buttato" dato con lo swipe.
const UNDO_MS = 5000;
const INFO_MS = 2500;

type Kind = 'consume' | 'discard';
interface Pending { kind: Kind; product: Product }
interface Toast { key: number; message: string; actions: ToastAction[] }

function haptic() {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

// Azioni rapide della home (swipe). "Consumato" e "Buttato" non vengono
// scritti subito: per qualche secondo restano in sospeso, la riga sparisce
// (o perde un'unità) e l'avviso offre "Annulla". Scaduto il tempo, o lasciata
// la schermata, l'azione si scrive davvero. Così annullare non deve ricreare
// prodotti cancellati, e i contatori mangiato/buttato restano giusti.
export function useProductQuickActions() {
  const { consumeOne, discardProduct } = useProducts();
  const { addItem } = useShopping();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [pending, setPending] = useState<Pending | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const pendingRef = useRef<Pending | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // In un ref: flush gira anche da timer e dal cleanup di focus, dove una
  // closure vecchia userebbe funzioni del contesto ormai superate.
  const commitRef = useRef<(p: Pending) => void>(() => {});
  commitRef.current = (p) => {
    (p.kind === 'consume' ? consumeOne : discardProduct)(p.product.id).catch(console.warn);
  };

  const flush = useCallback(() => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    const p = pendingRef.current;
    if (!p) return;
    pendingRef.current = null;
    setPending(null);
    commitRef.current(p);
  }, []);

  const showToast = (message: string, actions: ToastAction[], ms: number) => {
    setToast({ key: Date.now(), message, actions });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  };

  const undo = () => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingRef.current = null;
    setPending(null);
    setToast(null);
  };

  const armPending = () => {
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(flush, UNDO_MS);
  };

  const shop = async (product: Product, afterConsume = false) => {
    try {
      const res = await addItem(shoppingItemOf(product));
      haptic();
      if (afterConsume) {
        // Resta annullabile il consumo: il tempo riparte da qui.
        armPending();
        showToast(t('home.swipe.consumedAndListed', { name: product.name }), [{ label: t('home.swipe.undo'), onPress: undo }], UNDO_MS);
      } else {
        showToast(t(res === 'added' ? 'home.swipe.addedToList' : 'home.swipe.alreadyInList', { name: product.name }), [], INFO_MS);
      }
    } catch (e: any) {
      showToast(e?.message ?? t('shopping.addFailed'), [], INFO_MS);
    }
  };

  const start = (kind: Kind, product: Product) => {
    flush();
    const p = { kind, product };
    pendingRef.current = p;
    setPending(p);
    armPending();
    haptic();

    const actions: ToastAction[] = [{ label: t('home.swipe.undo'), onPress: undo }];
    // Finita l'ultima unità è il momento in cui si pensa a ricomprarla.
    if (kind === 'consume' && product.count <= 1 && !user?.isGuest) {
      actions.push({ label: t('home.swipe.addToList'), onPress: () => { shop(product, true); } });
    }
    showToast(
      t(kind === 'consume' ? 'home.swipe.consumedToast' : 'home.swipe.discardedToast', { name: product.name }),
      actions,
      UNDO_MS,
    );
  };

  // Lasciando la home l'azione in sospeso si scrive subito: l'avviso non si
  // vede più, quindi non c'è più modo di annullarla.
  useFocusEffect(useCallback(() => () => flush(), [flush]));
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  // La lista come la vede l'utente: il prodotto in sospeso sparisce, o ha
  // un'unità in meno se ne aveva più d'una.
  const applyPending = (list: Product[]): Product[] => {
    if (!pending) return list;
    return list.flatMap((p) => {
      if (p.id !== pending.product.id) return [p];
      if (pending.kind === 'consume' && p.count > 1) return [{ ...p, count: p.count - 1 }];
      return [];
    });
  };

  return {
    toast,
    applyPending,
    consume: (p: Product) => start('consume', p),
    discard: (p: Product) => start('discard', p),
    // Gli ospiti non hanno la lista della spesa.
    shop: user?.isGuest ? undefined : (p: Product) => { shop(p); },
  };
}
