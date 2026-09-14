import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, Timestamp, getDocs, getDoc, setDoc, writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db } from './firebase';
import { Product, Zone, CommunityRecipe, RecipeRequest, RecipeProposal, MyRecipe } from '@/types';
import { notifyAdminsNewFeedback } from './notifications';

function tsToIso(ts: unknown): string {
  return ts instanceof Timestamp ? ts.toDate().toISOString() : (typeof ts === 'string' ? ts : new Date().toISOString());
}

// Firestore rifiuta i valori `undefined` (anche annidati, es. Product.nutrition):
// i campi opzionali da Open Food Facts arrivano spesso parzialmente compilati.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function removeUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) return value.map(removeUndefinedDeep) as unknown as T;
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = removeUndefinedDeep(v);
    }
    return out as T;
  }
  return value;
}

export interface AdminUserRecord {
  uid: string;
  email: string;
  displayName: string;
  isPremium: boolean;
  isAdmin: boolean;
  createdAt: string;
  subscriptionType: 'monthly' | 'annual' | null;
  subscriptionExpiresAt: string | null;
  pushToken: string | null;
  adminNotifNewUsers: boolean;
  adminNotifFeedback: boolean;
  aiDisabled: boolean;
}

export async function getAllUsers(): Promise<AdminUserRecord[]> {
  const snap = await getDocs(collection(db, 'users'));
  const users = snap.docs.map((d) => {
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
      pushToken: data.pushToken ?? null,
      adminNotifNewUsers: data.adminNotifNewUsers ?? true,
      adminNotifFeedback: data.adminNotifFeedback ?? true,
      aiDisabled: data.aiDisabled ?? false,
    };
  });
  users.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  return users;
}

export async function saveUserPushToken(uid: string, token: string): Promise<void> {
  await setDoc(doc(db, 'users', uid), { pushToken: token }, { merge: true });
}

export async function updateAdminNotifPreferences(
  uid: string,
  prefs: { adminNotifNewUsers?: boolean; adminNotifFeedback?: boolean },
): Promise<void> {
  await setDoc(doc(db, 'users', uid), prefs, { merge: true });
}

export type FeedbackCategory = 'suggerimento' | 'bug' | 'prodotto' | 'altro';
export type FeedbackStatus = 'nuovo' | 'letto' | 'risolto';

export interface FeedbackRecord {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  category: FeedbackCategory;
  message: string;
  rating?: number;
  status: FeedbackStatus;
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
      rating: data.rating ?? undefined,
      status: (data.status ?? 'nuovo') as FeedbackStatus,
      createdAt: ts instanceof Timestamp ? ts.toDate().toISOString() : (typeof ts === 'string' ? ts : null),
    };
  });
}

export async function updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<void> {
  await updateDoc(doc(db, 'feedback', id), { status });
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
      const products: Product[] = snap.docs.map((d) => {
        const data = d.data() as Omit<Product, 'id'>;
        // I prodotti creati prima dell'introduzione delle quantità non hanno
        // `count`: valgono 1 unità.
        return { ...data, id: d.id, count: data.count ?? 1 };
      });
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
    ...removeUndefinedDeep(data),
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
  await updateDoc(doc(productsRef(userId), productId), removeUndefinedDeep(data));
}

export async function deleteProduct(
  userId: string,
  productId: string,
): Promise<void> {
  await deleteDoc(doc(productsRef(userId), productId));
}

export async function addProductsBulk(
  userId: string,
  items: Omit<Product, 'id' | 'userId'>[],
): Promise<void> {
  const batch = writeBatch(db);
  for (const item of items) {
    const ref = doc(productsRef(userId));
    batch.set(ref, {
      ...removeUndefinedDeep(item),
      userId,
      createdAt: serverTimestamp(),
    });
  }
  await batch.commit();
}

export async function moveProductZone(
  userId: string,
  productId: string,
  zone: Zone,
): Promise<void> {
  await updateDoc(doc(productsRef(userId), productId), { zone });
}

// Consuma una singola unità: scala il contatore, e cancella il prodotto
// quando finisce l'ultima. In transazione perché lo stesso prodotto può
// essere consumato da due punti diversi (schermata e azione della notifica).
export async function consumeOneUnit(userId: string, productId: string): Promise<void> {
  const ref = doc(productsRef(userId), productId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const count = (snap.data().count as number) ?? 1;
    if (count > 1) {
      tx.update(ref, { count: count - 1 });
    } else {
      tx.delete(ref);
    }
  });
}

