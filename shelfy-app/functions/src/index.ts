import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Transaction } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { timingSafeEqual } from 'node:crypto';

initializeApp();

const GROQ_API_KEY = defineSecret('GROQ_API_KEY');
// Valore dell'header Authorization configurato su RevenueCat → Webhooks.
const RC_WEBHOOK_SECRET = defineSecret('RC_WEBHOOK_SECRET');

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b';

const TINTS = ['#e6efde', '#f1ede0', '#f3e9e0', '#f4e9c8', '#e8dcc6', '#eceee5', '#f4dad0', '#e6dfd1'];

interface GeneratedRecipe {
  title: string;
  time: string;
  difficulty: string;
  desc: string;
  tag: string;
  ingredients: { name: string; qty: string }[];
  steps: string[];
}

// Chiave del credito giornaliero nel fuso italiano (l'utenza è italiana):
// "2026-09-14". Il client usa la stessa formula per sapere se ha già generato.
function todayKeyRome(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
}

function tomorrowKeyRome(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d);
}

// Lunedì della settimana corrente in data civile italiana: chiave del credito
// AI settimanale del piano base.
// ⚠️ Duplicata identica in lib/limits.ts lato app — vanno tenute allineate.
function weekKeyRome(): string {
  const [y, m, d] = todayKeyRome().split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return `w:${date.toISOString().slice(0, 10)}`;
}

function buildPrompt(ingredients: string[]): string {
  return `Ingredienti: ${ingredients.join(', ')}.
Dammi UNA ricetta della tradizione italiana REALMENTE ESISTENTE che li usi (es. frittata, pasta al pomodoro, risotto). Non inventare piatti né nomi di fantasia. Puoi aggiungere solo base comune: olio, sale, pepe, aglio, cipolla.
Rispondi con questo JSON, in italiano, max 6 ingredienti e max 5 passi:
{"title":"","time":"20 min","difficulty":"Facile","desc":"","tag":"","ingredients":[{"name":"","qty":""}],"steps":[""]}`;
}

function parseRecipe(raw: string): GeneratedRecipe {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new HttpsError('internal', 'Risposta AI non valida');
  }
  const r = parsed as Partial<GeneratedRecipe>;
  const ingredients = Array.isArray(r.ingredients) ? r.ingredients.filter((i) => i?.name) : [];
  const steps = Array.isArray(r.steps) ? r.steps.filter((s) => typeof s === 'string' && s.trim()) : [];
  if (!r.title?.trim() || ingredients.length < 1 || steps.length < 2) {
    throw new HttpsError('internal', 'Ricetta AI incompleta');
  }
  return {
    title: r.title.trim(),
    time: r.time?.trim() || '20 min',
    difficulty: r.difficulty?.trim() || 'Facile',
    desc: r.desc?.trim() || '',
    tag: r.tag?.trim() || 'AI',
    ingredients: ingredients.slice(0, 6).map((i) => ({ name: String(i.name).trim(), qty: String(i.qty ?? '').trim() })),
    steps: steps.slice(0, 5).map((s) => s.trim()),
  };
}

