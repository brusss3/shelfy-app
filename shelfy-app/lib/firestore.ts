import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Product, Zone } from '@/types';

function productsRef(userId: string) {
  return collection(db, 'users', userId, 'products');
}

export function subscribeToProducts(
  userId: string,
  onData: (products: Product[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(productsRef(userId), orderBy('expiry', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      const products: Product[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Product, 'id'>),
      }));
      onData(products);
    },
    onError,
  );
}

export async function addProduct(
  userId: string,
  data: Omit<Product, 'id' | 'userId'>,
): Promise<string> {
  const ref = await addDoc(productsRef(userId), {
    ...data,
    userId,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(
  userId: string,
  productId: string,
  data: Partial<Product>,
): Promise<void> {
  await updateDoc(doc(productsRef(userId), productId), data);
}

export async function deleteProduct(
  userId: string,
  productId: string,
): Promise<void> {
  await deleteDoc(doc(productsRef(userId), productId));
}

export async function moveProductZone(
  userId: string,
  productId: string,
  zone: Zone,
): Promise<void> {
  await updateDoc(doc(productsRef(userId), productId), { zone });
}
