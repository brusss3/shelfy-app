import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Product, Zone } from '@/types';
import {
  subscribeToProducts, addProduct, addProductsBulk, updateProduct,
  deleteProduct, moveProductZone, consumeOneUnit, openOneUnit,
} from '@/lib/firestore';
import { subscribeToConsumedAction } from '@/lib/notifications';
import { daysTo } from '@/lib/urgency';
import { useAuth } from './AuthContext';
import { usePantry } from './PantryContext';

interface ProductsContextType {
  products: Product[];
  loading: boolean;
  addNewProduct: (data: Omit<Product, 'id' | 'userId' | 'addedBy'>) => Promise<void>;
  addNewProducts: (data: Omit<Product, 'id' | 'userId' | 'addedBy'>[]) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  changeZone: (id: string, zone: Zone) => Promise<void>;
  editProduct: (id: string, data: Partial<Product>) => Promise<void>;
  consumeOne: (id: string) => Promise<void>;
  consumeAll: (id: string) => Promise<void>;
  markOpened: (id: string, openExpiry: string) => Promise<void>;
  daysTo: (iso: string) => number;
}

const ProductsContext = createContext<ProductsContextType>({} as ProductsContextType);

export function ProductsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // `null` = dispensa personale. I prodotti seguono sempre questo scope: è la
  // stessa lista in tutta l'app (home, aggiunta, scanner, dettaglio) — non va
  // mai passato `user.uid` direttamente ai path Firestore al di fuori di qui.
  const { activePantryId } = usePantry();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setProducts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = subscribeToProducts(
      user.uid,
      activePantryId,
      (data) => {
        setProducts(data);
        setLoading(false);
      },
      (err) => {
        console.error('Firestore error:', err);
        setLoading(false);
      },
    );
    return unsub;
  }, [user, activePantryId]);

  // Le notifiche di scadenza NON si schedulano qui: coprono tutte le dispense
  // dell'utente (personale + condivise), non solo quella attiva in questa
  // schermata — vedi components/NotificationsScheduler, montato una volta
  // in app/_layout.tsx.

  // Pulsante "Consumato" sulla notifica di sistema: scala una unità appena
  // l'utente tocca l'azione (l'app si apre in foreground). L'ultima unità
  // cancella il prodotto. Usa il pantryId incluso nella notifica stessa (non
  // quello attivo ora): l'utente può aver cambiato dispensa, o l'app può
  // essere ripartita da zero, nel frattempo.
  useEffect(() => {
    if (!user) return;
    return subscribeToConsumedAction((productId, pantryId) => {
      consumeOneUnit(user.uid, pantryId, productId).catch(console.warn);
    });
  }, [user]);

  const addNewProduct = useCallback(
    async (data: Omit<Product, 'id' | 'userId' | 'addedBy'>) => {
      if (!user) return;
      await addProduct(user.uid, activePantryId, data);
    },
    [user, activePantryId],
  );

  const addNewProducts = useCallback(
    async (data: Omit<Product, 'id' | 'userId' | 'addedBy'>[]) => {
      if (!user || data.length === 0) return;
      await addProductsBulk(user.uid, activePantryId, data);
    },
    [user, activePantryId],
  );

  const removeProduct = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteProduct(user.uid, activePantryId, id);
    },
    [user, activePantryId],
  );

  const changeZone = useCallback(
    async (id: string, zone: Zone) => {
      if (!user) return;
      await moveProductZone(user.uid, activePantryId, id, zone);
    },
    [user, activePantryId],
  );

  const editProduct = useCallback(
    async (id: string, data: Partial<Product>) => {
      if (!user) return;
      await updateProduct(user.uid, activePantryId, id, data);
    },
    [user, activePantryId],
  );

  const consumeOne = useCallback(
    async (id: string) => {
      if (!user) return;
      await consumeOneUnit(user.uid, activePantryId, id);
    },
    [user, activePantryId],
  );

  const consumeAll = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteProduct(user.uid, activePantryId, id);
    },
    [user, activePantryId],
  );

  const markOpened = useCallback(
    async (id: string, openExpiry: string) => {
      if (!user) return;
      await openOneUnit(user.uid, activePantryId, id, openExpiry);
    },
    [user, activePantryId],
  );

  return (
    <ProductsContext.Provider
      value={{ products, loading, addNewProduct, addNewProducts, removeProduct, changeZone, editProduct, consumeOne, consumeAll, markOpened, daysTo }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export const useProducts = () => useContext(ProductsContext);
export { daysTo };
