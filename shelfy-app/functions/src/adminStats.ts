import { onCall } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue, AggregateField, Timestamp } from 'firebase-admin/firestore';
import { fail } from './messages';

// -----------------------------------------------------------------------
// Statistiche della dashboard admin
// -----------------------------------------------------------------------
// Prima la dashboard scaricava TUTTI i documenti utente nel browser e
// calcolava lì i numeri: lento, costoso e senza storico. Ora una funzione li
// calcola qui, ogni sera e su richiesta, e scrive un'istantanea:
//  - adminStats/{YYYY-MM-DD}: una per giorno (fuso italiano), è lo storico che
//    alimenta i grafici (utenti attivi, prodotti aggiunti, ospiti/registrati);
//  - adminStats/latest: copia dell'ultima, la sola lettura che serve alla
//    schermata mobile.
// Dove basta un numero si usano le aggregazioni (count/sum: 1 lettura ogni
// 1000 voci d'indice); si leggono documenti (con `select`, solo i campi utili)
// solo quando serve una logica per documento: ospiti, coorti, categorie.
// Le regole permettono la lettura solo agli admin e nessuna scrittura dal client.
// -----------------------------------------------------------------------

const DAY_MS = 86400_000;
const HISTORY_DAYS = 90;
const TOP_CATEGORIES = 10;
// Da questa data i documenti utente hanno origine (acquisition) e contatori di
// attivazione (productsAdded, lastActiveAt): stessa soglia della dashboard.
const ACTIVATION_TRACKING_SINCE = '2026-09-29';

const romeFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' });
const romeKey = (d: Date): string => romeFmt.format(d);

function toIso(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  if (value instanceof Timestamp) return value.toDate().toISOString();
  return null;
}