async function callGroq(apiKey: string, ingredients: string[]): Promise<GeneratedRecipe> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.3,
      max_tokens: 700,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'Sei uno chef italiano. Rispondi solo con JSON valido.' },
        { role: 'user', content: buildPrompt(ingredients) },
      ],
    }),
  });

  if (!res.ok) {
    // Log completo lato server per diagnosi (mai esposto al client).
    const body = await res.text().catch(() => '');
    console.error('Groq error', res.status, body);
    if (res.status === 404) {
      // Il modello configurato non è (più) accessibile con questa chiave:
      // logga i modelli davvero disponibili per scegliere il sostituto giusto
      // invece di indovinare alla cieca.
      const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      }).catch(() => null);
      const modelsBody = await modelsRes?.text().catch(() => '');
      console.error('Groq available models', modelsRes?.status, modelsBody);
    }
    // 429 = quota/rate limit del piano free: per il client è indistinguibile da
    // un guasto temporaneo, in entrambi i casi deve poter riprovare più tardi.
    throw new HttpsError('unavailable', res.status === 429 ? 'Limite Groq raggiunto' : `Groq ${res.status}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new HttpsError('internal', 'Risposta AI vuota');
  return parseRecipe(content);
}

export const generateDailyRecipe = onCall(
  { region: 'europe-west1', secrets: [GROQ_API_KEY], cors: true },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Devi accedere');

    const rawIngredients = (request.data?.ingredients ?? []) as unknown;
    const ingredients = Array.isArray(rawIngredients)
      ? rawIngredients
          .filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
          .slice(0, 6)
          .map((i) => i.trim().slice(0, 40))
      : [];
    if (ingredients.length === 0) {
      throw new HttpsError('invalid-argument', 'Seleziona almeno un ingrediente');
    }

    const db = getFirestore();

    // Interruttori dell'admin: globale (config/ai) e per singolo account
    // (users/{uid}.aiDisabled). Vanno verificati qui, non solo nella UI, perché
    // servono a fermare davvero i consumi in caso di problemi.
    const [configSnap, userSnap] = await Promise.all([
      db.collection('config').doc('ai').get(),
      db.collection('users').doc(uid).get(),
    ]);
    if (configSnap.exists && configSnap.data()?.enabled === false) {
      throw new HttpsError('failed-precondition', 'Le ricette AI sono temporaneamente disattivate');
    }
    if (userSnap.data()?.aiDisabled === true) {
      throw new HttpsError('permission-denied', 'Le ricette AI non sono attive sul tuo account');
    }

    // Il piano base ha un credito settimanale, il Premium uno giornaliero: le
    // due chiavi vivono in documenti diversi, quindi chi passa a Premium dopo
    // aver speso il credito della settimana può generare subito.
    const isPremium = userSnap.data()?.isPremium === true;
    const usageRef = db
      .collection('users')
      .doc(uid)
      .collection('aiUsage')
      .doc(isPremium ? todayKeyRome() : weekKeyRome());

    // Prenota il credito PRIMA di chiamare Groq: due richieste in parallelo non
    // possono generare due ricette. Se poi Groq fallisce la prenotazione viene
    // rilasciata, così un errore non brucia la generazione del giorno.
    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(usageRef);
      if (snap.exists) {
        throw new HttpsError(
          'resource-exhausted',
          isPremium
            ? 'Hai già generato la ricetta di oggi'
            : 'Hai già generato la ricetta di questa settimana',
        );
      }
      tx.set(usageRef, { createdAt: FieldValue.serverTimestamp() });
    });

    try {
      const recipe = await callGroq(GROQ_API_KEY.value(), ingredients);
      const doc = await db.collection('users').doc(uid).collection('myRecipes').add({
        ...recipe,
        tint: TINTS[Math.floor(Math.random() * TINTS.length)],
        source: 'ai',
        published: false,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { id: doc.id, ...recipe };
    } catch (err) {
      await usageRef.delete().catch(() => undefined);
      throw err;
    }
  },
);

// -----------------------------------------------------------------------
// Case condivise (collezione Firestore "pantries" — nome interno invariato,
// solo il testo rivolto all'utente dice "casa": "dispensa" nell'app indica
// già la zona Frigo/Freezer/Dispensa, quindi va evitato per il contenitore
// condiviso).
//
// Il join da codice invito passa SEMPRE da qui (Admin SDK, bypassa le regole
// Firestore): è l'unico punto in cui un utente può finire nella lista membri
// di una casa, e solo con un codice valido, non scaduto, entro il tetto
// massimo di membri, e con un limite ai tentativi per rendere impraticabile
// un brute-force sul codice a 6 caratteri.
// -----------------------------------------------------------------------

// Alfabeto senza caratteri ambigui alla lettura (niente O/0, I/1, L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const INVITE_TTL_DAYS = 7;
const MAX_PANTRY_MEMBERS = 6;
const MAX_JOIN_ATTEMPTS_PER_HOUR = 8;

function randomInviteCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

// Chiave oraria (UTC) per il contatore di tentativi: stesso stile della
// chiave giornaliera del credito AI, ma a grana più fine.
function hourBucketUTC(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}`;
}

async function generateUniqueInviteCode(db: FirebaseFirestore.Firestore): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomInviteCode();
    const snap = await db.collection('inviteCodes').doc(code).get();
    if (!snap.exists) return code;
  }
  throw new HttpsError('internal', 'Impossibile generare un codice invito, riprova');
}

function requireUid(request: { auth?: { uid: string } | null }): string {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Devi accedere');
  return uid;
}

function requireString(value: unknown, field: string, maxLen = 200): string {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) throw new HttpsError('invalid-argument', `${field} mancante`);
  return s.slice(0, maxLen);
}

export const createPantry = onCall(
  { region: 'europe-west1', cors: true },
  async (request) => {
    const uid = requireUid(request);
    const name = requireString(request.data?.name, 'Nome casa', 60);
    const displayName = requireString(request.data?.displayName ?? 'Utente Shelfy', 'Nome utente', 60);

    const db = getFirestore();
    const code = await generateUniqueInviteCode(db);
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400000);
    const pantryRef = db.collection('pantries').doc();

    await db.runTransaction(async (tx: Transaction) => {
      tx.set(pantryRef, {
        name,
        ownerId: uid,
        memberIds: [uid],
        members: { [uid]: { name: displayName, role: 'owner', joinedAt: FieldValue.serverTimestamp() } },
        createdAt: FieldValue.serverTimestamp(),
      });
      // Il codice vive in un sotto-documento leggibile SOLO dal creatore
      // (vedi firestore.rules pantries/{id}/private/*), non su un campo del
      // documento principale che tutti i membri possono leggere.
      tx.set(pantryRef.collection('private').doc('invite'), { code, expiresAt });
      tx.set(db.collection('inviteCodes').doc(code), { pantryId: pantryRef.id, expiresAt });
    });

    return { id: pantryRef.id, inviteCode: code, inviteCodeExpiresAt: expiresAt.toISOString() };
  },
);

