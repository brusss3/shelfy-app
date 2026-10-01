import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy,
  serverTimestamp, Timestamp, writeBatch, getDocs, where,
} from 'firebase/firestore';
import { db } from './firebase';
import { NewShoppingItem, ShoppingItem } from '@/types';

// La lista segue lo stesso scope della dispensa: personale sotto l'utente,
// condivisa sotto la casa — così i conviventi vedono e spuntano la stessa
// lista mentre sono al supermercato in due.
function itemsRef(userId: string, pantryId?: string | null) {
  return pantryId
    ? collection(db, 'pantries', pantryId, 'shoppingItems')
    : collection(db, 'users', userId, 'shoppingItems');
}

function tsToIso(ts: unknown): string {
  return ts instanceof Timestamp ? ts.toDate().toISOString() : new Date().toISOString();
}

// Firestore rifiuta `undefined`: i campi opzionali (brand, barcode…) vanno
// tolti, non lasciati vuoti.
function clean<T extends object>(data: T): T {
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as T;
}

export function subscribeToShoppingItems(
  userId: string,
  pantryId: string | null,
  onData: (items: ShoppingItem[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(itemsRef(userId, pantryId), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => {
        const data = d.data();
        return {
          ...(data as Omit<ShoppingItem, 'id' | 'createdAt'>),
          id: d.id,
          count: data.count ?? 1,
          checked: data.checked === true,
          // Il timestamp del server è null nel primo snapshot locale, finché
          // la scrittura non è confermata.
          createdAt: tsToIso(data.createdAt),
        };
      }));
    },
    onError,
  );
}

export async function addShoppingItem(
  userId: string,
  pantryId: string | null,
  data: NewShoppingItem,
): Promise<void> {
  await addDoc(itemsRef(userId, pantryId), {
    ...clean(data),
    count: data.count ?? 1,
    checked: false,
    ...(pantryId ? { addedBy: userId } : {}),
    createdAt: serverTimestamp(),
  });
}

export async function updateShoppingItem(
  userId: string,
  pantryId: string | null,
  itemId: string,
  data: Partial<Pick<ShoppingItem, 'name' | 'qty' | 'count' | 'checked'>>,
): Promise<void> {
  await updateDoc(doc(itemsRef(userId, pantryId), itemId), clean(data));
}

export async function deleteShoppingItem(
  userId: string,
  pantryId: string | null,
  itemId: string,
): Promise<void> {
  await deleteDoc(doc(itemsRef(userId, pantryId), itemId));
}

/** Toglie dalla lista tutte le voci nel carrello (la spesa è fatta). */
export async function clearCheckedItems(userId: string, pantryId: string | null): Promise<void> {
  const snap = await getDocs(query(itemsRef(userId, pantryId), where('checked', '==', true)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}
