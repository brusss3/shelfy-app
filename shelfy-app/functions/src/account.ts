import { onCall } from 'firebase-functions/v2/https';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { fail } from './messages';

// Diritti dell'utente sui propri dati (GDPR art. 17 cancellazione e art. 20
// portabilità): sono le due funzioni dietro "Elimina account" e "Scarica i miei
// dati" nelle Impostazioni. Gli ospiti (accesso anonimo) possono usarle come
// tutti: non passano da requireUid, che li respinge.

const DELETED_AUTHOR_NAME = 'Utente eliminato';
const DELETED_AUTHOR_ID = 'deleted';
// Cancellare l'account è irreversibile: chi ha lasciato il telefono sbloccato o
// una sessione vecchia deve prima rifare l'accesso.
const RECENT_LOGIN_MS = 15 * 60 * 1000;

function authedUid(request: { auth?: { uid: string; token?: { auth_time?: number } } | null }): string {
  const uid = request.auth?.uid;
  if (!uid) throw fail('unauthenticated', 'loginRequired', 'Devi accedere');
  return uid;
}

// Timestamp di Firestore e simili -> testo, così il risultato è JSON puro.
function plain(value: unknown): unknown {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

async function docsOf(q: FirebaseFirestore.Query): Promise<unknown[]> {
  const snap = await q.get();
  return snap.docs.map((d) => ({ id: d.id, ...(plain(d.data()) as object) }));
}

// ---------------------------------------------------------------------------
// Esportazione
// ---------------------------------------------------------------------------

export const exportMyData = onCall(
  { region: 'europe-west1', cors: true, timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    const uid = authedUid(request);
    const db = getFirestore();
    const userRef = db.collection('users').doc(uid);

    const [profile, products, shoppingItems, shoppingFavorites, savedRecipes, myRecipes, aiUsage,
      pantries, recipes, requests, proposals, feedback, priceSubmissions, catalogSubmissions] = await Promise.all([
      userRef.get(),
      docsOf(userRef.collection('products')),
      docsOf(userRef.collection('shoppingItems')),
      docsOf(userRef.collection('shoppingFavorites')),
      docsOf(userRef.collection('savedRecipes')),
      docsOf(userRef.collection('myRecipes')),
      docsOf(userRef.collection('aiUsage')),
      db.collection('pantries').where('memberIds', 'array-contains', uid).get(),
      docsOf(db.collection('communityRecipes').where('authorId', '==', uid)),
      docsOf(db.collection('recipeRequests').where('authorId', '==', uid)),
      docsOf(db.collectionGroup('proposals').where('authorId', '==', uid)),
      docsOf(db.collection('feedback').where('uid', '==', uid)),
      docsOf(db.collection('priceSubmissions').where('uid', '==', uid)),
      docsOf(db.collection('catalogSubmissions').where('uid', '==', uid)),
    ]);

    // Prodotti e lista delle case condivise: solo i nomi e il ruolo, non i dati degli altri membri.
    const sharedPantries = pantries.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        role: data.ownerId === uid ? 'owner' : 'member',
        members: Object.keys(data.members ?? {}).length,
        createdAt: plain(data.createdAt),
      };
    });

    const user = (plain(profile.data() ?? {}) as Record<string, unknown>);
    return {
      exportedAt: new Date().toISOString(),
      format: 'shelfy-data-export-v1',
      account: { uid, ...user },
      authEmail: (await getAuth().getUser(uid).catch(() => null))?.email ?? null,
      products, shoppingItems, shoppingFavorites, savedRecipes, myRecipes, aiUsage,
      sharedPantries,
      publishedRecipes: recipes,
      recipeRequests: requests,
      recipeProposals: proposals,
      feedbackSent: feedback,
      priceSubmissions,
      catalogSubmissions,
    };
  },
);

// ---------------------------------------------------------------------------
// Cancellazione
// ---------------------------------------------------------------------------

export const deleteMyAccount = onCall(
  { region: 'europe-west1', cors: true, timeoutSeconds: 300, memory: '512MiB' },
  async (request) => {
    const uid = authedUid(request);

    const authTime = (request.auth?.token as { auth_time?: number } | undefined)?.auth_time;
    if (!authTime || Date.now() - authTime * 1000 > RECENT_LOGIN_MS) {
      throw fail('failed-precondition', 'recentLoginRequired', 'Per sicurezza accedi di nuovo prima di eliminare l\'account');
    }

    const db = getFirestore();

    // 1. Case condivise. Se sei l'unico membro la casa sparisce con il suo
    //    contenuto; altrimenti esci e, se la casa era tua, passa a un altro membro.
    const pantries = await db.collection('pantries').where('memberIds', 'array-contains', uid).get();
    for (const p of pantries.docs) {
      const data = p.data();
      const others = ((data.memberIds ?? []) as string[]).filter((m) => m !== uid);
      if (others.length === 0) {
        const codes = await db.collection('inviteCodes').where('pantryId', '==', p.id).get();
        await Promise.all(codes.docs.map((c) => c.ref.delete()));
        await db.recursiveDelete(p.ref);
        continue;
      }
      const update: Record<string, unknown> = {
        memberIds: FieldValue.arrayRemove(uid),
        [`members.${uid}`]: FieldValue.delete(),
      };
      if (data.ownerId === uid) {
        update.ownerId = others[0];
        update[`members.${others[0]}.role`] = 'owner';
      }
      await p.ref.update(update);
    }

    // 2. Contenuti pubblici: restano, senza nome. Le ricette salvate o votate da
    //    altri non devono sparire perché l'autore se ne va.
    const anonymise = { authorId: DELETED_AUTHOR_ID, authorName: DELETED_AUTHOR_NAME };
    const [recipes, requests, proposals] = await Promise.all([
      db.collection('communityRecipes').where('authorId', '==', uid).get(),
      db.collection('recipeRequests').where('authorId', '==', uid).get(),
      db.collectionGroup('proposals').where('authorId', '==', uid).get(),
    ]);
    for (const group of [recipes, requests, proposals]) {
      for (let i = 0; i < group.docs.length; i += 400) {
        const batch = db.batch();
        for (const d of group.docs.slice(i, i + 400)) batch.update(d.ref, anonymise);
        await batch.commit();
      }
    }

    // 3. Cose che il database lega a te e basta: via.
    const owned = await Promise.all([
      db.collection('feedback').where('uid', '==', uid).get(),
      db.collection('priceSubmissions').where('uid', '==', uid).get(),
      db.collection('catalogSubmissions').where('uid', '==', uid).get(),
    ]);
    for (const group of owned) {
      for (let i = 0; i < group.docs.length; i += 400) {
        const batch = db.batch();
        for (const d of group.docs.slice(i, i + 400)) batch.delete(d.ref);
        await batch.commit();
      }
    }
    const surveys = await db.collection('surveys').get();
    await Promise.all(surveys.docs.map((s) => s.ref.collection('responses').doc(uid).delete()));

    // 4. Profilo e tutto ciò che sta sotto (prodotti, spesa, ricette personali, contatori, token).
    await db.recursiveDelete(db.collection('users').doc(uid));

    // 5. Per ultimo l'account di accesso: se qualcosa si interrompe prima, si può riprovare.
    await getAuth().deleteUser(uid);
    return { ok: true };
  },
);
