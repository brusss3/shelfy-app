// Genera l'HTML di un foglio A4 di etichette HACCP stampabili: data/ora di
// confezionamento e scadenza gia' compilate, una riga vuota per il nome del
// prodotto da scrivere a mano. Condiviso tra la stampa nativa (expo-print)
// e l'apertura in una nuova scheda su web.

import i18n from '@/lib/i18n';

function formatDateTime(d: Date): { date: string; time: string } {
  const locale = i18n.language === 'it' ? 'it-IT' : 'en-US';
  const date = d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return { date, time };
}

export interface LabelSheetParams {
  packagingDate: Date;
  expiryDate: Date;
  copies: number;
}

const COLUMNS = 3;
const ROWS = 7;
const PER_SHEET = COLUMNS * ROWS;

export function buildLabelsHtml({ packagingDate, expiryDate, copies }: LabelSheetParams): string {
  const packaging = formatDateTime(packagingDate);
  const expiry = formatDateTime(expiryDate);

  const packagedLabel = i18n.t('labels.packaged');
  const expiresLabel = i18n.t('labels.expires');

  const labelHtml = `
    <div class="label">
      <div class="nameLine">&nbsp;</div>
      <div class="row"><span class="k">${packagedLabel}</span><span class="v">${packaging.date} · ${packaging.time}</span></div>
      <div class="row expiry"><span class="k">${expiresLabel}</span><span class="v">${expiry.date} · ${expiry.time}</span></div>
    </div>
  `;

  const sheets = Math.ceil(copies / PER_SHEET);
  let sheetsHtml = '';
  let remaining = copies;
  for (let s = 0; s < sheets; s++) {
    const onThisSheet = Math.min(PER_SHEET, remaining);
    remaining -= onThisSheet;
    const cells = Array.from({ length: onThisSheet }, () => labelHtml).join('');
    sheetsHtml += `<div class="sheet">${cells}</div>`;
  }

  return `
<!DOCTYPE html>
<html lang="${i18n.language}">
<head>
<meta charset="utf-8" />
<title>${i18n.t('labels.printTitle')}</title>
<style>
  @page { size: A4; margin: 10mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, Helvetica, Arial, sans-serif; }
  .sheet {
    display: grid;
    grid-template-columns: repeat(${COLUMNS}, 1fr);
    grid-template-rows: repeat(${ROWS}, 1fr);
    gap: 2.5mm;
    width: 190mm;
    height: 277mm;
    page-break-after: always;
  }
  .sheet:last-child { page-break-after: auto; }
  .label {
    border: 0.3mm dashed #999;
    border-radius: 2mm;
    padding: 3mm 4mm;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 1.5mm;
  }
  .nameLine {
    border-bottom: 0.3mm solid #333;
    height: 5mm;
    margin-bottom: 1mm;
  }
  .row { display: flex; justify-content: space-between; font-size: 8.5pt; color: #222; }
  .row.expiry { font-weight: 700; }
  .k { color: #666; }
  .v { font-variant-numeric: tabular-nums; }
</style>
</head>
<body>
${sheetsHtml}
</body>
</html>
  `;
}