export const joinPantry = onCall(
  { region: 'europe-west1', cors: true },
  async (request) => {
    const uid = requireUid(request);
    const rawCode = String(request.data?.code ?? '').trim().toUpperCase();
    if (rawCode.length !== CODE_LENGTH) {
      throw new HttpsError('invalid-argument', 'Codice non valido');
    }
    const displayName = requireString(request.data?.displayName ?? 'Utente Shelfy', 'Nome utente', 60);

    const db = getFirestore();

    // Prenota un tentativo PRIMA di guardare il codice: anche un codice
    // sbagliato consuma la quota, altrimenti il limite non frenerebbe un
    // brute-force (che fallisce quasi sempre by design).
    const attemptsRef = db.collection('users').doc(uid).collection('joinAttempts').doc(hourBucketUTC());
    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(attemptsRef);
      const count = snap.exists ? ((snap.data()?.count as number) ?? 0) : 0;
      if (count >= MAX_JOIN_ATTEMPTS_PER_HOUR) {
        throw new HttpsError('resource-exhausted', 'Troppi tentativi. Riprova tra un\'ora.');
      }
      tx.set(attemptsRef, { count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });

    const codeSnap = await db.collection('inviteCodes').doc(rawCode).get();
    if (!codeSnap.exists) throw new HttpsError('not-found', 'Codice non valido o scaduto');

    const { pantryId, expiresAt } = codeSnap.data() as { pantryId: string; expiresAt: FirebaseFirestore.Timestamp };
    if (expiresAt.toDate().getTime() < Date.now()) {
      throw new HttpsError('not-found', 'Codice non valido o scaduto');
    }

    const pantryRef = db.collection('pantries').doc(pantryId);

    return db.runTransaction(async (tx: Transaction) => {
      const pantrySnap = await tx.get(pantryRef);
      if (!pantrySnap.exists) throw new HttpsError('not-found', 'Casa non trovata');
      const data = pantrySnap.data()!;
      const memberIds: string[] = data.memberIds ?? [];

      // Già membro: risposta idempotente invece di un errore (es. QR
      // scansionato due volte per sbaglio).
      if (memberIds.includes(uid)) {
        return { id: pantryId, name: data.name as string, alreadyMember: true };
      }
      if (memberIds.length >= MAX_PANTRY_MEMBERS) {
        throw new HttpsError('resource-exhausted', 'Questa casa ha già raggiunto il numero massimo di membri');
      }

      tx.update(pantryRef, {
        memberIds: FieldValue.arrayUnion(uid),
        [`members.${uid}`]: { name: displayName, role: 'member', joinedAt: FieldValue.serverTimestamp() },
      });
      return { id: pantryId, name: data.name as string, alreadyMember: false };
    });
  },
);

async function requireOwner(db: FirebaseFirestore.Firestore, pantryId: string, uid: string) {
  const ref = db.collection('pantries').doc(pantryId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', 'Casa non trovata');
  if (snap.data()?.ownerId !== uid) {
    throw new HttpsError('permission-denied', 'Solo chi ha creato la casa può farlo');
  }
  return { ref, data: snap.data()! };
}

export const rotateInviteCode = onCall(
  { region: 'europe-west1', cors: true },
  async (request) => {
    const uid = requireUid(request);
    const pantryId = requireString(request.data?.pantryId, 'Casa');
    const db = getFirestore();
    const { ref } = await requireOwner(db, pantryId, uid);
    const inviteRef = ref.collection('private').doc('invite');

    const inviteSnap = await inviteRef.get();
    const oldCode = (inviteSnap.data()?.code as string | null) ?? null;
    const newCode = await generateUniqueInviteCode(db);
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400000);

    const batch = db.batch();
    if (oldCode) batch.delete(db.collection('inviteCodes').doc(oldCode));
    batch.set(db.collection('inviteCodes').doc(newCode), { pantryId, expiresAt });
    batch.set(inviteRef, { code: newCode, expiresAt });
    await batch.commit();

    return { inviteCode: newCode, inviteCodeExpiresAt: expiresAt.toISOString() };
  },
);

export const disableInviteCode = onCall(
  { region: 'europe-west1', cors: true },
  async (request) => {
    const uid = requireUid(request);
    const pantryId = requireString(request.data?.pantryId, 'Casa');
    const db = getFirestore();
    const { ref } = await requireOwner(db, pantryId, uid);
    const inviteRef = ref.collection('private').doc('invite');

    const inviteSnap = await inviteRef.get();
    const oldCode = (inviteSnap.data()?.code as string | null) ?? null;
    const batch = db.batch();
    if (oldCode) batch.delete(db.collection('inviteCodes').doc(oldCode));
    batch.set(inviteRef, { code: null, expiresAt: null });
    await batch.commit();

    return { ok: true };
  },
);

export const leavePantry = onCall(
  { region: 'europe-west1', cors: true },
  async (request) => {
    const uid = requireUid(request);
    const pantryId = requireString(request.data?.pantryId, 'Casa');
    const db = getFirestore();
    const pantryRef = db.collection('pantries').doc(pantryId);

    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(pantryRef);
      if (!snap.exists) return;
      if (snap.data()?.ownerId === uid) {
        throw new HttpsError('failed-precondition', 'Chi ha creato la casa non può abbandonarla: eliminala invece');
      }
      tx.update(pantryRef, {
        memberIds: FieldValue.arrayRemove(uid),
        [`members.${uid}`]: FieldValue.delete(),
      });
    });

    return { ok: true };
  },
);

export const removeMember = onCall(
  { region: 'europe-west1', cors: true },
  async (request) => {
    const uid = requireUid(request);
    const pantryId = requireString(request.data?.pantryId, 'Casa');
    const targetUid = requireString(request.data?.uid, 'Membro');
    if (targetUid === uid) {
      throw new HttpsError('invalid-argument', 'Usa "abbandona" per rimuovere te stesso');
    }
    const db = getFirestore();
    const { ref } = await requireOwner(db, pantryId, uid);

    await ref.update({
      memberIds: FieldValue.arrayRemove(targetUid),
      [`members.${targetUid}`]: FieldValue.delete(),
    });

    return { ok: true };
  },
);

