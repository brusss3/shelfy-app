// Carica le ricette editoriali di Shelfy (recipes.ts) nella collezione
// Firestore `communityRecipes`.
//
// Uso (dalla cartella dell'app, Node >= 22.6):
//   node --experimental-strip-types scripts/seed-recipes/seed.mjs            -> dry-run (default)
//   node --experimental-strip-types scripts/seed-recipes/seed.mjs --verbose  -> dry-run con i documenti completi
//   node --experimental-strip-types scripts/seed-recipes/seed.mjs --write    -> scrive davvero
//
// Opzioni: --project <id> per forzare il progetto (default: "default" di .firebaserc).
// Credenziali: Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS
// oppure `gcloud auth application-default login`). Se FIRESTORE_EMULATOR_HOST è
// impostata, firebase-admin scrive sull'emulatore.
//
// Idempotente: gli id dei documenti sono fissi (shelfy-<slug>). Su un documento
// già esistente aggiorna solo i contenuti, senza toccare ratingSum, ratingCount
// e createdAt.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEED_RECIPES, SEED_TINTS, SEED_DIFFICULTIES } from './recipes.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(HERE, '..', '..');
const COLLECTION = 'communityRecipes';
const LANGS = ['it', 'en', 'es'];

// Stessi tetti dell'import JSON dell'app (lib/recipePrompt.ts).
const MAX_INGREDIENTS = 40;
const MAX_STEPS = 30;
const MAX_TEXT = 600;
const MAX_DESC = 300;
const MAX_TITLE = 120;
const MAX_TAG = 40;

// ---------------------------------------------------------------------------
// Argomenti
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const write = args.includes('--write');
const verbose = args.includes('--verbose');
if (write && args.includes('--dry-run')) {
  console.error('Usa --write oppure --dry-run, non entrambi.');
  process.exit(1);
}
const projectArgIdx = args.indexOf('--project');
const projectArg = projectArgIdx >= 0 ? args[projectArgIdx + 1] : undefined;

