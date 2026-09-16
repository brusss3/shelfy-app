// Schiarisce/scurisce un esadecimale mescolandolo con bianco o nero.
// Serve a ricavare la sfumatura di un colore già esistente (es. il tint di
// categoria di un prodotto) senza doverne definire due a mano per ognuno.
function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

/** `amount` 0..1 — quanto avvicinare il colore al bianco. */
export function lighten(hex: string, amount: number): string {
  const [r, g, b] = parse(hex);
  return toHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** `amount` 0..1 — quanto avvicinare il colore al nero. */
export function darken(hex: string, amount: number): string {
  const [r, g, b] = parse(hex);
  return toHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
}
