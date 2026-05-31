import { Product, Recipe } from '@/types';
import { daysTo } from '@/lib/urgency';

const GROQ_API_KEY = 'ROTATED_REMOVED_FROM_HISTORY';

const TINTS = ['#e6efde','#f1ede0','#f3e9e0','#f4e9c8','#e8dcc6','#eceee5','#f4dad0','#e6dfd1'];

export async function generateRecipe(products: Product[], selectedIngredients: string[]): Promise<Recipe> {
  if (!GROQ_API_KEY) throw new Error('Chiave API Groq mancante. Registrati su console.groq.com e inseriscila in lib/recipeAI.ts');

  const randomSeed = Math.floor(Math.random() * 1000);

  const selectedWithExpiry = selectedIngredients.map((name) => {
    const p = products.find((pp) => pp.name === name);
    const days = p ? daysTo(p.expiry) : null;
    return days !== null ? `${name} (scade in ${days === 0 ? 'oggi' : days < 0 ? 'scaduto' : `${days}g`})` : name;
  });

  const prompt = `Sei uno chef italiano esperto nella cucina tradizionale italiana. (seed: ${randomSeed})

Ho scelto questi ingredienti per cucinare: ${selectedWithExpiry.join(', ')}.

Genera UNA SOLA ricetta italiana CLASSICA e REALE (es: pasta al pomodoro, risotto ai funghi, frittata di zucchine, minestrone, saltimbocca, cacio e pepe, ecc.).
La ricetta DEVE esistere nella tradizione culinaria italiana. NON inventare combinazioni insolite o nomi fantasiosi.
Usa PRINCIPALMENTE gli ingredienti forniti. Puoi aggiungere sale, pepe, olio d'oliva, aglio, cipolla se necessario.
I passi devono essere pratici e dettagliati.

Rispondi SOLO con un singolo oggetto JSON valido, senza testo extra:
{
  "id": "r${randomSeed}",
  "title": "Nome ricetta tradizionale italiana",
  "time": "20 min",
  "difficulty": "Facile",
  "desc": "Descrizione appetitosa in 1-2 frasi",
  "uses": ["ingrediente1", "ingrediente2"],
  "steps": ["Passo 1 dettagliato.", "Passo 2 dettagliato.", "Passo 3 dettagliato."],
  "tag": "categoria",
  "tint": "${TINTS[randomSeed % TINTS.length]}"
}`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Errore API Groq: ${res.status}`);
  }

  const data = await res.json();
  const text: string = data.choices?.[0]?.message?.content ?? '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Risposta AI non valida — riprova');

  const raw = JSON.parse(jsonMatch[0]);
  return {
    ...raw,
    id: raw.id ?? `ai-${randomSeed}`,
    tint: raw.tint ?? TINTS[randomSeed % TINTS.length],
  };
}
