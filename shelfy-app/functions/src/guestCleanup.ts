import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Gli account ospite (accesso anonimo) li cancella Firebase da solo dopo 30
// giorni (pulizia automatica attivata in Authentication), ma solo l'account:
// documento utente e sottocollezioni (prodotti, contatori…) resterebbero
// orfani per sempre. Qui si cercano i documenti ospite il cui account non
// esiste più e si cancellano con tutto il contenuto.
//
// Chi da ospite si è registrato ha isGuest: false (vedi upgradeGuest in
// AuthContext) e non viene mai toccato; un ospite ancora vivo nemmeno,
// perché il suo account esiste.

// getUsers accetta al massimo 100 identificativi per chiamata.
const AUTH_BATCH = 100;

export const cleanupOrphanGuestData = onSchedule(
  { schedule: '30 3 * * *', timeZone: 'Europe/Rome', region: 'europe-west1', timeoutSeconds: 540 },
  async () => {
    const auth = getAuth();
    const db = getFirestore();

    const snap = await db.collection('users').where('isGuest', '==', true).select().get();
    const uids = snap.docs.map((d) => d.id);

    const orphans: string[] = [];
    for (let i = 0; i < uids.length; i += AUTH_BATCH) {
      const chunk = uids.slice(i, i + AUTH_BATCH);
      const res = await auth.getUsers(chunk.map((uid) => ({ uid })));
      for (const id of res.notFound) {
        if ('uid' in id) orphans.push(id.uid);
      }
    }

    // Uno alla volta: un errore su un documento non ferma gli altri, e quello
    // fallito si riprova la notte dopo.
    let removed = 0;
    for (const uid of orphans) {
      try {
        await db.recursiveDelete(db.collection('users').doc(uid));
        removed += 1;
      } catch (e) {
        console.warn('[cleanupOrphanGuestData] failed for', uid, e);
      }
    }
    console.log(`[cleanupOrphanGuestData] ${uids.length} guest docs, ${removed}/${orphans.length} orphans removed`);
  },
);
