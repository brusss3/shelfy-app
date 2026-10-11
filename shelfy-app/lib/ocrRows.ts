// Ricostruisce le righe di uno scontrino dalle coordinate dei frammenti OCR.
// Gli OCR leggono per blocchi: su uno scontrino a colonne emettono prima tutta
// la colonna dei nomi e poi tutta la colonna dei prezzi, perdendo l'abbinamento
// riga per riga. Qui i frammenti vengono raggruppati per altezza (y) e ordinati
// per x, così "LATTE" e "1,20" tornano sulla stessa riga.

export interface OcrBox {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

export function rowsFromBoxes(boxes: OcrBox[]): string {
  const valid = boxes.filter(
    (b) => b.text?.trim() && [b.left, b.top, b.width, b.height].every(Number.isFinite),
  );
  if (valid.length === 0) return '';

  const heights = valid.map((b) => b.height).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] || 1;
  const tolerance = medianH * 0.6;

  const sorted = [...valid].sort((a, b) => a.top + a.height / 2 - (b.top + b.height / 2));
  const rows: { cy: number; items: OcrBox[] }[] = [];
  for (const b of sorted) {
    const cy = b.top + b.height / 2;
    const row = rows[rows.length - 1];
    if (row && Math.abs(cy - row.cy) <= tolerance) {
      row.items.push(b);
      row.cy = row.items.reduce((s, i) => s + i.top + i.height / 2, 0) / row.items.length;
    } else {
      rows.push({ cy, items: [b] });
    }
  }

  return rows
    .map((r) =>
      r.items
        .sort((a, b) => a.left - b.left)
        .map((i) => i.text.trim())
        .join(' '),
    )
    .join('\n');
}
