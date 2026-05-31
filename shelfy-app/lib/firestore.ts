import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, Timestamp, getDocs, setDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import { Product, Zone } from '@/types';

export interface AdminUserRecord {
  uid: string;
  email: string;
  displayName: string;
  isPremium: boolean;
  isAdmin: boolean;
  createdAt: string;
  subscriptionType: 'monthly' | 'annual' | null;
  subscriptionExpiresAt: string | null;
}

export async function getAllUsers(): Promise<AdminUserRecord[]> {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      uid: d.id,
      email: data.email ?? '',
      displayName: data.displayName ?? '',
      isPremium: data.isPremium ?? false,
      isAdmin: data.isAdmin ?? false,
      createdAt: data.createdAt ?? '',
      subscriptionType: data.subscriptionType ?? null,
      subscriptionExpiresAt: data.subscriptionExpiresAt ?? null,
    };
  });
}

export interface FeedbackRecord {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  category: FeedbackCategory;
  message: string;
  createdAt: string | null;
}

export async function getAllFeedback(): Promise<FeedbackRecord[]> {
  const snap = await getDocs(query(collection(db, 'feedback'), orderBy('createdAt', 'desc')));
  return snap.docs.map((d) => {
    const data = d.data();
    const ts = data.createdAt;
    return {
      id: d.id,
      uid: data.uid ?? '',
      email: data.email ?? '',
      displayName: data.displayName ?? '',
      category: (data.category ?? 'altro') as FeedbackCategory,
      message: data.message ?? '',
      createdAt: ts instanceof Timestamp ? ts.toDate().toISOString() : (typeof ts === 'string' ? ts : null),
    };
  });
}

export async function adminSetPremium(uid: string, value: boolean): Promise<void> {
  await setDoc(doc(db, 'users', uid), { isPremium: value }, { merge: true });
}

export async function adminSetAdmin(uid: string, value: boolean): Promise<void> {
  await setDoc(doc(db, 'users', uid), { isAdmin: value }, { merge: true });
}

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

export type FeedbackCategory = 'bug' | 'suggerimento' | 'altro';

export async function submitFeedback(payload: {
  uid: string;
  email: string;
  displayName: string;
  category: FeedbackCategory;
  message: string;
}): Promise<void> {
  await addDoc(collection(db, 'feedback'), {
    ...payload,
    createdAt: serverTimestamp(),
  });
}
