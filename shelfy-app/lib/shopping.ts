import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy,
  serverTimestamp, Timestamp, writeBatch, getDocs, where, setDoc, increment, limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { NewShoppingItem, ShoppingFavorite, ShoppingItem } from '@/types';

// La lista segue lo stesso scope della dispensa: personale sotto l'utente,
// condivisa sotto la casa — così i conviventi vedono e spuntano la stessa
// lista mentre sono al supermercato in due.
function itemsRef(userId: string, pantryId?: string | null) {
  return pantryId
    ? collection(db, 'pantries', pantryId, 'shoppingItems')
    : collection(db, 'users', userId, 'shoppingItems');
}

// Memoria delle voci usate spesso, nello stesso scope della lista.
function favoritesRef(userId: string, pantryId?: string | null) {
  return pantryId
    ? collection(db, 'pantries', pantryId, 'shoppingFavorites')
    : collection(db, 'users', userId, 'shoppingFavorites');
}

/** Chiave stabile di una voce: il barcode se c'è, altrimenti il nome senza
 *  maiuscole, accenti e punteggiatura ("Latte" e "latte " sono la stessa voce).
 *  Vuota se il nome non ha lettere né cifre. */
export function favoriteKey(item: { barcode?: string; name: string }): string {
  if (item.barcode) return `b${item.barcode.replace(/[^0-9A-Za-z]/g, '')}`;
  const slug = item.name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return slug ? `n${slug}` : '';
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

/** Registra un uso della voce: la crea o ne alza il contatore. */
export async function recordFavoriteUse(
  userId: string,
  pantryId: string | null,
  data: NewShoppingItem,
): Promise<void> {
  const id = favoriteKey(data);
  if (!id) return;
  const { count: _count, ...rest } = data;
  await setDoc(
    doc(favoritesRef(userId, pantryId), id),
    { ...clean(rest), uses: increment(1), lastAddedAt: serverTimestamp() },
    { merge: true },
  );
}

export function subscribeToFavorites(
  userId: string,
  pantryId: string | null,
  onData: (favorites: ShoppingFavorite[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(favoritesRef(userId, pantryId), orderBy('uses', 'desc'), limit(30));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => {
      const data = d.data();
      return {
        ...(data as Omit<ShoppingFavorite, 'id' | 'uses'>),
        id: d.id,
        uses: typeof data.uses === 'number' ? data.uses : 0,
      };
    })),
    onError,
  );
}

export async function deleteFavorite(
  userId: string,
  pantryId: string | null,
  favoriteId: string,
): Promise<void> {
  await deleteDoc(doc(favoritesRef(userId, pantryId), favoriteId));
}
