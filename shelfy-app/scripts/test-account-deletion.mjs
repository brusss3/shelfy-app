// Prova end-to-end di exportMyData e deleteMyAccount con un utente USA E GETTA:
// crea l'utente e i dati finti con l'Admin SDK, chiama le funzioni vere con il
// suo token, poi controlla cosa resta nel database. Non tocca dati reali.
//
// Uso (da shelfy-app/shelfy-app, con le credenziali gcloud già configurate):
//   node scripts/test-account-deletion.mjs

import { createRequire } from 'node:module';
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const PROJECT = 'shelfy-632e0';
const API_KEY = 'AIzaSyA5vKbYnVOWyIfcLdwZ62UrpUSAyxeagJk'; // chiave web pubblica, già nel client
const FN = (name) => `https://europe-west1-${PROJECT}.cloudfunctions.net/${name}`;

initializeApp({ projectId: PROJECT });
const auth = getAuth();
const db = getFirestore();

const stamp = Date.now();
let uid; // uid dell'utente anonimo creato sotto
const otherUid = `zz-test-other-${stamp}`; // altro membro: basta l'id, non serve un account
let failures = 0;
const check = (name, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`); if (!ok) failures++; };

async function call(name, token) {
  const res = await fetch(FN(name), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: {} }),
  });
  return { status: res.status, body: await res.json() };
}

// Utente anonimo vero (come un ospite dell'app), creato con la sola chiave web:
// il token ha auth_time = adesso, quindi passa il controllo di accesso recente.
async function signUpAnonymous() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const j = await res.json();
  if (!j.idToken) throw new Error('signUp anonimo: ' + JSON.stringify(j));
  return { token: j.idToken, uid: j.localId };
}

const cleanup = [];
try {
  const signed = await signUpAnonymous();
  uid = signed.uid;
  const token = signed.token;

  // Dati finti: profilo, prodotti, ricetta pubblicata, feedback, invii, casa condivisa con un altro membro.
  await db.collection('users').doc(uid).set({ displayName: 'Test Utente', pushToken: 'ExponentPushToken[test]', createdAt: new Date().toISOString() });
  await db.collection('users').doc(uid).collection('products').add({ name: 'Latte', expiry: '2026-12-01', zone: 'frigo', count: 1, userId: uid });
  await db.collection('users').doc(uid).collection('shoppingItems').add({ name: 'Pane', checked: false });
  const recipe = await db.collection('communityRecipes').add({ authorId: uid, authorName: 'Test Utente', title: 'Ricetta di prova', ratingSum: 0, ratingCount: 0 });
  const request = await db.collection('recipeRequests').add({ authorId: uid, authorName: 'Test Utente', ingredients: ['uova'], status: 'open' });
  const proposal = await request.collection('proposals').add({ authorId: uid, authorName: 'Test Utente', recipeId: recipe.id });
  const feedback = await db.collection('feedback').add({ uid, email: '', displayName: 'Test Utente', category: 'altro', message: 'prova' });
  const price = await db.collection('priceSubmissions').add({ uid, barcode: '123', priceCents: 100 });
  const catalog = await db.collection('catalogSubmissions').doc(`zz-${stamp}`).set({ uid, barcode: `zz-${stamp}`, name: 'X' });

  const shared = db.collection('pantries').doc(`zz-shared-${stamp}`);
  await shared.set({ name: 'Casa di prova', ownerId: uid, memberIds: [uid, otherUid], members: { [uid]: { name: 'A', role: 'owner' }, [otherUid]: { name: 'B', role: 'member' } } });
  const alone = db.collection('pantries').doc(`zz-alone-${stamp}`);
  await alone.set({ name: 'Casa solitaria', ownerId: uid, memberIds: [uid], members: { [uid]: { name: 'A', role: 'owner' } } });
  await alone.collection('products').add({ name: 'Riso', addedBy: uid });
  await db.collection('inviteCodes').doc(`ZZ${stamp}`).set({ pantryId: alone.id });
  cleanup.push(shared, alone, db.collection('inviteCodes').doc(`ZZ${stamp}`), recipe, request, feedback, price, db.collection('catalogSubmissions').doc(`zz-${stamp}`), db.collection('users').doc(otherUid));
  cleanup.push(db.collection('users').doc(uid));

  // --- Esportazione
  const exp = await call('exportMyData', token);
  const d = exp.body.result;
  check('exportMyData risponde 200', exp.status === 200, `status ${exp.status}`);
  check('export: profilo, prodotto e spesa presenti', d?.account?.displayName === 'Test Utente' && d.products?.length === 1 && d.shoppingItems?.length === 1);
  check('export: ricetta, proposta, feedback, invii', d?.publishedRecipes?.length === 1 && d.recipeProposals?.length === 1 && d.feedbackSent?.length === 1 && d.priceSubmissions?.length === 1);
  check('export: due case condivise (ruolo owner)', d?.sharedPantries?.length === 2 && d.sharedPantries.every((p) => p.role === 'owner'));

  // --- Cancellazione
  const del = await call('deleteMyAccount', token);
  check('deleteMyAccount risponde 200', del.status === 200, `status ${del.status} ${JSON.stringify(del.body).slice(0, 120)}`);

  const gone = async (ref) => !(await ref.get()).exists;
  check('profilo utente cancellato', await gone(db.collection('users').doc(uid)));
  check('prodotti (sottocollezione) cancellati', (await db.collection('users').doc(uid).collection('products').get()).empty);
  check('feedback cancellato', await gone(feedback));
  check('invii prezzi cancellati', await gone(price));
  check('invio catalogo cancellato', await gone(db.collection('catalogSubmissions').doc(`zz-${stamp}`)));
  const r = (await recipe.get()).data();
  check('ricetta pubblica anonimizzata', r?.authorId === 'deleted' && r.authorName === 'Utente eliminato', JSON.stringify({ a: r?.authorId, n: r?.authorName }));
  const rq = (await request.get()).data();
  check('richiesta anonimizzata', rq?.authorId === 'deleted');
  const pr = (await proposal.get()).data();
  check('proposta anonimizzata', pr?.authorId === 'deleted' && pr.authorName === 'Utente eliminato');
  const sh = (await shared.get()).data();
  check('casa condivisa: passata all\'altro membro', sh?.ownerId === otherUid && !sh.memberIds.includes(uid) && !(uid in (sh.members ?? {})) && sh.members[otherUid].role === 'owner');
  check('casa solitaria cancellata', await gone(alone));
  check('codice invito della casa solitaria cancellato', await gone(db.collection('inviteCodes').doc(`ZZ${stamp}`)));
  let authGone = false;
  try { await auth.getUser(uid); } catch (e) { authGone = e.code === 'auth/user-not-found'; }
  check('account di accesso cancellato', authGone);
} catch (e) {
  console.error('ERRORE', e);
  failures++;
} finally {
  // Pulizia di quel che il test lascia (l'altro utente, la casa ceduta, i contenuti anonimizzati).
  for (const ref of cleanup) await db.recursiveDelete(ref).catch(() => {});
  if (uid) await auth.deleteUser(uid).catch(() => {});
}
console.log(failures === 0 ? '\nTutto ok.' : `\n${failures} controlli falliti.`);
process.exit(failures === 0 ? 0 : 1);