export const deletePantry = onCall(
  { region: 'europe-west1', cors: true },
  async (request) => {
    const uid = requireUid(request);
    const pantryId = requireString(request.data?.pantryId, 'Casa');
    const db = getFirestore();
    const pantryRef = db.collection('pantries').doc(pantryId);
    const snap = await pantryRef.get();
    if (!snap.exists) return { ok: true };
    if (snap.data()?.ownerId !== uid) {
      throw new HttpsError('permission-denied', 'Solo chi ha creato la casa può eliminarla');
    }

    const inviteRef = pantryRef.collection('private').doc('invite');
    const inviteSnap = await inviteRef.get();
    const code = (inviteSnap.data()?.code as string | null) ?? null;

    // Cancella i prodotti condivisi a blocchi, per dispense molto piene.
    const productsRef = pantryRef.collection('products');
    for (;;) {
      const batchSnap = await productsRef.limit(300).get();
      if (batchSnap.empty) break;
      const batch = db.batch();
      batchSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }

    const finalBatch = db.batch();
    if (code) finalBatch.delete(db.collection('inviteCodes').doc(code));
    finalBatch.delete(inviteRef);
    finalBatch.delete(pantryRef);
    await finalBatch.commit();

    return { ok: true };
  },
);

// --- Webhook RevenueCat: unico scrittore di `isPremium` ---
//
// Le regole Firestore vietano al client di toccare isPremium/subscription*:
// un utente non deve potersi regalare il premium. L'unica fonte che scrive
// quei campi è questo webhook, che gira con l'Admin SDK (bypassa le regole) e
// riceve gli eventi direttamente da RevenueCat — quindi vale per acquisti da
// Play Store e da Stripe allo stesso modo.
//
// Su RevenueCat: Project settings → Integrations → Webhooks, URL di questa
// function e come Authorization header lo stesso valore del secret
// RC_WEBHOOK_SECRET.

// Eventi che lasciano l'abbonamento attivo. CANCELLATION non c'è: significa
// solo "non si rinnoverà", l'accesso resta fino alla scadenza (arriverà poi
// EXPIRATION). BILLING_ISSUE idem: l'utente ha un periodo di grazia.
const RC_GRANTING_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'SUBSCRIPTION_EXTENDED',
  'TRANSFER',
  'NON_RENEWING_PURCHASE',
]);

const RC_REVOKING_EVENTS = new Set(['EXPIRATION', 'SUBSCRIPTION_PAUSED', 'REFUND']);

// Confronto a tempo costante: su un segreto condiviso un `===` perde byte per
// byte e permette, in linea di principio, di indovinarlo un carattere alla volta.
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const revenueCatWebhook = onRequest(
  { region: 'europe-west1', secrets: [RC_WEBHOOK_SECRET] },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }
    // Su RevenueCat il campo Authorization si può compilare sia col solo
    // segreto sia in forma "Bearer <segreto>": accettiamo entrambe, così una
    // svista non si traduce in 401 silenziosi e premium che non si attivano.
    const header = req.headers.authorization ?? '';
    const provided = header.replace(/^Bearer\s+/i, '');
    if (!secretMatches(provided, RC_WEBHOOK_SECRET.value())) {
      console.warn('[revenueCatWebhook] Authorization non valida');
      res.status(401).send('Unauthorized');
      return;
    }

    const event = req.body?.event;
    const type: string = event?.type ?? '';
    // app_user_id è l'uid Firebase: lo passiamo noi a Purchases.configure().
    const uid: string = event?.app_user_id ?? '';
    if (!uid) {
      console.warn('[revenueCatWebhook] evento senza app_user_id:', type);
      res.status(200).send('ignored');
      return;
    }

    const entitlements: string[] = event?.entitlement_ids ?? [];
    if (entitlements.length > 0 && !entitlements.includes('premium')) {
      res.status(200).send('ignored');
      return;
    }

    const expiresAtMs: number | null = event?.expiration_at_ms ?? null;
    const stillValid = expiresAtMs === null || expiresAtMs > Date.now();
    const granting = RC_GRANTING_EVENTS.has(type) && stillValid;
    const revoking = RC_REVOKING_EVENTS.has(type) || (RC_GRANTING_EVENTS.has(type) && !stillValid);

    if (!granting && !revoking) {
      res.status(200).send('ignored');
      return;
    }

    const productId: string = event?.product_id ?? '';
    const lower = productId.toLowerCase();
    const patch = granting
      ? {
          isPremium: true,
          subscriptionType: lower.includes('annual') || lower.includes('yearly') ? 'annual' : 'monthly',
          subscriptionExpiresAt: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
        }
      : { isPremium: false, subscriptionType: null, subscriptionExpiresAt: null };

    try {
      await getFirestore().collection('users').doc(uid).set(patch, { merge: true });
      console.log('[revenueCatWebhook]', type, uid, granting ? 'premium ON' : 'premium OFF');
      res.status(200).send('ok');
    } catch (e) {
      // 500 → RevenueCat riprova da solo.
      console.error('[revenueCatWebhook] scrittura fallita', uid, e);
      res.status(500).send('error');
    }
  },
);

// --- Promemoria scadenza per il web (PWA) ---
//
// Su nativo i promemoria sono schedulati IN LOCALE sul device (vedi
// lib/notifications.ts scheduleExpiryNotifications) e non passano da qui: un
// telefono può pianificare una notifica futura anche ad app chiusa, un
// browser no. Questa funzione copre solo chi ha attivato le notifiche dal
// web (campo `webPushToken` sull'utente) e non tocca in alcun modo il flusso
// nativo già funzionante.

