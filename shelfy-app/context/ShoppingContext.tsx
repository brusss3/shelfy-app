import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { NewShoppingItem, ShoppingItem } from '@/types';
import {
  subscribeToShoppingItems, addShoppingItem, updateShoppingItem,
  deleteShoppingItem, clearCheckedItems,
} from '@/lib/shopping';
import { useAuth } from './AuthContext';
import { usePantry } from './PantryContext';

/** `added` = voce nuova, `incremented` = era già in lista e ne è stata alzata
 *  la quantità invece di duplicarla. */
export type AddResult = 'added' | 'incremented';

interface ShoppingContextType {
  items: ShoppingItem[];
  loading: boolean;
  /** Voci ancora da comprare (non nel carrello): è il numero sul badge. */
  openCount: number;
  addItem: (data: NewShoppingItem) => Promise<AddResult>;
  toggleItem: (id: string) => Promise<void>;
  setItemCount: (id: string, count: number) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  clearChecked: () => Promise<void>;
}

const ShoppingContext = createContext<ShoppingContextType>({} as ShoppingContextType);

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export function ShoppingProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Stesso scope della dispensa attiva: vedi lib/shopping.ts.
  const { activePantryId } = usePantry();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
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
  }, [user?.uid, activePantryId]);

  const openCount = useMemo(
    () => items.reduce((n, i) => (i.checked ? n : n + 1), 0),
    [items],
  );

  const addItem = useCallback(
    async (data: NewShoppingItem): Promise<AddResult> => {
      if (!user) throw new Error('Devi accedere');
      const name = data.name.trim();
      // Stesso prodotto già da comprare: stesso barcode, o — per le voci a
      // testo libero — stesso nome. Se è già nel carrello conta come nuovo
      // acquisto, quindi va aggiunta una voce fresca.
      const existing = items.find((i) => !i.checked && (
        (data.barcode && i.barcode ? i.barcode === data.barcode : norm(i.name) === norm(name))
      ));
      if (existing) {
        await updateShoppingItem(user.uid, activePantryId, existing.id, {
          count: existing.count + (data.count ?? 1),
        });
        return 'incremented';
      }
      await addShoppingItem(user.uid, activePantryId, { ...data, name });
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

  return (
    <ShoppingContext.Provider
      value={{ items, loading, openCount, addItem, toggleItem, setItemCount, removeItem, clearChecked }}
    >
      {children}
    </ShoppingContext.Provider>
  );
}

export const useShopping = () => useContext(ShoppingContext);