// Apre una singola unità. Con più unità il prodotto si divide: l'unità aperta
// diventa un documento a sé con la scadenza post-apertura, le altre restano
// sigillate con la scadenza originale.
export async function openOneUnit(
  userId: string,
  productId: string,
  openExpiry: string,
): Promise<void> {
  const ref = doc(productsRef(userId), productId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data() as Omit<Product, 'id'>;
  const count = data.count ?? 1;
  const openedAt = new Date().toISOString().slice(0, 10);

  if (count <= 1) {
    await updateDoc(ref, { openedAt, openExpiry });
    return;
  }

  const batch = writeBatch(db);
  batch.update(ref, { count: count - 1 });
  batch.set(doc(productsRef(userId)), {
    ...removeUndefinedDeep(data),
    count: 1,
    openedAt,
    openExpiry,
    userId,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
}

export async function submitFeedback(payload: {
  uid: string;
  email: string;
  displayName: string;
  category: FeedbackCategory;
  message: string;
  rating?: number;
}): Promise<void> {
  await addDoc(collection(db, 'feedback'), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  notifyAdminsNewFeedback({
    email: payload.email,
    displayName: payload.displayName,
    category: payload.category,
    message: payload.message,
  }).catch((e) => console.warn('[firestore] notifyAdminsNewFeedback failed:', e));
}

// ---------------------------------------------------------------------------
// Ricette community
// ---------------------------------------------------------------------------

function communityRecipesRef() {
  return collection(db, 'communityRecipes');
}

function recipeFromDoc(id: string, data: Record<string, unknown>): CommunityRecipe {
  return {
    id,
    authorId: (data.authorId as string) ?? '',
    authorName: (data.authorName as string) ?? '',
    title: (data.title as string) ?? '',
    desc: (data.desc as string) ?? '',
    time: (data.time as string) ?? '',
    difficulty: (data.difficulty as string) ?? '',
    tag: (data.tag as string) ?? '',
    tint: (data.tint as string) ?? '#e6efde',
    ingredients: (data.ingredients as CommunityRecipe['ingredients']) ?? [],
    steps: (data.steps as string[]) ?? [],
    ratingSum: (data.ratingSum as number) ?? 0,
    ratingCount: (data.ratingCount as number) ?? 0,
    createdAt: tsToIso(data.createdAt),
  };
}

export function subscribeToCommunityRecipes(
  onData: (recipes: CommunityRecipe[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(communityRecipesRef(), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => recipeFromDoc(d.id, d.data()))),
    onError,
  );
}

export async function getCommunityRecipe(recipeId: string): Promise<CommunityRecipe | null> {
  const snap = await getDoc(doc(communityRecipesRef(), recipeId));
  return snap.exists() ? recipeFromDoc(snap.id, snap.data()) : null;
}

export async function createCommunityRecipe(
  data: Omit<CommunityRecipe, 'id' | 'ratingSum' | 'ratingCount' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(communityRecipesRef(), {
    ...data,
    ratingSum: 0,
    ratingCount: 0,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteCommunityRecipe(recipeId: string): Promise<void> {
  await deleteDoc(doc(communityRecipesRef(), recipeId));
}

// Vota una ricetta (1-5): un voto per utente, aggiornabile. La media
// (ratingSum/ratingCount) sul documento padre è mantenuta nella stessa
// transazione del voto, per restare sempre coerente con i singoli voti.
export async function rateRecipe(recipeId: string, uid: string, value: number): Promise<void> {
  const recipeRef = doc(communityRecipesRef(), recipeId);
  const ratingRef = doc(collection(recipeRef, 'ratings'), uid);

  await runTransaction(db, async (tx) => {
    const [recipeSnap, ratingSnap] = await Promise.all([tx.get(recipeRef), tx.get(ratingRef)]);
    if (!recipeSnap.exists()) throw new Error('Ricetta non trovata');

    const previousValue = ratingSnap.exists() ? (ratingSnap.data().value as number) : null;
    const ratingSum = (recipeSnap.data().ratingSum as number) ?? 0;
    const ratingCount = (recipeSnap.data().ratingCount as number) ?? 0;

    const nextSum = previousValue === null ? ratingSum + value : ratingSum - previousValue + value;
    const nextCount = previousValue === null ? ratingCount + 1 : ratingCount;

    tx.set(ratingRef, { value, updatedAt: serverTimestamp() });
    tx.update(recipeRef, { ratingSum: nextSum, ratingCount: nextCount });
  });
}

export async function getMyRecipeRating(recipeId: string, uid: string): Promise<number | null> {
  const snap = await getDoc(doc(collection(doc(communityRecipesRef(), recipeId), 'ratings'), uid));
  return snap.exists() ? (snap.data().value as number) : null;
}

// ---------------------------------------------------------------------------
// Richieste d'aiuto per ricette
// ---------------------------------------------------------------------------

function recipeRequestsRef() {
  return collection(db, 'recipeRequests');
}

function requestFromDoc(id: string, data: Record<string, unknown>): RecipeRequest {
  return {
    id,
    authorId: (data.authorId as string) ?? '',
    authorName: (data.authorName as string) ?? '',
    ingredients: (data.ingredients as string[]) ?? [],
    note: (data.note as string) ?? '',
    status: (data.status as RecipeRequest['status']) ?? 'open',
    createdAt: tsToIso(data.createdAt),
  };
}

export function subscribeToRecipeRequests(
  onData: (requests: RecipeRequest[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(recipeRequestsRef(), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => requestFromDoc(d.id, d.data()))),
    onError,
  );
}

export async function getRecipeRequest(requestId: string): Promise<RecipeRequest | null> {
  const snap = await getDoc(doc(recipeRequestsRef(), requestId));
  return snap.exists() ? requestFromDoc(snap.id, snap.data()) : null;
}

export async function createRecipeRequest(
  data: Omit<RecipeRequest, 'id' | 'status' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(recipeRequestsRef(), {
    ...data,
    status: 'open',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function closeRecipeRequest(requestId: string): Promise<void> {
  await updateDoc(doc(recipeRequestsRef(), requestId), { status: 'closed' });
}

function proposalsRef(requestId: string) {
  return collection(doc(recipeRequestsRef(), requestId), 'proposals');
}

export function subscribeToProposals(
  requestId: string,
  onData: (proposals: RecipeProposal[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(proposalsRef(requestId), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => ({
      id: d.id,
      requestId,
      recipeId: (d.data().recipeId as string) ?? '',
      authorId: (d.data().authorId as string) ?? '',
      authorName: (d.data().authorName as string) ?? '',
      createdAt: tsToIso(d.data().createdAt),
    }))),
    onError,
  );
}

export async function createProposal(
  requestId: string,
  data: { recipeId: string; authorId: string; authorName: string },
): Promise<void> {
  await addDoc(proposalsRef(requestId), {
    ...data,
    createdAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Ricette personali (private) e credito AI giornaliero
// ---------------------------------------------------------------------------

function myRecipesRef(userId: string) {
  return collection(db, 'users', userId, 'myRecipes');
}

export function subscribeToMyRecipes(
  userId: string,
  onData: (recipes: MyRecipe[]) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    myRecipesRef(userId),
    (snap) => {
      const recipes = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: (data.title as string) ?? '',
          desc: (data.desc as string) ?? '',
          time: (data.time as string) ?? '',
          difficulty: (data.difficulty as string) ?? '',
          tag: (data.tag as string) ?? '',
          tint: (data.tint as string) ?? '#e6efde',
          ingredients: (data.ingredients as MyRecipe['ingredients']) ?? [],
          steps: (data.steps as string[]) ?? [],
          source: (data.source as MyRecipe['source']) ?? 'manual',
          published: (data.published as boolean) ?? false,
          publishedRecipeId: (data.publishedRecipeId as string) ?? undefined,
          createdAt: tsToIso(data.createdAt),
        };
      });
      recipes.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(recipes);
    },
    onError,
  );
}

export async function createMyRecipe(
  userId: string,
  data: Omit<MyRecipe, 'id' | 'published' | 'publishedRecipeId' | 'createdAt'>,
): Promise<string> {
  const ref = await addDoc(myRecipesRef(userId), {
    ...data,
    published: false,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteMyRecipe(userId: string, recipeId: string): Promise<void> {
  await deleteDoc(doc(myRecipesRef(userId), recipeId));
}

export async function markMyRecipePublished(
  userId: string,
  recipeId: string,
  publishedRecipeId: string,
): Promise<void> {
  await updateDoc(doc(myRecipesRef(userId), recipeId), { published: true, publishedRecipeId });
}

// ---------------------------------------------------------------------------
// Interruttori AI (admin)
// ---------------------------------------------------------------------------

const aiConfigRef = () => doc(db, 'config', 'ai');

// L'assenza del documento vale come "AI attiva": la feature nasce accesa e
// l'admin la spegne solo in caso di problemi.
export function subscribeToAiEnabled(
  onData: (enabled: boolean) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    aiConfigRef(),
    (snap) => onData(snap.exists() ? (snap.data().enabled as boolean) !== false : true),
    onError,
  );
}

export async function adminSetAiEnabled(enabled: boolean): Promise<void> {
  await setDoc(aiConfigRef(), { enabled }, { merge: true });
}

export async function adminSetUserAiDisabled(uid: string, disabled: boolean): Promise<void> {
  await setDoc(doc(db, 'users', uid), { aiDisabled: disabled }, { merge: true });
}

// Data odierna nel fuso italiano: stessa chiave usata dalla Cloud Function per
// il documento del credito giornaliero.
export function todayKeyRome(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

// True se l'utente ha già speso la generazione AI di oggi.
export async function hasUsedDailyAi(userId: string): Promise<boolean> {
  const snap = await getDoc(doc(collection(db, 'users', userId, 'aiUsage'), todayKeyRome()));
  return snap.exists();
}