function msOf(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

// Una sezione che fallisce (indice mancante, collezione nuova…) non deve far
// perdere l'intera istantanea: resta `null` e l'errore finisce nei log.
async function safe<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[adminStats] sezione "${label}" fallita`, e);
    return null;
  }
}

async function count(q: FirebaseFirestore.Query): Promise<number> {
  const snap = await q.count().get();
  return snap.data().count;
}

export interface FunnelRow {
  /** Slug della guida di provenienza; null = nessuna guida (altri canali). */
  source: string | null;
  signups: number;
  firstProduct: number;
  thirdProduct: number;
  /** Iscritti da almeno 7 giorni. */
  eligible7: number;
  /** Di questi, hanno usato l'app 7+ giorni dopo l'iscrizione. */
  returned7: number;
}

async function userStats(db: FirebaseFirestore.Firestore, now: number) {
  const snap = await db.collection('users').select(
    'email', 'isGuest', 'createdAt', 'upgradedAt', 'lastActiveAt', 'productsAdded',
    'productsConsumed', 'productsWasted',
    'isPremium', 'premiumWaitlist', 'acquisition', 'isAdmin', 'aiDisabled',
  ).get();

  const todayKey = romeKey(new Date(now));
  const byDay = new Map<string, { registered: number; guests: number; conversions: number }>();
  for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
    byDay.set(romeKey(new Date(now - i * DAY_MS)), { registered: 0, guests: 0, conversions: 0 });
  }

  const u = {
    total: 0, registered: 0, guests: 0, admins: 0, premium: 0, waitlist: 0, aiBlocked: 0,
    newToday: 0, new7: 0, newPrev7: 0, new30: 0,
    active1: 0, active7: 0, active30: 0, active7Guests: 0,
    productsAddedTotal: 0,
    // Unità mangiate e buttate (eliminate già scadute): lo spreco evitato.
    productsConsumedTotal: 0, productsWastedTotal: 0,
    // Coorte: iscritti da 7 a 37 giorni fa (dopo l'avvio del tracciamento).
    retention7: { eligible: 0, returned: 0 },
    // Iscritti negli ultimi 30 giorni che hanno aggiunto almeno un prodotto.
    activation30: { signups: 0, activated: 0 },
    // Ospiti diventati account (stesso uid, `upgradedAt` sul documento).
    conversions: 0, conversions7: 0, conversions30: 0,
    // Coorte: chi è entrato come ospite negli ultimi 30 giorni, e quanti di
    // loro si sono poi registrati. Gli ospiti inattivi da 30+ giorni vengono
    // cancellati (pulizia automatica di Firebase + cleanupOrphanGuestData), quindi coorti più vecchie non reggono.
    guestCohort30: { started: 0, converted: 0 },
  };
  const funnel = new Map<string | null, FunnelRow>();

  for (const doc of snap.docs) {
    const d = doc.data();
    // Ospite = `isGuest: true`; i documenti senza email e senza il campo
    // (precedenti alla modalità ospite) contano come ospiti per prudenza.
    const isGuest = d.isGuest === true || (!d.email && d.isGuest !== false);
    const createdIso = toIso(d.createdAt);
    const created = msOf(createdIso);
    const upgraded = msOf(toIso(d.upgradedAt));
    if (upgraded !== null) {
      const upAge = now - upgraded;
      u.conversions++;
      if (upAge <= 7 * DAY_MS) u.conversions7++;
      if (upAge <= 30 * DAY_MS) u.conversions30++;
      const b = byDay.get(romeKey(new Date(upgraded)));
      if (b) b.conversions++;
    }
    if (created !== null && now - created <= 30 * DAY_MS && (isGuest || upgraded !== null)) {
      u.guestCohort30.started++;
      if (upgraded !== null) u.guestCohort30.converted++;
    }
    const lastActive = msOf(toIso(d.lastActiveAt));
    const productsAdded = typeof d.productsAdded === 'number' ? d.productsAdded : 0;

    u.total++;
    if (isGuest) u.guests++; else u.registered++;
    if (d.isAdmin === true) u.admins++;
    if (d.isPremium === true) u.premium++;
    if (d.premiumWaitlist === true) u.waitlist++;
    if (d.aiDisabled === true) u.aiBlocked++;
    u.productsAddedTotal += productsAdded;
    if (typeof d.productsConsumed === 'number') u.productsConsumedTotal += d.productsConsumed;
    if (typeof d.productsWasted === 'number') u.productsWastedTotal += d.productsWasted;

    if (lastActive !== null) {
      const age = now - lastActive;
      if (age <= DAY_MS) u.active1++;
      if (age <= 7 * DAY_MS) { u.active7++; if (isGuest) u.active7Guests++; }
      if (age <= 30 * DAY_MS) u.active30++;
    }

    if (created === null || !createdIso) continue;
    const age = now - created;

    // "Nuovi utenti": un account registrato conta dal giorno della
    // registrazione (per un ex ospite è `upgradedAt`), un ospite dal primo
    // accesso. Così i grafici e i totali "nuovi" coincidono.
    const joined = !isGuest && upgraded !== null ? upgraded : created;
    const joinAge = now - joined;
    const dayKey = romeKey(new Date(joined));
    if (dayKey === todayKey) u.newToday++;
    if (joinAge <= 7 * DAY_MS) u.new7++;
    else if (joinAge <= 14 * DAY_MS) u.newPrev7++;
    if (joinAge <= 30 * DAY_MS) u.new30++;
    const bucket = byDay.get(dayKey);
    if (bucket) { if (isGuest) bucket.guests++; else bucket.registered++; }

    // Attivazione, retention e funnel restano sulla data del primo accesso:
    // misurano l'uso dell'app, che per un ex ospite inizia da ospite.
    if (age <= 30 * DAY_MS) {
      u.activation30.signups++;
      if (productsAdded >= 1) u.activation30.activated++;
    }

    if (createdIso < ACTIVATION_TRACKING_SINCE) continue;
    const returned = lastActive !== null && lastActive - created >= 7 * DAY_MS;
    if (age >= 7 * DAY_MS && age <= 37 * DAY_MS) {
      u.retention7.eligible++;
      if (returned) u.retention7.returned++;
    }

    const source: string | null = typeof d.acquisition?.source === 'string' ? d.acquisition.source : null;
    const row = funnel.get(source) ?? { source, signups: 0, firstProduct: 0, thirdProduct: 0, eligible7: 0, returned7: 0 };
    row.signups++;
    if (productsAdded >= 1) row.firstProduct++;
    if (productsAdded >= 3) row.thirdProduct++;
    if (age >= 7 * DAY_MS) {
      row.eligible7++;
      if (returned) row.returned7++;
    }
    funnel.set(source, row);
  }

  return {
    users: u,
    newUsersByDay: [...byDay.entries()].map(([date, v]) => ({ date, ...v })),
    // Guide in ordine di iscritti, "altri canali" sempre in fondo.
    funnel: [...funnel.values()].sort((a, b) =>
      a.source === null ? 1 : b.source === null ? -1 : b.signups - a.signups),
  };
}

async function productStats(db: FirebaseFirestore.Firestore, now: number) {
  const group = db.collectionGroup('products');
  const today = romeKey(new Date(now));
  const soon = romeKey(new Date(now + 3 * DAY_MS));

  // Totale con un'aggregazione; categorie, zone e scadenze richiedono di
  // guardare i singoli documenti (la categoria è testo libero).
  const [total, snap] = await Promise.all([
    count(group),
    group.select('category', 'zone', 'expiry', 'openExpiry').get(),
  ]);

  const categories = new Map<string, number>();
  const zones: Record<string, number> = { frigo: 0, freezer: 0, dispensa: 0 };
  let expired = 0;
  let expiringSoon = 0;
  let inShared = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const raw = typeof d.category === 'string' ? d.category.trim() : '';
    const cat = raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : 'Altro';
    categories.set(cat, (categories.get(cat) ?? 0) + 1);
    if (typeof d.zone === 'string' && d.zone in zones) zones[d.zone]++;

    // Stessa regola di lib/urgency.ts: vale la scadenza più vicina tra quella
    // di fabbrica e quella dopo l'apertura.
    const expiry: string = typeof d.expiry === 'string' ? d.expiry : '';
    const openExpiry: string = typeof d.openExpiry === 'string' ? d.openExpiry : '';
    const eff = openExpiry && (!expiry || openExpiry < expiry) ? openExpiry : expiry;
    if (eff) {
      if (eff < today) expired++;
      else if (eff <= soon) expiringSoon++;
    }
    if (doc.ref.parent.parent?.parent?.id === 'pantries') inShared++;
  }

  const sorted = [...categories.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, TOP_CATEGORIES).map(([name, n]) => ({ name, count: n }));
  const rest = sorted.slice(TOP_CATEGORIES).reduce((s, [, n]) => s + n, 0);

  return {
    inPantries: total,
    expired,
    expiringSoon,
    inShared,
    byZone: zones,
    topCategories: top,
    otherCategoriesCount: rest,
  };
}

async function communityStats(db: FirebaseFirestore.Firestore, now: number) {
  const recipes = db.collection('communityRecipes');
  const weekAgo = Timestamp.fromMillis(now - 7 * DAY_MS);
  const [agg, recipes7d, requests, requestsOpen, proposals, myRecipes, savedRecipes] = await Promise.all([
    recipes.aggregate({
      n: AggregateField.count(),
      ratingSum: AggregateField.sum('ratingSum'),
      ratingCount: AggregateField.sum('ratingCount'),
    }).get(),
    count(recipes.where('createdAt', '>=', weekAgo)),
    count(db.collection('recipeRequests')),
    count(db.collection('recipeRequests').where('status', '==', 'open')),
    count(db.collectionGroup('proposals')),
    count(db.collectionGroup('myRecipes')),
    count(db.collectionGroup('savedRecipes')),
  ]);
  const a = agg.data();
  return {
    recipes: a.n,
    recipes7d,
    ratingCount: a.ratingCount,
    ratingAvg: a.ratingCount > 0 ? Math.round((a.ratingSum / a.ratingCount) * 100) / 100 : null,
    requests,
    requestsOpen,
    proposals,
    myRecipes,
    savedRecipes,
  };
}

async function priceStats(db: FirebaseFirestore.Firestore, now: number) {
  const weekAgo = Timestamp.fromMillis(now - 7 * DAY_MS);
  const subs = db.collection('priceSubmissions');
  const [observations, submissions, submissions7d, suspicious, latest, stores, catalogProducts, shoppingItems] =
    await Promise.all([
      count(db.collection('priceObservations')),
      count(subs),
      count(subs.where('createdAt', '>=', weekAgo)),
      count(subs.where('suspicious', '==', true)),
      count(db.collection('latestPrices')),
      count(db.collection('stores')),
      count(db.collection('catalogProducts')),
      count(db.collectionGroup('shoppingItems')),
    ]);
  return { observations, submissions, submissions7d, suspicious, latest, stores, catalogProducts, shoppingItems };
}

async function pantryStats(db: FirebaseFirestore.Firestore) {
  const snap = await db.collection('pantries').select('memberIds').get();
  let members = 0;
  for (const doc of snap.docs) {
    const ids = doc.data().memberIds;
    if (Array.isArray(ids)) members += ids.length;
  }
  return { shared: snap.size, members };
}

async function feedbackStats(db: FirebaseFirestore.Firestore) {
  const fb = db.collection('feedback');
  // Il client non scrive `status` alla creazione: un feedback senza stato è
  // "nuovo", quindi gli aperti si ricavano per differenza.
  const [total, read, resolved] = await Promise.all([
    count(fb),
    count(fb.where('status', '==', 'letto')),
    count(fb.where('status', '==', 'risolto')),
  ]);
  return { total, open: Math.max(0, total - read - resolved), read, resolved };
}

async function surveyStats(db: FirebaseFirestore.Firestore) {
  const s = db.collection('surveys');
  const [total, active] = await Promise.all([count(s), count(s.where('active', '==', true))]);
  return { total, active };
}

async function buildAdminStats(trigger: 'schedule' | 'manual') {
  const db = getFirestore();
  const now = Date.now();
  const date = romeKey(new Date(now));

  const [userPart, products, community, prices, pantries, feedback, surveys] = await Promise.all([
    safe('users', () => userStats(db, now)),
    safe('products', () => productStats(db, now)),
    safe('community', () => communityStats(db, now)),
    safe('prices', () => priceStats(db, now)),
    safe('pantries', () => pantryStats(db)),
    safe('feedback', () => feedbackStats(db)),
    safe('surveys', () => surveyStats(db)),
  ]);

  const snapshot = {
    version: 1,
    date,
    trigger,
    generatedAt: new Date(now).toISOString(),
    trackingSince: ACTIVATION_TRACKING_SINCE,
    users: userPart?.users ?? null,
    newUsersByDay: userPart?.newUsersByDay ?? [],
    funnel: userPart?.funnel ?? [],
    products,
    community,
    prices,
    pantries,
    feedback,
    surveys,
  };

  const col = db.collection('adminStats');
  const batch = db.batch();
  batch.set(col.doc(date), { ...snapshot, writtenAt: FieldValue.serverTimestamp() });
  batch.set(col.doc('latest'), { ...snapshot, writtenAt: FieldValue.serverTimestamp() });
  await batch.commit();
  return snapshot;
}

// Ogni sera poco prima di mezzanotte: l'istantanea porta la data del giorno
// che misura (gli "attivi oggi" sono quelli delle ultime 24 ore).
export const computeAdminStats = onSchedule(
  {
    schedule: '50 23 * * *', timeZone: 'Europe/Rome', region: 'europe-west1',
    timeoutSeconds: 540, memory: '512MiB',
  },
  async () => {
    await buildAdminStats('schedule');
  },
);

// Ricalcolo a richiesta dalla dashboard: sovrascrive l'istantanea di oggi
// (quella serale la renderà definitiva). Solo per admin, verificato qui sul
// documento utente perché la funzione legge l'intero database.
export const refreshAdminStats = onCall(
  { region: 'europe-west1', cors: true, timeoutSeconds: 300, memory: '512MiB' },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw fail('unauthenticated', 'loginRequired', 'Devi accedere');
    const userSnap = await getFirestore().collection('users').doc(uid).get();
    if (userSnap.data()?.isAdmin !== true) {
      throw fail('permission-denied', 'adminOnly', 'Riservato agli amministratori');
    }
    return buildAdminStats('manual');
  },
);
