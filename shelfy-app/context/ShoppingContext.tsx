import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { NewShoppingItem, ShoppingFavorite, ShoppingItem } from '@/types';
import {
  subscribeToShoppingItems, addShoppingItem, updateShoppingItem,
  deleteShoppingItem, clearCheckedItems, recordFavoriteUse, subscribeToFavorites, deleteFavorite,
} from '@/lib/shopping';
import { useAuth } from './AuthContext';
import { usePantry } from './PantryContext';
import i18n from '@/lib/i18n';

/** `added` = voce nuova, `incremented` = era già in lista e ne è stata alzata
 *  la quantità invece di duplicarla. */
export type AddResult = 'added' | 'incremented';

interface ShoppingContextType {
  items: ShoppingItem[];
  /** Voci aggiunte spesso, dalla più usata: base dei suggerimenti rapidi. */
  favorites: ShoppingFavorite[];
  loading: boolean;
  /** Voci ancora da comprare (non nel carrello): è il numero sul badge. */
  openCount: number;
  addItem: (data: NewShoppingItem) => Promise<AddResult>;
  toggleItem: (id: string) => Promise<void>;
  setItemCount: (id: string, count: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearChecked: () => Promise<void>;
  removeFavorite: (id: string) => Promise<void>;
}

const ShoppingContext = createContext<ShoppingContextType>({} as ShoppingContextType);

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function ShoppingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Stesso scope della dispensa attiva: vedi lib/shopping.ts.
  const { activePantryId } = usePantry();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [favorites, setFavorites] = useState<ShoppingFavorite[]>([]);
  const [loading, setLoading] = useState(true);

  // Gli ospiti non hanno la lista della spesa (regole: isRegistered).
  useEffect(() => {
    if (!user || user.isGuest) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToShoppingItems(
      user.uid,
      activePantryId,
      (data) => { setItems(data); setLoading(false); },
      (err) => { console.error('[ShoppingContext] errore:', err); setLoading(false); },
    );
    return unsub;
    // Solo l'uid, come ProductsContext: `user` cambia identità a ogni
    // snapshot del documento utente e farebbe lampeggiare la schermata.
  }, [user?.uid, user?.isGuest, activePantryId]);

  // I preferiti sono accessori: un errore (es. regole non ancora aggiornate)
  // lascia la lista funzionante, solo senza scorciatoie.
  useEffect(() => {
    if (!user || user.isGuest) { setFavorites([]); return; }
    return subscribeToFavorites(
      user.uid,
      activePantryId,
      setFavorites,
      (err) => { console.warn('[ShoppingContext] preferiti:', err); setFavorites([]); },
    );
  }, [user?.uid, user?.isGuest, activePantryId]);

  const openCount = useMemo(
    () => items.reduce((n, i) => (i.checked ? n : n + 1), 0),
    [items],
  );

  const addItem = useCallback(
    async (data: NewShoppingItem): Promise<AddResult> => {
      if (!user) throw new Error(i18n.t('serverErrors.loginRequired'));
      if (user.isGuest) throw new Error(i18n.t('serverErrors.registrationRequired'));
      const name = data.name.trim();
      // Stesso prodotto già da comprare: stesso barcode, o — per le voci a
      // testo libero — stesso nome. Se è già nel carrello conta come nuovo
      // acquisto, quindi va aggiunta una voce fresca.
      const existing = items.find((i) => !i.checked && (
        (data.barcode && i.barcode ? i.barcode === data.barcode : norm(i.name) === norm(name))
      ));
      const remember = () => {
        recordFavoriteUse(user.uid, activePantryId, { ...data, name })
          .catch((e) => console.warn('[ShoppingContext] preferito:', e));
      };
      if (existing) {
        await updateShoppingItem(user.uid, activePantryId, existing.id, {
          count: existing.count + (data.count ?? 1),
        });
        remember();
        return 'incremented';
      }
      await addShoppingItem(user.uid, activePantryId, { ...data, name });
      remember();
      return 'added';
    },
    [user, activePantryId, items],
  );

  const toggleItem = useCallback(
    async (id: string) => {
      if (!user) return;
      const item = items.find((i) => i.id === id);
      if (!item) return;
      await updateShoppingItem(user.uid, activePantryId, id, { checked: !item.checked });
    },
    [user, activePantryId, items],
  );

  const setItemCount = useCallback(
    async (id: string, count: number) => {
      if (!user) return;
      await updateShoppingItem(user.uid, activePantryId, id, { count: Math.max(1, count) });
    },
    [user, activePantryId],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteShoppingItem(user.uid, activePantryId, id);
    },
    [user, activePantryId],
  );

  const clearChecked = useCallback(async () => {
    if (!user) return;
    await clearCheckedItems(user.uid, activePantryId);
  }, [user, activePantryId]);

  const removeFavorite = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteFavorite(user.uid, activePantryId, id);
    },
    [user, activePantryId],
  );

  return (
    <ShoppingContext.Provider
      value={{ items, favorites, loading, openCount, addItem, toggleItem, setItemCount, removeItem, clearChecked, removeFavorite }}
    >
      {children}
    </ShoppingContext.Provider>
  );
}

export const useShopping = () => useContext(ShoppingContext);
