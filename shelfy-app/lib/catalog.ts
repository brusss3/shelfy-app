import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from './firebase';

// Catalogo Shelfy: i prodotti che Open Food Facts non conosce, inseriti da chi
// li ha scansionati. Vedi submitCatalogProduct in functions/src/index.ts.

export interface CatalogProduct {
  barcode: string;
  name: string;
  brand: string;
  qty: string;
}

export async function getCatalogProduct(barcode: string): Promise<CatalogProduct | null> {
  try {
    const snap = await getDoc(doc(db, 'catalogProducts', barcode));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { barcode, name: d.name as string, brand: (d.brand as string) ?? '', qty: (d.qty as string) ?? '' };
  } catch {
    // Offline o regole non ancora pubblicate: per chi scansiona è come se il
    // prodotto non fosse nel catalogo.
    return null;
  }
}

/** Aggiunge il prodotto al catalogo. Se qualcuno l'aveva già aggiunto, non
 *  sovrascrive nulla e restituisce la voce esistente (`created: false`). */
export async function submitCatalogProduct(p: CatalogProduct): Promise<CatalogProduct & { created: boolean }> {
  const fn = httpsCallable<CatalogProduct, CatalogProduct & { created: boolean }>(functions, 'submitCatalogProduct');
  const res = await fn(p);
  return { ...p, ...res.data };
}
