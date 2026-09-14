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
