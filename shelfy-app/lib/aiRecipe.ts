import { httpsCallable, FunctionsError } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { MyRecipe } from '@/types';

export type AiRecipeResult = Omit<MyRecipe, 'tint' | 'source' | 'published' | 'publishedRecipeId' | 'createdAt'>;

export type AiRecipeErrorKind = 'quota' | 'unavailable' | 'auth' | 'input';

export class AiRecipeError extends Error {
  kind: AiRecipeErrorKind;
  constructor(kind: AiRecipeErrorKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

// La chiave Groq vive solo nella Cloud Function (Secret Manager): il client
// chiama la callable, che verifica l'utente e applica il limite giornaliero.
export async function generateDailyRecipe(ingredients: string[]): Promise<AiRecipeResult> {
  const call = httpsCallable<{ ingredients: string[] }, AiRecipeResult>(functions, 'generateDailyRecipe');
  try {
    const res = await call({ ingredients });
    return res.data;
  } catch (e) {
    const code = (e as FunctionsError)?.code ?? '';
    if (code.includes('resource-exhausted')) {
      // Il messaggio arriva dalla function: sa se il credito era giornaliero
      // (Premium) o settimanale (piano base).
      const serverMessage = (e as FunctionsError)?.message;
      throw new AiRecipeError('quota', serverMessage || 'Credito ricette AI esaurito.');
    }
    if (code.includes('unauthenticated')) {
      throw new AiRecipeError('auth', 'Devi accedere per generare una ricetta.');
    }
    if (code.includes('invalid-argument')) {
      throw new AiRecipeError('input', 'Seleziona almeno un ingrediente.');
    }
    throw new AiRecipeError('unavailable', 'AI non disponibile in questo momento. Riprova più tardi.');
  }
}
