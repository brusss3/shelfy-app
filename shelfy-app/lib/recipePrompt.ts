import i18n from '@/lib/i18n';
import { MyRecipe, RecipeIngredient } from '@/types';

// Ricette "AI" senza chiamare API esterne: l'app prepara un prompt che l'utente
// incolla nel proprio assistente (ChatGPT, Gemini, …) e poi reincolla qui la
// risposta JSON, che viene validata e salvata tra le sue ricette.

export const RECIPE_TINTS = ['#e6efde', '#f1ede0', '#f3e9e0', '#f4e9c8', '#e8dcc6', '#eceee5', '#f4dad0', '#e6dfd1'];
// Valori salvati così come sono in Firestore (anche per gli utenti in inglese):
// devono combaciare con quelli del form di creazione manuale.
export const RECIPE_DIFFICULTIES = ['Facile', 'Media', 'Difficile'] as const;

export const MAX_PROMPT_RECIPES = 3;
// Tetti difensivi sul JSON incollato: il testo arriva da fuori, non ci si fida.
const MAX_IMPORT_RECIPES = 5;
const MAX_INGREDIENTS = 40;
const MAX_STEPS = 30;
const MAX_TEXT = 600;

export type ImportedRecipe = Omit<MyRecipe, 'id' | 'published' | 'publishedRecipeId' | 'createdAt'>;

export function buildRecipePrompt(ingredients: string[], count: number): string {
  const n = Math.min(Math.max(count, 1), MAX_PROMPT_RECIPES);
  return i18n.t('recipePrompt.template', {
    what: i18n.t('recipePrompt.recipeCount', { count: n }),
    ingredients: ingredients.map((name) => `- ${name}`).join('\n'),
    schema: JSON.stringify({
      recipes: [{
        title: '…',
        desc: '…',
        time: '20 min',
        // Nella lingua dell'utente: normalizeDifficulty le riporta ai valori salvati.
        difficulty: i18n.t('recipePrompt.difficultyValues'),
        tag: '…',
        ingredients: [{ name: '…', qty: '…' }],
        steps: ['…', '…'],
      }],
    }, null, 2),
  });
}

export class RecipeImportError extends Error {}

function clip(value: unknown, max = MAX_TEXT): string {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function normalizeDifficulty(value: unknown): string {
  const v = clip(value).toLowerCase();
  if (/(facil|easy|semplic)/.test(v)) return 'Facile';
  if (/(diffic|hard|complex)/.test(v)) return 'Difficile';
  return 'Media';
}

function normalizeTime(value: unknown): string {
  if (typeof value === 'number' && value > 0) return `${Math.round(value)} min`;
  return clip(value, 40) || '20 min';
}

function normalizeIngredient(raw: unknown): RecipeIngredient | null {
  // Alcuni assistenti rispondono con semplici stringhe ("200 g di pasta").
  if (typeof raw === 'string') {
    const name = clip(raw, 120);
    return name ? { name, qty: '' } : null;
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const name = clip(o.name ?? o.nome ?? o.ingredient, 120);
    const qty = clip(o.qty ?? o.quantity ?? o.quantita ?? o.quantità, 60);
    return name ? { name, qty } : null;
  }
  return null;
}

function normalizeStep(raw: unknown): string {
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return clip(o.text ?? o.step ?? o.description);
  }
  return clip(raw);
}

function normalizeRecipe(raw: unknown, index: number): ImportedRecipe {
  const fail = (key: string): never => {
    throw new RecipeImportError(i18n.t(`recipeImport.errors.${key}`, { n: index + 1 }));
  };
  if (!raw || typeof raw !== 'object') fail('notObject');
  const o = raw as Record<string, unknown>;

  const title = clip(o.title ?? o.titolo, 120);
  if (!title) fail('missingTitle');

  const rawIngredients = Array.isArray(o.ingredients) ? o.ingredients : Array.isArray(o.ingredienti) ? o.ingredienti : [];
  const ingredients = rawIngredients
    .slice(0, MAX_INGREDIENTS)
    .map(normalizeIngredient)
    .filter((i): i is RecipeIngredient => i !== null);
  if (ingredients.length === 0) fail('missingIngredients');

  const rawSteps = Array.isArray(o.steps) ? o.steps : Array.isArray(o.procedimento) ? o.procedimento : [];
  const steps = rawSteps.slice(0, MAX_STEPS).map(normalizeStep).filter((s) => s.length > 0);
  if (steps.length === 0) fail('missingSteps');

  const difficulty = normalizeDifficulty(o.difficulty ?? o.difficolta ?? o.difficoltà);
  return {
    title,
    desc: clip(o.desc ?? o.description ?? o.descrizione, 300),
    time: normalizeTime(o.time ?? o.tempo),
    difficulty,
    tag: clip(o.tag, 40) || difficulty,
    tint: RECIPE_TINTS[Math.floor(Math.random() * RECIPE_TINTS.length)],
    ingredients,
    steps,
    source: 'ai',
  };
}

// Tollera quello che gli assistenti aggiungono attorno al JSON: blocchi
// ```json, frasi introduttive, un oggetto singolo invece dell'array.
export function parseRecipeJson(text: string): ImportedRecipe[] {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  const start = cleaned.search(/[[{]/);
  const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (start === -1) throw new RecipeImportError(i18n.t('recipeImport.errors.noJson'));
  // Inizio senza fine: risposta copiata a metà.
  if (end <= start) throw new RecipeImportError(i18n.t('recipeImport.errors.invalidJson'));

  let data: unknown;
  try {
    data = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    throw new RecipeImportError(i18n.t('recipeImport.errors.invalidJson'));
  }

  const list = Array.isArray(data)
    ? data
    : data && typeof data === 'object' && Array.isArray((data as Record<string, unknown>).recipes)
      ? (data as { recipes: unknown[] }).recipes
      : [data];
  if (list.length === 0) throw new RecipeImportError(i18n.t('recipeImport.errors.empty'));

  return list.slice(0, MAX_IMPORT_RECIPES).map(normalizeRecipe);
}
