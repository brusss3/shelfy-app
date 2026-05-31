import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Product, Zone } from '@/types';
import {
  subscribeToProducts, addProduct, updateProduct,
  deleteProduct, moveProductZone,
} from '@/lib/firestore';
import { scheduleExpiryNotifications } from '@/lib/notifications';
import { useAuth } from './AuthContext';

interface ProductsContextType {
  products: Product[];
  loading: boolean;
  addNewProduct: (data: Omit<Product, 'id' | 'userId'>) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  changeZone: (id: string, zone: Zone) => Promise<void>;
  markConsumed: (id: string) => Promise<void>;
  markOpened: (id: string, openExpiry: string) => Promise<void>;
  daysTo: (iso: string) => number;
}

const ProductsContext = createContext<ProductsContextType>({} as ProductsContextType);

const DAY_MS = 24 * 60 * 60 * 1000;

function daysTo(iso: string): number {
  const expiry = new Date(iso);
  expiry.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((expiry.getTime() - now.getTime()) / DAY_MS);
}

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

  const addNewProduct = useCallback(
    async (data: Omit<Product, 'id' | 'userId'>) => {
      if (!user) return;
      await addProduct(user.uid, data);
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

  const markConsumed = useCallback(
    async (id: string) => {
      if (!user) return;
      await deleteProduct(user.uid, id);
    },
    [user],
  );

  const markOpened = useCallback(
    async (id: string, openExpiry: string) => {
      if (!user) return;
      await updateProduct(user.uid, id, {
        openedAt: new Date().toISOString().slice(0, 10),
        openExpiry,
      });
    },
    [user],
  );

  return (
    <ProductsContext.Provider
      value={{ products, loading, addNewProduct, removeProduct, changeZone, markConsumed, markOpened, daysTo }}
    >
      {children}
    </ProductsContext.Provider>
  );
}

export const useProducts = () => useContext(ProductsContext);
export { daysTo };
