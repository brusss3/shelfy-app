import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Product, Zone } from '@/types';
import {
  subscribeToProducts, addProduct, addProductsBulk, updateProduct,
  deleteProduct, moveProductZone, consumeOneUnit, openOneUnit,
} from '@/lib/firestore';
import { scheduleExpiryNotifications, subscribeToConsumedAction } from '@/lib/notifications';
import { daysTo } from '@/lib/urgency';
import { useAuth } from './AuthContext';

interface ProductsContextType {
  products: Product[];
  loading: boolean;
  addNewProduct: (data: Omit<Product, 'id' | 'userId'>) => Promise<void>;
  addNewProducts: (data: Omit<Product, 'id' | 'userId'>[]) => Promise<void>;
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
      (data) => {
        setProducts(data);
        setLoading(false);
        scheduleExpiryNotifications(data, user.notificationsEnabled ?? true).catch(console.warn);
      },
      (err) => {
        console.error('Firestore error:', err);
        setLoading(false);
      },
    );
    return unsub;
  }, [user]);

  // Pulsante "Consumato" sulla notifica di sistema: scala una unità appena
  // l'utente tocca l'azione (l'app si apre in foreground). L'ultima unità
  // cancella il prodotto.
  useEffect(() => {
    if (!user) return;
    return subscribeToConsumedAction((productId) => {
      consumeOneUnit(user.uid, productId).catch(console.warn);
    });
  }, [user]);

  const addNewProduct = useCallback(
    async (data: Omit<Product, 'id' | 'userId'>) => {
      if (!user) return;
      await addProduct(user.uid, data);
    },
    [user],
  );

  const addNewProducts = useCallback(
    async (data: Omit<Product, 'id' | 'userId'>[]) => {
      if (!user || data.length === 0) return;
      await addProductsBulk(user.uid, data);
    },
    [user],
  );

  const removeProduct = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteProduct(user.uid, id);
    },
    [user],
  );

  const changeZone = useCallback(
    async (id: string, zone: Zone) => {
      if (!user) return;
      await moveProductZone(user.uid, id, zone);
    },
    [user],
  );

  const editProduct = useCallback(
    async (id: string, data: Partial<Product>) => {
      if (!user) return;
      await updateProduct(user.uid, id, data);
    },
    [user],
  );

  const consumeOne = useCallback(
    async (id: string) => {
      if (!user) return;
      await consumeOneUnit(user.uid, id);
    },
    [user],
  );

  const consumeAll = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteProduct(user.uid, id);
    },
    [user],
  );

  const markOpened = useCallback(
    async (id: string, openExpiry: string) => {
      if (!user) return;
      await openOneUnit(user.uid, id, openExpiry);
    },
    [user],
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
