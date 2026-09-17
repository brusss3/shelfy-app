import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Transaction } from 'firebase-admin/firestore';

initializeApp();

const GROQ_API_KEY = defineSecret('GROQ_API_KEY');

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

    const usageRef = db.collection('users').doc(uid).collection('aiUsage').doc(todayKeyRome());

    // Prenota il credito PRIMA di chiamare Groq: due richieste in parallelo non
    // possono generare due ricette. Se poi Groq fallisce la prenotazione viene
    // rilasciata, così un errore non brucia la generazione del giorno.
    await db.runTransaction(async (tx: Transaction) => {
      const snap = await tx.get(usageRef);
      if (snap.exists) {
        throw new HttpsError('resource-exhausted', 'Hai già generato la ricetta di oggi');
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
