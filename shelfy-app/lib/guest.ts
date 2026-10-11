import { collection, doc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

// Prodotti di un ospite che accede a un account GIÀ esistente: non si può
// collegare l'ospite a quell'account (l'uid è un altro), quindi la dispensa
// va letta finché si è ancora ospiti e riscritta dopo l'accesso. Chi invece
// si registra da ospite tiene lo stesso uid e non passa di qui.

export type GuestProducts = Record<string, unknown>[];

export async function readGuestProducts(guestUid: string): Promise<GuestProducts> {
  const snap = await getDocs(collection(db, 'users', guestUid, 'products'));
  return snap.docs.map((d) => {
    // userId e createdAt li rimette la scrittura, per il nuovo proprietario.
    const { userId: _u, createdAt: _c, ...rest } = d.data();
    return rest;
  });
}

export async function writeGuestProducts(uid: string, products: GuestProducts): Promise<void> {
  if (products.length === 0) return;
  const batch = writeBatch(db);
  for (const p of products) {
    batch.set(doc(collection(db, 'users', uid, 'products')), {
      ...p,
      userId: uid,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}
