// Shelfy mock data
(function() {
  const today = new Date();
  const day = 24 * 60 * 60 * 1000;
  const inDays = (n) => new Date(today.getTime() + n * day).toISOString().slice(0, 10);

  const products = [
    // Frigo
    { id: 'p1', name: 'Latte intero', brand: 'Granarolo', qty: '1 L',  zone: 'frigo',    category: 'Latticini',  expiry: inDays(2),  added: inDays(-5), barcode: '8001100013500', tint: '#eef3ec', cal: 65 },
    { id: 'p2', name: 'Yogurt greco', brand: 'Fage',       qty: '500 g', zone: 'frigo',  category: 'Latticini',  expiry: inDays(1),  added: inDays(-3), barcode: '5201054001234', tint: '#f1ede0', cal: 98 },
    { id: 'p3', name: 'Spinaci freschi', brand: 'Bonduelle', qty: '250 g', zone: 'frigo', category: 'Verdura',  expiry: inDays(0),  added: inDays(-4), barcode: '3083680072145', tint: '#e6efde', cal: 23 },
    { id: 'p4', name: 'Pollo a fette', brand: 'AIA',       qty: '400 g', zone: 'frigo',  category: 'Carne',     expiry: inDays(3),  added: inDays(-2), barcode: '8003030210018', tint: '#f3e9e0', cal: 165 },
    { id: 'p5', name: 'Parmigiano 24 mesi', brand: 'Reggiano DOP', qty: '300 g', zone: 'frigo', category: 'Latticini', expiry: inDays(28), added: inDays(-10), barcode: '8016291006478', tint: '#f6f0dc', cal: 392 },
    { id: 'p6', name: 'Pomodori ciliegia', brand: 'BIO',  qty: '500 g', zone: 'frigo',  category: 'Verdura',   expiry: inDays(4),  added: inDays(-2), barcode: '8000500215890', tint: '#f4e2dc', cal: 18 },
    { id: 'p7', name: 'Uova fresche x6', brand: 'Coop Bio', qty: '6 pz', zone: 'frigo', category: 'Uova',      expiry: inDays(9),  added: inDays(-3), barcode: '8001200456001', tint: '#f6efde', cal: 78 },

    // Freezer
    { id: 'p8', name: 'Piselli surgelati', brand: 'Findus', qty: '750 g', zone: 'freezer', category: 'Verdura', expiry: inDays(180), added: inDays(-20), barcode: '8712100849213', tint: '#e6efde', cal: 81 },
    { id: 'p9', name: 'Filetto di salmone', brand: 'Findus', qty: '400 g', zone: 'freezer', category: 'Pesce',   expiry: inDays(95),  added: inDays(-12), barcode: '8712100123456', tint: '#f3e0d8', cal: 208 },
    { id: 'p10', name: 'Pane in cassetta', brand: 'Mulino Bianco', qty: '500 g', zone: 'freezer', category: 'Pane', expiry: inDays(60), added: inDays(-15), barcode: '8076809513043', tint: '#f5ecdc', cal: 265 },
    { id: 'p11', name: 'Gelato vaniglia', brand: 'Algida',   qty: '500 ml', zone: 'freezer', category: 'Dessert', expiry: inDays(220), added: inDays(-5), barcode: '8002095012345', tint: '#f4ecdc', cal: 207 },

    // Dispensa
    { id: 'p12', name: 'Pasta Penne',      brand: 'Barilla',  qty: '500 g', zone: 'dispensa', category: 'Pasta',  expiry: inDays(420), added: inDays(-30), barcode: '8076809514637', tint: '#f4e9c8', cal: 360 },
    { id: 'p13', name: 'Olio EVO',          brand: 'Monini',  qty: '1 L',   zone: 'dispensa', category: 'Condimenti', expiry: inDays(310), added: inDays(-20), barcode: '8005510121123', tint: '#eaeac2', cal: 884 },
    { id: 'p14', name: 'Pelati San Marzano', brand: 'Mutti',  qty: '400 g', zone: 'dispensa', category: 'Conserve', expiry: inDays(545), added: inDays(-25), barcode: '8005110100018', tint: '#f4dad0', cal: 24 },
    { id: 'p15', name: 'Riso Arborio',      brand: 'Scotti',  qty: '1 kg',  zone: 'dispensa', category: 'Riso',   expiry: inDays(380), added: inDays(-40), barcode: '8001860510014', tint: '#f4ecdc', cal: 358 },
    { id: 'p16', name: 'Caffè macinato',    brand: 'Lavazza', qty: '250 g', zone: 'dispensa', category: 'Bevande', expiry: inDays(150), added: inDays(-15), barcode: '8000070024458', tint: '#e6dfd1', cal: 2 },
    { id: 'p17', name: 'Cioccolato fondente', brand: 'Lindt', qty: '100 g', zone: 'dispensa', category: 'Dolci',  expiry: inDays(95),  added: inDays(-10), barcode: '8003340082745', tint: '#e8dcc6', cal: 539 },
    { id: 'p18', name: 'Farina 00',          brand: 'Caputo', qty: '1 kg',  zone: 'dispensa', category: 'Farine', expiry: inDays(7),   added: inDays(-150), barcode: '8014679000010', tint: '#f4ecdc', cal: 364 },
  ];

  // Recipes — each links to ingredient names; "match" computed against expiring soon
  const recipes = [
    {
      id: 'r1',
      title: 'Frittata di spinaci',
      time: '20 min',
      difficulty: 'Facile',
      tint: '#e6efde',
      uses: ['Spinaci freschi', 'Uova fresche x6', 'Parmigiano 24 mesi'],
      tag: 'Salva 3 ingredienti',
      desc: 'Una frittata morbida che sfrutta gli spinaci e le uova in dispensa.',
      steps: [
        'Sbatti 4 uova con un pizzico di sale e parmigiano grattugiato.',
        'Salta gli spinaci in padella con un filo d\u2019olio.',
        'Versa le uova, copri e cuoci a fuoco basso 6 minuti per lato.',
      ],
    },
    {
      id: 'r2',
      title: 'Pasta al pomodoro fresco',
      time: '25 min',
      difficulty: 'Facile',
      tint: '#f4dad0',
      uses: ['Pomodori ciliegia', 'Pasta Penne', 'Olio EVO'],
      tag: 'Pronta in 25 minuti',
      desc: 'I pomodorini stanno per scadere — qui brillano con basilico e olio EVO.',
      steps: [
        'Taglia i pomodorini a met\u00e0, fai rosolare in olio caldo con aglio.',
        'Cuoci la pasta al dente e salta in padella.',
        'Manteca con parmigiano e basilico fresco.',
      ],
    },
    {
      id: 'r3',
      title: 'Yogurt bowl con miele',
      time: '5 min',
      difficulty: 'Velocissima',
      tint: '#f1ede0',
      uses: ['Yogurt greco'],
      tag: 'Pronta in 5 min',
      desc: 'Il modo pi\u00f9 veloce per finire lo yogurt prima di domani.',
      steps: [
        'Versa lo yogurt in una ciotola.',
        'Aggiungi miele, granola e frutta secca.',
        'Gusta subito.',
      ],
    },
    {
      id: 'r4',
      title: 'Pollo al limone',
      time: '30 min',
      difficulty: 'Media',
      tint: '#f3e9e0',
      uses: ['Pollo a fette', 'Olio EVO'],
      tag: 'Cena leggera',
      desc: 'Petto di pollo marinato e cotto in padella.',
      steps: [
        'Marina il pollo con succo di limone, olio, sale e timo (10\u2032).',
        'Cuoci in padella ben calda 4 minuti per lato.',
        'Sfuma con altro limone e servi caldo.',
      ],
    },
    {
      id: 'r5',
      title: 'Risotto al parmigiano',
      time: '35 min',
      difficulty: 'Media',
      tint: '#f6f0dc',
      uses: ['Riso Arborio', 'Parmigiano 24 mesi'],
      tag: 'Comfort food',
      desc: 'Cremoso, ricco, perfetto per le sere d\u2019autunno.',
      steps: [
        'Tosta il riso, sfuma con vino bianco.',
        'Aggiungi brodo poco a poco mescolando.',
        'A fine cottura manteca con burro e parmigiano.',
      ],
    },
  ];

  // Returns days remaining until expiry (negative = past)
  function daysTo(iso) {
    const ms = new Date(iso).getTime() - new Date(new Date().toDateString()).getTime();
    return Math.round(ms / day);
  }

  window.SHELFY_DATA = { products, recipes, daysTo, today };
})();