// Stessa logica di lib/urgency.ts effectiveExpiry() lato client: la
// scadenza "vera" è la più vicina tra quella di fabbrica e quella dopo
// apertura, se presente.
function effectiveExpiryDate(data: FirebaseFirestore.DocumentData): string {
  const expiry: string = data.expiry;
  const openExpiry: string | undefined = data.openExpiry;
  return openExpiry && openExpiry < expiry ? openExpiry : expiry;
}

interface ReminderGroup {
  uid: string;
  when: 'oggi' | 'domani';
  pantryName: string | null; // null = dispensa personale
  names: string[];
}

export const sendExpiryReminders = onSchedule(
  { schedule: '0 8 * * *', timeZone: 'Europe/Rome', region: 'europe-west1' },
  async () => {
    const db = getFirestore();
    const today = todayKeyRome();
    const tomorrow = tomorrowKeyRome();
    const dates = [today, tomorrow];

    // Un prodotto rientra se scade lui o la sua scadenza-dopo-apertura cade
    // oggi/domani: due query separate perché Firestore non fa OR tra campi
    // diversi nella stessa query.
    const [byExpiry, byOpenExpiry] = await Promise.all([
      db.collectionGroup('products').where('expiry', 'in', dates).get(),
      db.collectionGroup('products').where('openExpiry', 'in', dates).get(),
    ]);

    const seen = new Set<string>();
    const docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    for (const snap of [byExpiry, byOpenExpiry]) {
      for (const doc of snap.docs) {
        if (seen.has(doc.ref.path)) continue;
        seen.add(doc.ref.path);
        docs.push(doc);
      }
    }
    if (docs.length === 0) return;

    const groups = new Map<string, ReminderGroup>();
    const pantryCache = new Map<string, { name: string; memberIds: string[] } | null>();

    for (const doc of docs) {
      const data = doc.data();
      const dateIso = effectiveExpiryDate(data);
      if (!dates.includes(dateIso)) continue;
      const when: 'oggi' | 'domani' = dateIso === today ? 'oggi' : 'domani';
      const name: string = data.name ?? '';

      // users/{uid}/products/{id} oppure pantries/{id}/products/{id}
      const ownerDoc = doc.ref.parent.parent;
      const ownerCollectionId = ownerDoc?.parent?.id;
      if (!ownerDoc) continue;

      let recipients: string[];
      let pantryName: string | null = null;

      if (ownerCollectionId === 'pantries') {
        let cached = pantryCache.get(ownerDoc.id);
        if (cached === undefined) {
          const snap = await ownerDoc.get();
          const pData = snap.data();
          cached = snap.exists
            ? { name: pData?.name ?? '', memberIds: pData?.memberIds ?? [] }
            : null;
          pantryCache.set(ownerDoc.id, cached);
        }
        if (!cached) continue;
        recipients = cached.memberIds;
        pantryName = cached.name;
      } else {
        recipients = [ownerDoc.id];
      }

      for (const uid of recipients) {
        const key = `${uid}::${when}::${pantryName ?? ''}`;
        const existing = groups.get(key);
        if (existing) existing.names.push(name);
        else groups.set(key, { uid, when, pantryName, names: [name] });
      }
    }
    if (groups.size === 0) return;

    // Una sola lettura per destinatario, anche se compare in più gruppi.
    const uids = [...new Set([...groups.values()].map((g) => g.uid))];
    const userRefs = uids.map((uid) => db.collection('users').doc(uid));
    const userSnaps = userRefs.length > 0 ? await db.getAll(...userRefs) : [];
    const userInfo = new Map<string, { token?: string; enabled: boolean }>();
    userSnaps.forEach((snap, i) => {
      const data = snap.data();
      userInfo.set(uids[i], {
        token: data?.webPushToken,
        enabled: data?.notificationsEnabled !== false,
      });
    });

    const messaging = getMessaging();
    const sends: Promise<unknown>[] = [];

    for (const g of groups.values()) {
      const info = userInfo.get(g.uid);
      if (!info?.token || !info.enabled) continue;

      const where = g.pantryName
        ? `nella casa "${g.pantryName}"`
        : 'nella tua dispensa personale';
      const whenLabel = g.when === 'oggi' ? 'oggi' : 'domani';
      const title = g.when === 'oggi' ? '⏰ Shelfy — Scade oggi' : '⏰ Shelfy — Scadenza vicina';
      const body = g.names.length === 1
        ? `${g.names[0]} scade ${whenLabel} ${where}.`
        : `Hai ${g.names.length} prodotti in scadenza ${whenLabel} ${where}.`;

      sends.push(
        messaging.send({
          token: info.token,
          notification: { title, body },
          webpush: { fcmOptions: { link: '/' } },
        }).catch((e) => console.warn('[sendExpiryReminders] invio fallito per', g.uid, e)),
      );
    }

    await Promise.all(sends);
  },
);

