// Iniziali per le tile prodotto/ricetta (es. "Pasta (Pennette)" → "PP").
// Ripulisce prima punteggiatura/simboli, altrimenti una parentesi o un
// trattino finiscono presi come "prima lettera" di una parola (es. "P(").
export function getInitials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