function readDefaultProject() {
  try {
    const rc = JSON.parse(readFileSync(resolve(APP_ROOT, '.firebaserc'), 'utf8'));
    return rc?.projects?.default;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Validazione
// ---------------------------------------------------------------------------

function isText(v, max) {
  return typeof v === 'string' && v.trim().length > 0 && v.length <= max;
}

function validate(recipes) {
  const errors = [];
  const ids = new Set();
  const titles = new Set();

  recipes.forEach((r, i) => {
    const where = `#${i + 1} (${r?.id ?? 'senza id'})`;
    const err = (msg) => errors.push(`${where}: ${msg}`);

    if (typeof r.id !== 'string' || !/^shelfy-[a-z0-9]+(-[a-z0-9]+)*$/.test(r.id)) err('id non valido (atteso shelfy-<slug>)');
    else if (ids.has(r.id)) err('id duplicato');
    else ids.add(r.id);

    if (!LANGS.includes(r.lang)) err(`lang non valida: ${r.lang}`);
    if (!isText(r.title, MAX_TITLE)) err('titolo mancante o troppo lungo');
    else {
      const key = `${r.lang}:${r.title.toLowerCase()}`;
      if (titles.has(key)) err('titolo duplicato nella stessa lingua');
      titles.add(key);
    }
    if (!isText(r.desc, MAX_DESC)) err(`descrizione mancante o oltre ${MAX_DESC} caratteri`);
    if (!isText(r.time, 40)) err('tempo mancante');
    if (!SEED_DIFFICULTIES.includes(r.difficulty)) err(`difficoltà non valida: ${r.difficulty}`);
    if (!isText(r.tag, MAX_TAG)) err('tag mancante o troppo lungo');
    if (!SEED_TINTS.includes(r.tint)) err(`tint fuori palette: ${r.tint}`);

    if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) err('nessun ingrediente');
    else {
      if (r.ingredients.length > MAX_INGREDIENTS) err('troppi ingredienti');
      r.ingredients.forEach((ing, j) => {
        if (!isText(ing?.name, 120)) err(`ingrediente ${j + 1}: nome mancante`);
        if (typeof ing?.qty !== 'string' || ing.qty.length > 60) err(`ingrediente ${j + 1}: quantità non valida`);
      });
    }

    if (!Array.isArray(r.steps) || r.steps.length === 0) err('nessun passaggio');
    else {
      if (r.steps.length > MAX_STEPS) err('troppi passaggi');
      r.steps.forEach((s, j) => {
        if (!isText(s, MAX_TEXT)) err(`passaggio ${j + 1}: vuoto o oltre ${MAX_TEXT} caratteri`);
      });
    }
  });

  return errors;
}

// Campi di contenuto: sono gli unici riscritti su un documento già esistente.
function contentFields(r) {
  return {
    authorId: 'shelfy',
    authorName: 'Shelfy',
    title: r.title,
    desc: r.desc,
    time: r.time,
    difficulty: r.difficulty,
    tag: r.tag,
    tint: r.tint,
    ingredients: r.ingredients.map((i) => ({ name: i.name, qty: i.qty })),
    steps: [...r.steps],
    lang: r.lang,
    seed: true,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const errors = validate(SEED_RECIPES);
if (errors.length > 0) {
  console.error(`Validazione fallita (${errors.length} errori):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const byLang = Object.fromEntries(LANGS.map((l) => [l, SEED_RECIPES.filter((r) => r.lang === l)]));
console.log(`Ricette valide: ${SEED_RECIPES.length} (${LANGS.map((l) => `${l}: ${byLang[l].length}`).join(', ')})`);

const projectId = projectArg ?? process.env.GCLOUD_PROJECT ?? readDefaultProject();
console.log(`Progetto: ${projectId ?? '(non trovato)'}  Collezione: ${COLLECTION}`);
if (process.env.FIRESTORE_EMULATOR_HOST) console.log(`Emulatore: ${process.env.FIRESTORE_EMULATOR_HOST}`);

if (!write) {
  console.log('\nDRY-RUN: nessuna scrittura. Aggiungi --write per scrivere davvero.\n');
  for (const lang of LANGS) {
    console.log(`[${lang}]`);
    for (const r of byLang[lang]) {
      console.log(`  ${r.id.padEnd(34)} ${r.title}  ·  ${r.time} · ${r.difficulty} · ${r.tag} · ${r.ingredients.length} ingr. · ${r.steps.length} passaggi`);
      if (verbose) console.log(JSON.stringify(contentFields(r), null, 2).replace(/^/gm, '    '));
    }
  }
  console.log('\nSui nuovi documenti verranno aggiunti anche ratingSum: 0, ratingCount: 0 e createdAt (Timestamp).');
  process.exit(0);
}

if (!projectId) {
  console.error('Project id non trovato: passa --project <id>.');
  process.exit(1);
}

// firebase-admin è installato solo in functions/node_modules.
const requireFromFunctions = createRequire(resolve(APP_ROOT, 'functions', 'package.json'));
const { initializeApp, applicationDefault } = requireFromFunctions('firebase-admin/app');
const { getFirestore, Timestamp } = requireFromFunctions('firebase-admin/firestore');

initializeApp(
  process.env.FIRESTORE_EMULATOR_HOST
    ? { projectId }
    : { credential: applicationDefault(), projectId },
);
const db = getFirestore();

const refs = SEED_RECIPES.map((r) => db.collection(COLLECTION).doc(r.id));
const snaps = await db.getAll(...refs);

// createdAt come Timestamp, come fa l'app con serverTimestamp(): la lista è
// ordinata per createdAt e mescolare stringhe e Timestamp romperebbe l'ordine.
// Un minuto di scarto tra una ricetta e l'altra mantiene stabile l'ordinamento.
const baseMs = Date.now();
const batch = db.batch();
let created = 0;
let updated = 0;

SEED_RECIPES.forEach((r, i) => {
  const fields = contentFields(r);
  if (snaps[i].exists) {
    batch.set(refs[i], fields, { merge: true });
    updated += 1;
  } else {
    batch.set(refs[i], {
      ...fields,
      ratingSum: 0,
      ratingCount: 0,
      createdAt: Timestamp.fromMillis(baseMs - i * 60_000),
    });
    created += 1;
  }
});

await batch.commit();
console.log(`\nFatto: ${created} create, ${updated} aggiornate in ${projectId}/${COLLECTION}.`);
