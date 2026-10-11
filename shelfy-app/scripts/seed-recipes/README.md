# Seed ricette Shelfy

Carica in Firestore (`communityRecipes`) 45 ricette tradizionali firmate "Shelfy":
25 in italiano, 10 in inglese, 10 in spagnolo, con preferenza per i piatti di recupero.

- `recipes.ts` — i dati (testi scritti da noi, niente copia da siti o libri).
- `seed.mjs` — lo script: valida tutte le ricette e, solo con `--write`, le scrive.

## Requisiti

- Node 22.6 o superiore (serve `--experimental-strip-types` per leggere `recipes.ts`).
- `firebase-admin` installato in `functions/` (`cd functions && npm install`).
- Credenziali con accesso a Firestore del progetto, una delle due:
  - `gcloud auth application-default login`
  - oppure una chiave di service account: `$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\percorso\chiave.json"` (PowerShell)

## Uso

Dalla cartella dell'app (`shelfy-app/shelfy-app`):

```powershell
# Prova (default): valida e mostra cosa verrebbe scritto, non tocca il database
node --experimental-strip-types scripts/seed-recipes/seed.mjs

# Prova con i documenti completi
node --experimental-strip-types scripts/seed-recipes/seed.mjs --verbose

# Scrittura vera
node --experimental-strip-types scripts/seed-recipes/seed.mjs --write
```

Il progetto è il `default` di `.firebaserc` (`shelfy-632e0`); per cambiarlo aggiungi `--project <id>`.
Per provare sull'emulatore imposta prima `$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"`.

## Cosa scrive

Ogni documento ha id fisso (`shelfy-ribollita`, `shelfy-torrijas`, …), `authorId: 'shelfy'`,
`authorName: 'Shelfy'`, `lang: 'it' | 'en' | 'es'` e `seed: true`.

Lo script si può rilanciare senza duplicare nulla: sui documenti già presenti aggiorna solo i
contenuti (titolo, testi, ingredienti, passaggi, …) e lascia invariati `ratingSum`, `ratingCount`
e `createdAt`. Sui nuovi documenti imposta i voti a 0 e `createdAt` come Timestamp, come fa l'app.

Per trovarle in seguito: query su `seed == true` o `authorId == 'shelfy'`.
