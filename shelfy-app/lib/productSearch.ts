// Ricerca testuale su Open Food Facts per la lista della spesa. Per i prodotti
// confezionati dà nome, marca e formato (e il barcode, che serve poi a
// riconoscere lo stesso articolo); per il resto la lista accetta testo libero.
//
// Open Food Facts limita la ricerca testuale a circa 10 richieste al minuto:
// chi chiama deve fare debounce e non lanciare una ricerca a ogni tasto.

export interface ProductSuggestion {
  barcode: string;
  name: string;
  brand: string;
  qty: string;
}

export async function searchProducts(text: string, signal?: AbortSignal): Promise<ProductSuggestion[]> {
  const q = text.trim();
  if (q.length < 3) return [];
  try {
    const params = new URLSearchParams({
      search_terms: q,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: '8',
      fields: 'code,product_name,product_name_it,brands,quantity',
      lc: 'it',
      // Prima i più scansionati, e solo prodotti venduti in Italia.
      sort_by: 'unique_scans_n',
      tagtype_0: 'countries',
      tag_contains_0: 'contains',
      tag_0: 'italy',
    });
    const res = await fetch(`https://world.openfoodfacts.org/cgi/search.pl?${params}`, { signal });
    if (!res.ok) return [];
    const data = await res.json();
    const seen = new Set<string>();
    const out: ProductSuggestion[] = [];
    for (const p of data.products ?? []) {
      const name = (p.product_name_it || p.product_name || '').trim();
      if (!name || !p.code || seen.has(p.code)) continue;
      seen.add(p.code);
      out.push({
        barcode: String(p.code),
        name,
        // OFF separa più marchi con la virgola: il primo è quello principale.
        brand: String(p.brands ?? '').split(',')[0].trim(),
        qty: String(p.quantity ?? '').trim(),
      });
    }
    return out;
  } catch {
    // Offline, limite raggiunto o richiesta annullata: nessun suggerimento,
    // l'utente può sempre aggiungere il testo che ha scritto.
    return [];
  }
}