// -----------------------------------------------------------------------
// Prezzi della community
// -----------------------------------------------------------------------
// Un prezzo non è una proprietà del prodotto ma un'osservazione: prodotto +
// negozio + data + prezzo + fonte. Ogni invio produce:
//  - priceObservations/{id}: storico, append-only (nessun dato personale);
//  - latestPrices/{barcode}_{storeId}: l'ultimo prezzo noto per negozio,
//    quello che l'app legge (una lettura per negozio, non per osservazione);
//  - priceSubmissions/{id}: chi ha inviato cosa, leggibile solo dall'admin —
//    serve a moderare e, più avanti, a pesare l'affidabilità. È separato di
//    proposito: la community vede prodotto/prezzo/negozio/data, mai l'autore.
// Tutto passa da qui (Admin SDK) perché le regole Firestore non possono
// limitare la frequenza né confrontare con i prezzi già noti.
// -----------------------------------------------------------------------

// Uno scontrino intero porta 10-30 prezzi in una volta: il tetto deve reggere un paio di scontrini al giorno.
const MAX_PRICE_SUBMITS_PER_DAY = 120;
const MAX_PRICE_EUR = 999;
// Un prezzo oltre questo fattore (sopra o sotto) rispetto alla mediana dei
// prezzi già noti dello stesso prodotto non viene pubblicato da solo: più
// largo di qualsiasi promozione reale, stretto abbastanza da fermare 150 € al
// posto di 1,50 €.
const OUTLIER_FACTOR = 4;
const MAX_PRICE_AGE_DAYS = 30;

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Limite giornaliero per utente (giorno civile italiano, come il credito AI):
// un contatore in users/{uid}/{collection}/{giorno}, scrivibile solo da qui.
async function bumpDailyCounter(
  db: FirebaseFirestore.Firestore, uid: string, collection: string, max: number, message: string,
): Promise<void> {
  const ref = db.collection('users').doc(uid).collection(collection).doc(todayKeyRome());
  await db.runTransaction(async (tx: Transaction) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? ((snap.data()?.count as number) ?? 0) : 0;
    if (count >= max) throw new HttpsError('resource-exhausted', message);
    tx.set(ref, { count: count + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

export const submitPrice = onCall(
  { region: 'europe-west1', cors: true },
  async (request) => {
    const uid = requireUid(request);

    const barcode = String(request.data?.barcode ?? '').trim();
    if (!/^\d{8,14}$/.test(barcode)) throw new HttpsError('invalid-argument', 'Codice a barre non valido');

    const price = Number(request.data?.price);
    if (!Number.isFinite(price) || price < 0.01 || price > MAX_PRICE_EUR) {
      throw new HttpsError('invalid-argument', 'Prezzo non valido');
    }
    const priceCents = Math.round(price * 100);

    const chain = requireString(request.data?.store?.chain, 'Catena', 30);
    const city = requireString(request.data?.store?.city, 'Comune', 60);
    const storeName = String(request.data?.store?.name ?? '').trim().slice(0, 60);
    const chainSlug = slug(chain);
    const cityKey = slug(city);
    if (!chainSlug || !cityKey) throw new HttpsError('invalid-argument', 'Negozio non valido');
    const storeId = [chainSlug, cityKey, slug(storeName)].filter(Boolean).join('--');

    // La data del prezzo è quella in cui l'utente l'ha visto: mai nel futuro,
    // e non più vecchia di un mese (oltre non è più una rilevazione utile).
    const observedAt = new Date(requireString(request.data?.observedAt, 'Data', 30));
    const now = Date.now();
    if (Number.isNaN(observedAt.getTime()) || observedAt.getTime() > now + 3600_000
      || observedAt.getTime() < now - MAX_PRICE_AGE_DAYS * 86400_000) {
      throw new HttpsError('invalid-argument', 'Data non valida');
    }

    const productName = String(request.data?.productName ?? '').trim().slice(0, 120);
    const db = getFirestore();

    await bumpDailyCounter(db, uid, 'priceSubmits', MAX_PRICE_SUBMITS_PER_DAY,
      'Hai inviato molti prezzi oggi. Riprova domani.');

    const latestCol = db.collection('latestPrices');
    const known = await latestCol.where('barcode', '==', barcode).limit(50).get();
    const knownCents = known.docs
      .map((d) => d.data().priceCents as number)
      .filter((c) => typeof c === 'number')
      .sort((a, b) => a - b);

    let suspicious = false;
    if (knownCents.length > 0) {
      const mid = Math.floor(knownCents.length / 2);
      const median = knownCents.length % 2 ? knownCents[mid] : (knownCents[mid - 1] + knownCents[mid]) / 2;
      suspicious = priceCents > median * OUTLIER_FACTOR || priceCents < median / OUTLIER_FACTOR;
    }

    const obsRef = db.collection('priceObservations').doc();
    const storeRef = db.collection('stores').doc(storeId);
    const latestRef = latestCol.doc(`${barcode}_${storeId}`);
    const observedTs = observedAt;

    await db.runTransaction(async (tx: Transaction) => {
      const latestSnap = await tx.get(latestRef);

      tx.set(obsRef, {
        barcode, storeId, priceCents, observedAt: observedTs, source: 'USER',
        status: suspicious ? 'SUSPICIOUS' : 'COMMUNITY',
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(db.collection('priceSubmissions').doc(obsRef.id), {
        uid, barcode, storeId, priceCents, suspicious, createdAt: FieldValue.serverTimestamp(),
      });
      if (suspicious) return;

      tx.set(storeRef, { chain, name: storeName, city, cityKey, createdAt: FieldValue.serverTimestamp() }, { merge: true });

      const prev = latestSnap.exists ? latestSnap.data()! : null;
      const prevAt = prev ? (prev.observedAt as FirebaseFirestore.Timestamp).toMillis() : 0;
      // Un'osservazione più vecchia di quella già nota non sovrascrive il
      // "prezzo attuale": resta solo nello storico.
      if (prev && observedAt.getTime() < prevAt) return;

      // Stesso prezzo già segnalato per questo negozio = conferma.
      const confirmations = prev && prev.priceCents === priceCents ? ((prev.confirmations as number) ?? 1) + 1 : 1;
      tx.set(latestRef, {
        barcode, storeId, chain, storeName, city, cityKey,
        productName: productName || (prev?.productName as string) || '',
        priceCents, observedAt: observedTs, confirmations, source: 'USER',
        updatedAt: FieldValue.serverTimestamp(),
      });
    });

    return { status: suspicious ? 'held' : 'published', storeId };
  },
);

// -----------------------------------------------------------------------
// Open Prices
// -----------------------------------------------------------------------
// Prezzi di Open Food Facts (open-prices), cercati entro un raggio dal comune
// scelto dall'utente. Restano un dataset a parte (licenza ODbL): non vengono
// mai scritti in latestPrices, il client li mostra etichettati come "Open
// Prices". La funzione fa da cache: l'API pubblica non va martellata dai
// client, e il geocoding del comune (Nominatim, 1 richiesta/s) si fa una volta.
// -----------------------------------------------------------------------

const OP_API = 'https://prices.openfoodfacts.org/api/v1/prices';
const NOMINATIM_API = 'https://nominatim.openstreetmap.org/search';
const OP_USER_AGENT = 'Shelfy/1.0 (https://shelfy-app.it)';
const OP_RADII_KM = [5, 15, 30, 50];
const OP_MAX_BARCODES = 30;
const OP_CACHE_MS = 24 * 3600_000;
const OP_MAX_AGE_DAYS = 180;
const OP_PAGE_SIZE = 100;
const OP_MAX_PAGES = 3;
const MAX_OPEN_PRICES_CALLS_PER_DAY = 200;

interface OpenPriceItem {
  barcode: string;
  osmId: number;
  chain: string;
  city: string;
  priceCents: number;
  observedAt: string;
  distanceKm: number;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * rad) / 2) ** 2
    + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

async function geocodeCity(
  db: FirebaseFirestore.Firestore, city: string, cityKey: string,
): Promise<{ lat: number; lon: number } | null> {
  const ref = db.collection('geocodeCache').doc(cityKey);
  const cached = await ref.get();
  if (cached.exists) {
    const d = cached.data()!;
    return { lat: d.lat as number, lon: d.lon as number };
  }
  const url = `${NOMINATIM_API}?format=jsonv2&limit=5&countrycodes=it&q=${encodeURIComponent(city)}`;
  const res = await fetch(url, { headers: { 'User-Agent': OP_USER_AGENT } });
  if (!res.ok) throw new HttpsError('unavailable', 'Ricerca del comune non disponibile');
  const rows = (await res.json()) as { lat?: string; lon?: string; addresstype?: string }[];
  // "Pisa" restituisce prima la provincia (30 km più a sud del centro): si
  // preferisce il risultato che è un abitato, non un'area amministrativa.
  const place = rows.find((r) => ['city', 'town', 'village', 'municipality', 'hamlet', 'suburb'].includes(r.addresstype ?? ''))
    ?? rows[0];
  const lat = Number(place?.lat);
  const lon = Number(place?.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  await ref.set({ lat, lon, city, createdAt: FieldValue.serverTimestamp() });
  return { lat, lon };
}

// Un prezzo per (prodotto, negozio): l'ultimo, perché l'API li restituisce
// dal più recente. I prezzi al chilo/litro (merce sfusa) e quelli senza data
// o valuta non sono confrontabili con il prezzo a confezione e si scartano.
async function fetchOpenPrices(
  barcodes: string[], lat: number, lon: number, radiusKm: number,
): Promise<OpenPriceItem[]> {
  const since = new Date(Date.now() - OP_MAX_AGE_DAYS * 86400_000).toISOString().slice(0, 10);
  const out: OpenPriceItem[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= OP_MAX_PAGES; page++) {
    const params = new URLSearchParams({
      product_code__in: barcodes.join(','),
      lat: String(lat), lon: String(lon), radius_km: String(radiusKm),
      currency: 'EUR', date__gte: since,
      order_by: '-date', size: String(OP_PAGE_SIZE), page: String(page),
    });
    const res = await fetch(`${OP_API}?${params}`, { headers: { 'User-Agent': OP_USER_AGENT } });
    if (!res.ok) throw new HttpsError('unavailable', 'Open Prices non disponibile');
    const body = (await res.json()) as { items?: any[] };
    const rows = body.items ?? [];
    for (const r of rows) {
      const l = r.location;
      const price = Number(r.price);
      if (!l || !r.date || !Number.isFinite(price) || price <= 0) continue;
      if (r.price_per && r.price_per !== 'UNIT') continue;
      const key = `${r.product_code}_${l.osm_id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        barcode: String(r.product_code),
        osmId: Number(l.osm_id),
        chain: String(l.osm_brand || l.osm_name || '').slice(0, 40),
        city: String(l.osm_address_city ?? '').slice(0, 60),
        priceCents: Math.round(price * 100),
        observedAt: new Date(r.date).toISOString(),
        distanceKm: Math.round(haversineKm(lat, lon, Number(l.osm_lat), Number(l.osm_lon)) * 10) / 10,
      });
    }
    if (rows.length < OP_PAGE_SIZE) break;
  }
  return out;
}

export const getOpenPrices = onCall(
  { region: 'europe-west1', cors: true },
  async (request) => {
    const uid = requireUid(request);

    const raw = Array.isArray(request.data?.barcodes) ? request.data.barcodes : [];
    const barcodes: string[] = Array.from(new Set<string>(
      raw.map((b: unknown) => String(b).trim()).filter((b: string) => /^\d{8,14}$/.test(b)),
    )).slice(0, OP_MAX_BARCODES);
    if (barcodes.length === 0) return { items: [] };

    const city = requireString(request.data?.city, 'Comune', 60);
    const cityKey = slug(city);
    if (!cityKey) throw new HttpsError('invalid-argument', 'Comune non valido');
    const asked = Number(request.data?.radiusKm);
    const radiusKm = OP_RADII_KM.find((r) => r >= asked) ?? OP_RADII_KM[OP_RADII_KM.length - 1];

    const db = getFirestore();
    const cacheCol = db.collection('openPricesCache');
    const docId = (b: string) => `${b}__${cityKey}__${radiusKm}`;

    // Prima la cache (24 h): si chiama l'API solo per i barcode non ancora noti.
    const snaps = await db.getAll(...barcodes.map((b) => cacheCol.doc(docId(b))));
    const fresh = new Map<string, OpenPriceItem[]>();
    for (const s of snaps) {
      const d = s.data();
      if (d && Date.now() - (d.fetchedAt as number) < OP_CACHE_MS) {
        fresh.set(d.barcode as string, d.items as OpenPriceItem[]);
      }
    }

    const missing = barcodes.filter((b) => !fresh.has(b));
    if (missing.length > 0) {
      await bumpDailyCounter(db, uid, 'openPricesCalls', MAX_OPEN_PRICES_CALLS_PER_DAY,
        'Troppe ricerche oggi. Riprova domani.');
      const where = await geocodeCity(db, city, cityKey);
      if (!where) throw new HttpsError('invalid-argument', 'Comune non trovato');

      const found = await fetchOpenPrices(missing, where.lat, where.lon, radiusKm);
      const batch = db.batch();
      for (const b of missing) {
        const items = found.filter((i) => i.barcode === b);
        fresh.set(b, items);
        // Anche "nessun prezzo" si memorizza, così non si richiede a ogni apertura.
        batch.set(cacheCol.doc(docId(b)), { barcode: b, items, fetchedAt: Date.now() });
      }
      await batch.commit();
    }

    return { items: barcodes.flatMap((b) => fresh.get(b) ?? []) };
  },
);

// -----------------------------------------------------------------------
// Catalogo Shelfy
// -----------------------------------------------------------------------
// Prodotti con un codice a barre che Open Food Facts non conosce, inseriti da
// chi li ha scansionati: da quel momento li trova chiunque scansioni lo stesso
// codice, e possono avere un prezzo. È un dataset a sé, mai mescolato ai dati
// di Open Food Facts (licenza ODbL). Il documento pubblico non ha l'autore:
// quello sta in catalogSubmissions, solo per l'admin.
//
// Il primo inserimento vince: un secondo invio per lo stesso codice non
// sovrascrive nulla e restituisce il prodotto già presente, così nessuno può
// rinominare l'articolo di qualcun altro. Le correzioni passano dall'admin.
// -----------------------------------------------------------------------

const MAX_CATALOG_SUBMITS_PER_DAY = 30;

function cleanText(value: unknown, maxLen: number): string {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

export const submitCatalogProduct = onCall(
  { region: 'europe-west1', cors: true },
  async (request) => {
    const uid = requireUid(request);

    const barcode = String(request.data?.barcode ?? '').trim();
    if (!/^\d{8,14}$/.test(barcode)) throw new HttpsError('invalid-argument', 'Codice a barre non valido');

    const name = cleanText(request.data?.name, 120);
    // Almeno due caratteri e non solo cifre/simboli: un nome così non aiuta
    // nessuno a riconoscere il prodotto.
    if (name.length < 2 || !/\p{L}/u.test(name)) throw new HttpsError('invalid-argument', 'Nome del prodotto non valido');
    const brand = cleanText(request.data?.brand, 60);
    const qty = cleanText(request.data?.qty, 30);

    const db = getFirestore();
    const ref = db.collection('catalogProducts').doc(barcode);

    // Già presente: nessun conteggio nel limite, nessuna scrittura.
    const existing = await ref.get();
    if (existing.exists) {
      const d = existing.data()!;
      return { created: false, name: d.name as string, brand: (d.brand as string) ?? '', qty: (d.qty as string) ?? '' };
    }

    await bumpDailyCounter(db, uid, 'catalogSubmits', MAX_CATALOG_SUBMITS_PER_DAY,
      'Hai aggiunto molti prodotti oggi. Riprova domani.');

    return db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(ref);
      if (snap.exists) {
        const d = snap.data()!;
        return { created: false, name: d.name as string, brand: (d.brand as string) ?? '', qty: (d.qty as string) ?? '' };
      }
      tx.set(ref, { barcode, name, brand, qty, source: 'USER', createdAt: FieldValue.serverTimestamp() });
      tx.set(db.collection('catalogSubmissions').doc(barcode), {
        uid, barcode, name, brand, qty, createdAt: FieldValue.serverTimestamp(),
      });
      return { created: true, name, brand, qty };
    });
  },
);
